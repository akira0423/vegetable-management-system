import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/qa/supabase-client';
import { capturePaymentIntent } from '@/lib/qa/stripe-client';

interface Params {
  params: Promise<{ id: string }>;
}

// POST /api/qa/questions/{id}/open-full - 初回全文開封（エスクロー決済キャプチャ）
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: questionId } = await params;

    // 開発環境ではサービスロールクライアントを使用
    const isProduction = process.env.NODE_ENV === 'production';
    const supabase = isProduction
      ? await createServerSupabaseClient()
      : createServiceRoleClient();
    const serviceClient = createServiceRoleClient();

    // 認証確認
    let userId: string;
    if (isProduction) {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      userId = user.id;
    } else {
      // 開発環境: テストユーザーを取得
      const { data: testProfile } = await supabase
        .from('qa_user_profiles')
        .select('user_id')
        .eq('display_name', '開発テストユーザー')
        .limit(1)
        .single();

      if (!testProfile) {
        return NextResponse.json(
          { error: 'Test user not found' },
          { status: 500 }
        );
      }
      userId = testProfile.user_id;
    }

    // 質問情報取得
    const { data: question, error: questionError } = await supabase
      .from('qa_questions')
      .select('*')
      .eq('id', questionId)
      .single();

    if (questionError || !question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // 公開質問でない場合はエラー
    if (question.status !== 'PUBLISHED' && question.status !== 'ANSWERING') {
      return NextResponse.json(
        { error: 'Question is not available for viewing' },
        { status: 400 }
      );
    }

    // 質問者本人は無料でアクセス可能
    if (question.asker_id === userId) {
      // アクセスログ作成（質問者本人）
      // アクセス権限を付与
      await supabase
        .from('qa_access_grants')
        .insert({
          user_id: userId,
          question_id: questionId,
          access_type: 'PPV',
          granted_at: new Date().toISOString()
        });

      return NextResponse.json({
        success: true,
        message: 'Full access granted (question owner)',
        requiresPayment: false
      });
    }

    // 既存のアクセス権限チェック
    const { data: existingAccess } = await supabase
      .from('qa_access_grants')
      .select('*')
      .eq('user_id', userId)
      .eq('question_id', questionId)
      .eq('access_type', 'PPV')
      .single();

    if (existingAccess) {
      return NextResponse.json({
        success: true,
        message: 'You already have full access to this question',
        requiresPayment: false
      });
    }

    // PPV価格計算（報酬額の40%）
    const ppvAmount = Math.floor(question.bounty_amount * 0.4);

    // 開発環境では決済をシミュレート
    if (!isProduction) {
      // アクセス権限を付与
      const { error: grantError } = await supabase
        .from('qa_access_grants')
        .insert({
          question_id: questionId,
          user_id: userId,
          access_type: 'PPV',
          granted_at: new Date().toISOString(),
        });

      if (grantError) {
        console.error('Error granting PPV access:', grantError);
        return NextResponse.json(
          { error: 'Failed to grant PPV access' },
          { status: 500 }
        );
      }

      // PPV収益分配記録
      const { error: revenueError } = await supabase
        .from('qa_ppv_revenues')
        .insert({
          question_id: questionId,
          purchaser_id: userId,
          amount: ppvAmount,
          distributed: false,
        });

      if (revenueError) {
        console.error('Error recording PPV revenue:', revenueError);
      }

      return NextResponse.json({
        success: true,
        requiresPayment: false,
        message: 'PPV access granted (development mode)',
      });
    }

    // 本番環境：Stripe決済処理
    try {
      // ここに本番環境のStripe決済ロジックを実装
      // PaymentIntentの作成と確認
      // const paymentIntent = await createPaymentIntent(ppvAmount);
      // ...

      // トランザクション開始
      // 1. アクセス権限付与
      const { error: grantError } = await serviceClient
        .from('qa_access_grants')
        .insert({
          user_id: userId,
          question_id: questionId,
          access_type: 'PPV',
          granted_at: new Date().toISOString()
        });

      if (grantError) {
        console.error('Access grant error:', grantError);
        throw new Error('Failed to grant access');
      }

      // 2. PPV収益記録
      const { error: revenueError } = await serviceClient
        .from('qa_ppv_revenues')
        .insert({
          question_id: questionId,
          purchaser_id: userId,
          amount: ppvAmount,
          distributed: false
        });

      if (revenueError) {
        console.error('PPV revenue error:', revenueError);
      }

      // 3. 質問ステータスを更新（初回の全文開封の場合）
      if (question.status === 'PUBLISHED') {
        await serviceClient
          .from('qa_questions')
          .update({
            status: 'ANSWERING',
            funded_at: new Date().toISOString()
          })
          .eq('id', questionId);
      }

      // 4. トランザクション記録（PPV購入）
      await serviceClient
        .from('qa_transactions')
        .insert({
          type: 'PPV_PURCHASE',
          amount: ppvAmount,
          user_id: userId,
          related_question_id: questionId,
          status: 'COMPLETED',
          metadata: {
            access_type: 'PPV'
          }
        });

      // 5. 監査ログ
      await serviceClient
        .from('qa_audit_logs')
        .insert({
          user_id: userId,
          action: 'PPV_ACCESS_GRANTED',
          entity_type: 'QUESTION',
          entity_id: questionId,
          metadata: {
            payment_amount: ppvAmount
          }
        });

      // 6. 通知作成
      await serviceClient
        .from('qa_notifications')
        .insert([
          {
            user_id: question.asker_id,
            type: 'PPV_PURCHASE',
            title: 'あなたの質問が購入されました',
            message: `質問「${question.title}」のPPV閲覧権が購入されました。`,
            metadata: {
              question_id: questionId,
              purchaser_id: userId,
              amount: ppvAmount
            }
          },
          {
            user_id: userId,
            type: 'PPV_ACCESS_GRANTED',
            title: 'PPV閲覧権を取得しました',
            message: `質問の全文閲覧権限が付与されました。`,
            metadata: {
              question_id: questionId,
              amount: ppvAmount
            }
          }
        ]);

      return NextResponse.json({
        success: true,
        message: 'PPV access granted successfully',
        requiresPayment: true,
        payment: {
          amount: ppvAmount
        }
      });
    } catch (paymentError) {
      console.error('Payment error:', paymentError);

      // 失敗の監査ログ
      await serviceClient
        .from('qa_audit_logs')
        .insert({
          user_id: userId,
          action: 'PPV_PAYMENT_FAILED',
          entity_type: 'QUESTION',
          entity_id: questionId,
          metadata: {
            error: paymentError instanceof Error ? paymentError.message : 'Unknown error'
          }
        });

      return NextResponse.json(
        { error: 'Payment failed. Please try again or contact support.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Open full access error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}