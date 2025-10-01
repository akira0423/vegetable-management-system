import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/qa/supabase-client';

interface Params {
  params: Promise<{ id: string }>;
}

// GET: 公開プロフィール取得
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = createServiceRoleClient();

    // 公開プロフィール情報を取得
    const { data: profile, error: profileError } = await supabase
      .from('v_public_profiles')
      .select('*')
      .eq('user_id', id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // 統計情報を取得
    const { data: stats } = await supabase
      .from('v_public_profile_stats')
      .select('*')
      .eq('user_id', id)
      .single();

    // 最近の回答を取得
    const { data: recentAnswers } = await supabase
      .from('qa_answers')
      .select(`
        id,
        question_id,
        is_best,
        created_at,
        question:qa_questions(title)
      `)
      .eq('responder_id', id)
      .order('created_at', { ascending: false })
      .limit(10);

    // 最近の質問を取得
    const { data: recentQuestions } = await supabase
      .from('qa_questions')
      .select('id, title, status, bounty_amount, answer_count, created_at')
      .eq('asker_id', id)
      .order('created_at', { ascending: false })
      .limit(10);

    // レスポンスを整形
    const response = {
      ...profile,
      stats: stats ? {
        total_questions: stats.total_questions || 0,
        total_earned: stats.total_earned || 0,
        last_answer_at: stats.last_answer_at,
        last_question_at: stats.last_question_at,
      } : null,
      recent_answers: recentAnswers?.map(answer => ({
        id: answer.id,
        question_id: answer.question_id,
        question_title: answer.question?.title || '質問',
        is_best: answer.is_best,
        created_at: answer.created_at,
      })) || [],
      recent_questions: recentQuestions || [],
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}