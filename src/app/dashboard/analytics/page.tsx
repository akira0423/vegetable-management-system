'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { analyticsDataSync } from '@/lib/analytics-data-sync'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Sprout,
  Calendar,
  Download,
  FileSpreadsheet,
  PieChart,
  Activity,
  Target,
  Zap,
  Users,
  MapPin,
  Clock,
  Award,
  AlertTriangle,
  Eye,
  RefreshCw
} from 'lucide-react'
import DataExportDialog from '@/components/data-export-dialog'

// チャートコンポーネント（シンプルなCSS実装）
interface ChartData {
  label: string
  value: number
  color?: string
}

const SimpleBarChart = ({ data, height = 200, title }: { data: ChartData[], height?: number, title?: string }) => {
  const maxValue = Math.max(...data.map(d => d.value))
  
  return (
    <div className="space-y-2">
      {title && <h4 className="text-sm font-medium text-gray-700">{title}</h4>}
      <div className="flex items-end space-x-2" style={{ height }}>
        {data.map((item, index) => (
          <div key={index} className="flex flex-col items-center space-y-1 flex-1">
            <div className="w-full bg-gray-100 rounded-t flex items-end justify-center relative">
              <div
                className={`w-full rounded-t transition-all duration-500 flex items-end justify-center text-xs font-medium text-white ${
                  item.color || 'bg-green-500'
                }`}
                style={{
                  height: `${(item.value / maxValue) * (height - 40)}px`,
                  minHeight: item.value > 0 ? '20px' : '2px'
                }}
              >
                {item.value > 0 && <span className="pb-1">{item.value}</span>}
              </div>
            </div>
            <span className="text-xs text-gray-600 text-center">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const SimpleLineChart = ({ data, height = 200, title }: { data: ChartData[], height?: number, title?: string }) => {
  const maxValue = Math.max(...data.map(d => d.value))
  const minValue = Math.min(...data.map(d => d.value))
  const range = maxValue - minValue || 1
  
  return (
    <div className="space-y-2">
      {title && <h4 className="text-sm font-medium text-gray-700">{title}</h4>}
      <div className="relative" style={{ height }}>
        <div className="absolute inset-0 border border-gray-200 rounded bg-gray-50">
          <svg width="100%" height="100%" className="overflow-visible">
            <polyline
              fill="none"
              stroke="#10b981"
              strokeWidth="3"
              points={data.map((item, index) => {
                const x = (index / (data.length - 1)) * 100
                const y = 100 - ((item.value - minValue) / range) * 80
                return `${x}%,${y}%`
              }).join(' ')}
            />
            {data.map((item, index) => {
              const x = (index / (data.length - 1)) * 100
              const y = 100 - ((item.value - minValue) / range) * 80
              return (
                <circle
                  key={index}
                  cx={`${x}%`}
                  cy={`${y}%`}
                  r="4"
                  fill="#10b981"
                  stroke="white"
                  strokeWidth="2"
                />
              )
            })}
          </svg>
        </div>
        <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-600 pt-2">
          {data.map((item, index) => (
            <span key={index} className="text-center">{item.label}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

interface AnalyticsData {
  summary: {
    total_revenue: number
    total_cost: number
    profit_margin: number
    total_harvest: number
    avg_yield_per_sqm: number
    active_plots: number
    completed_harvests: number
    efficiency_score: number
  }
  harvest_analysis: ChartData[]
  cost_analysis: ChartData[]
  efficiency_trends: ChartData[]
  seasonal_performance: ChartData[]
  work_frequency?: ChartData[] // 作業频度データを追加
  vegetable_performance: Array<{
    name: string
    variety: string
    plot_size: number
    harvest_amount: number
    revenue: number
    cost: number
    profit: number
    yield_per_sqm: number
    roi: number
    status: 'excellent' | 'good' | 'average' | 'poor'
  }>
  recent_activities: Array<{
    id: string
    type: 'harvest' | 'cost' | 'efficiency' | 'alert'
    title: string
    description: string
    value?: number
    timestamp: string
  }>
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('3months')
  const [selectedVegetable, setSelectedVegetable] = useState('all')
  const [selectedPlot, setSelectedPlot] = useState('all')
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [autoRefresh, setAutoRefresh] = useState(true)

  // サンプルデータ
  const sampleData: AnalyticsData = {
    summary: {
      total_revenue: 1250000,
      total_cost: 780000,
      profit_margin: 37.6,
      total_harvest: 2840,
      avg_yield_per_sqm: 8.5,
      active_plots: 12,
      completed_harvests: 8,
      efficiency_score: 87
    },
    harvest_analysis: [
      { label: '6月', value: 320, color: 'bg-green-500' },
      { label: '7月', value: 480, color: 'bg-green-600' },
      { label: '8月', value: 650, color: 'bg-green-700' },
      { label: '9月', value: 590, color: 'bg-green-600' },
      { label: '10月', value: 420, color: 'bg-green-500' },
      { label: '11月', value: 380, color: 'bg-green-400' }
    ],
    cost_analysis: [
      { label: '種苗費', value: 180000, color: 'bg-blue-500' },
      { label: '肥料費', value: 220000, color: 'bg-blue-600' },
      { label: '農薬費', value: 95000, color: 'bg-blue-400' },
      { label: '人件費', value: 285000, color: 'bg-blue-700' }
    ],
    efficiency_trends: [
      { label: '6月', value: 78 },
      { label: '7月', value: 82 },
      { label: '8月', value: 85 },
      { label: '9月', value: 87 },
      { label: '10月', value: 89 },
      { label: '11月', value: 87 }
    ],
    seasonal_performance: [
      { label: '春', value: 2.1, color: 'bg-pink-500' },
      { label: '夏', value: 3.8, color: 'bg-red-500' },
      { label: '秋', value: 3.2, color: 'bg-orange-500' },
      { label: '冬', value: 1.9, color: 'bg-blue-500' }
    ],
    vegetable_performance: [
      {
        name: 'トマト',
        variety: '桃太郎',
        plot_size: 100,
        harvest_amount: 850,
        revenue: 425000,
        cost: 180000,
        profit: 245000,
        yield_per_sqm: 8.5,
        roi: 136.1,
        status: 'excellent'
      },
      {
        name: 'レタス',
        variety: 'グリーンリーフ',
        plot_size: 50,
        harvest_amount: 320,
        revenue: 192000,
        cost: 85000,
        profit: 107000,
        yield_per_sqm: 6.4,
        roi: 125.9,
        status: 'excellent'
      },
      {
        name: 'キュウリ',
        variety: '夏すずみ',
        plot_size: 80,
        harvest_amount: 640,
        revenue: 256000,
        cost: 125000,
        profit: 131000,
        yield_per_sqm: 8.0,
        roi: 104.8,
        status: 'good'
      },
      {
        name: 'ナス',
        variety: '千両',
        plot_size: 60,
        harvest_amount: 380,
        revenue: 190000,
        cost: 110000,
        profit: 80000,
        yield_per_sqm: 6.3,
        roi: 72.7,
        status: 'average'
      }
    ],
    recent_activities: [
      {
        id: '1',
        type: 'harvest',
        title: 'トマト大豊作',
        description: 'A区画-1のトマト（桃太郎）が予想を20%上回る収穫量',
        value: 850,
        timestamp: '2024-08-09T10:00:00Z'
      },
      {
        id: '2',
        type: 'efficiency',
        title: '作業効率向上',
        description: '前月比で作業効率が5%改善しました',
        value: 87,
        timestamp: '2024-08-08T15:30:00Z'
      },
      {
        id: '3',
        type: 'cost',
        title: 'コスト削減達成',
        description: '肥料費を前月比12%削減できました',
        value: 220000,
        timestamp: '2024-08-07T09:15:00Z'
      }
    ]
  }

  useEffect(() => {
    fetchAnalyticsData()
  }, [dateRange, selectedVegetable, selectedPlot])

  // リアルタイムデータ同期リスナー
  const handleAnalyticsUpdate = useCallback((updateData: any) => {
    console.log('リアルタイムデータ更新:', updateData)
    
    // 既存データとマージ
    if (data && updateData.metrics) {
      const updatedData = {
        ...data,
        summary: {
          ...data.summary,
          total_revenue: data.summary.total_revenue + (updateData.data.expected_revenue || 0),
          total_cost: data.summary.total_cost + (updateData.data.estimated_cost || 0),
          total_harvest: data.summary.total_harvest + (updateData.data.harvest_amount || 0)
        },
        recent_activities: [
          {
            id: `activity_${Date.now()}`,
            type: updateData.data.work_type === 'harvesting' ? 'harvest' as const : 'cost' as const,
            title: `新しい${updateData.data.work_type}作業が完了`,
            description: updateData.data.work_notes || '作業が追加されました',
            value: updateData.data.expected_revenue || updateData.data.estimated_cost || updateData.data.harvest_amount,
            timestamp: updateData.timestamp
          },
          ...data.recent_activities.slice(0, 4) // 最新5件まで保持
        ]
      }
      setData(updatedData)
      setLastUpdated(new Date())
    }
  }, [data])

  useEffect(() => {
    // リアルタイム同期リスナー登録
    analyticsDataSync.addListener(handleAnalyticsUpdate)
    
    return () => {
      // クリーンアップ
      analyticsDataSync.removeListener(handleAnalyticsUpdate)
    }
  }, [handleAnalyticsUpdate])

  // 自動更新機能（5分ごと）
  useEffect(() => {
    if (!autoRefresh) return
    
    const interval = setInterval(() => {
      fetchAnalyticsData()
      console.log('分析データが自動更新されました')
    }, 5 * 60 * 1000) // 5分ごと
    
    return () => clearInterval(interval)
  }, [autoRefresh, dateRange, selectedVegetable, selectedPlot])

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true)
      
      // 作業レポートデータと野菜データを並行取得
      const [reportsResponse, vegetablesResponse, ganttResponse] = await Promise.all([
        fetch(`/api/reports?company_id=a1111111-1111-1111-1111-111111111111&limit=200`),
        fetch(`/api/gantt?company_id=a1111111-1111-1111-1111-111111111111&start_date=2024-01-01&end_date=2025-12-31`),
        fetch(`/api/gantt?company_id=a1111111-1111-1111-1111-111111111111&start_date=2024-01-01&end_date=2025-12-31`)
      ])
      
      let workReports = []
      let vegetables = []
      let tasks = []
      
      // 作業レポートデータの取得
      if (reportsResponse.ok) {
        const reportsResult = await reportsResponse.json()
        if (reportsResult.success) {
          workReports = reportsResult.data
        }
      }
      
      // 野菜データの取得
      if (vegetablesResponse.ok) {
        const vegetablesResult = await vegetablesResponse.json()
        if (vegetablesResult.success && vegetablesResult.data.vegetables) {
          vegetables = vegetablesResult.data.vegetables
        }
      }
      
      // タスクデータの取得
      if (ganttResponse.ok) {
        const ganttResult = await ganttResponse.json()
        if (ganttResult.success && ganttResult.data.tasks) {
          tasks = ganttResult.data.tasks
        }
      }
      
      // データが取得できない場合は空状態を維持
      console.log('📊 分析データ取得結果:', {
        作業レポート数: workReports.length,
        野菜データ数: vegetables.length,
        タスクデータ数: tasks.length
      })
      
      // 作業レポートから分析データを生成
      if (workReports.length > 0 || vegetables.length > 0) {
        const analyticsFromReports = generateDetailedAnalyticsFromReports(workReports, vegetables)
        const mergedData = mergeAnalyticsData(sampleData, analyticsFromReports)
        setData(mergedData)
      } else {
        // データがない場合は null を設定（空状態表示用）
        setData(null)
      }
      setLastUpdated(new Date())
      setLoading(false)
      
    } catch (error) {
      console.error('分析データの取得エラー:', error)
      // エラー時は空状態を表示
      setData(null)
      setLastUpdated(new Date())
      setLoading(false)
    }
  }

  // 作業レポートから詳細分析データを生成
  const generateDetailedAnalyticsFromReports = (reports: any[], vegetables: any[]) => {
    // 実際のデータのみを使用（サンプルデータは使用しない）
    if (!reports || reports.length === 0) {
      // データがない場合は空の分析結果を返す
      return {
        harvestByMonth: {},
        costByType: {},
        workFrequency: {},
        vegetablePerformance: [],
        totalRevenue: 0,
        totalCost: 0,
        totalHarvest: 0,
        profitMargin: 0,
        recentActivities: []
      }
    }

    // 月別収穫量データ生成（年跨ぎ対応）
    const harvestByMonth = reports
      .filter(r => r.work_type === 'harvesting' && r.harvest_amount)
      .reduce((acc: any, report) => {
        const date = new Date(report.work_date)
        const month = date.getMonth() + 1
        const monthKey = `${month}月`
        acc[monthKey] = (acc[monthKey] || 0) + report.harvest_amount
        return acc
      }, {})

    // 作業種別コスト分析データ生成
    const costByType = reports
      .filter(r => r.estimated_cost)
      .reduce((acc: any, report) => {
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
        acc[label] = (acc[label] || 0) + report.estimated_cost
        return acc
      }, {})

    // 作業種別频度分析
    const workFrequency = reports.reduce((acc: any, report) => {
      const typeLabels: any = {
        seeding: '播種',
        planting: '定植',
        fertilizing: '施肥',
        watering: '灌水',
        weeding: '除草',
        pruning: '整枝',
        harvesting: '収穫',
        other: 'その他'
      }
      const label = typeLabels[report.work_type] || 'その他'
      acc[label] = (acc[label] || 0) + 1
      return acc
    }, {})

    // 野菜別パフォーマンス分析
    const vegetablePerformance = vegetables.map((veg: any) => {
      const vegReports = reports.filter(r => r.vegetable_id === veg.id)
      const totalRevenue = vegReports
        .filter(r => r.expected_revenue)
        .reduce((sum, r) => sum + r.expected_revenue, 0)
      const totalCost = vegReports
        .filter(r => r.estimated_cost)
        .reduce((sum, r) => sum + r.estimated_cost, 0)
      const totalHarvest = vegReports
        .filter(r => r.harvest_amount)
        .reduce((sum, r) => sum + r.harvest_amount, 0)
      
      const profit = totalRevenue - totalCost
      const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0
      
      let status: 'excellent' | 'good' | 'average' | 'poor' = 'average'
      if (roi > 120) status = 'excellent'
      else if (roi > 80) status = 'good'
      else if (roi < 50) status = 'poor'
      
      return {
        name: veg.name.split('（')[0] || veg.name, // 名前だけを抽出
        variety: veg.variety || veg.name.match(/（(.+?)）/)?.[1] || '',
        plot_size: 100, // デフォルト値
        harvest_amount: totalHarvest,
        revenue: totalRevenue,
        cost: totalCost,
        profit: profit,
        yield_per_sqm: totalHarvest / 100, // 100㎡あたり
        roi: roi,
        status: status
      }
    })

    // 売上・コスト・収穫総計
    const totalRevenue = reports
      .filter(r => r.expected_revenue)
      .reduce((sum, report) => sum + report.expected_revenue, 0)

    const totalCost = reports
      .filter(r => r.estimated_cost)
      .reduce((sum, report) => sum + report.estimated_cost, 0)

    const totalHarvest = reports
      .filter(r => r.harvest_amount)
      .reduce((sum, report) => sum + report.harvest_amount, 0)

    // 最近のアクティビティ生成
    const recentActivities = reports
      .slice(-5) // 最新5件
      .map((report, index) => {
        const vegetableName = vegetables.find(v => v.id === report.vegetable_id)?.name || '未知の野菜'
        const workTypeNames: any = {
          harvesting: '収穫',
          fertilizing: '施肥',
          pruning: '整枝',
          seeding: '播種',
          planting: '定植',
          watering: '灌水',
          weeding: '除草'
        }
        const workTypeName = workTypeNames[report.work_type] || report.work_type
        
        return {
          id: report.id || `act_${index}`,
          type: report.work_type === 'harvesting' ? 'harvest' as const : 'cost' as const,
          title: `${vegetableName}の${workTypeName}作業`,
          description: report.work_notes || `${workTypeName}作業を実施しました`,
          value: report.expected_revenue || report.estimated_cost || report.harvest_amount,
          timestamp: new Date(report.work_date).toISOString()
        }
      })
      .reverse() // 最新順に並び替え

    return {
      harvestByMonth,
      costByType,
      workFrequency,
      vegetablePerformance,
      totalRevenue,
      totalCost,
      totalHarvest,
      profitMargin: totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0,
      recentActivities
    }
  }

  // 分析データをマージ（データ整合性を確保）
  const mergeAnalyticsData = (baseData: AnalyticsData, reportsData: any) => {
    if (!reportsData) return baseData

    // 月別収穫量データを更新（実データ優先）
    const updatedHarvestAnalysis = Object.keys(reportsData.harvestByMonth).length > 0
      ? Object.entries(reportsData.harvestByMonth).map(([month, amount]) => ({
          label: month,
          value: Math.round((amount as number) * 10) / 10, // 小数点以下1桁に丸め
          color: 'bg-green-600'
        }))
      : baseData.harvest_analysis

    // コスト分析データを更新（実データ優先）
    const updatedCostAnalysis = Object.keys(reportsData.costByType).length > 0
      ? Object.entries(reportsData.costByType).map(([type, amount]) => ({
          label: type,
          value: Math.round(amount as number), // 円単位は整数に丸め
          color: 'bg-blue-600'
        }))
      : baseData.cost_analysis

    // 作業頻度データを更新（実データのみ）
    const workFrequencyData = Object.keys(reportsData.workFrequency || {}).length > 0
      ? Object.entries(reportsData.workFrequency).map(([type, count]) => ({
          label: type,
          value: count as number,
          color: 'bg-purple-600'
        }))
      : [] // 空配列を返す

    // サマリー情報の更新（数値の整合性を保証）
    const updatedSummary = {
      ...baseData.summary,
      total_revenue: Math.round(reportsData.totalRevenue || baseData.summary.total_revenue),
      total_cost: Math.round(reportsData.totalCost || baseData.summary.total_cost),
      profit_margin: Math.round((reportsData.profitMargin || baseData.summary.profit_margin) * 10) / 10,
      total_harvest: Math.round((reportsData.totalHarvest || baseData.summary.total_harvest) * 10) / 10,
      avg_yield_per_sqm: reportsData.totalHarvest 
        ? Math.round((reportsData.totalHarvest / 300) * 10) / 10 // 300㎡あたりの平均
        : baseData.summary.avg_yield_per_sqm,
      efficiency_score: Math.min(100, Math.max(60, 
        Math.round(75 + (reportsData.profitMargin || 0) / 5)
      )) // 利益率ベースの動的スコア
    }

    return {
      ...baseData,
      summary: updatedSummary,
      harvest_analysis: updatedHarvestAnalysis,
      cost_analysis: updatedCostAnalysis,
      vegetable_performance: reportsData.vegetablePerformance && reportsData.vegetablePerformance.length > 0
        ? reportsData.vegetablePerformance
        : baseData.vegetable_performance,
      recent_activities: reportsData.recentActivities && reportsData.recentActivities.length > 0
        ? reportsData.recentActivities
        : baseData.recent_activities,
      // 新しい作業频度データを追加
      work_frequency: workFrequencyData
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', { 
      style: 'currency', 
      currency: 'JPY',
      minimumFractionDigits: 0 
    }).format(amount)
  }

  const formatNumber = (num: number, decimals = 1) => {
    return new Intl.NumberFormat('ja-JP', { 
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals 
    }).format(num)
  }

  const getPerformanceColor = (status: string) => {
    const colors = {
      excellent: 'bg-green-100 text-green-700 border-green-200',
      good: 'bg-blue-100 text-blue-700 border-blue-200',
      average: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      poor: 'bg-red-100 text-red-700 border-red-200'
    }
    return colors[status as keyof typeof colors] || colors.average
  }

  const getPerformanceLabel = (status: string) => {
    const labels = {
      excellent: '優秀',
      good: '良好',
      average: '平均',
      poor: '要改善'
    }
    return labels[status as keyof typeof labels] || '平均'
  }


  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600 text-lg font-medium mb-2">登録情報がありません</p>
          <p className="text-gray-500 text-sm">野菜の登録や作業記録を作成すると、分析データが表示されます</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">レポート・分析</h1>
          <p className="text-gray-600">栽培データを分析して経営を最適化しましょう</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1month">1ヶ月</SelectItem>
              <SelectItem value="3months">3ヶ月</SelectItem>
              <SelectItem value="6months">6ヶ月</SelectItem>
              <SelectItem value="1year">1年間</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-500">
              最終更新: {lastUpdated.toLocaleTimeString('ja-JP')}
            </div>
            <Button
              variant={autoRefresh ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
              自動更新
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAnalyticsData}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              手動更新
            </Button>
          </div>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">売上高</p>
                <p className="text-2xl font-bold">{formatCurrency(data.summary.total_revenue)}</p>
                <p className="text-xs text-green-600 flex items-center mt-1">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  前期比 +15.2%
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">利益率</p>
                <p className="text-2xl font-bold">{formatNumber(data.summary.profit_margin)}%</p>
                <p className="text-xs text-green-600 flex items-center mt-1">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  前期比 +2.3%
                </p>
              </div>
              <Target className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">総収穫量</p>
                <p className="text-2xl font-bold">{formatNumber(data.summary.total_harvest, 0)}kg</p>
                <p className="text-xs text-gray-600 mt-1">
                  平均 {formatNumber(data.summary.avg_yield_per_sqm)}kg/㎡
                </p>
              </div>
              <Sprout className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">効率スコア</p>
                <p className="text-2xl font-bold">{data.summary.efficiency_score}</p>
                <p className="text-xs text-green-600 flex items-center mt-1">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  前期比 +4pts
                </p>
              </div>
              <Zap className="w-8 h-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* メインコンテンツタブ */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">概要</TabsTrigger>
          <TabsTrigger value="worklog">作業分析</TabsTrigger>
          <TabsTrigger value="harvest">収穫分析</TabsTrigger>
          <TabsTrigger value="financial">収益分析</TabsTrigger>
          <TabsTrigger value="efficiency">効率性</TabsTrigger>
          <TabsTrigger value="performance">パフォーマンス</TabsTrigger>
        </TabsList>

        {/* 概要タブ */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 収穫量推移 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  月別収穫量推移
                </CardTitle>
                <CardDescription>過去6ヶ月の収穫量変化</CardDescription>
              </CardHeader>
              <CardContent>
                <SimpleBarChart data={data.harvest_analysis} height={250} />
              </CardContent>
            </Card>

            {/* 効率性トレンド */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  作業効率トレンド
                </CardTitle>
                <CardDescription>月次効率スコアの変化</CardDescription>
              </CardHeader>
              <CardContent>
                <SimpleLineChart data={data.efficiency_trends} height={250} />
              </CardContent>
            </Card>
          </div>

          {/* 最近のアクティビティ */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                最近の重要な動向
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.recent_activities.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0">
                      {activity.type === 'harvest' && (
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <Sprout className="w-4 h-4 text-green-600" />
                        </div>
                      )}
                      {activity.type === 'efficiency' && (
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <Zap className="w-4 h-4 text-blue-600" />
                        </div>
                      )}
                      {activity.type === 'cost' && (
                        <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                          <DollarSign className="w-4 h-4 text-yellow-600" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{activity.title}</p>
                      <p className="text-sm text-gray-600">{activity.description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(activity.timestamp).toLocaleDateString('ja-JP', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    {activity.value && (
                      <div className="text-right">
                        <p className="font-bold text-green-600">
                          {activity.type === 'cost' 
                            ? formatCurrency(activity.value)
                            : formatNumber(activity.value, 0)
                          }
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 作業分析タブ */}
        <TabsContent value="worklog" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 作業種別頻度 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  作業種別分析
                </CardTitle>
                <CardDescription>各作業の実行回数と頻度</CardDescription>
              </CardHeader>
              <CardContent>
                <SimpleBarChart 
                  data={data.work_frequency && data.work_frequency.length > 0 ? data.work_frequency : []} 
                  height={250} 
                  title="作業回数（件）"
                />
              </CardContent>
            </Card>

            {/* コスト効率分析 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  作業コスト効率
                </CardTitle>
                <CardDescription>作業種類別のコスト効率比較</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded">
                    <span className="text-gray-700">収穫作業</span>
                    <div className="text-right">
                      <div className="font-bold text-green-700">¥125/時間</div>
                      <div className="text-xs text-gray-500">最高効率</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
                    <span className="text-gray-700">施肥作業</span>
                    <div className="text-right">
                      <div className="font-bold text-blue-700">¥98/時間</div>
                      <div className="text-xs text-gray-500">良好</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-yellow-50 rounded">
                    <span className="text-gray-700">除草作業</span>
                    <div className="text-right">
                      <div className="font-bold text-yellow-700">¥78/時間</div>
                      <div className="text-xs text-gray-500">要改善</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 作業パターン分析 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                作業パターン分析
              </CardTitle>
              <CardDescription>月別・作業種類別の詳細データ</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">作業種類</th>
                      <th className="text-right p-2">実行回数</th>
                      <th className="text-right p-2">平均時間</th>
                      <th className="text-right p-2">総コスト</th>
                      <th className="text-right p-2">効率スコア</th>
                      <th className="text-center p-2">傾向</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b hover:bg-gray-50">
                      <td className="p-2 font-medium">収穫作業</td>
                      <td className="text-right p-2">52回</td>
                      <td className="text-right p-2">2.5時間</td>
                      <td className="text-right p-2">¥16,250</td>
                      <td className="text-right p-2">92</td>
                      <td className="text-center p-2">
                        <Badge className="bg-green-100 text-green-700">↗ 向上</Badge>
                      </td>
                    </tr>
                    <tr className="border-b hover:bg-gray-50">
                      <td className="p-2 font-medium">灌水作業</td>
                      <td className="text-right p-2">89回</td>
                      <td className="text-right p-2">1.2時間</td>
                      <td className="text-right p-2">¥10,680</td>
                      <td className="text-right p-2">85</td>
                      <td className="text-center p-2">
                        <Badge className="bg-blue-100 text-blue-700">→ 安定</Badge>
                      </td>
                    </tr>
                    <tr className="border-b hover:bg-gray-50">
                      <td className="p-2 font-medium">施肥作業</td>
                      <td className="text-right p-2">42回</td>
                      <td className="text-right p-2">1.8時間</td>
                      <td className="text-right p-2">¥7,560</td>
                      <td className="text-right p-2">78</td>
                      <td className="text-center p-2">
                        <Badge className="bg-yellow-100 text-yellow-700">↘ 改善要</Badge>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 収穫分析タブ */}
        <TabsContent value="harvest" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>月別収穫量詳細</CardTitle>
              </CardHeader>
              <CardContent>
                <SimpleBarChart data={data.harvest_analysis} height={300} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>季節別パフォーマンス</CardTitle>
              </CardHeader>
              <CardContent>
                <SimpleBarChart data={data.seasonal_performance} height={300} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>収穫統計サマリー</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <Sprout className="w-8 h-8 mx-auto mb-2 text-green-600" />
                  <p className="text-2xl font-bold text-green-700">{formatNumber(data.summary.total_harvest, 0)}kg</p>
                  <p className="text-sm text-gray-600">総収穫量</p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <MapPin className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                  <p className="text-2xl font-bold text-blue-700">{formatNumber(data.summary.avg_yield_per_sqm)}kg/㎡</p>
                  <p className="text-sm text-gray-600">平均収量</p>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <Award className="w-8 h-8 mx-auto mb-2 text-yellow-600" />
                  <p className="text-2xl font-bold text-yellow-700">{data.summary.completed_harvests}</p>
                  <p className="text-sm text-gray-600">完了収穫</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 収益分析タブ */}
        <TabsContent value="financial" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>コスト内訳</CardTitle>
              </CardHeader>
              <CardContent>
                <SimpleBarChart data={data.cost_analysis} height={300} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>収益サマリー</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-green-50 rounded">
                  <span className="text-gray-700">売上高</span>
                  <span className="font-bold text-green-700">{formatCurrency(data.summary.total_revenue)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-red-50 rounded">
                  <span className="text-gray-700">総コスト</span>
                  <span className="font-bold text-red-700">{formatCurrency(data.summary.total_cost)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
                  <span className="text-gray-700">利益</span>
                  <span className="font-bold text-blue-700">{formatCurrency(data.summary.total_revenue - data.summary.total_cost)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-yellow-50 rounded">
                  <span className="text-gray-700">利益率</span>
                  <span className="font-bold text-yellow-700">{formatNumber(data.summary.profit_margin)}%</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 効率性タブ */}
        <TabsContent value="efficiency" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>作業効率推移</CardTitle>
              <CardDescription>月次効率スコアと改善トレンド</CardDescription>
            </CardHeader>
            <CardContent>
              <SimpleLineChart data={data.efficiency_trends} height={350} />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6 text-center">
                <Zap className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
                <p className="text-3xl font-bold text-yellow-600">{data.summary.efficiency_score}</p>
                <p className="text-gray-600">現在のスコア</p>
                <Badge className="mt-2 bg-yellow-100 text-yellow-700">良好</Badge>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <Clock className="w-12 h-12 mx-auto mb-4 text-blue-500" />
                <p className="text-3xl font-bold text-blue-600">{data.summary.active_plots}</p>
                <p className="text-gray-600">稼働中区画</p>
                <Badge className="mt-2 bg-blue-100 text-blue-700">活発</Badge>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <Users className="w-12 h-12 mx-auto mb-4 text-green-500" />
                <p className="text-3xl font-bold text-green-600">92%</p>
                <p className="text-gray-600">チーム効率</p>
                <Badge className="mt-2 bg-green-100 text-green-700">優秀</Badge>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* パフォーマンスタブ - 作業レポートデータ連携 */}
        <TabsContent value="performance" className="space-y-6">
          {/* パフォーマンスサマリー */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-r from-green-50 to-green-100">
              <CardContent className="p-4 text-center">
                <Award className="w-8 h-8 mx-auto mb-2 text-green-600" />
                <div className="text-2xl font-bold text-green-700">
                  {data.vegetable_performance.filter(v => v.status === 'excellent').length}
                </div>
                <div className="text-sm text-gray-600">優秀野菜</div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-r from-blue-50 to-blue-100">
              <CardContent className="p-4 text-center">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                <div className="text-2xl font-bold text-blue-700">
                  {formatNumber(data.vegetable_performance.reduce((avg, v) => avg + v.roi, 0) / data.vegetable_performance.length)}%
                </div>
                <div className="text-sm text-gray-600">平均ROI</div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-r from-yellow-50 to-yellow-100">
              <CardContent className="p-4 text-center">
                <DollarSign className="w-8 h-8 mx-auto mb-2 text-yellow-600" />
                <div className="text-2xl font-bold text-yellow-700">
                  {formatCurrency(data.vegetable_performance.reduce((sum, v) => sum + v.profit, 0))}
                </div>
                <div className="text-sm text-gray-600">総利益</div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-r from-purple-50 to-purple-100">
              <CardContent className="p-4 text-center">
                <Sprout className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                <div className="text-2xl font-bold text-purple-700">
                  {formatNumber(data.vegetable_performance.reduce((sum, v) => sum + v.harvest_amount, 0), 0)}kg
                </div>
                <div className="text-sm text-gray-600">総収穫量</div>
              </CardContent>
            </Card>
          </div>
          
          {/* 野菜別パフォーマンステーブル */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                野菜別パフォーマンス詳細
              </CardTitle>
              <CardDescription>作業レポートデータから自動集計されたパフォーマンス指標</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-3 font-semibold">野菜・品種</th>
                      <th className="text-right p-3 font-semibold">面積</th>
                      <th className="text-right p-3 font-semibold">収穫量</th>
                      <th className="text-right p-3 font-semibold">売上</th>
                      <th className="text-right p-3 font-semibold">コスト</th>
                      <th className="text-right p-3 font-semibold">利益</th>
                      <th className="text-right p-3 font-semibold">ROI</th>
                      <th className="text-right p-3 font-semibold">収穫効率</th>
                      <th className="text-center p-3 font-semibold">評価</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.vegetable_performance.map((item, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                              <Sprout className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{item.name}</div>
                              <div className="text-xs text-gray-500">{item.variety}</div>
                            </div>
                          </div>
                        </td>
                        <td className="text-right p-3">{item.plot_size}㎡</td>
                        <td className="text-right p-3 font-medium">{formatNumber(item.harvest_amount, 1)}kg</td>
                        <td className="text-right p-3 text-green-600 font-medium">{formatCurrency(item.revenue)}</td>
                        <td className="text-right p-3 text-red-600">{formatCurrency(item.cost)}</td>
                        <td className="text-right p-3 font-bold">
                          <span className={item.profit > 0 ? 'text-green-700' : 'text-red-700'}>
                            {formatCurrency(item.profit)}
                          </span>
                        </td>
                        <td className="text-right p-3">
                          <span className={`font-medium ${
                            item.roi > 100 ? 'text-green-600' : 
                            item.roi > 50 ? 'text-blue-600' : 'text-red-600'
                          }`}>
                            {formatNumber(item.roi, 1)}%
                          </span>
                        </td>
                        <td className="text-right p-3 text-purple-600 font-medium">
                          {formatNumber(item.yield_per_sqm, 1)}kg/㎡
                        </td>
                        <td className="text-center p-3">
                          <Badge className={`${getPerformanceColor(item.status)} font-medium`}>
                            {getPerformanceLabel(item.status)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* パフォーマンスチャート */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-4">野菜別ROI比較</h4>
                <SimpleBarChart 
                  data={data.vegetable_performance.map(v => ({
                    label: v.name.split('、')[0] || v.name.substring(0, 6), // 簡略名
                    value: Math.round(v.roi),
                    color: v.status === 'excellent' ? 'bg-green-500' :
                           v.status === 'good' ? 'bg-blue-500' :
                           v.status === 'average' ? 'bg-yellow-500' : 'bg-red-500'
                  }))}
                  height={200}
                  title="ROI (%)"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* プロフェッショナルエクスポート機能 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            プロフェッショナルデータエクスポート
          </CardTitle>
          <CardDescription>
            農業データを包括的にエクスポートしてExcel等で詳細分析できます
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <DataExportDialog />
            <Button variant="outline" className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              レポート印刷
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              データ同期
            </Button>
          </div>
          
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2">💡 エクスポート可能なデータ</h4>
            <div className="text-sm text-blue-700 space-y-1">
              <p>🌱 <strong>野菜管理データ:</strong> 登録済み野菜、品種、圃場情報</p>
              <p>📋 <strong>作業報告データ:</strong> 日々の作業記録、時間、コスト</p>
              <p>📊 <strong>分析データ:</strong> 月別集計、生産性レポート</p>
              <p>💾 <strong>全データ:</strong> 上記すべてを一括エクスポート</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}