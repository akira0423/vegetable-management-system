'use client'

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  LineElement,
  LineController,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  InteractionItem,
  ChartEvent
} from 'chart.js'
import { Bar } from 'react-chartjs-2'

// Chart.jsコンポーネントを登録
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  LineElement,
  LineController,
  PointElement,
  Title,
  Tooltip,
  Legend
)
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogPortal, DialogOverlay } from '@/components/ui/dialog'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils/index'
import { CalendarIcon, TrendingUp, TrendingDown, Eye, X, Target, Zap, Activity, DollarSign, BarChart3, ChevronUp, ChevronDown, ChevronRight, Settings } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { format, addMonths, subMonths } from 'date-fns'
import { ja } from 'date-fns/locale'

// Supabaseクライアント
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {

} else {

}

const supabase = createClient<Database>(supabaseUrl!, supabaseAnonKey!)

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

interface FinancialPerformanceData {
  month: string
  year: number
  month_num: number
  // 収支構造データ
  revenue: {
    sales: number        // 売上収入
    harvest_sales: number // 収穫物売上
    other_income: number  // その他収入
    total: number        // 総収入
  }
  expenses: {
    labor_cost: number    // 人件費
    material_cost: number // 資材費
    other_cost: number   // その他経費
    total: number        // 総支出
  }
  profit: {
    gross: number        // 粗利益
    net: number         // 純利益
    margin: number      // 利益率(%)
  }
  // 効率性指標
  efficiency: {
    sales_per_hour: number      // 売上/労働時間
    profit_per_area: number     // 利益/面積
    roi_percentage: number      // ROI(%)
    productivity_index: number  // 生産性指数
  }
  // 成長指標
  growth: {
    sales_growth_rate: number   // 売上成長率(%)
    profit_growth_rate: number  // 利益成長率(%)
    efficiency_growth_rate: number // 効率性成長率(%)
  }
  // 基礎データ
  basic_data: {
    total_work_hours: number    // 総労働時間
    total_area: number         // 総面積
    work_reports_count: number  // 作業記録数
  }
}

interface FinancialPerformanceChartProps {
  companyId: string
  selectedVegetables?: string[]
}

// 表示オプション
interface DisplayOptions {
  showRevenue: boolean       // 収入表示
  showExpenses: boolean      // 支出表示
  showEfficiency: boolean    // 効率性表示
  showGrowth: boolean        // 成長率表示
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

export default function FinancialPerformanceChart({ companyId, selectedVegetables = [] }: FinancialPerformanceChartProps) {
  const [startMonth, setStartMonth] = useState<Date>(new Date(new Date().getFullYear(), 0, 1))
  const [yearMonthPickerOpen, setYearMonthPickerOpen] = useState(false)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [selectedMonthNum, setSelectedMonthNum] = useState<number>(1)
  const [displayPeriod, setDisplayPeriod] = useState<1 | 2 | 3>(1)
  const [financialData, setFinancialData] = useState<FinancialPerformanceData[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<FinancialPerformanceData | null>(null)
  const [drilldownOpen, setDrilldownOpen] = useState(false)
  const [displayOptions, setDisplayOptions] = useState<DisplayOptions>({
    showRevenue: true,
    showExpenses: true,
    showEfficiency: true,
    showGrowth: false // デフォルトは非表示（右軸が多くなるため）
  })
  const [lastUpdated, setLastUpdated] = useState(new Date())

  // 新しい拡張機能用の状態
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
  // 右側Y軸は常に最適化モード
  // フィルターセクションの折りたたみ状態（デフォルトは折りたたみ）
  const [filterSectionExpanded, setFilterSectionExpanded] = useState({
    period: false,
    category: false,
    itemControl: false
  })
  const MAX_VISIBLE_ITEMS = 6

  const chartRef = useRef<ChartJS<'bar'>>(null)

  // 実際の勘定項目データを処理（work_report_accountingテーブルから） - APIを使用するように修正
  const processRealAccountingItems = useCallback(async (workReportIds: string[]): Promise<{ [month: string]: CategoryData }> => {
    const monthlyData: { [month: string]: CategoryData } = {}

    if (workReportIds.length === 0) return monthlyData

    try {
      // API経由でデータを取得
      const response = await fetch('/api/financial-performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workReportIds,
          companyId,
          dateRange: {
            start: format(startMonth, 'yyyy-MM-dd'),
            end: format(addMonths(startMonth, displayPeriod * 3 - 1), 'yyyy-MM-dd')
          }
        })
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        console.error('API Error:', result.error)
        // エラー時は推定データを返す
        return processEstimatedAccountingItems(workReportIds)
      }

      if (!result.data || Object.keys(result.data).length === 0) {

        return processEstimatedAccountingItems(workReportIds)
      }

      // APIから返されたデータをそのまま使用
      Object.entries(result.data).forEach(([monthKey, monthData]: [string, any]) => {
        monthlyData[monthKey] = {
          income: monthData.income || [],
          variable_costs: monthData.variable_costs || [],
          fixed_costs: monthData.fixed_costs || []
        }
      })

      // 各項目に色を割り当て（最大6項目は明確に分離、7項目以降は「その他」）
      Object.keys(monthlyData).forEach(monthKey => {
        ['income', 'variable_costs', 'fixed_costs'].forEach(category => {
          const categoryKey = category as keyof CategoryData
          const items = monthlyData[monthKey][categoryKey]
          const colorVariants = CATEGORY_COLORS[categoryKey].variants

          // 金額の大きい順にソート
          items.sort((a, b) => b.value - a.value)

          // 上位6項目は個別に表示、残りは「その他」にまとめる
          if (items.length > MAX_VISIBLE_ITEMS) {
            const topItems = items.slice(0, MAX_VISIBLE_ITEMS)
            const otherItems = items.slice(MAX_VISIBLE_ITEMS)
            const otherTotal = otherItems.reduce((sum, item) => sum + item.value, 0)

            // 上位項目に色を割り当て
            topItems.forEach((item, index) => {
              item.color = colorVariants[index % colorVariants.length]
            })

            // 「その他」項目を追加
            if (otherTotal > 0) {
              topItems.push({
                id: `${categoryKey}_other`,
                name: 'その他',
                category: categoryKey,
                value: otherTotal,
                color: '#9ca3af'  // グレー色
              })
            }

            monthlyData[monthKey][categoryKey] = topItems
          } else {
            // 全項目に色を割り当て
            items.forEach((item, index) => {
              item.color = colorVariants[index % colorVariants.length]
            })
          }
        })
      })


      return monthlyData

    } catch (error) {
      console.error('Error fetching accounting data:', error)
      return processEstimatedAccountingItems(workReportIds)
    }
  }, [companyId, startMonth, displayPeriod])

  // 推定データを生成する関数（実データがない場合のフォールバック）
  const processEstimatedAccountingItems = useCallback(async (workReportIds: string[]): Promise<{ [month: string]: CategoryData }> => {
    const monthlyData: { [month: string]: CategoryData } = {}

    if (workReportIds.length === 0) return monthlyData

    try {
      // work_reportsから各月の作業データを集計
      const { data: workReports, error } = await supabase
        .from('work_reports')
        .select(`
          id,
          work_date,
          work_type,
          work_hours,
          vegetable_id
        `)
        .in('id', workReportIds)
        .order('work_date')

      if (error) {

        return monthlyData
      }

      // 月別に推定データを生成
      const monthGroups = new Map<string, typeof workReports>()
      workReports?.forEach(report => {
        const monthKey = format(new Date(report.work_date), 'yyyy-MM', { locale: ja })
        if (!monthGroups.has(monthKey)) {
          monthGroups.set(monthKey, [])
        }
        monthGroups.get(monthKey)?.push(report)
      })

      monthGroups.forEach((reports, monthKey) => {
        const totalHours = reports.reduce((sum, r) => sum + (r.work_hours || 0), 0)

        // 作業時間から推定収入・費用を計算
        const estimatedIncome = totalHours * 2500  // 時給換算の推定売上
        const laborCost = totalHours * 1500        // 推定人件費
        const materialCost = totalHours * 500      // 推定資材費
        const fixedCost = 30000                    // 月次固定費

        monthlyData[monthKey] = {
          income: [
            {
              id: 'estimated_sales',
              name: '推定売上（作業時間ベース）',
              category: 'income',
              value: estimatedIncome,
              color: CATEGORY_COLORS.income.variants[0]
            }
          ],
          variable_costs: [
            {
              id: 'estimated_labor',
              name: '推定人件費',
              category: 'variable_costs',
              value: laborCost,
              color: CATEGORY_COLORS.variable_costs.variants[0]
            },
            {
              id: 'estimated_material',
              name: '推定資材費',
              category: 'variable_costs',
              value: materialCost,
              color: CATEGORY_COLORS.variable_costs.variants[1]
            }
          ],
          fixed_costs: [
            {
              id: 'estimated_fixed',
              name: '推定固定費',
              category: 'fixed_costs',
              value: fixedCost,
              color: CATEGORY_COLORS.fixed_costs.variants[0]
            }
          ]
        }
      })

      return monthlyData

    } catch (error) {

      return monthlyData
    }
  }, [])

  // データを更新する関数
  const updateData = useCallback(async () => {
    setLoading(true)

    try {
      // 期間内のwork_reportsを取得
      let query = supabase
        .from('work_reports')
        .select('id, work_date, work_type, work_hours, vegetable_id')
        .eq('company_id', companyId)
        .gte('work_date', format(startMonth, 'yyyy-MM-dd'))
        .lte('work_date', format(addMonths(startMonth, displayPeriod * 3 - 1), 'yyyy-MM-dd'))
        .order('work_date')

      if (selectedVegetables && selectedVegetables.length > 0) {
        query = query.in('vegetable_id', selectedVegetables)
      }

      const { data: workReports, error } = await query

      if (error) {

        setFinancialData([])
        setCategoryData({})
        return
      }

      if (!workReports || workReports.length === 0) {

        setFinancialData([])
        setCategoryData({})
        return
      }

      const workReportIds = workReports.map(r => r.id)

      // 実際の勘定項目データを処理
      const accountingData = await processRealAccountingItems(workReportIds)
      setCategoryData(accountingData)

      // 月別データを集計
      const monthlyData = new Map<string, FinancialPerformanceData>()

      // 基本的な月別集計
      for (let i = 0; i < displayPeriod * 3; i++) {
        const currentMonth = addMonths(startMonth, i)
        const monthKey = format(currentMonth, 'yyyy-MM', { locale: ja })
        const year = currentMonth.getFullYear()
        const month_num = currentMonth.getMonth() + 1

        // 該当月のwork_reports
        const monthReports = workReports.filter(report => {
          const reportMonth = format(new Date(report.work_date), 'yyyy-MM', { locale: ja })
          return reportMonth === monthKey
        })

        // 基礎データの集計
        const totalWorkHours = monthReports.reduce((sum, r) => sum + (r.work_hours || 0), 0)
        const workReportsCount = monthReports.length

        // 勘定項目データから収支を計算
        const monthAccounting = accountingData[monthKey] || {
          income: [],
          variable_costs: [],
          fixed_costs: []
        }

        const totalIncome = monthAccounting.income.reduce((sum, item) => sum + item.value, 0)
        const totalVariableCosts = monthAccounting.variable_costs.reduce((sum, item) => sum + item.value, 0)
        const totalFixedCosts = monthAccounting.fixed_costs.reduce((sum, item) => sum + item.value, 0)
        const totalExpenses = totalVariableCosts + totalFixedCosts
        const netProfit = totalIncome - totalExpenses
        const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0

        // 効率性指標の計算
        const salesPerHour = totalWorkHours > 0 ? totalIncome / totalWorkHours : 0
        const roi = totalExpenses > 0 ? ((totalIncome - totalExpenses) / totalExpenses) * 100 : 0
        const productivityIndex = totalWorkHours > 0 ? netProfit / totalWorkHours : 0

        monthlyData.set(monthKey, {
          month: format(currentMonth, 'yyyy年M月', { locale: ja }),
          year,
          month_num,
          revenue: {
            sales: totalIncome,
            harvest_sales: totalIncome * 0.7,  // 推定値
            other_income: totalIncome * 0.3,   // 推定値
            total: totalIncome
          },
          expenses: {
            labor_cost: totalVariableCosts * 0.6,    // 推定配分
            material_cost: totalVariableCosts * 0.4,  // 推定配分
            other_cost: totalFixedCosts,
            total: totalExpenses
          },
          profit: {
            gross: totalIncome - totalVariableCosts,
            net: netProfit,
            margin: profitMargin
          },
          efficiency: {
            sales_per_hour: salesPerHour,
            profit_per_area: 0,  // 面積データがないため0
            roi_percentage: roi,
            productivity_index: productivityIndex
          },
          growth: {
            sales_growth_rate: 0,     // 前月比は後で計算
            profit_growth_rate: 0,    // 前月比は後で計算
            efficiency_growth_rate: 0 // 前月比は後で計算
          },
          basic_data: {
            total_work_hours: totalWorkHours,
            total_area: 0,  // 面積データがないため0
            work_reports_count: workReportsCount
          }
        })
      }

      // 成長率の計算（前月比）
      const sortedMonths = Array.from(monthlyData.keys()).sort()
      sortedMonths.forEach((monthKey, index) => {
        if (index > 0) {
          const currentData = monthlyData.get(monthKey)!
          const prevData = monthlyData.get(sortedMonths[index - 1])!

          // 成長率計算
          currentData.growth.sales_growth_rate = prevData.revenue.total > 0
            ? ((currentData.revenue.total - prevData.revenue.total) / prevData.revenue.total) * 100
            : 0

          currentData.growth.profit_growth_rate = prevData.profit.net !== 0
            ? ((currentData.profit.net - prevData.profit.net) / Math.abs(prevData.profit.net)) * 100
            : 0

          currentData.growth.efficiency_growth_rate = prevData.efficiency.productivity_index > 0
            ? ((currentData.efficiency.productivity_index - prevData.efficiency.productivity_index) / prevData.efficiency.productivity_index) * 100
            : 0
        }
      })

      // 配列に変換してセット
      setFinancialData(Array.from(monthlyData.values()))

      // 全項目の情報を収集（凡例表示用）
      const itemsInfo: { [key: string]: LegendItemInfo } = {}
      Object.values(accountingData).forEach(monthData => {
        ['income', 'variable_costs', 'fixed_costs'].forEach(category => {
          const categoryKey = category as keyof CategoryData
          const categoryName = category === 'income' ? '収入' :
                              category === 'variable_costs' ? '変動費' : '固定費'

          monthData[categoryKey].forEach(item => {
            const itemKey = `${category}_${item.id}`
            if (!itemsInfo[itemKey]) {
              itemsInfo[itemKey] = {
                id: item.id,
                name: item.name,
                category: categoryKey,
                categoryName,
                color: item.color || '#999',
                totalValue: 0
              }
            }
            itemsInfo[itemKey].totalValue += item.value
          })
        })
      })
      setAllAvailableItems(itemsInfo)

      // 初期表示設定（金額上位の項目を表示）
      const sortedItems = Object.entries(itemsInfo)
        .sort(([, a], [, b]) => b.totalValue - a.totalValue)
        .slice(0, 10)

      const initialVisible: { [key: string]: boolean } = {}
      sortedItems.forEach(([key]) => {
        initialVisible[key] = true
      })
      setVisibleItems(initialVisible)

    } catch (error) {

      setFinancialData([])
      setCategoryData({})
    } finally {
      setLoading(false)
      setLastUpdated(new Date())
    }
  }, [companyId, startMonth, displayPeriod, selectedVegetables, processRealAccountingItems, processEstimatedAccountingItems])

  // 初回レンダリング時とパラメータ変更時にデータを取得
  useEffect(() => {
    updateData()
  }, [updateData])

  // チャートデータの生成
  const chartData = useMemo(() => {
    if (financialData.length === 0 && Object.keys(categoryData).length === 0) return null

    const labels = financialData.map(d => d.month)
    const datasets: any[] = []

    // 勘定項目別のスタックバー（詳細表示）
    if (Object.keys(categoryData).length > 0) {
      // 表示する項目をフィルタリング
      const itemDatasets = new Map<string, any>()

      Object.entries(categoryData).forEach(([monthKey, monthData]) => {
        const monthIndex = Object.keys(categoryData).sort().indexOf(monthKey)

        ['income', 'variable_costs', 'fixed_costs'].forEach(category => {
          const categoryKey = category as keyof CategoryData

          if (selectedCategories[categoryKey]) {
            monthData[categoryKey].forEach(item => {
              const itemKey = `${category}_${item.id}`

              // 表示対象かチェック
              const isVisible = visibleItems[itemKey] !== false
              if (!isVisible) return

              if (!itemDatasets.has(itemKey)) {
                const itemInfo = allAvailableItems[itemKey] || {
                  name: item.name,
                  color: item.color || '#999',
                  category: categoryKey,
                  categoryName: category === 'income' ? '収入' :
                               category === 'variable_costs' ? '変動費' : '固定費'
                }

                itemDatasets.set(itemKey, {
                  label: `${itemInfo.categoryName}: ${itemInfo.name}`,
                  data: new Array(Object.keys(categoryData).length).fill(0),
                  backgroundColor: itemInfo.color,
                  borderColor: itemInfo.color,
                  borderWidth: 1,
                  stack: categoryKey,
                  categoryGroup: true,
                  yAxisID: 'y',
                  // カスタムツールチップ用
                  category: categoryKey
                })
              }

              const dataset = itemDatasets.get(itemKey)
              if (dataset) {
                // 費用項目は負の値として表示
                const value = categoryKey === 'income' ? item.value : -item.value
                dataset.data[monthIndex] = value
              }
            })
          }
        })
      })

      // datasetsに追加
      itemDatasets.forEach(dataset => {
        datasets.push(dataset)
      })
    }

    // 累積線の追加（右軸）
    if (showCumulativeLine && financialData.length > 0) {
      let cumulativeData: number[] = []
      let runningTotal = 0

      if (cumulativeType === 'profit') {
        financialData.forEach(d => {
          runningTotal += d.profit.net
          cumulativeData.push(runningTotal)
        })
      } else if (cumulativeType === 'income') {
        financialData.forEach(d => {
          runningTotal += d.revenue.total
          cumulativeData.push(runningTotal)
        })
      } else if (cumulativeType === 'expense') {
        financialData.forEach(d => {
          runningTotal += d.expenses.total
          cumulativeData.push(runningTotal)
        })
      }

      datasets.push({
        label: cumulativeType === 'profit' ? '累積損益' :
               cumulativeType === 'income' ? '累積収入' : '累積支出',
        data: cumulativeData,
        type: 'line',
        borderColor: cumulativeType === 'profit' ? '#6366f1' :
                     cumulativeType === 'income' ? '#10b981' : '#ef4444',
        backgroundColor: 'transparent',
        borderWidth: 3,
        tension: 0.4,
        yAxisID: 'y1',
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBackgroundColor: '#fff',
        pointBorderWidth: 2,
        order: -1  // 線を最前面に
      })
    }

    // 効率性指標の追加（右軸）
    if (displayOptions.showEfficiency && financialData.length > 0) {
      datasets.push({
        label: '生産性指数',
        data: financialData.map(d => d.efficiency.productivity_index),
        type: 'line',
        borderColor: '#f59e0b',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [5, 5],
        tension: 0.4,
        yAxisID: 'y1',
        pointRadius: 4,
        pointHoverRadius: 6
      })
    }

    return {
      labels,
      datasets
    }
  }, [financialData, categoryData, selectedCategories, visibleItems, allAvailableItems, showCumulativeLine, cumulativeType, displayOptions.showEfficiency])

  // チャートオプション
  const chartOptions: ChartOptions<'bar'> = useMemo(() => {
    // Y軸の範囲を計算
    let maxLeftValue = 0
    let minLeftValue = 0
    let maxRightValue = 0
    let minRightValue = 0

    if (chartData) {
      chartData.datasets.forEach(dataset => {
        if (dataset.yAxisID === 'y1') {
          // 右軸のデータ
          const values = dataset.data as number[]
          maxRightValue = Math.max(maxRightValue, ...values)
          minRightValue = Math.min(minRightValue, ...values)
        } else {
          // 左軸のデータ
          const values = dataset.data as number[]
          maxLeftValue = Math.max(maxLeftValue, ...values)
          minLeftValue = Math.min(minLeftValue, ...values)
        }
      })
    }

    // 左軸の範囲設定（少し余裕を持たせる）
    const leftPadding = (maxLeftValue - minLeftValue) * 0.1
    const leftMax = maxLeftValue + leftPadding
    const leftMin = minLeftValue - leftPadding

    // 右軸の範囲設定
    const rightPadding = (maxRightValue - minRightValue) * 0.1
    const rightMax = maxRightValue + rightPadding
    const rightMin = minRightValue - rightPadding

    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index' as const,
        intersect: false,
      },
      plugins: {
        legend: {
          display: false  // カスタム凡例を使用するため非表示
        },
        title: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context: any) {
              const label = context.dataset.label || ''
              const value = context.parsed.y
              const formatted = Math.abs(value).toLocaleString()
              const prefix = value < 0 ? '-' : ''
              return `${label}: ${prefix}¥${formatted}`
            },
            footer: function(tooltipItems: any) {
              // カテゴリ別の合計を計算
              let incomeTotal = 0
              let expenseTotal = 0

              tooltipItems.forEach((item: any) => {
                const value = item.parsed.y
                if (item.dataset.category === 'income') {
                  incomeTotal += value
                } else if (item.dataset.category === 'variable_costs' || item.dataset.category === 'fixed_costs') {
                  expenseTotal += Math.abs(value)
                }
              })

              const profit = incomeTotal - expenseTotal
              return [
                '',
                `収入計: ¥${incomeTotal.toLocaleString()}`,
                `支出計: ¥${expenseTotal.toLocaleString()}`,
                `利益: ¥${profit.toLocaleString()}`
              ]
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          grid: {
            display: false
          }
        },
        y: {
          stacked: true,
          position: 'left',
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          },
          max: leftMax,
          min: leftMin,
          ticks: {
            callback: function(value: any) {
              const absValue = Math.abs(value)
              if (absValue >= 1000000) {
                return (value < 0 ? '-' : '') + '¥' + (absValue / 1000000).toFixed(1) + 'M'
              } else if (absValue >= 1000) {
                return (value < 0 ? '-' : '') + '¥' + (absValue / 1000).toFixed(0) + 'k'
              } else {
                return (value < 0 ? '-' : '') + '¥' + absValue
              }
            }
          }
        },
        y1: {
          position: 'right',
          grid: {
            drawOnChartArea: false
          },
          max: rightMax,
          min: rightMin,
          ticks: {
            callback: function(value: any) {
              const absValue = Math.abs(value)
              if (showCumulativeLine || displayOptions.showEfficiency) {
                if (absValue >= 1000000) {
                  return (value < 0 ? '-' : '') + '¥' + (absValue / 1000000).toFixed(1) + 'M'
                } else if (absValue >= 1000) {
                  return (value < 0 ? '-' : '') + '¥' + (absValue / 1000).toFixed(0) + 'k'
                } else {
                  return (value < 0 ? '-' : '') + '¥' + absValue
                }
              }
              return ''
            }
          }
        }
      }
    }
  }, [chartData, showCumulativeLine, displayOptions.showEfficiency])

  // チャートクリックハンドラー
  const handleChartClick = (event: ChartEvent, elements: InteractionItem[]) => {
    if (elements.length > 0 && financialData.length > 0) {
      const index = elements[0].index
      setSelectedMonth(financialData[index])
      setDrilldownOpen(true)
    }
  }

  // 年月選択ハンドラー
  const handleYearMonthSelect = () => {
    const newDate = new Date(selectedYear, selectedMonthNum - 1, 1)
    setStartMonth(newDate)
    setYearMonthPickerOpen(false)
  }

  // 期間移動ハンドラー
  const movePeriod = (direction: 'prev' | 'next') => {
    const months = displayPeriod * 3
    if (direction === 'prev') {
      setStartMonth(prev => subMonths(prev, months))
    } else {
      setStartMonth(prev => addMonths(prev, months))
    }
  }

  // カスタムダイアログコンテンツ（大画面対応）
  const LargeDialogContent = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
  >(({ className, children, ...props }, ref) => (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-6xl translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg max-h-[90vh] overflow-y-auto",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  ))
  LargeDialogContent.displayName = DialogPrimitive.Content.displayName

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl">📊 収支構造分析（収入・費用同時表示）</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              月別の詳細な収入と費用の内訳を可視化 • 各勘定項目を個別表示
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {lastUpdated && format(lastUpdated, 'HH:mm更新', { locale: ja })}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={updateData}
              disabled={loading}
              className="h-8"
            >
              更新
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {/* フィルターセクション */}
        <div className="space-y-3 mb-6">
          {/* 期間選択 */}
          <Collapsible
            open={filterSectionExpanded.period}
            onOpenChange={(open) => setFilterSectionExpanded(prev => ({ ...prev, period: open }))}
          >
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors">
              {filterSectionExpanded.period ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              表示期間設定
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => movePeriod('prev')}
                  className="h-8"
                >
                  ←
                </Button>

                <Popover open={yearMonthPickerOpen} onOpenChange={setYearMonthPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[240px] justify-start text-left font-normal h-8",
                        !startMonth && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startMonth ? (
                        format(startMonth, "yyyy年M月", { locale: ja }) + " から"
                      ) : (
                        <span>開始月を選択</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-4" align="start">
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <Select
                          value={selectedYear.toString()}
                          onValueChange={(value) => setSelectedYear(parseInt(value))}
                        >
                          <SelectTrigger className="w-[110px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[2020, 2021, 2022, 2023, 2024, 2025].map((year) => (
                              <SelectItem key={year} value={year.toString()}>
                                {year}年
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={selectedMonthNum.toString()}
                          onValueChange={(value) => setSelectedMonthNum(parseInt(value))}
                        >
                          <SelectTrigger className="w-[90px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[...Array(12)].map((_, i) => (
                              <SelectItem key={i + 1} value={(i + 1).toString()}>
                                {i + 1}月
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        onClick={handleYearMonthSelect}
                        className="w-full"
                        size="sm"
                      >
                        設定
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>

                <Select
                  value={displayPeriod.toString()}
                  onValueChange={(value) => setDisplayPeriod(parseInt(value) as 1 | 2 | 3)}
                >
                  <SelectTrigger className="w-[120px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">3ヶ月</SelectItem>
                    <SelectItem value="2">6ヶ月</SelectItem>
                    <SelectItem value="3">9ヶ月</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => movePeriod('next')}
                  className="h-8"
                >
                  →
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* カテゴリフィルター */}
          <Collapsible
            open={filterSectionExpanded.category}
            onOpenChange={(open) => setFilterSectionExpanded(prev => ({ ...prev, category: open }))}
          >
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors">
              {filterSectionExpanded.category ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              表示カテゴリ
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="flex gap-3 flex-wrap">
                <Button
                  size="sm"
                  variant={selectedCategories.income ? "default" : "outline"}
                  onClick={() => setSelectedCategories(prev => ({ ...prev, income: !prev.income }))}
                  className="h-8"
                >
                  収入
                </Button>
                <Button
                  size="sm"
                  variant={selectedCategories.variable_costs ? "default" : "outline"}
                  onClick={() => setSelectedCategories(prev => ({ ...prev, variable_costs: !prev.variable_costs }))}
                  className="h-8"
                >
                  変動費
                </Button>
                <Button
                  size="sm"
                  variant={selectedCategories.fixed_costs ? "default" : "outline"}
                  onClick={() => setSelectedCategories(prev => ({ ...prev, fixed_costs: !prev.fixed_costs }))}
                  className="h-8"
                >
                  固定費
                </Button>

                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-sm text-muted-foreground">累積線:</span>
                  <Select
                    value={showCumulativeLine ? cumulativeType : 'none'}
                    onValueChange={(value) => {
                      if (value === 'none') {
                        setShowCumulativeLine(false)
                      } else {
                        setShowCumulativeLine(true)
                        setCumulativeType(value as 'profit' | 'income' | 'expense')
                      }
                    }}
                  >
                    <SelectTrigger className="w-[100px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">非表示</SelectItem>
                      <SelectItem value="profit">累積損益</SelectItem>
                      <SelectItem value="income">累積収入</SelectItem>
                      <SelectItem value="expense">累積支出</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* 項目別表示コントロール */}
          <Collapsible
            open={filterSectionExpanded.itemControl}
            onOpenChange={(open) => setFilterSectionExpanded(prev => ({ ...prev, itemControl: open }))}
          >
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors">
              {filterSectionExpanded.itemControl ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              勘定項目の個別表示設定
              <Badge variant="secondary" className="ml-2">
                {Object.values(visibleItems).filter(v => v).length} / {Object.keys(allAvailableItems).length}
              </Badge>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="grid grid-cols-3 gap-4">
                {/* 収入項目 */}
                <div>
                  <h4 className="text-sm font-medium mb-2 text-green-600">収入項目</h4>
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {Object.entries(allAvailableItems)
                      .filter(([, item]) => item.category === 'income')
                      .sort(([, a], [, b]) => b.totalValue - a.totalValue)
                      .map(([key, item]) => (
                        <label key={key} className="flex items-center gap-2 text-sm hover:bg-muted/50 p-1 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visibleItems[key] !== false}
                            onChange={(e) => setVisibleItems(prev => ({ ...prev, [key]: e.target.checked }))}
                            className="rounded"
                          />
                          <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }} />
                          <span className="flex-1 truncate">{item.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ¥{(item.totalValue / 1000).toFixed(0)}k
                          </span>
                        </label>
                      ))}
                  </div>
                </div>

                {/* 変動費項目 */}
                <div>
                  <h4 className="text-sm font-medium mb-2 text-orange-600">変動費項目</h4>
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {Object.entries(allAvailableItems)
                      .filter(([, item]) => item.category === 'variable_costs')
                      .sort(([, a], [, b]) => b.totalValue - a.totalValue)
                      .map(([key, item]) => (
                        <label key={key} className="flex items-center gap-2 text-sm hover:bg-muted/50 p-1 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visibleItems[key] !== false}
                            onChange={(e) => setVisibleItems(prev => ({ ...prev, [key]: e.target.checked }))}
                            className="rounded"
                          />
                          <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }} />
                          <span className="flex-1 truncate">{item.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ¥{(item.totalValue / 1000).toFixed(0)}k
                          </span>
                        </label>
                      ))}
                  </div>
                </div>

                {/* 固定費項目 */}
                <div>
                  <h4 className="text-sm font-medium mb-2 text-red-600">固定費項目</h4>
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {Object.entries(allAvailableItems)
                      .filter(([, item]) => item.category === 'fixed_costs')
                      .sort(([, a], [, b]) => b.totalValue - a.totalValue)
                      .map(([key, item]) => (
                        <label key={key} className="flex items-center gap-2 text-sm hover:bg-muted/50 p-1 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visibleItems[key] !== false}
                            onChange={(e) => setVisibleItems(prev => ({ ...prev, [key]: e.target.checked }))}
                            className="rounded"
                          />
                          <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }} />
                          <span className="flex-1 truncate">{item.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ¥{(item.totalValue / 1000).toFixed(0)}k
                          </span>
                        </label>
                      ))}
                  </div>
                </div>
              </div>

              {/* 一括操作ボタン */}
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const allKeys = Object.keys(allAvailableItems)
                    const newVisible: { [key: string]: boolean } = {}
                    allKeys.forEach(key => {
                      newVisible[key] = true
                    })
                    setVisibleItems(newVisible)
                  }}
                  className="h-7 text-xs"
                >
                  すべて表示
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setVisibleItems({})}
                  className="h-7 text-xs"
                >
                  すべて非表示
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    // 金額上位10項目のみ表示
                    const sortedItems = Object.entries(allAvailableItems)
                      .sort(([, a], [, b]) => b.totalValue - a.totalValue)
                      .slice(0, 10)

                    const newVisible: { [key: string]: boolean } = {}
                    sortedItems.forEach(([key]) => {
                      newVisible[key] = true
                    })
                    setVisibleItems(newVisible)
                  }}
                  className="h-7 text-xs"
                >
                  上位10項目
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* グラフエリア */}
        <div className="relative">
          {loading && (
            <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">データ読み込み中...</p>
              </div>
            </div>
          )}

          {chartData ? (
            <div className="h-[500px]">
              <Bar
                ref={chartRef}
                data={chartData}
                options={{
                  ...chartOptions,
                  onClick: handleChartClick as any
                }}
              />
            </div>
          ) : (
            !loading && (
              <div className="h-[500px] flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>表示するデータがありません</p>
                  <p className="text-sm mt-1">期間を変更するか、データを登録してください</p>
                </div>
              </div>
            )
          )}
        </div>

        {/* サマリー情報 */}
        {financialData.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t">
            <div>
              <p className="text-sm text-muted-foreground">期間合計収入</p>
              <p className="text-xl font-bold text-green-600">
                ¥{financialData.reduce((sum, d) => sum + d.revenue.total, 0).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">期間合計支出</p>
              <p className="text-xl font-bold text-red-600">
                ¥{financialData.reduce((sum, d) => sum + d.expenses.total, 0).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">期間純利益</p>
              <p className={cn(
                "text-xl font-bold",
                financialData.reduce((sum, d) => sum + d.profit.net, 0) >= 0 ? "text-blue-600" : "text-red-600"
              )}>
                ¥{financialData.reduce((sum, d) => sum + d.profit.net, 0).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">平均利益率</p>
              <p className="text-xl font-bold text-purple-600">
                {(financialData.reduce((sum, d) => sum + d.profit.margin, 0) / financialData.length).toFixed(1)}%
              </p>
            </div>
          </div>
        )}
      </CardContent>

      {/* 詳細ドリルダウンダイアログ */}
      <Dialog open={drilldownOpen} onOpenChange={setDrilldownOpen}>
        <LargeDialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedMonth?.month} の詳細分析
            </DialogTitle>
          </DialogHeader>

          {selectedMonth && (
            <div className="space-y-6">
              {/* 基本指標 */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">総収入</p>
                      <p className="text-2xl font-bold text-green-600">
                        ¥{selectedMonth.revenue.total.toLocaleString()}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-600 opacity-20" />
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">総支出</p>
                      <p className="text-2xl font-bold text-red-600">
                        ¥{selectedMonth.expenses.total.toLocaleString()}
                      </p>
                    </div>
                    <TrendingDown className="h-8 w-8 text-red-600 opacity-20" />
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">純利益</p>
                      <p className={cn(
                        "text-2xl font-bold",
                        selectedMonth.profit.net >= 0 ? "text-blue-600" : "text-red-600"
                      )}>
                        ¥{selectedMonth.profit.net.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        利益率: {selectedMonth.profit.margin.toFixed(1)}%
                      </p>
                    </div>
                    <DollarSign className="h-8 w-8 text-blue-600 opacity-20" />
                  </div>
                </Card>
              </div>

              {/* 効率性指標 */}
              <div>
                <h3 className="text-lg font-semibold mb-3">効率性指標</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">売上/時間</p>
                    <p className="text-lg font-semibold">
                      ¥{selectedMonth.efficiency.sales_per_hour.toLocaleString()}/h
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">ROI</p>
                    <p className="text-lg font-semibold">
                      {selectedMonth.efficiency.roi_percentage.toFixed(1)}%
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">生産性指数</p>
                    <p className="text-lg font-semibold">
                      {selectedMonth.efficiency.productivity_index.toFixed(0)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">総労働時間</p>
                    <p className="text-lg font-semibold">
                      {selectedMonth.basic_data.total_work_hours.toFixed(1)}h
                    </p>
                  </div>
                </div>
              </div>

              {/* 成長指標（前月比） */}
              <div>
                <h3 className="text-lg font-semibold mb-3">成長指標（前月比）</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center",
                      selectedMonth.growth.sales_growth_rate >= 0 ? "bg-green-100" : "bg-red-100"
                    )}>
                      {selectedMonth.growth.sales_growth_rate >= 0 ? (
                        <TrendingUp className="h-6 w-6 text-green-600" />
                      ) : (
                        <TrendingDown className="h-6 w-6 text-red-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">売上成長率</p>
                      <p className={cn(
                        "text-lg font-semibold",
                        selectedMonth.growth.sales_growth_rate >= 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {selectedMonth.growth.sales_growth_rate >= 0 ? "+" : ""}
                        {selectedMonth.growth.sales_growth_rate.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center",
                      selectedMonth.growth.profit_growth_rate >= 0 ? "bg-green-100" : "bg-red-100"
                    )}>
                      {selectedMonth.growth.profit_growth_rate >= 0 ? (
                        <TrendingUp className="h-6 w-6 text-green-600" />
                      ) : (
                        <TrendingDown className="h-6 w-6 text-red-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">利益成長率</p>
                      <p className={cn(
                        "text-lg font-semibold",
                        selectedMonth.growth.profit_growth_rate >= 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {selectedMonth.growth.profit_growth_rate >= 0 ? "+" : ""}
                        {selectedMonth.growth.profit_growth_rate.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center",
                      selectedMonth.growth.efficiency_growth_rate >= 0 ? "bg-green-100" : "bg-red-100"
                    )}>
                      {selectedMonth.growth.efficiency_growth_rate >= 0 ? (
                        <Zap className="h-6 w-6 text-green-600" />
                      ) : (
                        <Activity className="h-6 w-6 text-red-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">効率性成長率</p>
                      <p className={cn(
                        "text-lg font-semibold",
                        selectedMonth.growth.efficiency_growth_rate >= 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {selectedMonth.growth.efficiency_growth_rate >= 0 ? "+" : ""}
                        {selectedMonth.growth.efficiency_growth_rate.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 勘定項目の詳細（該当月のデータがある場合） */}
              {categoryData[format(new Date(selectedMonth.year, selectedMonth.month_num - 1, 1), 'yyyy-MM', { locale: ja })] && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">勘定項目の内訳</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {/* 収入の内訳 */}
                    <div>
                      <h4 className="text-sm font-medium text-green-600 mb-2">収入項目</h4>
                      <div className="space-y-2">
                        {categoryData[format(new Date(selectedMonth.year, selectedMonth.month_num - 1, 1), 'yyyy-MM', { locale: ja })].income.map((item, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-green-50 rounded">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded"
                                style={{ backgroundColor: item.color || CATEGORY_COLORS.income.variants[index % CATEGORY_COLORS.income.variants.length] }}
                              />
                              <span className="text-sm">{item.name}</span>
                            </div>
                            <span className="text-sm font-medium">¥{item.value.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 変動費の内訳 */}
                    <div>
                      <h4 className="text-sm font-medium text-orange-600 mb-2">変動費項目</h4>
                      <div className="space-y-2">
                        {categoryData[format(new Date(selectedMonth.year, selectedMonth.month_num - 1, 1), 'yyyy-MM', { locale: ja })].variable_costs.map((item, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-orange-50 rounded">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded"
                                style={{ backgroundColor: item.color || CATEGORY_COLORS.variable_costs.variants[index % CATEGORY_COLORS.variable_costs.variants.length] }}
                              />
                              <span className="text-sm">{item.name}</span>
                            </div>
                            <span className="text-sm font-medium">¥{item.value.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 固定費の内訳 */}
                    <div>
                      <h4 className="text-sm font-medium text-red-600 mb-2">固定費項目</h4>
                      <div className="space-y-2">
                        {categoryData[format(new Date(selectedMonth.year, selectedMonth.month_num - 1, 1), 'yyyy-MM', { locale: ja })].fixed_costs.map((item, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-red-50 rounded">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded"
                                style={{ backgroundColor: item.color || CATEGORY_COLORS.fixed_costs.variants[index % CATEGORY_COLORS.fixed_costs.variants.length] }}
                              />
                              <span className="text-sm">{item.name}</span>
                            </div>
                            <span className="text-sm font-medium">¥{item.value.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </LargeDialogContent>
      </Dialog>
    </Card>
  )
}