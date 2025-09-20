'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Filter,
  Calendar,
  Sprout,
  ChevronDown,
  ChevronUp,
  X,
  BarChart3,
  RotateCcw,
  Clock,
  CalendarRange,
  Check,
  Settings
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface SearchFilters {
  selectedVegetables: string[]
  workType: string
  period: string
  customPeriod?: {
    start: string
    end: string
  }
  showPlanned: boolean
  showCompleted: boolean
}

interface RecentPeriod {
  id: string
  label: string
  start: string
  end: string
  usedAt: string
}

interface CollapsibleSearchFilterProps {
  vegetables: any[]
  workReports: any[]
  tasks: any[]
  onFiltersChange: (filters: SearchFilters, filteredData: {
    filteredVegetables: any[]
    filteredTasks: any[]
    filteredReports: any[]
    resultSummary: string
    hasActiveFilters: boolean
  }) => void
  isExpanded: boolean
  onToggleExpanded: (expanded: boolean) => void
}

const workTypeOptions = [
  { value: 'all', label: '🌟 全作業', icon: '🌟' },
  { value: 'seeding', label: '🌱 播種・育苗', icon: '🌱' },
  { value: 'planting', label: '🪴 定植', icon: '🪴' },
  { value: 'fertilizing', label: '💊 施肥', icon: '💊' },
  { value: 'watering', label: '💧 灌水', icon: '💧' },
  { value: 'weeding', label: '🌿 除草', icon: '🌿' },
  { value: 'pruning', label: '✂️ 整枝・摘芽', icon: '✂️' },
  { value: 'harvesting', label: '🥬 収穫', icon: '🥬' },
  { value: 'other', label: '📝 その他', icon: '📝' }
]

const periodOptions = [
  { value: 'today', label: '今日', icon: '📅' },
  { value: 'week', label: '今週', icon: '📆' },
  { value: 'month', label: '今月', icon: '🗓️' },
  { value: 'year', label: '今年', icon: '📊' },
  { value: 'all', label: '全期間', icon: '♾️' },
  { value: 'custom', label: 'カスタム期間', icon: '⚙️' }
]

export function CollapsibleSearchFilter({
  vegetables,
  workReports,
  tasks,
  onFiltersChange,
  isExpanded,
  onToggleExpanded
}: CollapsibleSearchFilterProps) {
  // 初期値で全野菜を選択状態にする
  const [filters, setFilters] = useState<SearchFilters>({
    selectedVegetables: vegetables.map(v => v.id),
    workType: 'all',
    period: 'all',
    showPlanned: true,
    showCompleted: true
  })

  // カスタム期間用の状態
  const [showCustomPeriod, setShowCustomPeriod] = useState(false)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  // 最近使用した期間（LocalStorageから取得）
  const [recentPeriods, setRecentPeriods] = useState<RecentPeriod[]>([])

  // LocalStorageから最近使用した期間を読み込み
  useEffect(() => {
    const stored = localStorage.getItem('demo_recentPeriods')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setRecentPeriods(parsed.slice(0, 3)) // 最新3件のみ保持
      } catch (e) {
        
      }
    }
  }, [])

  // カスタム期間を保存
  const saveRecentPeriod = useCallback((start: string, end: string) => {
    const formatDate = (date: string) => {
      const d = new Date(date)
      return `${d.getMonth() + 1}/${d.getDate()}`
    }

    const newPeriod: RecentPeriod = {
      id: `${start}_${end}`,
      label: `${formatDate(start)}〜${formatDate(end)}`,
      start,
      end,
      usedAt: new Date().toISOString()
    }

    // 重複を除外して追加
    const updated = [newPeriod, ...recentPeriods.filter(p => p.id !== newPeriod.id)].slice(0, 3)
    setRecentPeriods(updated)
    localStorage.setItem('demo_recentPeriods', JSON.stringify(updated))
  }, [recentPeriods])

  // アクティブフィルター数の計算
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.selectedVegetables.length > 0 && filters.selectedVegetables.length < vegetables.length) count++
    if (filters.workType !== 'all') count++
    if (filters.period !== 'all') count++
    if (!filters.showPlanned || !filters.showCompleted) count++
    return count
  }, [filters, vegetables.length])

  // 期間フィルター計算
  const getPeriodFilter = useCallback(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    switch (filters.period) {
      case 'today':
        return {
          start: today,
          end: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        }
      case 'week':
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - today.getDay())
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 7)
        return { start: weekStart, end: weekEnd }
      case 'month':
        return {
          start: new Date(now.getFullYear(), now.getMonth(), 1),
          end: new Date(now.getFullYear(), now.getMonth() + 1, 0)
        }
      case 'year':
        return {
          start: new Date(now.getFullYear(), 0, 1),
          end: new Date(now.getFullYear(), 11, 31)
        }
      case 'custom':
        if (filters.customPeriod) {
          return {
            start: new Date(filters.customPeriod.start),
            end: new Date(filters.customPeriod.end)
          }
        }
        return null
      case 'recent':
        if (filters.customPeriod) {
          return {
            start: new Date(filters.customPeriod.start),
            end: new Date(filters.customPeriod.end)
          }
        }
        return null
      default:
        return null
    }
  }, [filters.period, filters.customPeriod])

  // フィルター処理
  const applyFilters = useMemo(() => {
    const hasActiveFilters =
      (filters.selectedVegetables.length > 0 && filters.selectedVegetables.length < vegetables.length) ||
      filters.workType !== 'all' ||
      filters.period !== 'all' ||
      !filters.showPlanned ||
      !filters.showCompleted

    if (!hasActiveFilters) {
      return {
        filteredVegetables: [...vegetables],
        filteredTasks: [...tasks],
        filteredReports: [...workReports]
      }
    }

    let filteredVegetables = [...vegetables]
    let filteredTasks = [...tasks]
    let filteredReports = [...workReports]

    // 野菜フィルター
    if (filters.selectedVegetables.length > 0 && filters.selectedVegetables.length < vegetables.length) {
      const selectedIds = filters.selectedVegetables
      filteredVegetables = filteredVegetables.filter(veg => selectedIds.includes(veg.id))
      filteredTasks = filteredTasks.filter(task => selectedIds.includes(task.vegetable?.id))
      filteredReports = filteredReports.filter(report => selectedIds.includes(report.vegetable_id))
    }

    // 作業種類フィルター
    if (filters.workType !== 'all') {
      filteredTasks = filteredTasks.filter(task => {
        const taskName = task.name.toLowerCase()
        switch (filters.workType) {
          case 'seeding': return taskName.includes('播種') || taskName.includes('育苗')
          case 'planting': return taskName.includes('定植')
          case 'fertilizing': return taskName.includes('施肥') || taskName.includes('肥料')
          case 'watering': return taskName.includes('灌水') || taskName.includes('水やり')
          case 'weeding': return taskName.includes('除草')
          case 'pruning': return taskName.includes('整枝') || taskName.includes('摘芽')
          case 'harvesting': return taskName.includes('収穫')
          case 'other':
            // 上記のどれにも該当しないものが「その他」
            return !taskName.includes('播種') && !taskName.includes('育苗') &&
                   !taskName.includes('定植') &&
                   !taskName.includes('施肥') && !taskName.includes('肥料') &&
                   !taskName.includes('灌水') && !taskName.includes('水やり') &&
                   !taskName.includes('除草') &&
                   !taskName.includes('整枝') && !taskName.includes('摘芽') &&
                   !taskName.includes('収穫')
          default: return true
        }
      })
      filteredReports = filteredReports.filter(report => report.work_type === filters.workType)
    }

    // 期間フィルター
    const periodFilter = getPeriodFilter()
    if (periodFilter) {
      filteredTasks = filteredTasks.filter(task => {
        const taskDate = new Date(task.start_date)
        return taskDate >= periodFilter.start && taskDate <= periodFilter.end
      })
      filteredReports = filteredReports.filter(report => {
        const reportDate = new Date(report.work_date)
        return reportDate >= periodFilter.start && reportDate <= periodFilter.end
      })
    }

    // 計画・実績表示フィルター
    if (!filters.showPlanned) {
      filteredTasks = []
    }
    if (!filters.showCompleted) {
      filteredReports = []
    }

    // 野菜リストを実際にデータがあるもののみに絞る
    filteredVegetables = filteredVegetables.filter(vegetable => {
      const hasTask = filteredTasks.some(task => task.vegetable?.id === vegetable.id)
      const hasReport = filteredReports.some(report => report.vegetable_id === vegetable.id)
      return hasTask || hasReport
    })

    return {
      filteredVegetables,
      filteredTasks,
      filteredReports
    }
  }, [filters, vegetables, tasks, workReports, getPeriodFilter])

  // 結果サマリー生成
  const resultSummary = useMemo(() => {
    const { filteredTasks, filteredReports } = applyFilters

    const hasActiveFilters =
      (filters.selectedVegetables.length > 0 && filters.selectedVegetables.length < vegetables.length) ||
      filters.workType !== 'all' ||
      filters.period !== 'all' ||
      !filters.showPlanned ||
      !filters.showCompleted

    if (!hasActiveFilters) {
      return `全データ表示 - 計画${filteredTasks.length}件・実績${filteredReports.length}件`
    }

    const selectedVegetableNames = filters.selectedVegetables.length > 0
      ? vegetables.filter(v => filters.selectedVegetables.includes(v.id)).map(v => v.name).join('・')
      : '全野菜'

    const workTypeName = workTypeOptions.find(w => w.value === filters.workType)?.label.substring(2) || '全作業'
    const periodName = periodOptions.find(p => p.value === filters.period)?.label || ''

    return `${selectedVegetableNames}の${workTypeName} (${periodName}) - 計画${filteredTasks.length}件・実績${filteredReports.length}件`
  }, [filters.selectedVegetables, filters.workType, filters.period, applyFilters, vegetables, filters.showPlanned, filters.showCompleted])

  // フィルター変更時にコールバック実行
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const { filteredVegetables, filteredTasks, filteredReports } = applyFilters
      onFiltersChange(filters, {
        filteredVegetables,
        filteredTasks,
        filteredReports,
        resultSummary,
        hasActiveFilters:
          (filters.selectedVegetables.length > 0 && filters.selectedVegetables.length < vegetables.length) ||
          filters.workType !== 'all' ||
          filters.period !== 'all' ||
          !filters.showPlanned ||
          !filters.showCompleted
      })
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [
    filters.selectedVegetables.join(','),
    filters.workType,
    filters.period,
    filters.showPlanned,
    filters.showCompleted,
    applyFilters,
    onFiltersChange,
    resultSummary,
    vegetables.length
  ])

  // 野菜データが初期化された時のみ全選択に設定
  useEffect(() => {
    if (vegetables.length > 0) {
      setFilters(prev => {
        if (prev.selectedVegetables.length > 0) {
          return prev
        }
        return {
          ...prev,
          selectedVegetables: vegetables.map(v => v.id)
        }
      })
    }
  }, [vegetables.length])

  const handleVegetableToggle = (vegetableId: string, checked: boolean) => {
    setFilters(prev => ({
      ...prev,
      selectedVegetables: checked
        ? [...prev.selectedVegetables, vegetableId]
        : prev.selectedVegetables.filter(id => id !== vegetableId)
    }))
  }

  const handleVegetableSelectAll = (checked: boolean) => {
    setFilters(prev => ({
      ...prev,
      selectedVegetables: checked ? vegetables.map(v => v.id) : []
    }))
  }

  const handleReset = () => {
    setFilters({
      selectedVegetables: vegetables.map(v => v.id),
      workType: 'all',
      period: 'all',
      showPlanned: true,
      showCompleted: true
    })
    setCustomStart('')
    setCustomEnd('')
  }

  const handleCustomPeriodApply = () => {
    if (customStart && customEnd) {
      setFilters(prev => ({
        ...prev,
        period: 'custom',
        customPeriod: {
          start: customStart,
          end: customEnd
        }
      }))
      saveRecentPeriod(customStart, customEnd)
      alert('デモ版のため、期間フィルターは表示のみです')
    }
  }

  const handleRecentPeriodClick = (period: RecentPeriod) => {
    setCustomStart(period.start)
    setCustomEnd(period.end)
    setFilters(prev => ({
      ...prev,
      period: 'custom',
      customPeriod: {
        start: period.start,
        end: period.end
      }
    }))
    alert('デモ版のため、期間フィルターは表示のみです')
  }

  return (
    <>
      {/* 展開式フィルターパネル */}
      {isExpanded && (
        <Card className="shadow-md border border-green-200/50 bg-white/95 backdrop-blur-sm animate-in slide-in-from-top-2 duration-200">
          <CardContent className="p-4 space-y-4">
            {/* 野菜選択 */}
            <div className="bg-green-50/50 rounded-lg p-3 border border-green-200/50">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-green-800 flex items-center gap-2">
                  <Sprout className="w-4 h-4" />
                  野菜選択
                </h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleVegetableSelectAll(filters.selectedVegetables.length !== vegetables.length)}
                  className="h-6 px-2 text-xs bg-white border-green-200 hover:bg-green-100"
                >
                  {filters.selectedVegetables.length === vegetables.length ? '全解除' : '全選択'}
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {vegetables.map(vegetable => {
                  const isSelected = filters.selectedVegetables.includes(vegetable.id)
                  return (
                    <Button
                      key={vegetable.id}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleVegetableToggle(vegetable.id, !isSelected)}
                      className={`
                        h-7 px-2 text-xs transition-all duration-150 flex items-center gap-1
                        ${isSelected
                          ? 'bg-green-600 hover:bg-green-700 text-white border-green-600'
                          : 'bg-white hover:bg-green-50 text-green-700 border-green-200'
                        }
                      `}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                      {vegetable.name}
                    </Button>
                  )
                })}
              </div>
            </div>

            {/* 期間・作業種類設定 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* 期間選択 */}
              <div className="bg-green-50/50 rounded-lg p-3 border border-green-200/50">
                <h4 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  期間設定
                </h4>

                {/* プリセット期間 */}
                <div className="mb-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-between bg-white hover:bg-green-50 border-green-200 text-green-700 h-8 text-xs"
                      >
                        <span className="flex items-center gap-1">
                          {filters.period !== 'custom' ? (
                            <>
                              {periodOptions.find(p => p.value === filters.period)?.icon}
                              {periodOptions.find(p => p.value === filters.period)?.label || '選択'}
                            </>
                          ) : (
                            <>
                              <CalendarRange className="w-3 h-3" />
                              <span>カスタム期間</span>
                            </>
                          )}
                        </span>
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-full bg-white border border-green-200 shadow-md">
                      {periodOptions.filter(o => o.value !== 'custom').map(option => (
                        <DropdownMenuItem
                          key={option.value}
                          onClick={() => {
                            setFilters(prev => ({ ...prev, period: option.value }))
                            setCustomStart('')
                            setCustomEnd('')
                          }}
                          className="text-xs py-2 hover:bg-green-50"
                        >
                          <span className="flex items-center gap-2">
                            <span>{option.icon}</span>
                            <span>{option.label}</span>
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* カスタム期間 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Input
                        type="date"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="h-7 text-xs bg-white border-green-200"
                        placeholder="開始日"
                      />
                    </div>
                    <span className="text-xs text-gray-500">〜</span>
                    <div className="flex-1">
                      <Input
                        type="date"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="h-7 text-xs bg-white border-green-200"
                        placeholder="終了日"
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={handleCustomPeriodApply}
                      disabled={!customStart || !customEnd}
                      className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700 text-white"
                    >
                      適用
                    </Button>
                  </div>

                  {/* 最近使用した期間 */}
                  {recentPeriods.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-600">最近使用した期間</Label>
                      <div className="flex flex-wrap gap-1">
                        {recentPeriods.map(period => (
                          <Button
                            key={period.id}
                            variant="outline"
                            size="sm"
                            onClick={() => handleRecentPeriodClick(period)}
                            className="h-6 px-2 text-xs bg-white hover:bg-green-50 border-green-200"
                          >
                            <Clock className="w-3 h-3 mr-1" />
                            {period.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 作業種類選択 */}
              <div className="bg-green-50/50 rounded-lg p-3 border border-green-200/50">
                <h4 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  作業種類
                </h4>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-between bg-white hover:bg-green-50 border-green-200 text-green-700 h-8 text-xs"
                    >
                      <span className="flex items-center gap-1">
                        {workTypeOptions.find(w => w.value === filters.workType)?.icon}
                        {workTypeOptions.find(w => w.value === filters.workType)?.label.substring(2) || '選択'}
                      </span>
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-full bg-white border border-green-200 shadow-md">
                    {workTypeOptions.map(option => (
                      <DropdownMenuItem
                        key={option.value}
                        onClick={() => setFilters(prev => ({ ...prev, workType: option.value }))}
                        className="text-xs py-2 hover:bg-green-50"
                      >
                        <span className="flex items-center gap-2">
                          <span>{option.icon}</span>
                          <span>{option.label.substring(2)}</span>
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* 表示設定 */}
                <div className="mt-3 space-y-1">
                  <h5 className="text-xs font-medium text-green-700">表示設定</h5>
                  <div className="space-y-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.showPlanned}
                        onChange={(e) => setFilters(prev => ({ ...prev, showPlanned: e.target.checked }))}
                        className="w-3 h-3 text-green-600 border-green-300 rounded focus:ring-green-500"
                      />
                      <span className="text-xs text-gray-700">計画を表示</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.showCompleted}
                        onChange={(e) => setFilters(prev => ({ ...prev, showCompleted: e.target.checked }))}
                        className="w-3 h-3 text-green-600 border-green-300 rounded focus:ring-green-500"
                      />
                      <span className="text-xs text-gray-700">実績を表示</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* フィルター結果サマリーとリセット */}
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-600">
                {resultSummary}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="h-7 px-3 text-xs bg-white hover:bg-red-50 border-red-200 text-red-600"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                リセット
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}