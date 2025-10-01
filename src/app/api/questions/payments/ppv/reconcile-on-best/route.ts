import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/qa/supabase-client';

// POST /api/qa/payments/ppv/reconcile-on-best - ベスト選定後のPPV保留分清算
export async function POST(request: NextRequest) {
  try {
    const serviceClient = createServiceRoleClient();
    const { questionId, bestAnswerId } = await request.json();

    // PPVプール取得
    const { data: pool, error: poolError } = await serviceClient
      .from('qa_ppv_pools')
      .select('*')
      .eq('question_id', questionId)
      .eq('status', 'PENDING')
      .single();

    if (poolError || !pool) {
      return NextResponse.json({ error: 'PPV pool not found' }, { status: 404 });
    }

    // ベスト回答者情報取得
    const { data: bestAnswer, error: answerError } = await serviceClient
      .from('qa_answers')
      .select('responder_id')
      .eq('id', bestAnswerId)
      .single();

    if (answerError || !bestAnswer) {
      return NextResponse.json({ error: 'Best answer not found' }, { status: 404 });
    }

    // その他の回答者取得
    const { data: otherAnswers, error: othersError } = await serviceClient
      .from('qa_answers')
      .select('responder_id')
      .eq('question_id', questionId)
      .neq('id', bestAnswerId)
      .neq('is_blocked', true);

    if (othersError) {
      return NextResponse.json({ error: 'Failed to fetch other answers' }, { status: 500 });
    }

    // トランザクション開始
    const transactions = [];
    const walletUpdates = [];

    // ベスト回答者への分配（24%）
    transactions.push({
      type: 'PPV_BEST_ANSWER_SHARE',
      amount: pool.best_answer_amount,
      user_id: bestAnswer.responder_id,
      related_question_id: questionId,
      status: 'COMPLETED',
      metadata: {
        pool_id: pool.id,
        answer_id: bestAnswerId
      }
    });

    walletUpdates.push({
      user_id: bestAnswer.responder_id,
      amount: pool.best_answer_amount
    });

    // その他回答者への均等分配（16%）
    if (otherAnswers && otherAnswers.length > 0) {
      const perAnswerAmount = pool.other_answers_amount / otherAnswers.length;

      for (const answer of otherAnswers) {
        transactions.push({
          type: 'PPV_OTHER_ANSWER_SHARE',
          amount: perAnswerAmount,
          user_id: answer.responder_id,
          related_question_id: questionId,
          status: 'COMPLETED',
          metadata: {
            pool_id: pool.id,
            share_count: otherAnswers.length
          }
        });

        // ウォレット更新用データ
        const existing = walletUpdates.find(w => w.user_id === answer.responder_id);
        if (existing) {
          existing.amount += perAnswerAmount;
        } else {
          walletUpdates.push({
            user_id: answer.responder_id,
            amount: perAnswerAmount
          });
        }
      }
    }

    // トランザクション一括登録
    const { error: transactionError } = await serviceClient
      .from('qa_transactions')
      .insert(transactions);

    if (transactionError) {
      console.error('Transaction error:', transactionError);
      return NextResponse.json({ error: 'Failed to create transactions' }, { status: 500 });
    }

    // ウォレット残高更新
    for (const update of walletUpdates) {
      await serviceClient.rpc('update_wallet_balance', {
        p_user_id: update.user_id,
        p_amount_change: update.amount,
        p_transaction_type: 'PPV_DISTRIBUTION'
      });
    }

    // PPVプールステータス更新
    await serviceClient
      .from('qa_ppv_pools')
      .update({
        status: 'DISTRIBUTED',
        distributed_at: new Date().toISOString()
      })
      .eq('id', pool.id);

    // 通知作成
    const notifications = [
      {
        user_id: bestAnswer.responder_id,
        type: 'PPV_DISTRIBUTION',
        title: 'PPV報酬が分配されました',
        message: `ベストアンサーとしてPPV報酬が付与されました。`,
        metadata: {
          amount: pool.best_answer_amount,
          pool_id: pool.id
        }
      }
    ];

    // その他回答者への通知
    if (otherAnswers && otherAnswers.length > 0) {
      const perAnswerAmount = pool.other_answers_amount / otherAnswers.length;
      for (const answer of otherAnswers) {
        notifications.push({
          user_id: answer.responder_id,
          type: 'PPV_DISTRIBUTION',
          title: 'PPV報酬が分配されました',
          message: `回答者としてPPV報酬が付与されました。`,
          metadata: {
            amount: perAnswerAmount,
            pool_id: pool.id
          }
        });
      }
    }

    await serviceClient
      .from('qa_notifications')
      .insert(notifications);

    return NextResponse.json({
      success: true,
      message: 'PPV reconciliation completed',
      distribution: {
        best_answer: pool.best_answer_amount,
        other_answers: pool.other_answers_amount,
        other_answer_count: otherAnswers?.length || 0
      }
    });
  } catch (error) {
    console.error('PPV reconciliation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}