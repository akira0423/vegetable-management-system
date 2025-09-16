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
  const [vegetablesData, setVegetablesData] = useState<any[]>([])
  const [selectedPlot, setSelectedPlot] = useState('all')
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)

  // サンプルデータは削除済み - 実データのみを使用

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
          total_cost: data.summary.total_cost,
          total_harvest: data.summary.total_harvest + (updateData.data.harvest_amount || 0)
        },
        recent_activities: [
          {
            id: `activity_${Date.now()}`,
            type: updateData.data.work_type === 'harvesting' ? 'harvest' as const : 'cost' as const,
            title: `新しい${updateData.data.work_type}作業が完了`,
            description: updateData.data.work_notes || '作業が追加されました',
            value: updateData.data.expected_revenue || updateData.data.harvest_amount || 0,
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
      
      // 直近12カ月の期間を計算
      const endDate = new Date()
      const startDate = new Date()
      startDate.setFullYear(startDate.getFullYear() - 1)

      // 作業レポートデータと野菜データを並行取得
      const [reportsResponse, vegetablesResponse, ganttResponse] = await Promise.all([
        fetch(`/api/reports?company_id=${companyId}&start_date=${startDate.toISOString().split('T')[0]}&end_date=${endDate.toISOString().split('T')[0]}&limit=999999`),  // 実質無制限
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
          setVegetablesData(vegetables) // 完全な野菜データを保存

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
        野菜データ数: vegetables ? vegetables.length : 0,
        タスクデータ数: tasks.length
      })
      
      // 選択された野菜によるフィルタリング
      let filteredWorkReports = workReports
      let filteredVegetables = vegetables

      if (selectedVegetable !== 'all') {
        const selectedVegId = selectedVegetable
        filteredWorkReports = workReports.filter((report: any) => report.vegetable_id === selectedVegId)
        filteredVegetables = vegetables && vegetables.length > 0 ? vegetables.filter((veg: any) => veg.id === selectedVegId) : []
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
        // サンプルデータは使用せず、実データのみを使用
        const realData = createRealAnalyticsData(analyticsFromReports)
        setData(realData)
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
      // 会計統合プロセッサーを使用してデータ取得（推定計算なし）
      const incomeData = accountingAnalyticsProcessor.getIncomeDataWithSource(report, false)
      const costData = accountingAnalyticsProcessor.getCostDataWithSource(report, false)

      // 収入データの集計（会計データのみ）
      totalActualRevenue += incomeData.amount
      if (incomeData.amount > 0) {
        revenueFromAccounting += incomeData.amount
      }

      // 支出データの集計（会計データのみ）
      totalActualCost += costData.amount
      if (costData.amount > 0) {
        expenseFromAccounting += costData.amount
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
    const vegetablePerformance = vegetables && vegetables.length > 0 ? vegetables.map((veg: any) => {
      const vegReports = reports.filter(r => r.vegetable_id === veg.id)

      let totalRevenue = 0
      let totalCost = 0

      vegReports.forEach(report => {
        const incomeData = accountingAnalyticsProcessor.getIncomeDataWithSource(report, false)
        const costData = accountingAnalyticsProcessor.getCostDataWithSource(report, false)
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
    }) : []

    // 総計算（実績データを優先）
    const totalRevenue = totalActualRevenue + totalEstimatedRevenue
    const totalCost = totalActualCost + totalEstimatedCost

    const totalHarvest = reports
      .filter(r => r.harvest_amount)
      .reduce((sum, report) => sum + report.harvest_amount, 0)

    // 総作業時間の計算（人時：work_duration(分) × worker_count）
    const totalWorkHours = reports
      .reduce((sum, report) => {
        // work_duration（分単位）を使用、なければ0
        const minutes = report.work_duration || 0
        const workers = report.worker_count || 1
        return sum + (minutes * workers) / 60 // 時間単位に変換
      }, 0)

    // 最近のアクティビティ生成（会計データ情報付き）
    const recentActivities = reports
      .slice(-5)
      .map((report, index) => {
        const vegetableName = vegetables && vegetables.length > 0
          ? vegetables.find(v => v.id === report.vegetable_id)?.name || '未知の野菜'
          : '未知の野菜'
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
        
        const incomeData = accountingAnalyticsProcessor.getIncomeDataWithSource(report, false)
        const costData = accountingAnalyticsProcessor.getCostDataWithSource(report, false)
        
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

  // 実データのみから分析データを作成
  const createRealAnalyticsData = (reportsData: any): AnalyticsData => {
    // 月別収穫量データ
    const harvestAnalysis = Object.keys(reportsData.harvestByMonth || {}).length > 0
      ? Object.entries(reportsData.harvestByMonth).map(([month, amount]) => ({
          label: month,
          value: Math.round((amount as number) * 10) / 10,
          color: 'bg-green-600'
        }))
      : []

    // コスト分析データ
    const costAnalysis = Object.keys(reportsData.costByType || {}).length > 0
      ? Object.entries(reportsData.costByType).map(([type, amount]) => ({
          label: type,
          value: Math.round(amount as number),
          color: 'bg-blue-600'
        }))
      : []

    // 作業頻度データ
    const workFrequencyData = Object.keys(reportsData.workFrequency || {}).length > 0
      ? Object.entries(reportsData.workFrequency).map(([type, count]) => ({
          label: type,
          value: count as number,
          color: 'bg-purple-600'
        }))
      : []

    // 実際の総栽培面積を計算
    const totalArea = vegetablesData && vegetablesData.length > 0
      ? vegetablesData.reduce((sum: number, veg: any) => sum + (veg.area_size || 0), 0)
      : 300 // デフォルト値

    // サマリー情報（実データのみ）
    const summary = {
      total_revenue: Math.round(reportsData.totalRevenue || 0),
      total_cost: Math.round(reportsData.totalCost || 0),
      profit_margin: Math.round((reportsData.profitMargin || 0) * 10) / 10,
      total_harvest: Math.round((reportsData.totalHarvest || 0) * 10) / 10,
      total_work_hours: Math.round((reportsData.totalWorkHours || 0) * 10) / 10,
      avg_yield_per_sqm: reportsData.totalHarvest && reportsData.totalHarvest > 0 && totalArea > 0
        ? Math.round((reportsData.totalHarvest / totalArea) * 10) / 10
        : 0,
      active_plots: reportsData.activePlots || 0,
      completed_harvests: reportsData.completedHarvests || 0,
      efficiency_score: Math.min(100, Math.max(0,
        Math.round(75 + (reportsData.profitMargin || 0) / 5)
      ))
    }

    return {
      summary,
      dataQuality: reportsData.dataQuality || {
        incomeSource: 'none',
        expenseSource: 'none',
        reliability: 'low'
      },
      harvest_analysis: harvestAnalysis,
      cost_analysis: costAnalysis,
      efficiency_trends: [], // 実データから生成される場合のみ設定
      seasonal_performance: [], // 実データから生成される場合のみ設定
      vegetable_performance: reportsData.vegetablePerformance || [],
      recent_activities: reportsData.recentActivities || [],
      work_frequency: workFrequencyData
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

    // 実際の総栽培面積を計算
    const totalArea = vegetablesData && vegetablesData.length > 0
      ? vegetablesData.reduce((sum: number, veg: any) => sum + (veg.area_size || 0), 0)
      : 300 // デフォルト値

    // サマリー情報の更新（数値の整合性を保証）
    const updatedSummary = {
      ...baseData.summary,
      total_revenue: Math.round(reportsData.totalRevenue || baseData.summary.total_revenue),
      total_cost: Math.round(reportsData.totalCost || baseData.summary.total_cost),
      profit_margin: Math.round((reportsData.profitMargin || baseData.summary.profit_margin) * 10) / 10,
      total_harvest: Math.round((reportsData.totalHarvest || baseData.summary.total_harvest) * 10) / 10,
      total_work_hours: Math.round((reportsData.totalWorkHours || 0) * 10) / 10, // 総作業時間を追加
      avg_yield_per_sqm: reportsData.totalHarvest && totalArea > 0
        ? Math.round((reportsData.totalHarvest / totalArea) * 10) / 10 // 実際の面積で計算
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

      {/* 上段: 基本情報カード - 4列レイアウト */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* 1. 登録野菜数 */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-green-50 to-emerald-100 border-green-200 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:-translate-y-1 group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="relative z-10">
                <p className="text-sm text-green-700 font-medium mb-2">登録野菜数</p>
                <p className="text-2xl font-bold text-green-900">
                  {availableVegetables.length}
                  <span className="text-base ml-2">品種</span>
                </p>
                <p className="text-xs text-green-600 flex items-center mt-2">
                  <Sprout className="w-3 h-3 mr-1" />
                  {selectedVegetable === 'all' ? '全野菜' : '選択中'}
                </p>
              </div>
              <div className="relative">
                <Sprout className="w-10 h-10 text-green-600 opacity-90 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-125">
                  <span className="text-xs text-white font-bold">{availableVegetables.length}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. 総栽培面積 */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-sky-100 border-blue-200 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:-translate-y-1 group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="relative z-10">
                <p className="text-sm text-blue-700 font-medium mb-2">総栽培面積</p>
                <p className="text-2xl font-bold text-blue-900">
                  {formatNumber(
                    vegetablesData && vegetablesData.length > 0
                      ? vegetablesData.reduce((sum: number, veg: any) => {
                          return sum + (veg.area_size || 0)
                        }, 0)
                      : 0,
                    0
                  )}
                  <span className="text-base ml-2">㎡</span>
                </p>
                <p className="text-xs text-blue-600 flex items-center mt-2">
                  <MapPin className="w-3 h-3 mr-1" />
                  {vegetablesData && vegetablesData.length > 0
                    ? vegetablesData.filter((veg: any) => veg.area_size > 0).length
                    : 0} 野菜
                </p>
              </div>
              <div className="relative">
                <MapPin className="w-10 h-10 text-blue-600 opacity-90 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-125">
                  <span className="text-xs text-white font-bold">㎡</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. 総収穫量（直近12カ月） */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-cyan-100 border-blue-200 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:-translate-y-1 group">
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
                <Sprout className="w-10 h-10 text-blue-600 opacity-90 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-125">
                  <span className="text-xs text-white font-bold">kg</span>
                </div>
              </div>
            </div>
            <div className="absolute bottom-0 right-0 opacity-10 transition-opacity duration-300 group-hover:opacity-20">
              <Award className="w-20 h-20 text-blue-800" />
            </div>
          </CardContent>
        </Card>

        {/* 4. 総作業時間（直近12カ月） */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-amber-50 to-yellow-100 border-amber-200 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:-translate-y-1 group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="relative z-10">
                <p className="text-sm text-amber-700 font-medium mb-2">総作業時間（直近12カ月）</p>
                <p className="text-2xl font-bold text-amber-900">{formatNumber(data.summary.total_work_hours, 1)}h</p>
                <p className="text-xs text-amber-600 flex items-center mt-2">
                  <Clock className="w-3 h-3 mr-1" />
                  人時ベース
                </p>
              </div>
              <div className="relative">
                <Clock className="w-10 h-10 text-amber-600 opacity-90 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-125">
                  <span className="text-xs text-white font-bold">h</span>
                </div>
              </div>
            </div>
            <div className="absolute bottom-0 right-0 opacity-10 transition-opacity duration-300 group-hover:opacity-20">
              <Activity className="w-20 h-20 text-amber-800" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 下段: 金融KPIカード - 4列レイアウト */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 5. 総収入（直近12カ月） */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-emerald-50 to-green-100 border-emerald-200 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:-translate-y-1 group">
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
                <DollarSign className="w-10 h-10 text-emerald-600 opacity-90 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-125">
                  <span className="text-xs text-white font-bold">¥</span>
                </div>
              </div>
            </div>
            <div className="absolute bottom-0 right-0 opacity-10 transition-opacity duration-300 group-hover:opacity-20">
              <Sprout className="w-20 h-20 text-green-800" />
            </div>
          </CardContent>
        </Card>

        {/* 6. 総支出（直近12カ月） */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-red-50 to-orange-100 border-red-200 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:-translate-y-1 group">
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
                <DollarSign className="w-10 h-10 text-red-600 opacity-90 transform rotate-180 transition-transform duration-300 group-hover:rotate-[192deg] group-hover:scale-110" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-125">
                  <span className="text-xs text-white font-bold">-</span>
                </div>
              </div>
            </div>
            <div className="absolute bottom-0 right-0 opacity-10 transition-opacity duration-300 group-hover:opacity-20">
              <Target className="w-20 h-20 text-red-800" />
            </div>
          </CardContent>
        </Card>

        {/* 7. 純利益 */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-sky-100 border-blue-200 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:-translate-y-1 group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-sm text-blue-700 font-medium">純利益</p>
                  {data?.dataQuality && (
                    <Badge className="text-xs bg-blue-500 text-white px-1 py-0">
                      {data.dataQuality.reliability === 'high' ? '実' :
                       data.dataQuality.reliability === 'medium' ? '混' : '推'}
                    </Badge>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-blue-900">
                      ¥{data ? formatNumber((data.summary.total_revenue || 0) - (data.summary.total_cost || 0)) : '0'}
                    </span>
                  </div>
                  <p className="text-xs text-blue-600 flex items-center">
                    <DollarSign className="w-3 h-3 mr-1" />
                    利益率: {data ? formatNumber(data.summary.profit_margin || 0, 1) : '0'}%
                  </p>
                </div>
              </div>
              <div className="relative">
                {data && ((data.summary.total_revenue || 0) - (data.summary.total_cost || 0)) >= 0 ? (
                  <TrendingUp className="w-10 h-10 text-green-600 opacity-90 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
                ) : (
                  <TrendingDown className="w-10 h-10 text-red-600 opacity-90 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 8. 投資収益率（ROI） */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-purple-50 to-indigo-100 border-purple-200 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:-translate-y-1 group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-sm text-purple-700 font-medium">投資収益率</p>
                  <Badge className="text-xs bg-purple-500 text-white px-1 py-0">ROI</Badge>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-purple-900">
                      {data && data.summary.total_cost > 0
                        ? `${(((data.summary.total_revenue - data.summary.total_cost) / data.summary.total_cost) * 100).toFixed(1)}%`
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="text-xs text-purple-600">
                    <div className="flex justify-between">
                      <span>収益</span>
                      <span className="font-medium">
                        {data ? `${(data.summary.total_revenue / 10000).toFixed(0)}万円` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>コスト</span>
                      <span className="font-medium">
                        {data ? `${(data.summary.total_cost / 10000).toFixed(0)}万円` : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="relative">
                {data && data.summary.total_revenue > data.summary.total_cost ? (
                  <TrendingUp className="w-10 h-10 text-green-600 opacity-90 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
                ) : (
                  <TrendingDown className="w-10 h-10 text-red-600 opacity-90 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>


      {/* メインコンテンツタブ - 金融系プロフェッショナルデザイン */}
      <Tabs defaultValue="performance" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 gap-2 bg-transparent p-1">
            <TabsTrigger
              value="performance"
              className="
                relative px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-200
                data-[state=inactive]:bg-white data-[state=inactive]:text-gray-600
                data-[state=inactive]:hover:bg-gray-50 data-[state=inactive]:hover:text-gray-800
                data-[state=inactive]:border data-[state=inactive]:border-gray-200
                data-[state=active]:bg-gradient-to-r data-[state=active]:from-slate-700 data-[state=active]:to-slate-800
                data-[state=active]:text-white data-[state=active]:shadow-md
                data-[state=active]:border-0
                group
              "
            >
              <div className="flex items-center justify-center gap-2">
                <Activity className="w-4 h-4" />
                <span>パフォーマンス</span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 scale-x-0 group-data-[state=active]:scale-x-100 transition-transform duration-200" />
            </TabsTrigger>

            <TabsTrigger
              value="harvest-revenue"
              className="
                relative px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-200
                data-[state=inactive]:bg-white data-[state=inactive]:text-gray-600
                data-[state=inactive]:hover:bg-gray-50 data-[state=inactive]:hover:text-gray-800
                data-[state=inactive]:border data-[state=inactive]:border-gray-200
                data-[state=active]:bg-gradient-to-r data-[state=active]:from-slate-700 data-[state=active]:to-slate-800
                data-[state=active]:text-white data-[state=active]:shadow-md
                data-[state=active]:border-0
                group
              "
            >
              <div className="flex items-center justify-center gap-2">
                <DollarSign className="w-4 h-4" />
                <span>収益コスト分析</span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 scale-x-0 group-data-[state=active]:scale-x-100 transition-transform duration-200" />
            </TabsTrigger>

            <TabsTrigger
              value="worklog-cost"
              className="
                relative px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-200
                data-[state=inactive]:bg-white data-[state=inactive]:text-gray-600
                data-[state=inactive]:hover:bg-gray-50 data-[state=inactive]:hover:text-gray-800
                data-[state=inactive]:border data-[state=inactive]:border-gray-200
                data-[state=active]:bg-gradient-to-r data-[state=active]:from-slate-700 data-[state=active]:to-slate-800
                data-[state=active]:text-white data-[state=active]:shadow-md
                data-[state=active]:border-0
                group
              "
            >
              <div className="flex items-center justify-center gap-2">
                <Clock className="w-4 h-4" />
                <span>作業時間分析</span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 scale-x-0 group-data-[state=active]:scale-x-100 transition-transform duration-200" />
            </TabsTrigger>
          </TabsList>

        {/* パフォーマンスタブ */}
        <TabsContent value="performance" className="space-y-6">
          {/* AI的洞察機能付き作業種類別統合レポート */}
          <WorkTypeAnalysisReport companyId={companyId || ''} selectedVegetable={selectedVegetable} />
        </TabsContent>

        {/* 作業時間分析タブ */}
        <TabsContent value="worklog-cost" className="space-y-6">
          {/* AI予測作業時間分析チャート */}
          <MonthlyWorkHoursChart companyId={companyId || ''} selectedVegetable={selectedVegetable} />
        </TabsContent>

        {/* 収益コスト分析タブ */}
        <TabsContent value="harvest-revenue" className="space-y-6">
          {/* 月次キャッシュフロー推移グラフ */}
          <MonthlyCashflowChart companyId={companyId || ''} selectedVegetable={selectedVegetable} />
          
          {/* 収支構造×効率性×成長分析チャート */}
          <FinancialPerformanceChart companyId={companyId || ''} selectedVegetable={selectedVegetable} />
        </TabsContent>

      </Tabs>

    </div>
  )
}