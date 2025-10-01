import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/qa/supabase-client';
import { CreateAnswerDto } from '@/types/qa';

// GET: 回答一覧取得
export async function GET(request: NextRequest) {
  try {
    // 開発環境ではサービスロールクライアントを使用
    const isProduction = process.env.NODE_ENV === 'production';
    const supabase = isProduction
      ? await createServerSupabaseClient()
      : createServiceRoleClient();
    const { searchParams } = new URL(request.url);

    // パラメータ名の互換性を保つ（questionId と question_id の両方をサポート）
    const questionId = searchParams.get('questionId') || searchParams.get('question_id');
    const responderId = searchParams.get('responderId') || searchParams.get('responder_id');

    if (!questionId && !responderId) {
      return NextResponse.json(
        { error: 'Either questionId or responderId is required' },
        { status: 400 }
      );
    }

    // クエリ構築（qa_answer_contentsテーブルから本文を取得）
    let query = supabase
      .from('qa_answers')
      .select(`
        *,
        body_preview,
        answer_contents:qa_answer_contents(body)
      `)
      .order('created_at', { ascending: false });

    if (questionId) {
      query = query.eq('question_id', questionId);
    }
    if (responderId) {
      query = query.eq('responder_id', responderId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching answers:', error);
      return NextResponse.json(
        { error: 'Failed to fetch answers' },
        { status: 500 }
      );
    }

    // アクセス権限に応じて本文を制限
    let userId: string | null = null;
    if (isProduction) {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;
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

    // 回答者の表示名を取得
    const responderIds = [...new Set(data.map(a => a.responder_id))];
    const { data: profiles } = await supabase
      .from('qa_user_profiles')
      .select('user_id, display_name, avatar_url, tier, reputation_score')
      .in('user_id', responderIds);

    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

    const processedAnswers = await Promise.all(data.map(async (answer) => {
      let hasAccess = false;

      if (userId) {
        // 回答者本人
        if (answer.responder_id === userId) {
          hasAccess = true;
        }

        // 質問者
        const { data: question } = await supabase
          .from('qa_questions')
          .select('asker_id')
          .eq('id', answer.question_id)
          .single();

        if (question?.asker_id === userId) {
          hasAccess = true;
        }

        // PPV購入者
        const { data: accessGrant } = await supabase
          .from('qa_access_grants')
          .select('id')
          .eq('question_id', answer.question_id)
          .eq('user_id', userId)
          .eq('access_type', 'PPV')
          .single();

        if (accessGrant) {
          hasAccess = true;
        }
      }

      // プロフィール情報を追加
      const profile = profileMap.get(answer.responder_id);

      // 本文を取得（answer_contentsから、または古いデータはbodyフィールドから）
      const fullBody = answer.answer_contents?.body || answer.body || '';
      const bodyPreview = answer.body_preview || (fullBody ? fullBody.substring(0, 200) : '');

      const processedAnswer = {
        ...answer,
        body_preview: bodyPreview,
        responder_display_name: profile?.display_name || 'ユーザー',
        responder: {
          id: answer.responder_id,
          display_name: profile?.display_name || 'ユーザー',
          avatar_url: profile?.avatar_url || null,
          tier: profile?.tier || 'BRONZE',
          reputation_score: profile?.reputation_score || 0,
        },
        // answer_contentsフィールドを削除（フラットにする）
        answer_contents: undefined,
      };

      if (!hasAccess) {
        // プレビューのみ返す
        return {
          ...processedAnswer,
          body: bodyPreview + (fullBody.length > 200 ? '...' : ''),
          is_preview: true,
        };
      }

      // フルアクセス権がある場合は完全な本文を返す
      return {
        ...processedAnswer,
        body: fullBody,
        is_preview: false,
      };
    }));

    return NextResponse.json(processedAnswers);
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: 新規回答作成
export async function POST(request: NextRequest) {
  try {
    // 開発環境ではサービスロールクライアントを使用
    const isProduction = process.env.NODE_ENV === 'production';
    const supabase = isProduction
      ? await createServerSupabaseClient()
      : createServiceRoleClient();

    const body: CreateAnswerDto = await request.json();

    // リクエストボディから question_id を取得
    const questionId = body.question_id;

    if (!questionId) {
      return NextResponse.json(
        { error: 'question_id is required' },
        { status: 400 }
      );
    }

    // 認証確認（開発環境では、テストユーザーを使用）
    let userId: string;
    let userDisplayName: string;

    if (isProduction) {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
      userId = user.id;

      // プロフィールから表示名を取得
      const { data: profile } = await supabase
        .from('qa_user_profiles')
        .select('display_name')
        .eq('user_id', userId)
        .single();
      userDisplayName = profile?.display_name || 'ユーザー';
    } else {
      // 開発環境: 回答者用のテストユーザーを取得または作成
      // 質問者とは別のユーザーを使用する
      const { data: testProfiles } = await supabase
        .from('qa_user_profiles')
        .select('user_id, display_name')
        .in('display_name', ['開発テスト回答者', '開発テストユーザー2'])
        .limit(1);

      let testProfile = testProfiles?.[0];

      // テスト回答者が存在しない場合は作成
      if (!testProfile) {
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

        testProfile = newProfile;
      }

      if (!testProfile) {
        return NextResponse.json(
          { error: 'Test responder not found' },
          { status: 500 }
        );
      }
      userId = testProfile.user_id;
      userDisplayName = testProfile.display_name;
      console.log('Using test responder:', userId, userDisplayName);
    }

    // 入力検証
    if (!body.body) {
      return NextResponse.json(
        { error: 'Answer body is required' },
        { status: 400 }
      );
    }

    // 質問の存在とステータス確認
    const { data: question, error: questionError } = await supabase
      .from('qa_questions')
      .select('status, asker_id, deadline_at')
      .eq('id', questionId)
      .single();

    if (questionError || !question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }

    // 回答受付中かチェック
    console.log('Question status:', question.status);
    if (question.status !== 'ANSWERING' && question.status !== 'FUNDED') {
      return NextResponse.json(
        { error: `Question is not accepting answers. Current status: ${question.status}` },
        { status: 400 }
      );
    }

    // 締切チェック
    if (question.deadline_at && new Date(question.deadline_at) < new Date()) {
      console.log('Deadline check:', question.deadline_at, 'Current time:', new Date().toISOString());
      return NextResponse.json(
        { error: 'Question deadline has passed' },
        { status: 400 }
      );
    }

    // 質問者自身の回答を防ぐ（開発環境では自動で別ユーザーなのでスキップされるはず）
    console.log('Asker check - Question asker_id:', question.asker_id, 'Current userId:', userId);
    if (question.asker_id === userId) {
      console.log('Error: User attempting to answer their own question');
      return NextResponse.json(
        { error: 'Cannot answer your own question' },
        { status: 400 }
      );
    }

    // 重複回答チェック
    const { data: existingAnswer } = await supabase
      .from('qa_answers')
      .select('id')
      .eq('question_id', questionId)
      .eq('responder_id', userId)
      .single();

    if (existingAnswer) {
      return NextResponse.json(
        { error: 'You have already answered this question' },
        { status: 400 }
      );
    }

    // 回答作成（body_previewのみ保存）
    const bodyText = body.body;
    const bodyPreview = bodyText.length > 200 ? bodyText.substring(0, 200) + '...' : bodyText;

    const { data: answer, error: answerError } = await supabase
      .from('qa_answers')
      .insert({
        question_id: questionId,
        responder_id: userId,
        body: bodyText, // 互換性のため一時的に保持（後で削除予定）
        body_preview: bodyPreview,
        attachments: body.attachments || [],
      })
      .select()
      .single();

    if (answerError) {
      console.error('Error creating answer:', answerError);
      return NextResponse.json(
        { error: 'Failed to create answer' },
        { status: 500 }
      );
    }

    // qa_answer_contentsテーブルに本文を保存
    const { error: contentError } = await supabase
      .from('qa_answer_contents')
      .insert({
        answer_id: answer.id,
        body: bodyText,
      });

    if (contentError) {
      console.error('Error creating answer content:', contentError);
      // 回答作成自体は成功しているので、エラーは警告のみ
    }

    // 回答数を更新
    await supabase.rpc('increment_answer_count', {
      question_id: questionId
    });

    // 通知を作成（質問者へ）
    await supabase
      .from('qa_notifications')
      .insert({
        user_id: question.asker_id,
        type: 'NEW_ANSWER',
        title: '新しい回答が投稿されました',
        message: `あなたの質問に新しい回答が投稿されました`,
        metadata: {
          question_id: questionId,
          answer_id: answer.id,
          responder_id: userId,
        },
      });

    return NextResponse.json(answer);
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}