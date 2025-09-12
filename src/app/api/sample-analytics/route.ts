import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Sample analytics API - 開始')
    const { searchParams } = new URL(request.url)
    const sampleVegetableId = searchParams.get('sample_vegetable_id')
    
    console.log('🔍 受信したsample_vegetable_id:', sampleVegetableId, 'type:', typeof sampleVegetableId)

    if (!sampleVegetableId || sampleVegetableId.trim() === '' || sampleVegetableId === 'null' || sampleVegetableId === 'undefined') {
      console.log('❌ sample_vegetable_id が無効:', sampleVegetableId)
      return NextResponse.json({ error: 'sample_vegetable_id is required' }, { status: 400 })
    }

    console.log('✅ sample_vegetable_id:', sampleVegetableId)
    const supabase = await createClient()
    console.log('✅ Supabaseクライアント作成完了')

    // サンプル野菜情報を取得
    const { data: sampleVegetable, error: vegetableError } = await supabase
      .from('sample_vegetables')
      .select('*')
      .eq('id', sampleVegetableId)
      .single()

    if (vegetableError) {
      console.error('❌ Sample vegetable fetch error:', vegetableError)
      return NextResponse.json({ error: 'サンプル野菜データの取得に失敗しました', details: vegetableError }, { status: 500 })
    }
    
    console.log('✅ Sample vegetable データ取得成功:', sampleVegetable?.display_name)

    // サンプル作業レポートを取得
    const { data: workReports, error: reportsError } = await supabase
      .from('sample_work_reports')
      .select(`
        *,
        sample_work_report_accounting (
          id,
          amount,
          accounting_items (
            id,
            name,
            type,
            category
          )
        )
      `)
      .eq('sample_vegetable_id', sampleVegetableId)
      .order('work_date')

    if (reportsError) {
      console.error('❌ Sample work reports fetch error:', reportsError)
      return NextResponse.json({ error: 'サンプル作業データの取得に失敗しました', details: reportsError }, { status: 500 })
    }
    
    console.log('✅ Sample work reports取得成功:', workReports?.length || 0, '件')

    // データを分析用に変換
    const analyticsData = generateSampleAnalyticsData(workReports || [], [sampleVegetable])

    console.log(`📊 Sample analytics API: ${sampleVegetable.display_name} - ${workReports?.length || 0}件の作業データ`)

    return NextResponse.json({
      success: true,
      vegetable: sampleVegetable,
      analytics: analyticsData,
      workReports: workReports || []
    })

  } catch (error) {
    console.error('❌ Sample analytics API error:', error)
    return NextResponse.json(
      { 
        error: 'サーバーエラーが発生しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// サンプルデータ用の分析データ生成関数
function generateSampleAnalyticsData(reports: any[], vegetables: any[]) {
  if (!reports || reports.length === 0) {
    return createEmptyAnalyticsData(vegetables)
  }

  // 月別収穫量データ生成
  const harvestByMonth = reports
    .filter(r => r.work_type === 'harvesting' && r.harvest_amount)
    .reduce((acc: any, report) => {
      const date = new Date(report.work_date)
      const month = date.getMonth() + 1
      const monthKey = `${month}月`
      acc[monthKey] = (acc[monthKey] || 0) + report.harvest_amount
      return acc
    }, {})

  // 作業種別コスト分析
  const costByType: {[key: string]: number} = {}
  let totalRevenue = 0
  let totalCost = 0
  let totalHarvest = 0
  let totalWorkHours = 0

  reports.forEach(report => {
    // 収益・コスト集計
    totalRevenue += report.income_total || 0
    totalCost += report.expense_total || 0
    totalHarvest += report.harvest_amount || 0
    totalWorkHours += report.duration_hours || 0

    // 作業種別コスト分類
    const typeLabels: any = {
      seeding: '種苗費',
      planting: '定植費',
      fertilizing: '肥料費',
      watering: '灌水費',
      weeding: '除草費',
      pruning: '整枝費',
      harvesting: '収穫費',
      other: 'その他'
    }
    const label = typeLabels[report.work_type] || 'その他'
    costByType[label] = (costByType[label] || 0) + (report.expense_total || 0)
  })

  // 作業頻度分析
  const workFrequency: {[key: string]: number} = {}
  reports.forEach(report => {
    workFrequency[report.work_type] = (workFrequency[report.work_type] || 0) + 1
  })

  // 最近の活動
  const recentActivities = reports
    .slice(-10)
    .map((report, index) => ({
      id: report.id || `activity_${index}`,
      type: report.work_type === 'harvesting' ? 'harvest' as const : 'cost' as const,
      title: `${vegetables[0]?.name || 'サンプル野菜'}の${report.work_type}作業`,
      description: report.description || `${report.work_type}作業を実施`,
      value: report.work_type === 'harvesting' ? (report.income_total || 0) : (report.expense_total || 0),
      timestamp: new Date(report.work_date).toISOString()
    }))
    .reverse()

  const avgYield = vegetables.length > 0 ? totalHarvest / vegetables.reduce((sum, v) => sum + (v.area_size || 0), 0) : 0

  return {
    summary: {
      total_revenue: Math.round(totalRevenue),
      total_cost: Math.round(totalCost),
      profit_margin: totalRevenue > 0 ? Math.round(((totalRevenue - totalCost) / totalRevenue) * 100 * 10) / 10 : 0,
      total_harvest: Math.round(totalHarvest * 10) / 10,
      total_work_hours: totalWorkHours,
      avg_yield_per_sqm: Math.round(avgYield * 100) / 100,
      active_plots: vegetables.length,
      completed_harvests: reports.filter(r => r.work_type === 'harvesting' && r.harvest_amount > 0).length,
      efficiency_score: Math.min(100, Math.round((totalHarvest / Math.max(totalWorkHours, 1)) * 10))
    },
    harvest_analysis: Object.entries(harvestByMonth).map(([month, amount]) => ({
      label: month,
      value: Math.round((amount as number) * 10) / 10,
      color: 'bg-green-600'
    })),
    cost_analysis: Object.entries(costByType).map(([type, amount]) => ({
      label: type,
      value: Math.round(amount as number),
      color: 'bg-blue-600'
    })),
    work_frequency: Object.entries(workFrequency).map(([type, count]) => ({
      label: type,
      value: count as number,
      color: 'bg-yellow-600'
    })),
    vegetable_performance: vegetables.map(veg => ({
      name: veg.name,
      yield: totalHarvest,
      revenue: totalRevenue,
      efficiency: Math.round((totalHarvest / Math.max(totalWorkHours, 1)) * 10)
    })),
    recent_activities: recentActivities,
    dataQuality: {
      incomeSource: 'sample' as const,
      expenseSource: 'sample' as const,
      reliability: 'high' as const
    }
  }
}

function createEmptyAnalyticsData(vegetables: any[]) {
  return {
    summary: {
      total_revenue: 0,
      total_cost: 0,
      profit_margin: 0,
      total_harvest: 0,
      total_work_hours: 0,
      avg_yield_per_sqm: 0,
      active_plots: vegetables.length,
      completed_harvests: 0,
      efficiency_score: 0
    },
    harvest_analysis: [],
    cost_analysis: [],
    work_frequency: [],
    vegetable_performance: [],
    recent_activities: [],
    dataQuality: {
      incomeSource: 'sample' as const,
      expenseSource: 'sample' as const,
      reliability: 'high' as const
    }
  }
}