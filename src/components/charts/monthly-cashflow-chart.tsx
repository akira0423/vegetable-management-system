'use client'

import React, { useState, useMemo, useRef, useCallback } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CalendarIcon, TrendingUp, TrendingDown, Eye, X } from 'lucide-react'
import { format, addMonths, subMonths } from 'date-fns'
import { ja } from 'date-fns/locale'

// Chart.jsの登録
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
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

// 作業種別の色定義
const WORK_TYPE_COLORS = {
  seeding: '#10b981',      // 緑 - 播種
  planting: '#059669',     // 濃緑 - 定植
  fertilizing: '#3b82f6',  // 青 - 施肥
  watering: '#06b6d4',     // シアン - 灌水
  weeding: '#f59e0b',      // 黄 - 除草
  pruning: '#8b5cf6',      // 紫 - 整枝
  harvesting: '#ef4444',   // 赤 - 収穫
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

export default function MonthlyCashflowChart({ companyId, selectedVegetable = 'all' }: MonthlyCashflowChartProps) {
  const [startMonth, setStartMonth] = useState<Date>(subMonths(new Date(), 23))
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [cashflowData, setCashflowData] = useState<CashFlowData[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<CashFlowData | null>(null)
  const [drilldownOpen, setDrilldownOpen] = useState(false)
  
  const chartRef = useRef<ChartJS<'bar'>>(null)

  // Y軸範囲の動的計算
  const calculateYAxisRange = useCallback((data: CashFlowData[]) => {
    if (!data || data.length === 0) return { min: -100000, max: 100000 }
    
    const totals = data.map(d => d.monthly_total)
    const max = Math.max(...totals)
    const min = Math.min(...totals)
    const range = max - min
    const buffer = Math.max(range * 0.2, 50000) // 最小5万円のバッファ
    
    // キリの良い値に丸める
    const roundToNice = (value: number) => {
      if (value === 0) return 0
      const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(value))))
      const factor = magnitude >= 10000 ? 10000 : magnitude
      return Math.ceil(value / factor) * factor
    }
    
    return {
      min: roundToNice(min - buffer),
      max: roundToNice(max + buffer)
    }
  }, [])

  // データフェッチ
  const fetchCashflowData = useCallback(async () => {
    if (!companyId) return
    
    setLoading(true)
    try {
      console.log('📊 キャッシュフローデータ取得開始:', companyId)
      
      const endMonth = addMonths(startMonth, 23)
      const startDate = format(startMonth, 'yyyy-MM-01')
      const endDate = format(endMonth, 'yyyy-MM-dd')
      
      // 作業レポートと会計データを並行取得
      let apiUrl = `/api/reports?company_id=${companyId}&start_date=${startDate}&end_date=${endDate}&limit=1000`
      if (selectedVegetable && selectedVegetable !== 'all') {
        apiUrl += `&vegetable_id=${selectedVegetable}`
      }
      
      const [reportsResponse] = await Promise.all([
        fetch(apiUrl)
      ])
      
      if (!reportsResponse.ok) {
        throw new Error('データの取得に失敗しました')
      }
      
      const reportsResult = await reportsResponse.json()
      const reports = reportsResult.success ? reportsResult.data : []
      
      console.log('🥬 キャッシュフロー: フィルター適用', {
        選択野菜: selectedVegetable,
        取得レポート数: reports.length
      })
      
      // 月次キャッシュフローデータを生成
      const monthlyData: CashFlowData[] = []
      
      for (let i = 0; i < 24; i++) {
        const currentMonth = addMonths(startMonth, i)
        const monthKey = format(currentMonth, 'yyyy-MM')
        const monthReports = reports.filter((r: any) => 
          r.work_date.startsWith(monthKey)
        )
        
        const workTypes: any = {}
        let monthlyIncome = 0
        let monthlyExpense = 0
        
        // 作業種別ごとにデータを集計
        Object.keys(WORK_TYPE_COLORS).forEach(workType => {
          const typeReports = monthReports.filter((r: any) => r.work_type === workType)
          const income = typeReports.reduce((sum: number, r: any) => sum + (r.expected_revenue || 0), 0)
          const expense = typeReports.reduce((sum: number, r: any) => sum + (r.estimated_cost || 0), 0)
          
          workTypes[workType] = {
            income,
            expense: -expense, // 支出はマイナス値
            net: income - expense,
            details: typeReports.map((r: any) => ({
              id: r.id,
              work_type: r.work_type,
              item_name: `${WORK_TYPE_LABELS[r.work_type as keyof typeof WORK_TYPE_LABELS]}作業`,
              amount: (r.expected_revenue || 0) - (r.estimated_cost || 0),
              category: (r.expected_revenue || 0) >= (r.estimated_cost || 0) ? 'income' as const : 'expense' as const,
              work_date: r.work_date,
              description: r.work_notes
            }))
          }
          
          monthlyIncome += income
          monthlyExpense += expense
        })
        
        monthlyData.push({
          month: format(currentMonth, 'M月', { locale: ja }),
          year: currentMonth.getFullYear(),
          month_num: currentMonth.getMonth() + 1,
          work_types: workTypes,
          monthly_total: monthlyIncome - monthlyExpense,
          monthly_income: monthlyIncome,
          monthly_expense: monthlyExpense
        })
      }
      
      setCashflowData(monthlyData)
      console.log('✅ キャッシュフローデータ生成完了:', monthlyData.length, '件')
      
    } catch (error) {
      console.error('❌ キャッシュフローデータ取得エラー:', error)
      setCashflowData([])
    } finally {
      setLoading(false)
    }
  }, [companyId, startMonth, selectedVegetable])

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
      const incomeData = cashflowData.map(d => d.work_types[workType]?.income || 0)
      const expenseData = cashflowData.map(d => d.work_types[workType]?.expense || 0)
      
      return [
        {
          label: `${WORK_TYPE_LABELS[workType as keyof typeof WORK_TYPE_LABELS]} (収入)`,
          data: incomeData,
          backgroundColor: WORK_TYPE_COLORS[workType as keyof typeof WORK_TYPE_COLORS],
          borderColor: WORK_TYPE_COLORS[workType as keyof typeof WORK_TYPE_COLORS],
          borderWidth: 1,
          stack: 'income'
        },
        {
          label: `${WORK_TYPE_LABELS[workType as keyof typeof WORK_TYPE_LABELS]} (支出)`,
          data: expenseData,
          backgroundColor: WORK_TYPE_COLORS[workType as keyof typeof WORK_TYPE_COLORS] + '80', // 透明度付き
          borderColor: WORK_TYPE_COLORS[workType as keyof typeof WORK_TYPE_COLORS],
          borderWidth: 1,
          stack: 'expense'
        }
      ]
    }).flat()
    
    return {
      labels: cashflowData.map(d => `${d.year}年${d.month}`),
      datasets
    }
  }, [cashflowData])

  // Y軸範囲の計算
  const yAxisRange = useMemo(() => 
    calculateYAxisRange(cashflowData), [cashflowData, calculateYAxisRange]
  )

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
        stacked: true,
        grid: {
          display: false
        },
        ticks: {
          maxRotation: 45,
          font: {
            size: 11
          }
        }
      },
      y: {
        stacked: true,
        min: yAxisRange.min,
        max: yAxisRange.max,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        },
        ticks: {
          callback: function(value) {
            return new Intl.NumberFormat('ja-JP', {
              style: 'currency',
              currency: 'JPY',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            }).format(value as number)
          }
        }
      }
    },
    plugins: {
      legend: {
        display: false // カスタム凡例を使用
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        callbacks: {
          title: (context) => {
            const dataIndex = context[0].dataIndex
            const data = cashflowData[dataIndex]
            return `${data.year}年${data.month}のキャッシュフロー`
          },
          afterBody: (context) => {
            const dataIndex = context[0].dataIndex
            const data = cashflowData[dataIndex]
            return [
              '',
              `月間合計: ${new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(data.monthly_total)}`,
              `クリックで詳細表示`
            ]
          }
        }
      }
    },
    animation: {
      duration: 1000,
      easing: 'easeOutBounce'
    }
  }), [yAxisRange, cashflowData])

  // 開始月変更ハンドラー
  const handleStartMonthChange = (date: Date | undefined) => {
    if (date) {
      setStartMonth(date)
      setCalendarOpen(false)
    }
  }

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
          <div className="h-96 flex items-center justify-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              月次キャッシュフロー推移
            </CardTitle>
            
            {/* 開始月選択 */}
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {format(startMonth, 'yyyy年M月', { locale: ja })}開始
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={startMonth}
                  onSelect={handleStartMonthChange}
                  locale={ja}
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* カスタム凡例 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            {Object.entries(WORK_TYPE_LABELS).map(([workType, label]) => (
              <div key={workType} className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: WORK_TYPE_COLORS[workType as keyof typeof WORK_TYPE_COLORS] }}
                />
                <span className="text-xs font-medium">{label}</span>
                <span className="text-xs text-gray-500">
                  {new Intl.NumberFormat('ja-JP', { 
                    style: 'currency', 
                    currency: 'JPY', 
                    minimumFractionDigits: 0 
                  }).format(periodTotals[workType] || 0)}
                </span>
              </div>
            ))}
          </div>
          
          {/* グラフ */}
          <div className="h-96 relative">
            {chartData && (
              <Bar 
                ref={chartRef}
                data={chartData} 
                options={chartOptions}
              />
            )}
            
            {/* 月次合計値表示 */}
            <div className="absolute top-0 left-0 w-full pointer-events-none">
              {cashflowData.map((data, index) => (
                <div
                  key={index}
                  className="absolute text-xs font-bold"
                  style={{
                    left: `${(index + 0.5) / 24 * 100}%`,
                    top: data.monthly_total >= 0 ? '10px' : 'auto',
                    bottom: data.monthly_total < 0 ? '50px' : 'auto',
                    transform: 'translateX(-50%)',
                    color: data.monthly_total >= 0 ? '#16a34a' : '#dc2626'
                  }}
                >
                  {new Intl.NumberFormat('ja-JP', { 
                    style: 'currency', 
                    currency: 'JPY', 
                    minimumFractionDigits: 0 
                  }).format(data.monthly_total)}
                </div>
              ))}
            </div>
          </div>
          
          <div className="mt-4 text-xs text-gray-500 text-center">
            💡 各月の棒グラフをクリックすると詳細データを表示できます
          </div>
        </CardContent>
      </Card>

      {/* データドリルダウンダイアログ */}
      <Dialog open={drilldownOpen} onOpenChange={setDrilldownOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              {selectedMonth && `${selectedMonth.year}年${selectedMonth.month}の詳細データ`}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDrilldownOpen(false)}
                className="ml-auto"
              >
                <X className="w-4 h-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          {selectedMonth && (
            <div className="space-y-6">
              {/* 月間サマリー */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-500" />
                    <div className="text-2xl font-bold text-green-600">
                      {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(selectedMonth.monthly_income)}
                    </div>
                    <div className="text-sm text-gray-600">総収入</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4 text-center">
                    <TrendingDown className="w-8 h-8 mx-auto mb-2 text-red-500" />
                    <div className="text-2xl font-bold text-red-600">
                      {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(selectedMonth.monthly_expense)}
                    </div>
                    <div className="text-sm text-gray-600">総支出</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className={`w-8 h-8 mx-auto mb-2 ${selectedMonth.monthly_total >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {selectedMonth.monthly_total >= 0 ? <TrendingUp className="w-8 h-8" /> : <TrendingDown className="w-8 h-8" />}
                    </div>
                    <div className={`text-2xl font-bold ${selectedMonth.monthly_total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(selectedMonth.monthly_total)}
                    </div>
                    <div className="text-sm text-gray-600">純損益</div>
                  </CardContent>
                </Card>
              </div>

              {/* 作業種別詳細 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">作業種別詳細</h3>
                {Object.entries(selectedMonth.work_types)
                  .filter(([_, data]) => data.income > 0 || data.expense < 0)
                  .map(([workType, data]) => (
                    <Card key={workType}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-4 h-4 rounded"
                              style={{ backgroundColor: WORK_TYPE_COLORS[workType as keyof typeof WORK_TYPE_COLORS] }}
                            />
                            <span className="font-medium">{WORK_TYPE_LABELS[workType as keyof typeof WORK_TYPE_LABELS]}</span>
                          </div>
                          <Badge className={data.net >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                            {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(data.net)}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">収入: </span>
                            <span className="font-medium text-green-600">
                              {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(data.income)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">支出: </span>
                            <span className="font-medium text-red-600">
                              {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(Math.abs(data.expense))}
                            </span>
                          </div>
                        </div>
                        
                        {data.details.length > 0 && (
                          <div className="mt-3 space-y-1">
                            <div className="text-xs text-gray-500">詳細項目 ({data.details.length}件)</div>
                            <div className="max-h-20 overflow-y-auto space-y-1">
                              {data.details.slice(0, 3).map(detail => (
                                <div key={detail.id} className="text-xs text-gray-600 flex justify-between">
                                  <span>{detail.item_name}</span>
                                  <span>{new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(detail.amount)}</span>
                                </div>
                              ))}
                              {data.details.length > 3 && (
                                <div className="text-xs text-gray-400">...他 {data.details.length - 3}件</div>
                              )}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}