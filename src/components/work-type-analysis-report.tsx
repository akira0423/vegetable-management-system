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
    const year = new Date().getFullYear()
    return `${year}-01-01`
  })
  const [endDate, setEndDate] = useState(() => {
    const year = new Date().getFullYear()
    return `${year}-12-31`
  })
  const [sortBy, setSortBy] = useState('totalRevenue')
  const [sortOrder, setSortOrder] = useState('desc')
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [expandedVegetables, setExpandedVegetables] = useState<Set<string>>(new Set())


  // データ集計の実行
  useEffect(() => {
    if (companyId) {
      fetchWorkAnalysisData()
    }
  }, [companyId, selectedVegetable, startDate, endDate])

  const fetchWorkAnalysisData = async () => {
    try {
      setLoading(true)
      
      // 作業レポート、野菜データ、会計データを取得
      const [reportsResponse, vegetablesResponse] = await Promise.all([
        fetch(`/api/reports?company_id=${companyId}&start_date=${startDate}&end_date=${endDate}&limit=1000`),
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
        period: `${startDate} ~ ${endDate}`
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
        unitCostPerVegetable: 0
      })
    })

    // 作業データの集計
    const workAnalysisMap = new Map<string, any>()

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
      existing.totalHours += (report.duration_hours || 0) * (report.worker_count || 1)
      
      // 収穫量の集計（収穫作業の場合）
      if (report.work_type === 'harvesting' && report.harvest_amount) {
        existing.harvestAmount += report.harvest_amount
      }
      
      // 会計データから実際のコストと収入を計算
      if (report.work_report_accounting && report.work_report_accounting.length > 0) {
        report.work_report_accounting.forEach((accounting: any) => {
          const accountingType = accounting.accounting_items?.type
          const amount = accounting.amount || 0
          
          console.log('📊 会計データ:', {
            work_type: report.work_type,
            vegetable: existing.vegetableName,
            accounting_type: accountingType,
            amount: amount
          })
          
          if (accountingType === 'expense') {
            existing.totalCost += amount
          } else if (accountingType === 'income' || accountingType === 'revenue') {
            existing.totalRevenue += amount
          }
        })
      } else {
        // フォールバック: 収穫作業の場合は特別計算（月次キャッシュフローと同じロジック）
        if (report.work_type === 'harvesting') {
          const harvestRevenue = (report.harvest_amount || 0) * (report.expected_price || 0)
          const expectedRevenue = report.expected_revenue || 0
          const calculatedRevenue = Math.max(harvestRevenue, expectedRevenue)
          existing.totalRevenue += calculatedRevenue
          console.log('🌾 収穫作業フォールバック:', {
            vegetable: existing.vegetableName,
            harvest_amount: report.harvest_amount,
            expected_price: report.expected_price,
            harvest_revenue: harvestRevenue,
            expected_revenue: expectedRevenue,
            calculated_revenue: calculatedRevenue
          })
        } else {
          // 収穫以外の作業はexpected_revenueを使用
          const expectedRevenue = report.expected_revenue || 0
          existing.totalRevenue += expectedRevenue
          console.log('🔧 その他作業フォールバック:', {
            vegetable: existing.vegetableName,
            work_type: report.work_type,
            expected_revenue: expectedRevenue
          })
        }
        // コストは作業時間ベースで推定
        const estimatedCost = existing.totalHours * 1000 // 時給1000円と仮定
        existing.totalCost += estimatedCost
      }

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
                  🌱 作業種類別統合パフォーマンスレポート
                </CardTitle>
                <p className="text-green-100 text-sm">Agricultural Performance Intelligence Report</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-green-100 uppercase tracking-wider">AgriFinance Pro</div>
              <div className="text-sm font-medium">統合分析システム</div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          {/* フィルターコントロール */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  集計期間設定
                </label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-40"
                  />
                  <span className="text-gray-500">～</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-40"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  <Filter className="w-4 h-4" />
                  ソート設定
                </label>
                <div className="flex gap-2">
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="totalRevenue">総収入</SelectItem>
                      <SelectItem value="totalCost">総支出</SelectItem>
                      <SelectItem value="count">実施回数</SelectItem>
                      <SelectItem value="totalHours">総作業時間</SelectItem>
                      <SelectItem value="plotSize">栟培面積</SelectItem>
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
              </div>
              <Button onClick={fetchWorkAnalysisData} className="bg-green-600 hover:bg-green-700">
                <RefreshCw className="w-4 h-4 mr-2" />
                更新
              </Button>
            </div>
            <div className="mt-3 text-xs text-gray-500">
              最終更新: {lastUpdated.toLocaleString('ja-JP')}
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
                            <span className="text-gray-500">総作業:</span>
                            <span className="font-semibold ml-1">{vegetableTotalCount}回</span>
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
          
          {/* 展開コントロール */}
          {data.length > 0 && (
            <div className="mt-4 flex justify-center gap-3">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setExpandedVegetables(new Set(data.map(d => d.vegetableId)))}
              >
                <Eye className="w-4 h-4 mr-2" />
                すべて展開
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setExpandedVegetables(new Set())}
              >
                <Eye className="w-4 h-4 mr-2" />
                すべて折りたたみ
              </Button>
            </div>
          )}

          {/* エクスポート機能 */}
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              印刷プレビュー
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              CSVエクスポート
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}