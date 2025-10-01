import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/qa/supabase-client';

// GET: 現在のユーザーのプロフィール取得
export async function GET(request: NextRequest) {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    const supabase = isProduction
      ? await createServerSupabaseClient()
      : createServiceRoleClient();

    // ユーザー認証
    let userId: string;
    let userEmail: string | undefined;

    if (isProduction) {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
      userId = user.id;
      userEmail = user.email;
    } else {
      // 開発環境: テストユーザーを使用
      const { data: testProfile } = await supabase
        .from('qa_user_profiles')
        .select('user_id')
        .eq('display_name', '開発テストユーザー')
        .limit(1)
        .single();

      if (!testProfile) {
        const testUserId = 'test-user-' + Date.now();
        const { data: newProfile } = await supabase
          .from('qa_user_profiles')
          .insert({
            user_id: testUserId,
            display_name: '開発テストユーザー',
            tier: 'BRONZE',
            reputation_score: 0,
            total_answers: 0,
            total_best_answers: 0,
            best_answer_rate: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
        userId = newProfile?.user_id || testUserId;
      } else {
        userId = testProfile.user_id;
      }
      userEmail = 'test@example.com';
    }

    // プロフィール情報を取得
    const { data: profile, error: profileError } = await supabase
      .from('qa_user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      // プロフィールが存在しない場合は新規作成
      const { data: newProfile, error: createError } = await supabase
        .from('qa_user_profiles')
        .insert({
          user_id: userId,
          display_name: userEmail?.split('@')[0] || 'ユーザー',
          tier: 'BRONZE',
          reputation_score: 0,
          total_answers: 0,
          total_best_answers: 0,
          best_answer_rate: 0,
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating profile:', createError);
        return NextResponse.json(
          { error: 'Failed to create profile' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ...newProfile,
        email: userEmail,
        wallet: null,
        stripe_account_status: null,
        stripe_onboarding_complete: false,
      });
    }

    // ウォレット情報を取得
    const { data: wallet } = await supabase
      .from('qa_wallets')
      .select('balance_available, balance_pending, total_earned')
      .eq('user_id', userId)
      .single();

    // Stripe Connect状態を取得（実装予定）
    const stripeAccountStatus = null;
    const stripeOnboardingComplete = false;

    return NextResponse.json({
      ...profile,
      email: userEmail,
      wallet,
      stripe_account_status: stripeAccountStatus,
      stripe_onboarding_complete: stripeOnboardingComplete,
    });

  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH: プロフィール更新
export async function PATCH(request: NextRequest) {
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
      userId = testProfile?.user_id || 'test-user';
    }

    const body = await request.json();

    // 更新可能なフィールドのみを抽出
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (body.display_name !== undefined) {
      updateData.display_name = body.display_name;
    }
    if (body.bio !== undefined) {
      updateData.bio = body.bio;
    }
    if (body.expertise_areas !== undefined) {
      updateData.expertise_areas = body.expertise_areas;
    }
    if (body.invoice_registration_no !== undefined) {
      updateData.invoice_registration_no = body.invoice_registration_no;
    }
    if (body.company_name !== undefined) {
      updateData.company_name = body.company_name;
    }
    if (body.billing_address !== undefined) {
      updateData.billing_address = body.billing_address;
    }

    // プロフィールを更新
    const { data: updatedProfile, error: updateError } = await supabase
      .from('qa_user_profiles')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating profile:', updateError);
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedProfile);

  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}