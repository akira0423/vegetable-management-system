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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogPortal, DialogOverlay } from '@/components/ui/dialog'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils/index'
import { CalendarIcon, Clock, TrendingUp, TrendingDown, Eye, X, Zap, Target, Award, ChevronRight, Sprout, AlertCircle, Check } from 'lucide-react'
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

interface WorkHoursData {
  month: string
  year: number
  month_num: number
  work_types: {
    [key: string]: {
      total_hours: number
      revenue_per_hour: number
      cost_per_hour: number
      roi_per_hour: number
      efficiency_score: number
      work_count: number
      details: WorkDetail[]
    }
  }
  monthly_total_hours: number
  monthly_avg_efficiency: number
  monthly_total_revenue: number
  monthly_total_cost: number
  weather_data?: {
    temperature: number
    humidity: number
    temperature_range: {
      min: number
      max: number
    }
    humidity_range: {
      min: number
      max: number
    }
  }
  ai_predictions?: {
    predicted_hours: number
    efficiency_trend: 'improving' | 'stable' | 'declining'
    optimization_score: number
    suggestions: string[]
  }
  benchmarks?: {
    industry_average_hours: number
    top_performers_hours: number
    efficiency_percentile: number
  }
}

interface WorkDetail {
  id: string
  work_type: string
  work_date: string
  duration_hours: number
  revenue_generated: number
  cost_incurred: number
  efficiency_rating: 'excellent' | 'good' | 'average' | 'poor'
  description?: string
}

interface MonthlyWorkHoursChartDemoProps {
  selectedVegetables?: string[]
}

interface WeatherDisplayOptions {
  showTemperature: boolean
  showHumidity: boolean
}

// 作業種別の色定義
const WORK_TYPE_COLORS = {
  seeding: '#6366f1',
  planting: '#8b5cf6',
  fertilizing: '#f59e0b',
  watering: '#06b6d4',
  weeding: '#ef4444',
  pruning: '#a855f7',
  harvesting: '#10b981',
  other: '#6b7280'
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

// カスタムLargeDialogContent
interface LargeDialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  width?: string
  height?: string
  children?: React.ReactNode
  title?: string
}

function LargeDialogContent({
  className,
  children,
  width = "1200px",
  height = "900px",
  title = "作業時間詳細分析",
  ...props
}: LargeDialogContentProps) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          "fixed top-[50%] left-[50%] z-50 translate-x-[-50%] translate-y-[-50%]",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
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
        <DialogPrimitive.Title className="sr-only">
          {title}
        </DialogPrimitive.Title>
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

// 季節を取得
function getSeason(date: Date): 'spring' | 'summer' | 'autumn' | 'winter' {
  const month = date.getMonth() + 1
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

// 季節に応じた気温を生成
function getSeasonalTemperature(season: string): number {
  const baseTemp = {
    spring: 15 + Math.random() * 5,
    summer: 25 + Math.random() * 5,
    autumn: 18 + Math.random() * 5,
    winter: 5 + Math.random() * 5
  }
  return baseTemp[season as keyof typeof baseTemp] || 20
}

// 季節に応じた湿度を生成
function getSeasonalHumidity(season: string): number {
  const baseHumidity = {
    spring: 60 + Math.random() * 10,
    summer: 70 + Math.random() * 15,
    autumn: 65 + Math.random() * 10,
    winter: 50 + Math.random() * 10
  }
  return baseHumidity[season as keyof typeof baseHumidity] || 65
}

// サンプルデータ生成関数
function generateWorkHoursData(startMonth: Date, period: number): WorkHoursData[] {
  const data: WorkHoursData[] = []
  const workTypes = ['seeding', 'planting', 'fertilizing', 'watering', 'weeding', 'pruning', 'harvesting', 'other']

  for (let i = 0; i < period * 12; i++) {
    const currentMonth = addMonths(startMonth, i)
    const season = getSeason(currentMonth)

    // 季節による作業時間の変動
    const seasonalFactor = {
      spring: 1.3,
      summer: 1.5,
      autumn: 1.2,
      winter: 0.6
    }[season] || 1

    // 作業種別ごとの時間生成
    const work_types: WorkHoursData['work_types'] = {}
    let totalHours = 0
    let totalRevenue = 0
    let totalCost = 0

    workTypes.forEach(type => {
      // 作業種別ごとに異なる季節パターンを適用
      let typeFactor = 1
      if (type === 'seeding' && season === 'spring') typeFactor = 2
      if (type === 'watering' && season === 'summer') typeFactor = 2.5
      if (type === 'harvesting' && season === 'autumn') typeFactor = 3
      if (type === 'pruning' && season === 'winter') typeFactor = 1.5

      const hours = Math.max(10, Math.random() * 80 * seasonalFactor * typeFactor)
      const revenuePerHour = 1500 + Math.random() * 1500
      const costPerHour = 800 + Math.random() * 400

      work_types[type] = {
        total_hours: hours,
        revenue_per_hour: revenuePerHour,
        cost_per_hour: costPerHour,
        roi_per_hour: (revenuePerHour - costPerHour) / costPerHour * 100,
        efficiency_score: 60 + Math.random() * 40,
        work_count: Math.ceil(hours / 8),
        details: generateWorkDetails(type, currentMonth, hours)
      }

      totalHours += hours
      totalRevenue += hours * revenuePerHour
      totalCost += hours * costPerHour
    })

    // 気象データ（季節に応じた値）
    const temperature = getSeasonalTemperature(season)
    const humidity = getSeasonalHumidity(season)

    data.push({
      month: format(currentMonth, 'M月', { locale: ja }),
      year: currentMonth.getFullYear(),
      month_num: currentMonth.getMonth() + 1,
      work_types,
      monthly_total_hours: totalHours,
      monthly_avg_efficiency: 70 + Math.random() * 20,
      monthly_total_revenue: totalRevenue,
      monthly_total_cost: totalCost,
      weather_data: {
        temperature,
        humidity,
        temperature_range: {
          min: temperature - 5,
          max: temperature + 5
        },
        humidity_range: {
          min: humidity - 10,
          max: humidity + 10
        }
      },
      ai_predictions: {
        predicted_hours: totalHours * (1 + (Math.random() - 0.5) * 0.2),
        efficiency_trend: ['improving', 'stable', 'declining'][Math.floor(Math.random() * 3)] as any,
        optimization_score: 60 + Math.random() * 40,
        suggestions: [
          '作業効率を向上させるため、早朝の涼しい時間帯を活用しましょう',
          '複数の作業を組み合わせることで、移動時間を削減できます',
          '天候予報を活用して、最適な作業日程を計画しましょう'
        ]
      },
      benchmarks: {
        industry_average_hours: totalHours * 0.9,
        top_performers_hours: totalHours * 0.7,
        efficiency_percentile: 50 + Math.random() * 40
      }
    })
  }

  return data
}

// 作業詳細データの生成
function generateWorkDetails(type: string, month: Date, totalHours: number): WorkDetail[] {
  const details: WorkDetail[] = []
  const workCount = Math.ceil(totalHours / 8)

  for (let i = 0; i < workCount; i++) {
    const workDate = new Date(month.getFullYear(), month.getMonth(), Math.floor(Math.random() * 28) + 1)
    const hours = Math.min(8, totalHours - (i * 8))

    details.push({
      id: `work_${type}_${i}`,
      work_type: type,
      work_date: format(workDate, 'yyyy-MM-dd'),
      duration_hours: hours,
      revenue_generated: hours * (1500 + Math.random() * 1500),
      cost_incurred: hours * (800 + Math.random() * 400),
      efficiency_rating: ['excellent', 'good', 'average', 'poor'][Math.floor(Math.random() * 4)] as any,
      description: `${WORK_TYPE_LABELS[type as keyof typeof WORK_TYPE_LABELS]}作業（デモデータ）`
    })
  }

  return details
}

export default function MonthlyWorkHoursChartDemo({ selectedVegetables }: MonthlyWorkHoursChartDemoProps) {
  const [startMonth, setStartMonth] = useState<Date>(new Date(new Date().getFullYear(), 0, 1))
  const [yearMonthPickerOpen, setYearMonthPickerOpen] = useState(false)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [selectedMonthNum, setSelectedMonthNum] = useState<number>(1)
  const [displayPeriod, setDisplayPeriod] = useState<1 | 2 | 3>(1)
  const [workHoursData, setWorkHoursData] = useState<WorkHoursData[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<WorkHoursData | null>(null)
  const [drilldownOpen, setDrilldownOpen] = useState(false)
  const [showComparison, setShowComparison] = useState(true)
  const [showAIInsights, setShowAIInsights] = useState(true)
  const [showCumulativeWorkTime, setShowCumulativeWorkTime] = useState(true)
  const [containerWidth, setContainerWidth] = useState(0)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [isWorkTypeTotalsOpen, setIsWorkTypeTotalsOpen] = useState(true)
  const [demoLimitModalOpen, setDemoLimitModalOpen] = useState(false)

  // 作業種別の表示/非表示を管理
  const [visibleWorkTypes, setVisibleWorkTypes] = useState<{[key: string]: boolean}>({
    seeding: true,
    planting: true,
    fertilizing: true,
    watering: true,
    weeding: true,
    pruning: true,
    harvesting: true,
    other: true
  })

  const [weatherDisplayOptions, setWeatherDisplayOptions] = useState<WeatherDisplayOptions>({
    showTemperature: false,
    showHumidity: false
  })

  const chartRef = useRef<ChartJS<'bar'>>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [chartDimensions, setChartDimensions] = useState({ left: 0, right: 0, width: 0 })

  // チャートエリア寸法の更新
  const updateChartDimensions = useCallback(() => {
    if (chartRef.current) {
      const chart = chartRef.current
      const chartArea = chart.chartArea
      if (chartArea) {
        const meta = chart.getDatasetMeta(0)
        if (meta && meta.data && meta.data.length > 0) {
          const firstBar = meta.data[0] as any
          const lastBar = meta.data[meta.data.length - 1] as any

          // バーの実際の位置を取得
          const actualLeft = firstBar.x - (firstBar.width || 0) / 2
          const actualRight = lastBar.x + (lastBar.width || 0) / 2
          const actualWidth = actualRight - actualLeft

          setChartDimensions({
            left: Math.round(actualLeft),
            right: Math.round(chart.width - actualRight),
            width: Math.round(actualWidth)
          })
        }
      }
    }
  }, [])

  // チャートが描画された後にchartDimensionsを更新
  useEffect(() => {
    if (chartRef.current && workHoursData.length > 0) {
      // チャートの描画完了を待つ
      const timeoutId = setTimeout(updateChartDimensions, 100)
      return () => clearTimeout(timeoutId)
    }
  }, [workHoursData, updateChartDimensions])

  // リサイズ時にもchartDimensionsを更新
  useEffect(() => {
    const handleResize = () => {
      if (chartRef.current && workHoursData.length > 0) {
        updateChartDimensions()
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [workHoursData, updateChartDimensions])

  // 作業種別の表示/非表示をトグル
  const toggleWorkType = useCallback((workType: string) => {
    setVisibleWorkTypes(prev => ({
      ...prev,
      [workType]: !prev[workType]
    }))
  }, [])

  // 全選択/全解除
  const toggleAllWorkTypes = useCallback((visible: boolean) => {
    const newState: {[key: string]: boolean} = {}
    Object.keys(WORK_TYPE_COLORS).forEach(key => {
      newState[key] = visible
    })
    setVisibleWorkTypes(newState)
  }, [])

  // レスポンシブ寸法計算
  const calculateResponsiveDimensions = useCallback((period: number, containerWidth: number): ResponsiveDimensions => {
    const monthCount = period * 12
    const availableWidth = containerWidth - 90
    const idealBarWidth = availableWidth / monthCount

    const barWidth = Math.max(25, Math.min(80, idealBarWidth))
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

  // データの初期化と更新
  useEffect(() => {
    const data = generateWorkHoursData(startMonth, displayPeriod)
    setWorkHoursData(data)
    setLastUpdated(new Date())
  }, [startMonth, displayPeriod])

  // Y軸範囲の動的計算
  const calculateYAxisRange = useCallback((data: WorkHoursData[]) => {
    if (!data || data.length === 0) return {
      min: 0,
      max: 100,
      stepSize: 20,
      tickCount: 6,
      unit: 'hours',
      unitDivisor: 1,
      unitLabel: '時間'
    }

    const allValues = data.map(d => d.monthly_total_hours)
    const rawMax = Math.max(...allValues, 10)
    let targetMax = rawMax * 1.2

    let unit = 'hours'
    let unitDivisor = 1
    let unitLabel = '時間'

    if (targetMax >= 50000) {
      unit = 'man'
      unitDivisor = 10000
      unitLabel = '万時間'
      targetMax = targetMax / 10000
    } else if (targetMax >= 5000) {
      unit = 'sen'
      unitDivisor = 1000
      unitLabel = '千時間'
      targetMax = targetMax / 1000
    }

    const niceSteps = [
      0.1, 0.2, 0.25, 0.5,
      1, 2, 2.5, 5,
      10, 20, 25, 50,
      100, 200, 250, 500,
      1000, 2000, 2500, 5000,
      10000, 20000, 25000, 50000,
      100000
    ]

    let bestOption = { stepSize: 1, tickCount: 6, max: 6 }
    let minDiff = Infinity

    for (const step of niceSteps) {
      for (let ticks = 5; ticks <= 8; ticks++) {
        const candidateMax = step * (ticks - 1)
        if (candidateMax >= targetMax) {
          const diff = candidateMax - targetMax
          if (diff < minDiff) {
            minDiff = diff
            bestOption = {
              stepSize: step,
              tickCount: ticks,
              max: candidateMax
            }
          }
        }
      }
    }

    if (bestOption.max < targetMax) {
      const targetTicks = 6
      const rawStep = targetMax / (targetTicks - 1)
      const step = niceSteps.find(s => s >= rawStep) || rawStep
      bestOption = {
        stepSize: Math.ceil(step),
        tickCount: targetTicks,
        max: Math.ceil(step) * (targetTicks - 1)
      }
    }

    return {
      min: 0,
      max: bestOption.max,
      stepSize: bestOption.stepSize,
      tickCount: bestOption.tickCount,
      unit,
      unitDivisor,
      unitLabel
    }
  }, [])

  const yAxisRange = useMemo(() => calculateYAxisRange(workHoursData), [workHoursData, calculateYAxisRange])
  const cumulativeYAxisRange = useMemo(() => {
    if (!workHoursData || workHoursData.length === 0) return yAxisRange

    let cumulative = 0
    const cumulativeValues = workHoursData.map(d => {
      cumulative += d.monthly_total_hours
      return cumulative
    })

    const maxCumulative = Math.max(...cumulativeValues)
    return calculateYAxisRange([{ ...workHoursData[0], monthly_total_hours: maxCumulative }])
  }, [workHoursData, calculateYAxisRange, yAxisRange])

  // 年月変更ハンドラー（デモ版制限付き）
  const handleYearMonthChange = () => {
    setDemoLimitModalOpen(true)
  }

  // チャートデータの生成
  const chartData = useMemo(() => {
    if (!workHoursData || workHoursData.length === 0) return null

    const datasets: any[] = []
    const workTypes = Object.keys(WORK_TYPE_COLORS)

    // 作業種別ごとのデータセット
    workTypes.forEach((workType, index) => {
      // 非表示の作業種別はデータを0にする
      const isVisible = visibleWorkTypes[workType]

      const data = workHoursData.map(d => {
        if (!isVisible) return 0
        const workTypeData = d.work_types[workType]
        return workTypeData ? workTypeData.total_hours / yAxisRange.unitDivisor : 0
      })

      datasets.push({
        label: WORK_TYPE_LABELS[workType as keyof typeof WORK_TYPE_LABELS] || workType,
        data,
        backgroundColor: isVisible
          ? WORK_TYPE_COLORS[workType as keyof typeof WORK_TYPE_COLORS]
          : 'transparent',
        borderColor: isVisible
          ? WORK_TYPE_COLORS[workType as keyof typeof WORK_TYPE_COLORS]
          : 'transparent',
        borderWidth: isVisible ? 1 : 0,
        stack: 'stack0',
        order: index + 1,
        hidden: !isVisible
      })
    })

    // 累積作業時間線
    if (showCumulativeWorkTime) {
      let cumulativeHours = 0
      const cumulativeData = workHoursData.map(d => {
        // 表示されている作業種別のみを累積に含める
        const monthlyTotal = Object.keys(d.work_types).reduce((sum, workType) => {
          if (visibleWorkTypes[workType]) {
            return sum + (d.work_types[workType]?.total_hours || 0)
          }
          return sum
        }, 0)
        cumulativeHours += monthlyTotal
        return cumulativeHours / cumulativeYAxisRange.unitDivisor
      })

      datasets.push({
        label: '📊 累積作業時間',
        data: cumulativeData,
        borderColor: '#059669',
        backgroundColor: 'rgba(5, 150, 105, 0.1)',
        borderWidth: 3,
        pointRadius: 5,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: '#059669',
        pointBorderWidth: 2,
        fill: false,
        tension: 0.4,
        type: 'line' as const,
        yAxisID: 'y1',
        order: -1,
        pointHoverRadius: 7,
        pointHoverBorderWidth: 3,
      })
    }

    // 気温データ
    if (weatherDisplayOptions.showTemperature && workHoursData[0]?.weather_data) {
      const tempData = workHoursData.map(d => d.weather_data?.temperature || 0)
      datasets.push({
        label: '🌡️ 平均気温',
        data: tempData,
        borderColor: '#f97316',
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        borderWidth: 2,
        pointRadius: 4,
        fill: false,
        tension: 0.3,
        type: 'line' as const,
        yAxisID: 'y2',
        order: -2
      })
    }

    // 湿度データ
    if (weatherDisplayOptions.showHumidity && workHoursData[0]?.weather_data) {
      const humidityData = workHoursData.map(d => d.weather_data?.humidity || 0)
      datasets.push({
        label: '💧 平均湿度',
        data: humidityData,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        pointRadius: 4,
        fill: false,
        tension: 0.3,
        type: 'line' as const,
        yAxisID: 'y3',
        order: -3,
        borderDash: [5, 5]
      })
    }

    const monthLabels = workHoursData.map(d => d.month)

    return {
      labels: monthLabels,
      datasets
    }
  }, [workHoursData, weatherDisplayOptions, showCumulativeWorkTime, yAxisRange, cumulativeYAxisRange, visibleWorkTypes])

  // チャートオプション
  const chartOptions: ChartOptions<'bar'> = useMemo(() => {
    const visibleAxesCount =
      (showCumulativeWorkTime ? 1 : 0) +
      (weatherDisplayOptions.showTemperature ? 1 : 0) +
      (weatherDisplayOptions.showHumidity ? 1 : 0)

    const rightPadding = visibleAxesCount === 0 ? 0 :
                        visibleAxesCount === 1 ? 0 :
                        visibleAxesCount === 2 ? 10 :
                        20

    return ({
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          left: 0,
          right: rightPadding,
          top: 0,
          bottom: 0
        },
        autoPadding: false
      },
      interaction: {
        mode: 'index',
        intersect: false
      },
      onClick: (event: ChartEvent, elements: InteractionItem[]) => {
        if (elements.length > 0 && chartRef.current) {
          const elementIndex = elements[0].index
          const selectedData = workHoursData[elementIndex]
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
          offset: true,
          barPercentage: responsiveDimensions.barPercentage,
          categoryPercentage: responsiveDimensions.categoryPercentage,
          bounds: 'ticks',
          afterFit: function(scale: any) {
            scale.paddingBottom = 60
            // 左右のパディングは固定（動的調整しない）
            scale.paddingLeft = 0
            scale.paddingRight = 0
          }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          stacked: true,
          min: yAxisRange.min,
          max: yAxisRange.max,
          grid: {
            color: '#e5e7eb',
            lineWidth: 1,
            drawTicks: false
          },
          border: {
            color: '#374151',
            width: 2
          },
          ticks: {
            stepSize: yAxisRange.stepSize,
            color: '#1f2937',
            font: {
              size: Math.max(12, responsiveDimensions.fontSize + 1),
              weight: '600',
              family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            },
            padding: 8,
            callback: function(value) {
              const numValue = value as number
              if (yAxisRange.unit === 'man') {
                return `${numValue.toFixed(1)}万h`
              } else if (yAxisRange.unit === 'sen') {
                return `${numValue.toFixed(1)}千h`
              } else {
                return `${numValue.toFixed(1)}h`
              }
            }
          },
          beginAtZero: false,
          offset: false
        },
        ...(showCumulativeWorkTime ? {
          y1: {
            type: 'linear' as const,
            display: true,
            position: 'right' as const,
            min: cumulativeYAxisRange.min,
            max: cumulativeYAxisRange.max,
            grid: {
              drawOnChartArea: false,
            },
            border: {
              color: '#059669',
              width: 2
            },
            ticks: {
              stepSize: cumulativeYAxisRange.stepSize,
              color: '#059669',
              font: {
                size: 11,
                weight: '600'
              },
              padding: 5,
              callback: function(value) {
                const numValue = value as number
                if (cumulativeYAxisRange.unit === 'man') {
                  return `${numValue.toFixed(0)}万h`
                } else if (cumulativeYAxisRange.unit === 'sen') {
                  return `${numValue.toFixed(0)}千h`
                } else {
                  return `${numValue.toFixed(0)}h`
                }
              }
            },
            title: {
              display: true,
              text: `累積${cumulativeYAxisRange.unitLabel}`,
              color: '#059669',
              font: {
                size: 12,
                weight: 'bold'
              }
            }
          }
        } : {}),
        ...(weatherDisplayOptions.showTemperature ? {
          y2: {
            type: 'linear' as const,
            display: true,
            position: 'right' as const,
            min: -5,
            max: 35,
            grid: {
              drawOnChartArea: false,
            },
            border: {
              color: '#f97316',
              width: 2
            },
            ticks: {
              stepSize: 5,
              color: '#f97316',
              font: {
                size: 11,
                weight: '600'
              },
              padding: 5,
              callback: function(value) {
                return `${value}°C`
              }
            },
            title: {
              display: true,
              text: '気温',
              color: '#f97316',
              font: {
                size: 12,
                weight: 'bold'
              }
            }
          }
        } : {}),
        ...(weatherDisplayOptions.showHumidity ? {
          y3: {
            type: 'linear' as const,
            display: true,
            position: 'right' as const,
            min: 0,
            max: 100,
            grid: {
              drawOnChartArea: false,
            },
            border: {
              color: '#3b82f6',
              width: 2
            },
            ticks: {
              stepSize: 20,
              color: '#3b82f6',
              font: {
                size: 11,
                weight: '600'
              },
              padding: 5,
              callback: function(value) {
                return `${value}%`
              }
            },
            title: {
              display: true,
              text: '湿度',
              color: '#3b82f6',
              font: {
                size: 12,
                weight: 'bold'
              }
            }
          }
        } : {})
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            title: (context) => {
              return context[0].label
            },
            label: (context) => {
              const label = context.dataset.label || ''
              const value = context.parsed.y
              if (label.includes('累積')) {
                return `${label}: ${value.toFixed(1)} ${cumulativeYAxisRange.unitLabel}`
              } else if (label.includes('気温')) {
                return `${label}: ${value.toFixed(1)}°C`
              } else if (label.includes('湿度')) {
                return `${label}: ${value.toFixed(1)}%`
              } else {
                return `${label}: ${value.toFixed(1)} ${yAxisRange.unitLabel}`
              }
            }
          }
        }
      },
      animation: {
        duration: 600,
        easing: 'easeOutQuart',
        onComplete: function(animation: any) {
          setTimeout(updateChartDimensions, 50)
        }
      },
      onResize: function(chart: any, size: any) {
        setTimeout(updateChartDimensions, 50)
      }
    })
  }, [workHoursData, weatherDisplayOptions, showCumulativeWorkTime, yAxisRange, cumulativeYAxisRange, responsiveDimensions, updateChartDimensions])

  return (
    <>
      <Card className="w-full">
        <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shadow-md">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">
                  ⏰ 月次作業時間分析
                </CardTitle>
                <p className="text-green-100 text-sm">
                  収益性と効率性を月別に可視化
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            {/* フィルター＆オプション */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4" style={{ marginTop: '11px' }}>
              <div className="flex flex-wrap items-center gap-2">
                {/* 期間選択 */}
                <div className="flex items-center gap-1 bg-white rounded-lg p-1 shadow-sm border">
                  {[1, 2, 3].map((period) => (
                    <Button
                      key={period}
                      variant={displayPeriod === period ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setDisplayPeriod(period as 1 | 2 | 3)}
                      className={`px-3 h-7 text-xs ${
                        displayPeriod === period
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-700'
                      }`}
                    >
                      {period}年
                    </Button>
                  ))}
                </div>

                {/* データ表示オプション */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* 累積作業時間線トグル */}
                  <Button
                    variant={showCumulativeWorkTime ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowCumulativeWorkTime(!showCumulativeWorkTime)}
                    className={showCumulativeWorkTime ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'text-gray-600'}
                  >
                    📊 累積時間線
                  </Button>

                  {/* 前年比較トグル */}
                  <Button
                    variant={showComparison ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowComparison(!showComparison)}
                    className={showComparison ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'text-gray-600'}
                  >
                    📈 前年比較
                  </Button>

                  {/* 🌡️💧 気象データ表示トグル */}
                  <div className="flex items-center gap-2 bg-white rounded-lg p-1 shadow-sm">
                    <Button
                      variant={weatherDisplayOptions.showTemperature ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setWeatherDisplayOptions(prev => ({
                        ...prev,
                        showTemperature: !prev.showTemperature
                      }))}
                      className={`px-3 h-7 text-xs ${
                        weatherDisplayOptions.showTemperature
                          ? 'bg-orange-500 text-white shadow-sm'
                          : 'text-orange-600 hover:bg-orange-50'
                      }`}
                    >
                      🌡️ 気温
                    </Button>
                    <Button
                      variant={weatherDisplayOptions.showHumidity ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setWeatherDisplayOptions(prev => ({
                        ...prev,
                        showHumidity: !prev.showHumidity
                      }))}
                      className={`px-3 h-7 text-xs ${
                        weatherDisplayOptions.showHumidity
                          ? 'bg-blue-500 text-white shadow-sm'
                          : 'text-blue-600 hover:bg-blue-50'
                      }`}
                    >
                      💧 湿度
                    </Button>
                  </div>
                </div>

                {/* 年月選択 */}
                <Popover open={yearMonthPickerOpen} onOpenChange={setYearMonthPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2 min-w-[160px] bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200 hover:from-emerald-100 hover:to-green-100"
                    >
                      <CalendarIcon className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold text-emerald-800">{format(startMonth, 'yyyy年M月', { locale: ja })}</span>
                      <Sprout className="w-4 h-4 text-emerald-500" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-96 p-0 bg-white border-2 border-emerald-200 shadow-2xl z-50 rounded-xl">
                    <div className="p-5 border-b border-emerald-100 bg-gradient-to-r from-emerald-600 to-green-600 text-white">
                      <h4 className="font-bold text-lg flex items-center gap-2">
                        <Sprout className="w-5 h-5" />
                        栽培期間設定
                      </h4>
                      <p className="text-sm text-emerald-100 mt-1">分析開始年月を選択（{displayPeriod}年間分析）</p>
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
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'hover:bg-indigo-50'
                                }`}
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
                              className={`text-xs ${selectedMonthNum === month ? 'bg-indigo-600 text-white' : 'hover:bg-indigo-50'}`}
                            >
                              {month}月
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button
                          onClick={handleYearMonthChange}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                          size="sm"
                        >
                          ✅ 期間を適用
                        </Button>
                        <Button
                          onClick={() => setYearMonthPickerOpen(false)}
                          variant="outline"
                          size="sm"
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

            {/* カスタムX軸ラベル */}
            {chartDimensions.width > 0 && (
              <div
                className="absolute bottom-0 pointer-events-none z-0"
                style={{
                  left: `${chartDimensions.left}px`,
                  right: `${chartDimensions.right}px`,
                  width: `${chartDimensions.width}px`
                }}
              >
                {/* 月表示層 */}
                <div className="relative bg-white border-t border-gray-300" style={{ height: '40px' }}>
                  {workHoursData.map((data, index) => {
                    const chart = chartRef.current
                    let barLeftX = chartDimensions.width / workHoursData.length * index
                    let barWidth = chartDimensions.width / workHoursData.length

                    if (chart) {
                      const meta = chart.getDatasetMeta(0)
                      if (meta && meta.data[index]) {
                        const bar = meta.data[index] as any
                        barLeftX = (bar.x - (bar.width || 0) / 2) - chartDimensions.left
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

                {/* 年表示層 */}
                <div className="relative border-t-2 border-gray-400 bg-gray-100" style={{ height: '40px' }}>
                  {(() => {
                    const yearGroups = []
                    let currentYear = null
                    let yearStartIndex = 0

                    workHoursData.forEach((data, index) => {
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
                        endIndex: workHoursData.length - 1
                      })
                    }

                    return yearGroups.map((yearData) => {
                      const chart = chartRef.current
                      let startX = 0
                      let endX = chartDimensions.width

                      if (chart) {
                        const meta = chart.getDatasetMeta(0)
                        if (meta && meta.data.length > 0) {
                          const startBar = meta.data[yearData.startIndex] as any
                          const endBar = meta.data[yearData.endIndex] as any

                          if (startBar && endBar) {
                            startX = (startBar.x - (startBar.width || 0) / 2) - chartDimensions.left
                            endX = (endBar.x + (endBar.width || 0) / 2) - chartDimensions.left
                          }
                        }
                      }

                      const yearWidth = endX - startX

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
          </div>

          {/* 作業種別凡例 */}
          <Collapsible open={isWorkTypeTotalsOpen} onOpenChange={setIsWorkTypeTotalsOpen}>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-2">
                  <ChevronRight className={`w-5 h-5 text-gray-500 transition-transform ${isWorkTypeTotalsOpen ? 'rotate-90' : ''}`} />
                  <span className="font-medium text-gray-700">作業種別凡例・期間合計</span>
                </div>
                <Badge variant="secondary">
                  {Object.values(visibleWorkTypes).filter(v => v).length}/{Object.keys(WORK_TYPE_LABELS).length}種類
                </Badge>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-3 mt-3">
                {/* 全選択/全解除ボタン */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleAllWorkTypes(true)}
                    className="text-xs"
                  >
                    すべて選択
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleAllWorkTypes(false)}
                    className="text-xs"
                  >
                    すべて解除
                  </Button>
                </div>

                {/* 凡例項目 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(WORK_TYPE_LABELS).map(([key, label]) => {
                    const isVisible = visibleWorkTypes[key]
                    const totalHours = workHoursData.reduce((sum, d) => {
                      const workType = d.work_types[key]
                      return sum + (workType ? workType.total_hours : 0)
                    }, 0)

                    return (
                      <div
                        key={key}
                        className={`flex items-center gap-2 p-2 bg-white rounded-lg border cursor-pointer transition-all ${
                          isVisible
                            ? 'hover:bg-gray-50 border-gray-200'
                            : 'opacity-50 hover:bg-gray-100 border-gray-300'
                        }`}
                        onClick={() => toggleWorkType(key)}
                      >
                        <div className="relative">
                          <div
                            className="w-4 h-4 rounded"
                            style={{
                              backgroundColor: isVisible
                                ? WORK_TYPE_COLORS[key as keyof typeof WORK_TYPE_COLORS]
                                : '#d1d5db'
                            }}
                          />
                          {isVisible && (
                            <Check className="absolute -top-1 -right-1 w-3 h-3 text-white bg-green-600 rounded-full p-0.5" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className={`text-xs font-medium ${
                            isVisible ? 'text-gray-700' : 'text-gray-400 line-through'
                          }`}>
                            {label}
                          </div>
                          <div className={`text-xs ${
                            isVisible ? 'text-gray-500' : 'text-gray-400'
                          }`}>
                            {totalHours.toFixed(0)}h
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* デモ版制限モーダル */}
      <Dialog open={demoLimitModalOpen} onOpenChange={setDemoLimitModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-500" />
              デモ版の制限事項
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              デモ版では期間変更機能は利用できません。
            </p>
            <p className="text-sm text-gray-600">
              本機能を利用するには、製品版へのアップグレードが必要です。
            </p>
            <Button onClick={() => setDemoLimitModalOpen(false)} className="w-full">
              閉じる
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 詳細ドリルダウンダイアログ */}
      {selectedMonth && (
        <Dialog open={drilldownOpen} onOpenChange={setDrilldownOpen}>
          <LargeDialogContent width="900px" height="700px" title={`${selectedMonth.month} 作業時間詳細`}>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">{selectedMonth.month} 作業時間詳細分析</h2>
                <Button
                  onClick={() => setDrilldownOpen(false)}
                  variant="ghost"
                  size="sm"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-sm text-blue-600">総作業時間</div>
                  <div className="text-2xl font-bold text-blue-800">
                    {selectedMonth.monthly_total_hours.toFixed(1)}h
                  </div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-sm text-green-600">推定収益</div>
                  <div className="text-2xl font-bold text-green-800">
                    ¥{selectedMonth.monthly_total_revenue.toLocaleString()}
                  </div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-sm text-purple-600">効率スコア</div>
                  <div className="text-2xl font-bold text-purple-800">
                    {selectedMonth.monthly_avg_efficiency.toFixed(0)}%
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold">作業種別内訳</h3>
                <div className="space-y-2">
                  {Object.entries(selectedMonth.work_types).map(([type, data]) => (
                    <div key={type} className="border rounded-lg p-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded"
                            style={{ backgroundColor: WORK_TYPE_COLORS[type as keyof typeof WORK_TYPE_COLORS] }}
                          />
                          <span className="font-medium">
                            {WORK_TYPE_LABELS[type as keyof typeof WORK_TYPE_LABELS]}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          {data.total_hours.toFixed(1)}時間
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedMonth.weather_data && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">気象データ</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🌡️</span>
                      <div>
                        <div className="text-sm text-gray-600">平均気温</div>
                        <div className="font-bold">{selectedMonth.weather_data.temperature.toFixed(1)}°C</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">💧</span>
                      <div>
                        <div className="text-sm text-gray-600">平均湿度</div>
                        <div className="font-bold">{selectedMonth.weather_data.humidity.toFixed(0)}%</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </LargeDialogContent>
        </Dialog>
      )}
    </>
  )
}