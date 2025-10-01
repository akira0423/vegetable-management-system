import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/utils/supabase/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.QA_STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

/**
 * エスクロー与信（manual capture）
 * 質問投稿時の懸賞金与信
 * POST /api/qa/payments/escrow
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { questionId, amount, paymentMethodId } = body;

    // パラメータ検証
    if (!questionId || !amount || amount < 10) {
      return NextResponse.json(
        { error: 'Invalid parameters' },
        { status: 400 }
      );
    }

    // 認証チェック
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 質問の存在確認とステータスチェック
    const { data: question, error: questionError } = await supabase
      .from('qa_questions')
      .select('id, status, asker_id, bounty_amount')
      .eq('id', questionId)
      .single();

    if (questionError || !question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }

    // 質問者本人確認
    if (question.asker_id !== user.id) {
      return NextResponse.json(
        { error: 'Not authorized' },
        { status: 403 }
      );
    }

    // ステータス確認（DRAFTまたはPENDING_PAYMENTのみ）
    if (!['DRAFT', 'PENDING_PAYMENT'].includes(question.status)) {
      return NextResponse.json(
        { error: 'Question already funded' },
        { status: 400 }
      );
    }

    // ユーザーのStripe顧客IDを取得または作成
    const { data: profile } = await supabase
      .from('qa_user_profiles')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      // Stripe顧客を作成
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;

      // プロフィールを更新
      await supabase
        .from('qa_user_profiles')
        .upsert({
          user_id: user.id,
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });
    }

    // PaymentIntentを作成（manual capture）
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // 円に変換
      currency: 'jpy',
      customer: customerId,
      payment_method: paymentMethodId,
      capture_method: 'manual', // マニュアルキャプチャ
      metadata: {
        question_id: questionId,
        type: 'escrow',
        bounty_amount: amount.toString(),
      },
      transfer_group: `question_${questionId}`, // Transfer Groupを設定
      confirm: true, // 即座に確認
    });

    // 質問のステータスをPENDING_PAYMENTに更新
    const { error: updateError } = await supabase
      .from('qa_questions')
      .update({
        status: 'PENDING_PAYMENT',
        stripe_payment_intent_id: paymentIntent.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', questionId);

    if (updateError) {
      console.error('Failed to update question:', updateError);
    }

    return NextResponse.json({
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      status: paymentIntent.status,
      amount: amount,
    });
  } catch (error) {
    console.error('Escrow payment error:', error);
    return NextResponse.json(
      { error: 'Payment processing failed' },
      { status: 500 }
    );
  }
}

/**
 * エスクローキャプチャ（全文開封/ベスト選定時）
 * POST /api/qa/payments/escrow?action=capture
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { paymentIntentId, questionId } = body;

    if (!paymentIntentId || !questionId) {
      return NextResponse.json(
        { error: 'Invalid parameters' },
        { status: 400 }
      );
    }

    // 認証チェック
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 質問の所有者確認
    const { data: question, error: questionError } = await supabase
      .from('qa_questions')
      .select('asker_id, bounty_amount, stripe_payment_intent_id')
      .eq('id', questionId)
      .single();

    if (questionError || !question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }

    if (question.asker_id !== user.id) {
      return NextResponse.json(
        { error: 'Not authorized' },
        { status: 403 }
      );
    }

    // PaymentIntentのキャプチャ
    const paymentIntent = await stripe.paymentIntents.capture(
      paymentIntentId,
      {
        amount_to_capture: Math.round(question.bounty_amount * 100),
      }
    );

    // トランザクションを記録
    const platformFee = question.bounty_amount * 0.2; // 20%手数料
    const netAmount = question.bounty_amount - platformFee;

    await supabase
      .from('qa_transactions')
      .insert({
        user_id: user.id,
        question_id: questionId,
        type: 'ESCROW',
        status: 'PROCESSING',
        amount: question.bounty_amount,
        platform_fee: platformFee,
        net_amount: netAmount,
        stripe_payment_intent_id: paymentIntentId,
        stripe_charge_id: paymentIntent.latest_charge as string,
        created_at: new Date().toISOString(),
      });

    // 質問ステータスを更新
    await supabase
      .from('qa_questions')
      .update({
        status: 'ANSWERING',
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', questionId);

    return NextResponse.json({
      success: true,
      captured: true,
      paymentIntentId: paymentIntent.id,
      amount: question.bounty_amount,
      status: 'ANSWERING',
    });
  } catch (error) {
    console.error('Capture error:', error);
    return NextResponse.json(
      { error: 'Capture failed' },
      { status: 500 }
    );
  }
}