import Stripe from 'stripe';

// Stripe初期化
export const stripe = new Stripe(process.env.QA_STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
});

// エスクロー用PaymentIntent作成（manual capture）
export async function createEscrowPaymentIntent(
  amount: number,
  questionId: string,
  customerId?: string
) {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // 円をセントに変換
    currency: 'jpy',
    capture_method: 'manual', // 手動キャプチャ（エスクロー）
    transfer_group: questionId,
    metadata: {
      question_id: questionId,
      type: 'ESCROW',
    },
    customer: customerId,
  });

  return paymentIntent;
}

// PaymentIntentをキャプチャ
export async function capturePaymentIntent(paymentIntentId: string) {
  const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);
  return paymentIntent;
}

// PaymentIntentをキャンセル
export async function cancelPaymentIntent(paymentIntentId: string) {
  const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);
  return paymentIntent;
}

// Stripe Connectアカウント作成
export async function createConnectAccount(email: string) {
  const account = await stripe.accounts.create({
    type: 'express',
    country: 'JP',
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });

  return account;
}

// アカウントリンク作成（Onboarding用）
export async function createAccountLink(accountId: string) {
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${process.env.NEXTAUTH_URL}/qa/settings/stripe/refresh`,
    return_url: `${process.env.NEXTAUTH_URL}/qa/settings/stripe/return`,
    type: 'account_onboarding',
  });

  return accountLink;
}

// トランスファー（送金）作成
export async function createTransfer(
  amount: number,
  destinationAccountId: string,
  transferGroup: string,
  metadata?: Record<string, string>
) {
  const transfer = await stripe.transfers.create({
    amount: Math.round(amount * 100),
    currency: 'jpy',
    destination: destinationAccountId,
    transfer_group: transferGroup,
    metadata,
  });

  return transfer;
}

// PPV決済処理（即時決済）
export async function createPPVPayment(
  amount: number,
  questionId: string,
  customerId?: string
) {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency: 'jpy',
    capture_method: 'automatic', // 即時キャプチャ
    metadata: {
      question_id: questionId,
      type: 'PPV',
    },
    customer: customerId,
  });

  return paymentIntent;
}

// 返金処理
export async function createRefund(
  chargeId: string,
  amount?: number,
  reason?: string
) {
  const refund = await stripe.refunds.create({
    charge: chargeId,
    amount: amount ? Math.round(amount * 100) : undefined,
    reason: reason as Stripe.RefundCreateParams.Reason,
  });

  return refund;
}

// Webhook署名検証
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const endpointSecret = process.env.QA_STRIPE_WEBHOOK_SECRET!;
  return stripe.webhooks.constructEvent(payload, signature, endpointSecret);
}