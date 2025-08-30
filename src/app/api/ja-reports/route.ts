import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/ja-reports - JA出荷用農薬使用記録帳票生成
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceClient()
    
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')
    const vegetableId = searchParams.get('vegetable_id') 
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const format = searchParams.get('format') || 'json' // json, csv, pdf

    console.log('📋 JA帳票API - リクエストパラメータ:', { 
      companyId, vegetableId, startDate, endDate, format 
    })

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 })
    }

    // JA出荷用帳票データ取得
    if (vegetableId) {
      // 特定野菜の詳細帳票
      const { data, error } = await supabase
        .rpc('generate_ja_pesticide_report', {
          p_vegetable_id: vegetableId,
          p_start_date: startDate,
          p_end_date: endDate
        })

      if (error) {
        console.error('❌ JA帳票API - データベースエラー:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      // 追加情報取得
      const { data: vegetableInfo } = await supabase
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
          companies:company_id (
            name,
            contact_email,
            address,
            prefecture,
            city
          )
        `)
        .eq('id', vegetableId)
        .eq('company_id', companyId)
        .single()

      const reportData = {
        vegetable_info: vegetableInfo,
        applications: data || [],
        summary: {
          total_applications: data?.length || 0,
          compliant_applications: data?.filter((app: any) => app.compliance_status === '適合').length || 0,
          unique_pesticides: [...new Set(data?.map((app: any) => app.registration_number) || [])].length,
          period: startDate && endDate ? `${startDate} ～ ${endDate}` : '全期間'
        },
        generated_at: new Date().toISOString()
      }

      if (format === 'csv') {
        // CSV形式で返す
        const csvHeaders = [
          '散布日', '農薬名', '有効成分', '登録番号', 'メーカー', 
          '希釈倍率', '対象病害虫', '散布者', '収穫前日数', '適合性'
        ]
        
        const csvRows = data?.map((app: any) => [
          app.application_date,
          app.pesticide_name,
          app.active_ingredient,
          app.registration_number,
          '', // メーカーは別途取得が必要
          app.dilution_rate ? `${app.dilution_rate}倍` : '',
          app.target_pest,
          app.applicator_name,
          app.harvest_restriction_days,
          app.compliance_status
        ]) || []

        const csvContent = [csvHeaders, ...csvRows]
          .map(row => row.map(field => `"${field}"`).join(','))
          .join('\n')

        return new NextResponse(csvContent, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="pesticide-report-${vegetableId}-${new Date().toISOString().split('T')[0]}.csv"`
          }
        })
      }

      return NextResponse.json({
        success: true,
        data: reportData
      })

    } else {
      // 企業全体のサマリー帳票
      const { data, error } = await supabase
        .from('pesticide_applications')
        .select(`
          id,
          vegetable_id,
          application_date,
          target_pest,
          applicator_name,
          pre_harvest_interval_ok,
          application_count_ok,
          ja_compliant,
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
            organic_approved
          )
        `)
        .eq('company_id', companyId)
        .gte('application_date', startDate || '2000-01-01')
        .lte('application_date', endDate || '9999-12-31')
        .order('application_date', { ascending: false })

      if (error) {
        console.error('❌ JA帳票API - データベースエラー:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      // サマリー統計作成
      const summary = {
        total_applications: data?.length || 0,
        compliant_applications: data?.filter(app => app.ja_compliant).length || 0,
        non_compliant_applications: data?.filter(app => !app.ja_compliant).length || 0,
        unique_vegetables: [...new Set(data?.map(app => app.vegetable_id) || [])].length,
        unique_pesticides: [...new Set(data?.map(app => app.pesticide_products?.registration_number) || [])].length,
        organic_approved_count: data?.filter(app => app.pesticide_products?.organic_approved).length || 0,
        by_vegetable: {},
        by_pesticide_type: {},
        compliance_rate: 0
      }

      // 野菜別集計
      data?.forEach((app: any) => {
        const vegName = app.vegetables?.name || '不明'
        if (!summary.by_vegetable[vegName]) {
          summary.by_vegetable[vegName] = { count: 0, compliant: 0 }
        }
        summary.by_vegetable[vegName].count++
        if (app.ja_compliant) {
          summary.by_vegetable[vegName].compliant++
        }
      })

      // 農薬種類別集計
      data?.forEach((app: any) => {
        const type = app.pesticide_products?.product_type || '不明'
        if (!summary.by_pesticide_type[type]) {
          summary.by_pesticide_type[type] = { count: 0, compliant: 0 }
        }
        summary.by_pesticide_type[type].count++
        if (app.ja_compliant) {
          summary.by_pesticide_type[type].compliant++
        }
      })

      summary.compliance_rate = summary.total_applications > 0 
        ? Math.round((summary.compliant_applications / summary.total_applications) * 100)
        : 100

      return NextResponse.json({
        success: true,
        data: {
          applications: data || [],
          summary: summary,
          period: startDate && endDate ? `${startDate} ～ ${endDate}` : '全期間',
          generated_at: new Date().toISOString()
        }
      })
    }

  } catch (error) {
    console.error('❌ JA帳票API - 予期しないエラー:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST /api/ja-reports/validate - JA出荷前のバリデーション
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServiceClient()
    const body = await request.json()

    console.log('📋 JA帳票バリデーション:', body)

    const { company_id, vegetable_ids, harvest_date } = body

    if (!company_id || !vegetable_ids || !harvest_date) {
      return NextResponse.json({ 
        error: 'company_id, vegetable_ids, and harvest_date are required' 
      }, { status: 400 })
    }

    const validationResults = []

    // 各野菜について収穫前日数チェック
    for (const vegetableId of vegetable_ids) {
      const { data: applications } = await supabase
        .from('pesticide_applications')
        .select(`
          id,
          application_date,
          pesticide_products:pesticide_product_id (
            product_name,
            harvest_restriction_days
          )
        `)
        .eq('company_id', company_id)
        .eq('vegetable_id', vegetableId)
        .order('application_date', { ascending: false })

      const { data: vegetableInfo } = await supabase
        .from('vegetables')
        .select('name, variety_name')
        .eq('id', vegetableId)
        .single()

      const violations = []
      const warnings = []

      applications?.forEach((app: any) => {
        const daysSinceApplication = Math.floor(
          (new Date(harvest_date).getTime() - new Date(app.application_date).getTime()) 
          / (1000 * 60 * 60 * 24)
        )
        
        const requiredDays = app.pesticide_products?.harvest_restriction_days || 0

        if (daysSinceApplication < requiredDays) {
          violations.push({
            pesticide_name: app.pesticide_products?.product_name,
            application_date: app.application_date,
            required_days: requiredDays,
            actual_days: daysSinceApplication,
            shortage_days: requiredDays - daysSinceApplication
          })
        } else if (daysSinceApplication < requiredDays + 3) {
          warnings.push({
            pesticide_name: app.pesticide_products?.product_name,
            application_date: app.application_date,
            required_days: requiredDays,
            actual_days: daysSinceApplication,
            message: '収穫前日数ギリギリです'
          })
        }
      })

      validationResults.push({
        vegetable_id: vegetableId,
        vegetable_name: vegetableInfo?.name,
        variety_name: vegetableInfo?.variety_name,
        harvest_date: harvest_date,
        is_compliant: violations.length === 0,
        violations: violations,
        warnings: warnings,
        total_applications: applications?.length || 0
      })
    }

    const overallCompliant = validationResults.every(result => result.is_compliant)
    const totalViolations = validationResults.reduce((sum, result) => sum + result.violations.length, 0)

    return NextResponse.json({
      success: true,
      data: {
        overall_compliant: overallCompliant,
        total_violations: totalViolations,
        validation_results: validationResults,
        validated_at: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ JA帳票バリデーション - 予期しないエラー:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}