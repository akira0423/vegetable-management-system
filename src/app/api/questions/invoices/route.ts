import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/qa/supabase-client';

// GET: 請求書一覧取得
export async function GET(request: NextRequest) {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    const supabase = isProduction
      ? await createServerSupabaseClient()
      : createServiceRoleClient();

    // ユーザー認証
    let userId: string;
    if (isProduction) {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
      userId = user.id;
    } else {
      // 開発環境: テストユーザーを使用
      const { data: testProfile } = await supabase
        .from('qa_user_profiles')
        .select('user_id')
        .eq('display_name', '開発テストユーザー')
        .limit(1)
        .single();
      userId = testProfile?.user_id || 'test-user';
    }

    // URLパラメータから期間を取得
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    // クエリ構築
    let query = supabase
      .from('qa_invoices')
      .select('*')
      .eq('recipient_id', userId)
      .order('period_start', { ascending: false });

    // 年でフィルタリング
    if (year) {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      query = query.gte('period_start', startDate).lte('period_start', endDate);
    }

    // 月でフィルタリング
    if (month && year) {
      const monthStr = month.padStart(2, '0');
      const startDate = `${year}-${monthStr}-01`;
      const nextMonth = parseInt(month) + 1;
      const endDate = nextMonth > 12
        ? `${parseInt(year) + 1}-01-01`
        : `${year}-${nextMonth.toString().padStart(2, '0')}-01`;

      query = query.gte('period_start', startDate).lt('period_start', endDate);
    }

    const { data: invoices, error } = await query;

    if (error) {
      console.error('Error fetching invoices:', error);
      return NextResponse.json(
        { error: 'Failed to fetch invoices' },
        { status: 500 }
      );
    }

    // 開発環境でテストデータを生成
    if (!isProduction && (!invoices || invoices.length === 0)) {
      const testInvoices = generateTestInvoices(userId);
      return NextResponse.json(testInvoices);
    }

    return NextResponse.json(invoices || []);

  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// テストデータ生成関数
function generateTestInvoices(userId: string) {
  const currentDate = new Date();
  const invoices = [];

  for (let i = 0; i < 3; i++) {
    const date = new Date(currentDate);
    date.setMonth(date.getMonth() - i);

    const periodStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const periodEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const subtotal = Math.floor(Math.random() * 50000) + 10000;
    const taxAmount = Math.floor(subtotal * 0.1);
    const totalAmount = subtotal + taxAmount;

    invoices.push({
      id: `test-invoice-${i}`,
      recipient_id: userId,
      issuer_id: '00000000-0000-0000-0000-000000000000',
      invoice_number: `INV-${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}-001`,
      period_start: periodStart.toISOString().split('T')[0],
      period_end: periodEnd.toISOString().split('T')[0],
      subtotal,
      tax_rate: 10,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      status: i === 0 ? 'DRAFT' : 'ISSUED',
      issued_at: i === 0 ? null : new Date(date.getFullYear(), date.getMonth() + 1, 5).toISOString(),
      line_items: generateTestLineItems(periodStart, periodEnd),
      metadata: {
        type: 'platform_fee_invoice',
        generated_at: new Date().toISOString(),
      },
      created_at: periodStart.toISOString(),
      updated_at: periodStart.toISOString(),
    });
  }

  return invoices;
}

// テスト明細生成関数
function generateTestLineItems(periodStart: Date, periodEnd: Date) {
  const items = [];
  const types = ['ESCROW', 'PPV', 'TIP'];
  const descriptions = {
    'ESCROW': 'エスクロー手数料（20%）',
    'PPV': 'PPV手数料（20%）',
    'TIP': 'チップ手数料（20%）'
  };
  const numItems = Math.floor(Math.random() * 5) + 3;

  for (let i = 0; i < numItems; i++) {
    const date = new Date(
      periodStart.getTime() +
      Math.random() * (periodEnd.getTime() - periodStart.getTime())
    );
    const type = types[Math.floor(Math.random() * types.length)];

    items.push({
      date: date.toISOString(),
      type: type,
      questionId: `q-${Math.random().toString(36).substr(2, 9)}`,
      questionTitle: `テスト質問 ${i + 1}`,
      description: descriptions[type],
      amount: Math.floor(Math.random() * 5000) + 1000,
      transactionId: `t-${Math.random().toString(36).substr(2, 9)}`,
    });
  }

  return items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}