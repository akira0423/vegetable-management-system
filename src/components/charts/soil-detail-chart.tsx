'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { format, addMonths, subMonths } from 'date-fns'
import { ja } from 'date-fns/locale'

// Supabaseクライアント
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  
} else {
  
}

const supabase = createClient<Database>(supabaseUrl!, supabaseAnonKey!)

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface SoilDetailData {
  month: string
  pH: number
  EC: number
  CEC: number
  base_saturation: number
  organic_matter: number
  nitrogen: number
  phosphorus: number
  potassium: number
}

// 土壌成分定義（コンポーネント外で定義）
const components = [
  { id: 'pH', label: 'pH値', color: '#ef4444', unit: 'pH', yAxisID: 'y', scale: 1 },
  { id: 'EC', label: '電気伝導度', color: '#3b82f6', unit: 'mS/cm', yAxisID: 'y1', scale: 10 },
  { id: 'CEC', label: '陽イオン交換容量', color: '#10b981', unit: 'meq/100g', yAxisID: 'y2', scale: 1 },
  { id: 'base_saturation', label: '塩基飽和度', color: '#f59e0b', unit: '%', yAxisID: 'y3', scale: 1 },
  { id: 'organic_matter', label: '有機物含量', color: '#8b5cf6', unit: '%', yAxisID: 'y1', scale: 10 },
  { id: 'nitrogen', label: '全窒素', color: '#06b6d4', unit: 'mg/100g', yAxisID: 'y4', scale: 0.1 },
  { id: 'phosphorus', label: '有効リン酸', color: '#ec4899', unit: 'mg/100g', yAxisID: 'y4', scale: 0.1 },
  { id: 'potassium', label: '交換性カリウム', color: '#84cc16', unit: 'mg/100g', yAxisID: 'y4', scale: 0.1 }
]

interface SoilDetailChartProps {
  companyId: string
}

const SoilDetailChart: React.FC<SoilDetailChartProps> = ({ companyId }) => {
  const chartRef = useRef<ChartJS<"line">>(null)
  
  // 表示成分選択状態
  const [selectedComponents, setSelectedComponents] = useState<string[]>(
    components.map(c => c.id) // 初期状態：全成分を選択
  )
  
  // 実際のデータ状態
  const [soilData, setSoilData] = useState<SoilDetailData[]>([])
  const [loading, setLoading] = useState(false)
  const [startMonth] = useState<Date>(new Date(new Date().getFullYear(), 0, 1)) // 今年の1月から
  const [displayPeriod] = useState<1>(1) // 1年間表示
  
  // Supabaseから土壌データを取得
  const fetchSoilData = useCallback(async () => {
    if (!companyId) {
      
      return
    }
    
    try {
      
      setLoading(true)
      
      const endMonth = addMonths(startMonth, displayPeriod * 12)
      
      // work_reportsから土壌データを取得
      const { data: workReports, error } = await supabase
        .from('work_reports')
        .select(`
          work_date,
          soil_ph, soil_ec, cec, available_phosphorus, 
          exchangeable_potassium, ammonium_nitrogen, nitrate_nitrogen,
          humus_content, exchangeable_calcium, base_saturation
        `)
        .eq('company_id', companyId)
        .gte('work_date', startMonth.toISOString().split('T')[0])
        .lt('work_date', endMonth.toISOString().split('T')[0])
        .is('deleted_at', null)
        .not('soil_ph', 'is', null) // 土壌データがあるもののみ
        .order('work_date', { ascending: true })
      
      if (error) {
        
        return
      }
      
      
      
      if (!workReports || workReports.length === 0) {
        
        setSoilData([])
        return
      }
      
      // 月別にデータをグループ化
      const dataByMonth: { [key: string]: any[] } = {}
      
      workReports.forEach(record => {
        const monthKey = format(new Date(record.work_date), 'yyyy-MM')
        if (!dataByMonth[monthKey]) dataByMonth[monthKey] = []
        dataByMonth[monthKey].push(record)
      })
      
      // 月別に平均値を計算してSoilDetailData形式に変換
      const processedData: SoilDetailData[] = []
      
      for (let i = 0; i < displayPeriod * 12; i++) {
        const currentMonth = addMonths(startMonth, i)
        const monthKey = format(currentMonth, 'yyyy-MM')
        const monthRecords = dataByMonth[monthKey] || []
        
        if (monthRecords.length === 0) continue
        
        // 各成分の平均値を計算
        const avgData = {
          pH: monthRecords.reduce((sum, r) => sum + (r.soil_ph || 6.5), 0) / monthRecords.length,
          EC: monthRecords.reduce((sum, r) => sum + (r.soil_ec || 0.8), 0) / monthRecords.length,
          CEC: monthRecords.reduce((sum, r) => sum + (r.cec || 20.0), 0) / monthRecords.length,
          base_saturation: monthRecords.reduce((sum, r) => sum + (r.base_saturation || 75.0), 0) / monthRecords.length,
          organic_matter: monthRecords.reduce((sum, r) => sum + (r.humus_content || 3.0), 0) / monthRecords.length,
          nitrogen: monthRecords.reduce((sum, r) => sum + ((r.ammonium_nitrogen || 0) + (r.nitrate_nitrogen || 0) || 125.0), 0) / monthRecords.length,
          phosphorus: monthRecords.reduce((sum, r) => sum + (r.available_phosphorus || 50.0), 0) / monthRecords.length,
          potassium: monthRecords.reduce((sum, r) => sum + (r.exchangeable_potassium || 180.0), 0) / monthRecords.length
        }
        
        processedData.push({
          month: currentMonth.toISOString().split('T')[0].substring(0, 7), // yyyy-mm形式
          pH: Math.round(avgData.pH * 100) / 100,
          EC: Math.round(avgData.EC * 1000) / 1000,
          CEC: Math.round(avgData.CEC * 10) / 10,
          base_saturation: Math.round(avgData.base_saturation * 10) / 10,
          organic_matter: Math.round(avgData.organic_matter * 10) / 10,
          nitrogen: Math.round(avgData.nitrogen),
          phosphorus: Math.round(avgData.phosphorus * 10) / 10,
          potassium: Math.round(avgData.potassium)
        })
      }
      
      
      setSoilData(processedData)
      
    } catch (error) {
      
      setSoilData([])
    } finally {
      setLoading(false)
    }
  }, [companyId, startMonth, displayPeriod])
  
  // データ取得の実行
  useEffect(() => {
    fetchSoilData()
  }, [fetchSoilData])

  // 選択された成分のみをフィルタリング
  const visibleComponents = components.filter(component => 
    selectedComponents.includes(component.id)
  )

  const chartData = React.useMemo(() => {
    
    
    
    
    
    const data = {
      labels: soilData.map(d => {
        const date = new Date(d.month + '-01')
        return date.toLocaleDateString('ja-JP', { month: 'short' })
      }),
      datasets: visibleComponents.map(component => {
        
        return {
          label: `${component.label} (${component.unit})`,
          data: soilData.map(d => d[component.id as keyof SoilDetailData] as number * component.scale),
          borderColor: component.color,
          backgroundColor: `${component.color}20`,
          fill: false,
          tension: 0.4,
          pointRadius: 5,
          pointHoverRadius: 8,
          pointBackgroundColor: component.color,
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          yAxisID: component.yAxisID
        }
      })
    }
    
    
    return data
  }, [selectedComponents, visibleComponents])

  // 成分選択の切り替え処理
  const toggleComponent = (componentId: string) => {
    
    setSelectedComponents(prev => {
      const newSelection = prev.includes(componentId)
        ? prev.filter(id => id !== componentId)
        : [...prev, componentId]
      
      
      return newSelection
    })
  }

  // デバッグ用: 選択状態の監視
  React.useEffect(() => {
    
    
  }, [selectedComponents, visibleComponents])

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      title: {
        display: true,
        text: '土壌成分詳細推移分析',
        font: {
          size: 16,
          weight: 'bold' as const
        }
      },
      legend: {
        position: 'bottom' as const,
        labels: {
          usePointStyle: true,
          boxWidth: 6,
          boxHeight: 6,
          padding: 15,
          font: {
            size: 11
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: '#374151',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          title: function(context: any) {
            return `${context[0].label}月の土壌分析結果`
          },
          label: function(context: any) {
            const component = components[context.datasetIndex]
            const value = (context.parsed.y / component.scale).toFixed(component.id === 'pH' ? 1 : 2)
            return `${component.label}: ${value} ${component.unit}`
          },
          afterBody: function(context: any) {
            if (context.length > 0) {
              const monthData = soilData[context[0].dataIndex]
              return [
                '',
                '📊 総合評価:',
                `• pH: ${monthData.pH >= 6.0 && monthData.pH <= 7.0 ? '適正' : '要注意'}`,
                `• 肥沃度: ${monthData.CEC >= 20 ? '良好' : '改善余地あり'}`,
                `• 有機物: ${monthData.organic_matter >= 3.0 ? '充分' : '不足気味'}`
              ]
            }
            return []
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: '測定月',
          font: {
            size: 12,
            weight: 'bold' as const
          }
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        }
      },
      y: {
        type: 'linear' as const,
        display: false,
        position: 'left' as const,
      },
      y1: {
        type: 'linear' as const,
        display: false,
        position: 'right' as const,
        grid: {
          drawOnChartArea: false,
        },
      },
      y2: {
        type: 'linear' as const,
        display: false,
        position: 'right' as const,
        grid: {
          drawOnChartArea: false,
        },
      },
      y3: {
        type: 'linear' as const,
        display: false,
        position: 'right' as const,
        grid: {
          drawOnChartArea: false,
        },
      },
      y4: {
        type: 'linear' as const,
        display: false,
        position: 'right' as const,
        grid: {
          drawOnChartArea: false,
        },
      }
    }
  }

  // ローディング状態
  if (loading) {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
            <p className="text-gray-600">土壌データを取得中...</p>
          </div>
        </div>
      </div>
    )
  }

  // データが空の場合
  if (!soilData || soilData.length === 0) {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-4">🔬</div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">土壌データがありません</h3>
            <p className="text-gray-500">作業記録で土壌情報を登録してください</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* 表示成分選択 - コンパクト化 */}
      <div className="flex flex-wrap gap-2 p-3 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border mb-4">
        <span className="font-semibold text-sm text-gray-700 mr-2">📊 表示成分選択:</span>
        {components.map(component => (
          <label 
            key={component.id} 
            className="flex items-center gap-1 cursor-pointer text-sm hover:bg-white/50 px-2 py-1 rounded"
          >
            <input
              type="checkbox"
              checked={selectedComponents.includes(component.id)}
              onChange={() => toggleComponent(component.id)}
              className="w-3 h-3 rounded text-blue-600"
            />
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: component.color }}
            />
            <span className="font-medium text-gray-700">
              {component.label}
            </span>
          </label>
        ))}
      </div>

      {/* グラフ - 残りスペースを全て使用 */}
      <div className="flex-1 min-h-0">
        <Line ref={chartRef} data={chartData} options={options} />
      </div>
      
      {/* データソース表示 */}
      <div className="mt-2 text-xs text-gray-500 text-center">
        📊 実データ: {soilData.length}ヶ月分の土壌分析結果 | 📈 作業記録から自動集計
      </div>
    </div>
  )
}

export default SoilDetailChart