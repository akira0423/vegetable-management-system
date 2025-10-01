import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/qa/supabase-client';
import Stripe from 'stripe';

interface Params {
  params: Promise<{ id: string }>;
}

const stripe = new Stripe(process.env.QA_STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia',
});

// POST: PPV購入（同額解錠）
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: questionId } = await params;
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
      // 開発環境: PPV購入用テストユーザーを使用
      const { data: testProfile } = await supabase
        .from('qa_user_profiles')
        .select('user_id')
        .eq('display_name', '開発テストPPV購入者')
        .limit(1)
        .single();

      if (!testProfile) {
        const testUserId = 'test-ppv-buyer-' + Date.now();
        const { data: newProfile } = await supabase
          .from('qa_user_profiles')
          .insert({
            user_id: testUserId,
            display_name: '開発テストPPV購入者',
            tier: 'BRONZE',
            reputation_score: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
        userId = newProfile?.user_id || testUserId;
      } else {
        userId = testProfile.user_id;
      }
    }

    // 質問情報を取得
    const { data: question, error: questionError } = await supabase
      .from('qa_questions')
      .select('id, bounty_amount, asker_id, status')
      .eq('id', questionId)
      .single();

    if (questionError || !question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }

    // 質問者自身はPPV購入不要
    if (question.asker_id === userId) {
      return NextResponse.json(
        { error: 'Question owner does not need to pay for PPV' },
        { status: 400 }
      );
    }

    // 既にPPVアクセス権を持っているかチェック
    const { data: existingAccess } = await supabase
      .from('qa_access_grants')
      .select('id')
      .eq('question_id', questionId)
      .eq('user_id', userId)
      .eq('access_type', 'PPV')
      .single();

    if (existingAccess) {
      return NextResponse.json(
        { error: 'Already purchased PPV access' },
        { status: 400 }
      );
    }

    // PPV価格は懸賞金と同額
    const ppvAmount = question.bounty_amount;

    // 開発環境では決済をスキップ
    let paymentIntentId: string | null = null;
    if (isProduction && process.env.QA_STRIPE_SECRET_KEY) {
      // Stripe決済処理
      const paymentIntent = await stripe.paymentIntents.create({
        amount: ppvAmount,
        currency: 'jpy',
        capture_method: 'automatic',
        metadata: {
          question_id: questionId,
          user_id: userId,
          type: 'PPV'
        },
        transfer_group: `ppv_${questionId}_${userId}`,
      });
      paymentIntentId = paymentIntent.id;

      // 決済確認（本番では実際の決済フローが必要）
      await stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: 'pm_card_visa', // テストカード
      });
    }

    // PPVトランザクション記録
    const { data: transaction, error: transactionError } = await supabase
      .from('qa_transactions')
      .insert({
        question_id: questionId,
        user_id: userId,
        type: 'PPV',
        amount: ppvAmount,
        status: 'COMPLETED',
        platform_fee: Math.floor(ppvAmount * 0.2), // 運営手数料20%
        net_amount: Math.floor(ppvAmount * 0.8),  // 残り80%が分配対象
        stripe_payment_intent_id: paymentIntentId,
      })
      .select()
      .single();

    if (transactionError) {
      console.error('Error creating PPV transaction:', transactionError);
      return NextResponse.json(
        { error: 'Failed to process PPV payment' },
        { status: 500 }
      );
    }

    // アクセス権付与
    const { error: accessError } = await supabase
      .from('qa_access_grants')
      .insert({
        question_id: questionId,
        user_id: userId,
        access_type: 'PPV',
        granted_by: 'PAYMENT',
        expires_at: null, // 無期限
      });

    if (accessError) {
      console.error('Error granting PPV access:', accessError);
      return NextResponse.json(
        { error: 'Failed to grant access' },
        { status: 500 }
      );
    }

    // PPVプールに追加（分配は後で行う）
    const poolAmount = Math.floor(ppvAmount * 0.8); // 残り80%
    const { error: poolError } = await supabase
      .from('qa_ppv_pools')
      .insert({
        question_id: questionId,
        transaction_id: transaction.id,
        total_amount: poolAmount,
        asker_amount: Math.floor(poolAmount * 0.5),      // 40%（全体の32%）
        best_amount: Math.floor(poolAmount * 0.3),        // 24%（全体の19.2%）
        others_amount: Math.floor(poolAmount * 0.2),      // 16%（全体の12.8%）
        is_distributed: false,
      });

    if (poolError) {
      console.error('Error creating PPV pool:', poolError);
    }

    // 通知を作成
    await supabase
      .from('qa_notifications')
      .insert({
        user_id: question.asker_id,
        type: 'PPV_PURCHASE',
        title: 'PPVで回答が購入されました',
        message: `あなたの質問がPPVで購入されました（¥${ppvAmount}）`,
        metadata: {
          question_id: questionId,
          buyer_id: userId,
          amount: ppvAmount,
        },
      });

    return NextResponse.json({
      success: true,
      transaction_id: transaction.id,
      access_granted: true,
    });

  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}