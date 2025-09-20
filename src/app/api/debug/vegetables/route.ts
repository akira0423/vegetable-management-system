'use server'

import { NextResponse } from 'next/server'

// ⚠️ デバッグエンドポイント - 本番環境では無効化
// GET /api/debug/vegetables - 野菜レコードのデバッグ情報取得
export async function GET() {
  // 本番環境ではデバッグエンドポイントを無効化
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Debug endpoints are disabled in production environment' },
      { status: 403 }
    )
  }
  
  // 開発環境でのみSupabaseをインポート
  const { supabase } = await import('@/lib/supabase')
  try {
    

    const debugInfo: any = {
      timestamp: new Date().toISOString(),
      results: {}
    }

    // 0. データベース接続確認
    
    try {
      const { data: connectionTest, error: connectionError } = await supabase
        .from('vegetables')
        .select('count')
        .limit(1)
      
      if (connectionError) {
        debugInfo.results.connection_error = connectionError
        
      } else {
        debugInfo.results.connection_status = 'SUCCESS'
        
      }
    } catch (connectionErr) {
      debugInfo.results.connection_error = connectionErr
      
    }

    // 1. 全ての野菜レコードを取得
    
    const { data: allVegetables, error: allError } = await supabase
      .from('vegetables')
      .select('id, name, variety_name, plot_name, created_at, company_id')
      .order('created_at', { ascending: false })

    if (allError) {
      
      debugInfo.results.all_vegetables_error = allError
    } else {
      
      debugInfo.results.total_count = allVegetables?.length || 0
      debugInfo.results.all_vegetables = allVegetables || []
    }

    // 2. 問題のIDを直接検索
    const problemId = 'eb03336c-1a80-4b32-85e0-7ce8a5605238'
    
    
    const { data: specificVeg, error: specificError } = await supabase
      .from('vegetables')
      .select('*')
      .eq('id', problemId)
      .maybeSingle()

    if (specificError) {
      
      debugInfo.results.specific_search_error = specificError
    } else if (specificVeg) {
      
      debugInfo.results.problem_record = specificVeg
    } else {
      
      debugInfo.results.problem_record = null
      debugInfo.results.problem_record_status = 'NOT_FOUND'
    }

    // 3. 会社IDでフィルタリングしたレコード確認
    
    const { data: companyVegs, error: companyError } = await supabase
      .from('vegetables')
      .select('id, name, variety_name, company_id, custom_fields')
      .eq('company_id', 'a1111111-1111-1111-1111-111111111111')

    if (companyError) {
      
      debugInfo.results.company_vegetables_error = companyError
    } else {
      
      debugInfo.results.company_vegetables_count = companyVegs?.length || 0
      debugInfo.results.company_vegetables = companyVegs || []
    }

    // 4. テーブル構造確認
    
    const { data: tableInfo, error: tableError } = await supabase
      .from('vegetables')
      .select('*')
      .limit(1)

    if (tableError) {
      
      debugInfo.results.table_structure_error = tableError
    } else if (tableInfo && tableInfo.length > 0) {
      debugInfo.results.table_columns = Object.keys(tableInfo[0])
      debugInfo.results.sample_record = tableInfo[0]
    }

    // 5. 最近の野菜登録を確認（APIログから）
    

    
    
    return NextResponse.json({
      success: true,
      debug_info: debugInfo,
      summary: {
        total_vegetables: debugInfo.results.total_count || 0,
        company_vegetables: debugInfo.results.company_vegetables_count || 0,
        problem_record_exists: debugInfo.results.problem_record ? true : false,
        table_accessible: !debugInfo.results.table_structure_error
      }
    })

  } catch (error) {
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '予期しないエラーが発生しました',
        debug_error: error
      },
      { status: 500 }
    )
  }
}