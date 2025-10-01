import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/utils/supabase/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.QA_STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

const CONNECT_CLIENT_ID = process.env.QA_STRIPE_CONNECT_CLIENT_ID!;
const REDIRECT_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * Stripe Connect OAuth開始
 * GET /api/qa/connect?action=start
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  
  // OAuth開始
  if (action === 'start') {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Stripe Connect OAuth URL生成
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: CONNECT_CLIENT_ID,
      scope: 'read_write',
      redirect_uri: `${REDIRECT_URL}/api/qa/connect`,
      state: user.id, // ユーザーIDをstateとして保存
      'stripe_user[email]': user.email || '',
      'stripe_user[country]': 'JP',
      'stripe_user[currency]': 'JPY',
      'stripe_user[business_type]': 'individual',
    });

    const connectUrl = `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
    
    return NextResponse.redirect(connectUrl);
  }

  // OAuthコールバック処理
  if (code && state) {
    try {
      // Stripeからアクセストークンを取得
      const response = await stripe.oauth.token({
        grant_type: 'authorization_code',
        code,
      });

      const connectedAccountId = response.stripe_user_id;
      
      // Supabaseにアカウント情報を保存
      const supabase = await createServerSupabaseClient();
      const userId = state; // stateからユーザーIDを復元

      const { error: updateError } = await supabase
        .from('qa_user_profiles')
        .upsert({
          user_id: userId,
          stripe_account_id: connectedAccountId,
          stripe_account_status: 'active',
          stripe_onboarding_completed: true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (updateError) {
        console.error('Failed to update user profile:', updateError);
        return NextResponse.redirect(`${REDIRECT_URL}/qa?error=profile_update_failed`);
      }

      // 成功時はダッシュボードへリダイレクト
      return NextResponse.redirect(`${REDIRECT_URL}/qa?connected=true`);
    } catch (error) {
      console.error('Stripe Connect OAuth error:', error);
      return NextResponse.redirect(`${REDIRECT_URL}/qa?error=connection_failed`);
    }
  }

  // 無効なリクエスト
  return NextResponse.json(
    { error: 'Invalid request' },
    { status: 400 }
  );
}

/**
 * Stripe Connectアカウント情報取得
 * POST /api/qa/connect
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // ユーザーのStripeアカウント情報を取得
    const { data: profile, error: profileError } = await supabase
      .from('qa_user_profiles')
      .select('stripe_account_id, stripe_account_status')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile?.stripe_account_id) {
      return NextResponse.json({
        connected: false,
        message: 'Stripe account not connected',
      });
    }

    // Stripeアカウントの詳細情報を取得
    const account = await stripe.accounts.retrieve(profile.stripe_account_id);

    return NextResponse.json({
      connected: true,
      accountId: account.id,
      payoutsEnabled: account.payouts_enabled,
      chargesEnabled: account.charges_enabled,
      detailsSubmitted: account.details_submitted,
      email: account.email,
      country: account.country,
      defaultCurrency: account.default_currency,
    });
  } catch (error) {
    console.error('Error fetching Stripe account:', error);
    return NextResponse.json(
      { error: 'Failed to fetch account information' },
      { status: 500 }
    );
  }
}

/**
 * Stripe Connectアカウント切断
 * DELETE /api/qa/connect
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Stripeアカウント情報をクリア
    const { error: updateError } = await supabase
      .from('qa_user_profiles')
      .update({
        stripe_account_id: null,
        stripe_account_status: 'disconnected',
        stripe_onboarding_completed: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to disconnect account' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Stripe account disconnected successfully',
    });
  } catch (error) {
    console.error('Error disconnecting Stripe account:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect account' },
      { status: 500 }
    );
  }
}