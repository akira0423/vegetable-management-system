'use client'

import React, { useState, useMemo, useRef } from 'react'
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
  ChartOptions
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { TrendingUp, TrendingDown, Eye, ChevronRight, Download, RefreshCw, DollarSign, Activity, Target, Zap } from 'lucide-react'

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

// デモ用データ型定義
interface FinancialPerformanceData {
  month: string
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
}

// カテゴリ別色定義
const CATEGORY_COLORS = {
  income: {
    sales: '#22c55e',
    harvest_sales: '#16a34a',
    other_income: '#84cc16'
  },
  expenses: {
    labor_cost: '#f97316',
    material_cost: '#ea580c',
    other_cost: '#fb923c'
  },
  metrics: {
    efficiency: '#3b82f6',
    growth: '#8b5cf6'
  }
}

// デモデータ生成関数
function generateDemoFinancialData(): FinancialPerformanceData[] {
  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

  return months.map((month, index) => {
    // 季節変動を考慮
    const seasonalFactor = index >= 3 && index <= 8 ? 1.3 : 0.9

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
    const net = gross * 0.8 // 税引後利益（簡易計算）
    const margin = (gross / total_revenue) * 100

    // 効率性指標
    const sales_per_hour = Math.floor(total_revenue / (160 + Math.random() * 40))
    const profit_per_area = Math.floor(gross / 100)
    const roi_percentage = ((gross / total_expenses) * 100)
    const productivity_index = 70 + Math.random() * 30

    // 成長率（前月比）
    const sales_growth_rate = -10 + Math.random() * 30
    const profit_growth_rate = -15 + Math.random() * 35
    const efficiency_growth_rate = -5 + Math.random() * 15

    return {
      month,
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
      }
    }
  })
}

export default function FinancialPerformanceChartDemo() {
  const [displayPeriod, setDisplayPeriod] = useState<1 | 2 | 3>(1)
  const [displayOptions, setDisplayOptions] = useState({
    showRevenue: true,
    showExpenses: true,
    showEfficiency: true,
    showGrowth: false
  })
  const [isLegendOpen, setIsLegendOpen] = useState(true)
  const [financialData, setFinancialData] = useState<FinancialPerformanceData[]>(() => generateDemoFinancialData())
  const [lastUpdated, setLastUpdated] = useState(new Date())

  const chartRef = useRef<ChartJS<'bar'>>(null)

  // 表示データの準備
  const displayData = useMemo(() => {
    if (displayPeriod === 1) return financialData
    if (displayPeriod === 2) {
      // 2年分のデータ
      const prevYearData = financialData.map(d => ({
        ...d,
        month: `前年${d.month}`
      }))
      return [...prevYearData, ...financialData]
    }
    // 3年分
    const prevYearData = financialData.map(d => ({
      ...d,
      month: `前年${d.month}`
    }))
    const prev2YearData = financialData.map(d => ({
      ...d,
      month: `前々年${d.month}`
    }))
    return [...prev2YearData, ...prevYearData, ...financialData]
  }, [financialData, displayPeriod])

  // Chart.js用データセット作成
  const chartData = useMemo(() => {
    const labels = displayData.map(d => d.month)
    const datasets = []

    // 収入データセット
    if (displayOptions.showRevenue) {
      datasets.push({
        label: '売上収入',
        data: displayData.map(d => d.revenue.sales),
        backgroundColor: CATEGORY_COLORS.income.sales,
        stack: 'revenue'
      })
      datasets.push({
        label: '収穫物売上',
        data: displayData.map(d => d.revenue.harvest_sales),
        backgroundColor: CATEGORY_COLORS.income.harvest_sales,
        stack: 'revenue'
      })
      datasets.push({
        label: 'その他収入',
        data: displayData.map(d => d.revenue.other_income),
        backgroundColor: CATEGORY_COLORS.income.other_income,
        stack: 'revenue'
      })
    }

    // 支出データセット（負の値）
    if (displayOptions.showExpenses) {
      datasets.push({
        label: '人件費',
        data: displayData.map(d => -d.expenses.labor_cost),
        backgroundColor: CATEGORY_COLORS.expenses.labor_cost,
        stack: 'expenses'
      })
      datasets.push({
        label: '資材費',
        data: displayData.map(d => -d.expenses.material_cost),
        backgroundColor: CATEGORY_COLORS.expenses.material_cost,
        stack: 'expenses'
      })
      datasets.push({
        label: 'その他経費',
        data: displayData.map(d => -d.expenses.other_cost),
        backgroundColor: CATEGORY_COLORS.expenses.other_cost,
        stack: 'expenses'
      })
    }

    // 効率性指標（右軸・線グラフ）
    if (displayOptions.showEfficiency) {
      datasets.push({
        label: 'ROI (%)',
        data: displayData.map(d => d.efficiency.roi_percentage),
        type: 'line' as any,
        borderColor: CATEGORY_COLORS.metrics.efficiency,
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 3,
        yAxisID: 'y1',
        stack: undefined
      })
    }

    // 成長率（右軸・線グラフ）
    if (displayOptions.showGrowth) {
      datasets.push({
        label: '売上成長率 (%)',
        data: displayData.map(d => d.growth.sales_growth_rate),
        type: 'line' as any,
        borderColor: CATEGORY_COLORS.metrics.growth,
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 3,
        yAxisID: 'y1',
        stack: undefined
      })
    }

    return { labels, datasets }
  }, [displayData, displayOptions])

  // Chart.jsオプション
  const chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
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
        title: {
          display: true,
          text: '金額（円）'
        },
        ticks: {
          callback: (value) => `¥${Number(value).toLocaleString()}`
        }
      },
      y1: {
        position: 'right',
        display: displayOptions.showEfficiency || displayOptions.showGrowth,
        title: {
          display: true,
          text: 'パーセント（%）'
        },
        grid: {
          drawOnChartArea: false
        },
        ticks: {
          callback: (value) => `${value}%`
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
            if (label.includes('%') || label.includes('率')) {
              return `${label}: ${value.toFixed(1)}%`
            }
            return `${label}: ¥${Math.abs(value).toLocaleString()}`
          }
        }
      }
    }
  }

  // データ更新
  const handleRefresh = () => {
    setFinancialData(generateDemoFinancialData())
    setLastUpdated(new Date())
  }

  // 凡例項目の集計
  const legendItems = useMemo(() => {
    const items = []

    if (displayOptions.showRevenue) {
      const totalSales = displayData.reduce((sum, d) => sum + d.revenue.sales, 0)
      const totalHarvest = displayData.reduce((sum, d) => sum + d.revenue.harvest_sales, 0)
      const totalOther = displayData.reduce((sum, d) => sum + d.revenue.other_income, 0)

      items.push({ label: '売上収入', color: CATEGORY_COLORS.income.sales, value: totalSales })
      items.push({ label: '収穫物売上', color: CATEGORY_COLORS.income.harvest_sales, value: totalHarvest })
      items.push({ label: 'その他収入', color: CATEGORY_COLORS.income.other_income, value: totalOther })
    }

    if (displayOptions.showExpenses) {
      const totalLabor = displayData.reduce((sum, d) => sum + d.expenses.labor_cost, 0)
      const totalMaterial = displayData.reduce((sum, d) => sum + d.expenses.material_cost, 0)
      const totalOther = displayData.reduce((sum, d) => sum + d.expenses.other_cost, 0)

      items.push({ label: '人件費', color: CATEGORY_COLORS.expenses.labor_cost, value: -totalLabor })
      items.push({ label: '資材費', color: CATEGORY_COLORS.expenses.material_cost, value: -totalMaterial })
      items.push({ label: 'その他経費', color: CATEGORY_COLORS.expenses.other_cost, value: -totalOther })
    }

    return items
  }, [displayData, displayOptions])

  // 総計算
  const totals = useMemo(() => {
    const totalRevenue = displayData.reduce((sum, d) => sum + d.revenue.total, 0)
    const totalExpenses = displayData.reduce((sum, d) => sum + d.expenses.total, 0)
    const totalProfit = totalRevenue - totalExpenses
    const avgMargin = displayData.reduce((sum, d) => sum + d.profit.margin, 0) / displayData.length
    const avgROI = displayData.reduce((sum, d) => sum + d.efficiency.roi_percentage, 0) / displayData.length

    return {
      revenue: totalRevenue,
      expenses: totalExpenses,
      profit: totalProfit,
      margin: avgMargin,
      roi: avgROI
    }
  }, [displayData])

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>収支構造×効率性×成長分析（デモ版）</span>
          <Badge variant="outline" className="text-xs">
            サンプルデータ
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* コントロール */}
        <div className="flex flex-wrap gap-3 items-center">
          <Select value={displayPeriod.toString()} onValueChange={(v) => setDisplayPeriod(Number(v) as 1 | 2 | 3)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1年表示</SelectItem>
              <SelectItem value="2">2年表示</SelectItem>
              <SelectItem value="3">3年表示</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button
              variant={displayOptions.showRevenue ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDisplayOptions(prev => ({ ...prev, showRevenue: !prev.showRevenue }))}
            >
              収入
            </Button>
            <Button
              variant={displayOptions.showExpenses ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDisplayOptions(prev => ({ ...prev, showExpenses: !prev.showExpenses }))}
            >
              支出
            </Button>
            <Button
              variant={displayOptions.showEfficiency ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDisplayOptions(prev => ({ ...prev, showEfficiency: !prev.showEfficiency }))}
            >
              効率性
            </Button>
            <Button
              variant={displayOptions.showGrowth ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDisplayOptions(prev => ({ ...prev, showGrowth: !prev.showGrowth }))}
            >
              成長率
            </Button>
          </div>

          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            更新
          </Button>

          <div className="text-xs text-gray-500 ml-auto">
            最終更新: {lastUpdated.toLocaleTimeString('ja-JP')}
          </div>
        </div>

        {/* KPIサマリー */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="p-3 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-green-600" />
              <span className="text-xs text-gray-600">総収入</span>
            </div>
            <p className="text-lg font-bold text-green-700">
              ¥{totals.revenue.toLocaleString()}
            </p>
          </div>

          <div className="p-3 bg-red-50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-red-600" />
              <span className="text-xs text-gray-600">総支出</span>
            </div>
            <p className="text-lg font-bold text-red-700">
              ¥{totals.expenses.toLocaleString()}
            </p>
          </div>

          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <span className="text-xs text-gray-600">純利益</span>
            </div>
            <p className="text-lg font-bold text-blue-700">
              ¥{totals.profit.toLocaleString()}
            </p>
          </div>

          <div className="p-3 bg-purple-50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-purple-600" />
              <span className="text-xs text-gray-600">利益率</span>
            </div>
            <p className="text-lg font-bold text-purple-700">
              {totals.margin.toFixed(1)}%
            </p>
          </div>

          <div className="p-3 bg-amber-50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-amber-600" />
              <span className="text-xs text-gray-600">ROI</span>
            </div>
            <p className="text-lg font-bold text-amber-700">
              {totals.roi.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* グラフ */}
        <div className="relative" style={{ height: '400px' }}>
          <Bar ref={chartRef} data={chartData} options={chartOptions} />
        </div>

        {/* カスタム凡例 */}
        <Collapsible open={isLegendOpen} onOpenChange={setIsLegendOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-3 hover:bg-gray-50">
              <span className="font-medium">凡例と詳細</span>
              <ChevronRight className={`w-4 h-4 transition-transform ${isLegendOpen ? 'rotate-90' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {legendItems.map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-sm">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-gray-700">{item.label}</span>
                  <span className="ml-auto font-mono text-xs">
                    ¥{Math.abs(item.value).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            {/* 指標説明 */}
            {(displayOptions.showEfficiency || displayOptions.showGrowth) && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 space-y-1">
                {displayOptions.showEfficiency && (
                  <p>• ROI: 投資収益率（利益÷コスト×100）</p>
                )}
                {displayOptions.showGrowth && (
                  <p>• 成長率: 前月比の変化率</p>
                )}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* デモ版の注意事項 */}
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-xs text-yellow-800">
            ※ これはデモ版です。収支データ、効率性指標、成長率はすべてランダム生成されたサンプル値です。
          </p>
        </div>
      </CardContent>
    </Card>
  )
}