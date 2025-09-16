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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import {
  CalendarIcon, TrendingUp, TrendingDown, Eye, X, Target, Zap, Activity,
  DollarSign, BarChart3, ChevronUp, ChevronDown, ChevronRight, Settings, Info
} from 'lucide-react'
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

// データ型定義（本番と同じ）
interface FinancialPerformanceData {
  month: string
  year: number
  month_num: number
  // 収支構造データ
  revenue: {
    sales: number
    harvest_sales: number
    other_income: number
    total: number
  }
  expenses: {
    labor_cost: number
    material_cost: number
    other_cost: number
    total: number
  }
  profit: {
    gross: number
    net: number
    margin: number
  }
  // 効率性指標
  efficiency: {
    sales_per_hour: number
    profit_per_area: number
    roi_percentage: number
    productivity_index: number
  }
  // 成長指標
  growth: {
    sales_growth_rate: number
    profit_growth_rate: number
    efficiency_growth_rate: number
  }
  // 基礎データ
  basic_data: {
    total_work_hours: number
    total_area: number
    work_reports_count: number
  }
}

// 表示オプション
interface DisplayOptions {
  showRevenue: boolean
  showExpenses: boolean
  showEfficiency: boolean
  showGrowth: boolean
}

// 勘定項目カテゴリ定義
interface AccountingItem {
  id: string
  name: string
  category: 'income' | 'variable_costs' | 'fixed_costs'
  value: number
  unit?: string
  color?: string
}

interface LegendItemInfo {
  id: string
  name: string
  category: 'income' | 'variable_costs' | 'fixed_costs'
  categoryName: string
  color: string
  totalValue: number
}

interface CategoryData {
  income: AccountingItem[]
  variable_costs: AccountingItem[]
  fixed_costs: AccountingItem[]
}

// カテゴリ別色定義
const CATEGORY_COLORS = {
  income: {
    base: '#22c55e',
    variants: ['#22c55e', '#16a34a', '#84cc16', '#65a30d', '#4ade80', '#10b981']
  },
  variable_costs: {
    base: '#f97316',
    variants: ['#f97316', '#ea580c', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5']
  },
  fixed_costs: {
    base: '#ef4444',
    variants: ['#ef4444', '#dc2626', '#f87171', '#fca5a5', '#fecaca', '#fee2e2']
  }
}

// デモデータ生成関数
function generateDemoFinancialData(startMonth: Date, period: number): FinancialPerformanceData[] {
  const data: FinancialPerformanceData[] = []

  for (let i = 0; i < period * 12; i++) {
    const currentMonth = addMonths(startMonth, i)
    const monthNum = currentMonth.getMonth() + 1
    const year = currentMonth.getFullYear()

    // 季節変動を考慮
    const seasonalFactor = monthNum >= 4 && monthNum <= 10 ? 1.3 : 0.9

    // 収入データ
    const sales = Math.floor((400000 + Math.random() * 200000) * seasonalFactor)
    const harvest_sales = Math.floor((300000 + Math.random() * 150000) * seasonalFactor)
    const other_income = Math.floor(50000 + Math.random() * 50000)
    const total_revenue = sales + harvest_sales + other_income

    // 支出データ
    const labor_cost = Math.floor(150000 + Math.random() * 100000)
    const material_cost = Math.floor(100000 + Math.random() * 80000)
    const other_cost = Math.floor(50000 + Math.random() * 50000)
    const total_expenses = labor_cost + material_cost + other_cost

    // 利益計算
    const gross = total_revenue - total_expenses
    const net = gross * 0.8 // 税引後利益
    const margin = (gross / total_revenue) * 100

    // 効率性指標
    const total_work_hours = 160 + Math.random() * 40
    const sales_per_hour = Math.floor(total_revenue / total_work_hours)
    const profit_per_area = Math.floor(gross / 100)
    const roi_percentage = ((gross / total_expenses) * 100)
    const productivity_index = 70 + Math.random() * 30

    // 成長率（前月比）
    const sales_growth_rate = i > 0 ? (-10 + Math.random() * 30) : 0
    const profit_growth_rate = i > 0 ? (-15 + Math.random() * 35) : 0
    const efficiency_growth_rate = i > 0 ? (-5 + Math.random() * 15) : 0

    data.push({
      month: format(currentMonth, 'M月', { locale: ja }),
      year,
      month_num: monthNum,
      revenue: {
        sales,
        harvest_sales,
        other_income,
        total: total_revenue
      },
      expenses: {
        labor_cost,
        material_cost,
        other_cost,
        total: total_expenses
      },
      profit: {
        gross,
        net,
        margin
      },
      efficiency: {
        sales_per_hour,
        profit_per_area,
        roi_percentage,
        productivity_index
      },
      growth: {
        sales_growth_rate,
        profit_growth_rate,
        efficiency_growth_rate
      },
      basic_data: {
        total_work_hours,
        total_area: 100 + Math.random() * 50,
        work_reports_count: Math.floor(10 + Math.random() * 20)
      }
    })
  }

  return data
}

// カテゴリデータの生成（デモ用）
function generateCategoryData(financialData: FinancialPerformanceData[]): { [month: string]: CategoryData } {
  const categoryData: { [month: string]: CategoryData } = {}

  financialData.forEach(monthData => {
    categoryData[monthData.month] = {
      income: [
        { id: 'sales', name: '売上収入', category: 'income', value: monthData.revenue.sales, color: CATEGORY_COLORS.income.variants[0] },
        { id: 'harvest', name: '収穫物売上', category: 'income', value: monthData.revenue.harvest_sales, color: CATEGORY_COLORS.income.variants[1] },
        { id: 'other_income', name: 'その他収入', category: 'income', value: monthData.revenue.other_income, color: CATEGORY_COLORS.income.variants[2] }
      ],
      variable_costs: [
        { id: 'labor', name: '人件費', category: 'variable_costs', value: monthData.expenses.labor_cost, color: CATEGORY_COLORS.variable_costs.variants[0] },
        { id: 'material', name: '資材費', category: 'variable_costs', value: monthData.expenses.material_cost, color: CATEGORY_COLORS.variable_costs.variants[1] }
      ],
      fixed_costs: [
        { id: 'other', name: 'その他経費', category: 'fixed_costs', value: monthData.expenses.other_cost, color: CATEGORY_COLORS.fixed_costs.variants[0] }
      ]
    }
  })

  return categoryData
}

export default function FinancialPerformanceChartDemoEnhanced() {
  const [startMonth, setStartMonth] = useState<Date>(new Date(new Date().getFullYear(), 0, 1))
  const [yearMonthPickerOpen, setYearMonthPickerOpen] = useState(false)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [selectedMonthNum, setSelectedMonthNum] = useState<number>(1)
  const [displayPeriod, setDisplayPeriod] = useState<1 | 2 | 3>(1)
  const [financialData, setFinancialData] = useState<FinancialPerformanceData[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<FinancialPerformanceData | null>(null)
  const [drilldownOpen, setDrilldownOpen] = useState(false)
  const [demoLimitModalOpen, setDemoLimitModalOpen] = useState(false)
  const [displayOptions, setDisplayOptions] = useState<DisplayOptions>({
    showRevenue: true,
    showExpenses: true,
    showEfficiency: false,
    showGrowth: false
  })
  const [lastUpdated, setLastUpdated] = useState(new Date())

  // 拡張機能用の状態
  const [selectedCategories, setSelectedCategories] = useState<{
    income: boolean
    variable_costs: boolean
    fixed_costs: boolean
  }>({
    income: true,
    variable_costs: true,
    fixed_costs: true
  })
  const [categoryData, setCategoryData] = useState<{ [month: string]: CategoryData }>({})
  const [expandedOthers, setExpandedOthers] = useState<{
    income: boolean
    variable_costs: boolean
    fixed_costs: boolean
  }>({
    income: false,
    variable_costs: false,
    fixed_costs: false
  })
  const [visibleItems, setVisibleItems] = useState<{ [key: string]: boolean }>({})
  const [allAvailableItems, setAllAvailableItems] = useState<{ [key: string]: LegendItemInfo }>({})

  // 累積損益線の制御状態
  const [showCumulativeLine, setShowCumulativeLine] = useState(true)
  const [cumulativeType, setCumulativeType] = useState<'profit' | 'income' | 'expense'>('profit')

  // フィルターセクション展開状態
  const [filterSectionExpanded, setFilterSectionExpanded] = useState({
    period: true,
    category: false
  })

  const [isLegendOpen, setIsLegendOpen] = useState(true)

  const chartRef = useRef<ChartJS<'bar'>>(null)

  // データの初期化と更新
  useEffect(() => {
    const data = generateDemoFinancialData(startMonth, displayPeriod)
    setFinancialData(data)
    setCategoryData(generateCategoryData(data))
    setLastUpdated(new Date())

    // 凡例項目の初期化
    const items: { [key: string]: LegendItemInfo } = {}
    const visible: { [key: string]: boolean } = {}

    data.forEach(monthData => {
      const monthCatData = generateCategoryData([monthData])[monthData.month]

      Object.entries(monthCatData).forEach(([catKey, catItems]) => {
        catItems.forEach(item => {
          if (!items[item.id]) {
            items[item.id] = {
              id: item.id,
              name: item.name,
              category: item.category,
              categoryName: catKey === 'income' ? '収入' : catKey === 'variable_costs' ? '変動費' : '固定費',
              color: item.color || '',
              totalValue: 0
            }
          }
          items[item.id].totalValue += item.value
          visible[item.id] = true
        })
      })
    })

    setAllAvailableItems(items)
    setVisibleItems(visible)
  }, [startMonth, displayPeriod])

  // 年月選択ハンドラー（デモ版では制限）
  const handleYearMonthChange = () => {
    setYearMonthPickerOpen(false)
    setDemoLimitModalOpen(true)
  }

  // グラフクリックハンドラー
  const handleChartClick = (event: ChartEvent, elements: InteractionItem[]) => {
    if (elements.length > 0 && chartRef.current) {
      const element = elements[0]
      const index = element.index
      if (index !== undefined && financialData[index]) {
        setSelectedMonth(financialData[index])
        setDrilldownOpen(true)
      }
    }
  }

  // 累積データ計算機能（選択された項目のみを含む）
  const calculateCumulativeData = useCallback((
    categoryData: { [month: string]: CategoryData },
    dataKeys: string[],
    visibleItems: { [key: string]: boolean }
  ) => {
    const cumulativeData: { [month: string]: { profit: number, income: number, expense: number } } = {}

    let cumulativeProfit = 0
    let cumulativeIncome = 0
    let cumulativeExpense = 0

    dataKeys.forEach(dataKey => {
      const monthData = categoryData[dataKey]

      // 表示中の項目のみを集計
      let monthlyIncome = 0
      let monthlyExpense = 0

      if (monthData) {
        // 収入項目（表示中のもののみ）
        // visibleItemsが空の場合は全て表示とみなす
        monthlyIncome = monthData.income.reduce((sum, item) => {
          const isVisible = Object.keys(visibleItems).length === 0 ? true : visibleItems[item.id]
          if (isVisible) {
            return sum + item.value
          }
          return sum
        }, 0)

        // 変動費項目（表示中のもののみ）
        const monthlyVariableCosts = monthData.variable_costs.reduce((sum, item) => {
          const isVisible = Object.keys(visibleItems).length === 0 ? true : visibleItems[item.id]
          if (isVisible) {
            return sum + item.value
          }
          return sum
        }, 0)

        // 固定費項目（表示中のもののみ）
        const monthlyFixedCosts = monthData.fixed_costs.reduce((sum, item) => {
          const isVisible = Object.keys(visibleItems).length === 0 ? true : visibleItems[item.id]
          if (isVisible) {
            return sum + item.value
          }
          return sum
        }, 0)

        monthlyExpense = monthlyVariableCosts + monthlyFixedCosts
      }

      const monthlyProfit = monthlyIncome - monthlyExpense

      // 累積値を更新
      cumulativeIncome += monthlyIncome
      cumulativeExpense += monthlyExpense
      cumulativeProfit += monthlyProfit

      cumulativeData[dataKey] = {
        profit: cumulativeProfit,
        income: cumulativeIncome,
        expense: cumulativeExpense
      }
    })

    return cumulativeData
  }, [])

  // Chart.js用データセット作成
  const chartData = useMemo(() => {
    if (!financialData || financialData.length === 0) return { labels: [], datasets: [] }

    const labels = financialData.map(d => d.month)
    const datasets = []

    // 収入データ（正の値）
    if (selectedCategories.income && displayOptions.showRevenue) {
      Object.keys(allAvailableItems).forEach((itemId, index) => {
        const item = allAvailableItems[itemId]
        if (item.category === 'income' && visibleItems[itemId]) {
          datasets.push({
            label: item.name,
            data: financialData.map(d => {
              const monthItems = categoryData[d.month]?.income || []
              const foundItem = monthItems.find(i => i.id === itemId)
              return foundItem ? foundItem.value : 0
            }),
            backgroundColor: item.color,
            stack: 'income',
            barPercentage: 0.8,
            categoryPercentage: 0.9,
            order: 2
          })
        }
      })
    }

    // 支出データ（負の値）
    if (displayOptions.showExpenses) {
      if (selectedCategories.variable_costs) {
        Object.keys(allAvailableItems).forEach((itemId, index) => {
          const item = allAvailableItems[itemId]
          if (item.category === 'variable_costs' && visibleItems[itemId]) {
            datasets.push({
              label: item.name,
              data: financialData.map(d => {
                const monthItems = categoryData[d.month]?.variable_costs || []
                const foundItem = monthItems.find(i => i.id === itemId)
                return foundItem ? -foundItem.value : 0
              }),
              backgroundColor: item.color,
              stack: 'expense',
              barPercentage: 0.8,
              categoryPercentage: 0.9,
              order: 3
            })
          }
        })
      }

      if (selectedCategories.fixed_costs) {
        Object.keys(allAvailableItems).forEach((itemId, index) => {
          const item = allAvailableItems[itemId]
          if (item.category === 'fixed_costs' && visibleItems[itemId]) {
            datasets.push({
              label: item.name,
              data: financialData.map(d => {
                const monthItems = categoryData[d.month]?.fixed_costs || []
                const foundItem = monthItems.find(i => i.id === itemId)
                return foundItem ? -foundItem.value : 0
              }),
              backgroundColor: item.color,
              stack: 'expense',
              barPercentage: 0.8,
              categoryPercentage: 0.9,
              order: 3
            })
          }
        })
      }
    }


    // 累積損益線データセット（右Y軸用）
    if (showCumulativeLine && categoryData) {
      const dataKeys = labels.map((_, index) => financialData[index].month)
      const cumulativeData = calculateCumulativeData(categoryData, dataKeys, visibleItems)

      // 表示中の項目数をカウント
      const visibleIncomeCount = Object.entries(visibleItems).filter(([key, visible]) => {
        const item = allAvailableItems[key]
        return visible && item?.category === 'income'
      }).length

      const visibleExpenseCount = Object.entries(visibleItems).filter(([key, visible]) => {
        const item = allAvailableItems[key]
        return visible && (item?.category === 'variable_costs' || item?.category === 'fixed_costs')
      }).length

      let lineData: number[]
      let lineColor: string
      let lineLabel: string

      switch (cumulativeType) {
        case 'profit':
          lineData = dataKeys.map(dataKey => cumulativeData[dataKey]?.profit || 0)
          lineColor = '#059669'
          lineLabel = `📈 累積損益（収入${visibleIncomeCount}項目-支出${visibleExpenseCount}項目）`
          break
        case 'income':
          lineData = dataKeys.map(dataKey => cumulativeData[dataKey]?.income || 0)
          lineColor = '#0284c7'
          lineLabel = `💰 累積収入（${visibleIncomeCount}項目）`
          break
        case 'expense':
          lineData = dataKeys.map(dataKey => -(cumulativeData[dataKey]?.expense || 0))
          lineColor = '#dc2626'
          lineLabel = `💸 累積支出（${visibleExpenseCount}項目）`
          break
        default:
          lineData = []
          lineColor = '#059669'
          lineLabel = ''
      }

      datasets.push({
        type: 'line' as const,
        label: lineLabel,
        data: lineData,
        borderColor: lineColor,
        backgroundColor: `${lineColor}20`,
        borderWidth: 3,
        pointRadius: 5,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: lineColor,
        pointBorderWidth: 2,
        fill: false,
        tension: 0.2,
        yAxisID: 'y1',
        order: -1,
        pointHoverRadius: 7,
        pointHoverBorderWidth: 3
      })
    }

    return { labels, datasets }
  }, [financialData, displayOptions, selectedCategories, visibleItems, allAvailableItems, categoryData, showCumulativeLine, cumulativeType, calculateCumulativeData])

  // Chart.jsオプション
  const chartOptions: ChartOptions<'bar'> = useMemo(() => ({
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
        }
      },
      // 右Y軸（累積損益用）
      y1: {
        type: 'linear' as const,
        position: 'right' as const,
        display: showCumulativeLine,
        grid: {
          drawOnChartArea: false
        },
        ticks: {
          callback: (value) => `¥${Number(value).toLocaleString()}`
        },
        title: {
          display: true,
          text: cumulativeType === 'profit' ? '累積損益' :
                cumulativeType === 'income' ? '累積収入' : '累積支出',
          color: cumulativeType === 'profit' ? '#059669' :
                 cumulativeType === 'income' ? '#0284c7' : '#dc2626',
          font: {
            size: 14,
            weight: '700'
          }
        }
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
  }), [displayPeriod, showCumulativeLine, cumulativeType, handleChartClick])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>収支構造×効率性×成長分析（デモ版）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[600px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-500"></div>
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
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">
                  📊 収支構造分析（収入・費用同時表示）
                </CardTitle>
                <p className="text-green-100 text-sm">
                  Revenue & Cost Structure Analysis - Demo Version
                </p>
              </div>
            </div>
            <Badge variant="outline" className="bg-white/20 text-white border-white/30">
              デモ版
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {/* フィルターコントロール */}
          <div className="mb-6 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg border">
            <div className="flex flex-col">
              {/* 期間選択セクション */}
              <Collapsible open={filterSectionExpanded.period} onOpenChange={(open) => setFilterSectionExpanded(prev => ({ ...prev, period: open }))}>
                <CollapsibleTrigger className="w-full p-3 hover:bg-white/50 transition-all duration-200 border-b border-gray-200 group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ChevronRight className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${filterSectionExpanded.period ? 'rotate-90' : ''}`} />
                      <CalendarIcon className="w-4 h-4 text-gray-600" />
                      <span className="text-sm font-medium text-gray-700">期間設定</span>
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {format(startMonth, 'yyyy年M月', { locale: ja })} から {displayPeriod}年間
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500 group-hover:text-gray-700">
                      {filterSectionExpanded.period ? 'クリックで閉じる' : 'クリックで展開'}
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="p-4">
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* 表示期間選択 */}
                      <div className="flex items-center gap-1 bg-white rounded-lg p-1 shadow-sm">
                        {[1, 2, 3].map((period) => (
                          <Button
                            key={period}
                            variant={displayPeriod === period ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setDisplayPeriod(period as 1 | 2 | 3)}
                            className={`px-3 h-7 text-xs ${
                              displayPeriod === period
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                            }`}
                          >
                            {period}年
                          </Button>
                        ))}
                      </div>

                      {/* 年月選択（デモ版では制限） */}
                      <Popover open={yearMonthPickerOpen} onOpenChange={setYearMonthPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="flex items-center gap-2 min-w-[140px]">
                            <CalendarIcon className="w-4 h-4" />
                            <span className="font-medium">{format(startMonth, 'yyyy年M月', { locale: ja })}</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-0 bg-white border border-gray-300 shadow-xl z-50">
                          <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
                            <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                              📅 分析期間設定
                            </h4>
                            <p className="text-xs text-gray-600 mt-1">開始年月を選択してください（{displayPeriod}年間表示）</p>
                          </div>

                          <div className="p-4 space-y-4">
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-gray-700">年</label>
                              <div className="h-32 overflow-y-auto border border-gray-200 rounded-lg bg-gray-50 p-2">
                                <div className="grid grid-cols-3 gap-2">
                                  {Array.from({length: 10}, (_, i) => new Date().getFullYear() - i).map(year => (
                                    <Button
                                      key={year}
                                      variant={selectedYear === year ? 'default' : 'outline'}
                                      size="sm"
                                      onClick={() => setSelectedYear(year)}
                                      className={`text-xs h-8 ${
                                        selectedYear === year
                                          ? 'bg-blue-600 text-white shadow-md scale-105'
                                          : 'hover:bg-blue-50 bg-white'
                                      } transition-all duration-200`}
                                    >
                                      {year}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="text-sm font-medium text-gray-700">月</label>
                              <div className="grid grid-cols-4 gap-2">
                                {Array.from({length: 12}, (_, i) => i + 1).map(month => (
                                  <Button
                                    key={month}
                                    variant={selectedMonthNum === month ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setSelectedMonthNum(month)}
                                    className={`text-xs ${selectedMonthNum === month ? 'bg-blue-600 text-white' : 'hover:bg-blue-50'}`}
                                  >
                                    {month}月
                                  </Button>
                                ))}
                              </div>
                            </div>

                            <div className="flex gap-2 pt-2">
                              <Button
                                onClick={handleYearMonthChange}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                                size="sm"
                              >
                                ✅ 期間を適用
                              </Button>
                              <Button
                                onClick={() => setYearMonthPickerOpen(false)}
                                variant="outline"
                                size="sm"
                                className="px-4"
                              >
                                キャンセル
                              </Button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="text-xs text-gray-500">
                      最終更新: {lastUpdated.toLocaleString('ja-JP', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* カテゴリ選択と累積線制御セクション */}
              <Collapsible open={filterSectionExpanded.category} onOpenChange={(open) => setFilterSectionExpanded(prev => ({ ...prev, category: open }))}>
                <CollapsibleTrigger className="w-full p-3 hover:bg-white/50 transition-all duration-200 group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ChevronRight className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${filterSectionExpanded.category ? 'rotate-90' : ''}`} />
                      <BarChart3 className="w-4 h-4 text-gray-600" />
                      <span className="text-sm font-medium text-gray-700">表示設定</span>
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {[selectedCategories.income && '収入', selectedCategories.variable_costs && '変動費', selectedCategories.fixed_costs && '固定費'].filter(Boolean).join('・')}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500 group-hover:text-gray-700">
                      {filterSectionExpanded.category ? 'クリックで閉じる' : 'クリックで展開'}
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="p-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* カテゴリ選択 */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700">📊 表示カテゴリ選択</label>
                        <span className="text-xs text-gray-500">（複数選択可）</span>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        <Button
                          variant={selectedCategories.income ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedCategories(prev => ({ ...prev, income: !prev.income }))}
                          className={`text-xs h-8 px-4 ${
                            selectedCategories.income
                              ? 'bg-green-600 text-white shadow-sm'
                              : 'text-gray-600 hover:bg-green-50 border-green-200'
                          }`}
                        >
                          💰 収入 {selectedCategories.income ? '✓' : ''}
                        </Button>
                        <Button
                          variant={selectedCategories.variable_costs ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedCategories(prev => ({ ...prev, variable_costs: !prev.variable_costs }))}
                          className={`text-xs h-8 px-4 ${
                            selectedCategories.variable_costs
                              ? 'bg-orange-600 text-white shadow-sm'
                              : 'text-gray-600 hover:bg-orange-50 border-orange-200'
                          }`}
                        >
                          📈 変動費 {selectedCategories.variable_costs ? '✓' : ''}
                        </Button>
                        <Button
                          variant={selectedCategories.fixed_costs ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedCategories(prev => ({ ...prev, fixed_costs: !prev.fixed_costs }))}
                          className={`text-xs h-8 px-4 ${
                            selectedCategories.fixed_costs
                              ? 'bg-red-600 text-white shadow-sm'
                              : 'text-gray-600 hover:bg-red-50 border-red-200'
                          }`}
                        >
                          🏢 固定費 {selectedCategories.fixed_costs ? '✓' : ''}
                        </Button>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedCategories({ income: true, variable_costs: true, fixed_costs: true })}
                          className="text-xs h-6 px-2 text-blue-600 hover:bg-blue-50"
                        >
                          全選択
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedCategories({ income: false, variable_costs: false, fixed_costs: false })}
                          className="text-xs h-6 px-2 text-gray-500 hover:bg-gray-50"
                        >
                          全解除
                        </Button>
                      </div>
                    </div>

                    {/* 右側：累積損益線制御 */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700">📈 累積損益線制御</label>
                        <span className="text-xs text-gray-500">（右Y軸表示）</span>
                      </div>

                      <div className="flex gap-2 items-center flex-wrap">
                        {/* 累積線ON/OFFトグル */}
                        <Button
                          variant={showCumulativeLine ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setShowCumulativeLine(!showCumulativeLine)}
                          className={`text-xs h-8 px-4 ${
                            showCumulativeLine
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'text-gray-600 hover:bg-emerald-50 border-emerald-200'
                          }`}
                        >
                          📊 累積線 {showCumulativeLine ? '✓' : ''}
                        </Button>

                        {/* 累積線種別選択（累積線がONの時のみ表示） */}
                        {showCumulativeLine && (
                          <>
                            <Button
                              variant={cumulativeType === 'profit' ? 'default' : 'ghost'}
                              size="sm"
                              onClick={() => setCumulativeType('profit')}
                              className={`text-xs h-8 px-3 ${
                                cumulativeType === 'profit'
                                  ? 'bg-emerald-600 text-white shadow-sm'
                                  : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                            >
                              損益
                            </Button>
                            <Button
                              variant={cumulativeType === 'income' ? 'default' : 'ghost'}
                              size="sm"
                              onClick={() => setCumulativeType('income')}
                              className={`text-xs h-8 px-3 ${
                                cumulativeType === 'income'
                                  ? 'bg-blue-600 text-white shadow-sm'
                                  : 'text-blue-600 hover:bg-blue-50'
                              }`}
                            >
                              収入
                            </Button>
                            <Button
                              variant={cumulativeType === 'expense' ? 'default' : 'ghost'}
                              size="sm"
                              onClick={() => setCumulativeType('expense')}
                              className={`text-xs h-8 px-3 ${
                                cumulativeType === 'expense'
                                  ? 'bg-red-600 text-white shadow-sm'
                                  : 'text-red-600 hover:bg-red-50'
                              }`}
                            >
                              支出
                            </Button>
                          </>
                        )}
                      </div>

                      {showCumulativeLine && (
                        <div className="text-xs text-gray-500 mt-2">
                          {cumulativeType === 'profit' && '📈 選択中の収入項目から支出項目を差し引いた累積値を表示'}
                          {cumulativeType === 'income' && '💰 選択中の収入項目の累積合計を表示'}
                          {cumulativeType === 'expense' && '💸 選択中の支出項目の累積合計を表示'}
                        </div>
                      )}
                    </div>

                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>

          {/* グラフ */}
          <div className="relative" style={{ height: '400px' }}>
            <Bar ref={chartRef} data={chartData} options={chartOptions} />
          </div>

          {/* スマート凡例コントロール */}
          <Collapsible open={isLegendOpen} onOpenChange={setIsLegendOpen}>
            <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <CollapsibleTrigger className="w-full">
                <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2 cursor-pointer hover:text-gray-600">
                  <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isLegendOpen ? 'rotate-90' : ''}`} />
                  📊 スマート凡例コントロール
                  <span className="text-xs text-gray-500 ml-auto">
                    {isLegendOpen ? '閉じる' : '展開する'}
                  </span>
                </h4>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-4">
                  {Object.entries({ income: '収入', variable_costs: '変動費', fixed_costs: '固定費' }).map(([catKey, catName]) => (
                    <div key={catKey} className="space-y-2">
                      <h5 className="text-sm font-medium text-gray-700">{catName}</h5>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {Object.entries(allAvailableItems)
                          .filter(([_, item]) => item.category === catKey)
                          .map(([itemId, item]) => (
                            <Button
                              key={itemId}
                              variant={visibleItems[itemId] ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setVisibleItems(prev => ({ ...prev, [itemId]: !prev[itemId] }))}
                              className={`text-xs h-8 px-3 flex items-center gap-2 ${
                                visibleItems[itemId]
                                  ? 'bg-gray-700 text-white'
                                  : 'text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              <div
                                className="w-3 h-3 rounded"
                                style={{ backgroundColor: item.color }}
                              />
                              <span>{item.name}</span>
                              {visibleItems[itemId] && '✓'}
                            </Button>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* デモ版の注意事項 */}
          <div className="mt-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-xs text-yellow-800">
              ※ これはデモ版です。表示データはすべてランダムに生成されたサンプルデータです。
              実際のデータでは詳細な会計項目との連携が可能です。
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 月次詳細ドリルダウンダイアログ */}
      <Dialog open={drilldownOpen} onOpenChange={setDrilldownOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedMonth && `${selectedMonth.year}年${selectedMonth.month} - 詳細分析`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {selectedMonth && (
              <>
                {/* 月次サマリー */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-green-700">
                        ¥{selectedMonth.revenue.total.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600">総収入</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-red-700">
                        ¥{selectedMonth.expenses.total.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600">総支出</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-blue-700">
                        {selectedMonth.profit.margin.toFixed(1)}%
                      </div>
                      <div className="text-sm text-gray-600">利益率</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-purple-700">
                        {selectedMonth.efficiency.roi_percentage.toFixed(0)}%
                      </div>
                      <div className="text-sm text-gray-600">ROI</div>
                    </CardContent>
                  </Card>
                </div>

                {/* 効率性指標詳細 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="w-5 h-5" />
                      効率性指標詳細分析
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-sm">売上/時間</h4>
                          <Badge className="text-xs bg-blue-100 text-blue-700">
                            効率性
                          </Badge>
                        </div>
                        <div className="text-lg font-bold text-gray-800">
                          ¥{selectedMonth.efficiency.sales_per_hour.toLocaleString()}/h
                        </div>
                        <div className="text-xs text-gray-500">
                          労働効率性指標
                        </div>
                      </div>

                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-sm">利益/面積</h4>
                          <Badge className="text-xs bg-green-100 text-green-700">
                            土地効率
                          </Badge>
                        </div>
                        <div className="text-lg font-bold text-gray-800">
                          ¥{selectedMonth.efficiency.profit_per_area.toLocaleString()}/㎡
                        </div>
                        <div className="text-xs text-gray-500">
                          土地生産性指標
                        </div>
                      </div>

                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-sm">ROI</h4>
                          <Badge className="text-xs bg-purple-100 text-purple-700">
                            収益性
                          </Badge>
                        </div>
                        <div className="text-lg font-bold text-gray-800">
                          {selectedMonth.efficiency.roi_percentage.toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-500">
                          投資収益率
                        </div>
                      </div>

                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-sm">生産性指数</h4>
                          <Badge className="text-xs bg-amber-100 text-amber-700">
                            総合
                          </Badge>
                        </div>
                        <div className="text-lg font-bold text-gray-800">
                          {selectedMonth.efficiency.productivity_index.toFixed(0)}
                        </div>
                        <div className="text-xs text-gray-500">
                          総合パフォーマンス
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 成長指標詳細 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      成長指標詳細分析
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium">売上成長率</h4>
                          <Badge className={selectedMonth.growth.sales_growth_rate >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                            {selectedMonth.growth.sales_growth_rate >= 0 ? '成長' : '減少'}
                          </Badge>
                        </div>
                        <div className={`text-2xl font-bold ${selectedMonth.growth.sales_growth_rate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {selectedMonth.growth.sales_growth_rate >= 0 ? '+' : ''}{selectedMonth.growth.sales_growth_rate.toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-500 mt-1">前月比</div>
                      </div>

                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium">利益成長率</h4>
                          <Badge className={selectedMonth.growth.profit_growth_rate >= 0 ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}>
                            {selectedMonth.growth.profit_growth_rate >= 0 ? '増益' : '減益'}
                          </Badge>
                        </div>
                        <div className={`text-2xl font-bold ${selectedMonth.growth.profit_growth_rate >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                          {selectedMonth.growth.profit_growth_rate >= 0 ? '+' : ''}{selectedMonth.growth.profit_growth_rate.toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-500 mt-1">前月比</div>
                      </div>

                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium">効率性成長率</h4>
                          <Badge className={selectedMonth.growth.efficiency_growth_rate >= 0 ? 'bg-purple-100 text-purple-700' : 'bg-red-100 text-red-700'}>
                            {selectedMonth.growth.efficiency_growth_rate >= 0 ? '向上' : '低下'}
                          </Badge>
                        </div>
                        <div className={`text-2xl font-bold ${selectedMonth.growth.efficiency_growth_rate >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                          {selectedMonth.growth.efficiency_growth_rate >= 0 ? '+' : ''}{selectedMonth.growth.efficiency_growth_rate.toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-500 mt-1">前月比</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="text-xs text-gray-500">
                  ※ デモ版のため、実際の会計項目との連携は利用できません
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
              <li>• 実際の会計データとの連携</li>
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