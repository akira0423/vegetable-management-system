import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { createServiceRoleClient } from '@/lib/qa/supabase-client';

// Stripeインスタンス初期化
const stripe = process.env.QA_STRIPE_SECRET_KEY
  ? new Stripe(process.env.QA_STRIPE_SECRET_KEY, {
      apiVersion: '2024-11-20.acacia',
    })
  : null;

const endpointSecret = process.env.QA_STRIPE_WEBHOOK_SECRET || '';

export async function POST(request: NextRequest) {
  try {
    // 開発環境ではwebhookをスキップ
    if (process.env.NODE_ENV !== 'production' || !stripe) {
      return NextResponse.json({
        received: true,
        message: 'Development environment - webhook skipped',
      });
    }

    const body = await request.text();
    const signature = (await headers()).get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        endpointSecret
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // イベントタイプ別の処理
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const metadata = paymentIntent.metadata;

        if (metadata.type === 'escrow') {
          // エスクローの与信成功（まだキャプチャ前）
          await supabase
            .from('qa_questions')
            .update({
              status: 'FUNDED',
              stripe_payment_intent_id: paymentIntent.id,
              published_at: new Date().toISOString(),
            })
            .eq('id', metadata.question_id);

          // トランザクション記録
          await supabase
            .from('qa_transactions')
            .insert({
              user_id: metadata.user_id,
              question_id: metadata.question_id,
              type: 'ESCROW',
              status: 'PENDING', // まだキャプチャ前
              amount: Number(metadata.bounty_amount),
              stripe_payment_intent_id: paymentIntent.id,
            });
        } else if (metadata.type === 'ppv') {
          // PPV購入成功
          await supabase
            .from('qa_transactions')
            .update({
              status: 'COMPLETED',
              completed_at: new Date().toISOString(),
            })
            .eq('stripe_payment_intent_id', paymentIntent.id);
        }

        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('PaymentIntent failed:', paymentIntent.id);

        // トランザクション記録を更新
        await supabase
          .from('qa_transactions')
          .update({
            status: 'FAILED',
            failed_at: new Date().toISOString(),
            error_message: paymentIntent.last_payment_error?.message,
          })
          .eq('stripe_payment_intent_id', paymentIntent.id);

        break;
      }

      case 'charge.captured': {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = charge.payment_intent as string;

        // キャプチャ成功（エスクロー確定）
        await supabase
          .from('qa_transactions')
          .update({
            status: 'COMPLETED',
            stripe_charge_id: charge.id,
            completed_at: new Date().toISOString(),
          })
          .eq('stripe_payment_intent_id', paymentIntentId);

        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const refund = charge.refunds?.data[0];

        if (refund) {
          // 返金記録
          await supabase
            .from('qa_transactions')
            .insert({
              type: 'REFUND',
              status: 'COMPLETED',
              amount: refund.amount / 100,
              stripe_refund_id: refund.id,
              stripe_charge_id: charge.id,
              metadata: {
                reason: refund.reason,
                refunded_at: new Date().toISOString(),
              },
            });
        }

        break;
      }

      case 'transfer.created': {
        const transfer = event.data.object as Stripe.Transfer;
        console.log('Transfer created:', transfer.id);

        // トランスファー記録
        await supabase
          .from('qa_transactions')
          .insert({
            type: 'TRANSFER',
            amount: transfer.amount / 100, // cent to yen
            user_id: transfer.metadata?.user_id,
            related_question_id: transfer.metadata?.question_id,
            status: 'PENDING',
            stripe_transfer_id: transfer.id,
            metadata: transfer.metadata,
          });

        break;
      }

      case 'transfer.updated': {
        const transfer = event.data.object as Stripe.Transfer;
        console.log('Transfer updated:', transfer.id);

        // ステータスを更新
        const status = transfer.reversed
          ? 'REVERSED'
          : transfer.amount_reversed > 0
          ? 'PARTIALLY_REVERSED'
          : 'COMPLETED';

        await supabase
          .from('qa_transactions')
          .update({
            status,
            metadata: {
              ...(transfer.metadata || {}),
              reversed_amount: transfer.amount_reversed,
              webhook_updated_at: new Date().toISOString(),
            },
          })
          .eq('stripe_transfer_id', transfer.id);

        break;
      }

      case 'payout.created': {
        const payout = event.data.object as Stripe.Payout;
        console.log('Payout created:', payout.id);

        // 出金記録を更新
        await supabase
          .from('qa_payouts')
          .update({
            status: 'PROCESSING',
            stripe_payout_id: payout.id,
            processed_at: new Date().toISOString(),
          })
          .eq('stripe_payout_id', payout.id);

        break;
      }

      case 'payout.paid': {
        const payout = event.data.object as Stripe.Payout;
        console.log('Payout paid:', payout.id);

        // 出金完了
        await supabase
          .from('qa_payouts')
          .update({
            status: 'COMPLETED',
            completed_at: new Date().toISOString(),
          })
          .eq('stripe_payout_id', payout.id);

        break;
      }

      case 'payout.failed': {
        const payout = event.data.object as Stripe.Payout;
        console.log('Payout failed:', payout.id);

        // 出金失敗
        await supabase
          .from('qa_payouts')
          .update({
            status: 'FAILED',
            failed_at: new Date().toISOString(),
            failure_reason: payout.failure_message || 'Unknown error',
          })
          .eq('stripe_payout_id', payout.id);

        break;
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        console.log('Account updated:', account.id);

        // Connectアカウントのステータスを更新
        if (account.charges_enabled && account.payouts_enabled) {
          // オンボーディング完了
          await supabase
            .from('qa_user_profiles')
            .update({
              stripe_onboarding_completed: true,
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_account_id', account.id);
        }

        break;
      }

      case 'payout.paid': {
        const payout = event.data.object as Stripe.Payout;
        console.log('Payout paid:', payout.id);

        // 出金完了を記録
        await supabase
          .from('qa_transactions')
          .update({
            status: 'COMPLETED',
            metadata: {
              payout_id: payout.id,
              arrived_at: new Date().toISOString(),
            },
          })
          .eq('stripe_payout_id', payout.id);

        break;
      }

      case 'payout.failed': {
        const payout = event.data.object as Stripe.Payout;
        console.log('Payout failed:', payout.id);

        // 出金失敗を記録
        await supabase
          .from('qa_transactions')
          .update({
            status: 'FAILED',
            metadata: {
              payout_id: payout.id,
              failure_message: payout.failure_message,
              failed_at: new Date().toISOString(),
            },
          })
          .eq('stripe_payout_id', payout.id);

        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // 監査ログを記録
    await supabase
      .from('qa_audit_logs')
      .insert({
        action: 'WEBHOOK_RECEIVED',
        entity_type: 'STRIPE_WEBHOOK',
        entity_id: event.id,
        metadata: {
          event_type: event.type,
          livemode: event.livemode,
          created: event.created,
        },
      });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}