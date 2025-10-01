import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/qa/supabase-client';
import { createPaymentIntent } from '@/lib/qa/stripe-client';

// POST /api/qa/payments/ppv - PPV決済処理
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const serviceClient = createServiceRoleClient();
    
    // 認証確認
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { accessLogId, amount } = await request.json();

    // アクセスログ取得
    const { data: accessLog, error: logError } = await supabase
      .from('qa_access_logs')
      .select(`
        *,
        question:qa_questions!qa_access_logs_question_id_fkey(
          id,
          title,
          asker_id,
          status
        )
      `)
      .eq('id', accessLogId)
      .eq('user_id', user.id)
      .single();

    if (logError || !accessLog) {
      return NextResponse.json({ error: 'Access log not found' }, { status: 404 });
    }

    // すでに支払い済みかチェック
    if (accessLog.payment_status === 'PAID') {
      return NextResponse.json({ error: 'Already paid' }, { status: 400 });
    }

    // PPVプール作成または更新
    const { data: pool, error: poolError } = await serviceClient
      .from('qa_ppv_pools')
      .upsert({
        question_id: accessLog.question_id,
        total_amount: amount,
        platform_amount: amount * 0.2,
        asker_amount: amount * 0.4,
        best_answer_amount: amount * 0.24,
        other_answers_amount: amount * 0.16,
        status: 'PENDING'
      }, {
        onConflict: 'question_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (poolError) {
      console.error('Pool error:', poolError);
      return NextResponse.json({ error: 'Failed to create PPV pool' }, { status: 500 });
    }

    // PPVメンバー追加（購入者）
    await serviceClient
      .from('qa_ppv_members')
      .upsert({
        pool_id: pool.id,
        user_id: user.id,
        payment_amount: amount,
        payment_status: 'PENDING'
      });

    // トランザクション記録（運営手数料20%）
    await serviceClient
      .from('qa_transactions')
      .insert({
        type: 'PPV_PLATFORM_FEE',
        amount: amount * 0.2,
        user_id: user.id,
        related_question_id: accessLog.question_id,
        status: 'COMPLETED',
        metadata: {
          pool_id: pool.id,
          access_log_id: accessLogId
        }
      });

    // 質問者への即時分配（40%）
    await serviceClient
      .from('qa_transactions')
      .insert({
        type: 'PPV_ASKER_SHARE',
        amount: amount * 0.4,
        user_id: accessLog.question.asker_id,
        related_question_id: accessLog.question_id,
        status: 'COMPLETED',
        metadata: {
          pool_id: pool.id,
          purchaser_id: user.id
        }
      });

    // ウォレット残高更新（質問者）
    await serviceClient.rpc('update_wallet_balance', {
      p_user_id: accessLog.question.asker_id,
      p_amount_change: amount * 0.4,
      p_transaction_type: 'PPV_ASKER_SHARE'
    });

    // アクセスログ更新
    await supabase
      .from('qa_access_logs')
      .update({
        payment_status: 'PAID',
        payment_amount: amount,
        paid_at: new Date().toISOString()
      })
      .eq('id', accessLogId);

    return NextResponse.json({
      success: true,
      message: 'PPV payment completed',
      breakdown: {
        total: amount,
        platform_fee: amount * 0.2,
        asker_immediate: amount * 0.4,
        pending_distribution: amount * 0.4
      }
    });
  } catch (error) {
    console.error('PPV payment error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}