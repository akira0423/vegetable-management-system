import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/qa/supabase-client';
import { headers } from 'next/headers';

/**
 * 日次PPVプール清算処理
 * 毎日午前2時に実行（JST）
 * GET /api/qa/cron/daily-settlement
 */
export async function GET(request: NextRequest) {
  try {
    // Vercel Cronジョブからのリクエストを検証
    const authHeader = headers().get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const serviceClient = createServiceRoleClient();
    const results = {
      processedPools: 0,
      distributedBest: 0,
      distributedOthers: 0,
      errors: [] as string[],
    };

    // 30日以上経過した質問のPPVプールを取得
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: eligiblePools, error: poolsError } = await serviceClient
      .from('qa_ppv_pools')
      .select(`
        *,
        question:qa_questions(
          id,
          best_answer_id,
          created_at,
          status
        )
      `)
      .or('held_for_best.gt.0,total_amount.gt.0')
      .lt('question.created_at', thirtyDaysAgo.toISOString());

    if (poolsError) {
      console.error('Failed to fetch eligible pools:', poolsError);
      return NextResponse.json(
        { error: 'Failed to fetch pools', details: poolsError },
        { status: 500 }
      );
    }

    if (!eligiblePools || eligiblePools.length === 0) {
      return NextResponse.json({
        message: 'No pools to process',
        results,
      });
    }

    // 各プールを処理
    for (const pool of eligiblePools) {
      try {
        results.processedPools++;

        // ベスト分配（held_for_best）
        if (pool.held_for_best > 0 && pool.question?.best_answer_id) {
          const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/qa/settlements`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              questionId: pool.question_id,
              action: 'distribute_best',
            }),
          });

          if (response.ok) {
            const result = await response.json();
            results.distributedBest += result.distributed || 0;
          } else {
            const error = await response.json();
            results.errors.push(
              `Failed to distribute best for ${pool.question_id}: ${error.error}`
            );
          }
        }

        // その他分配（total_amount）
        if (pool.total_amount > 0) {
          const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/qa/settlements`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              questionId: pool.question_id,
              action: 'distribute_others',
            }),
          });

          if (response.ok) {
            const result = await response.json();
            results.distributedOthers += result.distributed || 0;
          } else {
            const error = await response.json();
            results.errors.push(
              `Failed to distribute others for ${pool.question_id}: ${error.error}`
            );
          }
        }
      } catch (error) {
        console.error(`Error processing pool ${pool.id}:`, error);
        results.errors.push(
          `Error processing pool ${pool.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    // 処理結果をログに記録
    await serviceClient
      .from('qa_cron_logs')
      .insert({
        job_name: 'daily_ppv_settlement',
        status: results.errors.length === 0 ? 'SUCCESS' : 'PARTIAL',
        processed_count: results.processedPools,
        metadata: {
          distributedBest: results.distributedBest,
          distributedOthers: results.distributedOthers,
          errors: results.errors,
        },
      });

    return NextResponse.json({
      success: true,
      message: `Processed ${results.processedPools} pools`,
      results,
    });
  } catch (error) {
    console.error('Daily settlement cron error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * ヘルスチェック
 * POST /api/qa/cron/daily-settlement
 */
export async function POST(request: NextRequest) {
  // 手動実行（管理者のみ）
  try {
    const body = await request.json();
    const { adminKey } = body;

    if (adminKey !== process.env.QA_API_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // GETハンドラーを呼び出し
    const mockRequest = new NextRequest(request.url, {
      headers: {
        authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
    });

    return GET(mockRequest);
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}