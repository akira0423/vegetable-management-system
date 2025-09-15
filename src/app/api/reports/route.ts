import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // 認証済みクライアントを使用（セキュリティ強化）
    const supabase = await createClient()
    
    // ユーザー認証確認
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    // URLクエリパラメータを取得
    const { searchParams } = new URL(request.url)
    let companyId = searchParams.get('company_id')
    const vegetableId = searchParams.get('vegetable_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const workType = searchParams.get('work_type')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Company IDが指定されていない場合はエラー
    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 })
    }

    // ユーザーの企業アクセス権を確認
    const { ensureUserMembership } = await import('@/lib/auth/membership-helper')
    const membershipResult = await ensureUserMembership(user.id, companyId)

    if (!membershipResult.success) {
      if (process.env.NODE_ENV === 'development') {
        console.log('❌ API - 企業アクセスエラー:', membershipResult.error)
      }
      return NextResponse.json(
        { error: 'Access denied to this company data' },
        { status: 403 }
      )
    }

    // アクティブな記録のみ取得するかどうか
    const activeOnly = searchParams.get('active_only') !== 'false'
    
    // ベースクエリ（会計データも含めて取得）
    let query = supabase
      .from('work_reports')
      .select(`
        id,
        company_id,
        vegetable_id,
        work_type,
        description,
        work_date,
        start_time,
        end_time,
        duration_hours,
        work_duration,
        worker_count,
        weather,
        temperature,
        humidity,
        harvest_amount,
        harvest_unit,
        harvest_quality,
        expected_price,
        notes,
        created_by,
        created_at,
        soil_ph,
        soil_ec,
        phosphorus_absorption,
        cec,
        base_saturation,
        exchangeable_calcium,
        exchangeable_magnesium,
        exchangeable_potassium,
        humus_content,
        available_phosphorus,
        available_silica,
        ammonium_nitrogen,
        nitrate_nitrogen,
        soil_notes,
        vegetables:vegetable_id (
          id,
          name,
          variety_name,
          plot_name
        ),
        work_report_accounting (
          id,
          accounting_item_id,
          amount,
          custom_item_name,
          notes,
          is_ai_recommended,
          accounting_items:accounting_item_id (
            id,
            code,
            name,
            type,
            category,
            cost_type
          )
        )
      `)
      .eq('company_id', companyId)
    
    // 削除された作業レポートを除外
    if (activeOnly) {
      console.log('🔍 Reports API: 削除済み作業レポートを除外中 (deleted_at IS NULL)')
      query = query.is('deleted_at', null)
    } else {
      console.log('🔍 Reports API: active_only=false のため、削除済み作業レポートも含める')
    }
    
    query = query.order('work_date', { ascending: false })
      .order('created_at', { ascending: false })

    // フィルター条件の適用
    if (vegetableId) {
      query = query.eq('vegetable_id', vegetableId)
    }

    if (startDate) {
      query = query.gte('work_date', startDate)
    }

    if (endDate) {
      query = query.lte('work_date', endDate)
    }

    if (workType) {
      query = query.eq('work_type', workType)
    }

    // ページネーション
    query = query.range(offset, offset + limit - 1)

    const { data, error } = await query

    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Database error:', error)
      }
      return NextResponse.json(
        { error: 'Database error occurred' },
        { status: 500 }
      )
    }

    console.log('📊 Reports API - 取得された作業レポート数:', data?.length || 0)
    console.log('📊 Reports API - 取得されたレポート詳細:', data?.map(r => ({
      id: r.id,
      work_date: r.work_date,
      work_type: r.work_type,
      vegetable_name: r.vegetables?.name,
      accounting_items: r.work_report_accounting?.length || 0
    })) || [])

    // 削除された野菜に関連する作業記録を除外
    const filteredData = data?.filter(report => report.vegetables !== null) || []

    console.log('📊 Reports API - 野菜フィルタ後のレポート数:', filteredData.length)

    return NextResponse.json({
      success: true,
      data: filteredData,
      count: filteredData.length
    })

  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('API error:', error)
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // 認証済みクライアントを使用（セキュリティ強化）
    const supabase = await createClient()
    
    // ユーザー認証確認
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    let body;
    try {
      body = await request.json()
    } catch (jsonError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('JSON parse error:', jsonError)
      }
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    // 必須フィールドの検証
    if (!body.company_id) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 })
    }

    // ユーザーが指定された企業にアクセス権限を持っているか確認
    const { checkAndEnsureMembership } = await import('@/lib/auth/membership-helper')
    const membershipResult = await checkAndEnsureMembership(user.id, body.company_id)

    if (!membershipResult.success) {
      if (process.env.NODE_ENV === 'development') {
        console.log('❌ API - メンバーシップエラー:', membershipResult.error)
      }
      return NextResponse.json(
        { error: 'Access denied to this company data' },
        { status: 403 }
      )
    }

    if (!body.work_type) {
      return NextResponse.json({ error: 'Work type is required' }, { status: 400 })
    }

    if (!body.work_date) {
      return NextResponse.json({ error: 'Work date is required' }, { status: 400 })
    }

    // 拡張されたデータベーススキーマに合わせたデータ準備
    const reportData = {
      // 基本情報
      company_id: body.company_id,
      vegetable_id: body.vegetable_id || null,
      work_type: body.work_type,
      description: body.description || body.work_notes || null,
      work_date: body.work_date,
      start_time: body.start_time || null,
      end_time: body.end_time || null,
      duration_hours: body.duration_hours || null,
      work_duration: body.work_duration || null,  // 作業時間（分）
      weather: body.weather || null,
      temperature: body.temperature || null,
      humidity: body.humidity || null,
      notes: body.notes || body.work_notes || null,
      created_by: body.created_by || null,
      
      // 収穫データ
      harvest_amount: body.harvest_amount || null,
      harvest_unit: body.harvest_unit || null,
      harvest_quality: body.harvest_quality || null,
      expected_price: body.expected_price || null,

      // 売上データはnotesフィールドに統合保存するため、ここでは削除
      
      // 作業者情報
      worker_count: body.worker_count || 1
    }

    // データベースに挿入
    const { data, error } = await supabase
      .from('work_reports')
      .insert(reportData)
      .select(`
        id,
        company_id,
        vegetable_id,
        work_type,
        description,
        work_date,
        start_time,
        end_time,
        duration_hours,
        weather,
        temperature,
        harvest_amount,
        harvest_unit,
        harvest_quality,
        expected_price,
        worker_count,
        notes,
        created_by,
        created_at,
        vegetables:vegetable_id (
          id,
          name,
          variety_name,
          plot_name
        )
      `)
      .single()

    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Database error:', error)
      }
      return NextResponse.json(
        { error: 'Database error occurred' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data,
      message: 'Work report created successfully'
    }, { status: 201 })

  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('POST API error:', error)
      console.error('Error stack:', error.stack)
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // 認証済みクライアントを使用（セキュリティ強化）
    const supabase = await createClient()
    
    // ユーザー認証確認
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    const body = await request.json()
    
    const { id, reason, hard_delete = false } = body

    if (!id) {
      return NextResponse.json({ error: 'Report ID is required' }, { status: 400 })
    }

    // レポートの存在確認と企業アクセス権限チェック
    const { data: report, error: reportError } = await supabase
      .from('work_reports')
      .select('company_id')
      .eq('id', id)
      .single()

    if (reportError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    // ユーザーが該当企業にアクセス権限を持っているか確認
    const { checkAndEnsureMembership } = await import('@/lib/auth/membership-helper')
    const membershipResult = await checkAndEnsureMembership(user.id, report.company_id)

    if (!membershipResult.success) {
      if (process.env.NODE_ENV === 'development') {
        console.log('❌ API - メンバーシップエラー:', membershipResult.error)
      }
      return NextResponse.json(
        { error: 'Access denied to this company data' },
        { status: 403 }
      )
    }

    if (hard_delete) {
      // 物理削除（管理者用）
      const { error } = await supabase
        .from('work_reports')
        .delete()
        .eq('id', id)

      if (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Database error:', error)
        }
        return NextResponse.json({ error: 'Failed to delete report' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: 'Report permanently deleted'
      })
    } else {
      // カスケード削除システム - 完全削除
      const { error } = await supabase
        .from('work_reports')
        .delete()
        .eq('id', id)

      if (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Database error:', error)
        }
        return NextResponse.json({ error: 'Failed to delete report' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: '実績記録を完全に削除しました'
      })
    }

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}