'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Calendar,
  BarChart3,
  Filter,
  Download,
  RefreshCw,
  Eye,
  Leaf
} from 'lucide-react'

interface WorkTypeAnalysisProps {
  companyId: string
  selectedVegetable: string
}

interface WorkAnalysisData {
  vegetableId: string
  vegetableName: string
  varietyName: string
  plotSize: number
  workType: string
  workTypeName: string
  count: number
  totalHours: number
  totalCost: number
  costPerSqm: number
  totalRevenue: number
  revenuePerSqm: number
  harvestAmount: number
  costPerUnit: number
}

interface GroupedVegetableData {
  vegetableId: string
  vegetableName: string
  varietyName: string
  plotSize: number
  harvestUnit: string // 収穫単位
  works: WorkAnalysisData[]
  totalHarvestAmount: number
  unitCostPerVegetable: number
  actualReportCount?: number // 実際のレポート件数
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

export default function WorkTypeAnalysisReport({ companyId, selectedVegetable }: WorkTypeAnalysisProps) {
  const [data, setData] = useState<GroupedVegetableData[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(() => {
    // 直近12カ月（総支出計算と同じ期間）
    const endDate = new Date()
    const startDate = new Date()
    startDate.setFullYear(startDate.getFullYear() - 1)
    return startDate.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => {
    // 現在日付
    return new Date().toISOString().split('T')[0]
  })
  // 一時的な日付選択用（確定前）
  const [tempStartDate, setTempStartDate] = useState(() => {
    // 直近12カ月（総支出計算と同じ期間）
    const endDate = new Date()
    const startDate = new Date()
    startDate.setFullYear(startDate.getFullYear() - 1)
    return startDate.toISOString().split('T')[0]
  })
  const [tempEndDate, setTempEndDate] = useState(() => {
    // 現在日付
    return new Date().toISOString().split('T')[0]
  })
  const [sortBy, setSortBy] = useState('totalRevenue')
  const [sortOrder, setSortOrder] = useState('desc')
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [expandedVegetables, setExpandedVegetables] = useState<Set<string>>(new Set())

  // CSV エクスポート機能
  const handleExportCSV = () => {
    if (!data || data.length === 0) {
      alert('エクスポートするデータがありません')
      return
    }

    // BOMを追加してExcelでの文字化けを防ぐ
    const BOM = '\uFEFF'

    // CSVヘッダー
    const headers = [
      '野菜名',
      '品種',
      '作業種別',
      '作業回数',
      '総作業時間(h)',
      '総コスト(円)',
      'コスト/㎡',
      '総収益(円)',
      '収益/㎡',
      '収穫量',
      '単位原価'
    ]

    // データを行に変換
    const rows: string[][] = []
    data.forEach(vegData => {
      vegData.works.forEach(work => {
        rows.push([
          vegData.vegetableName,
          vegData.varietyName || '',
          work.workTypeName,
          work.count.toString(),
          work.totalHours.toFixed(1),
          Math.round(work.totalCost).toString(),
          Math.round(work.costPerSqm).toString(),
          Math.round(work.totalRevenue).toString(),
          Math.round(work.revenuePerSqm).toString(),
          work.harvestAmount ? work.harvestAmount.toFixed(1) : '0',
          work.costPerUnit ? Math.round(work.costPerUnit).toString() : '0'
        ])
      })
    })

    // CSV文字列を作成
    const csvContent = BOM + [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    // ダウンロード処理
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `作業別収支分析_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // データ集計の実行（startDate, endDateを除外）
  useEffect(() => {
    if (companyId) {
      fetchWorkAnalysisData()
    }
  }, [companyId, selectedVegetable])

  // 日付を適用してデータを更新
  const applyDateFilter = () => {
    setStartDate(tempStartDate)
    setEndDate(tempEndDate)
    fetchWorkAnalysisData(tempStartDate, tempEndDate)
  }

  const fetchWorkAnalysisData = async (dateStart?: string, dateEnd?: string) => {
    try {
      setLoading(true)

      // 引数が指定されていない場合は現在のstateの値を使用
      const startDateToUse = dateStart || startDate
      const endDateToUse = dateEnd || endDate

      // 作業レポート、野菜データ、会計データを取得
      const [reportsResponse, vegetablesResponse] = await Promise.all([
        fetch(`/api/reports?company_id=${companyId}&start_date=${startDateToUse}&end_date=${endDateToUse}&active_only=true&limit=999999`),  // active_onlyを追加して統一
        fetch(`/api/vegetables?company_id=${companyId}&limit=100`)
      ])

      let workReports = []
      let vegetables = []

      if (reportsResponse.ok) {
        const reportsResult = await reportsResponse.json()
        if (reportsResult.success) {
          workReports = reportsResult.data
        }
      }

      if (vegetablesResponse.ok) {
        const vegetablesResult = await vegetablesResponse.json()
        if (vegetablesResult.success) {
          vegetables = vegetablesResult.data
        }
      }

      // フィルタリング
      if (selectedVegetable !== 'all') {
        workReports = workReports.filter((report: any) => report.vegetable_id === selectedVegetable)
        vegetables = vegetables.filter((veg: any) => veg.id === selectedVegetable)
      }

      // データ集計処理（グループ化）
      console.log('📈 作業レポートデータ:', {
        total_reports: workReports.length,
        with_accounting: workReports.filter(r => r.work_report_accounting?.length > 0).length,
        vegetables_count: vegetables.length,
        period: `${startDateToUse} ~ ${endDateToUse}`
      })
      
      const analysisData = generateGroupedWorkAnalysisData(workReports, vegetables)
      
      console.log('📊 生成された分析データ:', {
        vegetables_with_works: analysisData.length,
        total_works: analysisData.flatMap(v => v.works).length,
        total_revenue: analysisData.flatMap(v => v.works).reduce((sum, w) => sum + w.totalRevenue, 0),
        total_cost: analysisData.flatMap(v => v.works).reduce((sum, w) => sum + w.totalCost, 0)
      })
      
      setData(analysisData)
      setLastUpdated(new Date())
      
      // 全ての野菜をデフォルトで展開状態にする
      const allVegetableIds = analysisData.map(v => v.vegetableId)
      setExpandedVegetables(new Set(allVegetableIds))
      
    } catch (error) {
      console.error('作業分析データの取得エラー:', error)
      setData([])
    } finally {
      setLoading(false)
    }
  }

  const generateGroupedWorkAnalysisData = (reports: any[], vegetables: any[]): GroupedVegetableData[] => {
    const vegetableMap = new Map<string, GroupedVegetableData>()

    // 各野菜の初期化
    vegetables.forEach(vegetable => {
      vegetableMap.set(vegetable.id, {
        vegetableId: vegetable.id,
        vegetableName: vegetable.name?.split('（')[0] || vegetable.name,
        varietyName: vegetable.variety_name || vegetable.name?.match(/（(.+?)）/)?.[1] || '',
        plotSize: vegetable.area_size || 100, // area_size を使用、なければデフォルト100
        harvestUnit: vegetable.harvest_unit || '個', // 収穫単位、デフォルトは「個」
        works: [],
        totalHarvestAmount: 0,
        unitCostPerVegetable: 0,
        actualReportCount: 0  // 実際のレポート件数を追加
      })
    })

    // 作業データの集計
    const workAnalysisMap = new Map<string, any>()

    // 各野菜の実際のレポート件数をカウント
    reports.forEach(report => {
      const vegetableData = vegetableMap.get(report.vegetable_id)
      if (vegetableData) {
        vegetableData.actualReportCount++
      }
    })

    reports.forEach(report => {
      const vegetable = vegetables.find(v => v.id === report.vegetable_id)
      if (!vegetable) return

      const key = `${report.vegetable_id}_${report.work_type}`
      const existing = workAnalysisMap.get(key) || {
        vegetableId: report.vegetable_id,
        vegetableName: vegetable.name?.split('（')[0] || vegetable.name,
        varietyName: vegetable.variety_name || vegetable.name?.match(/（(.+?)）/)?.[1] || '',
        plotSize: vegetable.area_size || 100,
        workType: report.work_type,
        workTypeName: WORK_TYPE_LABELS[report.work_type] || report.work_type,
        count: 0,
        totalHours: 0,
        totalCost: 0,
        totalRevenue: 0,
        harvestAmount: 0,
        costPerUnit: 0
      }

      existing.count += 1
      // work_durationを優先、なければduration_hoursを使用（データ分析ページと同じロジック）
      const minutes = report.work_duration || (report.duration_hours ? report.duration_hours * 60 : 0)
      existing.totalHours += (minutes / 60) * (report.worker_count || 1)
      
      // 収穫量の集計（収穫作業の場合）
      if (report.work_type === 'harvesting' && report.harvest_amount) {
        existing.harvestAmount += report.harvest_amount
      }
      
      // 会計データから実際のコストと収入を計算
      if (report.work_report_accounting && report.work_report_accounting.length > 0) {
        report.work_report_accounting.forEach((accounting: any) => {
          // cost_typeフィールドを使用（APIが返す正しいフィールド）
          const costType = accounting.accounting_items?.cost_type
          const amount = accounting.amount || 0

          console.log('📊 会計データ:', {
            work_type: report.work_type,
            vegetable: existing.vegetableName,
            cost_type: costType,
            amount: amount
          })

          // cost_typeに基づいて収入・支出を判定
          if (costType === 'variable_cost' || costType === 'fixed_cost') {
            existing.totalCost += amount
          } else if (costType === 'income') {
            existing.totalRevenue += amount
          }
        })
      }
      // 会計データがない場合は何も追加しない（推定計算は行わない）

      workAnalysisMap.set(key, existing)
    })

    // 作業データを野菜にグループ化
    Array.from(workAnalysisMap.values()).forEach(workData => {
      const vegetableData = vegetableMap.get(workData.vegetableId)
      if (vegetableData) {
        const costPerSqm = workData.totalCost / workData.plotSize
        const revenuePerSqm = workData.totalRevenue / workData.plotSize
        
        // 収穫量がある場合の単位当たりコスト計算
        const costPerUnit = workData.harvestAmount > 0 ? workData.totalCost / workData.harvestAmount : 0

        vegetableData.works.push({
          ...workData,
          costPerSqm,
          revenuePerSqm,
          costPerUnit
        })
        
        // 野菜全体の収穫量を累計
        vegetableData.totalHarvestAmount += workData.harvestAmount
      }
    })
    
    // 野菜全体の単位当たりコスト計算
    vegetableMap.forEach(vegetableData => {
      const totalCost = vegetableData.works.reduce((sum, w) => sum + w.totalCost, 0)
      vegetableData.unitCostPerVegetable = vegetableData.totalHarvestAmount > 0 
        ? totalCost / vegetableData.totalHarvestAmount 
        : 0
    })

    // 作業がある野菜のみ返す
    return Array.from(vegetableMap.values()).filter(v => v.works.length > 0)
  }

  // 野菜の展開/折りたたみ制御
  const toggleVegetableExpansion = (vegetableId: string) => {
    const newExpanded = new Set(expandedVegetables)
    if (newExpanded.has(vegetableId)) {
      newExpanded.delete(vegetableId)
    } else {
      newExpanded.add(vegetableId)
    }
    setExpandedVegetables(newExpanded)
  }

  // ソート処理（野菜レベル）
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      let aValue: number, bValue: number
      
      switch (sortBy) {
        case 'totalRevenue':
          aValue = a.works.reduce((sum, w) => sum + w.totalRevenue, 0)
          bValue = b.works.reduce((sum, w) => sum + w.totalRevenue, 0)
          break
        case 'totalCost':
          aValue = a.works.reduce((sum, w) => sum + w.totalCost, 0)
          bValue = b.works.reduce((sum, w) => sum + w.totalCost, 0)
          break
        case 'count':
          aValue = a.works.reduce((sum, w) => sum + w.count, 0)
          bValue = b.works.reduce((sum, w) => sum + w.count, 0)
          break
        case 'totalHours':
          aValue = a.works.reduce((sum, w) => sum + w.totalHours, 0)
          bValue = b.works.reduce((sum, w) => sum + w.totalHours, 0)
          break
        default:
          aValue = a.plotSize
          bValue = b.plotSize
      }
      
      return sortOrder === 'desc' ? bValue - aValue : aValue - bValue
    })
  }, [data, sortBy, sortOrder])


  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', { 
      style: 'currency', 
      currency: 'JPY',
      minimumFractionDigits: 0 
    }).format(amount)
  }

  const getWorkTypeIcon = (workType: string) => {
    const icons = {
      seeding: '🌱',
      planting: '🌿', 
      fertilizing: '🍃',
      watering: '💧',
      weeding: '✂️',
      pruning: '🌿',
      harvesting: '🌾',
      other: '🛠️'
    }
    return icons[workType as keyof typeof icons] || icons.other
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            作業分析データを生成中...
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">

      {/* 統合レポートメイン */}
      <Card className="border-2 border-green-100 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">
                  🌱 作業別収支分析レポート
                </CardTitle>
                <p className="text-green-100 text-sm">Work Type Performance Report</p>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          {/* フィルターコントロール */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
            <div className="space-y-3">
              {/* ラベル行 - 集計期間設定のみ */}
              <div className="flex items-center mb-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  集計期間設定
                </label>
              </div>

              {/* コントロール行 - すべてのボタンとプルダウンを一行に */}
              <div className="flex flex-wrap gap-2 items-center">
                {/* 期間設定 */}
                <Input
                  type="date"
                  value={tempStartDate}
                  onChange={(e) => setTempStartDate(e.target.value)}
                  className="w-40"
                />
                <span className="text-gray-500">～</span>
                <Input
                  type="date"
                  value={tempEndDate}
                  onChange={(e) => setTempEndDate(e.target.value)}
                  className="w-40"
                />
                <Button
                  onClick={applyDateFilter}
                  size="sm"
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium shadow-sm hover:shadow-md transition-all duration-200 border border-green-700/20"
                >
                  <Calendar className="w-3 h-3 mr-1" />
                  適用
                </Button>

                {/* 区切り線 */}
                <div className="hidden lg:block w-px h-8 bg-gray-300 mx-2" />

                {/* 展開コントロール */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setExpandedVegetables(new Set(data.map(d => d.vegetableId)))}
                  className="bg-gradient-to-r from-emerald-50 to-green-50 hover:from-emerald-100 hover:to-green-100 border-emerald-300 text-emerald-700 font-medium shadow-sm hover:shadow-md transition-all duration-200 flex items-center"
                >
                  <span className="text-base mr-1">🌱</span>
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                  すべて展開
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setExpandedVegetables(new Set())}
                  className="bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 border-amber-300 text-amber-700 font-medium shadow-sm hover:shadow-md transition-all duration-200 flex items-center"
                >
                  <span className="text-base mr-1">📊</span>
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                  コンパクト表示
                </Button>

                {/* 区切り線 */}
                <div className="hidden lg:block w-px h-8 bg-gray-300 mx-2" />

                {/* ソートプルダウン */}
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="totalRevenue">総収入</SelectItem>
                    <SelectItem value="totalCost">総支出</SelectItem>
                    <SelectItem value="count">実施回数</SelectItem>
                    <SelectItem value="totalHours">総作業時間</SelectItem>
                    <SelectItem value="plotSize">栽培面積</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortOrder} onValueChange={setSortOrder}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">降順</SelectItem>
                    <SelectItem value="asc">昇順</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 最終更新時刻 */}
              <div className="text-xs text-gray-500 mt-3">
                最終更新: {lastUpdated.toLocaleString('ja-JP')}
              </div>
            </div>
          </div>


          {/* グループ階層表示 */}
          <div className="space-y-4">
            {sortedData.map((vegetableData) => {
              const isExpanded = expandedVegetables.has(vegetableData.vegetableId)
              const vegetableTotalCost = vegetableData.works.reduce((sum, w) => sum + w.totalCost, 0)
              const vegetableTotalRevenue = vegetableData.works.reduce((sum, w) => sum + w.totalRevenue, 0)
              const vegetableTotalHours = vegetableData.works.reduce((sum, w) => sum + w.totalHours, 0)
              const vegetableTotalCount = vegetableData.works.reduce((sum, w) => sum + w.count, 0)
              
              return (
                <div key={vegetableData.vegetableId} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* 野菜ヘッダー */}
                  <div 
                    className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-200 p-4 cursor-pointer hover:from-green-100 hover:to-emerald-100 transition-colors"
                    onClick={() => toggleVegetableExpansion(vegetableData.vegetableId)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-lg">
                          {isExpanded ? '▼' : '▶'}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">🍅</span>
                          <div>
                            <h3 className="font-bold text-lg text-gray-800">
                              {vegetableData.vegetableName}
                              {vegetableData.varietyName && (
                                <span className="text-sm font-normal text-gray-600 ml-1">
                                  ({vegetableData.varietyName})
                                </span>
                              )}
                            </h3>
                            <p className="text-sm text-gray-600">
                              🌿 {vegetableData.plotSize}㎡ | 🔄 {vegetableData.works.length}種類の作業
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">登録件数:</span>
                            <span className="font-semibold ml-1" title="この野菜の全作業記録数">{vegetableData.actualReportCount || 0}件</span>
                          </div>
                          <div>
                            <span className="text-gray-500">総時間:</span>
                            <span className="font-semibold ml-1">{vegetableTotalHours.toFixed(1)}h</span>
                          </div>
                          <div>
                            <span className="text-red-600">支出:</span>
                            <span className="font-bold ml-1">{formatCurrency(vegetableTotalCost)}</span>
                          </div>
                          <div>
                            <span className="text-green-600">収入:</span>
                            <span className="font-bold ml-1">{formatCurrency(vegetableTotalRevenue)}</span>
                          </div>
                          <div>
                            <span className="text-blue-600">原価コスト:</span>
                            <span className="font-bold ml-1">
                              {vegetableData.totalHarvestAmount > 0 
                                ? `${formatCurrency(vegetableData.unitCostPerVegetable)}/${vegetableData.harvestUnit}`
                                : '--'
                              }
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          クリックで詳細を{isExpanded ? '非表示' : '表示'}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* 作業詳細テーブル */}
                  {isExpanded && (
                    <div className="bg-white">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 border-b">
                              <th className="text-left p-3 font-medium text-gray-600">作業種類</th>
                              <th className="text-center p-3 font-medium text-gray-600">回数</th>
                              <th className="text-center p-3 font-medium text-gray-600">時間</th>
                              <th className="text-right p-3 font-medium text-gray-600">支出</th>
                              <th className="text-right p-3 font-medium text-gray-600">㎡単価</th>
                              <th className="text-right p-3 font-medium text-gray-600">収入</th>
                              <th className="text-right p-3 font-medium text-gray-600">㎡単価</th>
                              <th className="text-right p-3 font-medium text-gray-600">原価コスト</th>
                            </tr>
                          </thead>
                          <tbody>
                            {vegetableData.works.map((work, workIndex) => (
                              <tr key={workIndex} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                <td className="p-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">{getWorkTypeIcon(work.workType)}</span>
                                    <span className="font-medium text-gray-800">{work.workTypeName}</span>
                                  </div>
                                </td>
                                <td className="text-center p-3 font-mono text-gray-700">{work.count}回</td>
                                <td className="text-center p-3 font-mono text-gray-700">{work.totalHours.toFixed(1)}h</td>
                                <td className="text-right p-3 font-mono text-red-700 font-semibold">
                                  {formatCurrency(work.totalCost)}
                                </td>
                                <td className="text-right p-3 font-mono text-red-600 text-xs">
                                  {formatCurrency(work.costPerSqm)}/㎡
                                </td>
                                <td className="text-right p-3 font-mono text-green-700 font-semibold">
                                  {formatCurrency(work.totalRevenue)}
                                </td>
                                <td className="text-right p-3 font-mono text-green-600 text-xs">
                                  {formatCurrency(work.revenuePerSqm)}/㎡
                                </td>
                                <td className="text-right p-3 font-mono text-blue-700 text-xs font-semibold">
                                  {work.harvestAmount > 0 
                                    ? `${formatCurrency(work.costPerUnit)}/${vegetableData.harvestUnit}`
                                    : '--'
                                  }
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {data.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Leaf className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>指定期間内にデータがありません</p>
              <p className="text-sm">期間を調整するか、作業記録を追加してください</p>
            </div>
          )}

          {/* エクスポート機能 */}
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              印刷プレビュー
            </Button>
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={handleExportCSV}
            >
              <Download className="w-4 h-4" />
              CSVエクスポート
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}