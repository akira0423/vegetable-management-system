import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/pesticide-applications - 農薬散布記録一覧取得
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceClient()
    
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')
    const vegetableId = searchParams.get('vegetable_id')
    const pesticideId = searchParams.get('pesticide_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const applicatorName = searchParams.get('applicator_name')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    console.log('🧪 農薬散布記録API - リクエストパラメータ:', { 
      companyId, vegetableId, pesticideId, startDate, endDate, applicatorName, limit, offset 
    })

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 })
    }

    // ベースクエリ（関連データもJOIN）
    let query = supabase
      .from('pesticide_applications')
      .select(`
        id,
        company_id,
        vegetable_id,
        work_report_id,
        application_date,
        application_time,
        target_area_sqm,
        amount_used,
        dilution_rate,
        water_volume,
        weather_condition,
        wind_speed,
        temperature,
        humidity,
        target_pest,
        application_reason,
        application_method,
        applicator_name,
        applicator_license,
        effectiveness_rating,
        side_effects,
        next_application_date,
        pre_harvest_interval_ok,
        application_count_ok,
        compliance_checked_at,
        organic_compliant,
        ja_compliant,
        export_compliant,
        created_at,
        updated_at,
        vegetables:vegetable_id (
          id,
          name,
          variety_name,
          plot_name
        ),
        pesticide_products:pesticide_product_id (
          id,
          product_name,
          active_ingredient,
          registration_number,
          manufacturer,
          product_type,
          harvest_restriction_days,
          max_applications_per_season,
          organic_approved
        )
      `)
      .eq('company_id', companyId)

    // フィルター適用
    if (vegetableId) {
      query = query.eq('vegetable_id', vegetableId)
    }

    if (pesticideId) {
      query = query.eq('pesticide_product_id', pesticideId)
    }

    if (startDate) {
      query = query.gte('application_date', startDate)
    }

    if (endDate) {
      query = query.lte('application_date', endDate)
    }

    if (applicatorName) {
      query = query.ilike('applicator_name', `%${applicatorName}%`)
    }

    // 実行
    const { data, error, count } = await query
      .range(offset, offset + limit - 1)
      .order('application_date', { ascending: false })

    if (error) {
      console.error('❌ 農薬散布記録API - データベースエラー:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('✅ 農薬散布記録API - 取得成功:', { count: data?.length || 0 })

    return NextResponse.json({
      success: true,
      data: data || [],
      count: data?.length || 0
    })

  } catch (error) {
    console.error('❌ 農薬散布記録API - 予期しないエラー:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

// POST /api/pesticide-applications - 農薬散布記録新規作成
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServiceClient()
    const body = await request.json()

    console.log('🧪 農薬散布記録API - 新規作成:', body)

    // 必須フィールドチェック
    const requiredFields = [
      'company_id', 'vegetable_id', 'pesticide_product_id', 'application_date', 
      'target_area_sqm', 'amount_used', 'target_pest', 'applicator_name'
    ]
    
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({ 
          error: `${field} is required` 
        }, { status: 400 })
      }
    }

    // コンプライアンスチェック実行
    const { data: complianceResult } = await supabase
      .rpc('check_pesticide_compliance', {
        p_vegetable_id: body.vegetable_id,
        p_pesticide_product_id: body.pesticide_product_id,
        p_application_date: body.application_date
      })

    const complianceOk = complianceResult?.max_applications_ok && 
                        complianceResult?.interval_ok && 
                        complianceResult?.harvest_interval_ok &&
                        complianceResult?.crop_approved

    console.log('🔍 コンプライアンスチェック結果:', complianceResult)

    // データ挿入
    const { data, error } = await supabase
      .from('pesticide_applications')
      .insert({
        company_id: body.company_id,
        vegetable_id: body.vegetable_id,
        pesticide_product_id: body.pesticide_product_id,
        work_report_id: body.work_report_id || null,
        application_date: body.application_date,
        application_time: body.application_time || null,
        target_area_sqm: body.target_area_sqm,
        amount_used: body.amount_used,
        dilution_rate: body.dilution_rate || null,
        water_volume: body.water_volume || null,
        weather_condition: body.weather_condition || null,
        wind_speed: body.wind_speed || null,
        temperature: body.temperature || null,
        humidity: body.humidity || null,
        target_pest: body.target_pest,
        application_reason: body.application_reason || null,
        application_method: body.application_method || null,
        applicator_name: body.applicator_name,
        applicator_license: body.applicator_license || null,
        effectiveness_rating: body.effectiveness_rating || null,
        side_effects: body.side_effects || null,
        next_application_date: body.next_application_date || null,
        
        // コンプライアンス情報を自動設定
        pre_harvest_interval_ok: complianceResult?.harvest_interval_ok || false,
        application_count_ok: complianceResult?.max_applications_ok || false,
        compliance_checked_at: new Date().toISOString(),
        
        organic_compliant: body.organic_compliant !== false,
        ja_compliant: complianceOk,
        export_compliant: body.export_compliant !== false,
        created_by: body.created_by
      })
      .select(`
        *,
        vegetables:vegetable_id (
          id,
          name,
          variety_name
        ),
        pesticide_products:pesticide_product_id (
          id,
          product_name,
          active_ingredient,
          registration_number
        )
      `)
      .single()

    if (error) {
      console.error('❌ 農薬散布記録API - 作成エラー:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('✅ 農薬散布記録API - 作成成功:', data.id)

    // 警告情報も含めて返す
    const warnings = []
    if (!complianceResult?.max_applications_ok) {
      warnings.push('使用回数が上限に達しています')
    }
    if (!complianceResult?.interval_ok) {
      warnings.push('前回散布からの間隔が不足しています')
    }
    if (!complianceResult?.harvest_interval_ok) {
      warnings.push('収穫前日数が不足している可能性があります')
    }
    if (!complianceResult?.crop_approved) {
      warnings.push('この農薬は対象作物への使用が承認されていません')
    }

    return NextResponse.json({
      success: true,
      data: data,
      compliance: complianceResult,
      warnings: warnings
    }, { status: 201 })

  } catch (error) {
    console.error('❌ 農薬散布記録API - 予期しないエラー:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}