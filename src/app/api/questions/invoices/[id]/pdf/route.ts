import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/qa/supabase-client';
import { renderToBuffer } from '@react-pdf/renderer';
import InvoicePDF from '@/components/qa/InvoicePDF';

interface Params {
  params: Promise<{ id: string }>;
}

// GET: 請求書PDFダウンロード
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
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

    // 請求書データを取得
    let invoice: any;

    if (!isProduction && id.startsWith('test-')) {
      // テストデータを生成
      invoice = generateTestInvoice(id, userId);
    } else {
      const { data, error } = await supabase
        .from('qa_invoices')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: 'Invoice not found' },
          { status: 404 }
        );
      }

      // アクセス権限チェック
      if (data.recipient_id !== userId) {
        // 管理者チェック
        const { data: profile } = await supabase
          .from('qa_user_profiles')
          .select('is_admin')
          .eq('user_id', userId)
          .single();

        if (!profile?.is_admin) {
          return NextResponse.json(
            { error: 'Forbidden' },
            { status: 403 }
          );
        }
      }

      invoice = data;
    }

    // ユーザー情報を取得
    const { data: userProfile } = await supabase
      .from('qa_user_profiles')
      .select('display_name, company_name, billing_address, invoice_registration_no')
      .eq('user_id', invoice.recipient_id)
      .single();

    // 発行者情報（プラットフォーム運営会社）
    const issuerInfo = {
      company_name: process.env.PLATFORM_COMPANY_NAME || 'Q&Aプラットフォーム運営会社',
      address: process.env.PLATFORM_ADDRESS || '〒100-0001 東京都千代田区千代田1-1',
      registration_no: process.env.PLATFORM_REGISTRATION_NO || 'T1234567890123',
      tel: process.env.PLATFORM_TEL || '03-1234-5678',
      email: process.env.PLATFORM_EMAIL || 'support@qa-platform.com',
    };

    // PDFデータを構築
    const pdfData = {
      ...invoice,
      issuer: issuerInfo,
      recipient: {
        display_name: userProfile?.display_name || '受領者',
        company_name: userProfile?.company_name,
        billing_address: userProfile?.billing_address,
        invoice_registration_no: userProfile?.invoice_registration_no,
      },
    };

    // PDFを生成
    const pdfBuffer = await renderToBuffer(<InvoicePDF invoice={pdfData} />);

    // PDFレスポンスを返す
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice_${invoice.invoice_number}.pdf"`,
      },
    });

  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// テスト請求書生成
function generateTestInvoice(id: string, userId: string) {
  const currentDate = new Date();
  const periodStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const periodEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  const subtotal = 35000;
  const taxAmount = 3500;
  const totalAmount = 38500;

  return {
    id,
    recipient_id: userId,
    issuer_id: '00000000-0000-0000-0000-000000000000',
    invoice_number: `INV-${currentDate.getFullYear()}${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-001`,
    period_start: periodStart.toISOString().split('T')[0],
    period_end: periodEnd.toISOString().split('T')[0],
    subtotal,
    tax_rate: 10,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    status: 'ISSUED',
    issued_at: currentDate.toISOString(),
    line_items: [
      {
        date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 5).toISOString(),
        type: 'ESCROW',
        questionTitle: 'テスト質問1 - 水稲の病害虫対策について',
        description: 'エスクロー手数料（20%）',
        amount: 5000,
      },
      {
        date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 10).toISOString(),
        type: 'PPV',
        questionTitle: 'テスト質問2 - 有機栽培の土壌改良方法',
        description: 'PPV手数料（20%）',
        amount: 3000,
      },
      {
        date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 15).toISOString(),
        type: 'ESCROW',
        questionTitle: 'テスト質問3 - トマトの育て方',
        description: 'エスクロー手数料（20%）',
        amount: 10000,
      },
      {
        date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 20).toISOString(),
        type: 'PPV',
        questionTitle: 'テスト質問4 - 農薬の使い方',
        description: 'PPV手数料（20%）',
        amount: 7000,
      },
      {
        date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 25).toISOString(),
        type: 'TIP',
        questionTitle: 'テスト質問5 - 収穫時期の見極め方',
        description: 'チップ手数料（20%）',
        amount: 10000,
      },
    ],
  };
}