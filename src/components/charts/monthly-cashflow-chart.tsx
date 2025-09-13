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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogPortal, DialogOverlay } from '@/components/ui/dialog'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils/index'
import { CalendarIcon, TrendingUp, TrendingDown, Eye, X, ChevronRight } from 'lucide-react'
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

interface MonthlyCashflowChartProps {
  companyId: string
  selectedVegetable?: string
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

// カスタムLargeDialogContent - プロフェッショナル実装（アクセシビリティ対応）
interface LargeDialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  width?: string
  height?: string
  children?: React.ReactNode
  title?: string
}

function LargeDialogContent({
  className,
  children,
  width = "4000px",
  height = "800px",
  title = "詳細データ",
  ...props
}: LargeDialogContentProps) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          // 基本レイアウト
          "fixed top-[50%] left-[50%] z-50 translate-x-[-50%] translate-y-[-50%]",
          // アニメーション
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          // スタイリング
          "grid gap-4 rounded-lg border p-6 shadow-lg duration-200",
          "bg-white border-gray-300 shadow-xl overflow-auto",
          className
        )}
        style={{ 
          width, 
          height, 
          maxWidth: '98vw', 
          maxHeight: '98vh' 
        }}
        {...props}
      >
        {/* アクセシビリティ用の非表示タイトル */}
        <DialogPrimitive.Title className="sr-only">
          {title}
        </DialogPrimitive.Title>
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

export default function MonthlyCashflowChart({ companyId, selectedVegetable = 'all' }: MonthlyCashflowChartProps) {
  const [startMonth, setStartMonth] = useState<Date>(new Date(new Date().getFullYear(), 0, 1))
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [yearMonthPickerOpen, setYearMonthPickerOpen] = useState(false)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [selectedMonthNum, setSelectedMonthNum] = useState<number>(1)
  const [displayPeriod, setDisplayPeriod] = useState<1 | 2 | 3>(1) // 新しい期間選択状態
  const [cashflowData, setCashflowData] = useState<CashFlowData[]>([])
  const [previousYearData, setPreviousYearData] = useState<CashFlowData[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<CashFlowData | null>(null)
  const [drilldownOpen, setDrilldownOpen] = useState(false)
  const [showComparison, setShowComparison] = useState(true)
  const [showCumulativeLine, setShowCumulativeLine] = useState(true)
  const [cumulativeType, setCumulativeType] = useState<'profit' | 'income' | 'expense'>('profit')
  const [containerWidth, setContainerWidth] = useState(0)
  // 右側Y軸は常に最適化モード
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [isLegendOpen, setIsLegendOpen] = useState(true) // 凡例セクションの開閉状態（デフォルト展開）
  const [isComparisonOpen, setIsComparisonOpen] = useState(false) // 前年比較セクションの開閉状態
  
  const chartRef = useRef<ChartJS<'bar'>>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [chartDimensions, setChartDimensions] = useState({ left: 0, right: 0, width: 0 })

  // レスポンシブ寸法計算
  const calculateResponsiveDimensions = useCallback((period: number, containerWidth: number): ResponsiveDimensions => {
    const monthCount = period * 12
    const availableWidth = containerWidth - 120 // Y軸ラベル等のマージンを考慮
    const idealBarWidth = availableWidth / monthCount
    
    // 最小25px、最大80pxでバー幅を制限
    const barWidth = Math.max(25, Math.min(80, idealBarWidth))
    
    // バー幅に応じて他の設定を調整
    const categoryPercentage = barWidth > 50 ? 0.9 : 0.95
    const barPercentage = barWidth > 50 ? 0.8 : barWidth > 35 ? 0.85 : 0.9
    const fontSize = barWidth > 50 ? 12 : barWidth > 35 ? 11 : 10
    const labelRotation = barWidth < 40 ? 45 : 0
    
    return {
      monthCount,
      barWidth,
      categoryPercentage,
      barPercentage,
      fontSize,
      labelRotation
    }
  }, [])

  // コンテナ幅の監視
  useEffect(() => {
    const updateContainerWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth)
      }
    }

    updateContainerWidth()
    window.addEventListener('resize', updateContainerWidth)
    return () => window.removeEventListener('resize', updateContainerWidth)
  }, [])

  // レスポンシブ設定の計算
  const responsiveDimensions = useMemo(() => 
    calculateResponsiveDimensions(displayPeriod, containerWidth), 
    [displayPeriod, containerWidth, calculateResponsiveDimensions]
  )

  // Y軸範囲の動的計算（金融プロフェッショナル向け最適化設計）
  const calculateYAxisRange = useCallback((data: CashFlowData[]) => {
    if (!data || data.length === 0) return { min: -100000, max: 100000, stepSize: 20000 }
    
    // スタックグラフのため、収入の合計と支出の合計それぞれの最大値を計算
    let maxIncome = 0
    let maxExpense = 0
    
    data.forEach(d => {
      let monthlyIncome = 0
      let monthlyExpense = 0
      
      // 各作業種別の収入・支出を集計
      Object.values(d.work_types).forEach(workType => {
        if (workType.income > 0) {
          monthlyIncome += workType.income
        }
        if (workType.expense < 0) {
          monthlyExpense += Math.abs(workType.expense)
        }
      })
      
      maxIncome = Math.max(maxIncome, monthlyIncome)
      maxExpense = Math.max(maxExpense, monthlyExpense)
    })
    
    // 最大値と最小値を決定
    const rawMax = maxIncome
    const rawMin = -maxExpense
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
    const roundToNice = (value: number, isMax: boolean = false) => {
      if (value === 0) return 0
      
      const absValue = Math.abs(value)
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
      
      return Math.ceil(absValue / unit) * unit * (value < 0 ? -1 : 1)
    }
    
    const finalMin = roundToNice(optimizedMin, false)
    const finalMax = roundToNice(optimizedMax, true)
    
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

  // データフェッチ
  const fetchCashflowData = useCallback(async () => {
    if (!companyId) return
    
    setLoading(true)
    try {
      console.log('📊 キャッシュフローデータ取得開始:', companyId)
      
      const endMonth = addMonths(startMonth, responsiveDimensions.monthCount - 1)
      const startDate = format(startMonth, 'yyyy-MM-01')
      const endDate = format(endMonth, 'yyyy-MM-dd')
      
      // 現在年と前年データを並行取得
      let apiUrl = `/api/reports?company_id=${companyId}&start_date=${startDate}&end_date=${endDate}&limit=1000`
      if (selectedVegetable && selectedVegetable !== 'all') {
        apiUrl += `&vegetable_id=${selectedVegetable}`
      }
      
      // 前年同期のデータも取得
      const previousYearStart = format(subMonths(startMonth, 12), 'yyyy-MM-01')
      const previousYearEnd = format(subMonths(endMonth, 12), 'yyyy-MM-dd')
      let previousYearApiUrl = `/api/reports?company_id=${companyId}&start_date=${previousYearStart}&end_date=${previousYearEnd}&limit=1000`
      if (selectedVegetable && selectedVegetable !== 'all') {
        previousYearApiUrl += `&vegetable_id=${selectedVegetable}`
      }
      
      const [reportsResponse, previousYearResponse] = await Promise.all([
        fetch(apiUrl),
        fetch(previousYearApiUrl)
      ])
      
      if (!reportsResponse.ok) {
        throw new Error('データの取得に失敗しました')
      }
      
      const reportsResult = await reportsResponse.json()
      const reports = reportsResult.success ? reportsResult.data : []
      
      const previousYearResult = previousYearResponse.ok ? await previousYearResponse.json() : { success: false, data: [] }
      const previousYearReports = previousYearResult.success ? previousYearResult.data : []
      
      console.log('🥬 キャッシュフロー: フィルター適用', {
        選択野菜: selectedVegetable,
        取得レポート数: reports.length,
        前年レポート数: previousYearReports.length
      })
      
      // 月次キャッシュフローデータを生成
      const monthlyData: CashFlowData[] = []
      const previousMonthlyData: CashFlowData[] = []
      
      for (let i = 0; i < responsiveDimensions.monthCount; i++) {
        const currentMonth = addMonths(startMonth, i)
        const monthKey = format(currentMonth, 'yyyy-MM')
        const monthReports = reports.filter((r: any) => 
          r.work_date.startsWith(monthKey)
        )
        
        const workTypes: any = {}
        let monthlyIncome = 0
        let monthlyExpense = 0
        
        // 作業種別ごとにデータを集計（より詳細な会計処理）
        Object.keys(WORK_TYPE_COLORS).forEach(workType => {
          const typeReports = monthReports.filter((r: any) => r.work_type === workType)
          
          // 会計項目から収入と支出を分けて集計
          let accountingIncome = 0
          let accountingExpense = 0
          
          typeReports.forEach((r: any) => {
            if (r.work_report_accounting && Array.isArray(r.work_report_accounting)) {
              r.work_report_accounting.forEach((acc: any) => {
                // accounting_itemsのtypeで収入・支出を判定
                if (acc.accounting_items?.type === 'income' || acc.accounting_items?.code?.startsWith('①') || 
                    acc.accounting_items?.code?.startsWith('②') || acc.accounting_items?.code?.startsWith('③')) {
                  accountingIncome += acc.amount || 0
                } else {
                  accountingExpense += acc.amount || 0
                }
              })
            }
          })
          
          // 収入の計算（会計収入を優先、なければ収穫量×予想価格または予想収益）
          let income = accountingIncome
          if (income === 0) {
            if (workType === 'harvesting') {
              income = typeReports.reduce((sum: number, r: any) => {
                const harvestRevenue = (r.harvest_amount || 0) * (r.expected_price || 0)
                const expectedRevenue = r.expected_revenue || 0
                return sum + Math.max(harvestRevenue, expectedRevenue)
              }, 0)
            } else {
              income = typeReports.reduce((sum: number, r: any) => sum + (r.expected_revenue || 0), 0)
            }
          }
          
          // 支出の計算（会計支出を優先、なければ推定コスト）
          const directCosts = typeReports.reduce((sum: number, r: any) => sum + (r.estimated_cost || 0), 0)
          const totalExpense = accountingExpense > 0 ? accountingExpense : directCosts
          
          workTypes[workType] = {
            income,
            expense: -totalExpense, // 支出はマイナス値
            net: income - totalExpense,
            details: typeReports.map((r: any) => ({
              id: r.id,
              work_type: r.work_type,
              item_name: workType === 'harvesting' && r.harvest_amount 
                ? `${WORK_TYPE_LABELS[r.work_type as keyof typeof WORK_TYPE_LABELS]}作業 (${r.harvest_amount}${r.harvest_unit || 'kg'})`
                : `${WORK_TYPE_LABELS[r.work_type as keyof typeof WORK_TYPE_LABELS]}作業`,
              amount: income - totalExpense,
              category: income >= totalExpense ? 'income' as const : 'expense' as const,
              work_date: r.work_date,
              description: r.notes || r.description,
              harvest_amount: r.harvest_amount,
              harvest_unit: r.harvest_unit,
              expected_price: r.expected_price,
              accounting_items: r.work_report_accounting || []
            }))
          }
          
          monthlyIncome += income
          monthlyExpense += totalExpense
        })
        
        // 累積データを計算
        const previousMonthData = monthlyData[monthlyData.length - 1]
        const cumulativeIncome = (previousMonthData?.cumulative_income || 0) + monthlyIncome
        const cumulativeExpense = (previousMonthData?.cumulative_expense || 0) + monthlyExpense
        const cumulativeProfit = cumulativeIncome - cumulativeExpense
        
        // トレンド判定
        let trend: 'up' | 'down' | 'stable' = 'stable'
        if (previousMonthData) {
          const prevProfit = previousMonthData.cumulative_profit
          const profitChange = cumulativeProfit - prevProfit
          if (profitChange > 0) trend = 'up'
          else if (profitChange < 0) trend = 'down'
        }

        monthlyData.push({
          month: format(currentMonth, 'M月', { locale: ja }),
          year: currentMonth.getFullYear(),
          month_num: currentMonth.getMonth() + 1,
          work_types: workTypes,
          monthly_total: monthlyIncome - monthlyExpense,
          monthly_income: monthlyIncome,
          monthly_expense: monthlyExpense,
          // 累積損益データを追加
          cumulative_profit: cumulativeProfit,
          cumulative_income: cumulativeIncome,
          cumulative_expense: cumulativeExpense,
          cumulative_trend: trend
        })
      }
      
      // 前年データも同様に処理
      for (let i = 0; i < responsiveDimensions.monthCount; i++) {
        const currentMonth = addMonths(startMonth, i)
        const previousMonth = subMonths(currentMonth, 12)
        const monthKey = format(previousMonth, 'yyyy-MM')
        const prevMonthReports = previousYearReports.filter((r: any) => 
          r.work_date.startsWith(monthKey)
        )
        
        const workTypes: any = {}
        let monthlyIncome = 0
        let monthlyExpense = 0
        
        // 前年の作業種別ごとにデータを集計
        Object.keys(WORK_TYPE_COLORS).forEach(workType => {
          const typeReports = prevMonthReports.filter((r: any) => r.work_type === workType)
          
          let income = 0
          if (workType === 'harvesting') {
            income = typeReports.reduce((sum: number, r: any) => {
              const harvestRevenue = (r.harvest_amount || 0) * (r.expected_price || 0)
              const expectedRevenue = r.expected_revenue || 0
              return sum + Math.max(harvestRevenue, expectedRevenue)
            }, 0)
          } else {
            income = typeReports.reduce((sum: number, r: any) => sum + (r.expected_revenue || 0), 0)
          }
          
          const directCosts = typeReports.reduce((sum: number, r: any) => sum + (r.estimated_cost || 0), 0)
          const accountingCosts = typeReports.reduce((sum: number, r: any) => {
            if (r.work_report_accounting && Array.isArray(r.work_report_accounting)) {
              return sum + r.work_report_accounting.reduce((accSum: number, acc: any) => accSum + (acc.amount || 0), 0)
            }
            return sum
          }, 0)
          const totalExpense = directCosts + accountingCosts
          
          workTypes[workType] = {
            income,
            expense: -totalExpense,
            net: income - totalExpense,
            details: []
          }
          
          monthlyIncome += income
          monthlyExpense += totalExpense
        })
        
        // 前年の累積データを計算
        const previousMonthPrevData = previousMonthlyData[previousMonthlyData.length - 1]
        const cumulativeIncome = (previousMonthPrevData?.cumulative_income || 0) + monthlyIncome
        const cumulativeExpense = (previousMonthPrevData?.cumulative_expense || 0) + monthlyExpense
        const cumulativeProfit = cumulativeIncome - cumulativeExpense
        
        let trend: 'up' | 'down' | 'stable' = 'stable'
        if (previousMonthPrevData) {
          const prevProfit = previousMonthPrevData.cumulative_profit
          const profitChange = cumulativeProfit - prevProfit
          if (profitChange > 0) trend = 'up'
          else if (profitChange < 0) trend = 'down'
        }

        previousMonthlyData.push({
          month: format(currentMonth, 'M月', { locale: ja }),
          year: currentMonth.getFullYear(),
          month_num: currentMonth.getMonth() + 1,
          work_types: workTypes,
          monthly_total: monthlyIncome - monthlyExpense,
          monthly_income: monthlyIncome,
          monthly_expense: monthlyExpense,
          // 前年の累積損益データを追加
          cumulative_profit: cumulativeProfit,
          cumulative_income: cumulativeIncome,
          cumulative_expense: cumulativeExpense,
          cumulative_trend: trend
        })
      }
      
      setCashflowData(monthlyData)
      setPreviousYearData(previousMonthlyData)
      setLastUpdated(new Date())
      console.log('✅ キャッシュフローデータ生成完了:', monthlyData.length, '件', '前年:', previousMonthlyData.length, '件')
      
    } catch (error) {
      console.error('❌ キャッシュフローデータ取得エラー:', error)
      setCashflowData([])
    } finally {
      setLoading(false)
    }
  }, [companyId, startMonth, selectedVegetable, responsiveDimensions])

  // データフェッチ実行
  React.useEffect(() => {
    if (companyId) {
      fetchCashflowData()
    }
  }, [fetchCashflowData, companyId])

  // チャートデータの準備
  const chartData = useMemo(() => {
    if (!cashflowData || cashflowData.length === 0) return null
    
    const workTypes = Object.keys(WORK_TYPE_COLORS)
    const datasets = workTypes.map(workType => {
      // 純損益（収入-支出）を同じ列にプロット
      const netData = cashflowData.map(d => {
        const income = d.work_types[workType]?.income || 0
        const expense = d.work_types[workType]?.expense || 0
        return income + expense // expenseは既にマイナス値なのでそのまま加算
      })
      
      return {
        label: `${WORK_TYPE_LABELS[workType as keyof typeof WORK_TYPE_LABELS]}`,
        data: netData,
        backgroundColor: WORK_TYPE_COLORS[workType as keyof typeof WORK_TYPE_COLORS],
        borderColor: WORK_TYPE_COLORS[workType as keyof typeof WORK_TYPE_COLORS],
        borderWidth: 1,
        stack: 'main', // 全て同じスタックに配置
        order: 1 // 線グラフより後ろに表示
      }
    })
    
    // 2段階X軸ラベルの準備
    const monthLabels = cashflowData.map(d => d.month)
    const yearLabels = cashflowData.map((d, index) => {
      // 年が変わるか最初の要素の場合のみ年を表示
      if (index === 0 || cashflowData[index - 1].year !== d.year) {
        return `${d.year}年`
      }
      return ''
    })
    
    // フリーキャッシュフロー線グラフ（最上面表示）
    const netProfitLineDataset = {
      type: 'line' as const,
      label: '📈 純損益推移',
      data: cashflowData.map(d => d.monthly_total),
      borderColor: '#dc2626', // 赤色の線
      backgroundColor: 'rgba(220, 38, 38, 0.1)',
      borderWidth: 4, // 少し太くして視認性向上
      pointRadius: 8, // ポイントを大きくして見やすく
      pointBackgroundColor: '#ffffff',
      pointBorderColor: '#dc2626',
      pointBorderWidth: 3,
      fill: false,
      tension: 0.3, // カーブを滑らかに
      yAxisID: 'y', // 左軸を使用
      order: 0, // 最上面に表示（数値が小さいほど前面）
      pointHoverRadius: 10, // ホバー時のポイント拡大
      pointHoverBorderWidth: 4,
      pointHitRadius: 15 // クリック・ホバー判定エリアを拡大
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
          lineColor = '#059669' // エメラルド色
          lineLabel = '📊 累積損益'
          break
        case 'income':
          cumulativeData = cashflowData.map(d => d.cumulative_income)
          lineColor = '#0284c7' // 青色
          lineLabel = '💰 累積収入'
          break
        case 'expense':
          cumulativeData = cashflowData.map(d => -d.cumulative_expense) // 支出はプラス値で表示
          lineColor = '#dc2626' // 赤色
          lineLabel = '💸 累積支出'
          break
      }
      
      cumulativeDatasets.push({
        type: 'line' as const,
        label: lineLabel,
        data: cumulativeData,
        borderColor: lineColor,
        backgroundColor: `${lineColor}20`,
        borderWidth: 3,
        pointRadius: 7, // ポイントを大きくして見やすく
        pointBackgroundColor: '#ffffff',
        pointBorderColor: lineColor,
        pointBorderWidth: 2,
        fill: false,
        tension: 0.4,
        yAxisID: 'y1', // 右Y軸を使用
        order: -1, // 純損益線より前面に表示
        pointHoverRadius: 9,
        pointHoverBorderWidth: 3,
        pointHitRadius: 12, // クリック・ホバー判定エリアを拡大
        borderDash: cumulativeType !== 'profit' ? [5, 5] : [], // 損益以外は点線
      })
    }

    return {
      labels: monthLabels,
      datasets: [...datasets, netProfitLineDataset, ...cumulativeDatasets],
      yearLabels
    }
  }, [cashflowData, showCumulativeLine, cumulativeType])

  // Y軸範囲の計算
  const yAxisRange = useMemo(() => 
    calculateYAxisRange(cashflowData), [cashflowData, calculateYAxisRange]
  )
  
  // 右側Y軸の範囲を計算（モードに応じて切り替え）
  const rightAxisRange = useMemo(() => {
    // 常に最適化モード：プリセット最適化方式（業界標準）
    if (!showCumulativeLine || !chartData || !chartData.datasets) {
      return yAxisRange
    }
    
    // 累積線のデータを取得
    const cumulativeDataset = chartData.datasets.find(d => d.type === 'line')
    if (!cumulativeDataset || !cumulativeDataset.data) {
      return yAxisRange
    }
    
    const values = cumulativeDataset.data as number[]
    const rawMax = Math.max(...values, 0)
    const rawMin = Math.min(...values, 0)
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
    
    // キリの良い値に丸める
    const roundToNice = (value: number) => {
      if (value === 0) return 0
      const absValue = Math.abs(value)
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
      
      const rounded = Math.ceil(absValue / unit) * unit
      return value < 0 ? -rounded : rounded
    }
    
    const finalMin = roundToNice(optimizedMin)
    const finalMax = roundToNice(optimizedMax)
    
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
    
    return {
      min: symmetricMin,
      max: symmetricMax,
      stepSize: stepSize
    }
  }, [yAxisRange, showCumulativeLine, chartData, cumulativeType])

  // Chart.jsの実際のチャートエリア寸法を取得（より正確な計算）
  const updateChartDimensions = useCallback(() => {
    if (chartRef.current) {
      const chart = chartRef.current
      const chartArea = chart.chartArea
      const meta = chart.getDatasetMeta(0) // 最初のデータセットのメタデータを取得
      
      if (chartArea && meta && meta.data.length > 0) {
        // 実際のバーの位置を基に計算
        const firstBar = meta.data[0]
        const lastBar = meta.data[meta.data.length - 1]
        
        if (firstBar && lastBar) {
          const actualLeft = firstBar.x - (firstBar.width || 0) / 2
          const actualRight = lastBar.x + (lastBar.width || 0) / 2
          const actualWidth = actualRight - actualLeft
          
          setChartDimensions({
            left: Math.round(actualLeft),
            right: Math.round(chart.width - actualRight),
            width: Math.round(actualWidth)
          })
        } else {
          // フォールバック：chartAreaを使用
          setChartDimensions({
            left: Math.round(chartArea.left),
            right: Math.round(chart.width - chartArea.right),
            width: Math.round(chartArea.width)
          })
        }
      }
    }
  }, [])

  // チャートデータ更新時に寸法を再計算
  useEffect(() => {
    if (chartRef.current && cashflowData.length > 0) {
      // Chart.jsの描画完了を待ってから寸法を取得
      setTimeout(updateChartDimensions, 100)
    }
  }, [cashflowData, updateChartDimensions])

  // チャートオプション
  const chartOptions: ChartOptions<'bar'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    onClick: (event: ChartEvent, elements: InteractionItem[]) => {
      if (elements.length > 0 && chartRef.current) {
        const elementIndex = elements[0].index
        const selectedData = cashflowData[elementIndex]
        if (selectedData) {
          setSelectedMonth(selectedData)
          setDrilldownOpen(true)
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
          display: false,
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
        // レスポンシブバー幅の設定
        barPercentage: responsiveDimensions.barPercentage,
        categoryPercentage: responsiveDimensions.categoryPercentage,
        // パディング設定
        bounds: 'ticks',
        afterFit: function(scale) {
          scale.paddingBottom = 60
        }
      },
      y: {
        stacked: true, // 単一スタック構造に対応
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
          stepSize: yAxisRange.stepSize, // キリの良い間隔で目盛りを設定
          color: '#1f2937', // より濃い色で視認性向上
          font: {
            size: 13, // 統一サイズ
            weight: '600', // より太字で視認性向上
            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          },
          padding: 10, // パディングを広げて余裕を持たせる
          callback: function(value) {
            const numValue = value as number
            
            // 0の場合は強調表示
            if (numValue === 0) {
              return '━ 0円 ━'  // 視覚的に分かりやすく
            }
            
            // 見やすい日本式の単位で表示
            if (Math.abs(numValue) >= 100000000) {
              // 1億円以上 - 小数点を適切に処理
              const okuValue = numValue / 100000000
              return okuValue % 1 === 0 ? `${okuValue}億円` : `${okuValue.toFixed(1)}億円`
            } else if (Math.abs(numValue) >= 10000) {
              // 1万円以上
              const manValue = Math.round(numValue / 10000)
              return `${manValue.toLocaleString()}万円`
            } else if (Math.abs(numValue) >= 1000) {
              // 1千円以上
              return `${Math.round(numValue / 1000)}千円`
            } else {
              // 1千円未満
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
        min: rightAxisRange.min, // モードに応じた最小値
        max: rightAxisRange.max, // モードに応じた最大値
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
            size: 14,  // サイズを大きく統一
            weight: '700'  // より太く
          }
        },
        ticks: {
          stepSize: rightAxisRange.stepSize, // モードに応じた目盛り間隔
          color: cumulativeType === 'profit' ? '#059669' : 
                 cumulativeType === 'income' ? '#0284c7' : '#dc2626',
          font: {
            size: 13, // 左軸と統一
            weight: '600'
          },
          padding: 0, // 余白を縮める
          callback: function(value) {
            const numValue = Math.abs(value as number)
            
            if (numValue >= 100000000) {
              const okuValue = numValue / 100000000
              return okuValue % 1 === 0 ? `${okuValue}億` : `${okuValue.toFixed(1)}億`
            } else if (numValue >= 10000) {
              return `${Math.round(numValue / 10000)}万`
            } else if (numValue >= 1000) {
              return `${Math.round(numValue / 1000)}千`
            } else {
              return `${Math.round(numValue)}`
            }
          }
        }
      }
    },
    plugins: {
      legend: {
        display: false // カスタム凡例を使用
      },
      tooltip: {
        backgroundColor: '#ffffff',
        titleColor: '#1f2937',
        bodyColor: '#374151',
        borderColor: '#d1d5db',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        displayColors: true, // 色付きのマーカーを表示
        titleFont: {
          size: 14,
          weight: '600'
        },
        bodyFont: {
          size: 12,
          weight: '400'
        },
        interaction: {
          mode: 'point', // ポイントごとに個別表示
          intersect: false // カーソルが近くにあれば表示
        },
        callbacks: {
          title: (context) => {
            const dataIndex = context[0].dataIndex
            const data = cashflowData[dataIndex]
            return `${data.year}年${data.month}`
          },
          label: (context) => {
            const value = context.raw as number
            const datasetType = context.dataset.type || 'bar'
            
            // 値のフォーマット
            const formattedValue = new Intl.NumberFormat('ja-JP', {
              style: 'currency',
              currency: 'JPY',
              minimumFractionDigits: 0
            }).format(value < 0 ? Math.abs(value) : value)
            
            // ラベルの作成
            let label = context.dataset.label || ''
            
            // 棒グラフの場合（作業種別）
            if (datasetType === 'bar') {
              if (value > 0) {
                return `${label} (収入): +${formattedValue}`
              } else if (value < 0) {
                return `${label} (支出): -${formattedValue}`
              } else {
                return `${label}: ${formattedValue}`
              }
            }
            
            // 線グラフの場合（累積値）
            if (datasetType === 'line') {
              return `${label}: ${formattedValue}`
            }
            
            return `${label}: ${formattedValue}`
          },
          afterBody: (context) => {
            const dataIndex = context[0].dataIndex
            const data = cashflowData[dataIndex]
            
            // 月間サマリー情報を追加
            return [
              '',
              '━━━━━━━━━━━━━━━',
              `月間収入合計: ${new Intl.NumberFormat('ja-JP', { 
                style: 'currency', 
                currency: 'JPY',
                minimumFractionDigits: 0 
              }).format(data.monthly_income)}`,
              `月間支出合計: ${new Intl.NumberFormat('ja-JP', { 
                style: 'currency', 
                currency: 'JPY',
                minimumFractionDigits: 0 
              }).format(Math.abs(data.monthly_expense))}`,
              `月間純損益: ${new Intl.NumberFormat('ja-JP', { 
                style: 'currency', 
                currency: 'JPY',
                minimumFractionDigits: 0 
              }).format(data.monthly_total)}`,
              '',
              'クリックで詳細表示'
            ]
          }
        }
      }
    },
    animation: {
      duration: 600,
      easing: 'easeOutQuart',
      onComplete: function(animation) {
        // アニメーション完了後に寸法を更新（少し遅延させる）
        setTimeout(updateChartDimensions, 50)
      }
    },
    onResize: function(chart, size) {
      // リサイズ時にも寸法を更新
      setTimeout(updateChartDimensions, 50)
    }
  }), [yAxisRange, cashflowData, updateChartDimensions, responsiveDimensions, showCumulativeLine, cumulativeType])

  // 開始月変更ハンドラー（旧カレンダー用）
  const handleStartMonthChange = (date: Date | undefined) => {
    if (date) {
      setStartMonth(date)
      setCalendarOpen(false)
    }
  }

  // プロフェッショナル年月選択ハンドラー
  const handleYearMonthChange = () => {
    const newDate = new Date(selectedYear, selectedMonthNum - 1, 1)
    setStartMonth(newDate)
    setYearMonthPickerOpen(false)
  }

  // 年月選択の初期化
  React.useEffect(() => {
    setSelectedYear(startMonth.getFullYear())
    setSelectedMonthNum(startMonth.getMonth() + 1)
  }, [startMonth])

  // 合計値の計算
  const periodTotals = useMemo(() => {
    if (!cashflowData || cashflowData.length === 0) return {}
    
    const totals: { [workType: string]: number } = {}
    Object.keys(WORK_TYPE_COLORS).forEach(workType => {
      totals[workType] = cashflowData.reduce((sum, d) => 
        sum + (d.work_types[workType]?.net || 0), 0
      )
    })
    return totals
  }, [cashflowData])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>月次キャッシュフロー推移</CardTitle>
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
                  📈 月次キャッシュフロー推移
                </CardTitle>
                <p className="text-green-100 text-sm">
                  Monthly Cashflow Trend Analysis
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-green-100 uppercase tracking-wider">AgriFinance Pro</div>
              <div className="text-sm font-medium">資金流動分析システム</div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          {/* フィルターコントロール */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex items-center gap-3">
                {/* 表示期間選択 */}
                <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1">
                  {[1, 2, 3].map((period) => (
                    <Button
                      key={period}
                      variant={displayPeriod === period ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setDisplayPeriod(period as 1 | 2 | 3)}
                      className={`px-3 h-7 text-xs ${
                        displayPeriod === period 
                          ? 'bg-blue-600 text-white shadow-sm' 
                          : 'text-gray-600 hover:bg-white hover:text-gray-800'
                      }`}
                    >
                      {period}年
                    </Button>
                  ))}
                </div>
                
                {/* 前年比較トグル */}
                <Button
                  variant={showComparison ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowComparison(!showComparison)}
                  disabled={previousYearData.length === 0}
                >
                  📈 前年比較
                </Button>

                {/* 累積損益線トグル */}
                <Button
                  variant={showCumulativeLine ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowCumulativeLine(!showCumulativeLine)}
                  className={showCumulativeLine ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                >
                  📊 累積線
                </Button>

                {/* 累積線種別選択 */}
                {showCumulativeLine && (
                  <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1">
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
                            ? `bg-${type.color}-600 text-white shadow-sm hover:bg-${type.color}-700` 
                            : `text-gray-600 hover:bg-${type.color}-50 hover:text-${type.color}-800`
                        }`}
                      >
                        {type.label}
                      </Button>
                    ))}
                  </div>
                )}
                
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
                            className={`text-xs ${selectedMonthNum === month ? 'bg-green-600 text-white' : 'hover:bg-green-50'}`}
                          >
                            {month}月
                          </Button>
                        ))}
                      </div>
                    </div>
                    
                    {/* 表示期間プレビュー */}
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                      <div className="text-sm font-medium text-blue-800">表示期間プレビュー</div>
                      <div className="text-xs text-blue-600 mt-1">
                        {selectedYear}年{selectedMonthNum}月 ～ {new Date(selectedYear, selectedMonthNum - 1 + (displayPeriod * 12) - 1, 0).getFullYear()}年{new Date(selectedYear, selectedMonthNum - 1 + (displayPeriod * 12) - 1, 0).getMonth() + 1}月
                      </div>
                      <div className="text-xs text-blue-500 mt-1">（{displayPeriod}年間のデータを表示）</div>
                    </div>
                    
                    {/* アクションボタン */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={handleYearMonthChange}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
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
          </div>
          
          {/* グラフ */}
          <div ref={containerRef} className="h-[600px] relative overflow-visible">
            {chartData && (
              <div className="relative z-10" style={{ height: '580px' }}>
                <Bar 
                  ref={chartRef}
                  data={chartData} 
                  options={{
                    ...chartOptions,
                    maintainAspectRatio: false,
                    aspectRatio: undefined
                  }}
                />
              </div>
            )}
            
            {/* プロフェッショナル版: 動的寸法計算によるX軸完全位置合わせ */}
            {chartDimensions.width > 0 && (
              <div 
                className="absolute bottom-0 pointer-events-none z-0" 
                style={{ 
                  left: `${chartDimensions.left}px`,
                  right: `${chartDimensions.right}px`,
                  width: `${chartDimensions.width}px`
                }}
              >
                {/* 月表示層 - 実際のバー位置と完全に同期 */}
                <div className="relative bg-white border-t border-gray-300" style={{ height: '40px' }}>
                  {cashflowData.map((data, index) => {
                    // Chart.jsのメタデータから実際のバー位置を取得して配置（左端配置用）
                    const chart = chartRef.current
                    let barLeftX = chartDimensions.width / cashflowData.length * index // 左端位置のデフォルト
                    let barWidth = chartDimensions.width / cashflowData.length
                    
                    if (chart) {
                      const meta = chart.getDatasetMeta(0)
                      if (meta && meta.data[index]) {
                        const bar = meta.data[index]
                        barLeftX = (bar.x - (bar.width || 0) / 2) - chartDimensions.left // バーの左端
                        barWidth = bar.width || barWidth
                      }
                    }
                    
                    return (
                      <div
                        key={`month-${index}`}
                        className="absolute text-center text-sm font-medium text-gray-800 py-2 flex items-center justify-center"
                        style={{ 
                          left: `${barLeftX}px`,
                          width: `${barWidth}px`,
                          top: '0px',
                          height: '40px'
                        }}
                      >
                        {data.month}
                      </div>
                    )
                  })}
                </div>
                
                {/* 年表示層 - 実際のバー位置に基づいて年境界を計算 */}
                <div className="relative border-t-2 border-gray-400 bg-gray-100" style={{ height: '40px' }}>
                  {(() => {
                    const yearGroups = []
                    let currentYear = null
                    let yearStartIndex = 0
                    
                    cashflowData.forEach((data, index) => {
                      if (data.year !== currentYear) {
                        if (currentYear !== null) {
                          yearGroups.push({ 
                            year: currentYear, 
                            startIndex: yearStartIndex, 
                            endIndex: index - 1 
                          })
                        }
                        currentYear = data.year
                        yearStartIndex = index
                      }
                    })
                    
                    if (currentYear !== null) {
                      yearGroups.push({ 
                        year: currentYear, 
                        startIndex: yearStartIndex, 
                        endIndex: cashflowData.length - 1 
                      })
                    }
                    
                    return yearGroups.map((yearData) => {
                      const chart = chartRef.current
                      let startX = 0
                      let endX = chartDimensions.width
                      
                      if (chart) {
                        const meta = chart.getDatasetMeta(0)
                        if (meta && meta.data.length > 0) {
                          const startBar = meta.data[yearData.startIndex]
                          const endBar = meta.data[yearData.endIndex]
                          
                          if (startBar && endBar) {
                            startX = (startBar.x - (startBar.width || 0) / 2) - chartDimensions.left
                            endX = (endBar.x + (endBar.width || 0) / 2) - chartDimensions.left
                          }
                        }
                      }
                      
                      const yearWidth = endX - startX
                      const centerX = startX + yearWidth / 2
                      
                      return (
                        <div
                          key={`year-${yearData.year}`}
                          className="absolute text-center text-sm font-bold text-gray-900 py-2 bg-gray-50 flex items-center justify-center border-r border-gray-400"
                          style={{ 
                            left: `${startX}px`,
                            width: `${yearWidth}px`,
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
            )}
            
            
            {/* 線プロット数値表示 */}
            {chartDimensions.width > 0 && (
              <div 
                className="absolute pointer-events-none z-30" 
                style={{ 
                  left: `${chartDimensions.left}px`,
                  right: `${chartDimensions.right}px`,
                  width: `${chartDimensions.width}px`,
                  top: '0px',
                  height: '100%'
                }}
              >
                {cashflowData.map((data, index) => {
                  // 0円の場合は表示しない
                  if (data.monthly_total === 0) return null
                  
                  // 実際のChart.jsバー位置と完全に同期（左端配置用）
                  const chart = chartRef.current
                  let xPosition = chartDimensions.width / cashflowData.length * (index + 0.5) // デフォルト位置（バー中央）
                  
                  if (chart) {
                    const meta = chart.getDatasetMeta(0)
                    if (meta && meta.data[index]) {
                      const bar = meta.data[index]
                      xPosition = bar.x - chartDimensions.left // バーの中央位置（線プロットは中央に表示）
                    }
                  }
                  
                  // Y軸の範囲を取得してポイントの位置を計算
                  const yRange = yAxisRange.max - yAxisRange.min
                  const valueRatio = (data.monthly_total - yAxisRange.min) / yRange
                  const yPosition = (1 - valueRatio) * 400 // チャート高さに基づく概算
                  
                  // レスポンシブ単位表記関数
                  const formatValue = (value: number) => {
                    if (Math.abs(value) >= 100000000) {
                      return `${(value / 100000000).toFixed(1)}億円`
                    } else if (Math.abs(value) >= 10000) {
                      return `${Math.round(value / 10000)}万円`
                    } else {
                      return `${Math.round(value)}円`
                    }
                  }
                  
                  const isPositive = data.monthly_total > 0
                  
                  return (
                    <div
                      key={`line-value-${index}`}
                      className={`absolute transform -translate-x-1/2 text-xs font-semibold px-2 py-1 rounded-md shadow-sm border transition-all duration-200 ${
                        isPositive 
                          ? 'text-green-800 bg-green-50 border-green-300 hover:bg-green-100' 
                          : 'text-red-800 bg-red-50 border-red-300 hover:bg-red-100'
                      }`}
                      style={{
                        left: `${xPosition}px`,
                        top: `${Math.max(5, yPosition - 15)}px`, // ポイントの少し上、最小5px
                        zIndex: 30
                      }}
                    >
                      <div className="flex items-center gap-1">
                        {/* プラス・マイナス記号アイコン */}
                        <span className={`text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          {isPositive ? '▲' : '▼'}
                        </span>
                        {formatValue(data.monthly_total)}
                      </div>
                      
                      {/* 小さな下向き矢印でポイントを指す */}
                      <div 
                        className={`absolute left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent ${
                          isPositive ? 'border-t-green-300' : 'border-t-red-300'
                        }`}
                        style={{ 
                          top: '100%',
                          borderTopWidth: '4px',
                          borderLeftWidth: '4px',
                          borderRightWidth: '4px'
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            )}
            
            {/* 寸法が未取得の場合のフォールバック表示 */}
            {chartDimensions.width === 0 && (
              <div className="absolute bottom-0 left-12 right-4 pointer-events-none bg-gray-100 text-center text-xs py-2 opacity-50">
                チャート寸法を計算中...
              </div>
            )}
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
                  {Object.entries(WORK_TYPE_LABELS).map(([workType, label]) => (
                    <div key={workType} className="flex items-center gap-2 p-2 bg-white rounded border">
                      <div 
                        className="w-4 h-4 rounded flex-shrink-0"
                        style={{ backgroundColor: WORK_TYPE_COLORS[workType as keyof typeof WORK_TYPE_COLORS] }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-700 truncate">{label}</div>
                        <div className="text-xs text-gray-500">
                          {new Intl.NumberFormat('ja-JP', { 
                            style: 'currency', 
                            currency: 'JPY', 
                            minimumFractionDigits: 0 
                          }).format(periodTotals[workType] || 0)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
          
          {/* 前年比較サマリー */}
          {showComparison && previousYearData.length > 0 && (
            <Collapsible open={isComparisonOpen} onOpenChange={setIsComparisonOpen} className="mt-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <CollapsibleTrigger className="w-full">
                  <h4 className="font-medium text-blue-800 mb-3 flex items-center gap-2 cursor-pointer hover:text-blue-600">
                    <ChevronRight 
                      className={`w-4 h-4 transition-transform duration-200 ${isComparisonOpen ? 'rotate-90' : ''}`}
                    />
                    📊 前年同期比較
                    <span className="text-xs text-blue-600 ml-auto">
                      {isComparisonOpen ? '閉じる' : '展開する'}
                    </span>
                  </h4>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                {(() => {
                  const currentTotal = cashflowData.reduce((sum, d) => sum + d.monthly_total, 0)
                  const previousTotal = previousYearData.reduce((sum, d) => sum + d.monthly_total, 0)
                  const growth = previousTotal !== 0 ? ((currentTotal - previousTotal) / Math.abs(previousTotal)) * 100 : 0
                  const currentAvg = currentTotal / cashflowData.length
                  const previousAvg = previousTotal / previousYearData.length
                  const avgGrowth = previousAvg !== 0 ? ((currentAvg - previousAvg) / Math.abs(previousAvg)) * 100 : 0
                  
                  return (
                    <>
                      <div className="text-center p-3 bg-white rounded border">
                        <div className="font-semibold text-gray-700">総合成長率</div>
                        <div className={`text-lg font-bold ${growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {growth >= 0 ? '+' : ''}{growth.toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-500">
                          今年: {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', minimumFractionDigits: 0 }).format(currentTotal)}
                        </div>
                        <div className="text-xs text-gray-400">
                          昨年: {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', minimumFractionDigits: 0 }).format(previousTotal)}
                        </div>
                      </div>
                      
                      <div className="text-center p-3 bg-white rounded border">
                        <div className="font-semibold text-gray-700">月平均成長率</div>
                        <div className={`text-lg font-bold ${avgGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {avgGrowth >= 0 ? '+' : ''}{avgGrowth.toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-500">
                          今年平均: {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', minimumFractionDigits: 0 }).format(currentAvg)}
                        </div>
                        <div className="text-xs text-gray-400">
                          昨年平均: {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', minimumFractionDigits: 0 }).format(previousAvg)}
                        </div>
                      </div>
                      
                      <div className="text-center p-3 bg-white rounded border">
                        <div className="font-semibold text-gray-700">改善月数</div>
                        <div className="text-lg font-bold text-blue-600">
                          {cashflowData.filter((d, i) => 
                            previousYearData[i] && d.monthly_total > previousYearData[i].monthly_total
                          ).length}/{cashflowData.length}月
                        </div>
                        <div className="text-xs text-gray-500">
                          前年同月を上回った月数
                        </div>
                      </div>
                    </>
                  )
                })()}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}
          
          <div className="mt-4 text-xs text-gray-500 text-center">
            💡 各月の棒グラフをクリックすると詳細データを表示できます
            {showComparison && previousYearData.length > 0 && <span className="ml-2">｜📈 前年比較モード有効</span>}
          </div>
        </CardContent>
      </Card>

      {/* データドリルダウンダイアログ - カスタム大型モーダル */}
      <Dialog open={drilldownOpen} onOpenChange={setDrilldownOpen} modal={true}>
        <LargeDialogContent 
          width="1000px" 
          height="800px"
          title={selectedMonth ? `${selectedMonth.year}年${selectedMonth.month}の月次農業経営詳細分析レポート` : "月次農業経営詳細分析レポート"}
        >
          {/* プロフェッショナル金融×農業ヘッダー */}
          <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 -mx-6 -mt-6 mb-6 px-6 py-4 rounded-t-lg">
            <div className="flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight">
                    {selectedMonth && `${selectedMonth.year}年${selectedMonth.month}`}
                  </h2>
                  <p className="text-green-100 text-sm">月次農業経営詳細分析レポート</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-green-100 uppercase tracking-wider">AgriFinance Pro</div>
                <div className="text-lg font-semibold">経営分析システム</div>
              </div>
            </div>
          </div>
          
          {selectedMonth && (
            <div className="space-y-6">
              {/* エグゼクティブサマリー - 金融風デザイン */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  📊 エグゼクティブサマリー
                  <div className="ml-auto px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                    農業経営指標
                  </div>
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  {/* 総収入 */}
                  <div className="bg-white border border-green-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="text-xs text-green-600 font-medium px-2 py-1 bg-green-50 rounded">
                        +収入
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-green-700 mb-1">
                      {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(selectedMonth.monthly_income)}
                    </div>
                    <div className="text-sm text-gray-600">総収入 | Revenue</div>
                    <div className="text-xs text-gray-500 mt-1">農産物売上・補助金等</div>
                  </div>
                  
                  {/* 総支出 */}
                  <div className="bg-white border border-red-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                        <TrendingDown className="w-5 h-5 text-red-600" />
                      </div>
                      <div className="text-xs text-red-600 font-medium px-2 py-1 bg-red-50 rounded">
                        -支出
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-red-700 mb-1">
                      {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(selectedMonth.monthly_expense)}
                    </div>
                    <div className="text-sm text-gray-600">総支出 | Cost</div>
                    <div className="text-xs text-gray-500 mt-1">資材費・人件費・設備費等</div>
                  </div>
                  
                  {/* 純損益 */}
                  <div className={`bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow ${
                    selectedMonth.monthly_total >= 0 ? 'border-blue-200' : 'border-orange-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        selectedMonth.monthly_total >= 0 ? 'bg-blue-100' : 'bg-orange-100'
                      }`}>
                        {selectedMonth.monthly_total >= 0 ? 
                          <TrendingUp className="w-5 h-5 text-blue-600" /> : 
                          <TrendingDown className="w-5 h-5 text-orange-600" />
                        }
                      </div>
                      <div className={`text-xs font-medium px-2 py-1 rounded ${
                        selectedMonth.monthly_total >= 0 
                          ? 'text-blue-600 bg-blue-50' 
                          : 'text-orange-600 bg-orange-50'
                      }`}>
                        {selectedMonth.monthly_total >= 0 ? '利益' : '損失'}
                      </div>
                    </div>
                    <div className={`text-2xl font-bold mb-1 ${
                      selectedMonth.monthly_total >= 0 ? 'text-blue-700' : 'text-orange-700'
                    }`}>
                      {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(selectedMonth.monthly_total)}
                    </div>
                    <div className="text-sm text-gray-600">純損益 | Net P&L</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {selectedMonth.monthly_total >= 0 ? '経営順調・収益拡大中' : '改善要・コスト最適化必要'}
                    </div>
                  </div>
                </div>
              </div>

              {/* 作業種別別収益分析 - プロフェッショナル金融レポート風 */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                <div className="bg-gradient-to-r from-slate-50 to-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    🌱 作業種別別収益分析
                    <div className="ml-auto px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                      農作業損益 | Operations P&L
                    </div>
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">各農作業における収益性とコスト効率の詳細分析</p>
                </div>
                
                <div className="p-6">
                  <div className="space-y-4">
                    {Object.entries(selectedMonth.work_types)
                      .filter(([_, data]) => data.income > 0 || data.expense < 0)
                      .map(([workType, data], index) => (
                        <div key={workType} className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                          {/* 作業種別ヘッダー */}
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm"
                                style={{ backgroundColor: WORK_TYPE_COLORS[workType as keyof typeof WORK_TYPE_COLORS] }}
                              >
                                {(index + 1).toString().padStart(2, '0')}
                              </div>
                              <div>
                                <h4 className="font-bold text-gray-800">
                                  {WORK_TYPE_LABELS[workType as keyof typeof WORK_TYPE_LABELS]}
                                </h4>
                                <p className="text-xs text-gray-500">農作業 | Agricultural Operation</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
                                data.net >= 0 
                                  ? 'bg-green-100 text-green-800 border border-green-200' 
                                  : 'bg-red-100 text-red-800 border border-red-200'
                              }`}>
                                {data.net >= 0 ? '✓ 利益' : '⚠ 損失'} {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(data.net)}
                              </div>
                            </div>
                          </div>
                          
                          {/* 収益・コスト分析 */}
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="bg-white border border-green-200 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-gray-600 flex items-center gap-1">
                                  📈 総収入 | Revenue
                                </span>
                                <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">+</div>
                              </div>
                              <div className="text-lg font-bold text-green-700">
                                {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(data.income)}
                              </div>
                              <div className="text-xs text-gray-500">売上・収益</div>
                            </div>
                            
                            <div className="bg-white border border-red-200 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-gray-600 flex items-center gap-1">
                                  📉 総支出 | Cost
                                </span>
                                <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">-</div>
                              </div>
                              <div className="text-lg font-bold text-red-700">
                                {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(Math.abs(data.expense))}
                              </div>
                              <div className="text-xs text-gray-500">費用・コスト</div>
                            </div>
                          </div>
                          
                          {/* 収益率 */}
                          <div className="bg-white border border-gray-200 rounded-lg p-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">🎯 投資収益率 | ROI</span>
                              <div className={`text-sm font-bold ${
                                data.expense !== 0 ? (data.net / Math.abs(data.expense)) > 0 ? 'text-blue-600' : 'text-orange-600' : 'text-gray-500'
                              }`}>
                                {data.expense !== 0 
                                  ? `${((data.net / Math.abs(data.expense)) * 100).toFixed(1)}%`
                                  : 'N/A'
                                }
                              </div>
                            </div>
                          </div>
                          
                          {data.details.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-300">
                              <div className="flex items-center justify-between mb-3">
                                <h5 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                  📋 作業実績詳細
                                  <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                                    {data.details.length}件
                                  </span>
                                </h5>
                              </div>
                              <div className="max-h-40 overflow-y-auto space-y-2 bg-white border border-gray-200 rounded-lg p-3">
                                {data.details.map((detail, detailIndex) => (
                                  <div key={detail.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs">
                                    <div className="flex justify-between items-start mb-2">
                                      <div className="font-medium text-gray-800 flex items-center gap-2">
                                        <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded text-center text-xs leading-5">
                                          {detailIndex + 1}
                                        </span>
                                        {detail.item_name}
                                      </div>
                                      <div className={`text-sm font-bold px-2 py-1 rounded-full ${
                                        detail.amount >= 0 ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'
                                      }`}>
                                        {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(detail.amount)}
                                      </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-2 text-gray-600">
                                      {detail.harvest_amount && (
                                        <div className="flex items-center gap-1">
                                          <span className="text-green-600">📦</span>
                                          収穫量: {detail.harvest_amount}{detail.harvest_unit || 'kg'}
                                          {detail.expected_price && (
                                            <span className="text-blue-600 ml-1">@ ¥{detail.expected_price}</span>
                                          )}
                                        </div>
                                      )}
                                      
                                      <div className="flex items-center gap-1">
                                        <span className="text-gray-500">📅</span>
                                        {new Date(detail.work_date).toLocaleDateString('ja-JP', { 
                                          month: 'short', 
                                          day: 'numeric' 
                                        })}
                                      </div>
                                    </div>
                                    
                                    {detail.description && 
                                     detail.description !== 'null' && 
                                     !detail.description.includes('{"work_notes":null') && 
                                     detail.description.trim() !== '' && (
                                      <div className="mt-2 text-gray-500 text-xs italic border-l-2 border-gray-300 pl-2">
                                        💭 {detail.description}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* 下部閉じるボタン */}
          <div className="flex justify-center pt-6 mt-6 border-t border-gray-200 bg-gradient-to-t from-gray-50 to-white -mx-6 -mb-6 px-6 pb-6 rounded-b-lg">
            <DialogPrimitive.Close asChild>
              <Button 
                variant="outline" 
                className="flex items-center gap-2 px-8 py-3 text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium"
              >
                <X className="w-4 h-4" />
                レポートを閉じる
              </Button>
            </DialogPrimitive.Close>
          </div>
        </LargeDialogContent>
      </Dialog>
    </>
  )
}