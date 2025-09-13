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
  ChevronUp,
  RotateCcw,
  TrendingUp,
  BarChart3
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
    hasActiveFilters: boolean
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
  const [isExpanded, setIsExpanded] = useState(false)
  
  // アクティブフィルター数の計算
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.searchQuery.trim() !== '') count++
    if (filters.selectedVegetables.length > 0 && filters.selectedVegetables.length < vegetables.length) count++
    if (filters.workType !== 'all') count++
    if (filters.period !== 'all') count++
    if (!filters.showPlanned || !filters.showCompleted) count++
    return count
  }, [filters, vegetables.length])

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
    // フィルターが設定されているかチェック
    const hasActiveFilters = 
      filters.searchQuery.trim() !== '' ||
      (filters.selectedVegetables.length > 0 && filters.selectedVegetables.length < vegetables.length) ||
      filters.workType !== 'all' ||
      filters.period !== 'all' ||
      !filters.showPlanned ||
      !filters.showCompleted

    // フィルターが何も設定されていない場合は全てのデータを返す
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
  }, [filters.selectedVegetables, filters.workType, filters.period, applyFilters, vegetables, filters.searchQuery, filters.showPlanned, filters.showCompleted])

  // フィルター変更時にコールバック実行（デバウンス処理）
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const { filteredVegetables, filteredTasks, filteredReports } = applyFilters
      onFiltersChange(filters, {
        filteredVegetables,
        filteredTasks,
        filteredReports,
        resultSummary,
        hasActiveFilters: 
          filters.searchQuery.trim() !== '' ||
          (filters.selectedVegetables.length > 0 && filters.selectedVegetables.length < vegetables.length) ||
          filters.workType !== 'all' ||
          filters.period !== 'all' ||
          !filters.showPlanned ||
          !filters.showCompleted
      })
    }, 300) // 300ms のデバウンス（パフォーマンス最適化）

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
    <Card className="mb-4 shadow-md border border-green-200/50 bg-gradient-to-b from-lime-50/80 to-green-100/60 backdrop-blur-sm">
      <CardContent className="p-0">
        {/* コンパクトヘッダー */}
        <div className="bg-gradient-to-r from-lime-600 via-green-600 to-emerald-700 p-3 rounded-t-lg">
          <div className="flex items-center justify-between gap-3">
            {/* 左側: タイトルとAIアイコン */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-md flex items-center justify-center backdrop-blur-sm">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">🔍 AI統合検索</h3>
                <p className="text-green-100 text-xs font-medium">AgriFinance Pro</p>
              </div>
            </div>
            
            {/* 右側: 結果表示とアクション */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs text-white/90 font-medium flex items-center gap-1">
                  <BarChart3 className="w-3 h-3" />
                  {resultSummary.includes('計画') ? resultSummary.split(' - ')[1] : `${applyFilters.filteredTasks.length + applyFilters.filteredReports.length}件`}
                </div>
                <div className="text-xs text-green-100">検索結果</div>
              </div>
              
              <Button 
                onClick={() => setIsExpanded(!isExpanded)}
                variant="ghost" 
                size="sm" 
                className="text-white hover:bg-white/20 border border-white/30 h-8 px-3"
              >
                <Filter className="w-3 h-3 mr-1" />
                {activeFilterCount > 0 && (
                  <Badge className="ml-1 px-1.5 py-0.5 text-xs bg-yellow-400 text-green-800 border-0">
                    {activeFilterCount}
                  </Badge>
                )}
                {isExpanded ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
              </Button>
              
              {activeFilterCount > 0 && (
                <Button 
                  onClick={handleReset} 
                  variant="ghost" 
                  size="sm" 
                  className="text-white hover:bg-white/20 border border-white/30 h-8 px-2"
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* メイン検索バー - コンパクト表示 */}
        <div className="p-3 bg-gradient-to-r from-green-50/90 to-lime-50/90 border-b border-green-200/30">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-green-500" />
              </div>
              <Input
                placeholder="AI検索: 'トマト 昨日 収穫', 'キャベツ 今週 播種'..."
                value={filters.searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10 pr-10 py-2 text-sm border border-green-300 focus:border-green-500 focus:ring-1 focus:ring-green-500/20 rounded-lg bg-white/90 backdrop-blur-sm transition-all duration-200"
                onFocus={() => setShowSuggestions(filters.searchQuery.length > 0)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              />
              {filters.searchQuery && (
                <Button 
                  size="sm" 
                  onClick={() => handleSearchChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full"
                  variant="ghost"
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
            
            <Button 
              onClick={handleSaveSearch} 
              variant="outline" 
              size="sm" 
              className="shrink-0 bg-white/90 border-green-300 hover:bg-green-50 px-3 h-9 text-xs"
            >
              <Bookmark className="w-3 h-3 mr-1" />
              保存
            </Button>
          </div>

          {/* 検索候補 - コンパクト表示 */}
          {showSuggestions && (searchSuggestions.length > 0 || aiSuggestions.length > 0) && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white/95 border border-green-200 rounded-lg shadow-lg z-50 backdrop-blur-sm">
              {searchSuggestions.length > 0 && (
                <div className="p-2">
                  <div className="text-xs font-medium text-green-600 mb-2 flex items-center gap-1">
                    <Search className="w-3 h-3" />
                    検索候補
                  </div>
                  {searchSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="block w-full text-left px-3 py-2 text-xs hover:bg-green-50 rounded-md transition-colors duration-150 mb-1"
                    >
                      <span className="text-green-600 mr-2">🔍</span>
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
              
              {aiSuggestions.length > 0 && (
                <div className="p-2 border-t border-green-100">
                  <div className="text-xs font-medium text-purple-600 mb-2 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    AI提案
                  </div>
                  {aiSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="block w-full text-left px-3 py-2 text-xs hover:bg-purple-50 rounded-md transition-colors duration-150 mb-1"
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

        {/* 展開式詳細フィルター */}
        {isExpanded && (
          <div className="bg-gradient-to-b from-white to-green-50/30 border-t border-green-200/50 animate-in slide-in-from-top-2 duration-200">
            <div className="p-4 space-y-4">
              {/* 野菜選択 - コンパクト表示 */}
              <div className="bg-white/80 rounded-lg p-3 border border-green-200/50">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-green-800 flex items-center gap-2">
                    <Sprout className="w-4 h-4" />
                    🥬 野菜選択
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleVegetableSelectAll(filters.selectedVegetables.length !== vegetables.length)}
                    className="h-6 px-2 text-xs bg-green-50 border-green-200 hover:bg-green-100"
                  >
                    {filters.selectedVegetables.length === vegetables.length ? '✅ 全解除' : '☐ 全選択'}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {vegetables.map(vegetable => (
                    <Button
                      key={vegetable.id}
                      variant={filters.selectedVegetables.includes(vegetable.id) ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleVegetableToggle(vegetable.id, !filters.selectedVegetables.includes(vegetable.id))}
                      className={`
                        h-7 px-2 text-xs transition-all duration-150
                        ${filters.selectedVegetables.includes(vegetable.id)
                          ? 'bg-green-600 hover:bg-green-700 text-white border-green-600' 
                          : 'bg-white hover:bg-green-50 text-green-700 border-green-200'
                        }
                      `}
                    >
                      <span className="mr-1 text-xs">{filters.selectedVegetables.includes(vegetable.id) ? '✅' : '🥬'}</span>
                      {vegetable.name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* 期間・表示設定 - コンパクトグリッド */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 期間選択 */}
                <div className="bg-white/80 rounded-lg p-3 border border-green-200/50">
                  <h4 className="text-sm font-semibold text-green-800 mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    📅 期間設定
                  </h4>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full justify-between bg-white hover:bg-green-50 border-green-200 text-green-700 h-8 text-xs"
                      >
                        {periodOptions.find(p => p.value === filters.period)?.label || '選択'}
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-full bg-white border border-green-200 shadow-md">
                      {periodOptions.map(option => (
                        <DropdownMenuItem
                          key={option.value}
                          onClick={() => setFilters(prev => ({ ...prev, period: option.value }))}
                          className="text-xs py-2 hover:bg-green-50"
                        >
                          <Calendar className="w-3 h-3 mr-2 text-green-500" />
                          {option.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* 表示設定 */}
                <div className="bg-white/80 rounded-lg p-3 border border-green-200/50">
                  <h4 className="text-sm font-semibold text-green-800 mb-2 flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    👁️ 表示設定
                  </h4>
                  <div className="space-y-2">
                    <Button
                      variant={filters.showPlanned ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFilters(prev => ({ ...prev, showPlanned: !prev.showPlanned }))}
                      className={`
                        w-full justify-start h-7 text-xs
                        ${filters.showPlanned
                          ? 'bg-green-600 hover:bg-green-700 text-white border-green-600' 
                          : 'bg-white hover:bg-green-50 text-green-700 border-green-200'
                        }
                      `}
                    >
                      <span className="mr-1">{filters.showPlanned ? '✅' : '☐'}</span>
                      計画タスク
                    </Button>
                    <Button
                      variant={filters.showCompleted ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFilters(prev => ({ ...prev, showCompleted: !prev.showCompleted }))}
                      className={`
                        w-full justify-start h-7 text-xs
                        ${filters.showCompleted
                          ? 'bg-green-600 hover:bg-green-700 text-white border-green-600' 
                          : 'bg-white hover:bg-green-50 text-green-700 border-green-200'
                        }
                      `}
                    >
                      <span className="mr-1">{filters.showCompleted ? '✅' : '☐'}</span>
                      実績記録
                    </Button>
                  </div>
                </div>
              </div>

              {/* 作業種類 - コンパクトタブ */}
              <div className="bg-white/80 rounded-lg p-3 border border-green-200/50">
                <h4 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  🔧 作業種類
                </h4>
                <div className="grid grid-cols-3 gap-1">
                  {workTypeOptions.map(option => (
                    <Button
                      key={option.value}
                      size="sm"
                      variant={filters.workType === option.value ? "default" : "outline"}
                      onClick={() => setFilters(prev => ({ ...prev, workType: option.value }))}
                      className={`
                        h-8 px-2 text-xs transition-all duration-150
                        ${filters.workType === option.value
                          ? 'bg-green-600 hover:bg-green-700 text-white border-green-600' 
                          : 'bg-white hover:bg-green-50 text-green-700 border-green-200'
                        }
                      `}
                    >
                      <span className="mr-1">{option.icon}</span>
                      <span className="font-medium">{option.label.substring(2)}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* アクションバー - コンパクト配置 */}
              <div className="flex items-center justify-between pt-3 border-t border-green-200/50">
                <div className="flex items-center gap-2">
                  {/* アクティブフィルター表示 */}
                  <div className="flex flex-wrap gap-1">
                    {filters.selectedVegetables.length > 0 && filters.selectedVegetables.length < vegetables.length && (
                      <Badge className="bg-green-100 text-green-800 border-green-200 text-xs px-2 py-0.5">
                        🥬 {filters.selectedVegetables.length}種
                      </Badge>
                    )}
                    {filters.workType !== 'all' && (
                      <Badge className="bg-green-100 text-green-800 border-green-200 text-xs px-2 py-0.5">
                        {workTypeOptions.find(w => w.value === filters.workType)?.icon}
                      </Badge>
                    )}
                    {filters.period !== 'all' && (
                      <Badge className="bg-green-100 text-green-800 border-green-200 text-xs px-2 py-0.5">
                        📅 {periodOptions.find(p => p.value === filters.period)?.label}
                      </Badge>
                    )}
                    {(!filters.showPlanned || !filters.showCompleted) && (
                      <Badge className="bg-green-100 text-green-800 border-green-200 text-xs px-2 py-0.5">
                        👁️ {!filters.showPlanned ? '実績' : '計画'}
                      </Badge>
                    )}
                  </div>
                  
                  {/* 保存された検索 */}
                  {savedSearches.length > 0 && (
                    <div className="flex gap-1 ml-2">
                      {savedSearches.slice(0, 1).map((search, index) => (
                        <Button
                          key={index}
                          size="sm"
                          variant="outline"
                          onClick={() => handleSearchChange(search)}
                          className="h-6 px-2 text-xs bg-white border-green-200 text-green-600 hover:bg-green-50"
                        >
                          <Bookmark className="w-3 h-3 mr-1" />
                          {search.length > 8 ? `${search.substring(0, 8)}...` : search}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleReset}
                    variant="outline"
                    size="sm"
                    className="h-7 px-3 text-xs text-gray-600 hover:text-gray-800 border-green-200 hover:bg-green-50"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    リセット
                  </Button>
                  
                  <Button
                    onClick={() => setIsExpanded(false)}
                    variant="default"
                    size="sm"
                    className="h-7 px-3 text-xs bg-green-600 hover:bg-green-700"
                  >
                    適用・閉じる
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* 結果サマリーバー */}
        <div className="bg-gradient-to-r from-green-50 to-lime-50 p-3 border-t border-green-200/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <div className="text-sm font-semibold text-green-800">
                  📊 検索結果
                </div>
                <div className="text-xs text-green-700">
                  {resultSummary}
                </div>
              </div>
            </div>
            
            {/* クイックアクション */}
            <div className="text-right">
              <div className="text-lg font-bold text-green-800">
                {applyFilters.filteredTasks.length + applyFilters.filteredReports.length}
              </div>
              <div className="text-xs text-green-600">件数</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}