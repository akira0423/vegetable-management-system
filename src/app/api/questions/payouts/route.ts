import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/qa/supabase-client';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.QA_STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

const MIN_PAYOUT_AMOUNT = 3000; // 最低出金額 ¥3,000
const PAYOUT_FEE_FIXED = 250; // 固定手数料 ¥250
const PAYOUT_FEE_RATE = 0.0025; // 変動手数料 0.25%

/**
 * 出金申請
 * POST /api/qa/payouts
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount } = body;

    if (!amount || amount < MIN_PAYOUT_AMOUNT) {
      return NextResponse.json(
        { error: `Minimum payout amount is ¥${MIN_PAYOUT_AMOUNT}` },
        { status: 400 }
      );
    }

    // 認証確認
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const serviceClient = createServiceRoleClient();

    // ウォレット残高確認
    const { data: wallet, error: walletError } = await serviceClient
      .from('qa_wallets')
      .select('id, balance_available, user_id')
      .eq('user_id', user.id)
      .single();

    if (walletError || !wallet) {
      return NextResponse.json(
        { error: 'Wallet not found' },
        { status: 404 }
      );
    }

    if (wallet.balance_available < amount) {
      return NextResponse.json(
        { error: 'Insufficient balance' },
        { status: 400 }
      );
    }

    // 手数料計算
    const feeRate = Math.round(amount * PAYOUT_FEE_RATE);
    const totalFee = PAYOUT_FEE_FIXED + feeRate;
    const netAmount = amount - totalFee;

    // ユーザーのStripeアカウント確認
    const { data: profile, error: profileError } = await serviceClient
      .from('qa_user_profiles')
      .select('stripe_account_id, stripe_account_status')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile?.stripe_account_id) {
      return NextResponse.json(
        { error: 'Stripe account not connected. Please connect your account first.' },
        { status: 400 }
      );
    }

    if (profile.stripe_account_status !== 'active') {
      return NextResponse.json(
        { error: 'Stripe account is not active. Please complete verification.' },
        { status: 400 }
      );
    }

    // 出金申請レコード作成
    const { data: payout, error: payoutError } = await serviceClient
      .from('qa_payouts')
      .insert({
        user_id: user.id,
        wallet_id: wallet.id,
        amount: amount,
        fee_fixed: PAYOUT_FEE_FIXED,
        fee_rate: feeRate,
        net_amount: netAmount,
        status: 'REQUESTED',
        bank_info: {
          stripe_account_id: profile.stripe_account_id,
        },
      })
      .select()
      .single();

    if (payoutError) {
      console.error('Payout creation error:', payoutError);
      return NextResponse.json(
        { error: 'Failed to create payout request' },
        { status: 500 }
      );
    }

    // ウォレット残高を減算（保留中に移動）
    const { error: walletUpdateError } = await serviceClient
      .from('qa_wallets')
      .update({
        balance_available: wallet.balance_available - amount,
        balance_pending: (wallet.balance_pending || 0) + amount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', wallet.id);

    if (walletUpdateError) {
      // ロールバック: 出金申請を取り消し
      await serviceClient
        .from('qa_payouts')
        .delete()
        .eq('id', payout.id);

      return NextResponse.json(
        { error: 'Failed to update wallet balance' },
        { status: 500 }
      );
    }

    // ウォレット取引履歴に記録
    await serviceClient
      .from('qa_wallet_transactions')
      .insert({
        wallet_id: wallet.id,
        type: 'DEBIT',
        amount: amount,
        balance_before: wallet.balance_available,
        balance_after: wallet.balance_available - amount,
        reference_type: 'PAYOUT',
        reference_id: payout.id,
        description: `出金申請 ¥${amount.toLocaleString()}`,
      });

    // Stripe Transferを作成（Connected Accountへの送金）
    try {
      const transfer = await stripe.transfers.create({
        amount: Math.round(netAmount * 100), // 円をcentに変換
        currency: 'jpy',
        destination: profile.stripe_account_id,
        transfer_group: `payout_${payout.id}`,
        metadata: {
          payout_id: payout.id,
          user_id: user.id,
          gross_amount: amount.toString(),
          fee: totalFee.toString(),
          net_amount: netAmount.toString(),
        },
      });

      // Transfer IDを記録
      await serviceClient
        .from('qa_payouts')
        .update({
          stripe_transfer_id: transfer.id,
          status: 'PROCESSING',
          approved_at: new Date().toISOString(),
        })
        .eq('id', payout.id);

      return NextResponse.json({
        success: true,
        payoutId: payout.id,
        amount: amount,
        fees: {
          fixed: PAYOUT_FEE_FIXED,
          rate: feeRate,
          total: totalFee,
        },
        netAmount: netAmount,
        estimatedArrival: '2-3営業日',
        status: 'PROCESSING',
      });
    } catch (stripeError: any) {
      console.error('Stripe transfer error:', stripeError);

      // Stripeエラーの場合、ウォレット残高を元に戻す
      await serviceClient
        .from('qa_wallets')
        .update({
          balance_available: wallet.balance_available,
          balance_pending: wallet.balance_pending || 0,
        })
        .eq('id', wallet.id);

      // 出金申請を失敗に更新
      await serviceClient
        .from('qa_payouts')
        .update({
          status: 'FAILED',
          failed_at: new Date().toISOString(),
          failure_reason: stripeError.message,
        })
        .eq('id', payout.id);

      return NextResponse.json(
        { error: 'Transfer failed: ' + stripeError.message },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Payout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 出金履歴取得
 * GET /api/qa/payouts
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');

    // 認証確認
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const serviceClient = createServiceRoleClient();

    // クエリ構築
    let query = serviceClient
      .from('qa_payouts')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('requested_at', { ascending: false });

    // ステータスフィルタ
    if (status) {
      query = query.eq('status', status);
    }

    // ページネーション
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: payouts, error, count } = await query;

    if (error) {
      console.error('Payouts fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch payouts' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      payouts: payouts || [],
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Get payouts error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}