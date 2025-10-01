import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/qa/supabase-client';

interface Params {
  params: Promise<{ userId: string }>;
}

// GET: ウォレット情報取得
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { userId } = await params;

    // 開発環境ではサービスロールクライアントを使用
    const isProduction = process.env.NODE_ENV === 'production';
    const supabase = isProduction
      ? await createServerSupabaseClient()
      : createServiceRoleClient();

    // 認証確認
    let currentUserId: string;
    if (isProduction) {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
      currentUserId = user.id;
    } else {
      // 開発環境: テストユーザーを取得
      const { data: testProfile } = await supabase
        .from('qa_user_profiles')
        .select('user_id')
        .eq('display_name', '開発テストユーザー')
        .limit(1)
        .single();
      currentUserId = testProfile?.user_id || userId;
    }

    // 本人確認（他人のウォレットは閲覧不可）
    if (currentUserId !== userId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // ウォレット情報取得
    const { data: wallet, error: walletError } = await supabase
      .from('qa_wallets')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (walletError && walletError.code !== 'PGRST116') { // PGRST116: not found
      console.error('Wallet fetch error:', walletError);
      return NextResponse.json(
        { error: 'Failed to fetch wallet' },
        { status: 500 }
      );
    }

    // ウォレットが存在しない場合は作成
    if (!wallet) {
      const { data: newWallet, error: createError } = await supabase
        .from('qa_wallets')
        .insert({
          user_id: userId,
          balance: 0,
          pending_amount: 0,
          escrow_amount: 0,
          auto_payout_enabled: false,
          auto_payout_threshold: 10000,
        })
        .select()
        .single();

      if (createError) {
        console.error('Wallet creation error:', createError);
        return NextResponse.json(
          { error: 'Failed to create wallet' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ...newWallet,
        transactions: [],
      });
    }

    // 取引履歴取得（10件まで）
    const { data: transactions } = await supabase
      .from('qa_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    // 保留中の金額を計算（PPV収益で未分配のもの）
    const { data: pendingRevenues } = await supabase
      .from('qa_ppv_revenues')
      .select('amount')
      .eq('distributed', false)
      .or(`purchaser_id.eq.${userId}`);

    const pendingAmount = pendingRevenues?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;

    return NextResponse.json({
      ...wallet,
      pending_amount: wallet.pending_amount + pendingAmount,
      transactions: transactions || [],
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}