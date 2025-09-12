'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { analyticsDataSync } from '@/lib/analytics-data-sync'
import { accountingAnalyticsProcessor } from '@/lib/accounting-analytics-processor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
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
  RefreshCw,
  Microscope,
  Network,
  CheckCircle,
  Info,
  FileText,
  Brain
} from 'lucide-react'
import DataExportDialog from '@/components/data-export-dialog'
import MonthlyCashflowChart from '@/components/charts/monthly-cashflow-chart'
import MonthlyWorkHoursChart from '@/components/charts/monthly-workhours-chart'
import SoilHealthROIChart from '@/components/charts/soil-health-roi-chart'
import SoilDetailChart from '@/components/charts/soil-detail-chart'
import FinancialPerformanceChart from '@/components/charts/financial-performance-chart'
import WorkTypeAnalysisReport from '@/components/work-type-analysis-report'

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
    total_work_hours: number
    avg_yield_per_sqm: number
    active_plots: number
    completed_harvests: number
    efficiency_score: number
  }
  dataQuality?: {
    incomeSource: 'accounting' | 'estimated' | 'none'
    expenseSource: 'accounting' | 'estimated' | 'none'
    reliability: 'high' | 'medium' | 'low'
    accountingCoverage?: number
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
  const [selectedVegetable, setSelectedVegetable] = useState('all')
  const [availableVegetables, setAvailableVegetables] = useState<Array<{id: string, name: string}>>([])
  const [vegetableOptions, setVegetableOptions] = useState<Array<{id: string, name: string}>>([{id: 'all', name: 'すべての野菜'}])
  const [selectedPlot, setSelectedPlot] = useState('all')
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)

  // サンプルデータ
  const sampleData: AnalyticsData = {
    summary: {
      total_revenue: 1250000,
      total_cost: 780000,
      profit_margin: 37.6,
      total_harvest: 2840,
      total_work_hours: 456.5,
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

  // 認証情報の取得
  useEffect(() => {
    const fetchUserAuth = async () => {
      try {
        console.log('🔍 Analytics: 認証情報取得開始')
        const response = await fetch('/api/auth/user')
        
        if (!response.ok) {
          throw new Error(`認証エラー: ${response.status}`)
        }
        
        const result = await response.json()
        
        if (result.success && result.user?.company_id) {
          console.log('✅ Analytics: 認証成功, company_id:', result.user.company_id)
          setCompanyId(result.user.company_id)
          setAuthError(null)
        } else {
          throw new Error('ユーザー情報の取得に失敗しました')
        }
      } catch (error) {
        console.error('❌ Analytics: 認証エラー:', error)
        setAuthError(error instanceof Error ? error.message : '認証エラーが発生しました')
        setCompanyId(null)
      }
    }
    
    fetchUserAuth()
  }, [])

  // データの取得（companyIdが取得できた後に実行）
  useEffect(() => {
    if (companyId) {
      console.log('📊 Analytics: companyId取得完了、データフェッチ開始:', companyId)
      fetchAnalyticsData()
    }
  }, [companyId, selectedVegetable, selectedPlot])

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
    if (!autoRefresh || !companyId) return
    
    const interval = setInterval(() => {
      fetchAnalyticsData()
      console.log('分析データが自動更新されました')
    }, 5 * 60 * 1000) // 5分ごと
    
    return () => clearInterval(interval)
  }, [autoRefresh, companyId, selectedVegetable, selectedPlot])

  const fetchAnalyticsData = async () => {
    if (!companyId) {
      console.log('❌ Analytics: companyIdが未設定のため、データ取得をスキップ')
      return
    }
    
    try {
      console.log('📊 Analytics: データ取得開始, companyId:', companyId)
      setLoading(true)
      
      // 作業レポートデータと野菜データを並行取得
      const [reportsResponse, vegetablesResponse, ganttResponse] = await Promise.all([
        fetch(`/api/reports?company_id=${companyId}&limit=200`),
        fetch(`/api/gantt?company_id=${companyId}&start_date=2024-01-01&end_date=2025-12-31`),
        fetch(`/api/gantt?company_id=${companyId}&start_date=2024-01-01&end_date=2025-12-31`)
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
          
          // 野菜オプションリストを更新
          const vegOptions = vegetables.map((veg: any) => ({
            id: veg.id,
            name: veg.name.split('（')[0] || veg.name
          }))
          setAvailableVegetables(vegOptions)
          setVegetableOptions([{id: 'all', name: 'すべての野菜'}, ...vegOptions])
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
      
      // 選択された野菜によるフィルタリング
      let filteredWorkReports = workReports
      let filteredVegetables = vegetables
      
      if (selectedVegetable !== 'all') {
        const selectedVegId = selectedVegetable
        filteredWorkReports = workReports.filter((report: any) => report.vegetable_id === selectedVegId)
        filteredVegetables = vegetables.filter((veg: any) => veg.id === selectedVegId)
      }
      
      console.log('🔍 Analytics: フィルター後のデータ', {
        選択野菜: selectedVegetable,
        フィルター後作業レポート数: filteredWorkReports.length,
        フィルター後野菜数: filteredVegetables.length
      })

      // 作業レポートから分析データを生成（直近12カ月データ）
      if (filteredWorkReports.length > 0 || filteredVegetables.length > 0) {
        // 直近12カ月のデータでフィルタリング
        const twelveMonthsAgo = new Date()
        twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1)
        const last12MonthsReports = filteredWorkReports.filter((report: any) => {
          const reportDate = new Date(report.work_date)
          return reportDate >= twelveMonthsAgo
        })
        
        console.log('📅 直近12カ月データフィルタリング:', {
          total_reports: filteredWorkReports.length,
          last_12_months: last12MonthsReports.length,
          period: `${twelveMonthsAgo.toLocaleDateString('ja-JP')} ~ ${new Date().toLocaleDateString('ja-JP')}`
        })
        
        const analyticsFromReports = generateDetailedAnalyticsFromReports(last12MonthsReports, filteredVegetables)
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

  // 作業レポートから詳細分析データを生成（会計データ統合版）
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
        totalWorkHours: 0,
        profitMargin: 0,
        recentActivities: [],
        dataQuality: {
          incomeSource: 'none',
          expenseSource: 'none',
          reliability: 'low'
        }
      }
    }

    console.log('🔍 Analytics: 会計統合データ処理開始', { reportCount: reports.length })

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

    // 会計データ統合を使用したコスト分析
    const costByType: {[key: string]: number} = {}
    let totalActualRevenue = 0
    let totalActualCost = 0
    let totalEstimatedRevenue = 0
    let totalEstimatedCost = 0
    let revenueFromAccounting = 0
    let expenseFromAccounting = 0

    reports.forEach(report => {
      // 会計統合プロセッサーを使用してデータ取得
      const incomeData = accountingAnalyticsProcessor.getIncomeDataWithSource(report, true)
      const costData = accountingAnalyticsProcessor.getCostDataWithSource(report, true)
      
      // 収入データの集計
      if (incomeData.source === 'accounting') {
        totalActualRevenue += incomeData.amount
        revenueFromAccounting += incomeData.amount
      } else {
        totalEstimatedRevenue += incomeData.amount
      }

      // 支出データの集計
      if (costData.source === 'accounting') {
        totalActualCost += costData.amount
        expenseFromAccounting += costData.amount
      } else {
        totalEstimatedCost += costData.amount
      }

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
      costByType[label] = (costByType[label] || 0) + costData.amount
    })

    // データ品質メトリクス
    const dataQuality = {
      incomeSource: revenueFromAccounting > totalEstimatedRevenue ? 'accounting' : 'estimated',
      expenseSource: expenseFromAccounting > totalEstimatedCost ? 'accounting' : 'estimated',
      reliability: revenueFromAccounting > 0 && expenseFromAccounting > 0 ? 'high' : 
                   revenueFromAccounting > 0 || expenseFromAccounting > 0 ? 'medium' : 'low',
      accountingCoverage: reports.length > 0 ? 
        (reports.filter(r => r.work_report_accounting && r.work_report_accounting.length > 0).length / reports.length) * 100 : 0
    }

    console.log('💰 Analytics: 会計データ統合結果', {
      totalActualRevenue,
      totalActualCost,
      totalEstimatedRevenue,
      totalEstimatedCost,
      dataQuality
    })

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

    // 野菜別パフォーマンス分析（会計データ統合）
    const vegetablePerformance = vegetables.map((veg: any) => {
      const vegReports = reports.filter(r => r.vegetable_id === veg.id)
      
      let totalRevenue = 0
      let totalCost = 0
      
      vegReports.forEach(report => {
        const incomeData = accountingAnalyticsProcessor.getIncomeDataWithSource(report, true)
        const costData = accountingAnalyticsProcessor.getCostDataWithSource(report, true)
        totalRevenue += incomeData.amount
        totalCost += costData.amount
      })

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
        name: veg.name.split('（')[0] || veg.name,
        variety: veg.variety || veg.name.match(/（(.+?)）/)?.[1] || '',
        plot_size: 100,
        harvest_amount: totalHarvest,
        revenue: totalRevenue,
        cost: totalCost,
        profit: profit,
        yield_per_sqm: totalHarvest / 100,
        roi: roi,
        status: status
      }
    })

    // 総計算（実績データを優先）
    const totalRevenue = totalActualRevenue + totalEstimatedRevenue
    const totalCost = totalActualCost + totalEstimatedCost

    const totalHarvest = reports
      .filter(r => r.harvest_amount)
      .reduce((sum, report) => sum + report.harvest_amount, 0)

    // 総作業時間の計算（duration_hours または推定2時間）
    const totalWorkHours = reports
      .reduce((sum, report) => {
        const hours = report.duration_hours || report.work_hours || 2
        return sum + hours
      }, 0)

    // 最近のアクティビティ生成（会計データ情報付き）
    const recentActivities = reports
      .slice(-5)
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
        
        const incomeData = accountingAnalyticsProcessor.getIncomeDataWithSource(report, true)
        const costData = accountingAnalyticsProcessor.getCostDataWithSource(report, true)
        
        return {
          id: report.id || `act_${index}`,
          type: report.work_type === 'harvesting' ? 'harvest' as const : 'cost' as const,
          title: `${vegetableName}の${workTypeName}作業`,
          description: `${report.description || workTypeName + '作業を実施'}（${costData.badge}データ）`,
          value: report.work_type === 'harvesting' ? incomeData.amount : costData.amount,
          timestamp: new Date(report.work_date).toISOString()
        }
      })
      .reverse()

    return {
      harvestByMonth,
      costByType,
      workFrequency,
      vegetablePerformance,
      totalRevenue,
      totalCost,
      totalHarvest,
      totalWorkHours,
      profitMargin: totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0,
      recentActivities,
      dataQuality
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
      total_work_hours: Math.round((reportsData.totalWorkHours || 0) * 10) / 10, // 総作業時間を追加
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
      dataQuality: reportsData.dataQuality || baseData.dataQuality,
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


  // 認証エラーの表示
  if (authError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-400" />
          <p className="text-red-600 text-lg font-medium mb-2">認証エラー</p>
          <p className="text-gray-500 text-sm mb-4">{authError}</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            再読み込み
          </Button>
        </div>
      </div>
    )
  }

  // ローディング状態（companyIdを待っている状態も含む）
  if (loading || !companyId) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
        {!companyId && (
          <div className="text-center text-gray-500 text-sm">
            認証情報を確認しています...
          </div>
        )}
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
          <p className="text-xs text-gray-400 mt-2">使用中の会社ID: {companyId}</p>
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
          <Select value={selectedVegetable} onValueChange={setSelectedVegetable}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="野菜を選択" />
            </SelectTrigger>
            <SelectContent>
              {vegetableOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
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

      {/* 金融×農業デザインのKPIカード（直近12カ月）with データ品質インジケーター */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden bg-gradient-to-br from-emerald-50 to-green-100 border-emerald-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-sm text-emerald-700 font-medium">総収入（直近12カ月）</p>
                  {data.dataQuality?.incomeSource === 'accounting' && (
                    <Badge className="text-xs bg-green-500 text-white px-2 py-0.5">実績</Badge>
                  )}
                  {data.dataQuality?.incomeSource === 'estimated' && (
                    <Badge className="text-xs bg-yellow-500 text-white px-2 py-0.5">推定</Badge>
                  )}
                </div>
                <p className="text-2xl font-bold text-emerald-900">{formatCurrency(data.summary.total_revenue)}</p>
                <p className="text-xs text-emerald-600 flex items-center mt-2">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  {data.dataQuality?.incomeSource === 'accounting' ? '会計連携済' : 'ハーベスト推定'}
                </p>
              </div>
              <div className="relative">
                <DollarSign className="w-10 h-10 text-emerald-600 opacity-90" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-xs text-white font-bold">¥</span>
                </div>
              </div>
            </div>
            <div className="absolute bottom-0 right-0 opacity-10">
              <Sprout className="w-20 h-20 text-green-800" />
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-red-50 to-orange-100 border-red-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-sm text-red-700 font-medium">総支出（直近12カ月）</p>
                  {data.dataQuality?.expenseSource === 'accounting' && (
                    <Badge className="text-xs bg-green-500 text-white px-2 py-0.5">実績</Badge>
                  )}
                  {data.dataQuality?.expenseSource === 'estimated' && (
                    <Badge className="text-xs bg-yellow-500 text-white px-2 py-0.5">推定</Badge>
                  )}
                </div>
                <p className="text-2xl font-bold text-red-900">{formatCurrency(data.summary.total_cost)}</p>
                <p className="text-xs text-red-600 flex items-center mt-2">
                  <TrendingDown className="w-3 h-3 mr-1" />
                  {data.dataQuality?.expenseSource === 'accounting' ? '会計連携済' : '作業時間推定'}
                </p>
              </div>
              <div className="relative">
                <DollarSign className="w-10 h-10 text-red-600 opacity-90 transform rotate-180" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-xs text-white font-bold">-</span>
                </div>
              </div>
            </div>
            <div className="absolute bottom-0 right-0 opacity-10">
              <Target className="w-20 h-20 text-red-800" />
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-cyan-100 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="relative z-10">
                <p className="text-sm text-blue-700 font-medium mb-2">総収穫量（直近12カ月）</p>
                <p className="text-2xl font-bold text-blue-900">{formatNumber(data.summary.total_harvest, 0)}kg</p>
                <p className="text-xs text-blue-600 flex items-center mt-2">
                  <Sprout className="w-3 h-3 mr-1" />
                  平均 {formatNumber(data.summary.avg_yield_per_sqm)}kg/㎡
                </p>
              </div>
              <div className="relative">
                <Sprout className="w-10 h-10 text-blue-600 opacity-90" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-xs text-white font-bold">kg</span>
                </div>
              </div>
            </div>
            <div className="absolute bottom-0 right-0 opacity-10">
              <Award className="w-20 h-20 text-blue-800" />
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-amber-50 to-yellow-100 border-amber-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="relative z-10">
                <p className="text-sm text-amber-700 font-medium mb-2">総作業時間（直近12カ月）</p>
                <p className="text-2xl font-bold text-amber-900">{formatNumber(data.summary.total_work_hours, 1)}h</p>
                <p className="text-xs text-amber-600 flex items-center mt-2">
                  <Clock className="w-3 h-3 mr-1" />
                  効率性重視
                </p>
              </div>
              <div className="relative">
                <Clock className="w-10 h-10 text-amber-600 opacity-90" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                  <span className="text-xs text-white font-bold">h</span>
                </div>
              </div>
            </div>
            <div className="absolute bottom-0 right-0 opacity-10">
              <Activity className="w-20 h-20 text-amber-800" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 🌱 土壌健康度・ROIサマリーカード */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {/* 土壌健康度アラート */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-green-50 to-teal-100 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-sm text-green-700 font-medium">🌱 土壌健康度アラート</p>
                  <Badge className="text-xs bg-green-500 text-white px-2 py-0.5">統合分析</Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-green-900">健康度平均: 78.5点</span>
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{width: '78.5%'}}></div>
                    </div>
                  </div>
                  <p className="text-xs text-green-600 flex items-center mt-2">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    緊急対応: 2圃場 | 今月推奨改善: 4圃場
                  </p>
                </div>
              </div>
              <div className="relative">
                <Sprout className="w-10 h-10 text-green-600 opacity-90" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-xs text-white font-bold">pH</span>
                </div>
              </div>
            </div>
            <div className="absolute bottom-0 right-0 opacity-10">
              <Target className="w-20 h-20 text-green-800" />
            </div>
          </CardContent>
        </Card>

        {/* ROIサマリー */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-purple-50 to-indigo-100 border-purple-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-sm text-purple-700 font-medium">💰 土壌投資ROIサマリー</p>
                  <Badge className="text-xs bg-purple-500 text-white px-2 py-0.5">投資効果</Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-purple-900">平均ROI: 127.3%</span>
                    <TrendingUp className="w-5 h-5 text-purple-600" />
                  </div>
                  <p className="text-xs text-purple-600 flex items-center mt-2">
                    <Award className="w-3 h-3 mr-1" />
                    最高ROI圃場: 圃場A (184%) | 投資推奨度: 高
                  </p>
                </div>
              </div>
              <div className="relative">
                <DollarSign className="w-10 h-10 text-purple-600 opacity-90" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-xs text-white font-bold">%</span>
                </div>
              </div>
            </div>
            <div className="absolute bottom-0 right-0 opacity-10">
              <TrendingUp className="w-20 h-20 text-purple-800" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* メインコンテンツタブ */}
      <Tabs defaultValue="performance" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="performance">パフォーマンス</TabsTrigger>
          <TabsTrigger value="worklog-cost">作業・コスト分析</TabsTrigger>
          <TabsTrigger value="soil-detail">土壌詳細分析</TabsTrigger>
          <TabsTrigger value="harvest-revenue">収穫・収益分析</TabsTrigger>
          <TabsTrigger value="simulation">シミュレーション</TabsTrigger>
        </TabsList>

        {/* パフォーマンスタブ */}
        <TabsContent value="performance" className="space-y-6">
          {/* 月次キャッシュフロー推移グラフ */}
          <MonthlyCashflowChart companyId={companyId || ''} selectedVegetable={selectedVegetable} />
          
          {/* 収支構造×効率性×成長分析チャート */}
          <FinancialPerformanceChart companyId={companyId || ''} selectedVegetable={selectedVegetable} />
          
          {/* AI的洞察機能付き作業種類別統合レポート */}
          <WorkTypeAnalysisReport companyId={companyId || ''} selectedVegetable={selectedVegetable} />
          
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

        {/* 作業・コスト分析タブ */}
        <TabsContent value="worklog-cost" className="space-y-6">
          {/* AI予測作業時間分析チャート */}
          <MonthlyWorkHoursChart companyId={companyId || ''} selectedVegetable={selectedVegetable} />
          
          {/* 土壌健康度×ROI統合分析チャート */}
          <SoilHealthROIChart companyId={companyId || ''} selectedVegetable={selectedVegetable} />
          

        </TabsContent>

        {/* 収穫・収益分析タブ */}
        <TabsContent value="harvest-revenue" className="space-y-6">
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
                <CardTitle>コスト内訳</CardTitle>
              </CardHeader>
              <CardContent>
                <SimpleBarChart data={data.cost_analysis} height={300} />
              </CardContent>
            </Card>
          </div>

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


        {/* 🎯 将来予測シミュレーションタブ */}
        <TabsContent value="simulation" className="space-y-6">
          {/* メインシミュレーションパネル */}
          <Card className="border-2 border-purple-100 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold">
                      🎯 設備投資対応シミュレーション
                    </CardTitle>
                    <p className="text-green-100 text-sm">Investment Impact Simulation & Planning</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-green-100 uppercase tracking-wider">AgriFinance Pro</div>
                  <div className="text-sm font-medium">統合予測システム</div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-6">
              {/* シナリオ選択パネル */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  📋 シナリオ設定
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { 
                      id: 'baseline', 
                      name: '現状維持', 
                      desc: '現在の設備・運営を継続', 
                      color: 'gray',
                      icon: '📊',
                      investment: 0,
                      expectedROI: 0,
                      risk: '低'
                    },
                    { 
                      id: 'greenhouse', 
                      name: '温室設備投資', 
                      desc: '温室・環境制御システム導入', 
                      color: 'green',
                      icon: '🏠',
                      investment: 2500000,
                      expectedROI: 125,
                      risk: '中'
                    },
                    { 
                      id: 'automation', 
                      name: '自動化投資', 
                      desc: '灌水・施肥自動化システム', 
                      color: 'blue',
                      icon: '🤖',
                      investment: 1800000,
                      expectedROI: 145,
                      risk: '中'
                    },
                    { 
                      id: 'comprehensive', 
                      name: '包括的投資', 
                      desc: '温室+自動化+収穫機械', 
                      color: 'purple',
                      icon: '🚀',
                      investment: 5200000,
                      expectedROI: 168,
                      risk: '高'
                    }
                  ].map((scenario) => (
                    <div key={scenario.id} className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                      scenario.color === 'gray' ? 'border-gray-200 bg-gray-50 hover:border-gray-300' :
                      scenario.color === 'green' ? 'border-green-200 bg-green-50 hover:border-green-300' :
                      scenario.color === 'blue' ? 'border-blue-200 bg-blue-50 hover:border-blue-300' :
                      'border-purple-200 bg-purple-50 hover:border-purple-300'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{scenario.icon}</span>
                        <h4 className="font-bold text-gray-800">{scenario.name}</h4>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{scenario.desc}</p>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-500">投資額:</span>
                          <span className="font-medium">¥{scenario.investment.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">予想ROI:</span>
                          <span className="font-medium text-green-600">{scenario.expectedROI}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">リスク:</span>
                          <Badge className={`text-xs ${
                            scenario.risk === '低' ? 'bg-green-100 text-green-700' :
                            scenario.risk === '中' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {scenario.risk}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 期間設定 */}
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="text-lg font-bold text-blue-800 mb-3 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  ⏰ シミュレーション期間設定
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">開始年月</label>
                    <Input type="month" defaultValue="2025-01" className="w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">シミュレーション期間</label>
                    <Select defaultValue="3">
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1年間</SelectItem>
                        <SelectItem value="3">3年間</SelectItem>
                        <SelectItem value="5">5年間</SelectItem>
                        <SelectItem value="10">10年間</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button className="w-full bg-blue-600 hover:bg-blue-700">
                      <TrendingUp className="w-4 h-4 mr-2" />
                      シミュレーション実行
                    </Button>
                  </div>
                </div>
              </div>

              {/* 投資項目詳細設定 */}
              <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                <h3 className="text-lg font-bold text-green-800 mb-3 flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  💰 投資項目詳細設定
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* 設備投資 */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                      🏗️ 設備投資（CAPEX）
                    </h4>
                    {[
                      { name: '温室建設', cost: 1500000, period: 1 },
                      { name: '環境制御システム', cost: 800000, period: 1 },
                      { name: '灌水自動化', cost: 600000, period: 1 },
                      { name: '収穫機械', cost: 1200000, period: 2 }
                    ].map((item, index) => (
                      <div key={index} className="p-3 bg-white rounded border">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium text-gray-800">{item.name}</span>
                          <Switch />
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                          <div>投資額: ¥{item.cost.toLocaleString()}</div>
                          <div>導入時期: {item.period}年目</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* ランニングコスト */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                      ⚙️ ランニングコスト（OPEX）
                    </h4>
                    {[
                      { name: '電力費', cost: 180000, unit: '年' },
                      { name: '燃料費', cost: 120000, unit: '年' },
                      { name: 'メンテナンス', cost: 200000, unit: '年' },
                      { name: '保険料', cost: 80000, unit: '年' }
                    ].map((item, index) => (
                      <div key={index} className="p-3 bg-white rounded border">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium text-gray-800">{item.name}</span>
                          <Switch defaultChecked />
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                          <div>年間: ¥{item.cost.toLocaleString()}</div>
                          <div>単位: {item.unit}あたり</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 労働力投資 */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                      👥 労働力投資
                    </h4>
                    {[
                      { name: '追加人員雇用', cost: 3600000, unit: '年' },
                      { name: '技術研修', cost: 200000, unit: '回' },
                      { name: '外注作業', cost: 800000, unit: '年' },
                      { name: 'コンサル費用', cost: 600000, unit: '年' }
                    ].map((item, index) => (
                      <div key={index} className="p-3 bg-white rounded border">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium text-gray-800">{item.name}</span>
                          <Switch />
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                          <div>費用: ¥{item.cost.toLocaleString()}</div>
                          <div>単位: {item.unit}あたり</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* シミュレーション結果ダッシュボード */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 財務予測チャート */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  📈 財務予測チャート
                </CardTitle>
                <CardDescription>投資シナリオ別の収益・コスト推移</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex items-center justify-center bg-gray-50 rounded border-2 border-dashed border-gray-300">
                  <div className="text-center text-gray-500">
                    <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>シナリオ選択後にチャートが表示されます</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ROI比較分析 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  💹 ROI比較分析
                </CardTitle>
                <CardDescription>投資収益率とリスク評価</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { scenario: '現状維持', roi: 0, risk: '低', investment: 0, payback: '-' },
                    { scenario: '温室設備', roi: 125, risk: '中', investment: 2500000, payback: '2.8年' },
                    { scenario: '自動化', roi: 145, risk: '中', investment: 1800000, payback: '2.1年' },
                    { scenario: '包括投資', roi: 168, risk: '高', investment: 5200000, payback: '3.5年' }
                  ].map((item, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded border">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium text-gray-800">{item.scenario}</span>
                        <Badge className={`${
                          item.roi > 150 ? 'bg-green-100 text-green-700' :
                          item.roi > 100 ? 'bg-blue-100 text-blue-700' :
                          item.roi > 0 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          ROI {item.roi}%
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                        <div>投資額: ¥{item.investment.toLocaleString()}</div>
                        <div>回収期間: {item.payback}</div>
                        <div>リスク: {item.risk}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 詳細分析レポート */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                📊 詳細分析レポート
              </CardTitle>
              <CardDescription>投資効果の詳細分析と推奨事項</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* キャッシュフロー分析 */}
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
                    💰 キャッシュフロー分析
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">初期投資:</span>
                      <span className="font-medium text-red-600">-¥2,500,000</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">年間収益増:</span>
                      <span className="font-medium text-green-600">+¥1,200,000</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">年間コスト増:</span>
                      <span className="font-medium text-orange-600">-¥300,000</span>
                    </div>
                    <hr className="my-2" />
                    <div className="flex justify-between font-bold">
                      <span className="text-gray-800">正味現在価値:</span>
                      <span className="text-green-700">+¥1,840,000</span>
                    </div>
                  </div>
                </div>

                {/* リスク要因分析 */}
                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <h4 className="font-bold text-yellow-800 mb-3 flex items-center gap-2">
                    ⚠️ リスク要因分析
                  </h4>
                  <div className="space-y-2 text-sm">
                    {[
                      { factor: '市場価格変動', impact: '中', probability: '高' },
                      { factor: '技術陳腐化', impact: '高', probability: '低' },
                      { factor: '気候変動', impact: '中', probability: '中' },
                      { factor: '人材不足', impact: '中', probability: '中' }
                    ].map((risk, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <span className="text-gray-700">{risk.factor}</span>
                        <div className="flex gap-1">
                          <Badge className={`text-xs ${
                            risk.impact === '高' ? 'bg-red-100 text-red-700' :
                            risk.impact === '中' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            影響{risk.impact}
                          </Badge>
                          <Badge className={`text-xs ${
                            risk.probability === '高' ? 'bg-red-100 text-red-700' :
                            risk.probability === '中' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            確率{risk.probability}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 推奨事項 */}
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <h4 className="font-bold text-green-800 mb-3 flex items-center gap-2">
                    💡 推奨事項
                  </h4>
                  <div className="space-y-3 text-sm">
                    <div className="p-2 bg-white rounded border border-green-200">
                      <div className="font-medium text-green-800 mb-1">🏆 最優先推奨</div>
                      <div className="text-gray-700">自動化システムから段階的導入。ROI145%、回収期間2.1年</div>
                    </div>
                    <div className="p-2 bg-white rounded border border-blue-200">
                      <div className="font-medium text-blue-800 mb-1">📋 次期検討</div>
                      <div className="text-gray-700">温室設備は市場価格安定後に検討推奨</div>
                    </div>
                    <div className="p-2 bg-white rounded border border-yellow-200">
                      <div className="font-medium text-yellow-800 mb-1">⏰ 長期計画</div>
                      <div className="text-gray-700">包括的投資は3年後資金調達完了後に実行</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 🔬 土壌詳細分析タブ（フェーズ4） */}
        <TabsContent value="soil-detail" className="space-y-6">
          {/* 土壌成分マルチライン分析 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Microscope className="w-5 h-5" />
                🔬 土壌成分詳細推移分析
              </CardTitle>
              <CardDescription>
                全土壌成分の時系列変化を詳細分析。成分間の相関関係も確認できます。
              </CardDescription>
            </CardHeader>
            <CardContent>

              {/* 土壌成分詳細グラフ */}
              <div className="h-[600px] mb-6">
                <SoilDetailChart companyId={companyId || ''} />
              </div>

              {/* 成分統計サマリー */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { name: 'pH平均値', value: '6.8', trend: '+0.2', status: '適正', color: 'green' },
                  { name: 'EC平均値', value: '0.45 mS/cm', trend: '-0.05', status: '良好', color: 'blue' },
                  { name: 'CEC平均値', value: '22.1 meq/100g', trend: '+1.3', status: '優秀', color: 'green' },
                  { name: '塩基飽和度', value: '78%', trend: '+2%', status: '適正', color: 'green' }
                ].map((stat, index) => (
                  <div key={index} className="bg-white p-3 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">{stat.name}</p>
                    <p className="text-lg font-bold text-gray-900">{stat.value}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className={`text-xs px-2 py-1 rounded-full bg-${stat.color}-100 text-${stat.color}-700`}>
                        {stat.status}
                      </span>
                      <span className="text-xs text-gray-500">{stat.trend}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* レーダーチャート + 相関分析 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 土壌健康度レーダーチャート */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  🎯 土壌健康度レーダー分析
                </CardTitle>
                <CardDescription>
                  複数成分の総合バランスを視覚化
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 rounded-lg border">
                  <div className="text-center">
                    <div className="w-32 h-32 mx-auto mb-4 relative">
                      {/* 簡易レーダーチャート表示 */}
                      <svg viewBox="0 0 100 100" className="w-full h-full">
                        {/* 外枠 */}
                        <polygon 
                          points="50,10 85,30 85,70 50,90 15,70 15,30" 
                          fill="rgba(34, 197, 94, 0.1)" 
                          stroke="rgba(34, 197, 94, 0.3)" 
                          strokeWidth="1"
                        />
                        {/* 内枠 */}
                        <polygon 
                          points="50,25 70,35 70,65 50,75 30,65 30,35" 
                          fill="rgba(59, 130, 246, 0.1)" 
                          stroke="rgba(59, 130, 246, 0.3)" 
                          strokeWidth="1"
                        />
                        {/* データライン */}
                        <polygon 
                          points="50,15 80,32 78,68 50,85 22,68 20,32" 
                          fill="rgba(16, 185, 129, 0.2)" 
                          stroke="#10b981" 
                          strokeWidth="2"
                        />
                        {/* データポイント */}
                        <circle cx="50" cy="15" r="2" fill="#10b981" />
                        <circle cx="80" cy="32" r="2" fill="#10b981" />
                        <circle cx="78" cy="68" r="2" fill="#10b981" />
                        <circle cx="50" cy="85" r="2" fill="#10b981" />
                        <circle cx="22" cy="68" r="2" fill="#10b981" />
                        <circle cx="20" cy="32" r="2" fill="#10b981" />
                      </svg>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">総合スコア</span>
                        <span className="font-bold text-green-600">85/100</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="text-center">
                          <div className="text-blue-600 font-semibold">pH</div>
                          <div className="text-gray-500">92</div>
                        </div>
                        <div className="text-center">
                          <div className="text-green-600 font-semibold">EC</div>
                          <div className="text-gray-500">78</div>
                        </div>
                        <div className="text-center">
                          <div className="text-orange-600 font-semibold">CEC</div>
                          <div className="text-gray-500">88</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* レーダーチャート設定 */}
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <h4 className="text-sm font-semibold mb-2">📊 表示項目</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {['pH値', 'EC値', 'CEC値', '塩基飽和度', '有機物', '窒素'].map((item, idx) => (
                      <label key={idx} className="flex items-center gap-2 text-xs">
                        <input type="checkbox" defaultChecked className="w-3 h-3" />
                        {item}
                      </label>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 成分間相関分析 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="w-5 h-5" />
                  🔗 成分間相関分析
                </CardTitle>
                <CardDescription>
                  土壌成分同士の関連性を分析
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* 相関マトリックス */}
                <div className="mb-4">
                  <h4 className="text-sm font-semibold mb-3">相関係数マトリックス</h4>
                  <div className="grid grid-cols-4 gap-1 text-xs">
                    <div className="p-2 bg-gray-100 text-center font-semibold">成分</div>
                    <div className="p-2 bg-gray-100 text-center font-semibold">pH</div>
                    <div className="p-2 bg-gray-100 text-center font-semibold">EC</div>
                    <div className="p-2 bg-gray-100 text-center font-semibold">CEC</div>
                    
                    <div className="p-2 bg-gray-50 font-semibold">pH</div>
                    <div className="p-2 bg-green-100 text-center">1.00</div>
                    <div className="p-2 bg-yellow-100 text-center">0.42</div>
                    <div className="p-2 bg-blue-100 text-center">-0.18</div>
                    
                    <div className="p-2 bg-gray-50 font-semibold">EC</div>
                    <div className="p-2 bg-yellow-100 text-center">0.42</div>
                    <div className="p-2 bg-green-100 text-center">1.00</div>
                    <div className="p-2 bg-orange-100 text-center">0.68</div>
                    
                    <div className="p-2 bg-gray-50 font-semibold">CEC</div>
                    <div className="p-2 bg-blue-100 text-center">-0.18</div>
                    <div className="p-2 bg-orange-100 text-center">0.68</div>
                    <div className="p-2 bg-green-100 text-center">1.00</div>
                  </div>
                </div>

                {/* 相関分析結果 */}
                <div className="space-y-3">
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5" />
                      <div>
                        <h5 className="text-sm font-semibold text-orange-700">強い正の相関</h5>
                        <p className="text-xs text-orange-600 mt-1">
                          EC値とCEC値 (r=0.68) - 肥沃度指標の連動性を確認
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-500 mt-0.5" />
                      <div>
                        <h5 className="text-sm font-semibold text-blue-700">中程度の正の相関</h5>
                        <p className="text-xs text-blue-600 mt-1">
                          pH値とEC値 (r=0.42) - 土壌反応と塩分濃度の関係
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <div>
                        <h5 className="text-sm font-semibold text-green-700">分析完了</h5>
                        <p className="text-xs text-green-600 mt-1">
                          土壌成分バランスは良好です。継続モニタリングを推奨します。
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 詳細レポート生成セクション */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                📋 プロフェッショナル土壌分析レポート
              </CardTitle>
              <CardDescription>
                包括的な土壌診断レポートを自動生成。農業改善提案も含まれます。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* レポート生成オプション */}
                <div>
                  <h4 className="text-sm font-semibold mb-3">📊 レポート内容選択</h4>
                  <div className="space-y-2">
                    {[
                      { label: '土壌成分詳細分析', desc: '全成分の推移と評価', checked: true },
                      { label: '作物適性診断', desc: '現在の土壌に最適な作物', checked: true },
                      { label: '改良提案レポート', desc: '具体的な改善方法', checked: true },
                      { label: '季節別管理計画', desc: '年間を通じた管理戦略', checked: false },
                      { label: '費用対効果分析', desc: '改良投資の経済性', checked: false },
                      { label: '他圃場比較分析', desc: 'ベンチマークとの比較', checked: false }
                    ].map((option, idx) => (
                      <label key={idx} className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                        <input 
                          type="checkbox" 
                          defaultChecked={option.checked}
                          className="w-4 h-4 text-blue-600 mt-1" 
                        />
                        <div>
                          <div className="text-sm font-medium">{option.label}</div>
                          <div className="text-xs text-gray-500">{option.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* レポートプレビュー */}
                <div>
                  <h4 className="text-sm font-semibold mb-3">📋 生成レポートサンプル</h4>
                  <div className="bg-gradient-to-br from-gray-50 to-blue-50 p-4 rounded-lg border h-64 overflow-y-auto">
                    <div className="text-xs space-y-3">
                      <div className="border-b pb-2">
                        <h5 className="font-bold text-blue-700">🌱 土壌健康度総合評価</h5>
                        <p className="text-gray-600 mt-1">評価スコア: 85/100 (優良)</p>
                      </div>
                      
                      <div className="border-b pb-2">
                        <h5 className="font-bold text-green-700">📊 主要成分分析</h5>
                        <ul className="text-gray-600 mt-1 space-y-1">
                          <li>• pH値: 6.8 (適正範囲)</li>
                          <li>• 電気伝導度: 0.45 mS/cm (良好)</li>
                          <li>• CEC値: 22.1 meq/100g (優秀)</li>
                          <li>• 塩基飽和度: 78% (適正)</li>
                        </ul>
                      </div>

                      <div className="border-b pb-2">
                        <h5 className="font-bold text-orange-700">⚠️ 注意事項</h5>
                        <ul className="text-gray-600 mt-1 space-y-1">
                          <li>• 有機物含量がやや低下傾向</li>
                          <li>• リン酸の蓄積に注意が必要</li>
                        </ul>
                      </div>

                      <div>
                        <h5 className="font-bold text-purple-700">💡 改善提案</h5>
                        <ul className="text-gray-600 mt-1 space-y-1">
                          <li>• 堆肥投入時期の最適化</li>
                          <li>• 緑肥作物の活用検討</li>
                          <li>• 排水対策の強化</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* レポート生成ボタン */}
                  <div className="flex gap-2 mt-4">
                    <Button className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700">
                      <FileText className="w-4 h-4 mr-2" />
                      詳細レポート生成
                    </Button>
                    <Button variant="outline">
                      <Download className="w-4 h-4 mr-2" />
                      PDF出力
                    </Button>
                  </div>
                </div>
              </div>

              {/* AI分析洞察 */}
              <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-purple-700 mb-3">
                  <Brain className="w-4 h-4" />
                  🤖 AI土壌分析洞察
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="bg-white p-3 rounded border">
                    <h5 className="font-semibold text-blue-700 mb-2">🎯 最優先改善項目</h5>
                    <p className="text-gray-600">
                      有機物含量の向上が土壌構造改善の鍵。堆肥投入量を20%増加することを推奨。
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <h5 className="font-semibold text-green-700 mb-2">📈 予測収量効果</h5>
                    <p className="text-gray-600">
                      提案された改善策により、来季の収量15-20%向上が期待されます。
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <h5 className="font-semibold text-orange-700 mb-2">💰 投資対効果</h5>
                    <p className="text-gray-600">
                      土壌改良投資額 ¥180,000で年間収益向上¥420,000を見込める。
                    </p>
                  </div>
                </div>
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

      {/* データ品質レポート */}
      {data.dataQuality && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              データ品質・信頼性レポート
            </CardTitle>
            <CardDescription>
              会計データの統合状況と分析の信頼性を確認できます
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                <h4 className="font-medium text-green-800 mb-2">収入データソース</h4>
                <div className="flex items-center gap-2">
                  {data.dataQuality.incomeSource === 'accounting' ? (
                    <>
                      <Badge className="bg-green-500 text-white">会計実績</Badge>
                      <p className="text-sm text-green-700">work_report_accounting テーブル</p>
                    </>
                  ) : (
                    <>
                      <Badge className="bg-yellow-500 text-white">推定値</Badge>
                      <p className="text-sm text-yellow-700">収穫量 × 期待価格</p>
                    </>
                  )}
                </div>
              </div>

              <div className="p-4 bg-gradient-to-r from-red-50 to-orange-50 rounded-lg border border-red-200">
                <h4 className="font-medium text-red-800 mb-2">支出データソース</h4>
                <div className="flex items-center gap-2">
                  {data.dataQuality.expenseSource === 'accounting' ? (
                    <>
                      <Badge className="bg-green-500 text-white">会計実績</Badge>
                      <p className="text-sm text-green-700">work_report_accounting テーブル</p>
                    </>
                  ) : (
                    <>
                      <Badge className="bg-yellow-500 text-white">推定値</Badge>
                      <p className="text-sm text-yellow-700">作業時間 × 時給</p>
                    </>
                  )}
                </div>
              </div>

              <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-800 mb-2">総合信頼性</h4>
                <div className="flex items-center gap-2">
                  {data.dataQuality.reliability === 'high' && (
                    <>
                      <Badge className="bg-green-500 text-white">高</Badge>
                      <p className="text-sm text-green-700">会計データ連携済</p>
                    </>
                  )}
                  {data.dataQuality.reliability === 'medium' && (
                    <>
                      <Badge className="bg-yellow-500 text-white">中</Badge>
                      <p className="text-sm text-yellow-700">部分的に会計連携</p>
                    </>
                  )}
                  {data.dataQuality.reliability === 'low' && (
                    <>
                      <Badge className="bg-red-500 text-white">低</Badge>
                      <p className="text-sm text-red-700">推定値のみ</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {data.dataQuality.accountingCoverage !== undefined && (
              <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h4 className="font-medium text-gray-800 mb-2">📊 会計データカバレッジ</h4>
                <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                  <div 
                    className={`h-3 rounded-full transition-all duration-500 ${
                      data.dataQuality.accountingCoverage > 80 ? 'bg-green-500' : 
                      data.dataQuality.accountingCoverage > 50 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(100, data.dataQuality.accountingCoverage)}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600">
                  {Math.round(data.dataQuality.accountingCoverage)}% の作業記録に会計データが連携されています
                </p>
              </div>
            )}

            <div className="mt-4 text-xs text-gray-500">
              <p>💡 データ品質を向上させるには、作業記録作成時に会計項目も同時に記録してください</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}