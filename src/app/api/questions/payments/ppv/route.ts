import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/qa/supabase-client';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.QA_STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

/**
 * PPV購入処理（自動キャプチャ・分配）
 * 運営 20% / 質問者 40% / ベスト 24% / その他 16%
 * POST /api/qa/payments/ppv
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { questionId, paymentMethodId } = body;

    if (!questionId) {
      return NextResponse.json(
        { error: 'Question ID required' },
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

    // サービスロールクライアント（RLSバイパス）
    const serviceClient = createServiceRoleClient();

    // 質問情報取得
    const { data: question, error: questionError } = await serviceClient
      .from('qa_questions')
      .select(`
        id, 
        title, 
        bounty_amount, 
        asker_id, 
        best_answer_id,
        status
      `)
      .eq('id', questionId)
      .single();

    if (questionError || !question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }

    // 自分の質問へのPPV購入を防止
    if (question.asker_id === user.id) {
      return NextResponse.json(
        { error: 'Cannot purchase your own question' },
        { status: 400 }
      );
    }

    // 既にアクセス権があるか確認
    const { data: existingAccess } = await serviceClient
      .from('qa_access_grants')
      .select('id')
      .eq('user_id', user.id)
      .eq('question_id', questionId)
      .eq('access_type', 'PPV')
      .single();

    if (existingAccess) {
      return NextResponse.json(
        { error: 'Already purchased' },
        { status: 400 }
      );
    }

    const amount = question.bounty_amount;

    // ユーザーのStripe顧客ID取得
    const { data: profile } = await serviceClient
      .from('qa_user_profiles')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      // Stripe顧客作成
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;

      await serviceClient
        .from('qa_user_profiles')
        .upsert({
          user_id: user.id,
          stripe_customer_id: customerId,
        });
    }

    // PaymentIntent作成（自動キャプチャ）
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'jpy',
      customer: customerId,
      payment_method: paymentMethodId,
      capture_method: 'automatic', // 自動キャプチャ
      metadata: {
        question_id: questionId,
        type: 'ppv',
        user_id: user.id,
      },
      transfer_group: `ppv_${questionId}_${Date.now()}`,
      confirm: true,
    });

    // 分配計算
    const platformFee = Math.round(amount * 0.20);
    const askerShare = Math.round(amount * 0.40);
    const bestShare = Math.round(amount * 0.24);
    const othersShare = amount - platformFee - askerShare - bestShare; // 端数吼収

    // トランザクション記録
    const { data: transaction } = await serviceClient
      .from('qa_transactions')
      .insert({
        user_id: user.id,
        question_id: questionId,
        type: 'PPV',
        status: 'COMPLETED',
        amount: amount,
        platform_fee: platformFee,
        split_to_asker: askerShare,
        split_to_responder: bestShare,
        split_to_others: othersShare,
        split_to_platform: platformFee,
        stripe_payment_intent_id: paymentIntent.id,
        stripe_charge_id: paymentIntent.latest_charge as string,
        metadata: {
          purchased_by: user.id,
        },
      })
      .select()
      .single();

    // アクセス権付与
    await serviceClient
      .from('qa_access_grants')
      .insert({
        user_id: user.id,
        question_id: questionId,
        access_type: 'PPV',
        purchase_id: transaction.id,
        granted_at: new Date().toISOString(),
      });

    // 質問者への40%即時計上
    await serviceClient.rpc('update_wallet_balance', {
      p_wallet_id: question.asker_id,
      p_amount: askerShare,
      p_type: 'CREDIT',
      p_reference_type: 'PPV_REVENUE',
      p_reference_id: questionId,
      p_description: `PPV収益（40%）`,
    });

    // ベスト回答が確定済みの場合は24%即時計上
    if (question.best_answer_id) {
      const { data: bestAnswer } = await serviceClient
        .from('qa_answers')
        .select('responder_id')
        .eq('id', question.best_answer_id)
        .single();

      if (bestAnswer) {
        await serviceClient.rpc('update_wallet_balance', {
          p_wallet_id: bestAnswer.responder_id,
          p_amount: bestShare,
          p_type: 'CREDIT',
          p_reference_type: 'PPV_REVENUE',
          p_reference_id: questionId,
          p_description: `PPV収益（ベスト24%）`,
        });
      }
    } else {
      // ベスト未確定の場合はheld_for_bestに積み立て
      const { data: pool } = await serviceClient
        .from('qa_ppv_pools')
        .upsert({
          question_id: questionId,
          held_for_best: bestShare,
          total_amount: othersShare,
        }, {
          onConflict: 'question_id',
        })
        .select()
        .single();

      if (pool) {
        // 既存プールがある場合は加算
        await serviceClient
          .from('qa_ppv_pools')
          .update({
            held_for_best: pool.held_for_best + bestShare,
            total_amount: pool.total_amount + othersShare,
            updated_at: new Date().toISOString(),
          })
          .eq('question_id', questionId);
      }
    }

    // その他回答者プールへの16%積み立て
    // （プールメンバーは別途管理）
    const { data: answers } = await serviceClient
      .from('qa_answers')
      .select('id, responder_id')
      .eq('question_id', questionId)
      .neq('is_best', true);

    if (answers && answers.length > 0) {
      const { data: poolData } = await serviceClient
        .from('qa_ppv_pools')
        .select('id')
        .eq('question_id', questionId)
        .single();

      if (poolData) {
        // プールメンバー登録
        for (const answer of answers) {
          await serviceClient
            .from('qa_ppv_pool_members')
            .upsert({
              pool_id: poolData.id,
              answer_id: answer.id,
              responder_id: answer.responder_id,
              is_excluded: false,
            }, {
              onConflict: 'pool_id,answer_id',
            });
        }
      }
    }

    // 統計更新
    await serviceClient
      .from('qa_questions')
      .update({
        ppv_purchase_count: question.ppv_purchase_count + 1,
        total_ppv_revenue: question.total_ppv_revenue + amount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', questionId);

    return NextResponse.json({
      success: true,
      paymentIntentId: paymentIntent.id,
      amount: amount,
      breakdown: {
        platformFee,
        toAsker: askerShare,
        toBest: question.best_answer_id ? bestShare : 0,
        toOthersPool: othersShare,
      },
      accessGranted: true,
    });
  } catch (error) {
    console.error('PPV payment error:', error);
    return NextResponse.json(
      { error: 'Payment processing failed' },
      { status: 500 }
    );
  }
}