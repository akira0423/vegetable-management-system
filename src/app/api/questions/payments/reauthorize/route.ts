import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/qa/supabase-client';
import { createEscrowPaymentIntent } from '@/lib/qa/stripe-client';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.QA_STRIPE_SECRET_KEY!, {
  apiVersion: '2024-10-28.acacia',
});

// POST /api/qa/payments/reauthorize - 与信期限切れ再取得
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // 認証確認
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { questionId } = await request.json();

    // 質問情報取得
    const { data: question, error: questionError } = await supabase
      .from('qa_questions')
      .select('*')
      .eq('id', questionId)
      .eq('asker_id', user.id)
      .single();

    if (questionError || !question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // 既存のPaymentIntentチェック
    if (question.stripe_payment_intent_id) {
      try {
        const existingIntent = await stripe.paymentIntents.retrieve(
          question.stripe_payment_intent_id
        );

        // まだキャプチャ可能な場合
        if (existingIntent.status === 'requires_capture') {
          // 与信期限をチェック（7日間）
          const created = new Date(existingIntent.created * 1000);
          const expiresAt = new Date(created.getTime() + 7 * 24 * 60 * 60 * 1000);

          if (expiresAt > new Date()) {
            return NextResponse.json({
              success: true,
              message: 'Payment authorization is still valid',
              expiresAt: expiresAt.toISOString(),
              paymentIntentId: existingIntent.id
            });
          }
        }

        // キャンセルされた、または期限切れの場合は既存のIntentをキャンセル
        if (existingIntent.status !== 'canceled' && existingIntent.status !== 'succeeded') {
          await stripe.paymentIntents.cancel(existingIntent.id);
        }
      } catch (error) {
        console.error('Failed to retrieve existing payment intent:', error);
      }
    }

    // 新しいPaymentIntent作成
    const paymentIntent = await createEscrowPaymentIntent(
      question.bounty_amount,
      questionId,
      {
        asker_id: user.id,
        question_title: question.title
      }
    );

    // データベース更新
    const { error: updateError } = await supabase
      .from('qa_questions')
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        stripe_payment_intent_client_secret: paymentIntent.client_secret,
        updated_at: new Date().toISOString()
      })
      .eq('id', questionId);

    if (updateError) {
      // PaymentIntentをキャンセル
      await stripe.paymentIntents.cancel(paymentIntent.id);

      return NextResponse.json(
        { error: 'Failed to update question with new payment intent' },
        { status: 500 }
      );
    }

    // 監査ログ
    await supabase
      .from('qa_audit_logs')
      .insert({
        user_id: user.id,
        action: 'PAYMENT_REAUTHORIZED',
        entity_type: 'QUESTION',
        entity_id: questionId,
        metadata: {
          old_payment_intent_id: question.stripe_payment_intent_id,
          new_payment_intent_id: paymentIntent.id,
          amount: question.bounty_amount
        }
      });

    // 与信期限計算（7日後）
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    return NextResponse.json({
      success: true,
      message: 'Payment authorization renewed successfully',
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      expiresAt: expiresAt.toISOString()
    });
  } catch (error) {
    console.error('Payment reauthorization error:', error);
    return NextResponse.json(
      { error: 'Failed to reauthorize payment' },
      { status: 500 }
    );
  }
}