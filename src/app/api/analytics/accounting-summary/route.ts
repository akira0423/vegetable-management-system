import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { accountingAnalyticsProcessor } from '@/lib/accounting-analytics-processor'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 })
    }

    

    // 作業レポートと会計データを取得
    let query = supabase
      .from('work_reports')
      .select(`
        id,
        company_id,
        vegetable_id,
        work_type,
        description,
        work_date,
        duration_hours,
        worker_count,
        harvest_amount,
        expected_price,
        notes,
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
            category
          )
        )
      `)
      .eq('company_id', companyId)

    // 日付フィルタ
    if (startDate) {
      query = query.gte('work_date', startDate)
    }
    if (endDate) {
      query = query.lte('work_date', endDate)
    }

    query = query.order('work_date', { ascending: false })

    const { data, error } = await query

    if (error) {
      
      return NextResponse.json(
        { error: 'Database error', details: error },
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      
      return NextResponse.json({
        success: true,
        accountingSummary: {
          actualIncome: 0,
          actualExpense: 0,
          netIncome: 0,
          aiUsageRate: 0,
          recordCount: 0,
          topIncomeCategories: [],
          topExpenseCategories: [],
          dataQuality: {
            completenessRate: 0,
            accountingCoverageRate: 0,
            estimationFallbackRate: 100,
            inconsistencyCount: 0
          },
          variance: {
            totalEstimated: 0,
            totalActual: 0,
            variance: 0,
            variancePercentage: 0,
            significantVariances: []
          }
        },
        categoryAnalysis: [],
        aiAnalysis: {
          totalEntries: 0,
          aiRecommendedEntries: 0,
          manualEntries: 0,
          aiUsageRate: 0,
          aiAverage: 0,
          manualAverage: 0,
          aiTotal: 0,
          manualTotal: 0,
          topAICategories: [],
          accuracyMetrics: { consistencyScore: 0 }
        },
        monthlyCostData: []
      })
    }

    // プロフェッショナル会計分析プロセッサーを使用
    const accountingSummary = accountingAnalyticsProcessor.generateAccountingSummary(data)
    const categoryAnalysis = accountingAnalyticsProcessor.generateCategoryAnalysis(data)
    const aiAnalysis = accountingAnalyticsProcessor.generateAIRecommendationAnalysis(data)
    
    // 月次コストデータ（直近12ヶ月）
    const currentMonth = new Date().toISOString().substring(0, 7)
    const monthlyCostData = accountingAnalyticsProcessor.generateMonthlyCostFromAccounting(data, currentMonth)

    

    return NextResponse.json({
      success: true,
      accountingSummary,
      categoryAnalysis,
      aiAnalysis,
      monthlyCostData,
      dataSource: 'accounting_integrated',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}