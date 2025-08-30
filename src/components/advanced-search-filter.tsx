'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { 
  Search,
  Sparkles,
  Clock,
  Bookmark,
  X,
  Filter,
  Calendar,
  Sprout,
  ChevronDown,
  RotateCcw
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Checkbox } from '@/components/ui/checkbox'

interface SearchFilters {
  searchQuery: string
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

interface AdvancedSearchFilterProps {
  vegetables: any[]
  workReports: any[]
  tasks: any[]
  onFiltersChange: (filters: SearchFilters, filteredData: {
    filteredVegetables: any[]
    filteredTasks: any[]
    filteredReports: any[]
    resultSummary: string
  }) => void
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
  { value: 'today', label: '今日' },
  { value: 'week', label: '今週' },
  { value: 'month', label: '今月' },
  { value: 'year', label: '今年' },
  { value: 'all', label: '過去全て' },
  { value: 'custom', label: 'カスタム期間' }
]

export function AdvancedSearchFilter({
  vegetables,
  workReports,
  tasks,
  onFiltersChange
}: AdvancedSearchFilterProps) {
  const [filters, setFilters] = useState<SearchFilters>({
    searchQuery: '',
    selectedVegetables: [], // 初期化後にすべて選択に設定
    workType: 'all',
    period: 'all',
    showPlanned: true,
    showCompleted: true
  })
  
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [savedSearches, setSavedSearches] = useState<string[]>([])
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([])

  // AI支援検索候補生成
  const generateAISuggestions = useCallback(() => {
    const suggestions = [
      '昨日の収穫実績',
      '今週の予定作業',
      'キャベツの成長記録',
      '先週の播種作業',
      '収穫量の多い野菜',
      '完了していない作業',
      '今月の施肥記録'
    ]
    setAiSuggestions(suggestions.slice(0, 3))
  }, [])

  // 検索候補生成
  const generateSearchSuggestions = useCallback((query: string) => {
    if (!query.trim()) {
      setSearchSuggestions([])
      return
    }

    const suggestions = new Set<string>()
    
    // 野菜名から候補生成
    vegetables.forEach(veg => {
      if (veg.name.includes(query)) {
        suggestions.add(`${veg.name} 播種`)
        suggestions.add(`${veg.name} 収穫`)
        suggestions.add(`${veg.name} 今週`)
      }
    })
    
    // 作業種類から候補生成
    workTypeOptions.forEach(work => {
      if (work.label.includes(query) || query.includes(work.label.substring(2))) {
        suggestions.add(`${work.label.substring(2)} 今日`)
        suggestions.add(`${work.label.substring(2)} 実績`)
      }
    })
    
    // よく使われる組み合わせ
    if (query.includes('キャベツ')) {
      suggestions.add('キャベツ 播種 今週')
      suggestions.add('キャベツ 収穫実績')
    }
    if (query.includes('トマト')) {
      suggestions.add('トマト 収穫 昨日')
      suggestions.add('トマト 水やり 今日')
    }
    
    setSearchSuggestions(Array.from(suggestions).slice(0, 5))
  }, [vegetables])

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
      default:
        return null
    }
  }, [filters.period, filters.customPeriod])

  // フィルター処理
  const applyFilters = useMemo(() => {
    // 検索条件が何も設定されていない場合は空の結果を返す
    const hasActiveFilters = 
      filters.searchQuery.trim() !== '' ||
      filters.selectedVegetables.length > 0 ||
      filters.workType !== 'all' ||
      filters.period !== 'all' ||
      !filters.showPlanned ||
      !filters.showCompleted

    if (!hasActiveFilters) {
      return {
        filteredVegetables: [],
        filteredTasks: [],
        filteredReports: []
      }
    }

    let filteredVegetables = [...vegetables]
    let filteredTasks = [...tasks]
    let filteredReports = [...workReports]

    // 野菜フィルター
    if (filters.selectedVegetables.length > 0) {
      const selectedIds = filters.selectedVegetables
      filteredVegetables = filteredVegetables.filter(veg => selectedIds.includes(veg.id))
      filteredTasks = filteredTasks.filter(task => selectedIds.includes(task.vegetable?.id))
      filteredReports = filteredReports.filter(report => selectedIds.includes(report.vegetable_id))
    }

    // 作業種類フィルター
    if (filters.workType !== 'all') {
      filteredTasks = filteredTasks.filter(task => {
        // タスク名から作業種類を推測
        const taskName = task.name.toLowerCase()
        switch (filters.workType) {
          case 'seeding': return taskName.includes('播種') || taskName.includes('育苗')
          case 'planting': return taskName.includes('定植')
          case 'fertilizing': return taskName.includes('施肥') || taskName.includes('肥料')
          case 'watering': return taskName.includes('灌水') || taskName.includes('水やり')
          case 'weeding': return taskName.includes('除草')
          case 'pruning': return taskName.includes('整枝') || taskName.includes('摘芽')
          case 'harvesting': return taskName.includes('収穫')
          default: return true
        }
      })
      filteredReports = filteredReports.filter(report => report.work_type === filters.workType)
    }

    // 期間フィルター
    const periodFilter = getPeriodFilter()
    if (periodFilter) {
      filteredTasks = filteredTasks.filter(task => {
        const taskDate = new Date(task.start)
        return taskDate >= periodFilter.start && taskDate <= periodFilter.end
      })
      filteredReports = filteredReports.filter(report => {
        const reportDate = new Date(report.work_date)
        return reportDate >= periodFilter.start && reportDate <= periodFilter.end
      })
    }

    // 検索クエリフィルター（AI支援自然言語検索）
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase()
      
      // 自然言語解析（簡単な実装）
      if (query.includes('昨日')) {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = yesterday.toISOString().split('T')[0]
        filteredReports = filteredReports.filter(report => 
          report.work_date === yesterdayStr
        )
      } else if (query.includes('今日')) {
        const today = new Date().toISOString().split('T')[0]
        filteredReports = filteredReports.filter(report => 
          report.work_date === today
        )
      } else {
        // 通常の文字列検索
        filteredTasks = filteredTasks.filter(task =>
          task.name.toLowerCase().includes(query) ||
          task.vegetable?.name.toLowerCase().includes(query)
        )
        filteredReports = filteredReports.filter(report =>
          report.work_notes?.toLowerCase().includes(query) ||
          vegetables.find(v => v.id === report.vegetable_id)?.name.toLowerCase().includes(query)
        )
      }
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
    const { filteredVegetables, filteredTasks, filteredReports } = applyFilters
    
    // フィルター条件が何も設定されていない場合
    const hasActiveFilters = 
      filters.searchQuery.trim() !== '' ||
      filters.selectedVegetables.length > 0 ||
      filters.workType !== 'all' ||
      filters.period !== 'all' ||
      !filters.showPlanned ||
      !filters.showCompleted

    if (!hasActiveFilters) {
      return '検索条件やフィルターを設定してください'
    }
    
    const selectedVegetableNames = filters.selectedVegetables.length > 0 
      ? vegetables.filter(v => filters.selectedVegetables.includes(v.id)).map(v => v.name).join('・')
      : '全野菜'
    
    const workTypeName = workTypeOptions.find(w => w.value === filters.workType)?.label.substring(2) || '全作業'
    const periodName = periodOptions.find(p => p.value === filters.period)?.label || ''
    
    return `${selectedVegetableNames}の${workTypeName} (${periodName}) - 計画${filteredTasks.length}件・実績${filteredReports.length}件`
  }, [filters.selectedVegetables, filters.workType, filters.period, applyFilters, vegetables, filters.searchQuery, filters.showPlanned, filters.showCompleted])

  // フィルター変更時にコールバック実行（デバウンス処理）
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const { filteredVegetables, filteredTasks, filteredReports } = applyFilters
      onFiltersChange(filters, {
        filteredVegetables,
        filteredTasks,
        filteredReports,
        resultSummary
      })
    }, 100) // 100ms のデバウンス

    return () => clearTimeout(timeoutId)
  }, [
    filters.searchQuery,
    filters.selectedVegetables.join(','),
    filters.workType,
    filters.period,
    filters.showPlanned,
    filters.showCompleted
  ]) // 基本的なフィルター値のみを依存関係に含める

  // 検索クエリ変更時の候補生成
  useEffect(() => {
    generateSearchSuggestions(filters.searchQuery)
  }, [filters.searchQuery, generateSearchSuggestions])

  // 初期化時にAI提案生成
  useEffect(() => {
    generateAISuggestions()
  }, [generateAISuggestions])

  // 野菜データが利用可能になったときに全選択に設定
  useEffect(() => {
    if (vegetables.length > 0 && filters.selectedVegetables.length === 0) {
      setFilters(prev => ({
        ...prev,
        selectedVegetables: vegetables.map(v => v.id)
      }))
    }
  }, [vegetables, filters.selectedVegetables.length])

  const handleSearchChange = (value: string) => {
    setFilters(prev => ({ ...prev, searchQuery: value }))
    setShowSuggestions(value.length > 0)
  }

  const handleSuggestionClick = (suggestion: string) => {
    setFilters(prev => ({ ...prev, searchQuery: suggestion }))
    setShowSuggestions(false)
  }

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
      searchQuery: '',
      selectedVegetables: [],
      workType: 'all',
      period: 'all',
      showPlanned: true,
      showCompleted: true
    })
    setShowSuggestions(false)
  }

  const handleSaveSearch = () => {
    if (filters.searchQuery.trim() && !savedSearches.includes(filters.searchQuery)) {
      setSavedSearches(prev => [...prev, filters.searchQuery])
    }
  }

  return (
    <Card className="mb-6 shadow-lg border-0 bg-gradient-to-br from-white via-blue-50/30 to-green-50/30">
      <CardContent className="p-0">
        {/* ヘッダー部分 */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-4 rounded-t-lg">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                <Search className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">🔍 AI支援統合検索システム</h3>
                <p className="text-green-100 text-sm">自然言語で検索・高度フィルタリング機能</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-green-100 uppercase tracking-wider">AgriFinance Pro</div>
              <div className="text-sm font-medium text-white">AI Search System</div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-end">
            <Button 
              onClick={handleReset} 
              variant="ghost" 
              size="sm" 
              className="text-white hover:bg-white/20 border border-white/30"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              リセット
            </Button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* メイン検索バー */}
          <div className="relative">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                </div>
                <Input
                  placeholder="例: 「昨日のトマト収穫実績」「キャベツ 播種 今週」「完了していない作業」"
                  value={filters.searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-12 pr-12 py-4 text-base border-2 border-blue-200 focus:border-blue-500 rounded-xl shadow-sm bg-white/80 backdrop-blur-sm"
                  onFocus={() => setShowSuggestions(filters.searchQuery.length > 0)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                />
                {filters.searchQuery && (
                  <Button 
                    size="sm" 
                    onClick={() => handleSearchChange('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 p-0 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full"
                    variant="ghost"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <Button 
                onClick={handleSaveSearch} 
                variant="outline" 
                size="lg" 
                className="shrink-0 bg-white/80 border-blue-200 hover:bg-blue-50 px-6"
              >
                <Bookmark className="w-4 h-4 mr-2" />
                検索を保存
              </Button>
            </div>

            {/* 検索候補 */}
            {showSuggestions && (searchSuggestions.length > 0 || aiSuggestions.length > 0) && (
              <div className="absolute top-full mt-2 w-full bg-white border-2 border-blue-200 rounded-xl shadow-2xl z-50 backdrop-blur-sm">
                {searchSuggestions.length > 0 && (
                  <div className="p-3 border-b border-gray-100">
                    <div className="text-xs font-semibold text-blue-600 mb-3 flex items-center gap-2">
                      <Search className="w-4 h-4" />
                      💡 検索候補
                    </div>
                    {searchSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="block w-full text-left px-4 py-3 text-sm hover:bg-blue-50 rounded-lg transition-colors duration-200 mb-1 border border-transparent hover:border-blue-200"
                      >
                        <span className="text-blue-600 mr-2">🔍</span>
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
                
                {aiSuggestions.length > 0 && (
                  <div className="p-3">
                    <div className="text-xs font-semibold text-purple-600 mb-3 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      🤖 AI提案
                    </div>
                    {aiSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="block w-full text-left px-4 py-3 text-sm hover:bg-purple-50 rounded-lg transition-colors duration-200 mb-1 border border-transparent hover:border-purple-200"
                      >
                        <span className="text-purple-600 mr-2">✨</span>
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 野菜選択フィルター */}
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-5 border border-green-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <Sprout className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-green-800">🥬 野菜選択</h4>
                <p className="text-sm text-green-600">表示する野菜を選択してください</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant={filters.selectedVegetables.length === vegetables.length ? "default" : "outline"}
                size="sm"
                onClick={() => handleVegetableSelectAll(filters.selectedVegetables.length !== vegetables.length)}
                className={`
                  ${filters.selectedVegetables.length === vegetables.length 
                    ? 'bg-green-600 hover:bg-green-700 text-white border-green-600' 
                    : 'bg-white hover:bg-green-50 text-green-700 border-green-200'
                  }
                  transition-all duration-200 shadow-sm hover:shadow-md
                `}
              >
                <span className="mr-2">{filters.selectedVegetables.length === vegetables.length ? '✅' : '☐'}</span>
                全ての野菜
              </Button>
              {vegetables.map(vegetable => (
                <Button
                  key={vegetable.id}
                  variant={filters.selectedVegetables.includes(vegetable.id) ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleVegetableToggle(vegetable.id, !filters.selectedVegetables.includes(vegetable.id))}
                  className={`
                    ${filters.selectedVegetables.includes(vegetable.id)
                      ? 'bg-green-600 hover:bg-green-700 text-white border-green-600' 
                      : 'bg-white hover:bg-green-50 text-green-700 border-green-200'
                    }
                    transition-all duration-200 shadow-sm hover:shadow-md
                  `}
                >
                  <span className="mr-2">{filters.selectedVegetables.includes(vegetable.id) ? '✅' : '🥬'}</span>
                  {vegetable.name}
                </Button>
              ))}
            </div>
          </div>

          {/* 期間・表示設定セクション */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 期間選択 */}
            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-5 border border-blue-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="text-base font-semibold text-blue-800">📅 期間設定</h4>
                  <p className="text-sm text-blue-600">表示期間を選択</p>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="lg" 
                    className="w-full justify-between bg-white hover:bg-blue-50 border-blue-200 text-blue-700 shadow-sm"
                  >
                    <span className="flex items-center gap-2">
                      📅 {periodOptions.find(p => p.value === filters.period)?.label || '選択'}
                    </span>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-full bg-white border border-blue-200 shadow-lg">
                  {periodOptions.map(option => (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => setFilters(prev => ({ ...prev, period: option.value }))}
                      className="flex items-center gap-2 py-3 bg-white hover:bg-blue-50"
                    >
                      <Calendar className="w-4 h-4 text-blue-500" />
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* 表示設定 */}
            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-5 border border-indigo-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                  <Filter className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h4 className="text-base font-semibold text-indigo-800">👁️ 表示設定</h4>
                  <p className="text-sm text-indigo-600">表示項目を選択</p>
                </div>
              </div>
              <div className="space-y-3">
                <Button
                  variant={filters.showPlanned ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilters(prev => ({ ...prev, showPlanned: !prev.showPlanned }))}
                  className={`
                    w-full justify-start
                    ${filters.showPlanned
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600' 
                      : 'bg-white hover:bg-indigo-50 text-indigo-700 border-indigo-200'
                    }
                    transition-all duration-200 shadow-sm
                  `}
                >
                  <span className="mr-2">{filters.showPlanned ? '✅' : '☐'}</span>
                  📅 計画タスクを表示
                </Button>
                <Button
                  variant={filters.showCompleted ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilters(prev => ({ ...prev, showCompleted: !prev.showCompleted }))}
                  className={`
                    w-full justify-start
                    ${filters.showCompleted
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600' 
                      : 'bg-white hover:bg-indigo-50 text-indigo-700 border-indigo-200'
                    }
                    transition-all duration-200 shadow-sm
                  `}
                >
                  <span className="mr-2">{filters.showCompleted ? '✅' : '☐'}</span>
                  📋 実績記録を表示
                </Button>
              </div>
            </div>
          </div>

          {/* 作業種類タブ */}
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-5 border border-purple-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <Filter className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-purple-800">🔧 作業種類</h4>
                <p className="text-sm text-purple-600">フィルタする作業を選択してください</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {workTypeOptions.map(option => (
                <Button
                  key={option.value}
                  size="sm"
                  variant={filters.workType === option.value ? "default" : "outline"}
                  onClick={() => setFilters(prev => ({ ...prev, workType: option.value }))}
                  className={`
                    ${filters.workType === option.value
                      ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-600' 
                      : 'bg-white hover:bg-purple-50 text-purple-700 border-purple-200'
                    }
                    transition-all duration-200 shadow-sm hover:shadow-md px-4 py-2
                  `}
                >
                  <span className="mr-2 text-base">{option.icon}</span>
                  <span className="font-medium">{option.label.substring(2)}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* 検索結果サマリー */}
          <div className="bg-gradient-to-r from-emerald-50 via-blue-50 to-purple-50 p-6 rounded-xl border-2 border-emerald-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                  <Filter className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-emerald-800 mb-1">
                    📊 検索・フィルター結果
                  </h4>
                  <p className="text-base text-emerald-700 font-medium">
                    {resultSummary}
                  </p>
                </div>
              </div>
              
              {/* 保存された検索があれば表示 */}
              {savedSearches.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="text-xs text-gray-500">保存済み検索:</div>
                  <div className="flex gap-1">
                    {savedSearches.slice(0, 2).map((search, index) => (
                      <Button
                        key={index}
                        size="sm"
                        variant="outline"
                        onClick={() => handleSearchChange(search)}
                        className="text-xs px-2 py-1 h-6 bg-white/80 hover:bg-white border-emerald-200 text-emerald-600 hover:text-emerald-700"
                      >
                        <Bookmark className="w-3 h-3 mr-1" />
                        {search.length > 10 ? `${search.substring(0, 10)}...` : search}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* フィルター適用中の表示 */}
            {(filters.selectedVegetables.length > 0 || filters.workType !== 'all' || filters.period !== 'all' || !filters.showPlanned || !filters.showCompleted || filters.searchQuery.trim() !== '') && (
              <div className="mt-4 pt-4 border-t border-emerald-200">
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-2">
                    {filters.selectedVegetables.length > 0 && filters.selectedVegetables.length < vegetables.length && (
                      <div className="flex items-center gap-1 bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-medium">
                        <Sprout className="w-3 h-3" />
                        選択野菜: {filters.selectedVegetables.length}種類
                      </div>
                    )}
                    {filters.workType !== 'all' && (
                      <div className="flex items-center gap-1 bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs font-medium">
                        <Filter className="w-3 h-3" />
                        {workTypeOptions.find(w => w.value === filters.workType)?.label}
                      </div>
                    )}
                    {filters.period !== 'all' && (
                      <div className="flex items-center gap-1 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium">
                        <Calendar className="w-3 h-3" />
                        {periodOptions.find(p => p.value === filters.period)?.label}
                      </div>
                    )}
                    {(!filters.showPlanned || !filters.showCompleted) && (
                      <div className="flex items-center gap-1 bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-xs font-medium">
                        👁️ {!filters.showPlanned && !filters.showCompleted ? '非表示' : !filters.showPlanned ? '実績のみ' : '計画のみ'}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-emerald-600 font-medium">
                    フィルター適用中
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}