import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/qa/supabase-client';

/**
 * PPVプール分配処理
 * ベスト確定時の24%一括清算とその他16%均等割
 * POST /api/qa/settlements
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { questionId, action } = body;

    if (!questionId || !action) {
      return NextResponse.json(
        { error: 'Question ID and action required' },
        { status: 400 }
      );
    }

    const serviceClient = createServiceRoleClient();

    // 質問情報取得
    const { data: question, error: questionError } = await serviceClient
      .from('qa_questions')
      .select(`
        id,
        best_answer_id,
        status,
        bounty_amount
      `)
      .eq('id', questionId)
      .single();

    if (questionError || !question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }

    // PPVプール情報取得
    const { data: pool, error: poolError } = await serviceClient
      .from('qa_ppv_pools')
      .select('*')
      .eq('question_id', questionId)
      .single();

    if (poolError || !pool) {
      return NextResponse.json({
        message: 'No PPV pool found for this question',
        distributed: 0,
      });
    }

    if (action === 'distribute_best') {
      // ベスト24%一括清算
      if (!question.best_answer_id) {
        return NextResponse.json(
          { error: 'Best answer not selected' },
          { status: 400 }
        );
      }

      if (pool.held_for_best <= 0) {
        return NextResponse.json({
          message: 'No held amount for best answer',
          distributed: 0,
        });
      }

      // ベスト回答者情報取得
      const { data: bestAnswer } = await serviceClient
        .from('qa_answers')
        .select('responder_id')
        .eq('id', question.best_answer_id)
        .single();

      if (!bestAnswer) {
        return NextResponse.json(
          { error: 'Best answer not found' },
          { status: 404 }
        );
      }

      // ベスト回答者のウォレットを更新
      const { data: wallet } = await serviceClient
        .from('qa_wallets')
        .select('id, balance_available')
        .eq('user_id', bestAnswer.responder_id)
        .single();

      if (!wallet) {
        // ウォレットがなければ作成
        const { data: newWallet } = await serviceClient
          .from('qa_wallets')
          .insert({
            user_id: bestAnswer.responder_id,
            balance_available: pool.held_for_best,
          })
          .select()
          .single();

        wallet = newWallet;
      } else {
        // 既存ウォレットを更新
        await serviceClient
          .from('qa_wallets')
          .update({
            balance_available: wallet.balance_available + pool.held_for_best,
            updated_at: new Date().toISOString(),
          })
          .eq('id', wallet.id);
      }

      // ウォレット取引履歴記録
      await serviceClient
        .from('qa_wallet_transactions')
        .insert({
          wallet_id: wallet.id,
          type: 'CREDIT',
          amount: pool.held_for_best,
          balance_before: wallet.balance_available,
          balance_after: wallet.balance_available + pool.held_for_best,
          reference_type: 'PPV_BEST_SETTLEMENT',
          reference_id: questionId,
          description: `PPVベスト回答者分配（24%）`,
        });

      // トランザクション記録
      await serviceClient
        .from('qa_transactions')
        .insert({
          user_id: bestAnswer.responder_id,
          question_id: questionId,
          type: 'PPV',
          status: 'COMPLETED',
          amount: pool.held_for_best,
          metadata: {
            settlement_type: 'best_answer',
            pool_id: pool.id,
          },
        });

      // プールを更新
      await serviceClient
        .from('qa_ppv_pools')
        .update({
          held_for_best: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pool.id);

      return NextResponse.json({
        success: true,
        distributed: pool.held_for_best,
        recipient: bestAnswer.responder_id,
        type: 'best_answer',
      });
    }

    if (action === 'distribute_others') {
      // その他16%均等割分配
      if (pool.total_amount <= 0) {
        return NextResponse.json({
          message: 'No amount in others pool',
          distributed: 0,
        });
      }

      // プールメンバー取得（ブロック除外）
      const { data: members } = await serviceClient
        .from('qa_ppv_pool_members')
        .select('*')
        .eq('pool_id', pool.id)
        .eq('is_excluded', false);

      if (!members || members.length === 0) {
        // メンバーがいない場合、自動で回答者を登録
        const { data: answers } = await serviceClient
          .from('qa_answers')
          .select('id, responder_id')
          .eq('question_id', questionId)
          .neq('id', question.best_answer_id);

        if (answers && answers.length > 0) {
          for (const answer of answers) {
            // ブロック確認
            const { data: block } = await serviceClient
              .from('qa_answer_blocks')
              .select('id')
              .eq('question_id', questionId)
              .eq('responder_id', answer.responder_id)
              .single();

            if (!block) {
              await serviceClient
                .from('qa_ppv_pool_members')
                .insert({
                  pool_id: pool.id,
                  answer_id: answer.id,
                  responder_id: answer.responder_id,
                  is_excluded: false,
                });
            }
          }

          // メンバーを再取得
          const { data: updatedMembers } = await serviceClient
            .from('qa_ppv_pool_members')
            .select('*')
            .eq('pool_id', pool.id)
            .eq('is_excluded', false);

          members = updatedMembers;
        }
      }

      if (!members || members.length === 0) {
        // それでもメンバーがいない場合、ベスト回答者に繰り上げ
        if (question.best_answer_id) {
          const { data: bestAnswer } = await serviceClient
            .from('qa_answers')
            .select('responder_id')
            .eq('id', question.best_answer_id)
            .single();

          if (bestAnswer) {
            // ベスト回答者に全額繰り上げ
            await serviceClient.rpc('update_wallet_balance', {
              p_wallet_id: bestAnswer.responder_id,
              p_amount: pool.total_amount,
              p_type: 'CREDIT',
              p_reference_type: 'PPV_OTHERS_TO_BEST',
              p_reference_id: questionId,
              p_description: 'PPVその他分繰り上げ',
            });

            // プールをクリア
            await serviceClient
              .from('qa_ppv_pools')
              .update({
                total_amount: 0,
                updated_at: new Date().toISOString(),
              })
              .eq('id', pool.id);

            return NextResponse.json({
              success: true,
              distributed: pool.total_amount,
              recipients: 1,
              type: 'promoted_to_best',
            });
          }
        }

        return NextResponse.json({
          message: 'No eligible recipients found',
          distributed: 0,
        });
      }

      // 均等割計算
      const perMemberAmount = Math.floor(pool.total_amount / members.length);
      const distributedTotal = perMemberAmount * members.length;
      const remainder = pool.total_amount - distributedTotal;

      // 各メンバーに分配
      for (const member of members) {
        // ウォレット更新
        const { data: wallet } = await serviceClient
          .from('qa_wallets')
          .select('id, balance_available')
          .eq('user_id', member.responder_id)
          .single();

        if (!wallet) {
          // ウォレット作成
          await serviceClient
            .from('qa_wallets')
            .insert({
              user_id: member.responder_id,
              balance_available: perMemberAmount,
            });
        } else {
          // 既存ウォレット更新
          await serviceClient
            .from('qa_wallets')
            .update({
              balance_available: wallet.balance_available + perMemberAmount,
              updated_at: new Date().toISOString(),
            })
            .eq('id', wallet.id);
        }

        // トランザクション記録
        await serviceClient
          .from('qa_transactions')
          .insert({
            user_id: member.responder_id,
            question_id: questionId,
            answer_id: member.answer_id,
            type: 'PPV',
            status: 'COMPLETED',
            amount: perMemberAmount,
            metadata: {
              settlement_type: 'others_pool',
              pool_id: pool.id,
              total_members: members.length,
            },
          });
      }

      // プールを更新（端数を残す）
      await serviceClient
        .from('qa_ppv_pools')
        .update({
          total_amount: remainder,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pool.id);

      return NextResponse.json({
        success: true,
        distributed: distributedTotal,
        perMember: perMemberAmount,
        recipients: members.length,
        remainder: remainder,
        type: 'others_pool',
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Settlement error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PPVプール状態取得
 * GET /api/qa/settlements?questionId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const questionId = searchParams.get('questionId');

    if (!questionId) {
      return NextResponse.json(
        { error: 'Question ID required' },
        { status: 400 }
      );
    }

    const serviceClient = createServiceRoleClient();

    // PPVプール情報
    const { data: pool } = await serviceClient
      .from('qa_ppv_pools')
      .select('*')
      .eq('question_id', questionId)
      .single();

    if (!pool) {
      return NextResponse.json({
        pool: null,
        members: [],
        blocks: [],
      });
    }

    // プールメンバー
    const { data: members } = await serviceClient
      .from('qa_ppv_pool_members')
      .select(`
        *,
        answer:qa_answers(
          id,
          body,
          created_at,
          responder_id
        )
      `)
      .eq('pool_id', pool.id);

    // ブロックリスト
    const { data: blocks } = await serviceClient
      .from('qa_answer_blocks')
      .select('*')
      .eq('question_id', questionId);

    return NextResponse.json({
      pool,
      members: members || [],
      blocks: blocks || [],
      summary: {
        heldForBest: pool.held_for_best,
        othersPool: pool.total_amount,
        totalMembers: members?.filter(m => !m.is_excluded).length || 0,
        blockedMembers: members?.filter(m => m.is_excluded).length || 0,
      },
    });
  } catch (error) {
    console.error('Get settlement error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}