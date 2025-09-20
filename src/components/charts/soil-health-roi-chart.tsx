'use client'

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Database, HarvestRecord, SoilRecord } from '@/types/database'
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
import { Line, Bar } from 'react-chartjs-2'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogPortal, DialogOverlay } from '@/components/ui/dialog'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils/index'
import { CalendarIcon, BarChart3, TrendingUp, TrendingDown, Eye, X, Target, Zap, Beaker, Activity, Sprout } from 'lucide-react'
import { format, addMonths, subMonths } from 'date-fns'
import { ja } from 'date-fns/locale'

// Supabaseクライアント
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  
  
  
  
} else {
   + '...',
    keyPreview: supabaseAnonKey?.substring(0, 30) + '...'
  })
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

interface HarvestSoilData {
  month: string
  year: number
  month_num: number
  vegetable: string             // 野菜種類
  vegetable_id: string          // 野菜 ID
  harvest_quantity: number      // 収穫量
  harvest_unit: string          // 収穫量単位 (kg, 個, 束など)
  harvest_value: number         // 収穫金額 (円)  
  soil_data: {
    pH: number
    EC: number
    CEC: number
    phosphorus: number
    potassium: number
    nitrogen: number
    organic_matter: number
    calcium: number
  }
}

// データベースから取得した野菜データ
interface DatabaseVegetable {
  id: string
  name: string
  variety_name?: string
  harvest_quantity?: number
  harvest_unit?: string
  actual_harvest_start?: string
  actual_harvest_end?: string
  status: string
  created_at: string
}

interface HarvestSoilChartProps {
  companyId: string
  selectedVegetable?: string
}

// ユーザー登録野菜データインターフェース
interface UserVegetable {
  id: string
  name: string
  unit: string
  color: string
  category: string
  season_start: number  // 開始月（1-12）
  season_end: number    // 終了月（1-12）
  unit_price: number    // 単価（円）
}

// デフォルト野菜マスターデータ（ユーザー未登録時のフォールバック）
const DEFAULT_VEGETABLE_OPTIONS: UserVegetable[] = [
  { id: 'all', name: 'すべて', unit: 'kg', color: '#22c55e', category: 'all', season_start: 1, season_end: 12, unit_price: 300 },
  { id: 'tomato', name: 'トマト', unit: 'kg', color: '#ef4444', category: '果菜', season_start: 6, season_end: 10, unit_price: 400 },
  { id: 'cucumber', name: 'きゅうり', unit: '本', color: '#10b981', category: '果菜', season_start: 5, season_end: 9, unit_price: 80 },
  { id: 'lettuce', name: 'レタス', unit: '個', color: '#06b6d4', category: '葉菜', season_start: 3, season_end: 5, unit_price: 200 },
  { id: 'cabbage', name: 'キャベツ', unit: '個', color: '#8b5cf6', category: '葉菜', season_start: 10, season_end: 12, unit_price: 250 },
  { id: 'carrot', name: 'にんじん', unit: 'kg', color: '#f59e0b', category: '根菜', season_start: 9, season_end: 11, unit_price: 350 },
  { id: 'potato', name: 'じゃがいも', unit: 'kg', color: '#84cc16', category: '根菜', season_start: 9, season_end: 11, unit_price: 280 },
  { id: 'onion', name: '玉ねぎ', unit: 'kg', color: '#ec4899', category: '根菜', season_start: 4, season_end: 6, unit_price: 320 }
]

// 土壌情報表示オプション
interface SoilDisplayOptions {
  soil1: string | null  // 1つ目の土壌情報
  soil2: string | null  // 2つ目の土壌情報
}

// 土壌成分の色定義（実用農業テーマ）
const SOIL_COMPONENT_COLORS = {
  pH: '#f97316',           // オレンジ - pH（基本指標）
  EC: '#3b82f6',           // ブルー - EC（電気伝導度）
  CEC: '#10b981',          // エメラルド - CEC（陽イオン交換容量）
  phosphorus: '#ef4444',   // レッド - リン酸
  potassium: '#a855f7',    // パープル - カリウム
  nitrogen: '#22c55e',     // グリーン - 窒素
  organic_matter: '#84cc16', // ライム - 有機物
  calcium: '#6366f1'       // インディゴ - カルシウム
}

const SOIL_COMPONENT_LABELS = {
  pH: 'pH値',
  EC: 'EC値 (電気伝導度)',
  CEC: 'CEC (陽イオン交換容量)',
  phosphorus: 'リン酸',
  potassium: 'カリウム',
  nitrogen: '窒素',
  organic_matter: '有機物含量',
  calcium: 'カルシウム'
}

const SOIL_COMPONENT_UNITS = {
  pH: '',
  EC: 'mS/cm',
  CEC: 'meq/100g',
  phosphorus: 'mg/100g',
  potassium: 'mg/100g', 
  nitrogen: 'mg/100g',
  organic_matter: '%',
  calcium: 'mg/100g'
}

export default function HarvestSoilChart({ companyId, selectedVegetable = 'all' }: HarvestSoilChartProps) {
  // Propsのデバッグ情報
  
  const [startMonth, setStartMonth] = useState<Date>(new Date(new Date().getFullYear(), 0, 1))
  const [yearMonthPickerOpen, setYearMonthPickerOpen] = useState(false)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [selectedMonthNum, setSelectedMonthNum] = useState<number>(1)
  const [displayPeriod, setDisplayPeriod] = useState<1 | 2>(1)
  const [harvestSoilData, setHarvestSoilData] = useState<HarvestSoilData[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<HarvestSoilData | null>(null)
  const [drilldownOpen, setDrilldownOpen] = useState(false)
  const [currentVegetable, setCurrentVegetable] = useState<string>('all')
  const [userVegetables, setUserVegetables] = useState<UserVegetable[]>(DEFAULT_VEGETABLE_OPTIONS)
  const [soilDisplayOptions, setSoilDisplayOptions] = useState<SoilDisplayOptions>({
    soil1: 'pH',
    soil2: 'EC'
  })
  const [lastUpdated, setLastUpdated] = useState(new Date())
  
  const chartRef = useRef<ChartJS<'bar'>>(null)
  
  // 現在選択されている野菜の情報を取得
  const currentVegetableInfo = userVegetables.find(v => v.id === currentVegetable) || userVegetables[0]
  
  // Supabaseからユーザー野菜データを取得
  const fetchUserVegetables = useCallback(async () => {
    
    
    if (!companyId) {
      
      setUserVegetables(DEFAULT_VEGETABLE_OPTIONS)
      return
    }
    
    try {
      
      
      // 認証状態をデバッグ
      const { data: { session } } = await supabase.auth.getSession()
      
      
      const { data: vegetablesData, error } = await supabase
        .from('vegetables')
        .select('id, name, variety_name, status, created_at')
        .eq('company_id', companyId)
        .is('deleted_at', null)  // 削除されていないもののみ
        .in('status', ['planning', 'active', 'growing', 'harvesting'])  // アクティブな野菜のみ
        .order('created_at', { ascending: false })
      
      if (error) {
        
        throw error
      }
      
      
      
      if (!vegetablesData || vegetablesData.length === 0) {
        
        setUserVegetables(DEFAULT_VEGETABLE_OPTIONS)
        return
      }
      
      // SupabaseデータをUserVegetable形式に変換
      const vegetables: UserVegetable[] = [
        { id: 'all', name: 'すべて', unit: 'kg', color: '#22c55e', category: 'all', season_start: 1, season_end: 12, unit_price: 300 },
        ...vegetablesData.map((veg, index) => ({
          id: veg.id,
          name: veg.variety_name ? `${veg.name} (${veg.variety_name})` : veg.name,
          unit: 'kg',  // デフォルト単位（work_reportsから実際の単位を取得）
          color: DEFAULT_VEGETABLE_OPTIONS[Math.min(index + 1, DEFAULT_VEGETABLE_OPTIONS.length - 1)]?.color || '#64748b',
          category: '登録野菜',
          season_start: 6, // デフォルト値
          season_end: 10,   // デフォルト値
          unit_price: 300   // デフォルト値
        }))
      ]
      
      
      setUserVegetables(vegetables)
      
    } catch (error: any) {
      
      
      // エラー時はデフォルトデータを使用
      setUserVegetables(DEFAULT_VEGETABLE_OPTIONS)
    }
  }, [companyId])
  
  // 複数右軸表示用のカスタムプラグイン（AI予測作業時間分析と同じ設定）
  const multipleRightAxisPlugin = {
    id: 'multipleRightAxis',
    beforeDraw: (chart: any) => {
      if (soilDisplayOptions.soil1 && soilDisplayOptions.soil2) {
        const ctx = chart.ctx
        const chartArea = chart.chartArea
        const y1Scale = chart.scales.y1
        const y2Scale = chart.scales.y2
        
        if (y1Scale && y2Scale && chartArea) {
          // 土壌データ2軸目をより右側に配置（AI予測作業時間分析と同じ設定）
          y2Scale.left = chartArea.right + 15
          y2Scale.right = chartArea.right + 65
        }
      }
    }
  }

  // Supabaseから作業報告データ（収穫・土壌データ）を取得
  const fetchHarvestSoilData = useCallback(async () => {
    if (!companyId) {
      
      return []
    }
    
    if (!userVegetables || userVegetables.length === 0) {
      
      return []
    }
    
    try {
      , 
        displayPeriod, 
        currentVegetable,
        userVegetablesCount: userVegetables.length
      })
      
      const endMonth = addMonths(startMonth, displayPeriod * 12)
      const allData: HarvestSoilData[] = []
      
      // 選択された野菜を取得（UUID形式のIDのみ）
      const targetVegetables = currentVegetable === 'all' 
        ? userVegetables.filter(v => v.id !== 'all' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.id)) 
        : currentVegetableInfo && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentVegetableInfo.id) 
          ? [currentVegetableInfo] 
          : []
      
      ))
      
      // 各野菜の作業報告データを取得
      for (const vegetable of targetVegetables) {
        if (vegetable.id === 'all') continue
        
        
        
        // work_reportsから収穫・土壌データを取得
        const { data: workReports, error: workError } = await supabase
          .from('work_reports')
          .select(`
            id, vegetable_id, work_date, work_type,
            harvest_amount, harvest_unit, expected_revenue, income_total,
            soil_ph, soil_ec, cec, available_phosphorus, 
            exchangeable_potassium, ammonium_nitrogen, nitrate_nitrogen,
            humus_content, exchangeable_calcium, exchangeable_magnesium,
            base_saturation
          `)
          .eq('company_id', companyId)
          .eq('vegetable_id', vegetable.id)
          .gte('work_date', startMonth.toISOString().split('T')[0])
          .lt('work_date', endMonth.toISOString().split('T')[0])
          .is('deleted_at', null)  // 削除されていないデータのみ
          .order('work_date', { ascending: true })
        
        if (workError) {
          :`, {
            message: workError.message,
            details: workError.details,
            hint: workError.hint, 
            code: workError.code,
            fullError: workError
          })
          continue
        }
        
        
        
        if (!workReports || workReports.length === 0) {
          
          continue
        }
        
        // 作業報告データを月別にグループ化
        const workByMonth: { [key: string]: any[] } = {}
        
        workReports.forEach(record => {
          const monthKey = format(new Date(record.work_date), 'yyyy-MM')
          if (!workByMonth[monthKey]) workByMonth[monthKey] = []
          workByMonth[monthKey].push(record)
        })
        
        // 月別にデータを集約してHarvestSoilDataを作成
        for (let i = 0; i < displayPeriod * 12; i++) {
          const currentMonth = addMonths(startMonth, i)
          const monthKey = format(currentMonth, 'yyyy-MM')
          
          const monthWorkReports = workByMonth[monthKey] || []
          
          // データがない月はスキップ（要件通り）
          if (monthWorkReports.length === 0) {
            continue
          }
          
          // 収穫データを集計
          const harvestReports = monthWorkReports.filter(r => r.harvest_amount && r.harvest_amount > 0)
          const totalHarvestQuantity = harvestReports.reduce((sum, record) => sum + (record.harvest_amount || 0), 0)
          const totalHarvestValue = harvestReports.reduce((sum, record) => sum + (record.expected_revenue || record.income_total || 0), 0)
          const harvestUnit = harvestReports[0]?.harvest_unit || vegetable.unit
          
          // 土壌データを集計（平均値）
          const soilReports = monthWorkReports.filter(r => 
            r.soil_ph || r.soil_ec || r.cec || r.available_phosphorus
          )
          
          const avgSoilData = soilReports.length > 0 ? {
            pH: soilReports.reduce((sum, r) => sum + (r.soil_ph || 6.5), 0) / soilReports.length,
            EC: soilReports.reduce((sum, r) => sum + (r.soil_ec || 0.8), 0) / soilReports.length,
            CEC: soilReports.reduce((sum, r) => sum + (r.cec || 20.0), 0) / soilReports.length,
            phosphorus: soilReports.reduce((sum, r) => sum + (r.available_phosphorus || 50.0), 0) / soilReports.length,
            potassium: soilReports.reduce((sum, r) => sum + (r.exchangeable_potassium || 180.0), 0) / soilReports.length,
            nitrogen: soilReports.reduce((sum, r) => sum + ((r.ammonium_nitrogen || 0) + (r.nitrate_nitrogen || 0) || 125.0), 0) / soilReports.length,
            organic_matter: soilReports.reduce((sum, r) => sum + (r.humus_content || 3.0), 0) / soilReports.length,
            calcium: soilReports.reduce((sum, r) => sum + (r.exchangeable_calcium || 250.0), 0) / soilReports.length
          } : {
            // 土壌データがない場合はデフォルト値
            pH: 6.5, EC: 0.8, CEC: 20.0, phosphorus: 50.0, 
            potassium: 180.0, nitrogen: 125.0, organic_matter: 3.0, calcium: 250.0
          }
          
          // データがある月のみ追加
          if (totalHarvestQuantity > 0 || soilReports.length > 0) {
            allData.push({
              month: format(currentMonth, 'M月', { locale: ja }),
              year: currentMonth.getFullYear(),
              month_num: currentMonth.getMonth() + 1,
              vegetable: vegetable.name,
              vegetable_id: vegetable.id,
              harvest_quantity: totalHarvestQuantity,
              harvest_unit: harvestUnit,
              harvest_value: totalHarvestValue,
              soil_data: {
                pH: Math.round(avgSoilData.pH * 100) / 100,
                EC: Math.round(avgSoilData.EC * 1000) / 1000,
                CEC: Math.round(avgSoilData.CEC * 10) / 10,
                phosphorus: Math.round(avgSoilData.phosphorus * 10) / 10,
                potassium: Math.round(avgSoilData.potassium),
                nitrogen: Math.round(avgSoilData.nitrogen),
                organic_matter: Math.round(avgSoilData.organic_matter * 10) / 10,
                calcium: Math.round(avgSoilData.calcium)
              }
            })
          }
        }
      }
      
      
      return allData
      
    } catch (error) {
      
      return []
    }
  }, [companyId, startMonth, displayPeriod, currentVegetable, currentVegetableInfo, userVegetables])

  // Supabaseデータ取得実行
  React.useEffect(() => {
    if (userVegetables.length > 0 && companyId) {
      
      setLoading(true)
      
      fetchHarvestSoilData()
        .then(data => {
          setHarvestSoilData(data)
          setLastUpdated(new Date())
          
        })
        .catch(error => {
          
          setHarvestSoilData([])
        })
        .finally(() => {
          setLoading(false)
        })
    }
  }, [fetchHarvestSoilData, userVegetables, companyId])
  
  // ユーザー野菜データを取得（エラー時はデフォルトデータを使用）
  useEffect(() => {
    if (companyId) {
      
      fetchUserVegetables()
    } else {
      
      setUserVegetables(DEFAULT_VEGETABLE_OPTIONS)
    }
  }, [companyId, fetchUserVegetables])

  // 選択野菜でデータをフィルタリング
  const filteredData = useMemo(() => {
    if (!harvestSoilData || harvestSoilData.length === 0) {
      
      return []
    }
    
    if (currentVegetable === 'all') {
      // 全野菜の場合は月ごとに合計値を計算
      const monthlyTotals: { [key: string]: HarvestSoilData } = {}
      
      harvestSoilData.forEach(data => {
        const key = `${data.year}-${data.month_num}`
        if (!monthlyTotals[key]) {
          monthlyTotals[key] = {
            ...data,
            vegetable: 'すべて',
            vegetable_id: 'all',
            harvest_unit: 'kg',
            harvest_quantity: 0,
            harvest_value: 0
          }
        }
        monthlyTotals[key].harvest_quantity += data.harvest_quantity
        monthlyTotals[key].harvest_value += data.harvest_value
      })
      
      const result = Object.values(monthlyTotals).sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year
        return a.month_num - b.month_num
      })
      
      
      return result
    } else {
      const result = harvestSoilData.filter(data => data.vegetable_id === currentVegetable)
      
      return result
    }
  }, [harvestSoilData, currentVegetable])

  // チャートデータの準備（線グラフ対応）
  const chartData = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return null
    
    const monthLabels = filteredData.map(d => d.month)
    const harvestUnit = currentVegetable === 'all' ? 'kg' : currentVegetableInfo.unit
    
    const datasets = []
    
    // 収穫量（メイン棒グラフ）
    datasets.push({
      type: 'bar' as const,
      label: `🌾 収穫量 (${harvestUnit})`,
      data: filteredData.map(d => d.harvest_quantity),
      backgroundColor: `${currentVegetableInfo.color}80`,
      borderColor: currentVegetableInfo.color,
      borderWidth: 2,
      borderRadius: 4,
      borderSkipped: false,
      yAxisID: 'y'
    })
    
    // 土壌情報1（右軸1）- 線グラフ
    if (soilDisplayOptions.soil1) {
      const soil1Key = soilDisplayOptions.soil1 as keyof typeof SOIL_COMPONENT_COLORS
      datasets.push({
        type: 'line' as const,
        label: `${SOIL_COMPONENT_LABELS[soil1Key]} (${SOIL_COMPONENT_UNITS[soil1Key]})`,
        data: filteredData.map(d => d.soil_data[soil1Key as keyof typeof d.soil_data]),
        borderColor: SOIL_COMPONENT_COLORS[soil1Key],
        backgroundColor: `${SOIL_COMPONENT_COLORS[soil1Key]}20`,
        borderWidth: 3,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: SOIL_COMPONENT_COLORS[soil1Key],
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        fill: false,
        tension: 0.4,
        yAxisID: 'y1',
        borderDash: [5, 5]
      })
    }
    
    // 土壌情報2（右軸2）- 線グラフ
    if (soilDisplayOptions.soil2) {
      const soil2Key = soilDisplayOptions.soil2 as keyof typeof SOIL_COMPONENT_COLORS
      datasets.push({
        type: 'line' as const,
        label: `${SOIL_COMPONENT_LABELS[soil2Key]} (${SOIL_COMPONENT_UNITS[soil2Key]})`,
        data: filteredData.map(d => d.soil_data[soil2Key as keyof typeof d.soil_data]),
        borderColor: SOIL_COMPONENT_COLORS[soil2Key],
        backgroundColor: `${SOIL_COMPONENT_COLORS[soil2Key]}20`,
        borderWidth: 3,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: SOIL_COMPONENT_COLORS[soil2Key],
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        fill: false,
        tension: 0.4,
        yAxisID: 'y2',
        borderDash: [10, 5]
      })
    }

    return {
      labels: monthLabels,
      datasets
    }
  }, [filteredData, soilDisplayOptions, currentVegetableInfo, currentVegetable])

  // チャートオプション（混合チャート：Bar + Line）
  const chartOptions: ChartOptions<'bar'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        left: 10,
        right: soilDisplayOptions.soil1 && soilDisplayOptions.soil2 ? 80 : // 両軸時：80px（AI予測作業時間分析と同じ）
               soilDisplayOptions.soil1 || soilDisplayOptions.soil2 ? 50 : 10, // 単軸時：50px
        top: 10,
        bottom: 10
      }
    },
    interaction: {
      mode: 'index',
      intersect: false
    },
    onClick: (event: ChartEvent, elements: InteractionItem[]) => {
      if (elements.length > 0 && chartRef.current) {
        const elementIndex = elements[0].index
        const selectedData = harvestSoilData[elementIndex]
        if (selectedData) {
          setSelectedMonth(selectedData)
          setDrilldownOpen(true)
        }
      }
    },
    scales: {
      x: {
        type: 'category',
        grid: {
          display: false,
          drawBorder: true,
          drawOnChartArea: false
        },
        ticks: {
          color: '#1f2937',
          font: {
            size: 12,
            weight: '600'
          }
        },
        border: {
          display: true,
          color: '#e5e7eb',
          width: 1
        }
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        min: 0,
        grid: {
          color: '#e5e7eb',
          lineWidth: 1,
          drawTicks: false
        },
        border: {
          color: currentVegetableInfo.color,
          width: 2
        },
        ticks: {
          color: currentVegetableInfo.color,
          font: {
            size: 12,
            weight: '600'
          },
          callback: function(value) {
            return `${value}kg`
          }
        }
      },
      // 土壌情報1軸（右側1番目）- AI予測作業時間分析の気温軸と同じ設定
      ...(soilDisplayOptions.soil1 ? {
        y1: {
          type: 'linear' as const,
          display: true,
          position: 'right' as const,
          grid: {
            drawOnChartArea: false,
          },
          border: {
            color: soilDisplayOptions.soil1 ? SOIL_COMPONENT_COLORS[soilDisplayOptions.soil1 as keyof typeof SOIL_COMPONENT_COLORS] : '#f97316',
            width: 2
          },
          ticks: {
            color: soilDisplayOptions.soil1 ? SOIL_COMPONENT_COLORS[soilDisplayOptions.soil1 as keyof typeof SOIL_COMPONENT_COLORS] : '#f97316',
            font: {
              size: 11,
              weight: '600'
            },
            callback: function(value: any) {
              if (!soilDisplayOptions.soil1) return value
              const unit = SOIL_COMPONENT_UNITS[soilDisplayOptions.soil1 as keyof typeof SOIL_COMPONENT_UNITS]
              return unit ? `${value}${unit}` : value
            }
          }
        }
      } : {}),
      // 土壌情報2軸（右側2番目）- AI予測作業時間分析の湿度軸と同じ設定
      ...(soilDisplayOptions.soil2 ? {
        y2: {
          type: 'linear' as const,
          display: true,
          position: 'right' as const,
          grid: {
            drawOnChartArea: false,
          },
          border: {
            color: soilDisplayOptions.soil2 ? SOIL_COMPONENT_COLORS[soilDisplayOptions.soil2 as keyof typeof SOIL_COMPONENT_COLORS] : '#3b82f6',
            width: 2
          },
          ticks: {
            color: soilDisplayOptions.soil2 ? SOIL_COMPONENT_COLORS[soilDisplayOptions.soil2 as keyof typeof SOIL_COMPONENT_COLORS] : '#3b82f6',
            font: {
              size: 11,
              weight: '600'
            },
            callback: function(value: any) {
              if (!soilDisplayOptions.soil2) return value
              const unit = SOIL_COMPONENT_UNITS[soilDisplayOptions.soil2 as keyof typeof SOIL_COMPONENT_UNITS]
              return unit ? `${value}${unit}` : value
            }
          }
        }
      } : {})
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 15,
          font: {
            size: 11,
            weight: '500'
          }
        }
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
        callbacks: {
          title: (context) => {
            const dataIndex = context[0].dataIndex
            const data = harvestSoilData[dataIndex]
            return `${data.year}年${data.month}の収穫・土壌分析`
          },
          label: (context) => {
            const value = context.raw as number
            const datasetLabel = context.dataset.label || ''
            
            if (datasetLabel.includes('収穫量')) {
              return `${datasetLabel}: ${value.toFixed(1)}kg`
            } else if (datasetLabel.includes('pH')) {
              return `${datasetLabel}: ${value.toFixed(1)}`
            } else {
              return `${datasetLabel}: ${value.toFixed(2)}`
            }
          },
          afterBody: (context) => {
            const dataIndex = context[0].dataIndex
            const data = harvestSoilData[dataIndex]
            return [
              '',
              `収穫金額: ¥${data.harvest_value.toLocaleString()}`,
              `土壌pH: ${data.soil_data.pH}`,
              `土壌EC: ${data.soil_data.EC} mS/cm`,
              '',
              'クリックで詳細分析を表示'
            ]
          }
        }
      }
    },
    animation: {
      duration: 1000,
      easing: 'easeInOutQuart'
    }
  }), [harvestSoilData, soilDisplayOptions])

  // 年月選択ハンドラー
  const handleYearMonthChange = () => {
    const newDate = new Date(selectedYear, selectedMonthNum - 1, 1)
    setStartMonth(newDate)
    setYearMonthPickerOpen(false)
  }

  React.useEffect(() => {
    setSelectedYear(startMonth.getFullYear())
    setSelectedMonthNum(startMonth.getMonth() + 1)
  }, [startMonth])

  // 土壌情報選択の切り替え
  const toggleSoilDisplay = (soilType: 'soil1' | 'soil2', component: string | null) => {
    setSoilDisplayOptions(prev => ({
      ...prev,
      [soilType]: prev[soilType] === component ? null : component
    }))
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>🌾 収穫量×土壌データ比較分析</CardTitle>
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
        <CardHeader className="bg-gradient-to-r from-green-600 to-teal-600 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                <Sprout className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">
                  🌾 収穫量×土壌データ比較分析
                </CardTitle>
                <p className="text-green-100 text-sm">
                  Harvest Quantity & Soil Data Comparison Analysis
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-green-100 uppercase tracking-wider">AgriTech Pro</div>
              <div className="text-sm font-medium">土壌分析システム</div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          {/* フィルターコントロール */}
          <div className="mb-6 p-4 bg-gradient-to-r from-gray-50 to-green-50 rounded-lg border">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex items-center gap-3 flex-wrap">
                  {/* 野菜選択（プルダウン） */}
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700 whitespace-nowrap">🌱 野菜選択:</label>
                    <Select value={currentVegetable} onValueChange={setCurrentVegetable}>
                      <SelectTrigger className="w-[200px] h-8">
                        <SelectValue placeholder="野菜を選択してください" />
                      </SelectTrigger>
                      <SelectContent>
                        {userVegetables.map((vegetable) => (
                          <SelectItem key={vegetable.id} value={vegetable.id}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: vegetable.color }}
                              />
                              <span>{vegetable.name}</span>
                              {vegetable.id !== 'all' && (
                                <span className="text-xs text-gray-500">({vegetable.unit})</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* 表示期間選択 */}
                  <div className="flex items-center gap-1 bg-white rounded-lg p-1 shadow-sm">
                    {[1, 2].map((period) => (
                      <Button
                        key={period}
                        variant={displayPeriod === period ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setDisplayPeriod(period as 1 | 2)}
                        className={`px-3 h-7 text-xs ${
                          displayPeriod === period 
                            ? 'bg-green-600 text-white shadow-sm' 
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
                      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-teal-50">
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
                                      ? 'bg-green-600 text-white shadow-md scale-105' 
                                      : 'hover:bg-green-50 bg-white'
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
                                className={`text-xs ${selectedMonthNum === month ? 'bg-green-600 text-white' : 'hover:bg-green-50'}`}
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
              
              {/* 現在選択中の野菜情報表示 */}
              <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: currentVegetableInfo.color }}
                  />
                  <span className="font-medium text-gray-700">
                    {currentVegetableInfo.name} ({currentVegetableInfo.unit})
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  現在表示中の野菜・単位
                </span>
              </div>
              
              {/* 土壌情報選択UI（最大2つ） */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">🌡️ 表示する土壌情報</label>
                  <span className="text-xs text-gray-500">（最大2つまで、右軸に表示）</span>
                </div>
                
                {/* 土壌情報1選択 */}
                <div className="space-y-1">
                  <label className="text-xs text-gray-600">土壌情報1 (オレンジ軸)</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(SOIL_COMPONENT_LABELS).map(([component, label]) => (
                      <Button
                        key={`soil1-${component}`}
                        variant={soilDisplayOptions.soil1 === component ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleSoilDisplay('soil1', component)}
                        className={`text-xs h-6 ${
                          soilDisplayOptions.soil1 === component
                            ? 'text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                        style={{
                          backgroundColor: soilDisplayOptions.soil1 === component 
                            ? SOIL_COMPONENT_COLORS[component as keyof typeof SOIL_COMPONENT_COLORS]
                            : undefined,
                          borderColor: SOIL_COMPONENT_COLORS[component as keyof typeof SOIL_COMPONENT_COLORS]
                        }}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* 土壌情報2選択 */}
                <div className="space-y-1">
                  <label className="text-xs text-gray-600">土壌情報2 (ブルー軸)</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(SOIL_COMPONENT_LABELS).map(([component, label]) => (
                      <Button
                        key={`soil2-${component}`}
                        variant={soilDisplayOptions.soil2 === component ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleSoilDisplay('soil2', component)}
                        className={`text-xs h-6 ${
                          soilDisplayOptions.soil2 === component
                            ? 'text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                        style={{
                          backgroundColor: soilDisplayOptions.soil2 === component 
                            ? SOIL_COMPONENT_COLORS[component as keyof typeof SOIL_COMPONENT_COLORS]
                            : undefined,
                          borderColor: SOIL_COMPONENT_COLORS[component as keyof typeof SOIL_COMPONENT_COLORS]
                        }}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* グラフ */}
          <div className="h-[600px] relative">
            {chartData && (
              <Bar 
                ref={chartRef}
                data={chartData} 
                options={chartOptions}
                plugins={[multipleRightAxisPlugin]}
              />
            )}
          </div>
          
          <div className="mt-4 text-xs text-gray-500 text-center">
            💡 各月の棒をクリックすると詳細分析を表示できます ｜ 🌾 棒グラフ：収穫量（左軸） ｜ 🌱 線グラフ：土壌データ（右軸）
          </div>
        </CardContent>
      </Card>

      {/* 詳細分析ダイアログ */}
      <Dialog open={drilldownOpen} onOpenChange={setDrilldownOpen} modal={true}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          {selectedMonth && (
            <div className="space-y-6">
              {/* ヘッダー */}
              <div className="bg-gradient-to-r from-green-600 to-teal-600 -mx-6 -mt-6 mb-6 px-6 py-4 rounded-t-lg">
                <div className="flex items-center justify-between text-white">
                  <div className="flex items-center gap-3">
                    <Beaker className="w-8 h-8" />
                    <div>
                      <h2 className="text-2xl font-bold">
                        {selectedMonth.year}年{selectedMonth.month}
                      </h2>
                      <p className="text-green-100">収穫量×土壌データ詳細分析レポート</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-green-100 uppercase tracking-wider">AgriTech Pro</div>
                    <div className="text-lg font-semibold">収穫・土壌分析システム</div>
                  </div>
                </div>
              </div>
              
              {/* サマリー */}
              <div className="grid grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                  <CardContent className="p-4 text-center">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Target className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="text-2xl font-bold text-green-700">{selectedMonth.harvest_quantity}kg</div>
                    <div className="text-sm text-gray-600">収穫量</div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
                  <CardContent className="p-4 text-center">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <TrendingUp className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="text-2xl font-bold text-purple-700">¥{selectedMonth.harvest_value.toLocaleString()}</div>
                    <div className="text-sm text-gray-600">収穫金額</div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
                  <CardContent className="p-4 text-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Activity className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="text-2xl font-bold text-blue-700">{selectedMonth.soil_data.pH}</div>
                    <div className="text-sm text-gray-600">土壌pH</div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200">
                  <CardContent className="p-4 text-center">
                    <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Zap className="w-6 h-6 text-amber-600" />
                    </div>
                    <div className="text-2xl font-bold text-amber-700">{selectedMonth.soil_data.EC} mS/cm</div>
                    <div className="text-sm text-gray-600">土壌EC</div>
                  </CardContent>
                </Card>
              </div>

              {/* 土壌成分詳細 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Beaker className="w-5 h-5" />
                    土壌成分詳細分析
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(selectedMonth.soil_data).map(([component, value]) => {
                      const label = SOIL_COMPONENT_LABELS[component as keyof typeof SOIL_COMPONENT_LABELS] || component
                      const unit = SOIL_COMPONENT_UNITS[component as keyof typeof SOIL_COMPONENT_UNITS] || ''
                      const displayValue = typeof value === 'number' ? value.toFixed(component === 'pH' ? 1 : 2) : value
                      
                      return (
                        <div key={component} className="p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-sm">{label}</h4>
                            <Badge className="text-xs bg-green-100 text-green-700">
                              正常
                            </Badge>
                          </div>
                          <div className="text-lg font-bold text-gray-800">
                            {displayValue} {unit}
                          </div>
                          <div className="text-xs text-gray-500">
                            測定値
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* 圃場比較 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    圃場別パフォーマンス比較
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-gray-800 flex items-center gap-2">
                          <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded text-center text-sm leading-6">
                            1
                          </span>
                          メイン圃場
                        </h4>
                        <Badge className="bg-green-100 text-green-700">
                          収穫良好
                        </Badge>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-gray-600">収穫量</div>
                          <div className="font-bold">{selectedMonth.harvest_quantity}kg</div>
                        </div>
                        <div>
                          <div className="text-gray-600">収穫金額</div>
                          <div className="font-bold">¥{selectedMonth.harvest_value.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-gray-600">pH</div>
                          <div className="font-bold">{selectedMonth.soil_data.pH}</div>
                        </div>
                        <div>
                          <div className="text-gray-600">EC</div>
                          <div className="font-bold">{selectedMonth.soil_data.EC} mS/cm</div>
                        </div>
                      </div>
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