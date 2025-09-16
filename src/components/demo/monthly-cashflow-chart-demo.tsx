'use client'

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  InteractionItem,
  ChartEvent
} from 'chart.js'
import { Bar, getElementAtEvent } from 'react-chartjs-2'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { CalendarIcon, TrendingUp, TrendingDown, Eye, ChevronRight } from 'lucide-react'
import { format, addMonths, subMonths } from 'date-fns'
import { ja } from 'date-fns/locale'

// Chart.jsの登録
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
)

interface CashFlowData {
  month: string
  year: number
  month_num: number
  work_types: {
    [key: string]: {
      income: number
      expense: number
      net: number
      details: AccountingItem[]
    }
  }
  monthly_total: number
  monthly_income: number
  monthly_expense: number
  // 累積損益データ（デュアル軸用）
  cumulative_profit: number
  cumulative_income: number
  cumulative_expense: number
  cumulative_trend: 'up' | 'down' | 'stable'
}

interface AccountingItem {
  id: string
  work_type: string
  item_name: string
  amount: number
  category: 'income' | 'expense'
  work_date: string
  description?: string
}

// 作業種別の色定義（プロフェッショナル農業×金融デザイン）
const WORK_TYPE_COLORS = {
  seeding: '#2563eb',      // 青 - 播種（新しい始まり）
  planting: '#7c3aed',     // 紫 - 定植（成長段階）
  fertilizing: '#ca8a04',  // 暗めの黄色 - 施肥（栄養投入）
  watering: '#0891b2',     // シアン - 灌水（水の供給）
  weeding: '#c2410c',      // 暗めのオレンジ - 除草（管理作業）
  pruning: '#9333ea',      // バイオレット - 整枝（形成作業）
  harvesting: '#16a34a',   // 緑 - 収穫（収益創出）
  other: '#6b7280'         // グレー - その他
}

const WORK_TYPE_LABELS = {
  seeding: '播種',
  planting: '定植',
  fertilizing: '施肥',
  watering: '灌水',
  weeding: '除草',
  pruning: '整枝',
  harvesting: '収穫',
  other: 'その他'
}

// レスポンシブ寸法計算の型定義
interface ResponsiveDimensions {
  monthCount: number
  barWidth: number
  categoryPercentage: number
  barPercentage: number
  fontSize: number
  labelRotation: number
}

// デモデータ生成関数（拡張版）
function generateDemoCashflowData(startMonth: Date, period: number): CashFlowData[] {
  const data: CashFlowData[] = []
  let cumulativeProfit = 0
  let cumulativeIncome = 0
  let cumulativeExpense = 0

  for (let i = 0; i < period * 12; i++) {
    const currentMonth = addMonths(startMonth, i)
    const monthNum = currentMonth.getMonth() + 1
    const year = currentMonth.getFullYear()

    // 季節による変動係数
    const seasonalFactor = monthNum >= 4 && monthNum <= 10 ? 1.5 : 0.8

    // 作業種別ごとのデータ生成
    const workTypes: { [key: string]: any } = {}
    let monthlyIncome = 0
    let monthlyExpense = 0

    // 収穫収入
    const harvestIncome = Math.floor((300000 + Math.random() * 200000) * seasonalFactor)
    workTypes.harvesting = {
      income: harvestIncome,
      expense: 0,
      net: harvestIncome,
      details: [{
        id: `harvest_${i}`,
        work_type: 'harvesting',
        item_name: '野菜収穫',
        amount: harvestIncome,
        category: 'income' as const,
        work_date: format(currentMonth, 'yyyy-MM-dd'),
        description: 'トマト、キュウリ、ナス等の収穫'
      }]
    }
    monthlyIncome += harvestIncome

    // その他収入
    const otherIncome = Math.floor(50000 + Math.random() * 30000)
    workTypes.other = {
      income: otherIncome,
      expense: 0,
      net: otherIncome,
      details: [{
        id: `other_income_${i}`,
        work_type: 'other',
        item_name: 'その他収入',
        amount: otherIncome,
        category: 'income' as const,
        work_date: format(currentMonth, 'yyyy-MM-dd'),
        description: '補助金・助成金等'
      }]
    }
    monthlyIncome += otherIncome

    // 各種支出の計算
    const expenseTypes = [
      { key: 'seeding', condition: monthNum % 3 === 1, amount: 30000 + Math.random() * 20000 },
      { key: 'planting', condition: monthNum % 4 === 2, amount: 25000 + Math.random() * 15000 },
      { key: 'fertilizing', condition: true, amount: 20000 + Math.random() * 25000 },
      { key: 'watering', condition: true, amount: 10000 + Math.random() * 10000 },
      { key: 'weeding', condition: monthNum >= 5 && monthNum <= 10, amount: 15000 + Math.random() * 10000 },
      { key: 'pruning', condition: monthNum >= 4 && monthNum <= 8, amount: 20000 + Math.random() * 15000 }
    ]

    expenseTypes.forEach(({ key, condition, amount }) => {
      const expense = condition ? Math.floor(amount) : 0
      if (expense > 0) {
        workTypes[key] = {
          income: 0,
          expense: -expense,
          net: -expense,
          details: [{
            id: `${key}_${i}`,
            work_type: key,
            item_name: WORK_TYPE_LABELS[key as keyof typeof WORK_TYPE_LABELS] + '作業',
            amount: -expense,
            category: 'expense' as const,
            work_date: format(currentMonth, 'yyyy-MM-dd'),
            description: `${WORK_TYPE_LABELS[key as keyof typeof WORK_TYPE_LABELS]}にかかる費用`
          }]
        }
        monthlyExpense += expense
      } else {
        workTypes[key] = { income: 0, expense: 0, net: 0, details: [] }
      }
    })

    // 月次集計
    const monthlyTotal = monthlyIncome - monthlyExpense
    cumulativeProfit += monthlyTotal
    cumulativeIncome += monthlyIncome
    cumulativeExpense += monthlyExpense

    // トレンド判定
    let trend: 'up' | 'down' | 'stable' = 'stable'
    if (i > 0) {
      const prevProfit = data[i - 1].cumulative_profit
      const profitChange = cumulativeProfit - prevProfit
      if (profitChange > 0) trend = 'up'
      else if (profitChange < 0) trend = 'down'
    }

    data.push({
      month: format(currentMonth, 'M月', { locale: ja }),
      year,
      month_num: monthNum,
      work_types: workTypes,
      monthly_total: monthlyTotal,
      monthly_income: monthlyIncome,
      monthly_expense: monthlyExpense,
      cumulative_profit: cumulativeProfit,
      cumulative_income: cumulativeIncome,
      cumulative_expense: cumulativeExpense,
      cumulative_trend: trend
    })
  }

  return data
}

export default function MonthlyCashflowChartDemo() {
  const [startMonth, setStartMonth] = useState<Date>(new Date(new Date().getFullYear(), 0, 1))
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [yearMonthPickerOpen, setYearMonthPickerOpen] = useState(false)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [selectedMonthNum, setSelectedMonthNum] = useState<number>(1)
  const [demoLimitModalOpen, setDemoLimitModalOpen] = useState(false)
  const [displayPeriod, setDisplayPeriod] = useState<1 | 2 | 3>(1)
  const [cashflowData, setCashflowData] = useState<CashFlowData[]>([])
  const [previousYearData, setPreviousYearData] = useState<CashFlowData[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<CashFlowData | null>(null)
  const [drilldownOpen, setDrilldownOpen] = useState(false)
  const [showComparison, setShowComparison] = useState(false)
  const [showCumulativeLine, setShowCumulativeLine] = useState(true)
  const [cumulativeType, setCumulativeType] = useState<'profit' | 'income' | 'expense'>('profit')
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [isLegendOpen, setIsLegendOpen] = useState(true)
  const [isComparisonOpen, setIsComparisonOpen] = useState(false)

  const chartRef = useRef<ChartJS<'bar'>>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // レスポンシブ寸法計算
  const calculateResponsiveDimensions = useCallback((period: number, containerWidth: number): ResponsiveDimensions => {
    const monthCount = period * 12
    const availableWidth = containerWidth - 120
    const idealBarWidth = availableWidth / monthCount

    const barWidth = Math.max(25, Math.min(80, idealBarWidth))
    const categoryPercentage = barWidth > 50 ? 0.9 : 0.95
    const barPercentage = barWidth > 50 ? 0.8 : barWidth > 35 ? 0.85 : 0.9
    const fontSize = barWidth > 40 ? 12 : 10
    const labelRotation = period === 1 ? 0 : period === 2 ? -20 : -45

    return { monthCount, barWidth, categoryPercentage, barPercentage, fontSize, labelRotation }
  }, [])

  // データ生成
  useEffect(() => {
    setLoading(true)
    setCashflowData(generateDemoCashflowData(startMonth, displayPeriod))
    setPreviousYearData(generateDemoCashflowData(subMonths(startMonth, 12), displayPeriod))
    setLastUpdated(new Date())
    setLoading(false)
  }, [startMonth, displayPeriod])

  // グラフクリックハンドラー
  const handleChartClick = (event: ChartEvent, elements: InteractionItem[]) => {
    if (elements.length > 0 && chartRef.current) {
      const element = elements[0]
      const index = element.index
      if (index !== undefined && cashflowData[index]) {
        setSelectedMonth(cashflowData[index])
        setDrilldownOpen(true)
      }
    }
  }

  // Y軸範囲の計算
  const calculateYAxisRange = useCallback((data: CashFlowData[]) => {
    if (!data || data.length === 0) return { min: -100000, max: 100000 }

    const allValues: number[] = []
    data.forEach(d => {
      allValues.push(d.monthly_income)
      allValues.push(-d.monthly_expense)
      Object.values(d.work_types).forEach(wt => {
        if (wt.income) allValues.push(wt.income)
        if (wt.expense) allValues.push(wt.expense)
      })
    })

    const maxVal = Math.max(...allValues, 0)
    const minVal = Math.min(...allValues, 0)
    const range = maxVal - minVal
    const padding = range * 0.15

    return {
      min: Math.floor((minVal - padding) / 10000) * 10000,
      max: Math.ceil((maxVal + padding) / 10000) * 10000
    }
  }, [])

  // Chart.js用データセット作成
  const chartData = useMemo(() => {
    if (!cashflowData || cashflowData.length === 0) return { labels: [], datasets: [] }

    const monthLabels = cashflowData.map(d => d.month)
    const yearLabels = cashflowData.map(d => d.year)

    // 積み上げ棒グラフのデータセット
    const datasets = []

    // 収入データ（正の値）
    const workTypeKeys = Object.keys(WORK_TYPE_COLORS)
    workTypeKeys.forEach(workType => {
      const incomeData = cashflowData.map(d => {
        const wt = d.work_types[workType]
        return wt ? wt.income : 0
      })

      if (incomeData.some(v => v > 0)) {
        datasets.push({
          label: WORK_TYPE_LABELS[workType as keyof typeof WORK_TYPE_LABELS] + '（収入）',
          data: incomeData,
          backgroundColor: WORK_TYPE_COLORS[workType as keyof typeof WORK_TYPE_COLORS],
          stack: 'income',
          barPercentage: 0.8,
          categoryPercentage: 0.9
        })
      }

      // 支出データ（負の値）
      const expenseData = cashflowData.map(d => {
        const wt = d.work_types[workType]
        return wt ? wt.expense : 0
      })

      if (expenseData.some(v => v < 0)) {
        datasets.push({
          label: WORK_TYPE_LABELS[workType as keyof typeof WORK_TYPE_LABELS] + '（支出）',
          data: expenseData,
          backgroundColor: WORK_TYPE_COLORS[workType as keyof typeof WORK_TYPE_COLORS] + '99',
          stack: 'expense',
          barPercentage: 0.8,
          categoryPercentage: 0.9
        })
      }
    })

    // 純損益線グラフ（左Y軸）
    const netProfitLineDataset = {
      type: 'line' as const,
      label: '純損益',
      data: cashflowData.map(d => d.monthly_total),
      borderColor: '#ef4444',
      backgroundColor: 'transparent',
      borderWidth: 2,
      pointRadius: 5,
      pointBackgroundColor: '#ffffff',
      pointBorderColor: '#ef4444',
      pointBorderWidth: 2,
      fill: false,
      tension: 0.3,
      yAxisID: 'y',
      order: 0,
      pointHoverRadius: 8,
      pointHoverBorderWidth: 3,
      borderDash: [3, 6],
      borderCapStyle: 'round' as const,
      borderJoinStyle: 'round' as const
    }

    // 累積損益線グラフ（右Y軸）- 条件付きで表示
    const cumulativeDatasets = []
    if (showCumulativeLine) {
      let cumulativeData: number[]
      let lineColor: string
      let lineLabel: string

      switch (cumulativeType) {
        case 'profit':
          cumulativeData = cashflowData.map(d => d.cumulative_profit)
          lineColor = '#059669'
          lineLabel = '累積損益'
          break
        case 'income':
          cumulativeData = cashflowData.map(d => d.cumulative_income)
          lineColor = '#0284c7'
          lineLabel = '累積収入'
          break
        case 'expense':
          cumulativeData = cashflowData.map(d => -d.cumulative_expense)
          lineColor = '#dc2626'
          lineLabel = '累積支出'
          break
      }

      cumulativeDatasets.push({
        type: 'line' as const,
        label: lineLabel,
        data: cumulativeData,
        borderColor: lineColor,
        backgroundColor: `${lineColor}20`,
        borderWidth: 3,
        pointRadius: 6,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: lineColor,
        pointBorderWidth: 2,
        fill: false,
        tension: 0.4,
        yAxisID: 'y1',
        order: -1,
        pointHoverRadius: 9,
        pointHoverBorderWidth: 3,
        borderDash: cumulativeType === 'expense' ? [2, 8] : cumulativeType !== 'profit' ? [5, 5] : []
      })
    }

    return {
      labels: monthLabels,
      datasets: [...datasets, netProfitLineDataset, ...cumulativeDatasets]
    }
  }, [cashflowData, showCumulativeLine, cumulativeType])

  // Y軸範囲
  const yAxisRange = useMemo(() => calculateYAxisRange(cashflowData), [cashflowData, calculateYAxisRange])

  // 右側Y軸の範囲計算
  const rightAxisRange = useMemo(() => {
    if (!showCumulativeLine || !cashflowData || cashflowData.length === 0) {
      return yAxisRange
    }

    let values: number[] = []
    switch (cumulativeType) {
      case 'profit':
        values = cashflowData.map(d => d.cumulative_profit)
        break
      case 'income':
        values = cashflowData.map(d => d.cumulative_income)
        break
      case 'expense':
        values = cashflowData.map(d => -d.cumulative_expense)
        break
    }

    const maxVal = Math.max(...values, 0)
    const minVal = Math.min(...values, 0)
    const range = maxVal - minVal
    const padding = range * 0.15

    return {
      min: Math.floor((minVal - padding) / 10000) * 10000,
      max: Math.ceil((maxVal + padding) / 10000) * 10000
    }
  }, [cashflowData, showCumulativeLine, cumulativeType])

  // Chart.jsオプション
  const chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: handleChartClick,
    interaction: {
      mode: 'index',
      intersect: false
    },
    scales: {
      x: {
        stacked: true,
        grid: {
          display: false
        },
        ticks: {
          autoSkip: false,
          maxRotation: displayPeriod === 1 ? 0 : displayPeriod === 2 ? 20 : 45,
          minRotation: displayPeriod === 1 ? 0 : displayPeriod === 2 ? 20 : 45
        }
      },
      y: {
        stacked: true,
        position: 'left',
        title: {
          display: true,
          text: '金額（円）'
        },
        ticks: {
          callback: (value) => `¥${Number(value).toLocaleString()}`
        },
        min: yAxisRange.min,
        max: yAxisRange.max
      },
      y1: {
        position: 'right',
        display: showCumulativeLine,
        title: {
          display: true,
          text: '累積金額（円）'
        },
        grid: {
          drawOnChartArea: false
        },
        ticks: {
          callback: (value) => `¥${Number(value).toLocaleString()}`
        },
        min: rightAxisRange.min,
        max: rightAxisRange.max
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.dataset.label || ''
            const value = context.parsed.y
            return `${label}: ¥${Math.abs(value).toLocaleString()}`
          }
        }
      }
    }
  }


  // 年月選択ハンドラー（デモ版では制限）
  const handleYearMonthSelect = () => {
    setYearMonthPickerOpen(false)
    setDemoLimitModalOpen(true)
  }

  // 年月選択の初期化
  useEffect(() => {
    setSelectedYear(startMonth.getFullYear())
    setSelectedMonthNum(startMonth.getMonth() + 1)
  }, [startMonth])

  // 凡例項目の集計（期間合計を計算）
  const legendItems = useMemo(() => {
    const items: { label: string; color: string; value: number }[] = []

    Object.keys(WORK_TYPE_LABELS).forEach(workType => {
      // 各作業種別の純額（net）を計算
      const totalNet = cashflowData.reduce((sum, d) => {
        const wt = d.work_types[workType]
        return sum + (wt ? wt.net : 0)
      }, 0)

      // 純額が0でない場合のみ表示（収入・支出どちらかがある場合）
      if (totalNet !== 0) {
        items.push({
          label: WORK_TYPE_LABELS[workType as keyof typeof WORK_TYPE_LABELS],
          color: WORK_TYPE_COLORS[workType as keyof typeof WORK_TYPE_COLORS],
          value: totalNet
        })
      }
    })

    return items
  }, [cashflowData])

  // 前年比較データ
  const comparisonData = useMemo(() => {
    if (!showComparison || previousYearData.length === 0) return null

    const currentTotal = cashflowData.reduce((sum, d) => sum + d.monthly_total, 0)
    const previousTotal = previousYearData.reduce((sum, d) => sum + d.monthly_total, 0)
    const change = currentTotal - previousTotal
    const changeRate = previousTotal !== 0 ? (change / Math.abs(previousTotal)) * 100 : 0

    return {
      current: currentTotal,
      previous: previousTotal,
      change,
      changeRate
    }
  }, [cashflowData, previousYearData, showComparison])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>月次キャッシュフロー推移（デモ版）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[600px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">
                  月次キャッシュフロー推移（デモ版）
                </CardTitle>
                <p className="text-green-100 text-sm">
                  Monthly Cashflow Trend Analysis
                </p>
              </div>
            </div>
            <Badge variant="outline" className="bg-white/20 text-white border-white/30">
              サンプルデータ
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {/* フィルターコントロール */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex flex-wrap items-center gap-3">
                {/* 表示期間選択 */}
                <div className="flex items-center gap-1 bg-white rounded-lg p-1 border">
                  {[1, 2, 3].map((period) => (
                    <Button
                      key={period}
                      variant={displayPeriod === period ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setDisplayPeriod(period as 1 | 2 | 3)}
                      className={`px-3 h-7 text-xs ${
                        displayPeriod === period
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {period}年
                    </Button>
                  ))}
                </div>

                {/* プロフェッショナル年月選択UI */}
                <Popover open={yearMonthPickerOpen} onOpenChange={setYearMonthPickerOpen} modal={true}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center gap-2 min-w-[140px]">
                      <CalendarIcon className="w-4 h-4" />
                      <span className="font-medium">{format(startMonth, 'yyyy年M月', { locale: ja })}</span>
                      <span className="text-xs text-gray-500">開始</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0 bg-white border border-gray-300 shadow-xl z-50">
                    <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-blue-50">
                      <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                        📅 グラフ表示期間設定
                      </h4>
                      <p className="text-xs text-gray-600 mt-1">開始年月を選択してください（{displayPeriod}年間表示）</p>
                    </div>

                    <div className="p-4 space-y-4">
                      {/* 年選択 - 過去30年スクロール表示 */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          📅 年
                          <span className="text-xs text-gray-500">（過去30年から選択）</span>
                        </label>
                        <div className="h-32 overflow-y-auto border border-gray-200 rounded-lg bg-gray-50 p-2">
                          <div className="grid grid-cols-3 gap-2">
                            {Array.from({length: 30}, (_, i) => new Date().getFullYear() - i).map(year => (
                              <Button
                                key={year}
                                variant={selectedYear === year ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setSelectedYear(year)}
                                className={`text-xs h-8 ${
                                  selectedYear === year
                                    ? 'bg-green-600 text-white shadow-md scale-105'
                                    : 'hover:bg-green-50 bg-white'
                                } transition-all duration-200`}
                              >
                                {year}
                              </Button>
                            ))}
                          </div>
                        </div>

                        {/* 選択中の年をハイライト表示 */}
                        <div className="text-center">
                          <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            選択中: {selectedYear}年
                          </span>
                        </div>
                      </div>

                      {/* 月選択 */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">月</label>
                        <div className="grid grid-cols-4 gap-2">
                          {Array.from({length: 12}, (_, i) => i + 1).map(month => (
                            <Button
                              key={month}
                              variant={selectedMonthNum === month ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setSelectedMonthNum(month)}
                              className={`text-xs h-8 ${
                                selectedMonthNum === month
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'hover:bg-blue-50 bg-white'
                              } transition-all duration-200`}
                            >
                              {month}月
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* アクションボタン */}
                      <div className="flex gap-2 pt-4 border-t">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => setYearMonthPickerOpen(false)}
                        >
                          キャンセル
                        </Button>
                        <Button
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                          onClick={handleYearMonthSelect}
                        >
                          設定変更
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* 前年比較トグル */}
                <Button
                  variant={showComparison ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowComparison(!showComparison)}
                  className={showComparison ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}
                >
                  前年比較
                </Button>

                {/* 累積損益線トグル */}
                <Button
                  variant={showCumulativeLine ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowCumulativeLine(!showCumulativeLine)}
                  className={showCumulativeLine ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}
                >
                  累積線
                </Button>

                {/* 累積線種別選択 */}
                {showCumulativeLine && (
                  <div className="flex items-center gap-1 bg-white rounded-lg p-1 border">
                    {[
                      { value: 'profit', label: '損益', color: 'emerald' },
                      { value: 'income', label: '収入', color: 'blue' },
                      { value: 'expense', label: '支出', color: 'red' }
                    ].map((type) => (
                      <Button
                        key={type.value}
                        variant={cumulativeType === type.value ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setCumulativeType(type.value as 'profit' | 'income' | 'expense')}
                        className={`px-2 h-6 text-xs ${
                          cumulativeType === type.value
                            ? `bg-${type.color}-600 text-white shadow-sm`
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {type.label}
                      </Button>
                    ))}
                  </div>
                )}

              </div>

              {/* 最終更新時刻 */}
              <div className="text-xs text-gray-500">
                最終更新: {format(lastUpdated, 'HH:mm:ss')}
              </div>
            </div>
          </div>

          {/* グラフ */}
          <div ref={containerRef} className="relative" style={{ height: '400px' }}>
            <Bar ref={chartRef} data={chartData} options={chartOptions} />
          </div>

          {/* グラフ凡例コンテナ（折りたたみ可能） */}
          <Collapsible open={isLegendOpen} onOpenChange={setIsLegendOpen}>
            <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <CollapsibleTrigger className="w-full">
                <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2 cursor-pointer hover:text-gray-600">
                  <ChevronRight
                    className={`w-4 h-4 transition-transform duration-200 ${isLegendOpen ? 'rotate-90' : ''}`}
                  />
                  📊 作業種別凡例・期間合計
                  <span className="text-xs text-gray-500 ml-auto">
                    {isLegendOpen ? '閉じる' : '展開する'}
                  </span>
                </h4>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {legendItems.map((item) => (
                    <div key={item.label} className="flex items-center gap-2 p-2 bg-white rounded border">
                      <div
                        className="w-4 h-4 rounded flex-shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-700 truncate">{item.label}</div>
                        <div className="text-xs text-gray-500">
                          {new Intl.NumberFormat('ja-JP', {
                            style: 'currency',
                            currency: 'JPY',
                            minimumFractionDigits: 0
                          }).format(item.value)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 累積損益の最終値 */}
                {showCumulativeLine && cashflowData.length > 0 && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      期間{cumulativeType === 'profit' ? '累積損益' : cumulativeType === 'income' ? '累積収入' : '累積支出'}
                    </span>
                    <div className="flex items-center gap-2">
                      {cashflowData[cashflowData.length - 1]?.cumulative_profit >= 0 ? (
                        <TrendingUp className="w-4 h-4 text-green-600" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-600" />
                      )}
                      <span className={`font-bold ${
                        cumulativeType === 'profit'
                          ? cashflowData[cashflowData.length - 1]?.cumulative_profit >= 0 ? 'text-green-600' : 'text-red-600'
                          : cumulativeType === 'income' ? 'text-blue-600' : 'text-red-600'
                      }`}>
                        ¥{(() => {
                          const lastData = cashflowData[cashflowData.length - 1]
                          if (!lastData) return '0'
                          switch (cumulativeType) {
                            case 'profit':
                              return lastData.cumulative_profit.toLocaleString()
                            case 'income':
                              return lastData.cumulative_income.toLocaleString()
                            case 'expense':
                              return lastData.cumulative_expense.toLocaleString()
                          }
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
                )}
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* 前年比較セクション */}
          {showComparison && comparisonData && (
            <Collapsible open={isComparisonOpen} onOpenChange={setIsComparisonOpen} className="mt-4">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-3 hover:bg-gray-50">
                  <span className="font-medium">前年比較分析</span>
                  <ChevronRight className={`w-4 h-4 transition-transform ${isComparisonOpen ? 'rotate-90' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="text-xs text-blue-600 mb-1">今期累計</div>
                    <div className="font-bold text-lg">
                      ¥{comparisonData.current.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-600 mb-1">前年同期</div>
                    <div className="font-bold text-lg">
                      ¥{comparisonData.previous.toLocaleString()}
                    </div>
                  </div>
                  <div className={`p-3 rounded-lg ${comparisonData.change >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                    <div className="text-xs mb-1" style={{color: comparisonData.change >= 0 ? '#16a34a' : '#dc2626'}}>
                      前年比
                    </div>
                    <div className="font-bold text-lg" style={{color: comparisonData.change >= 0 ? '#16a34a' : '#dc2626'}}>
                      {comparisonData.change >= 0 ? '+' : ''}¥{comparisonData.change.toLocaleString()}
                      <span className="text-sm ml-2">
                        ({comparisonData.changeRate >= 0 ? '+' : ''}{comparisonData.changeRate.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* デモ版の注意事項 */}
          <div className="mt-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-xs text-yellow-800">
              ※ これはデモ版です。表示データはすべてランダムに生成されたサンプルデータです。
              実際のデータではドリルダウン機能により詳細な会計項目を確認できます。
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 月次詳細ドリルダウンダイアログ */}
      <Dialog open={drilldownOpen} onOpenChange={setDrilldownOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedMonth && `${selectedMonth.year}年${selectedMonth.month} - 詳細データ`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedMonth && (
              <>
                {/* サマリー */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-green-50 rounded-lg">
                    <div className="text-xs text-green-600 mb-1">収入合計</div>
                    <div className="font-bold">¥{selectedMonth.monthly_income.toLocaleString()}</div>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg">
                    <div className="text-xs text-red-600 mb-1">支出合計</div>
                    <div className="font-bold">¥{selectedMonth.monthly_expense.toLocaleString()}</div>
                  </div>
                  <div className={`p-3 rounded-lg ${selectedMonth.monthly_total >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
                    <div className="text-xs mb-1" style={{color: selectedMonth.monthly_total >= 0 ? '#2563eb' : '#ea580c'}}>
                      純損益
                    </div>
                    <div className="font-bold" style={{color: selectedMonth.monthly_total >= 0 ? '#2563eb' : '#ea580c'}}>
                      ¥{selectedMonth.monthly_total.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* 作業種別詳細 */}
                <div className="space-y-2">
                  <h3 className="font-medium text-sm text-gray-700">作業種別内訳</h3>
                  {Object.entries(selectedMonth.work_types).map(([workType, data]) => {
                    if (data.income === 0 && data.expense === 0) return null
                    return (
                      <div key={workType} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            {WORK_TYPE_LABELS[workType as keyof typeof WORK_TYPE_LABELS]}
                          </span>
                          <div className="flex gap-4 text-sm">
                            {data.income > 0 && (
                              <span className="text-green-600">
                                収入: ¥{data.income.toLocaleString()}
                              </span>
                            )}
                            {data.expense < 0 && (
                              <span className="text-red-600">
                                支出: ¥{Math.abs(data.expense).toLocaleString()}
                              </span>
                            )}
                            <span className={`font-bold ${data.net >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                              純額: ¥{data.net.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="text-xs text-gray-500">
                  ※ デモ版のため詳細な会計項目は表示されません
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* デモ版制限モーダル */}
      <Dialog open={demoLimitModalOpen} onOpenChange={setDemoLimitModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              ⚠️ デモ版の制限事項
            </DialogTitle>
          </DialogHeader>
          <div className="pt-4 space-y-3">
            <p className="text-sm text-gray-600">
              デモ版では開始月の変更機能は利用できません。
            </p>
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs text-yellow-800">
                本機能は製品版でご利用いただけます。
                デモ版では現在の年度のデータのみ表示されます。
              </p>
            </div>
            <p className="text-sm text-gray-500">
              製品版では以下の機能が利用可能です：
            </p>
            <ul className="text-sm text-gray-600 space-y-1 ml-4">
              <li>• 任意の開始年月の設定</li>
              <li>• 過去30年分のデータ表示</li>
              <li>• データのエクスポート機能</li>
              <li>• リアルタイムデータ更新</li>
            </ul>
          </div>
          <div className="mt-6 flex justify-end">
            <Button
              onClick={() => setDemoLimitModalOpen(false)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              了解しました
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}