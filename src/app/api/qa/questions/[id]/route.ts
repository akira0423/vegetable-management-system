import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/qa/supabase-client';

interface Params {
  params: Promise<{ id: string }>;
}

// GET: 質問詳細取得
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    console.log('Fetching question with ID:', id);

    // 開発環境ではサービスロールクライアントを使用（RLSをバイパス）
    const isProduction = process.env.NODE_ENV === 'production';
    const supabase = isProduction
      ? await createServerSupabaseClient()
      : createServiceRoleClient();

    // 認証ユーザー取得（本番環境のみ）
    let userId: string | null = null;
    if (isProduction) {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;
    } else {
      // 開発環境: テストモードをチェック（ヘッダーから取得）
      const testMode = request.headers.get('x-qa-test-mode');

      if (testMode === 'responder') {
        // 回答者モード: 別のテストユーザーを使用
        const { data: responderProfile } = await supabase
          .from('qa_user_profiles')
          .select('user_id')
          .eq('display_name', '開発テスト回答者')
          .limit(1)
          .single();

        if (!responderProfile) {
          // テスト回答者が存在しない場合は作成
          const testResponderId = 'test-responder-' + Date.now();
          const { data: newProfile } = await supabase
            .from('qa_user_profiles')
            .insert({
              user_id: testResponderId,
              display_name: '開発テスト回答者',
              tier: 'BRONZE',
              reputation_score: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single();
          userId = newProfile?.user_id || null;
        } else {
          userId = responderProfile.user_id;
        }
        console.log('Using test responder mode, userId:', userId);
      } else {
        // 通常モード: テストユーザーを使用
        const { data: testProfile } = await supabase
          .from('qa_user_profiles')
          .select('user_id')
          .eq('display_name', '開発テストユーザー')
          .limit(1)
          .single();
        userId = testProfile?.user_id || null;
      }
    }

    // 質問詳細取得（外部キー参照を明示的に指定、回答本文はqa_answer_contentsから取得）
    const { data: question, error } = await supabase
      .from('qa_questions')
      .select(`
        *,
        answers:qa_answers!qa_answers_question_id_fkey(
          id,
          body,
          body_preview,
          created_at,
          is_best,
          responder_id,
          answer_contents:qa_answer_contents(body)
        )
      `)
      .eq('id', id)
      .single();

    console.log('Query result:', { question, error });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Database error', details: error.message },
        { status: 500 }
      );
    }

    if (!question) {
      console.log('Question not found for ID:', id);
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }

    // 質問者の情報をaskerオブジェクトとして構築
    if (question.asker_id) {
      const { data: askerProfile } = await supabase
        .from('qa_user_profiles')
        .select('user_id, display_name, avatar_url, tier, reputation_score')
        .eq('user_id', question.asker_id)
        .single();

      question.asker = {
        id: question.asker_id,
        display_name: question.asker_display_name || askerProfile?.display_name || 'ユーザー',
        avatar_url: askerProfile?.avatar_url || null,
        tier: askerProfile?.tier || 'BRONZE',
        reputation_score: askerProfile?.reputation_score || 0,
      };

      // asker_display_nameも維持（互換性のため）
      if (!question.asker_display_name && askerProfile) {
        question.asker_display_name = askerProfile.display_name;
      }
    }

    // 回答者の情報を取得
    if (question.answers && question.answers.length > 0) {
      const responderIds = [...new Set(question.answers.map((a: any) => a.responder_id))];
      const { data: profiles } = await supabase
        .from('qa_user_profiles')
        .select('user_id, display_name, avatar_url, tier, reputation_score')
        .in('user_id', responderIds);

      if (profiles) {
        const profileMap = new Map(profiles.map(p => [p.user_id, p]));
        question.answers = question.answers.map((answer: any) => {
          const profile = profileMap.get(answer.responder_id);
          // answer_contentsから本文を取得（または古いデータはbodyから）
          const fullBody = answer.answer_contents?.body || answer.body || '';
          return {
            ...answer,
            body: fullBody, // 本文をフラット化
            body_preview: answer.body_preview || (fullBody ? fullBody.substring(0, 200) : ''),
            responder_display_name: profile?.display_name || 'ユーザー',
            responder: {
              id: answer.responder_id,
              display_name: profile?.display_name || 'ユーザー',
              avatar_url: profile?.avatar_url || null,
              tier: profile?.tier || 'BRONZE',
              reputation_score: profile?.reputation_score || 0,
            },
            answer_contents: undefined, // answer_contentsフィールドを削除
          };
        });
      }
    }

    // アクセス権限確認（質問者、回答者、PPV購入者のみ本文を返す）
    let hasFullAccess = false;

    console.log('Access check - userId:', userId, 'question.asker_id:', question.asker_id);

    if (userId) {
      // 質問者チェック
      if (question.asker_id === userId) {
        console.log('User is the question asker - granting full access');
        hasFullAccess = true;
      }

      // 回答者チェック
      const isResponder = question.answers?.some((a: any) => a.responder_id === userId);
      if (isResponder) {
        hasFullAccess = true;
      }

      // PPV購入者チェック
      const { data: accessGrant } = await supabase
        .from('qa_access_grants')
        .select('id')
        .eq('question_id', id)
        .eq('user_id', userId)
        .eq('access_type', 'PPV')
        .single();

      if (accessGrant) {
        hasFullAccess = true;
      }
    }

    // 本文を制限する場合
    if (!hasFullAccess && question.status !== 'DRAFT') {
      // 回答の本文も制限（body_previewのみ表示）
      if (question.answers) {
        question.answers = question.answers.map((answer: any) => {
          const preview = answer.body_preview || (answer.body ? answer.body.substring(0, 200) : '');
          return {
            ...answer,
            body: preview + (answer.body && answer.body.length > 200 ? '...' : ''), // プレビューのみ
            body_preview: preview,
            is_preview: true,
          };
        });
      }

      // プレビューのみ返す
      return NextResponse.json({
        ...question,
        body: question.body_preview || (question.body ? question.body.substring(0, 200) + '...' : ''),
        body_preview: question.body_preview || (question.body ? question.body.substring(0, 200) + '...' : ''),
        is_preview: true,
        current_user_id: userId, // 現在のユーザーIDを追加
        has_full_access: false,
      });
    }

    // フルアクセスの場合は回答の本文を保持（既に処理済み）

    return NextResponse.json({
      ...question,
      has_full_access: hasFullAccess,
      current_user_id: userId, // 現在のユーザーIDを追加
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH: 質問更新（下書き状態のみ）
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const isProduction = process.env.NODE_ENV === 'production';
    const supabase = isProduction
      ? await createServerSupabaseClient()
      : createServiceRoleClient();
    const updates = await request.json();

    // 認証確認
    let userId: string | null = null;
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
      userId = testProfile?.user_id || null;
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 質問の所有者確認
    const { data: question } = await supabase
      .from('qa_questions')
      .select('asker_id, status')
      .eq('id', id)
      .single();

    if (!question || question.asker_id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // DRAFT状態でのみ更新可能
    if (question.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Can only update draft questions' },
        { status: 400 }
      );
    }

    // 更新実行
    const { data: updated, error: updateError } = await supabase
      .from('qa_questions')
      .update({
        title: updates.title,
        body: updates.body,
        bounty_amount: updates.bounty_amount,
        deadline_at: updates.deadline_at,
        category: updates.category,
        tags: updates.tags,
        attachments: updates.attachments,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating question:', updateError);
      return NextResponse.json(
        { error: 'Failed to update question' },
        { status: 500 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: 質問削除（下書き状態のみ）
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const isProduction = process.env.NODE_ENV === 'production';
    const supabase = isProduction
      ? await createServerSupabaseClient()
      : createServiceRoleClient();

    // 認証確認
    let userId: string | null = null;
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
      userId = testProfile?.user_id || null;
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 質問の所有者とステータス確認
    const { data: question } = await supabase
      .from('qa_questions')
      .select('asker_id, status')
      .eq('id', id)
      .single();

    if (!question || question.asker_id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // DRAFT状態でのみ削除可能
    if (question.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Can only delete draft questions' },
        { status: 400 }
      );
    }

    // 削除実行
    const { error: deleteError } = await supabase
      .from('qa_questions')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting question:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete question' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}