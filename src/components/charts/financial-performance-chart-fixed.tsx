'use client'

import { useCallback, useMemo, useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  TooltipItem
} from 'chart.js'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Skeleton } from '@/components/ui/skeleton'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
)

interface FinancialPerformanceChartProps {
  workReports: any[]
  selectedVegetables: string[]
  dateRange: { start: string; end: string }
  companyId?: string
}

export default function FinancialPerformanceChartFixed({
  workReports,
  selectedVegetables,
  dateRange,
  companyId
}: FinancialPerformanceChartProps) {
  const [chartData, setChartData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // APIからデータを取得
  const fetchAccountingData = useCallback(async () => {
    if (!workReports || workReports.length === 0) {
      setChartData(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const workReportIds = workReports.map(r => r.id)

      // Phase 1 APIを使用
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
        throw new Error(result.error || 'Failed to fetch data')
      }

      // データが空の場合の処理
      if (!result.data || Object.keys(result.data).length === 0) {
        console.log('No accounting data available')
        setChartData(generateEmptyChart())
        return
      }

      // チャートデータを生成
      const monthlyData = result.data
      const months = Object.keys(monthlyData).sort()

      const labels = months.map(month =>
        format(new Date(month + '-01'), 'yyyy年MM月', { locale: ja })
      )

      // 収入データ
      const incomeData = months.map(month => {
        const items = monthlyData[month]?.income || []
        return items.reduce((sum: number, item: any) => sum + item.value, 0)
      })

      // 変動費データ（負の値で表示）
      const variableCostsData = months.map(month => {
        const items = monthlyData[month]?.variable_costs || []
        return -items.reduce((sum: number, item: any) => sum + item.value, 0)
      })

      // 固定費データ（負の値で表示）
      const fixedCostsData = months.map(month => {
        const items = monthlyData[month]?.fixed_costs || []
        return -items.reduce((sum: number, item: any) => sum + item.value, 0)
      })

      setChartData({
        labels,
        datasets: [
          {
            label: '収入',
            data: incomeData,
            backgroundColor: 'rgba(34, 197, 94, 0.8)',
            borderColor: 'rgb(34, 197, 94)',
            borderWidth: 1,
          },
          {
            label: '変動費',
            data: variableCostsData,
            backgroundColor: 'rgba(251, 146, 60, 0.8)',
            borderColor: 'rgb(251, 146, 60)',
            borderWidth: 1,
          },
          {
            label: '固定費',
            data: fixedCostsData,
            backgroundColor: 'rgba(239, 68, 68, 0.8)',
            borderColor: 'rgb(239, 68, 68)',
            borderWidth: 1,
          }
        ]
      })

    } catch (err) {
      console.error('Error fetching accounting data:', err)
      setError(err.message)
      setChartData(generateEmptyChart())
    } finally {
      setIsLoading(false)
    }
  }, [workReports, companyId, dateRange])

  // 空のチャートを生成
  const generateEmptyChart = () => ({
    labels: ['データなし'],
    datasets: [
      {
        label: '収入',
        data: [0],
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
      },
      {
        label: '変動費',
        data: [0],
        backgroundColor: 'rgba(251, 146, 60, 0.2)',
      },
      {
        label: '固定費',
        data: [0],
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
      }
    ]
  })

  // データ取得を実行
  useEffect(() => {
    fetchAccountingData()
  }, [fetchAccountingData])

  // チャートオプション
  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: function(context: TooltipItem<'bar'>) {
            const label = context.dataset.label || ''
            const value = context.parsed.y
            return `${label}: ¥${Math.abs(value).toLocaleString()}`
          }
        }
      }
    },
    scales: {
      x: {
        stacked: false,
      },
      y: {
        stacked: false,
        ticks: {
          callback: function(value: any) {
            return '¥' + Math.abs(value).toLocaleString()
          }
        }
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>📊 収支構造分析（収入・費用同時表示）</CardTitle>
        <CardDescription>
          月別の収入と支出の内訳を表示
          {error && <span className="text-red-500 ml-2">⚠️ {error}</span>}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[400px] w-full" />
        ) : chartData ? (
          <div className="h-[400px]">
            <Bar data={chartData} options={options} />
          </div>
        ) : (
          <div className="h-[400px] flex items-center justify-center text-gray-500">
            データがありません
          </div>
        )}
      </CardContent>
    </Card>
  )
}