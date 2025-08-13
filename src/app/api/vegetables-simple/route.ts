'use server'

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/vegetables-simple - シンプルな野菜データ取得
export async function GET(request: Request) {
  try {
    console.log('🔍 シンプル野菜API - データ取得開始...')

    // URLクエリパラメータを取得
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')

    console.log('📋 検索パラメータ:', { companyId })

    // 基本クエリ
    let query = supabase
      .from('vegetables')
      .select(`
        id,
        name,
        variety_name,
        plot_name,
        area_size,
        planting_date,
        expected_harvest_start,
        expected_harvest_end,
        status,
        notes,
        custom_fields,
        created_at,
        company_id
      `)
      .order('created_at', { ascending: false })

    // company_idでフィルタリング（指定されている場合）
    if (companyId) {
      query = query.eq('company_id', companyId)
    }

    console.log('🔍 Supabaseクエリを実行...')
    const { data, error } = await query

    if (error) {
      console.error('❌ Supabase取得エラー:', error)
      return NextResponse.json(
        { 
          success: false, 
          error: error.message,
          debug_info: {
            error_code: error.code,
            error_details: error.details,
            error_hint: error.hint
          }
        },
        { status: 500 }
      )
    }

    console.log(`✅ 野菜データ取得成功: ${data?.length || 0}件`)
    
    // データを処理して返す
    const processedData = (data || []).map(vegetable => ({
      ...vegetable,
      farm_area_data: vegetable.custom_fields?.farm_area_data || null,
      has_spatial_data: vegetable.custom_fields?.has_spatial_data || false,
      polygon_color: vegetable.custom_fields?.polygon_color || '#22c55e'
    }))

    return NextResponse.json({
      success: true,
      data: processedData,
      count: processedData.length,
      message: `${processedData.length}件の野菜データを取得しました`
    })

  } catch (error) {
    console.error('💥 予期しないエラー:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '予期しないエラーが発生しました',
        error_type: 'UNEXPECTED_ERROR'
      },
      { status: 500 }
    )
  }
}

// POST /api/vegetables-simple - シンプルな野菜作成
export async function POST(request: Request) {
  try {
    console.log('🌱 シンプル野菜API - 新規作成開始...')
    const requestData = await request.json()
    
    console.log('📝 作成データ:', requestData)

    // 必須フィールドの確認
    if (!requestData.name || !requestData.variety_name || !requestData.plot_name) {
      return NextResponse.json(
        { 
          success: false, 
          error: '必須フィールドが不足しています（name, variety_name, plot_name）'
        },
        { status: 400 }
      )
    }

    // 作成データの準備
    const insertData = {
      name: requestData.name,
      variety_name: requestData.variety_name,
      plot_name: requestData.plot_name,
      area_size: requestData.area_size || 0,
      planting_date: requestData.planting_date,
      expected_harvest_start: requestData.expected_harvest_start || null,
      expected_harvest_end: requestData.expected_harvest_end || null,
      status: requestData.status || 'planning',
      notes: requestData.notes || '',
      company_id: requestData.company_id || 'a1111111-1111-1111-1111-111111111111',
      created_by: null, // 外部キー制約を回避
      created_at: new Date().toISOString()
    }

    console.log('💾 データベースに挿入...')
    const { data, error } = await supabase
      .from('vegetables')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('❌ 作成エラー:', error)
      return NextResponse.json(
        { 
          success: false, 
          error: error.message,
          debug_info: {
            error_code: error.code,
            error_details: error.details
          }
        },
        { status: 500 }
      )
    }

    console.log('✅ 野菜作成成功:', data.id)
    
    return NextResponse.json({
      success: true,
      data: data,
      message: '野菜レコードを作成しました'
    })

  } catch (error) {
    console.error('💥 予期しないエラー:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '予期しないエラーが発生しました'
      },
      { status: 500 }
    )
  }
}