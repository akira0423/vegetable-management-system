'use server'

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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
  try {
    console.log('🔍 野菜レコードのデバッグ調査を開始...')

    const debugInfo: any = {
      timestamp: new Date().toISOString(),
      results: {}
    }

    // 0. データベース接続確認
    console.log('🔗 データベース接続を確認...')
    try {
      const { data: connectionTest, error: connectionError } = await supabase
        .from('vegetables')
        .select('count')
        .limit(1)
      
      if (connectionError) {
        debugInfo.results.connection_error = connectionError
        console.error('❌ データベース接続エラー:', connectionError)
      } else {
        debugInfo.results.connection_status = 'SUCCESS'
        console.log('✅ データベース接続成功')
      }
    } catch (connectionErr) {
      debugInfo.results.connection_error = connectionErr
      console.error('❌ データベース接続で予期しないエラー:', connectionErr)
    }

    // 1. 全ての野菜レコードを取得
    console.log('📊 全野菜レコードを確認...')
    const { data: allVegetables, error: allError } = await supabase
      .from('vegetables')
      .select('id, name, variety_name, plot_name, created_at, company_id')
      .order('created_at', { ascending: false })

    if (allError) {
      console.error('❌ 全レコード取得エラー:', allError)
      debugInfo.results.all_vegetables_error = allError
    } else {
      console.log(`✅ 総レコード数: ${allVegetables?.length || 0}`)
      debugInfo.results.total_count = allVegetables?.length || 0
      debugInfo.results.all_vegetables = allVegetables || []
    }

    // 2. 問題のIDを直接検索
    const problemId = 'eb03336c-1a80-4b32-85e0-7ce8a5605238'
    console.log(`🎯 問題のID「${problemId}」を直接検索...`)
    
    const { data: specificVeg, error: specificError } = await supabase
      .from('vegetables')
      .select('*')
      .eq('id', problemId)
      .maybeSingle()

    if (specificError) {
      console.error('❌ 特定ID検索エラー:', specificError)
      debugInfo.results.specific_search_error = specificError
    } else if (specificVeg) {
      console.log('✅ 問題のIDレコードが見つかりました')
      debugInfo.results.problem_record = specificVeg
    } else {
      console.log('❌ 指定されたIDのレコードは存在しません')
      debugInfo.results.problem_record = null
      debugInfo.results.problem_record_status = 'NOT_FOUND'
    }

    // 3. 会社IDでフィルタリングしたレコード確認
    console.log('🏢 company_id で絞り込んだレコード...')
    const { data: companyVegs, error: companyError } = await supabase
      .from('vegetables')
      .select('id, name, variety_name, company_id, custom_fields')
      .eq('company_id', 'a1111111-1111-1111-1111-111111111111')

    if (companyError) {
      console.error('❌ 会社IDフィルタエラー:', companyError)
      debugInfo.results.company_vegetables_error = companyError
    } else {
      console.log(`✅ 該当する会社の野菜レコード数: ${companyVegs?.length || 0}`)
      debugInfo.results.company_vegetables_count = companyVegs?.length || 0
      debugInfo.results.company_vegetables = companyVegs || []
    }

    // 4. テーブル構造確認
    console.log('🏗️ テーブル構造を確認...')
    const { data: tableInfo, error: tableError } = await supabase
      .from('vegetables')
      .select('*')
      .limit(1)

    if (tableError) {
      console.error('❌ テーブル構造確認エラー:', tableError)
      debugInfo.results.table_structure_error = tableError
    } else if (tableInfo && tableInfo.length > 0) {
      debugInfo.results.table_columns = Object.keys(tableInfo[0])
      debugInfo.results.sample_record = tableInfo[0]
    }

    // 5. 最近の野菜登録を確認（APIログから）
    console.log('📝 最近の野菜登録を確認...')

    console.log('✅ デバッグ調査完了')
    
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
    console.error('💥 デバッグAPI予期しないエラー:', error)
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