import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/qa/supabase-client';
import { capturePaymentIntent, createTransfer } from '@/lib/qa/stripe-client';

interface Params {
  params: Promise<{ id: string }>;
}

// POST: ベスト回答選定
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: answerId } = await params;

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
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
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

    // 回答情報取得
    const { data: answer, error: answerError } = await supabase
      .from('qa_answers')
      .select(`
        *,
        question:qa_questions!qa_answers_question_id_fkey(
          id,
          asker_id,
          bounty_amount,
          status,
          best_answer_id,
          stripe_payment_intent_id,
          platform_fee_rate
        )
      `)
      .eq('id', answerId)
      .single();

    if (answerError || !answer) {
      return NextResponse.json(
        { error: 'Answer not found' },
        { status: 404 }
      );
    }

    // 質問者本人かチェック
    if (answer.question.asker_id !== userId) {
      return NextResponse.json(
        { error: 'Only the question asker can select best answer' },
        { status: 403 }
      );
    }

    // すでにベスト回答が選定されていないかチェック
    if (answer.question.best_answer_id) {
      return NextResponse.json(
        { error: 'Best answer already selected' },
        { status: 400 }
      );
    }

    // 質問のステータスチェック
    if (!['ANSWERING', 'FUNDED', 'SELECTING'].includes(answer.question.status)) {
      return NextResponse.json(
        { error: 'Cannot select best answer at this stage' },
        { status: 400 }
      );
    }

    // トランザクション開始
    try {
      // 1. PaymentIntentのキャプチャ（まだキャプチャされていない場合）
      let captureSuccess = false;
      if (answer.question.stripe_payment_intent_id && isProduction) {
        try {
          const paymentIntent = await capturePaymentIntent(
            answer.question.stripe_payment_intent_id
          );
          captureSuccess = paymentIntent.status === 'succeeded';
        } catch (error) {
          console.error('Payment capture error:', error);
          // すでにキャプチャ済みの可能性もあるため、処理を続行
        }
      }

      // 2. データベース更新（select_best_answer関数を呼び出し）
      const { data: result, error: selectError } = await serviceClient
        .rpc('select_best_answer', {
          p_question_id: answer.question_id,
          p_answer_id: answerId,
          p_selected_by: userId
        });

      if (selectError) {
        console.error('Error selecting best answer:', selectError);
        return NextResponse.json(
          { error: 'Failed to select best answer' },
          { status: 500 }
        );
      }

      // 3. 回答者のStripeアカウント情報取得
      const { data: responderProfile } = await supabase
        .from('qa_user_profiles')
        .select('stripe_account_id, stripe_onboarding_completed')
        .eq('user_id', answer.responder_id)
        .single();

      // 4. Stripeトランスファー（回答者へ80%送金）
      if (responderProfile?.stripe_account_id && responderProfile.stripe_onboarding_completed) {
        const transferAmount = answer.question.bounty_amount * (1 - answer.question.platform_fee_rate);

        try {
          await createTransfer(
            transferAmount,
            responderProfile.stripe_account_id,
            answer.question_id,
            {
              type: 'BEST_ANSWER_REWARD',
              answer_id: answerId,
              question_id: answer.question_id,
            }
          );
        } catch (transferError) {
          console.error('Transfer error:', transferError);
          // トランスファー失敗はウォレット残高で管理するため、エラーにはしない
        }
      }

      // 5. 通知作成
      await supabase
        .from('qa_notifications')
        .insert([
          {
            user_id: answer.responder_id,
            type: 'BEST_SELECTED',
            title: 'ベストアンサーに選ばれました！',
            message: `あなたの回答がベストアンサーに選ばれ、報酬が付与されました。`,
            metadata: {
              question_id: answer.question_id,
              answer_id: answerId,
              amount: answer.question.bounty_amount * (1 - answer.question.platform_fee_rate),
            },
          },
          {
            user_id: userId,
            type: 'PAYMENT_RECEIVED',
            title: '決済が完了しました',
            message: `ベストアンサーの選定により、決済が完了しました。`,
            metadata: {
              question_id: answer.question_id,
              answer_id: answerId,
              amount: answer.question.bounty_amount,
            },
          }
        ]);

      return NextResponse.json({
        success: true,
        message: 'Best answer selected successfully',
      });
    } catch (error) {
      console.error('Transaction error:', error);
      return NextResponse.json(
        { error: 'Failed to complete best answer selection' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}