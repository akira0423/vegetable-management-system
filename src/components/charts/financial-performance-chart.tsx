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
  // 現在の年月から過去1年を表示するように設定
  const currentDate = new Date()
  const defaultStartMonth = new Date(currentDate.getFullYear() - 1, currentDate.getMonth(), 1)
  const [startMonth, setStartMonth] = useState<Date>(defaultStartMonth)
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
  
  // 実際の勘定項目データを処理（work_report_accountingテーブルから）
  const processRealAccountingItems = useCallback(async (workReportIds: string[]): Promise<{ [month: string]: CategoryData }> => {
    const monthlyData: { [month: string]: CategoryData } = {}
    
    if (workReportIds.length === 0) return monthlyData
    
    try {
      // work_report_accountingと accounting_itemsを結合して取得
      console.log('🔍 収支構造分析: work_report_accountingクエリ実行', {
        workReportIds: workReportIds.slice(0, 3)
      })

      const { data: accountingData, error } = await supabase
        .from('work_report_accounting')
        .select(`
          id,
          work_report_id,
          accounting_item_id,
          amount,
          work_reports!inner (
            work_date
          ),
          accounting_items!inner (
            id,
            name,
            code,
            cost_type
          )
        `)
        .in('work_report_id', workReportIds)
        .order('work_report_id')

      if (error) {
        console.error('❌ 収支構造分析: accountingクエリエラー', error)
        // エラー時は推定データを返す
        return processEstimatedAccountingItems(workReportIds)
      }
      
      if (!accountingData || accountingData.length === 0) {
        console.warn('⚠️ 収支構造分析: accountingDataが空のため推定データを使用')
        return processEstimatedAccountingItems(workReportIds)
      }
      console.log('📝 収支構造分析: accounting_itemsデータ取得', accountingData.length, '件')
      
      // 月別・項目別にデータを集約（年月で区別）
      accountingData.forEach((record: any) => {
        const workDate = new Date(record.work_reports.work_date)
        const monthKey = format(workDate, 'yyyy-MM', { locale: ja })
        const costType = record.accounting_items.cost_type
        const categoryKey = costType === 'income' ? 'income' : 
                           costType === 'variable_cost' ? 'variable_costs' : 'fixed_costs'
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = {
            income: [],
            variable_costs: [],
            fixed_costs: []
          }
        }
        
        // 既存の項目を探す
        const existingItem = monthlyData[monthKey][categoryKey].find(
          item => item.id === record.accounting_items.id
        )
        
        if (existingItem) {
          // 既存項目に金額を加算
          existingItem.value += record.amount
        } else {
          // 新規項目として追加
          monthlyData[monthKey][categoryKey].push({
            id: record.accounting_items.id,
            name: record.accounting_items.name,
            category: categoryKey as 'income' | 'variable_costs' | 'fixed_costs',
            value: record.amount,
            unit: '円'
          })
        }
      })
      
      // 月別に色を割り当て
      Object.keys(monthlyData).forEach(month => {
        ['income', 'variable_costs', 'fixed_costs'].forEach(category => {
          const categoryKey = category as keyof CategoryData
          const items = monthlyData[month][categoryKey]
          const colorVariants = CATEGORY_COLORS[categoryKey].variants
          
          // 項目を金額順にソート
          items.sort((a, b) => b.value - a.value)
          
          // 色を割り当て
          items.forEach((item, index) => {
            item.color = colorVariants[index % colorVariants.length]
          })
        })
      })
      
      
      return monthlyData
      
    } catch (error) {
      
      return processEstimatedAccountingItems(workReportIds)
    }
  }, [])
  
  // 推定データを生成（実データが無い場合のフォールバック）
  const processEstimatedAccountingItems = useCallback(async (workReportIds: string[]): Promise<{ [month: string]: CategoryData }> => {
    const monthlyData: { [month: string]: CategoryData } = {}
    
    // work_reportsから基本データを取得
    const { data: workReports } = await supabase
      .from('work_reports')
      .select('id, work_date, income_total, expense_total, expected_revenue')
      .in('id', workReportIds)
    
    if (!workReports) return monthlyData
    
    workReports.forEach(report => {
      const monthKey = format(new Date(report.work_date), 'yyyy-MM', { locale: ja })
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          income: [],
          variable_costs: [],
          fixed_costs: []
        }
      }
      
      // 推定収入項目
      const incomeItems: AccountingItem[] = [
        {
          id: 'harvest_sales_est',
          name: '収穫物売上（推定）',
          category: 'income' as const,
          value: report.expected_revenue || 0,
          unit: '円'
        },
        {
          id: 'other_income_est',
          name: 'その他収入（推定）',
          category: 'income' as const,
          value: (report.income_total || 0) - (report.expected_revenue || 0),
          unit: '円'
        }
      ]
      
      // 推定変動費項目
      const variableCostItems: AccountingItem[] = [
        {
          id: 'variable_costs_est',
          name: '変動費合計（推定）',
          category: 'variable_costs' as const,
          value: Math.round((report.expense_total || 0) * 0.6), // 推定60%
          unit: '円'
        }
      ]
      
      // 推定固定費項目
      const fixedCostItems: AccountingItem[] = [
        {
          id: 'fixed_costs_est',
          name: '固定費合計（推定）',
          category: 'fixed_costs' as const,
          value: Math.round((report.expense_total || 0) * 0.4), // 推定40%
          unit: '円'
        }
      ]
      
      // 既存データに追加
      monthlyData[monthKey].income = [...monthlyData[monthKey].income, ...incomeItems]
      monthlyData[monthKey].variable_costs = [...monthlyData[monthKey].variable_costs, ...variableCostItems]
      monthlyData[monthKey].fixed_costs = [...monthlyData[monthKey].fixed_costs, ...fixedCostItems]
    })
    
    // 月別に色を割り当て
    Object.keys(monthlyData).forEach(month => {
      ['income', 'variable_costs', 'fixed_costs'].forEach(category => {
        const categoryKey = category as keyof CategoryData
        const items = monthlyData[month][categoryKey]
        const colorVariants = CATEGORY_COLORS[categoryKey].variants
        
        items.sort((a, b) => b.value - a.value)
        items.forEach((item, index) => {
          item.color = colorVariants[index % colorVariants.length]
        })
      })
    })
    
    return monthlyData
  }, [])
  
  // Supabaseから財務データを取得
  const fetchFinancialData = useCallback(async () => {
    if (!companyId) {
      
      return []
    }
    
    try {
      
      setLoading(true)
      const endMonth = addMonths(startMonth, displayPeriod * 12)
      const allData: FinancialPerformanceData[] = []
      
      // work_reportsから財務データを取得
      // 注意：income_totalとexpense_totalがNULLではないデータのみ取得
      let workReportsQuery = supabase
        .from('work_reports')
        .select(`
          id, work_date, duration_hours, work_type,
          income_total, expense_total, net_income,
          harvest_amount, harvest_unit, expected_revenue,
          vegetable_id
        `)
        .eq('company_id', companyId)
        .gte('work_date', startMonth.toISOString().split('T')[0])
        .lt('work_date', endMonth.toISOString().split('T')[0])
        .is('deleted_at', null)
        .not('income_total', 'is', null)  // income_totalがNULLでないデータのみ
        .order('work_date', { ascending: true })

      // 選択野菜でフィルタリング
      if (selectedVegetables && selectedVegetables.length > 0) {
        workReportsQuery = workReportsQuery.in('vegetable_id', selectedVegetables)
      }

      const { data: workReports, error } = await workReportsQuery

      if (error) {
        console.error('❌ 収支構造分析: work_reportsクエリエラー', error)
        return []
      }

      console.log('📦 収支構造分析: work_reports取得', {
        count: workReports?.length || 0,
        startDate: startMonth.toISOString().split('T')[0],
        endDate: endMonth.toISOString().split('T')[0],
        companyId,
        selectedVegetables,
        query: `SELECT * FROM work_reports WHERE company_id='${companyId}' AND work_date >= '${startMonth.toISOString().split('T')[0]}' AND work_date < '${endMonth.toISOString().split('T')[0]}' AND deleted_at IS NULL`
      })

      if (!workReports || workReports.length === 0) {
        console.warn('⚠️ 収支構造分析: work_reportsが0件')
        return []
      }
      
      // vegetablesテーブルから面積情報を取得
      let vegetablesQuery = supabase
        .from('vegetables')
        .select('id, area_size')
        .eq('company_id', companyId)
        .is('deleted_at', null)

      // 選択野菜でフィルタリング
      if (selectedVegetables && selectedVegetables.length > 0) {
        vegetablesQuery = vegetablesQuery.in('id', selectedVegetables)
      }

      const { data: vegetables } = await vegetablesQuery
      
      const totalArea = vegetables?.reduce((sum, v) => sum + (v.area_size || 0), 0) || 1000 // デフォルト1000㎡
      
      // 月別にデータをグループ化
      const dataByMonth: { [key: string]: any[] } = {}
      const prevYearDataByMonth: { [key: string]: any[] } = {}
      
      workReports.forEach(record => {
        const monthKey = format(new Date(record.work_date), 'yyyy-MM')
        if (!dataByMonth[monthKey]) dataByMonth[monthKey] = []
        dataByMonth[monthKey].push(record)
      })
      
      // 前年同月のデータも取得（成長率計算用）
      const prevYearStart = addMonths(startMonth, -12)
      const prevYearEnd = addMonths(endMonth, -12)
      
      let prevYearQuery = supabase
        .from('work_reports')
        .select(`
          work_date, income_total, expense_total, net_income,
          duration_hours, vegetable_id
        `)
        .eq('company_id', companyId)
        .gte('work_date', prevYearStart.toISOString().split('T')[0])
        .lt('work_date', prevYearEnd.toISOString().split('T')[0])
        .is('deleted_at', null)

      // 選択野菜でフィルタリング
      if (selectedVegetables && selectedVegetables.length > 0) {
        prevYearQuery = prevYearQuery.in('vegetable_id', selectedVegetables)
      }

      const { data: prevYearReports } = await prevYearQuery
      
      prevYearReports?.forEach(record => {
        const monthKey = format(new Date(record.work_date), 'yyyy-MM')
        if (!prevYearDataByMonth[monthKey]) prevYearDataByMonth[monthKey] = []
        prevYearDataByMonth[monthKey].push(record)
      })
      
      // 月別にデータを集約
      for (let i = 0; i < displayPeriod * 12; i++) {
        const currentMonth = addMonths(startMonth, i)
        const monthKey = format(currentMonth, 'yyyy-MM')
        const monthRecords = dataByMonth[monthKey] || []
        
        if (monthRecords.length === 0) continue
        
        // 前年同月データ
        const prevYearMonthKey = format(addMonths(currentMonth, -12), 'yyyy-MM')
        const prevYearRecords = prevYearDataByMonth[prevYearMonthKey] || []
        
        // 収支データ集計
        const totalIncome = monthRecords.reduce((sum, r) => sum + (r.income_total || 0), 0)
        const totalExpense = monthRecords.reduce((sum, r) => sum + (r.expense_total || 0), 0)
        const totalNetIncome = monthRecords.reduce((sum, r) => sum + (r.net_income || 0), 0)
        const totalHours = monthRecords.reduce((sum, r) => sum + (r.duration_hours || 0), 0)
        const harvestSales = monthRecords.reduce((sum, r) => sum + (r.expected_revenue || 0), 0)
        
        // 前年同月データ
        const prevTotalIncome = prevYearRecords.reduce((sum, r) => sum + (r.income_total || 0), 0)
        const prevTotalNetIncome = prevYearRecords.reduce((sum, r) => sum + (r.net_income || 0), 0)
        const prevTotalHours = prevYearRecords.reduce((sum, r) => sum + (r.duration_hours || 0), 0)
        
        // 効率性指標計算
        const salesPerHour = totalHours > 0 ? totalIncome / totalHours : 0
        const profitPerArea = totalArea > 0 ? totalNetIncome / (totalArea / 10000) : 0 // ㎡→ha変換
        const roi = totalExpense > 0 ? (totalNetIncome / totalExpense) * 100 : 0
        const prevSalesPerHour = prevTotalHours > 0 ? prevTotalIncome / prevTotalHours : 0
        
        // 成長率計算
        const salesGrowthRate = prevTotalIncome > 0 ? ((totalIncome - prevTotalIncome) / prevTotalIncome) * 100 : 0
        const profitGrowthRate = prevTotalNetIncome > 0 ? ((totalNetIncome - prevTotalNetIncome) / prevTotalNetIncome) * 100 : 0
        const efficiencyGrowthRate = prevSalesPerHour > 0 ? ((salesPerHour - prevSalesPerHour) / prevSalesPerHour) * 100 : 0
        
        allData.push({
          month: format(currentMonth, 'M月', { locale: ja }),
          year: currentMonth.getFullYear(),
          month_num: currentMonth.getMonth() + 1,
          revenue: {
            sales: totalIncome,
            harvest_sales: harvestSales,
            other_income: totalIncome - harvestSales,
            total: totalIncome
          },
          expenses: {
            labor_cost: totalExpense * 0.4, // 推定値: 支出の40%を人件費
            material_cost: totalExpense * 0.35, // 推定値: 支出の35%を資材費
            other_cost: totalExpense * 0.25, // 推定値: 支出の25%をその他
            total: totalExpense
          },
          profit: {
            gross: totalIncome - totalExpense,
            net: totalNetIncome,
            margin: totalIncome > 0 ? (totalNetIncome / totalIncome) * 100 : 0
          },
          efficiency: {
            sales_per_hour: Math.round(salesPerHour),
            profit_per_area: Math.round(profitPerArea),
            roi_percentage: Math.round(roi * 10) / 10,
            productivity_index: Math.min(Math.round((salesPerHour / 1000) * 100), 100) // 正規化
          },
          growth: {
            sales_growth_rate: Math.round(salesGrowthRate * 10) / 10,
            profit_growth_rate: Math.round(profitGrowthRate * 10) / 10,
            efficiency_growth_rate: Math.round(efficiencyGrowthRate * 10) / 10
          },
          basic_data: {
            total_work_hours: Math.round(totalHours * 10) / 10,
            total_area: Math.round(totalArea),
            work_reports_count: monthRecords.length
          }
        })
      }
      
      
      
      // 実際の勘定項目データを取得して処理
      const workReportIds = workReports.map(r => r.id).filter(id => id != null)
      console.log('📋 収支構造分析: work_report_ids', {
        count: workReportIds.length,
        ids: workReportIds.slice(0, 3), // 最初の3件を表示
        hasData: workReportIds.length > 0
      })
      const categoryData = await processRealAccountingItems(workReportIds)
      console.log('📊 収支構造分析: カテゴリデータ処理完了', {
        keys: Object.keys(categoryData),
        isEmpty: Object.keys(categoryData).length === 0,
        sampleMonth: Object.keys(categoryData)[0],
        data: categoryData
      })
      setCategoryData(categoryData)

      console.log('💰 収支構造分析: 財務データ集計', {
        totalReports: workReports.length,
        monthlyData: Object.keys(dataByMonth),
        categoryDataKeys: Object.keys(categoryData)
      })
      // 全利用可能項目を生成（分離型凡例用）
      const allItems: { [key: string]: LegendItemInfo } = {}
      const initialVisibleItems: { [key: string]: boolean } = {}
      
      // 全ての月のデータから項目を収集
      Object.keys(categoryData).forEach(month => {
        ['income', 'variable_costs', 'fixed_costs'].forEach(category => {
          const categoryKey = category as keyof CategoryData
          const categoryItems = categoryData[month][categoryKey]
          
          categoryItems.forEach(item => {
            if (!allItems[item.id]) {
              // 初回の項目情報を保存
              allItems[item.id] = {
                id: item.id,
                name: item.name,
                category: item.category,
                categoryName: categoryKey === 'income' ? '収入' : categoryKey === 'variable_costs' ? '変動費' : '固定費',
                color: item.color || CATEGORY_COLORS[categoryKey].base,
                totalValue: 0
              }
              // デフォルトで全項目をONに設定
              initialVisibleItems[item.id] = true
            }
            
            // 合計値を累積
            allItems[item.id].totalValue += item.value
          })
        })
      })
      
      // 重要度順でソート（合計値の降順）
      const sortedItems = Object.entries(allItems)
        .sort(([,a], [,b]) => b.totalValue - a.totalValue)
      
      const sortedAllItems = Object.fromEntries(sortedItems)
      
      setAllAvailableItems(sortedAllItems)
      setVisibleItems(initialVisibleItems)
      
      console.log('🎯 収支構造分析: fetchFinancialData完了', {
        allDataLength: allData.length,
        months: allData.map(d => d.month),
        categoryDataSize: Object.keys(categoryData).length
      })

      return allData
      
    } catch (error) {
      
      return []
    } finally {
      setLoading(false)
    }
  }, [companyId, startMonth, displayPeriod, processRealAccountingItems, processEstimatedAccountingItems, selectedVegetables])

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

  // データ取得実行
  useEffect(() => {
    if (companyId) {
      console.log('🔄 収支構造分析: データ取得開始', {
        companyId,
        startMonth: format(startMonth, 'yyyy-MM'),
        displayPeriod
      })
      fetchFinancialData()
        .then(data => {
          setFinancialData(data)
          setLastUpdated(new Date())
          console.log('✅ 収支構造分析: データ取得完了', {
            dataLength: data.length,
            categoryDataKeys: Object.keys(categoryData),
            categoryData
          })
        })
        .catch(error => {
          console.error('❌ 収支構造分析: データ取得エラー', error)
          setFinancialData([])
        })
    } else {
      console.warn('⚠️ 収支構造分析: companyIdが未設定')
    }
  }, [fetchFinancialData, companyId, selectedVegetables])

  // 複数右軸表示用のカスタムプラグイン
  const multipleRightAxisPlugin = {
    id: 'multipleRightAxis',
    beforeDraw: (chart: any) => {
      if ((displayOptions.showEfficiency || displayOptions.showGrowth) && chart.scales.y2) {
        const ctx = chart.ctx
        const chartArea = chart.chartArea
        const y2Scale = chart.scales.y2
        const y3Scale = chart.scales.y3
        
        if (y2Scale && chartArea) {
          // 効率性軸の位置調整
          y2Scale.left = chartArea.right + 15
          y2Scale.right = chartArea.right + 65
        }
        
        if (y3Scale && chartArea) {
          // 成長率軸の位置調整
          y3Scale.left = chartArea.right + 75
          y3Scale.right = chartArea.right + 125
        }
      }
    }
  }

  // Y軸範囲の動的計算（月次キャッシュフローと同じロジック）
  const calculateYAxisRange = useCallback((categoryData: { [month: string]: CategoryData }) => {
    if (!categoryData || Object.keys(categoryData).length === 0) {
      return { min: -100000, max: 100000, stepSize: 20000 }
    }
    
    const allValues: number[] = []
    Object.values(categoryData).forEach(monthData => {
      const income = monthData.income.reduce((sum, item) => sum + item.value, 0)
      const variableCosts = monthData.variable_costs.reduce((sum, item) => sum + item.value, 0)
      const fixedCosts = monthData.fixed_costs.reduce((sum, item) => sum + item.value, 0)
      allValues.push(income)
      allValues.push(-(variableCosts + fixedCosts))
    })
    
    const rawMax = Math.max(...allValues, 0)
    const rawMin = Math.min(...allValues, 0)
    const dataRange = rawMax - rawMin
    
    // 金融業界標準のプリセット設定（収支混合データ用）
    const preset = {
      minMargin: 0.15,  // 下部15%マージン
      maxMargin: 0.15,  // 上部15%マージン
      zeroPosition: 0.5,  // ゼロを中央に配置
      forceZero: true
    }
    
    // プリセットに基づいた範囲計算
    let optimizedMin = rawMin - dataRange * preset.minMargin
    let optimizedMax = rawMax + dataRange * preset.maxMargin
    
    // ゼロを含むように調整
    if (preset.forceZero) {
      optimizedMin = Math.min(optimizedMin, 0)
      optimizedMax = Math.max(optimizedMax, 0)
    }
    
    // ゼロ位置の調整（中央配置）
    if (optimizedMax > 0 && optimizedMin < 0) {
      const maxAbs = Math.max(Math.abs(rawMax), Math.abs(rawMin))
      const marginedMax = maxAbs * (1 + preset.maxMargin)
      optimizedMax = marginedMax
      optimizedMin = -marginedMax
    }
    
    // 最小範囲を保証
    if (dataRange < 10000 && dataRange > 0) {
      const minRange = 10000
      const center = (rawMax + rawMin) / 2
      optimizedMax = center + minRange / 2
      optimizedMin = center - minRange / 2
    }
    
    // キリの良い値に丸める関数
    const roundToNiceValue = (value: number, isMax: boolean = false) => {
      if (value === 0) return 0
      
      const absValue = Math.abs(value)
      const sign = value < 0 ? -1 : 1
      let unit: number
      
      if (absValue < 1000) {
        unit = 500
      } else if (absValue < 10000) {
        unit = 2000
      } else if (absValue < 50000) {
        unit = 10000
      } else if (absValue < 100000) {
        unit = 20000
      } else if (absValue < 500000) {
        unit = 100000
      } else if (absValue < 1000000) {
        unit = 200000
      } else if (absValue < 5000000) {
        unit = 1000000
      } else if (absValue < 10000000) {
        unit = 2000000
      } else if (absValue < 50000000) {
        unit = 10000000
      } else if (absValue < 100000000) {
        unit = 20000000
      } else {
        const magnitude = Math.pow(10, Math.floor(Math.log10(absValue / 5)))
        unit = magnitude * Math.ceil(absValue / 5 / magnitude)
      }
      
      return Math.ceil(absValue / unit) * unit * sign
    }
    
    const finalMin = roundToNiceValue(optimizedMin, false)
    const finalMax = roundToNiceValue(optimizedMax, true)
    
    // 11個の目盛り（ゼロを中心に上下5個ずつ）に固定
    const targetSteps = 11
    
    // ゼロを必ず含むように調整
    let adjustedMin = Math.min(finalMin, 0)
    let adjustedMax = Math.max(finalMax, 0)
    
    // プラス側とマイナス側で大きい方を基準に対称にする
    const maxAbs = Math.max(Math.abs(adjustedMin), Math.abs(adjustedMax))
    
    // 5ステップ分の値を計算
    const rawStep = maxAbs / 5
    
    // キリの良い値にstepSizeを丸める
    let stepSize: number
    if (rawStep < 1000) {
      stepSize = Math.ceil(rawStep / 500) * 500
    } else if (rawStep < 10000) {
      stepSize = Math.ceil(rawStep / 2000) * 2000
    } else if (rawStep < 50000) {
      stepSize = Math.ceil(rawStep / 10000) * 10000
    } else if (rawStep < 100000) {
      stepSize = Math.ceil(rawStep / 20000) * 20000
    } else if (rawStep < 500000) {
      stepSize = Math.ceil(rawStep / 100000) * 100000
    } else if (rawStep < 1000000) {
      stepSize = Math.ceil(rawStep / 200000) * 200000
    } else if (rawStep < 5000000) {
      stepSize = Math.ceil(rawStep / 1000000) * 1000000
    } else if (rawStep < 10000000) {
      stepSize = Math.ceil(rawStep / 2000000) * 2000000
    } else {
      stepSize = Math.ceil(rawStep / 10000000) * 10000000
    }
    
    // 11個の目盛りに合わせて範囲を設定（ゼロ中心、上下対称）
    const symmetricMax = stepSize * 5
    const symmetricMin = -stepSize * 5
    
    return {
      min: symmetricMin,
      max: symmetricMax,
      stepSize: stepSize
    }
  }, [])

  // チャートデータの準備（全カテゴリ同時表示、費用はマイナス）
  const chartData = useMemo(() => {
    console.log('🔄 収支構造分析: chartData生成開始', {
      hasCategoryData: !!categoryData,
      categoryDataKeys: Object.keys(categoryData || {})
    })
    if (!categoryData) {
      console.warn('⚠️ 収支構造分析: categoryDataが存在しないためnullを返す')
      return null
    }
    
    // ユーザーが指定した期間のすべての月を生成（内部は yyyy-MM、表示は M月）
    const allMonthLabels: string[] = []
    const dataKeysByIndex: string[] = [] // インデックスごとのデータキー配列
    const yearLabels: (number | null)[] = [] // 年ラベル用配列
    
    for (let i = 0; i < displayPeriod * 12; i++) {
      const currentMonth = addMonths(startMonth, i)
      const displayLabel = format(currentMonth, 'M月', { locale: ja })
      const dataKey = format(currentMonth, 'yyyy-MM', { locale: ja })
      
      allMonthLabels.push(displayLabel)
      dataKeysByIndex.push(dataKey) // インデックスベースでデータキーを保存
      
      // 1月または最初の月の場合は年を表示
      if (currentMonth.getMonth() === 0 || i === 0) {
        yearLabels.push(currentMonth.getFullYear())
      } else {
        yearLabels.push(null)
      }
    }
    
    const monthLabels = allMonthLabels
    const datasets: any[] = []
    
    // 各カテゴリの処理
    const categories: Array<keyof CategoryData> = ['income', 'variable_costs', 'fixed_costs']
    
    categories.forEach(categoryKey => {
      if (!selectedCategories[categoryKey]) return
      
      // 各カテゴリの全項目を収集
      const allItems = new Set<string>()
      dataKeysByIndex.forEach(dataKey => {
        if (categoryData[dataKey]?.[categoryKey]) {
          categoryData[dataKey][categoryKey].forEach(item => {
            allItems.add(item.id)
          })
        }
      })
      
      // 表示項目の重要度順ソート（総額順）
      const itemTotals: { [key: string]: { name: string, total: number, color: string, category: string } } = {}
      Array.from(allItems).forEach(itemId => {
        let total = 0
        let name = ''
        let color = ''
        
        dataKeysByIndex.forEach(dataKey => {
          const monthData = categoryData[dataKey]?.[categoryKey]
          const item = monthData?.find(i => i.id === itemId)
          if (item) {
            total += item.value
            name = item.name
            color = item.color || CATEGORY_COLORS[categoryKey].base
          }
        })
        
        itemTotals[itemId] = { 
          name, 
          total, 
          color,
          category: categoryKey === 'income' ? '収入' : categoryKey === 'variable_costs' ? '変動費' : '固定費'
        }
      })
      
      // 重要度順でソート
      const sortedItems = Object.entries(itemTotals)
        .sort(([,a], [,b]) => b.total - a.total)
      
      // 上位項目とその他に分割
      const topItems = sortedItems.slice(0, MAX_VISIBLE_ITEMS)
      const otherItems = sortedItems.slice(MAX_VISIBLE_ITEMS)
      
      // 表示項目のデータセット作成
      topItems.forEach(([itemId, itemInfo]) => {
        if (visibleItems[itemId] === true) {
          datasets.push({
            type: 'bar' as const,
            label: `${itemInfo.category}: ${itemInfo.name}`,
            data: dataKeysByIndex.map(dataKey => {
              const monthData = categoryData[dataKey]?.[categoryKey]
              const item = monthData?.find(i => i.id === itemId)
              const value = item?.value || 0
              // 費用項目（変動費・固定費）はマイナス表示
              return categoryKey === 'income' ? value : -value
            }),
            backgroundColor: `${itemInfo.color}CC`,
            borderColor: itemInfo.color,
            borderWidth: 1,
            yAxisID: 'y',
            stack: categoryKey,
            category: categoryKey,
            itemId: itemId // 凡例で使用するためのitemIdを追加
          })
        }
      })
      
      // その他項目（展開時または折りたたみ時）
      if (otherItems.length > 0) {
        if (expandedOthers[categoryKey]) {
          // 展開時：個別項目として表示
          otherItems.forEach(([itemId, itemInfo]) => {
            if (visibleItems[itemId] === true) {
              datasets.push({
                type: 'bar' as const,
                label: `${itemInfo.category}: ${itemInfo.name}`,
                data: dataKeysByIndex.map(dataKey => {
                  const monthData = categoryData[dataKey]?.[categoryKey]
                  const item = monthData?.find(i => i.id === itemId)
                  const value = item?.value || 0
                  // 費用項目（変動費・固定費）はマイナス表示
                  return categoryKey === 'income' ? value : -value
                }),
                backgroundColor: `${itemInfo.color}99`,
                borderColor: itemInfo.color,
                borderWidth: 1,
                yAxisID: 'y',
                stack: categoryKey,
                category: categoryKey,
                itemId: itemId // 凡例で使用するためのitemIdを追加
              })
            }
          })
        } else {
          // 折りたたみ時：その他として合計表示
          const categoryName = categoryKey === 'income' ? '収入' : categoryKey === 'variable_costs' ? '変動費' : '固定費'
          datasets.push({
            type: 'bar' as const,
            label: `${categoryName}: その他 (${otherItems.length}項目)`,
            data: dataKeysByIndex.map(dataKey => {
              const monthData = categoryData[dataKey]?.[categoryKey]
              const value = otherItems.reduce((sum, [itemId]) => {
                const item = monthData?.find(i => i.id === itemId)
                return sum + (visibleItems[itemId] === true ? (item?.value || 0) : 0)
              }, 0)
              // 費用項目（変動費・固定費）はマイナス表示
              return categoryKey === 'income' ? value : -value
            }),
            backgroundColor: `${CATEGORY_COLORS[categoryKey].base}66`,
            borderColor: CATEGORY_COLORS[categoryKey].base,
            borderWidth: 1,
            yAxisID: 'y',
            stack: categoryKey,
            others: true,
            category: categoryKey
          })
        }
      }
    })

    // 累積損益線データセット（右Y軸用）
    const cumulativeDatasets = []
    if (showCumulativeLine && categoryData) {
      // インデックスベースのデータキーを使用（visibleItemsを渡す）
      const cumulativeData = calculateCumulativeData(categoryData, dataKeysByIndex, visibleItems)

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
          lineData = dataKeysByIndex.map(dataKey => cumulativeData[dataKey]?.profit || 0)
          lineColor = '#059669' // エメラルド色
          lineLabel = `📈 累積損益（収入${visibleIncomeCount}項目-支出${visibleExpenseCount}項目）`
          break
        case 'income':
          lineData = dataKeysByIndex.map(dataKey => cumulativeData[dataKey]?.income || 0)
          lineColor = '#0284c7' // 青色
          lineLabel = `💰 累積収入（${visibleIncomeCount}項目）`
          break
        case 'expense':
          // 累積支出はマイナス値として表示（月次キャッシュフローと同様）
          lineData = dataKeysByIndex.map(dataKey => -(cumulativeData[dataKey]?.expense || 0))
          lineColor = '#dc2626' // 赤色
          lineLabel = `💸 累積支出（${visibleExpenseCount}項目）`
          break
      }
      
      cumulativeDatasets.push({
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
        tension: 0.4,
        yAxisID: 'y1', // 右Y軸を使用
        order: -1, // 棒グラフより前面に表示
        pointHoverRadius: 7,
        pointHoverBorderWidth: 3,
        borderDash: cumulativeType !== 'profit' ? [5, 5] : [], // 損益以外は点線
      })
    }

    return {
      labels: monthLabels,
      datasets: [...datasets, ...cumulativeDatasets],
      yearLabels, // 年ラベルをデータに含める
      dataKeysByIndex // データキー配列も含める
    }
  }, [categoryData, selectedCategories, visibleItems, expandedOthers, showCumulativeLine, cumulativeType, calculateCumulativeData, startMonth, displayPeriod, allAvailableItems])

  // Y軸範囲を計算
  const yAxisRange = useMemo(() => calculateYAxisRange(categoryData), [categoryData, calculateYAxisRange])
  
  // 累積データの範囲を計算（モードに応じて切り替え）
  const cumulativeRange = useMemo(() => {
    if (!showCumulativeLine || !categoryData) return { min: 0, max: 0 }

    // 常に最適化モード：プリセット最適化方式（業界標準）

    const dataKeys = Object.keys(categoryData).sort()
    const cumulativeData = calculateCumulativeData(categoryData, dataKeys, visibleItems)
    
    const allCumulativeValues: number[] = []
    Object.values(cumulativeData).forEach((data: any) => {
      if (cumulativeType === 'profit') allCumulativeValues.push(data.profit || 0)
      else if (cumulativeType === 'income') allCumulativeValues.push(data.income || 0)
      else allCumulativeValues.push(-(data.expense || 0)) // 累積支出はマイナス値として扱う
    })
    
    const rawMax = Math.max(...allCumulativeValues, 0)
    const rawMin = Math.min(...allCumulativeValues, 0)
    const dataRange = rawMax - rawMin
    
    // 金融業界標準のプリセット設定
    const presets = {
      profit: {  // 損益用
        minMargin: 0.15,  // 下部15%マージン
        maxMargin: 0.15,  // 上部15%マージン
        zeroPosition: 0.5,  // ゼロを中央に
        forceZero: true
      },
      income: {  // 収入用
        minMargin: 0,  // 下部マージンなし（ゼロから始まる）
        maxMargin: 0.2,  // 上部20%マージン
        forceZero: true,  // 必ずゼロを含む
        zeroPosition: 0  // ゼロを下端に
      },
      expense: {  // 支出用
        minMargin: 0.2,  // 下部20%マージン
        maxMargin: 0,  // 上部マージンなし（ゼロで終わる）
        forceZero: true,  // 必ずゼロを含む
        zeroPosition: 1  // ゼロを上端に
      }
    }
    
    const preset = presets[cumulativeType] || presets.profit
    
    // プリセットに基づいた範囲計算
    let optimizedMin = rawMin - dataRange * preset.minMargin
    let optimizedMax = rawMax + dataRange * preset.maxMargin
    
    // ゼロを含むように調整
    if (preset.forceZero) {
      optimizedMin = Math.min(optimizedMin, 0)
      optimizedMax = Math.max(optimizedMax, 0)
    }
    
    // ゼロ位置の調整（損益の場合のみ）
    if (preset.zeroPosition !== undefined && optimizedMax > 0 && optimizedMin < 0) {
      const totalRange = optimizedMax - optimizedMin
      const targetZeroPos = totalRange * preset.zeroPosition
      const currentZeroPos = Math.abs(optimizedMin)
      
      if (preset.zeroPosition === 0.5) {  // ゼロを中央に
        // 正負の大きい方に合わせる
        const maxAbs = Math.max(Math.abs(rawMax), Math.abs(rawMin))
        const marginedMax = maxAbs * (1 + preset.maxMargin)
        optimizedMax = marginedMax
        optimizedMin = -marginedMax
      } else if (currentZeroPos < targetZeroPos) {
        optimizedMin = -targetZeroPos
      } else if (currentZeroPos > targetZeroPos) {
        optimizedMax = totalRange - currentZeroPos + targetZeroPos
      }
    }
    
    // 最小範囲を保証（データが小さすぎる場合）
    if (dataRange < 10000 && dataRange > 0) {
      const minRange = 10000
      const center = (rawMax + rawMin) / 2
      optimizedMax = center + minRange / 2
      optimizedMin = center - minRange / 2
    }
    
    // キリの良い値に丸める関数
    const roundToNiceValue = (value: number, isMax: boolean = false) => {
      if (value === 0) return 0
      
      const absValue = Math.abs(value)
      const sign = value < 0 ? -1 : 1
      let unit: number
      
      // 値の大きさに応じて適切な単位を選択
      if (absValue < 1000) {
        unit = 500  // 500円単位
      } else if (absValue < 10000) {
        unit = 2000  // 2,000円単位
      } else if (absValue < 50000) {
        unit = 10000  // 10,000円単位
      } else if (absValue < 100000) {
        unit = 20000  // 20,000円単位
      } else if (absValue < 500000) {
        unit = 100000  // 100,000円単位
      } else if (absValue < 1000000) {
        unit = 200000  // 200,000円単位
      } else if (absValue < 5000000) {
        unit = 1000000  // 1,000,000円単位
      } else if (absValue < 10000000) {
        unit = 2000000  // 2,000,000円単位
      } else if (absValue < 50000000) {
        unit = 10000000  // 10,000,000円単位
      } else if (absValue < 100000000) {
        unit = 20000000  // 20,000,000円単位
      } else {
        // それ以上は値を5で割った単位でキリの良い値に
        const magnitude = Math.pow(10, Math.floor(Math.log10(absValue / 5)))
        unit = magnitude * Math.ceil(absValue / 5 / magnitude)
      }
      
      // 最大値は切り上げ、最小値も切り上げ（マイナス値の場合、絶対値を大きくする）
      if (isMax) {
        return Math.ceil(absValue / unit) * unit * sign
      } else {
        return Math.ceil(absValue / unit) * unit * sign  // 最小値も切り上げて余裕を持たせる
      }
    }
    
    // 最終的な値をキリの良い値に調整
    const finalMin = roundToNiceValue(optimizedMin, false)
    const finalMax = roundToNiceValue(optimizedMax, true)
    
    // 11個の目盛り（ゼロを中心に上下5個ずつ）に固定
    const targetSteps = 11  // 目盛り数を11個に固定
    
    // ゼロを必ず含むように調整
    let adjustedMin = Math.min(finalMin, 0)
    let adjustedMax = Math.max(finalMax, 0)
    
    // プラス側とマイナス側で大きい方を基準に対称にする
    const maxAbs = Math.max(Math.abs(adjustedMin), Math.abs(adjustedMax))
    
    // 5ステップ分の値を計算（ゼロから上下5個ずつ）
    const rawStep = maxAbs / 5
    
    // キリの良い値にstepSizeを丸める
    let stepSize: number
    if (rawStep < 1000) {
      stepSize = Math.ceil(rawStep / 500) * 500
    } else if (rawStep < 10000) {
      stepSize = Math.ceil(rawStep / 2000) * 2000
    } else if (rawStep < 50000) {
      stepSize = Math.ceil(rawStep / 10000) * 10000
    } else if (rawStep < 100000) {
      stepSize = Math.ceil(rawStep / 20000) * 20000
    } else if (rawStep < 500000) {
      stepSize = Math.ceil(rawStep / 100000) * 100000
    } else if (rawStep < 1000000) {
      stepSize = Math.ceil(rawStep / 200000) * 200000
    } else if (rawStep < 5000000) {
      stepSize = Math.ceil(rawStep / 1000000) * 1000000
    } else if (rawStep < 10000000) {
      stepSize = Math.ceil(rawStep / 2000000) * 2000000
    } else {
      stepSize = Math.ceil(rawStep / 10000000) * 10000000
    }
    
    // 11個の目盛りに合わせて範囲を設定（ゼロ中心、上下対称）
    const symmetricMax = stepSize * 5
    const symmetricMin = -stepSize * 5
    
    // 結果を返す
    return {
      min: symmetricMin,
      max: symmetricMax,
      stepSize: stepSize
    }
  }, [showCumulativeLine, categoryData, cumulativeType, calculateCumulativeData, yAxisRange, visibleItems])

  // チャートオプション（カテゴリ別積み上げ棒グラフ用）
  const chartOptions: ChartOptions<'bar'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        left: 0,  // 左側Y軸を左に移動
        right: 0,
        top: 0,
        bottom: 0
      }
    },
    interaction: {
      mode: 'index',
      intersect: false
    },
    onClick: (event: ChartEvent, elements: InteractionItem[]) => {
      if (elements.length > 0 && chartRef.current) {
        const elementIndex = elements[0].index
        const dataset = chartData?.datasets[elements[0].datasetIndex]
        
        // "その他"項目をクリックした場合の処理
        if (dataset && (dataset as any).others) {
          const category = (dataset as any).category as keyof CategoryData
          setExpandedOthers(prev => ({
            ...prev,
            [category]: !prev[category]
          }))
        } else {
          const selectedData = financialData[elementIndex]
          if (selectedData) {
            setSelectedMonth(selectedData)
            setDrilldownOpen(true)
          }
        }
      }
    },
    scales: {
      x: {
        type: 'category',
        stacked: true,
        grid: {
          display: false,
          drawBorder: true,
          drawOnChartArea: false,
          drawTicks: false
        },
        ticks: {
          display: false, // ラベルを非表示にしてカスタム表示を使用
          maxRotation: 0,
          minRotation: 0
        },
        border: {
          display: true,
          color: '#e5e7eb',
          width: 1
        },
        // バーを左端に配置する設定
        offset: true,
        // パディング設定
        bounds: 'ticks',
        afterFit: function(scale) {
          scale.paddingBottom = 80 // 月・年表示のためのスペース
        }
      },
      y: {
        type: 'linear',
        stacked: true,
        display: true,
        position: 'left',
        min: yAxisRange.min,
        max: yAxisRange.max,
        grid: {
          color: (context) => {
            // 0ラインだけグレー色で太くする
            return context.tick.value === 0 ? '#6b7280' : '#e5e7eb'
          },
          lineWidth: (context) => {
            // 0ラインだけ少し太くする（2px）、他は通常（1px）
            return context.tick.value === 0 ? 2 : 1
          },
          drawTicks: false
        },
        border: {
          color: '#374151',
          width: 2
        },
        ticks: {
          stepSize: yAxisRange.stepSize, // 11個の目盛りに固定
          color: '#1f2937',
          font: {
            size: 13,
            weight: '600',
            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          },
          padding: 3,  // 左側Y軸のラベルを調整
          callback: function(value) {
            const numValue = value as number
            
            // 0の場合は強調表示
            if (numValue === 0) {
              return '━ 0円 ━'
            }
            
            // 見やすい日本式の単位で表示
            if (Math.abs(numValue) >= 100000000) {
              const okuValue = numValue / 100000000
              return okuValue % 1 === 0 ? `${okuValue}億円` : `${okuValue.toFixed(1)}億円`
            } else if (Math.abs(numValue) >= 10000) {
              const manValue = Math.round(numValue / 10000)
              return `${manValue.toLocaleString()}万円`
            } else if (Math.abs(numValue) >= 1000) {
              return `${Math.round(numValue / 1000)}千円`
            } else {
              return `${Math.round(numValue)}円`
            }
          }
        }
      },
      // 右Y軸（累積損益用）
      y1: {
        type: 'linear' as const,
        position: 'right' as const,
        display: showCumulativeLine, // 累積線表示時のみ軸を表示
        min: cumulativeRange.min, // ゼロ位置を揃えるための最小値
        max: cumulativeRange.max, // ゼロ位置を揃えるための最大値
        grid: {
          display: false, // 右軸のグリッドは非表示（左軸と重複を避ける）
          drawOnChartArea: false,
        },
        border: {
          color: cumulativeType === 'profit' ? '#059669' : 
                 cumulativeType === 'income' ? '#0284c7' : '#dc2626',
          width: 2
        },
        title: {
          display: true,
          text: cumulativeType === 'profit' ? '累積損益' : 
                cumulativeType === 'income' ? '累積収入' : '累積支出',
          color: cumulativeType === 'profit' ? '#059669' : 
                 cumulativeType === 'income' ? '#0284c7' : '#dc2626',
          font: {
            size: 14,  // サイズを大きく
            weight: '700'  // より太く
          },
          padding: {
            top: 0,
            bottom: 2  // タイトルと軸線の間隔を縮める
          }
        },
        ticks: {
          color: cumulativeType === 'profit' ? '#059669' : 
                 cumulativeType === 'income' ? '#0284c7' : '#dc2626',
          font: {
            size: 13, // 左軸と統一
            weight: '600'
          },
          padding: -2, // 右側Y軸の余白を調整
          stepSize: cumulativeRange.stepSize, // メモリ数を5個に固定
          callback: function(value) {
            const numValue = value as number
            
            // ゼロの場合は強調表示
            if (numValue === 0) {
              return '0'
            }
            
            const absValue = Math.abs(numValue)
            const sign = numValue < 0 ? '-' : ''
            
            if (absValue >= 100000000) {
              const okuValue = absValue / 100000000
              return sign + (okuValue % 1 === 0 ? `${okuValue}億` : `${okuValue.toFixed(1)}億`)
            } else if (absValue >= 10000) {
              return sign + `${Math.round(absValue / 10000)}万`
            } else if (absValue >= 1000) {
              return sign + `${Math.round(absValue / 1000)}千`
            } else {
              return sign + `${Math.round(absValue)}`
            }
          }
        }
      }
    },
    plugins: {
      legend: {
        display: false, // カスタム凡例を使用
      },
      tooltip: {
        backgroundColor: '#ffffff',
        titleColor: '#1f2937',
        bodyColor: '#374151',
        borderColor: '#d1d5db',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        displayColors: true,
        titleFont: {
          size: 14,
          weight: '600'
        },
        bodyFont: {
          size: 12,
          weight: '400'
        },
        interaction: {
          mode: 'point' as const, // ポイントごとに個別表示
          intersect: false // カーソルが近くにあれば表示
        },
        callbacks: {
          title: (context) => {
            const dataIndex = context[0].dataIndex
            const monthLabel = chartData?.labels?.[dataIndex]
            const yearLabel = chartData?.yearLabels?.[dataIndex]
            if (yearLabel) {
              return `${yearLabel}年 ${monthLabel}`
            }
            return monthLabel || ''
          },
          label: (context) => {
            const value = context.raw as number
            const datasetLabel = context.dataset.label || ''
            const datasetType = context.dataset.type || 'bar'
            
            // 値のフォーマット
            const formattedValue = new Intl.NumberFormat('ja-JP', {
              style: 'currency',
              currency: 'JPY',
              minimumFractionDigits: 0
            }).format(Math.abs(value))
            
            // 線グラフ（累積データ）の場合
            if (datasetType === 'line') {
              if (datasetLabel.includes('累積損益')) {
                if (value >= 0) {
                  return `${datasetLabel}: +${formattedValue}`
                } else {
                  return `${datasetLabel}: -${formattedValue}`
                }
              } else if (datasetLabel.includes('累積収入')) {
                return `${datasetLabel}: +${formattedValue}`
              } else if (datasetLabel.includes('累積支出')) {
                return `${datasetLabel}: -${formattedValue}`
              }
            }
            
            // 棒グラフの場合
            if (value < 0) {
              return `${datasetLabel}: -${formattedValue}`
            } else if (value > 0) {
              return `${datasetLabel}: +${formattedValue}`
            }
            return `${datasetLabel}: ${formattedValue}`
          },
          afterBody: (context) => {
            const dataIndex = context[0].dataIndex
            const dataKey = chartData?.dataKeysByIndex?.[dataIndex]
            const monthData = dataKey ? categoryData[dataKey] : null
            if (!monthData) return []
            
            // 各カテゴリの合計を計算
            const incomeTotal = monthData.income?.reduce((sum, item) => sum + item.value, 0) || 0
            const variableCostTotal = monthData.variable_costs?.reduce((sum, item) => sum + item.value, 0) || 0
            const fixedCostTotal = monthData.fixed_costs?.reduce((sum, item) => sum + item.value, 0) || 0
            const netIncome = incomeTotal - variableCostTotal - fixedCostTotal
            
            const result = [
              '',
              '【月次データ】',
              `💰 収入合計: ¥${incomeTotal.toLocaleString()}`,
              `📈 変動費合計: ¥${variableCostTotal.toLocaleString()}`,
              `🏢 固定費合計: ¥${fixedCostTotal.toLocaleString()}`,
              `📊 純利益: ¥${netIncome.toLocaleString()}`
            ]
            
            // 線グラフがホバーされている場合は累積情報を追加
            const hoveredDataset = context[0].dataset
            if (hoveredDataset && hoveredDataset.type === 'line') {
              const cumulativeData = calculateCumulativeData(categoryData, chartData?.dataKeysByIndex || [], visibleItems)
              const currentCumulative = cumulativeData[dataKey]
              if (currentCumulative) {
                result.push('', '【累積データ】')
                if (showCumulativeLine && cumulativeType === 'profit') {
                  result.push(`📈 累積損益: ¥${currentCumulative.profit.toLocaleString()}`)
                } else if (showCumulativeLine && cumulativeType === 'income') {
                  result.push(`💰 累積収入: ¥${currentCumulative.income.toLocaleString()}`)
                } else if (showCumulativeLine && cumulativeType === 'expense') {
                  result.push(`💸 累積支出: ¥${currentCumulative.expense.toLocaleString()}`)
                }
              }
            }
            
            result.push('', '💡 "その他"をクリックで展開/折りたたみ')
            result.push('📈 月をクリックで詳細分析を表示')
            
            return result
          }
        }
      }
    },
    animation: {
      duration: 800,
      easing: 'easeInOutQuart'
    }
  }), [chartData, selectedCategories, categoryData, expandedOthers, financialData, showCumulativeLine, cumulativeType, yAxisRange, cumulativeRange])

  // 年月選択ハンドラー
  const handleYearMonthChange = () => {
    const newDate = new Date(selectedYear, selectedMonthNum - 1, 1)
    setStartMonth(newDate)
    setYearMonthPickerOpen(false)
  }

  useEffect(() => {
    setSelectedYear(startMonth.getFullYear())
    setSelectedMonthNum(startMonth.getMonth() + 1)
  }, [startMonth])

  // 表示オプション切り替え
  const toggleDisplayOption = (option: keyof DisplayOptions) => {
    setDisplayOptions(prev => ({
      ...prev,
      [option]: !prev[option]
    }))
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>💰 収支構造×効率性×成長分析</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[600px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-500"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // デバッグ用ログ
  console.log('🌐 収支構造分析: レンダリング状態', {
    loading,
    hasChartData: !!chartData,
    chartDataLabels: chartData?.labels,
    chartDatasets: chartData?.datasets?.length,
    categoryDataKeys: Object.keys(categoryData || {}),
    financialDataLength: financialData.length,
    visibleItems,
    selectedCategories
  })

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
                  Revenue & Cost Structure Analysis with Smart Legend Controls
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          {/* フィルターコントロール */}
          <div className="mb-6 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg border">
            <div className="flex flex-col">
              {/* 期間選択セクション（折りたたみ可能） */}
              <Collapsible open={filterSectionExpanded.period} onOpenChange={(open) => setFilterSectionExpanded(prev => ({ ...prev, period: open }))}>
                <CollapsibleTrigger className="w-full p-3 hover:bg-white/50 transition-all duration-200 border-b border-gray-200 group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`transition-transform duration-200 ${filterSectionExpanded.period ? 'rotate-90' : ''}`}>
                        <ChevronRight className="w-5 h-5 text-gray-500" />
                      </div>
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
                  
                  {/* 年月選択 */}
                  <Popover open={yearMonthPickerOpen} onOpenChange={setYearMonthPickerOpen} modal={true}>
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
                        {/* 年選択 */}
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
                                className={`text-xs ${selectedMonthNum === month ? 'bg-blue-600 text-white' : 'hover:bg-blue-50'}`}
                              >
                                {month}月
                              </Button>
                            ))}
                          </div>
                        </div>
                        
                        {/* アクションボタン */}
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
              
              {/* カテゴリ選択と累積線制御セクション（折りたたみ可能） */}
              <Collapsible open={filterSectionExpanded.category} onOpenChange={(open) => setFilterSectionExpanded(prev => ({ ...prev, category: open }))}>
                <CollapsibleTrigger className="w-full p-3 hover:bg-white/50 transition-all duration-200 group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`transition-transform duration-200 ${filterSectionExpanded.category ? 'rotate-90' : ''}`}>
                        <ChevronRight className="w-5 h-5 text-gray-500" />
                      </div>
                      <BarChart3 className="w-4 h-4 text-gray-600" />
                      <span className="text-sm font-medium text-gray-700">表示設定</span>
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {[selectedCategories.income && '収入', selectedCategories.variable_costs && '変動費', selectedCategories.fixed_costs && '固定費'].filter(Boolean).join('・')}
                        {showCumulativeLine && ` | 累積${cumulativeType === 'profit' ? '損益' : cumulativeType === 'income' ? '収入' : '支出'}線`}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500 group-hover:text-gray-700">
                      {filterSectionExpanded.category ? 'クリックで閉じる' : 'クリックで展開'}
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="p-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* 左側：カテゴリ選択 */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700">📊 表示カテゴリ選択</label>
                        <span className="text-xs text-gray-500">（複数選択可、費用はマイナス表示）</span>
                      </div>
                
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={selectedCategories.income ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategories(prev => ({
                      ...prev,
                      income: !prev.income
                    }))}
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
                    onClick={() => setSelectedCategories(prev => ({
                      ...prev,
                      variable_costs: !prev.variable_costs
                    }))}
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
                    onClick={() => setSelectedCategories(prev => ({
                      ...prev,
                      fixed_costs: !prev.fixed_costs
                    }))}
                    className={`text-xs h-8 px-4 ${
                      selectedCategories.fixed_costs
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-red-50 border-red-200'
                    }`}
                  >
                    🏢 固定費 {selectedCategories.fixed_costs ? '✓' : ''}
                  </Button>
                </div>
                
                {/* 全選択/全解除ボタン */}
                <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedCategories({
                            income: true,
                            variable_costs: true,
                            fixed_costs: true
                          })}
                          className="text-xs h-6 px-2 text-blue-600 hover:bg-blue-50"
                        >
                          全選択
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedCategories({
                            income: false,
                            variable_costs: false,
                            fixed_costs: false
                          })}
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
                        ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700' 
                        : 'text-gray-600 hover:bg-emerald-50 border-emerald-200'
                    }`}
                  >
                    📊 累積線 {showCumulativeLine ? '✓' : ''}
                  </Button>

                  {/* 累積線種別選択（累積線がONの時のみ表示） */}
                  {showCumulativeLine && (
                    <>
                      <div className="h-4 w-px bg-gray-300 mx-1"></div>
                      <div className="flex gap-1">
                        <Button
                          variant={cumulativeType === 'profit' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => setCumulativeType('profit')}
                          className={`px-3 h-7 text-xs ${
                            cumulativeType === 'profit' 
                              ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700' 
                              : 'text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          💰 損益
                        </Button>
                        <Button
                          variant={cumulativeType === 'income' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => setCumulativeType('income')}
                          className={`px-3 h-7 text-xs ${
                            cumulativeType === 'income' 
                              ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700' 
                              : 'text-blue-700 hover:bg-blue-50'
                          }`}
                        >
                          📈 収入
                        </Button>
                        <Button
                          variant={cumulativeType === 'expense' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => setCumulativeType('expense')}
                          className={`px-3 h-7 text-xs ${
                            cumulativeType === 'expense' 
                              ? 'bg-red-600 text-white shadow-sm hover:bg-red-700' 
                              : 'text-red-700 hover:bg-red-50'
                          }`}
                        >
                          📉 支出
                        </Button>
                      </div>
                    </>
                  )}
                      </div>

                      {showCumulativeLine && (
                        <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded mt-2">
                          💡 {cumulativeType === 'profit' ? '損益' : cumulativeType === 'income' ? '収入' : '支出'}の累積推移を右Y軸に表示しています。
                          {cumulativeType !== 'profit' && '点線で表示されます。'}
                        </div>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>
          
          {/* グラフ */}
          <div className="h-[600px] relative">
            {chartData && (
              <>
                <Bar 
                  ref={chartRef}
                  data={chartData} 
                  options={chartOptions}
                  plugins={[]}
                  key={JSON.stringify(visibleItems)} // 強制再描画用key
                />
                
                {/* カスタムX軸ラベル（月次キャッシュフローと同じデザイン） */}
                <div 
                  className="absolute pointer-events-none"
                  style={{ 
                    bottom: '0px',
                    left: '60px',
                    right: '60px',
                    height: '80px'
                  }}
                >
                  {/* 月表示層 */}
                  <div className="relative bg-white border-t border-gray-300" style={{ height: '40px' }}>
                    {chartData.labels?.map((label, index) => {
                      const totalMonths = chartData.labels?.length || 1
                      const monthWidth = 100 / totalMonths
                      const monthLeft = (index / totalMonths) * 100
                      
                      return (
                        <div
                          key={`month-${index}`}
                          className="absolute text-center text-sm font-medium text-gray-800 py-2 flex items-center justify-center"
                          style={{ 
                            left: `${monthLeft}%`,
                            width: `${monthWidth}%`,
                            top: '0px',
                            height: '40px'
                          }}
                        >
                          {label}
                        </div>
                      )
                    })}
                  </div>
                  
                  {/* 年表示層 */}
                  <div className="relative border-t-2 border-gray-400 bg-gray-100" style={{ height: '40px' }}>
                    {(() => {
                      const yearGroups: { year: number, startIndex: number, endIndex: number }[] = []
                      let currentYear: number | null = null
                      let yearStartIndex = 0
                      
                      chartData.yearLabels?.forEach((yearLabel, index) => {
                        if (yearLabel !== null) {
                          if (currentYear !== null) {
                            yearGroups.push({ 
                              year: currentYear, 
                              startIndex: yearStartIndex, 
                              endIndex: index - 1 
                            })
                          }
                          currentYear = yearLabel
                          yearStartIndex = index
                        }
                      })
                      
                      if (currentYear !== null) {
                        yearGroups.push({ 
                          year: currentYear, 
                          startIndex: yearStartIndex, 
                          endIndex: (chartData.yearLabels?.length || 1) - 1 
                        })
                      }
                      
                      return yearGroups.map((yearData) => {
                        const totalMonths = chartData.labels?.length || 1
                        const startPercent = (yearData.startIndex / totalMonths) * 100
                        const endPercent = ((yearData.endIndex + 1) / totalMonths) * 100
                        const widthPercent = endPercent - startPercent
                        
                        return (
                          <div
                            key={`year-${yearData.year}`}
                            className="absolute text-center text-sm font-bold text-gray-900 py-2 bg-gray-50 flex items-center justify-center border-r border-gray-400"
                            style={{ 
                              left: `${startPercent}%`,
                              width: `${widthPercent}%`,
                              top: '0px',
                              height: '40px'
                            }}
                          >
                            {yearData.year}年
                          </div>
                        )
                      })
                    })()}
                  </div>
                </div>
              </>
            )}
          </div>
          
          {/* 分離型スマート凡例（折りたたみ式） */}
          {Object.keys(allAvailableItems).length > 0 && (
            <Collapsible open={filterSectionExpanded.itemControl} onOpenChange={(open) => setFilterSectionExpanded(prev => ({ ...prev, itemControl: open }))}>
              <div className="mt-6 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg border">
                <CollapsibleTrigger className="w-full p-3 hover:bg-white/30 transition-all duration-200 group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`transition-transform duration-200 ${filterSectionExpanded.itemControl ? 'rotate-90' : ''}`}>
                        <ChevronRight className="w-5 h-5 text-gray-500" />
                      </div>
                      <Settings className="w-4 h-4 text-gray-600" />
                      <h4 className="text-sm font-medium text-gray-700">🎯 表示項目制御</h4>
                      <Badge variant="outline" className="ml-2 text-xs">
                        {Object.values(visibleItems).filter(v => v).length}/{Object.keys(allAvailableItems).length} 項目表示中
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500 group-hover:text-gray-700">
                      {filterSectionExpanded.itemControl ? 'クリックで閉じる' : 'クリックで展開'}
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="p-4 pt-0">
              
              {/* カテゴリ別グループ表示 */}
              {['income', 'variable_costs', 'fixed_costs'].map(category => {
                const categoryKey = category as keyof typeof selectedCategories
                if (!selectedCategories[categoryKey]) return null
                
                const categoryItems = Object.values(allAvailableItems).filter(item => item.category === category)
                const categoryName = category === 'income' ? '収入' : category === 'variable_costs' ? '変動費' : '固定費'
                const categoryColor = CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS].base
                
                return (
                  <div key={category} className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div 
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: categoryColor }}
                      />
                      <h5 className="text-sm font-medium text-gray-700">{categoryName}項目</h5>
                      <span className="text-xs text-gray-500">({categoryItems.length}項目)</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 ml-5">
                      {categoryItems.map((item) => {
                        const isVisible = visibleItems[item.id] === true
                        
                        return (
                          <div
                            key={item.id}
                            className={`flex items-center gap-3 p-2 rounded-lg border transition-all cursor-pointer ${
                              isVisible 
                                ? 'bg-white shadow-sm border-gray-200 hover:shadow-md' 
                                : 'bg-gray-100 border-gray-300 opacity-60'
                            }`}
                            onClick={() => {
                              setVisibleItems(prev => ({
                                ...prev,
                                [item.id]: !prev[item.id]
                              }))
                            }}
                          >
                            {/* カラーインジケーター */}
                            <div 
                              className="w-4 h-4 rounded border-2 border-white shadow-sm flex-shrink-0"
                              style={{ 
                                backgroundColor: item.color,
                                opacity: isVisible ? 1 : 0.4
                              }}
                            />
                            
                            {/* ラベル */}
                            <div className="flex-1 min-w-0">
                              <div className={`text-sm font-medium truncate ${
                                isVisible ? 'text-gray-800' : 'text-gray-500'
                              }`}>
                                {item.name}
                              </div>
                              
                              {/* 合計金額表示 */}
                              <div className={`text-xs ${
                                isVisible ? 'text-gray-600' : 'text-gray-400'
                              }`}>
                                合計: ¥{Math.abs(item.totalValue).toLocaleString()}
                              </div>
                            </div>
                            
                            {/* ON/OFF表示 */}
                            <div className={`text-xs font-medium px-2 py-1 rounded-full ${
                              isVisible 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-gray-200 text-gray-500'
                            }`}>
                              {isVisible ? 'ON' : 'OFF'}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              
              {/* 一括操作ボタン */}
              <div className="mt-4 pt-3 border-t border-gray-200 flex gap-2 justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newVisibleItems = { ...visibleItems }
                    Object.keys(allAvailableItems).forEach(itemId => {
                      newVisibleItems[itemId] = true
                    })
                    setVisibleItems(newVisibleItems)
                  }}
                  className="text-xs h-7 px-3 text-green-600 border-green-200 hover:bg-green-50"
                >
                  ✅ 全て表示
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newVisibleItems = { ...visibleItems }
                    Object.keys(allAvailableItems).forEach(itemId => {
                      newVisibleItems[itemId] = false
                    })
                    setVisibleItems(newVisibleItems)
                  }}
                  className="text-xs h-7 px-3 text-gray-600 border-gray-200 hover:bg-gray-50"
                >
                  ❌ 全て非表示
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newVisibleItems = { ...visibleItems }
                    Object.keys(allAvailableItems).forEach(itemId => {
                      newVisibleItems[itemId] = !newVisibleItems[itemId]
                    })
                    setVisibleItems(newVisibleItems)
                  }}
                  className="text-xs h-7 px-3 text-blue-600 border-blue-200 hover:bg-blue-50"
                >
                  🔄 反転
                </Button>
              </div>
              
              {/* 操作ヒント */}
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="text-xs text-gray-500 text-center">
                  💡 項目をクリックして表示/非表示を柔軟に切り替え ｜ 
                  📊 全項目常時表示で確実なON/OFF制御 ｜ 
                  🎯 カテゴリ別整理で直感的操作
                </div>
              </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}
          
          <div className="mt-4 text-xs text-gray-500 text-center">
            💡 月をクリックして詳細分析を表示 ｜ 📊 全カテゴリ同時表示・費用マイナス ｜ 🎯 スマート凡例でON/OFF制御
          </div>
        </CardContent>
      </Card>

      {/* 詳細分析ダイアログ */}
      <Dialog open={drilldownOpen} onOpenChange={setDrilldownOpen} modal={true}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          {selectedMonth && (
            <div className="space-y-6">
              {/* ヘッダー */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 -mx-6 -mt-6 mb-6 px-6 py-4 rounded-t-lg">
                <div className="flex items-center justify-between text-white">
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-8 h-8" />
                    <div>
                      <h2 className="text-2xl font-bold">
                        {selectedMonth.year}年{selectedMonth.month}
                      </h2>
                      <p className="text-blue-100">財務パフォーマンス詳細分析レポート</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* サマリー */}
              <div className="grid grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                  <CardContent className="p-4 text-center">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <TrendingUp className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="text-2xl font-bold text-green-700">¥{selectedMonth.revenue.total.toLocaleString()}</div>
                    <div className="text-sm text-gray-600">総収入</div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-red-50 to-pink-50 border-red-200">
                  <CardContent className="p-4 text-center">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <TrendingDown className="w-6 h-6 text-red-600" />
                    </div>
                    <div className="text-2xl font-bold text-red-700">¥{selectedMonth.expenses.total.toLocaleString()}</div>
                    <div className="text-sm text-gray-600">総支出</div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
                  <CardContent className="p-4 text-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Target className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="text-2xl font-bold text-blue-700">¥{selectedMonth.profit.net.toLocaleString()}</div>
                    <div className="text-sm text-gray-600">純利益</div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
                  <CardContent className="p-4 text-center">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Zap className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="text-2xl font-bold text-purple-700">{selectedMonth.efficiency.roi_percentage}%</div>
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
                          生産性
                        </Badge>
                      </div>
                      <div className="text-lg font-bold text-gray-800">
                        ¥{selectedMonth.efficiency.profit_per_area.toLocaleString()}/ha
                      </div>
                      <div className="text-xs text-gray-500">
                        面積生産性指標
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
                        {selectedMonth.efficiency.roi_percentage}%
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
                        {selectedMonth.efficiency.productivity_index}
                      </div>
                      <div className="text-xs text-gray-500">
                        総合生産性指数
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
                        <h4 className="font-bold text-gray-800 flex items-center gap-2">
                          <span className={`w-6 h-6 rounded text-center text-sm leading-6 ${
                            selectedMonth.growth.sales_growth_rate >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                          }`}>
                            📊
                          </span>
                          売上成長率
                        </h4>
                        <Badge className={selectedMonth.growth.sales_growth_rate >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                          {selectedMonth.growth.sales_growth_rate >= 0 ? '成長' : '減少'}
                        </Badge>
                      </div>
                      <div className="text-2xl font-bold text-gray-800">
                        {selectedMonth.growth.sales_growth_rate > 0 ? '+' : ''}{selectedMonth.growth.sales_growth_rate}%
                      </div>
                      <div className="text-xs text-gray-500">前年同月比</div>
                    </div>
                    
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-gray-800 flex items-center gap-2">
                          <span className={`w-6 h-6 rounded text-center text-sm leading-6 ${
                            selectedMonth.growth.profit_growth_rate >= 0 ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'
                          }`}>
                            💰
                          </span>
                          利益成長率
                        </h4>
                        <Badge className={selectedMonth.growth.profit_growth_rate >= 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}>
                          {selectedMonth.growth.profit_growth_rate >= 0 ? '改善' : '悪化'}
                        </Badge>
                      </div>
                      <div className="text-2xl font-bold text-gray-800">
                        {selectedMonth.growth.profit_growth_rate > 0 ? '+' : ''}{selectedMonth.growth.profit_growth_rate}%
                      </div>
                      <div className="text-xs text-gray-500">前年同月比</div>
                    </div>
                    
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-gray-800 flex items-center gap-2">
                          <span className={`w-6 h-6 rounded text-center text-sm leading-6 ${
                            selectedMonth.growth.efficiency_growth_rate >= 0 ? 'bg-purple-100 text-purple-600' : 'bg-red-100 text-red-600'
                          }`}>
                            ⚡
                          </span>
                          効率性成長率
                        </h4>
                        <Badge className={selectedMonth.growth.efficiency_growth_rate >= 0 ? 'bg-purple-100 text-purple-700' : 'bg-red-100 text-red-700'}>
                          {selectedMonth.growth.efficiency_growth_rate >= 0 ? '向上' : '低下'}
                        </Badge>
                      </div>
                      <div className="text-2xl font-bold text-gray-800">
                        {selectedMonth.growth.efficiency_growth_rate > 0 ? '+' : ''}{selectedMonth.growth.efficiency_growth_rate}%
                      </div>
                      <div className="text-xs text-gray-500">前年同月比</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          
          <DialogPrimitive.Close asChild>
            <Button variant="outline" className="mt-6 w-full">
              <X className="w-4 h-4 mr-2" />
              分析を閉じる
            </Button>
          </DialogPrimitive.Close>
        </DialogContent>
      </Dialog>
    </>
  )
}