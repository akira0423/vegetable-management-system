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
  harvestUnit: string
  works: WorkAnalysisData[]
  totalHarvestAmount: number
  unitCostPerVegetable: number
  actualReportCount?: number
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

// デモ用のサンプルデータ生成関数
function generateDemoWorkAnalysisData(selectedVegetables?: string[]): GroupedVegetableData[] {
  const allVegetables = [
    { id: 'tomato', name: 'トマト', variety: '桃太郎', size: 120, unit: 'kg' },
    { id: 'cucumber', name: 'きゅうり', variety: '夏すずみ', size: 80, unit: 'kg' },
    { id: 'lettuce', name: 'レタス', variety: 'サニーレタス', size: 100, unit: '個' },
    { id: 'spinach', name: 'ほうれんそう', variety: '強力オーライ', size: 60, unit: 'kg' },
    { id: 'carrot', name: 'にんじん', variety: '五寸人参', size: 40, unit: 'kg' }
  ]

  // 選択された野菜でフィルタリング
  const vegetables = selectedVegetables && selectedVegetables.length > 0
    ? allVegetables.filter(v => selectedVegetables.includes(v.id))
    : allVegetables

  const workTypes = Object.keys(WORK_TYPE_LABELS)

  return vegetables.map(veg => {
    const works: WorkAnalysisData[] = []
    let totalHarvest = 0

    // 各野菜に対してランダムな作業データを生成
    workTypes.forEach(workType => {
      // すべての野菜にすべての作業があるわけではない
      if (Math.random() > 0.3) {
        const count = Math.floor(Math.random() * 20) + 1
        const totalHours = Math.round((Math.random() * 50 + 10) * 10) / 10
        const totalCost = Math.floor(Math.random() * 100000) + 10000
        const totalRevenue = workType === 'harvesting' ? Math.floor(Math.random() * 300000) + 100000 : 0
        const harvestAmount = workType === 'harvesting' ? Math.floor(Math.random() * 500) + 100 : 0

        totalHarvest += harvestAmount

        works.push({
          vegetableId: veg.id,
          vegetableName: veg.name,
          varietyName: veg.variety,
          plotSize: veg.size,
          workType: workType,
          workTypeName: WORK_TYPE_LABELS[workType as keyof typeof WORK_TYPE_LABELS],
          count: count,
          totalHours: totalHours,
          totalCost: totalCost,
          costPerSqm: Math.round(totalCost / veg.size),
          totalRevenue: totalRevenue,
          revenuePerSqm: Math.round(totalRevenue / veg.size),
          harvestAmount: harvestAmount,
          costPerUnit: harvestAmount > 0 ? Math.round(totalCost / harvestAmount) : 0
        })
      }
    })

    const totalCost = works.reduce((sum, w) => sum + w.totalCost, 0)

    return {
      vegetableId: veg.id,
      vegetableName: veg.name,
      varietyName: veg.variety,
      plotSize: veg.size,
      harvestUnit: veg.unit,
      works: works,
      totalHarvestAmount: totalHarvest,
      unitCostPerVegetable: totalHarvest > 0 ? Math.round(totalCost / totalHarvest) : 0,
      actualReportCount: works.reduce((sum, w) => sum + w.count, 0)
    }
  })
}

interface WorkTypeAnalysisReportDemoProps {
  selectedVegetables?: string[]
}

export default function WorkTypeAnalysisReportDemo({ selectedVegetables }: WorkTypeAnalysisReportDemoProps) {
  const [data, setData] = useState<GroupedVegetableData[]>([])
  const [loading, setLoading] = useState(true)
  const [tempStartDate, setTempStartDate] = useState(() => {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setFullYear(startDate.getFullYear() - 1)
    return startDate.toISOString().split('T')[0]
  })
  const [tempEndDate, setTempEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [startDate, setStartDate] = useState(tempStartDate)
  const [endDate, setEndDate] = useState(tempEndDate)
  const [sortBy, setSortBy] = useState('totalRevenue')
  const [sortOrder, setSortOrder] = useState('desc')
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [expandedVegetables, setExpandedVegetables] = useState<Set<string>>(new Set())

  // 初期データロード
  useEffect(() => {
    fetchDemoData()
  }, [selectedVegetables])

  const fetchDemoData = () => {
    setLoading(true)
    // 疑似的な遅延を追加してローディング感を演出
    setTimeout(() => {
      const demoData = generateDemoWorkAnalysisData(selectedVegetables)
      setData(demoData)
      setLastUpdated(new Date())
      // 全ての野菜をデフォルトで展開
      setExpandedVegetables(new Set(demoData.map(v => v.vegetableId)))
      setLoading(false)
    }, 500)
  }

  // 日付を適用（デモなので実際には何もしない）
  const applyDateFilter = () => {
    setStartDate(tempStartDate)
    setEndDate(tempEndDate)
    fetchDemoData()
  }

  // CSVエクスポート機能（デモ版）
  const handleExportCSV = () => {
    alert('デモ版ではCSVエクスポート機能は利用できません')
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

  // ソート処理
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
            デモ用作業分析データを生成中...
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
                  🌱 作業別収支分析レポート（デモ版）
                </CardTitle>
                <p className="text-green-100 text-sm">Work Type Performance Report - Demo</p>
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
                  集計期間設定（デモ版では無効）
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
                  disabled
                />
                <span className="text-gray-500">～</span>
                <Input
                  type="date"
                  value={tempEndDate}
                  onChange={(e) => setTempEndDate(e.target.value)}
                  className="w-40"
                  disabled
                />
                <Button
                  onClick={applyDateFilter}
                  size="sm"
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium shadow-sm hover:shadow-md transition-all duration-200 border border-green-700/20"
                  disabled
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
                最終更新: {lastUpdated.toLocaleString('ja-JP')} （デモデータ）
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

          {/* エクスポート機能（デモ版では無効） */}
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" className="flex items-center gap-2" disabled>
              <Eye className="w-4 h-4" />
              印刷プレビュー（デモ版では無効）
            </Button>
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={handleExportCSV}
            >
              <Download className="w-4 h-4" />
              CSVエクスポート（デモ版では無効）
            </Button>
          </div>

          {/* デモ版の注意事項 */}
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-xs text-yellow-800">
              ※ これはデモ版です。表示されているデータはすべてサンプルデータです。実際の機能では、作業記録に基づいた実データが表示されます。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}