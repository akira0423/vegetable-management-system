import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/qa/supabase-client';
import { createClient } from '@/lib/supabase/server';
import { createEscrowPaymentIntent } from '@/lib/qa/stripe-client';
import { CreateQuestionDto, Question } from '@/types/qa';
import { parseSearchQuery, validateSearchQuery } from '@/lib/qa/searchParser';

// GET: 質問一覧取得（拡張検索・フィルタリング対応）
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);

    // ページネーション
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // 検索クエリ
    const q = searchParams.get('q');

    // フィルターパラメータ
    const status = searchParams.get('status')?.split(',').filter(Boolean);
    const crop = searchParams.get('crop');
    const disease = searchParams.get('disease');
    const region = searchParams.get('region');
    const season = searchParams.get('season');
    const tags = searchParams.get('tags')?.split(',').filter(Boolean);
    const category = searchParams.get('category');
    const bountyMin = searchParams.get('bountyMin') ? parseInt(searchParams.get('bountyMin')!) : undefined;
    const bountyMax = searchParams.get('bountyMax') ? parseInt(searchParams.get('bountyMax')!) : undefined;
    const requiresPhoto = searchParams.get('requiresPhoto') === 'true';
    const requiresVideo = searchParams.get('requiresVideo') === 'true';
    const ppvMin = searchParams.get('ppvMin') ? parseInt(searchParams.get('ppvMin')!) : undefined;
    const sort = searchParams.get('sort') || 'newest';

    // 基本クエリ
    let query = supabase
      .from('qa_questions')
      .select('*', { count: 'exact' })
      .not('published_at', 'is', null);

    // 検索クエリ処理
    if (q) {
      const validationError = validateSearchQuery(q);
      if (validationError) {
        return NextResponse.json(
          { error: validationError },
          { status: 400 }
        );
      }

      const parsed = parseSearchQuery(q);

      // 全文検索（search_vectorカラムが存在する場合）
      const searchTerms = [...parsed.terms, ...parsed.phrases].filter(Boolean);
      if (searchTerms.length > 0) {
        // textSearchがサポートされていない場合はilikeフォールバック
        const searchQuery = searchTerms.join(' ');
        query = query.or(`title.ilike.%${searchQuery}%,body.ilike.%${searchQuery}%`);
      }

      // 除外条件
      parsed.excludes.forEach(exclude => {
        query = query.not('title', 'ilike', `%${exclude}%`)
                     .not('body', 'ilike', `%${exclude}%`);
      });

      // タグ条件
      if (parsed.tags.length > 0) {
        query = query.contains('tags', parsed.tags);
      }

      // クエリ内のフィルター
      if (parsed.filters.crop) {
        query = query.eq('crop', parsed.filters.crop);
      }
      if (parsed.filters.disease) {
        query = query.eq('disease', parsed.filters.disease);
      }
      if (parsed.filters.bountyMin !== undefined) {
        query = query.gte('bounty_amount', parsed.filters.bountyMin);
      }
      if (parsed.filters.bountyMax !== undefined) {
        query = query.lte('bounty_amount', parsed.filters.bountyMax);
      }
    }

    // ステータスフィルター
    if (status && status.length > 0) {
      query = query.in('status', status.map(s => s.toUpperCase()));
    }

    // その他フィルター
    if (crop) query = query.eq('crop', crop);
    if (disease) query = query.eq('disease', disease);
    if (region) query = query.eq('region', region);
    if (season) query = query.eq('season', season);
    if (category) query = query.eq('category', category);
    if (tags && tags.length > 0) {
      query = query.contains('tags', tags);
    }

    // 報酬額フィルター
    if (bountyMin !== undefined) query = query.gte('bounty_amount', bountyMin);
    if (bountyMax !== undefined) query = query.lte('bounty_amount', bountyMax);

    // 品質要件フィルター
    if (requiresPhoto) query = query.eq('require_photo', true);
    if (requiresVideo) query = query.eq('require_video', true);

    // PPV実績フィルター
    if (ppvMin !== undefined) query = query.gte('ppv_sales_count', ppvMin);

    // ソート処理
    switch (sort) {
      case 'oldest':
        query = query.order('published_at', { ascending: true });
        break;
      case 'bounty_high':
        query = query.order('bounty_amount', { ascending: false })
                     .order('published_at', { ascending: false });
        break;
      case 'bounty_low':
        query = query.order('bounty_amount', { ascending: true })
                     .order('published_at', { ascending: false });
        break;
      case 'deadline_soon':
        query = query.order('deadline_at', { ascending: true })
                     .order('published_at', { ascending: false });
        break;
      case 'popular':
        query = query.order('ppv_sales_count', { ascending: false })
                     .order('answer_count', { ascending: false })
                     .order('published_at', { ascending: false });
        break;
      case 'most_answers':
        query = query.order('answer_count', { ascending: false })
                     .order('published_at', { ascending: false });
        break;
      case 'no_answers':
        query = query.eq('answer_count', 0)
                     .order('published_at', { ascending: false });
        break;
      case 'newest':
      default:
        query = query.order('published_at', { ascending: false });
        break;
    }

    // ページネーション適用
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching questions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch questions' },
        { status: 500 }
      );
    }

    // 回答数を追加で取得（answer_countカラムがない場合）
    const questions = data || [];
    const questionIds = questions.map(q => q.id);

    if (questionIds.length > 0 && questions.some(q => q.answer_count === undefined)) {
      const { data: answerCounts } = await supabase
        .from('qa_answers')
        .select('question_id')
        .in('question_id', questionIds);

      const countMap = answerCounts?.reduce((acc, answer) => {
        acc[answer.question_id] = (acc[answer.question_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      questions.forEach(q => {
        if (q.answer_count === undefined) {
          q.answer_count = countMap[q.id] || 0;
        }
      });
    }

    return NextResponse.json({
      questions,
      totalCount: count || 0,
      currentPage: page,
      totalPages: Math.ceil((count || 0) / limit)
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: 新規質問作成
export async function POST(request: NextRequest) {
  try {
    const body: CreateQuestionDto = await request.json();

    // 既存システムの認証を使用（ダッシュボードと同じ）
    const authSupabase = await createClient();
    const { data: { user }, error: authError } = await authSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required. Please login to post a question.' },
        { status: 401 }
      );
    }

    // Q&A用のSupabaseクライアントを使用（データ操作用）
    const supabase = await createServerSupabaseClient();

    let userId: string = user.id;
    let userDisplayName: string;

    // プロフィールから表示名を取得（まずQ&Aプロフィールを確認）
    const { data: qaProfile } = await supabase
      .from('qa_user_profiles')
      .select('display_name')
      .eq('user_id', userId)
      .single();

    if (!qaProfile) {
      // Q&Aプロフィールが存在しない場合は作成
      const { data: mainProfile } = await authSupabase
        .from('users')
        .select('full_name')
        .eq('id', userId)
        .single();

      userDisplayName = mainProfile?.full_name || 'ユーザー';

      // Q&Aプロフィールを作成
      await supabase
        .from('qa_user_profiles')
        .insert({
          user_id: userId,
          display_name: userDisplayName,
          bio: '',
          expertise_areas: [],
          is_active: true
        });
    } else {
      userDisplayName = qaProfile.display_name || 'ユーザー';
    }

    // 入力検証（deadline_atは必須ではない）
    if (!body.title || !body.body || !body.bounty_amount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 最低懸賞金額チェック（10円以上）
    if (body.bounty_amount < 10) {
      return NextResponse.json(
        { error: 'Bounty amount must be at least 10 yen' },
        { status: 400 }
      );
    }

    // Stripeユーザー情報取得（エラーは無視）
    const { data: profile } = await supabase
      .from('qa_user_profiles')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();

    // 質問を作成（回答品質要件を含む）
    const { data: question, error: questionError } = await supabase
      .from('qa_questions')
      .insert({
        asker_id: userId,
        asker_display_name: userDisplayName,
        title: body.title,
        body: body.body,
        body_preview: body.preview || body.body.substring(0, 200),
        bounty_amount: body.bounty_amount,
        deadline_at: body.deadline_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        category: body.category || 'GENERAL',
        tags: body.tags || [],
        attachments: body.attachments || [],
        // 回答品質要件
        min_answer_chars: body.requirements?.min_answer_chars || 0,
        require_photo: body.requirements?.require_photo || false,
        require_photo_min: body.requirements?.require_photo_min || 1,
        require_video: body.requirements?.require_video || false,
        require_video_min: body.requirements?.require_video_min || 1,
        status: process.env.NODE_ENV === 'production' ? 'PENDING_PAYMENT' : 'FUNDED', // 開発環境では直接FUNDED
        published_at: process.env.NODE_ENV === 'production' ? null : new Date().toISOString(), // FUNDEDステータスの場合はpublished_atが必要
      })
      .select()
      .single();

    if (questionError) {
      console.error('Error creating question:', questionError);
      return NextResponse.json(
        { error: 'Failed to create question', details: questionError.message },
        { status: 500 }
      );
    }

    // Stripe PaymentIntent作成（本番環境のみ）
    if (process.env.QA_STRIPE_SECRET_KEY &&
        process.env.QA_STRIPE_SECRET_KEY !== 'sk_test_xxx' &&
        process.env.NODE_ENV === 'production') {
      try {
        const paymentIntent = await createEscrowPaymentIntent(
          body.bounty_amount,
          question.id,
          profile?.stripe_customer_id
        );

        // PaymentIntent IDを質問に紐付け
        await supabase
          .from('qa_questions')
          .update({
            stripe_payment_intent_id: paymentIntent.id,
            status: 'PENDING_PAYMENT'
          })
          .eq('id', question.id);

        return NextResponse.json({
          id: question.id,
          question,
          payment: {
            client_secret: paymentIntent.client_secret,
            payment_intent_id: paymentIntent.id,
          }
        });
      } catch (stripeError) {
        console.error('Stripe error (ignored in dev):', stripeError);
        // 開発環境ではStripeエラーを無視
      }
    }

    return NextResponse.json({
      id: question.id,
      ...question
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}