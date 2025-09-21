'use client'

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { Database } from '@/types/database'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, FileSpreadsheet, FileImage, RefreshCw, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Skeleton } from '@/components/ui/skeleton'
import FinancialTooltip from '@/components/financial-tooltip'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement
)

interface FinancialPerformanceChartProps {
  workReports: any[]
  selectedVegetables: string[]
  dateRange: { start: string; end: string }
}

interface AccountingItem {
  id: string
  name: string
  category: 'income' | 'variable_costs' | 'fixed_costs'
  value: number
  color?: string
  unit?: string
}

interface CategoryData {
  income: AccountingItem[]
  variable_costs: AccountingItem[]
  fixed_costs: AccountingItem[]
}

const CATEGORY_COLORS = {
  income: {
    base: '#22c55e',
    hover: '#16a34a',
    variants: ['#22c55e', '#34d399', '#10b981', '#059669', '#047857']
  },
  variable_costs: {
    base: '#fb923c',
    hover: '#f97316',
    variants: ['#fb923c', '#fdba74', '#f97316', '#ea580c', '#dc2626']
  },
  fixed_costs: {
    base: '#ef4444',
    hover: '#dc2626',
    variants: ['#ef4444', '#f87171', '#dc2626', '#b91c1c', '#991b1b']
  }
}

export default function FinancialPerformanceChart({
  workReports,
  selectedVegetables,
  dateRange
}: FinancialPerformanceChartProps) {
  const chartRef = useRef<ChartJS<'bar'>>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [monthlyData, setMonthlyData] = useState<{ [month: string]: CategoryData }>({})

  // APIからデータを取得する関数
  const fetchAccountingData = useCallback(async () => {
    if (!workReports || workReports.length === 0) {
      console.log('No work reports to process')
      setMonthlyData({})
      return
    }

    setIsLoadingData(true)

    try {
      const workReportIds = workReports.map(r => r.id)
      const companyId = workReports[0]?.company_id

      console.log('Fetching accounting data for:', { workReportIds, companyId })

      // Phase 1 APIエンドポイントを使用
      const response = await fetch('/api/financial-performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workReportIds,
          companyId,
          dateRange
        })
      })

      const result = await response.json()

      if (!response.ok) {
        console.error('API Error:', result.error)
        // エラー時は空データを設定
        setMonthlyData({})
        return
      }

      if (result.success && result.data) {
        console.log('Received data from API:', result.data)

        // APIから整形済みのデータを受け取る
        const formattedData: { [month: string]: CategoryData } = {}

        Object.entries(result.data).forEach(([monthKey, monthData]: [string, any]) => {
          formattedData[monthKey] = {
            income: Array.isArray(monthData.income) ? monthData.income.map((item: any) => ({
              id: item.id || 'unknown',
              name: item.name || '不明な項目',
              category: 'income' as const,
              value: item.value || 0,
              unit: '円'
            })) : [],
            variable_costs: Array.isArray(monthData.variable_costs) ? monthData.variable_costs.map((item: any) => ({
              id: item.id || 'unknown',
              name: item.name || '不明な項目',
              category: 'variable_costs' as const,
              value: item.value || 0,
              unit: '円'
            })) : [],
            fixed_costs: Array.isArray(monthData.fixed_costs) ? monthData.fixed_costs.map((item: any) => ({
              id: item.id || 'unknown',
              name: item.name || '不明な項目',
              category: 'fixed_costs' as const,
              value: item.value || 0,
              unit: '円'
            })) : []
          }
        })

        // 色を割り当て
        Object.keys(formattedData).forEach(month => {
          ['income', 'variable_costs', 'fixed_costs'].forEach(category => {
            const categoryKey = category as keyof CategoryData
            const items = formattedData[month][categoryKey]
            const colorVariants = CATEGORY_COLORS[categoryKey].variants

            items.forEach((item, index) => {
              item.color = colorVariants[index % colorVariants.length]
            })
          })
        })

        setMonthlyData(formattedData)
      } else {
        console.log('No data or unsuccessful response:', result)
        setMonthlyData({})
      }

    } catch (error) {
      console.error('Failed to fetch accounting data:', error)
      setMonthlyData({})
    } finally {
      setIsLoadingData(false)
    }
  }, [workReports, dateRange])

  // workReportsが変更されたらデータを取得
  useEffect(() => {
    fetchAccountingData()
  }, [fetchAccountingData])

  // フィルタリング済みのレポート
  const filteredReports = useMemo(() => {
    if (!workReports) return []

    let filtered = workReports

    if (selectedVegetables.length > 0) {
      filtered = filtered.filter(report =>
        selectedVegetables.includes(report.vegetable_id)
      )
    }

    return filtered
  }, [workReports, selectedVegetables])

  // チャートデータの準備
  const chartData = useMemo(() => {
    if (Object.keys(monthlyData).length === 0) {
      return {
        labels: [],
        datasets: []
      }
    }

    const months = Object.keys(monthlyData).sort()
    const labels = months.map(month =>
      format(new Date(month + '-01'), 'yyyy年MM月', { locale: ja })
    )

    // カテゴリ別のデータセット
    const datasets = [
      // 収入
      {
        label: '収入',
        data: months.map(month => {
          const items = monthlyData[month]?.income || []
          return items.reduce((sum, item) => sum + item.value, 0)
        }),
        backgroundColor: CATEGORY_COLORS.income.base,
        borderColor: CATEGORY_COLORS.income.hover,
        borderWidth: 1
      },
      // 変動費（負の値で表示）
      {
        label: '変動費',
        data: months.map(month => {
          const items = monthlyData[month]?.variable_costs || []
          return -items.reduce((sum, item) => sum + item.value, 0)
        }),
        backgroundColor: CATEGORY_COLORS.variable_costs.base,
        borderColor: CATEGORY_COLORS.variable_costs.hover,
        borderWidth: 1
      },
      // 固定費（負の値で表示）
      {
        label: '固定費',
        data: months.map(month => {
          const items = monthlyData[month]?.fixed_costs || []
          return -items.reduce((sum, item) => sum + item.value, 0)
        }),
        backgroundColor: CATEGORY_COLORS.fixed_costs.base,
        borderColor: CATEGORY_COLORS.fixed_costs.hover,
        borderWidth: 1
      }
    ]

    return {
      labels,
      datasets
    }
  }, [monthlyData])

  // チャートオプション
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          padding: 20,
          usePointStyle: true,
          font: {
            size: 12,
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: function(context: any) {
            const label = context.dataset.label || ''
            const value = Math.abs(context.parsed.y)
            return `${label}: ¥${value.toLocaleString()}`
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          font: {
            size: 11
          }
        }
      },
      y: {
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          font: {
            size: 11
          },
          callback: function(value: any) {
            return '¥' + Math.abs(value).toLocaleString()
          }
        }
      }
    }
  }), [])

  // エクスポート機能
  const exportAsImage = () => {
    if (!chartRef.current) return
    setIsExporting(true)

    const url = chartRef.current.toBase64Image()
    const link = document.createElement('a')
    link.download = `financial-performance-${format(new Date(), 'yyyyMMdd')}.png`
    link.href = url
    link.click()

    setIsExporting(false)
  }

  const exportAsCSV = () => {
    setIsExporting(true)

    const rows = []
    rows.push(['月', '収入', '変動費', '固定費', '純利益'])

    const months = Object.keys(monthlyData).sort()
    months.forEach(month => {
      const income = monthlyData[month].income.reduce((sum, item) => sum + item.value, 0)
      const variableCosts = monthlyData[month].variable_costs.reduce((sum, item) => sum + item.value, 0)
      const fixedCosts = monthlyData[month].fixed_costs.reduce((sum, item) => sum + item.value, 0)
      const netIncome = income - variableCosts - fixedCosts

      rows.push([
        format(new Date(month + '-01'), 'yyyy年MM月', { locale: ja }),
        income.toString(),
        variableCosts.toString(),
        fixedCosts.toString(),
        netIncome.toString()
      ])
    })

    const csvContent = rows.map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `financial-performance-${format(new Date(), 'yyyyMMdd')}.csv`
    link.click()

    setIsExporting(false)
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl">📊 収支構造分析（収入・費用同時表示）</CardTitle>
            <CardDescription className="mt-2">
              月別の収入と支出の内訳を可視化
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAccountingData}
              disabled={isLoadingData}
            >
              {isLoadingData ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportAsImage}
              disabled={isExporting || chartData.labels.length === 0}
            >
              <FileImage className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportAsCSV}
              disabled={isExporting || Object.keys(monthlyData).length === 0}
            >
              <FileSpreadsheet className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoadingData ? (
          <div className="h-[400px] flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : chartData.labels.length > 0 ? (
          <div className="h-[400px]">
            <Bar ref={chartRef} data={chartData} options={chartOptions} />
          </div>
        ) : (
          <div className="h-[400px] flex items-center justify-center text-gray-500">
            <div className="text-center">
              <p className="text-lg mb-2">データがありません</p>
              <p className="text-sm">選択された期間に会計データが登録されていません</p>
            </div>
          </div>
        )}

        {/* 詳細情報 */}
        {Object.keys(monthlyData).length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {['income', 'variable_costs', 'fixed_costs'].map((category) => {
              const categoryKey = category as keyof CategoryData
              const totalAmount = Object.values(monthlyData).reduce((sum, month) => {
                return sum + month[categoryKey].reduce((catSum, item) => catSum + item.value, 0)
              }, 0)

              return (
                <div key={category} className="text-center">
                  <p className="text-sm text-gray-600">
                    {category === 'income' ? '総収入' :
                     category === 'variable_costs' ? '総変動費' : '総固定費'}
                  </p>
                  <p className="text-lg font-bold" style={{ color: CATEGORY_COLORS[categoryKey].base }}>
                    ¥{totalAmount.toLocaleString()}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}