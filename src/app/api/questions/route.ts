import { NextRequest, NextResponse } from 'next/server'

// デモデータを返す関数
function getDemoQuestions(limit: number, offset: number, statusFilter: string[]) {
  const allQuestions = [
    {
      id: '1',
      title: 'トマトのうどんこ病、有機栽培での緊急対策を教えてください',
      body: '有機JAS認証を取得している農園です。トマト200株のうち30株にうどんこ病が発生しました。',
      bounty_amount: 500,
      status: 'ANSWERING',
      answer_count: 3,
      created_at: new Date(Date.now() - 86400000).toISOString(),
      deadline_at: new Date(Date.now() + 86400000).toISOString(),
      category: '病害虫対策',
      tags: ['トマト', 'うどんこ病', '有機栽培'],
      asker: {
        display_name: '田中農園',
        avatar_url: null
      }
    },
    {
      id: '2',
      title: 'ナスの連作障害を改善する効果的な方法',
      body: '同じ畑で3年連続ナスを栽培していますが、収量が年々低下しています。',
      bounty_amount: 1000,
      status: 'RESOLVED',
      answer_count: 5,
      created_at: new Date(Date.now() - 172800000).toISOString(),
      deadline_at: null,
      category: '土壌管理',
      tags: ['ナス', '連作障害', '土壌改良'],
      asker: {
        display_name: '山田ファーム',
        avatar_url: null
      }
    },
    {
      id: '3',
      title: 'キャベツの害虫対策（オーガニック）でおすすめの方法',
      body: '化学農薬を使わずにキャベツの害虫を防除したいです。',
      bounty_amount: 300,
      status: 'ANSWERING',
      answer_count: 2,
      created_at: new Date(Date.now() - 259200000).toISOString(),
      deadline_at: new Date(Date.now() + 172800000).toISOString(),
      category: '病害虫対策',
      tags: ['キャベツ', '害虫', 'オーガニック'],
      asker: {
        display_name: '鈴木農場',
        avatar_url: null
      }
    },
    {
      id: '4',
      title: '水稲の収量を上げるための施肥管理について',
      body: '水稲の収量向上を目指しています。効果的な施肥管理方法を教えてください。',
      bounty_amount: 800,
      status: 'BEST_SELECTED',
      answer_count: 4,
      created_at: new Date(Date.now() - 345600000).toISOString(),
      deadline_at: null,
      category: '施肥管理',
      tags: ['水稲', '施肥', '収量向上'],
      asker: {
        display_name: '佐藤農園',
        avatar_url: null
      }
    },
    {
      id: '5',
      title: 'イチゴのハウス栽培での温度管理のコツ',
      body: 'ハウス栽培でイチゴを育てています。最適な温度管理方法を知りたいです。',
      bounty_amount: 600,
      status: 'ANSWERING',
      answer_count: 1,
      created_at: new Date(Date.now() - 432000000).toISOString(),
      deadline_at: new Date(Date.now() + 259200000).toISOString(),
      category: '栽培技術',
      tags: ['イチゴ', 'ハウス栽培', '温度管理'],
      asker: {
        display_name: '高橋農園',
        avatar_url: null
      }
    },
    {
      id: '6',
      title: '有機JAS認証取得の手順と必要書類について',
      body: '有機JAS認証の取得を検討しています。必要な手順と書類を教えてください。',
      bounty_amount: 1500,
      status: 'RESOLVED',
      answer_count: 7,
      created_at: new Date(Date.now() - 518400000).toISOString(),
      deadline_at: null,
      category: '認証・規格',
      tags: ['有機JAS', '認証', '書類'],
      asker: {
        display_name: '伊藤オーガニック',
        avatar_url: null
      }
    }
  ]

  // ステータスでフィルター
  const filtered = allQuestions.filter(q => statusFilter.includes(q.status))

  // ページネーション
  const paged = filtered.slice(offset, offset + limit)

  return {
    questions: paged,
    total: filtered.length
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const status = searchParams.get('status')?.split(',') || ['ANSWERING', 'BEST_SELECTED', 'RESOLVED']
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Supabase設定をチェック
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    // Supabaseが設定されていない場合はデモデータを返す
    if (!supabaseUrl || !supabaseServiceKey) {
      console.log('Supabase not configured, returning demo data')
      const demoData = getDemoQuestions(limit, offset, status)
      return NextResponse.json({
        questions: demoData.questions,
        total: demoData.total,
        limit,
        offset
      })
    }

    // Supabaseクライアントを動的インポート
    try {
      const { createServiceRoleClient } = await import('@/lib/qa/supabase-client')
      const supabase = createServiceRoleClient()

      // 質問を取得（公開情報のみ）
      let query = supabase
        .from('qa_questions')
        .select(`
          id,
          title,
          body,
          bounty_amount,
          status,
          category,
          tags,
          created_at,
          deadline_at,
          answer_count,
          asker_id,
          asker_display_name
        `)
        .in('status', status)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      const { data: questions, error } = await query

      if (error) {
        console.error('Database error:', error)
        // データベースエラーの場合もデモデータを返す
        const demoData = getDemoQuestions(limit, offset, status)
        return NextResponse.json({
          questions: demoData.questions,
          total: demoData.total,
          limit,
          offset
        })
      }

      // データを整形
      const formattedQuestions = questions?.map(q => ({
        id: q.id,
        title: q.title,
        body: q.body, // 質問本文は全公開
        bounty_amount: q.bounty_amount,
        status: q.status,
        answer_count: q.answer_count || 0,
        created_at: q.created_at,
        deadline_at: q.deadline_at,
        category: q.category,
        tags: q.tags || [],
        asker: {
          display_name: q.asker_display_name || '匿名ユーザー',
          avatar_url: null
        }
      })) || []

      // 総件数を取得
      const { count } = await supabase
        .from('qa_questions')
        .select('*', { count: 'exact', head: true })
        .in('status', status)

      return NextResponse.json({
        questions: formattedQuestions,
        total: count || 0,
        limit,
        offset
      })
    } catch (supabaseError) {
      console.error('Supabase error:', supabaseError)
      // Supabaseエラーの場合もデモデータを返す
      const demoData = getDemoQuestions(limit, offset, status)
      return NextResponse.json({
        questions: demoData.questions,
        total: demoData.total,
        limit,
        offset
      })
    }
  } catch (error) {
    console.error('Error in questions API:', error)
    // エラーが発生した場合もデモデータを返す
    const demoData = getDemoQuestions(limit, offset, ['ANSWERING', 'BEST_SELECTED', 'RESOLVED'])
    return NextResponse.json({
      questions: demoData.questions,
      total: demoData.total,
      limit: limit,
      offset: offset
    })
  }
}