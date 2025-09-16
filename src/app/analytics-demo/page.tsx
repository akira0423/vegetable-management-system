'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  RefreshCw,
  Microscope,
  Network,
  CheckCircle,
  Info,
  FileText,
  Brain,
  Home,
  ArrowLeft
} from 'lucide-react'
import Link from 'next/link'
import WorkTypeAnalysisReportDemo from '@/components/demo/work-type-analysis-report-demo'
import MonthlyCashflowChartDemo from '@/components/demo/monthly-cashflow-chart-demo'
import FinancialPerformanceChartDemoEnhanced from '@/components/demo/financial-performance-chart-demo-enhanced'
import MonthlyWorkHoursChartDemo from '@/components/demo/monthly-workhours-chart-demo'

// チャートコンポーネント（本番ページと同じ）
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
    vegetable_count: number
    total_area: number
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
  work_frequency?: ChartData[]
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
  vegetables?: Array<{
    id: string
    name: string
    variety_name?: string
  }>
}

export default function AnalyticsDemoPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedVegetable, setSelectedVegetable] = useState('all')
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  // デモデータの取得
  useEffect(() => {
    fetchDemoAnalyticsData()
  }, [selectedVegetable])

  const fetchDemoAnalyticsData = async () => {
    try {
      setLoading(true)

      // デモAPIエンドポイントからデータを取得
      const response = await fetch(`/api/demo/analytics?vegetable_id=${selectedVegetable}`)

      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data) {
          setData(result.data)
        }
      }

      setLastUpdated(new Date())
    } catch (error) {
      console.error('Demo analytics data fetch error:', error)
    } finally {
      setLoading(false)
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
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="h-8 bg-gray-200 rounded animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 text-lg font-medium mb-2">データの読み込みに失敗しました</p>
              <Button onClick={fetchDemoAnalyticsData} variant="outline">
                再読み込み
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      {/* デモ警告バナー */}
      <div className="bg-purple-600 text-white px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Info className="w-5 h-5" />
            <span className="text-sm font-medium">
              🔔 デモ版をご利用中です - データは読み取り専用のサンプルデータです
            </span>
          </div>
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-white hover:bg-purple-700">
              <Home className="w-4 h-4 mr-2" />
              ホームへ戻る
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* ヘッダー */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">データ自動主計分析（デモ版）</h1>
            <p className="text-gray-600">AI搭載の栽培データ分析で経営を最適化</p>
          </div>

          <div className="flex items-center gap-3">
            <Select value={selectedVegetable} onValueChange={setSelectedVegetable}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="野菜を選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべての野菜</SelectItem>
                <SelectItem value="tomato">トマト</SelectItem>
                <SelectItem value="cucumber">キュウリ</SelectItem>
                <SelectItem value="eggplant">ナス</SelectItem>
                <SelectItem value="lettuce">レタス</SelectItem>
                <SelectItem value="pepper">ピーマン</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <div className="text-xs text-gray-500">
                最終更新: {lastUpdated.toLocaleTimeString('ja-JP')}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchDemoAnalyticsData}
                disabled
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                更新（デモ版では無効）
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
                    {data.summary.vegetable_count}
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
                    <span className="text-xs text-white font-bold">{data.summary.vegetable_count}</span>
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
                    {formatNumber(data.summary.total_area, 0)}
                    <span className="text-base ml-2">㎡</span>
                  </p>
                  <p className="text-xs text-blue-600 flex items-center mt-2">
                    <MapPin className="w-3 h-3 mr-1" />
                    {data.summary.active_plots} 区画
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
                    <Badge className="text-xs bg-green-500 text-white px-2 py-0.5">実績</Badge>
                  </div>
                  <p className="text-2xl font-bold text-emerald-900">{formatCurrency(data.summary.total_revenue)}</p>
                  <p className="text-xs text-emerald-600 flex items-center mt-2">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    会計連携済（デモ）
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
                    <Badge className="text-xs bg-green-500 text-white px-2 py-0.5">実績</Badge>
                  </div>
                  <p className="text-2xl font-bold text-red-900">{formatCurrency(data.summary.total_cost)}</p>
                  <p className="text-xs text-red-600 flex items-center mt-2">
                    <TrendingDown className="w-3 h-3 mr-1" />
                    会計連携済（デモ）
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
                    <Badge className="text-xs bg-blue-500 text-white px-1 py-0">実</Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-blue-900">
                        {formatCurrency(data.summary.total_revenue - data.summary.total_cost)}
                      </span>
                    </div>
                    <p className="text-xs text-blue-600 flex items-center">
                      <DollarSign className="w-3 h-3 mr-1" />
                      利益率: {formatNumber(data.summary.profit_margin, 1)}%
                    </p>
                  </div>
                </div>
                <div className="relative">
                  <TrendingUp className="w-10 h-10 text-green-600 opacity-90 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
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
                        {data.summary.total_cost > 0
                          ? `${(((data.summary.total_revenue - data.summary.total_cost) / data.summary.total_cost) * 100).toFixed(1)}%`
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="text-xs text-purple-600">
                      <div className="flex justify-between">
                        <span>収益</span>
                        <span className="font-medium">
                          {`${(data.summary.total_revenue / 10000).toFixed(0)}万円`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>コスト</span>
                        <span className="font-medium">
                          {`${(data.summary.total_cost / 10000).toFixed(0)}万円`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="relative">
                  <TrendingUp className="w-10 h-10 text-green-600 opacity-90 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* メインコンテンツタブ */}
        <Tabs defaultValue="performance" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 gap-2 bg-transparent p-1">
            <TabsTrigger
              value="performance"
              className="relative px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-200 data-[state=inactive]:bg-white data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:bg-gray-50 data-[state=inactive]:hover:text-gray-800 data-[state=inactive]:border data-[state=inactive]:border-gray-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-slate-700 data-[state=active]:to-slate-800 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:border-0 group"
            >
              <div className="flex items-center justify-center gap-2">
                <Activity className="w-4 h-4" />
                <span>パフォーマンス</span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 scale-x-0 group-data-[state=active]:scale-x-100 transition-transform duration-200" />
            </TabsTrigger>

            <TabsTrigger
              value="harvest-revenue"
              className="relative px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-200 data-[state=inactive]:bg-white data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:bg-gray-50 data-[state=inactive]:hover:text-gray-800 data-[state=inactive]:border data-[state=inactive]:border-gray-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-slate-700 data-[state=active]:to-slate-800 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:border-0 group"
            >
              <div className="flex items-center justify-center gap-2">
                <DollarSign className="w-4 h-4" />
                <span>収益コスト分析</span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 scale-x-0 group-data-[state=active]:scale-x-100 transition-transform duration-200" />
            </TabsTrigger>

            <TabsTrigger
              value="worklog-cost"
              className="relative px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-200 data-[state=inactive]:bg-white data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:bg-gray-50 data-[state=inactive]:hover:text-gray-800 data-[state=inactive]:border data-[state=inactive]:border-gray-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-slate-700 data-[state=active]:to-slate-800 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:border-0 group"
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
            {/* 作業別収支分析レポート（デモ版） */}
            <WorkTypeAnalysisReportDemo />
          </TabsContent>

          {/* 収益コスト分析タブ */}
          <TabsContent value="harvest-revenue" className="space-y-6">
            {/* 月次キャッシュフロー推移（デモ版） */}
            <MonthlyCashflowChartDemo />

            {/* 収支構造×効率性×成長分析（デモ版） */}
            <FinancialPerformanceChartDemoEnhanced />
          </TabsContent>

          {/* 作業時間分析タブ */}
          <TabsContent value="worklog-cost" className="space-y-6">
            {/* 月次作業時間分析（デモ版） */}
            <MonthlyWorkHoursChartDemo />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}