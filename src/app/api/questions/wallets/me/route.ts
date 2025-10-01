import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/qa/supabase-client';

// GET: 現在のユーザーのウォレット情報取得
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

      userId = testProfile?.user_id || 'test-user-' + Date.now();
    }

    // ウォレット情報を取得（存在しない場合は作成）
    let { data: wallet, error: walletError } = await supabase
      .from('qa_wallets')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (walletError || !wallet) {
      // ウォレットが存在しない場合は新規作成
      const { data: newWallet, error: createError } = await supabase
        .from('qa_wallets')
        .insert({
          user_id: userId,
          balance_available: 0,
          balance_pending: 0,
          total_earned: 0,
          total_withdrawn: 0,
          auto_payout_enabled: false,
          auto_payout_threshold: 10000,
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating wallet:', createError);
        return NextResponse.json(
          { error: 'Failed to create wallet' },
          { status: 500 }
        );
      }
      wallet = newWallet;
    }

    // 取引履歴を取得
    const { data: transactions, error: transError } = await supabase
      .from('qa_transactions')
      .select(`
        *,
        question:qa_questions(title)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (transError) {
      console.error('Error fetching transactions:', transError);
    }

    // PPV分配待ちの金額を計算
    const { data: pendingPPVShares } = await supabase
      .from('qa_ppv_pools')
      .select('best_amount, others_amount')
      .eq('is_distributed', false)
      .in('question_id', (transactions || [])
        .filter(t => t.type === 'BEST_ANSWER' || t.type === 'ANSWER')
        .map(t => t.question_id)
      );

    const pendingPPVAmount = (pendingPPVShares || []).reduce((sum, pool) => {
      return sum + (pool.best_amount || 0) + (pool.others_amount || 0);
    }, 0);

    // トランザクションデータを整形
    const formattedTransactions = (transactions || []).map(trans => ({
      id: trans.id,
      type: trans.type,
      amount: trans.amount,
      status: trans.status,
      description: trans.description || trans.type,
      created_at: trans.created_at,
      question_id: trans.question_id,
      question_title: trans.question?.title,
    }));

    return NextResponse.json({
      ...wallet,
      transactions: formattedTransactions,
      pending_ppv_shares: pendingPPVAmount,
    });

  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}