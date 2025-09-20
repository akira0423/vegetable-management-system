import { NextRequest, NextResponse } from 'next/server'

// 作業種別のラベル
const WORK_TYPE_LABELS: { [key: string]: string } = {
  seeding: '播種',
  planting: '定植',
  fertilizing: '施肥',
  watering: '灌水',
  weeding: '除草',
  pruning: '整枝',
  harvesting: '収穫',
  other: 'その他'
}

// サンプルデータ生成用のヘルパー関数
function generateMonthlyData(months: number) {
  const data = []
  const now = new Date()

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const month = date.getMonth() + 1
    const monthLabel = `${month}月`

    // 季節による収穫量の変動をシミュレート
    const seasonalFactor =
      month >= 4 && month <= 10 ? 1.5 : 0.7 // 春夏は収穫量多め

    data.push({
      month: monthLabel,
      harvestAmount: Math.floor((80 + Math.random() * 40) * seasonalFactor),
      revenue: Math.floor((150000 + Math.random() * 100000) * seasonalFactor),
      cost: Math.floor(80000 + Math.random() * 40000),
      workHours: Math.floor(40 + Math.random() * 20)
    })
  }

  return data
}

export async function GET(request: NextRequest) {
  try {
    // URLパラメータから期間とフィルターを取得
    const searchParams = request.nextUrl.searchParams
    const selectedVegetable = searchParams.get('vegetable_id') || 'all'
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    // デモ野菜データ（ハードコーディング）
    const vegetables = [
      { id: 'veg_1', name: 'トマト（桃太郎）', variety_name: '桃太郎' },
      { id: 'veg_2', name: 'キュウリ（夏すずみ）', variety_name: '夏すずみ' },
      { id: 'veg_3', name: 'ナス（千両）', variety_name: '千両' },
      { id: 'veg_4', name: 'レタス（シスコ）', variety_name: 'シスコ' },
      { id: 'veg_5', name: 'ピーマン（カリフォルニアワンダー）', variety_name: 'カリフォルニアワンダー' }
    ]

    // サンプルデータを生成（12か月分）
    const monthlyData = generateMonthlyData(12)

    // 月別収穫量データ
    const harvestByMonth = monthlyData.map(m => ({
      label: m.month,
      value: m.harvestAmount,
      color: 'bg-green-600'
    }))

    // コスト分析データ（作業種別）
    const costByType = [
      { label: '種苗費', value: 45000, color: 'bg-blue-600' },
      { label: '肥料費', value: 68000, color: 'bg-blue-600' },
      { label: '農薬費', value: 35000, color: 'bg-blue-600' },
      { label: '資材費', value: 52000, color: 'bg-blue-600' },
      { label: '人件費', value: 180000, color: 'bg-blue-600' },
      { label: 'その他', value: 28000, color: 'bg-blue-600' }
    ]

    // 作業頻度データ
    const workFrequency = [
      { label: '播種', value: 15, color: 'bg-purple-600' },
      { label: '定植', value: 12, color: 'bg-purple-600' },
      { label: '施肥', value: 48, color: 'bg-purple-600' },
      { label: '灌水', value: 156, color: 'bg-purple-600' },
      { label: '除草', value: 36, color: 'bg-purple-600' },
      { label: '整枝', value: 42, color: 'bg-purple-600' },
      { label: '収穫', value: 85, color: 'bg-purple-600' }
    ]

    // 効率性トレンドデータ
    const efficiencyTrends = monthlyData.slice(-6).map(m => ({
      label: m.month,
      value: Math.round((m.revenue - m.cost) / m.workHours / 100) * 100,
      color: 'bg-green-600'
    }))

    // 季節別パフォーマンスデータ
    const seasonalPerformance = [
      { label: '春', value: 850, color: 'bg-pink-600' },
      { label: '夏', value: 1200, color: 'bg-yellow-600' },
      { label: '秋', value: 950, color: 'bg-orange-600' },
      { label: '冬', value: 450, color: 'bg-blue-600' }
    ]

    // 野菜別パフォーマンスデータ（デモ用固定データ）
    const vegetablePerformance = [
      {
        name: 'トマト',
        variety: '桃太郎',
        plot_size: 120,
        harvest_amount: 450,
        revenue: 680000,
        cost: 280000,
        profit: 400000,
        yield_per_sqm: 3.75,
        roi: 142.9,
        status: 'excellent' as const
      },
      {
        name: 'キュウリ',
        variety: '夏すずみ',
        plot_size: 80,
        harvest_amount: 320,
        revenue: 480000,
        cost: 220000,
        profit: 260000,
        yield_per_sqm: 4.0,
        roi: 118.2,
        status: 'good' as const
      },
      {
        name: 'ナス',
        variety: '千両',
        plot_size: 60,
        harvest_amount: 180,
        revenue: 360000,
        cost: 180000,
        profit: 180000,
        yield_per_sqm: 3.0,
        roi: 100.0,
        status: 'good' as const
      },
      {
        name: 'レタス',
        variety: 'シスコ',
        plot_size: 100,
        harvest_amount: 280,
        revenue: 420000,
        cost: 250000,
        profit: 170000,
        yield_per_sqm: 2.8,
        roi: 68.0,
        status: 'average' as const
      },
      {
        name: 'ピーマン',
        variety: 'カリフォルニアワンダー',
        plot_size: 40,
        harvest_amount: 120,
        revenue: 240000,
        cost: 150000,
        profit: 90000,
        yield_per_sqm: 3.0,
        roi: 60.0,
        status: 'average' as const
      }
    ]

    // 最近のアクティビティデータ（デモ用）
    const recentActivities = [
      {
        id: 'act_1',
        type: 'harvest' as const,
        title: 'トマトの収穫作業',
        description: '桃太郎トマト30kg収穫（実績データ）',
        value: 45000,
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'act_2',
        type: 'cost' as const,
        title: 'キュウリの施肥作業',
        description: '有機肥料15kg施用（実績データ）',
        value: 12000,
        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'act_3',
        type: 'efficiency' as const,
        title: '作業効率改善',
        description: '整枝作業の効率が15%向上',
        value: 15,
        timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'act_4',
        type: 'alert' as const,
        title: '病害虫アラート',
        description: 'ナスにアブラムシ発生の兆候',
        value: 0,
        timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'act_5',
        type: 'harvest' as const,
        title: 'レタスの収穫作業',
        description: 'シスコレタス20kg収穫（推定データ）',
        value: 30000,
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      }
    ]

    // 総計算
    const totalRevenue = monthlyData.reduce((sum, m) => sum + m.revenue, 0)
    const totalCost = monthlyData.reduce((sum, m) => sum + m.cost, 0)
    const totalHarvest = monthlyData.reduce((sum, m) => sum + m.harvestAmount, 0)
    const totalWorkHours = monthlyData.reduce((sum, m) => sum + m.workHours, 0)
    const totalArea = 400 // デモ用固定値

    // レスポンスデータの構築
    const analyticsData = {
      summary: {
        total_revenue: totalRevenue,
        total_cost: totalCost,
        profit_margin: ((totalRevenue - totalCost) / totalRevenue) * 100,
        total_harvest: totalHarvest,
        total_work_hours: totalWorkHours,
        avg_yield_per_sqm: totalHarvest / totalArea,
        active_plots: 5,
        completed_harvests: 85,
        efficiency_score: 82,
        vegetable_count: vegetables.length,
        total_area: totalArea
      },
      dataQuality: {
        incomeSource: 'accounting' as const,
        expenseSource: 'accounting' as const,
        reliability: 'high' as const,
        accountingCoverage: 85
      },
      harvest_analysis: harvestByMonth,
      cost_analysis: costByType,
      efficiency_trends: efficiencyTrends,
      seasonal_performance: seasonalPerformance,
      work_frequency: workFrequency,
      vegetable_performance: vegetablePerformance,
      recent_activities: recentActivities,
      monthly_cashflow: monthlyData.map(m => ({
        month: m.month,
        income: m.revenue,
        expense: m.cost,
        net: m.revenue - m.cost,
        cumulative: 0 // 後で累積計算
      })),
      vegetables: vegetables
    }

    // 累積キャッシュフローの計算
    let cumulative = 0
    analyticsData.monthly_cashflow.forEach(cf => {
      cumulative += cf.net
      cf.cumulative = cumulative
    })

    return NextResponse.json({
      success: true,
      data: analyticsData,
      message: 'デモ用分析データを取得しました'
    })

  } catch (error) {
    
    return NextResponse.json(
      {
        success: false,
        error: 'デモデータの取得に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}