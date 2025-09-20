import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // URLクエリパラメータを取得
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')
    const period = searchParams.get('period') || '3months'
    const vegetableId = searchParams.get('vegetable')
    const plotName = searchParams.get('plot')

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 })
    }

    // 期間の設定
    const periodDays = {
      '1month': 30,
      '3months': 90,
      '6months': 180,
      '1year': 365
    }
    
    const days = periodDays[period as keyof typeof periodDays] || 90
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // 基本統計の取得
    const summary = await getSummaryStats(supabase, companyId, startDate, vegetableId, plotName)
    
    // 収穫分析データ
    const harvestAnalysis = await getHarvestAnalysis(supabase, companyId, startDate, period)
    
    // コスト分析データ
    const costAnalysis = await getCostAnalysis(supabase, companyId, startDate)
    
    // 効率性トレンド
    const efficiencyTrends = await getEfficiencyTrends(supabase, companyId, startDate)
    
    // 季節別パフォーマンス
    const seasonalPerformance = await getSeasonalPerformance(supabase, companyId)
    
    // 野菜別パフォーマンス
    const vegetablePerformance = await getVegetablePerformance(supabase, companyId, startDate)
    
    // 最近のアクティビティ
    const recentActivities = await getRecentActivities(supabase, companyId)

    return NextResponse.json({
      success: true,
      data: {
        summary,
        harvest_analysis: harvestAnalysis,
        cost_analysis: costAnalysis,
        efficiency_trends: efficiencyTrends,
        seasonal_performance: seasonalPerformance,
        vegetable_performance: vegetablePerformance,
        recent_activities: recentActivities
      }
    })

  } catch (error) {
    
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

// 実際の作業コスト計算関数
async function calculateOperationCosts(supabase: any, companyId: string, startDate: Date): Promise<number> {
  try {
    const { data: operationLogs } = await supabase
      .from('operation_logs')
      .select(`
        work_type,
        work_hours,
        worker_count,
        fertilizer_type,
        fertilizer_qty,
        vegetable:vegetables!inner(company_id)
      `)
      .eq('vegetables.company_id', companyId)
      .gte('date', startDate.toISOString())

    // 作業種別ごとの標準コスト（円/時間）
    const laborCostPerHour: { [key: string]: number } = {
      'seeding': 1200,      // 播種：1200円/時間
      'planting': 1000,     // 定植：1000円/時間
      'fertilizing': 800,   // 施肥：800円/時間
      'watering': 600,      // 水やり：600円/時間
      'weeding': 900,       // 除草：900円/時間
      'pruning': 1100,      // 剪定：1100円/時間
      'harvesting': 1500,   // 収穫：1500円/時間
      'other': 800          // その他：800円/時間
    }

    // 肥料コスト（円/kg）
    const fertilizerCostPerKg: { [key: string]: number } = {
      '化成肥料': 150,
      '有機肥料': 200,
      '堆肥': 50,
      'default': 120
    }

    return operationLogs?.reduce((totalCost: number, log: any) => {
      // 労働コスト計算
      const workHours = log.work_hours || 1
      const workerCount = log.worker_count || 1
      const hourlyRate = laborCostPerHour[log.work_type] || laborCostPerHour['other']
      const laborCost = workHours * workerCount * hourlyRate

      // 肥料コスト計算
      const fertilizerQty = log.fertilizer_qty || 0
      const fertilizerRate = fertilizerCostPerKg[log.fertilizer_type] || fertilizerCostPerKg['default']
      const materialCost = fertilizerQty * fertilizerRate

      return totalCost + laborCost + materialCost
    }, 0) || 0

  } catch (error) {
    
    return 0
  }
}

// サマリー統計の取得
async function getSummaryStats(supabase: any, companyId: string, startDate: Date, vegetableId?: string, plotName?: string) {
  try {
    // 野菜データの取得
    let vegetableQuery = supabase
      .from('vegetables')
      .select('*')
      .eq('company_id', companyId)
      .gte('created_at', startDate.toISOString())

    if (vegetableId && vegetableId !== 'all') {
      vegetableQuery = vegetableQuery.eq('id', vegetableId)
    }

    if (plotName && plotName !== 'all') {
      vegetableQuery = vegetableQuery.ilike('plot_name', `%${plotName}%`)
    }

    const { data: vegetables } = await vegetableQuery

    // 収穫データの取得（フィールド名修正）
    const { data: harvestReports } = await supabase
      .from('operation_logs')
      .select(`
        *,
        vegetable:vegetables!inner(*)
      `)
      .eq('vegetables.company_id', companyId)
      .eq('work_type', 'harvesting')
      .gte('date', startDate.toISOString())

    // タスクデータの取得（テーブル名修正）
    const { data: tasks } = await supabase
      .from('growing_tasks')
      .select(`
        *,
        vegetable:vegetables!inner(*)
      `)
      .eq('vegetables.company_id', companyId)
      .gte('created_at', startDate.toISOString())

    // デバッグ用ログ
    
    if (harvestReports && harvestReports.length > 0) {
      
    }

    // 正確な収穫データ集計
    const totalHarvest = harvestReports?.reduce((sum: number, report: any) => {
      return sum + (report.harvest_qty || 0)
    }, 0) || 0

    // 実際の売上計算（収穫量 × 市場価格）
    const totalRevenue = harvestReports?.reduce((sum: number, report: any) => {
      const harvestAmount = report.harvest_qty || 0
      const marketPrice = getVegetablePrice(report.vegetable?.name || '')
      return sum + (harvestAmount * marketPrice)
    }, 0) || 0

    // コスト分析（作業種別ごとの実コスト）
    const totalCost = await calculateOperationCosts(supabase, companyId, startDate)
    
    

    const totalPlotSize = vegetables?.reduce((sum: number, v: any) => sum + (v.plot_size || 0), 0) || 1
    const avgYieldPerSqm = totalHarvest / totalPlotSize

    const activePlots = vegetables?.filter((v: any) => v.status === 'growing').length || 0
    const completedHarvests = vegetables?.filter((v: any) => v.status === 'completed').length || 0

    const totalTasks = tasks?.length || 0
    const completedTasks = tasks?.filter((t: any) => t.status === 'completed').length || 0
    const efficiencyScore = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

    const profitMargin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0

    return {
      total_revenue: totalRevenue,
      total_cost: totalCost,
      profit_margin: profitMargin,
      total_harvest: totalHarvest,
      avg_yield_per_sqm: avgYieldPerSqm,
      active_plots: activePlots,
      completed_harvests: completedHarvests,
      efficiency_score: efficiencyScore
    }
  } catch (error) {
    
    return {
      total_revenue: 0,
      total_cost: 0,
      profit_margin: 0,
      total_harvest: 0,
      avg_yield_per_sqm: 0,
      active_plots: 0,
      completed_harvests: 0,
      efficiency_score: 0
    }
  }
}

// 収穫分析データの取得
async function getHarvestAnalysis(supabase: any, companyId: string, startDate: Date, period: string) {
  try {
    const { data: harvestData } = await supabase
      .from('operation_logs')
      .select(`
        date,
        harvest_qty,
        harvest_unit,
        harvest_quality,
        vegetable:vegetables!inner(company_id, name, variety_name)
      `)
      .eq('vegetables.company_id', companyId)
      .eq('work_type', 'harvesting')
      .gte('date', startDate.toISOString())
      .order('date')

    // 月別収穫データの詳細集計
    const monthlyData: { [key: string]: { total: number, premium: number, good: number, fair: number } } = {}
    
    harvestData?.forEach((record: any) => {
      const date = new Date(record.date)
      const monthLabel = `${date.getMonth() + 1}月`
      
      if (!monthlyData[monthLabel]) {
        monthlyData[monthLabel] = { total: 0, premium: 0, good: 0, fair: 0 }
      }
      
      const harvestAmount = record.harvest_qty || 0
      monthlyData[monthLabel].total += harvestAmount
      
      // 品質別分類
      const quality = record.harvest_quality || 'good'
      if (quality === 'premium' || quality === 'excellent') {
        monthlyData[monthLabel].premium += harvestAmount
      } else if (quality === 'good') {
        monthlyData[monthLabel].good += harvestAmount
      } else {
        monthlyData[monthLabel].fair += harvestAmount
      }
    })

    return Object.entries(monthlyData).map(([label, data]) => ({
      label,
      value: data.total,
      premium: data.premium,
      good: data.good,
      fair: data.fair,
      color: 'bg-green-500'
    }))
  } catch (error) {
    
    return []
  }
}

// コスト分析データの取得（実コスト計算）
async function getCostAnalysis(supabase: any, companyId: string, startDate: Date) {
  try {
    const { data: operationData } = await supabase
      .from('operation_logs')
      .select(`
        work_type,
        work_hours,
        worker_count,
        fertilizer_type,
        fertilizer_qty,
        date,
        vegetable:vegetables!inner(company_id, name)
      `)
      .eq('vegetables.company_id', companyId)
      .gte('date', startDate.toISOString())

    // 作業種別ごとの標準コスト設定
    const laborCostPerHour: { [key: string]: number } = {
      'seeding': 1200, 'planting': 1000, 'fertilizing': 800,
      'watering': 600, 'weeding': 900, 'pruning': 1100,
      'harvesting': 1500, 'other': 800
    }

    const fertilizerCostPerKg: { [key: string]: number } = {
      '化成肥料': 150, '有機肥料': 200, '堆肥': 50, 'default': 120
    }

    // 詳細なコスト分析
    const costAnalysis: { [key: string]: { labor: number, material: number, total: number, count: number } } = {}
    
    operationData?.forEach((record: any) => {
      const workType = record.work_type || 'other'
      
      if (!costAnalysis[workType]) {
        costAnalysis[workType] = { labor: 0, material: 0, total: 0, count: 0 }
      }
      
      // 労働コスト計算
      const workHours = record.work_hours || 1
      const workerCount = record.worker_count || 1
      const hourlyRate = laborCostPerHour[workType] || laborCostPerHour['other']
      const laborCost = workHours * workerCount * hourlyRate
      
      // 材料費計算（肥料など）
      const materialCost = workType === 'fertilizing' 
        ? (record.fertilizer_qty || 0) * (fertilizerCostPerKg[record.fertilizer_type] || fertilizerCostPerKg['default'])
        : 0
      
      costAnalysis[workType].labor += laborCost
      costAnalysis[workType].material += materialCost
      costAnalysis[workType].total += laborCost + materialCost
      costAnalysis[workType].count += 1
    })

    // 作業種別ラベルマッピング
    const typeLabels: { [key: string]: string } = {
      'seeding': '播種・育苗',
      'planting': '定植',
      'fertilizing': '施肥',
      'watering': '水やり',
      'weeding': '除草',
      'pruning': '剪定・整枝',
      'harvesting': '収穫',
      'other': 'その他'
    }

    return Object.entries(costAnalysis)
      .map(([type, costs]) => ({
        label: typeLabels[type] || type,
        value: Math.round(costs.total),
        laborCost: Math.round(costs.labor),
        materialCost: Math.round(costs.material),
        operationCount: costs.count,
        avgCostPerOperation: costs.count > 0 ? Math.round(costs.total / costs.count) : 0,
        color: getCostCategoryColor(type)
      }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value)

  } catch (error) {
    
    return []
  }
}

// コスト分類別の色分け関数
function getCostCategoryColor(workType: string): string {
  const colors: { [key: string]: string } = {
    'seeding': 'bg-amber-500',      // 播種：オレンジ系
    'planting': 'bg-green-500',     // 定植：緑系
    'fertilizing': 'bg-purple-500', // 施肥：紫系
    'watering': 'bg-blue-500',      // 水やり：青系
    'weeding': 'bg-red-500',        // 除草：赤系
    'pruning': 'bg-indigo-500',     // 剪定：藍系
    'harvesting': 'bg-emerald-500', // 収穫：エメラルド系
    'other': 'bg-gray-500'          // その他：グレー系
  }
  return colors[workType] || 'bg-gray-500'
}

// 効率性トレンドの取得
async function getEfficiencyTrends(supabase: any, companyId: string, startDate: Date) {
  try {
    const { data: taskData } = await supabase
      .from('growing_tasks')
      .select(`
        created_at,
        status,
        estimated_hours,
        actual_hours,
        vegetable:vegetables!inner(company_id)
      `)
      .eq('vegetables.company_id', companyId)
      .gte('created_at', startDate.toISOString())
      .order('created_at')

    // 月別効率スコア計算
    const monthlyEfficiency: { [key: string]: { total: number, completed: number } } = {}
    
    taskData?.forEach((task: any) => {
      const date = new Date(task.created_at)
      const monthLabel = `${date.getMonth() + 1}月`
      
      if (!monthlyEfficiency[monthLabel]) {
        monthlyEfficiency[monthLabel] = { total: 0, completed: 0 }
      }
      
      monthlyEfficiency[monthLabel].total++
      if (task.status === 'completed') {
        monthlyEfficiency[monthLabel].completed++
      }
    })

    return Object.entries(monthlyEfficiency).map(([label, data]) => ({
      label,
      value: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0
    }))
  } catch (error) {
    
    return []
  }
}

// 季節別パフォーマンスの取得
async function getSeasonalPerformance(supabase: any, companyId: string) {
  try {
    const { data: seasonalData } = await supabase
      .from('operation_logs')
      .select(`
        date,
        harvest_qty,
        harvest_unit,
        vegetable:vegetables!inner(company_id, name)
      `)
      .eq('vegetables.company_id', companyId)
      .eq('work_type', 'harvesting')

    const seasonalStats: { [key: string]: { harvest: number, operations: number, vegetables: Set<string> } } = {
      '春': { harvest: 0, operations: 0, vegetables: new Set() },
      '夏': { harvest: 0, operations: 0, vegetables: new Set() },
      '秋': { harvest: 0, operations: 0, vegetables: new Set() },
      '冬': { harvest: 0, operations: 0, vegetables: new Set() }
    }

    seasonalData?.forEach((record: any) => {
      const date = new Date(record.date)
      const month = date.getMonth() + 1
      
      let season = '春'
      if (month >= 6 && month <= 8) season = '夏'
      else if (month >= 9 && month <= 11) season = '秋'
      else if (month === 12 || month <= 2) season = '冬'
      
      const harvestAmount = record.harvest_qty || 0
      seasonalStats[season].harvest += harvestAmount
      seasonalStats[season].operations += 1
      seasonalStats[season].vegetables.add(record.vegetable?.name || '不明')
    })

    return Object.entries(seasonalStats).map(([label, stats]) => ({
      label,
      value: Math.round(stats.harvest * 10) / 10, // 小数点1桁で四捨五入
      operations: stats.operations,
      varietyCount: stats.vegetables.size,
      avgHarvestPerOperation: stats.operations > 0 ? Math.round((stats.harvest / stats.operations) * 10) / 10 : 0,
      color: {
        '春': 'bg-pink-500',
        '夏': 'bg-red-500', 
        '秋': 'bg-orange-500',
        '冬': 'bg-blue-500'
      }[label]
    }))
  } catch (error) {
    
    return []
  }
}

// 野菜別パフォーマンスの取得
async function getVegetablePerformance(supabase: any, companyId: string, startDate: Date) {
  try {
    const { data: vegetables } = await supabase
      .from('vegetables')
      .select(`
        *,
        harvest_logs:operation_logs!vegetable_id(
          harvest_qty,
          harvest_unit,
          harvest_quality,
          work_hours,
          worker_count,
          fertilizer_qty,
          fertilizer_type,
          date,
          work_type
        )
      `)
      .eq('company_id', companyId)
      .gte('created_at', startDate.toISOString())

    return vegetables?.map((vegetable: any) => {
      // 収穫データの集計
      const harvestLogs = vegetable.harvest_logs?.filter((log: any) => log.work_type === 'harvesting') || []
      const allOperationLogs = vegetable.harvest_logs || []
      
      const totalHarvest = harvestLogs.reduce((sum: number, log: any) => sum + (log.harvest_qty || 0), 0)
      
      // 品質別収穫量
      const qualityBreakdown = {
        premium: 0, good: 0, fair: 0
      }
      harvestLogs.forEach((log: any) => {
        const amount = log.harvest_qty || 0
        const quality = log.harvest_quality || 'good'
        if (quality === 'premium' || quality === 'excellent') {
          qualityBreakdown.premium += amount
        } else if (quality === 'good') {
          qualityBreakdown.good += amount
        } else {
          qualityBreakdown.fair += amount
        }
      })
      
      // コスト計算（実際の作業ログから）
      const totalCost = calculateVegetableCost(allOperationLogs)
      
      // 売上計算（品質別価格を適用）
      const basePrice = getVegetablePrice(vegetable.name)
      const revenue = (qualityBreakdown.premium * basePrice * 1.3) + // プレミアム品は30%増し
                    (qualityBreakdown.good * basePrice) + 
                    (qualityBreakdown.fair * basePrice * 0.8) // 並品は20%減
      
      const profit = revenue - totalCost
      const area = vegetable.area_size || 1
      const yieldPerSqm = totalHarvest / area
      const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0
      
      // パフォーマンス評価
      let status = 'average'
      if (roi > 150) status = 'excellent'
      else if (roi > 100) status = 'good'
      else if (roi < 50) status = 'poor'

      return {
        id: vegetable.id,
        name: vegetable.name,
        variety: vegetable.variety_name,
        plot_name: vegetable.plot_name,
        area_size: area,
        harvest_amount: Math.round(totalHarvest * 10) / 10,
        quality_breakdown: qualityBreakdown,
        revenue: Math.round(revenue),
        cost: Math.round(totalCost),
        profit: Math.round(profit),
        yield_per_sqm: Math.round(yieldPerSqm * 10) / 10,
        roi: Math.round(roi * 10) / 10,
        harvest_operations: harvestLogs.length,
        total_operations: allOperationLogs.length,
        status
      }
    })
    .filter(item => item.harvest_amount > 0) // 収穫実績があるもののみ
    .sort((a, b) => b.roi - a.roi) || [] // ROI順でソート

  } catch (error) {
    
    return []
  }
}

// 野菜別コスト計算関数
function calculateVegetableCost(operationLogs: any[]): number {
  const laborCostPerHour: { [key: string]: number } = {
    'seeding': 1200, 'planting': 1000, 'fertilizing': 800,
    'watering': 600, 'weeding': 900, 'pruning': 1100,
    'harvesting': 1500, 'other': 800
  }

  const fertilizerCostPerKg: { [key: string]: number } = {
    '化成肥料': 150, '有機肥料': 200, '堆肥': 50, 'default': 120
  }

  return operationLogs.reduce((totalCost: number, log: any) => {
    // 労働コスト
    const workHours = log.work_hours || 1
    const workerCount = log.worker_count || 1
    const hourlyRate = laborCostPerHour[log.work_type] || laborCostPerHour['other']
    const laborCost = workHours * workerCount * hourlyRate

    // 材料費
    const materialCost = log.work_type === 'fertilizing' 
      ? (log.fertilizer_qty || 0) * (fertilizerCostPerKg[log.fertilizer_type] || fertilizerCostPerKg['default'])
      : 0

    return totalCost + laborCost + materialCost
  }, 0)
}

// 最近のアクティビティの取得
async function getRecentActivities(supabase: any, companyId: string) {
  try {
    const { data: activities } = await supabase
      .from('operation_logs')
      .select(`
        *,
        vegetable:vegetables!inner(name, variety_name, company_id, plot_name)
      `)
      .eq('vegetables.company_id', companyId)
      .order('date', { ascending: false })
      .limit(10)

    return activities?.map((activity: any) => {
      // 作業タイプに応じた詳細情報
      let value = 0
      let unit = ''
      let description = activity.work_notes || ''
      
      switch (activity.work_type) {
        case 'harvesting':
          value = activity.harvest_qty || 0
          unit = activity.harvest_unit || 'kg'
          if (!description) description = `収穫量: ${value}${unit} (品質: ${activity.harvest_quality || '良'})`
          break
        case 'fertilizing':
          value = activity.fertilizer_qty || 0
          unit = 'kg'
          if (!description) description = `施肥量: ${value}${unit} (種類: ${activity.fertilizer_type || '化成肥料'})`
          break
        case 'watering':
          value = activity.work_hours || 1
          unit = '時間'
          if (!description) description = `水やり作業 ${value}${unit}`
          break
        default:
          value = activity.work_hours || 1
          unit = '時間'
          if (!description) description = `${getWorkTypeLabel(activity.work_type)}作業 ${value}${unit}`
      }

      return {
        id: activity.id,
        type: getActivityType(activity.work_type),
        title: getActivityTitle(activity.work_type, activity.vegetable?.name),
        description,
        value: Math.round(value * 10) / 10,
        unit,
        vegetable: {
          name: activity.vegetable?.name,
          variety: activity.vegetable?.variety_name,
          plot: activity.vegetable?.plot_name
        },
        timestamp: activity.date,
        workType: activity.work_type
      }
    }) || []
  } catch (error) {
    
    return []
  }
}

// ====================================================================
// ヘルパー関数群
// ====================================================================

// 野菜別市場価格（円/kg）
function getVegetablePrice(vegetableName: string): number {
  const prices: { [key: string]: number } = {
    'トマト': 650,           // トマト：650円/kg
    'A棟トマト（桃太郎）': 650,
    'レタス': 400,           // レタス：400円/kg
    '露地レタス（春作）': 400,
    'キュウリ': 500,         // キュウリ：500円/kg
    'B棟キュウリ（四葉）': 500,
    'ナス': 600,             // ナス：600円/kg
    'C棟ナス（千両二号）': 600,
    'ピーマン': 550,         // ピーマン：550円/kg
    'キャベツ': 250,         // キャベツ：250円/kg
    'ダイコン': 200,         // ダイコン：200円/kg
    'ニンジン': 300,         // ニンジン：300円/kg
    'ホウレンソウ': 800,     // ホウレンソウ：800円/kg
    'コマツナ': 700          // コマツナ：700円/kg
  }
  
  // 部分一致検索
  for (const [key, price] of Object.entries(prices)) {
    if (vegetableName.includes(key) || key.includes(vegetableName)) {
      return price
    }
  }
  
  return 450 // デフォルト価格
}

// 作業種別ラベル取得
function getWorkTypeLabel(workType: string): string {
  const labels: { [key: string]: string } = {
    'seeding': '播種・育苗',
    'planting': '定植',
    'fertilizing': '施肥',
    'watering': '水やり',
    'weeding': '除草',
    'pruning': '剪定・整枝',
    'harvesting': '収穫',
    'maintenance': 'メンテナンス',
    'other': 'その他'
  }
  return labels[workType] || workType
}

// アクティビティタイプ分類
function getActivityType(workType: string): 'harvest' | 'efficiency' | 'cost' | 'maintenance' | 'alert' {
  switch (workType) {
    case 'harvesting':
      return 'harvest'
    case 'maintenance':
    case 'pruning':
      return 'maintenance'
    case 'seeding':
    case 'planting':
      return 'efficiency'
    case 'fertilizing':
    case 'watering':
    case 'weeding':
      return 'cost'
    default:
      return 'cost'
  }
}

// アクティビティタイトル生成
function getActivityTitle(workType: string, vegetableName: string): string {
  const workLabel = getWorkTypeLabel(workType)
  const vegName = vegetableName || '作物'
  
  switch (workType) {
    case 'harvesting':
      return `${vegName}の収穫作業`
    case 'fertilizing':
      return `${vegName}の施肥作業`
    case 'watering':
      return `${vegName}への水やり`
    case 'weeding':
      return `${vegName}の除草作業`
    case 'pruning':
      return `${vegName}の剪定・整枝`
    case 'seeding':
      return `${vegName}の播種作業`
    case 'planting':
      return `${vegName}の定植作業`
    default:
      return `${vegName}の${workLabel}作業`
  }
}

// CSV/Excelエクスポート用エンドポイント
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { format, data_type, company_id } = body

    if (!company_id) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 })
    }

    // 実装: CSVまたはExcelファイルの生成
    // 実際の実装では、適切なライブラリを使用してファイルを生成

    return NextResponse.json({
      success: true,
      message: `${format.toUpperCase()} export initiated`,
      download_url: `/api/download/${data_type}.${format}` // 仮のダウンロードURL
    })

  } catch (error) {
    
    return NextResponse.json(
      { error: 'Export failed' }, 
      { status: 500 }
    )
  }
}