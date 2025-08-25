'use client'

import React, { useMemo, useState } from 'react'
import { format, differenceInDays, addDays, parseISO, isWeekend, getDay, startOfYear, startOfMonth, isSameYear, isSameMonth, getYear, getMonth, startOfDay, parse } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { WorkReportPopover } from '@/components/work-report-popover'
import { 
  ChevronDown, 
  ChevronRight, 
  BarChart3, 
  Calendar as CalendarIcon,
  Settings,
  Download,
  Filter,
  Loader2
} from 'lucide-react'

interface GanttTask {
  id: string
  name: string
  start: string
  end: string
  progress: number
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high'
  color?: string
  isTemporary?: boolean // 楽観的更新用フラグ
  vegetable: {
    id: string
    name: string
    variety: string
  }
  assignedUser?: {
    id: string
    name: string
  }
}

interface WorkReport {
  id: string
  work_date: string
  work_type: 'seeding' | 'planting' | 'fertilizing' | 'watering' | 'weeding' | 'pruning' | 'harvesting' | 'other'
  vegetable_id: string
  work_notes?: string
  harvest_amount?: number
  expected_revenue?: number
}

interface GanttChartProps {
  tasks: GanttTask[]
  workReports?: WorkReport[]
  vegetables?: any[]
  startDate?: string
  endDate?: string
  viewUnit?: 'day' | 'week' | 'month'
  className?: string
  onTaskClick?: (task: GanttTask) => void
  onWorkReportView?: (report: WorkReport) => void
  onWorkReportEdit?: (report: WorkReport) => void
  // 統合コントロール用props
  selectedVegetable?: string
  selectedPriority?: string
  customStartDate?: string
  customEndDate?: string
  onVegetableChange?: (value: string) => void
  onPriorityChange?: (value: string) => void
  onDateRangeChange?: (start: string, end: string) => void
}

// 野菜グループ化された階層データ構造
interface VegetableGroup {
  vegetable: {
    id: string
    name: string
    variety: string
  }
  tasks: GanttTask[]
  workReports: WorkReport[]
  isExpanded: boolean
  totalProgress: number
  taskCount: number
}

export function GanttChart({ 
  tasks, 
  workReports = [],
  vegetables = [],
  startDate, 
  endDate,
  viewUnit = 'day',
  className,
  onTaskClick,
  onWorkReportView,
  onWorkReportEdit,
  selectedVegetable = 'all',
  selectedPriority = 'all',
  customStartDate = '',
  customEndDate = '',
  onVegetableChange,
  onPriorityChange,
  onDateRangeChange
}: GanttChartProps) {
  // 野菜ごとの展開状態管理 - 最初はすべて展開状態
  const [expandedVegetables, setExpandedVegetables] = useState<Set<string>>(new Set())
  
  // フィルター変更時の自動更新
  const [refreshTrigger, setRefreshTrigger] = React.useState(0)
  const [isUpdating, setIsUpdating] = React.useState(false)
  
  // 初期展開設定
  React.useEffect(() => {
    if (vegetables.length > 0 && expandedVegetables.size === 0) {
      const allVegetableIds = new Set(vegetables.map(v => v.id))
      setExpandedVegetables(allVegetableIds)
      console.log('🌱 初期展開設定:', allVegetableIds)
    }
  }, [vegetables, expandedVegetables.size])
  // 固定列の幅を定数として定義 (階層表示用に調整)
  const FIXED_COLUMNS_WIDTH = 280 + 96 + 96 + 80 + 64 + 80 // = 696px
  // 優先度別背景色設定
  const getPriorityRowColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-25 border-red-100'
      case 'medium':
        return 'bg-yellow-25 border-yellow-100'
      case 'low':
        return 'bg-gray-25 border-gray-100'
      default:
        return 'bg-white border-gray-100'
    }
  }
  // フィルタリングされたタスクを生成
  const filteredTasks = useMemo(() => {
    console.log('🔍 filteredTasks useMemo実行 - refreshTrigger:', refreshTrigger)
    let filtered = [...tasks]
    
    // 野菜フィルター
    if (selectedVegetable && selectedVegetable !== 'all') {
      console.log('🔍 野菜フィルター適用:', selectedVegetable)
      filtered = filtered.filter(task => task.vegetable?.id === selectedVegetable)
    }
    
    // 優先度フィルター
    if (selectedPriority && selectedPriority !== 'all') {
      console.log('🔍 優先度フィルター適用:', selectedPriority)
      filtered = filtered.filter(task => task.priority === selectedPriority)
    }
    
    console.log('🔍 filteredTasks - 元のタスク数:', tasks.length, 'フィルター後:', filtered.length)
    console.log('🔍 filteredTasks - 選択された野菜:', selectedVegetable, '優先度:', selectedPriority)
    
    return filtered
  }, [tasks, selectedVegetable, selectedPriority, refreshTrigger])
  
  // 野菜グループデータの生成（フィルタリングされたタスクを使用）
  const vegetableGroups = useMemo(() => {
    const groups = new Map<string, VegetableGroup>()
    
    console.log('🔍 vegetableGroups - フィルタリング後タスク:', filteredTasks.length)
    console.log('🔍 vegetableGroups - 利用可能なレポート:', workReports.length)
    
    // フィルタリングされたタスクでグループを作成
    filteredTasks.forEach(task => {
      if (task && task.vegetable && task.vegetable.id) {
        const vegId = task.vegetable.id
        if (!groups.has(vegId)) {
          groups.set(vegId, {
            vegetable: task.vegetable,
            tasks: [],
            workReports: [],
            isExpanded: expandedVegetables.has(vegId),
            totalProgress: 0,
            taskCount: 0
          })
        }
        groups.get(vegId)!.tasks.push(task)
      }
    })
    
    // 作業レポートを追加（フィルタリング対象の野菜のみ）
    workReports.forEach(report => {
      if (report && report.vegetable_id) {
        const vegId = report.vegetable_id
        // 野菜フィルターが適用されている場合は、対象野菜のレポートのみ追加
        if (selectedVegetable !== 'all' && vegId !== selectedVegetable) return
        
        if (groups.has(vegId)) {
          groups.get(vegId)!.workReports.push(report)
        }
      }
    })
    
    // 進捗率とタスク数を計算
    groups.forEach(group => {
      if (group.tasks.length > 0) {
        group.totalProgress = Math.round(
          group.tasks.reduce((sum, task) => sum + task.progress, 0) / group.tasks.length
        )
      }
      group.taskCount = group.tasks.length
    })
    
    console.log('🔍 vegetableGroups - 生成されたグループ数:', groups.size)
    
    return Array.from(groups.values())
      .sort((a, b) => a.vegetable.name.localeCompare(b.vegetable.name, 'ja'))
  }, [filteredTasks, workReports, expandedVegetables, selectedVegetable, refreshTrigger])
  
  // 表示用に展開された階層タスク生成
  const hierarchicalTasks = useMemo(() => {
    const result: (GanttTask & { 
      isVegetableHeader?: boolean
      vegetableGroup?: VegetableGroup
      indentLevel?: number 
    })[] = []
    
    vegetableGroups.forEach(group => {
      // 野菜ヘッダーを追加
      result.push({
        id: `veg-header-${group.vegetable.id}`,
        name: group.vegetable.name,
        start: group.tasks.length > 0 ? group.tasks[0].start : new Date().toISOString(),
        end: group.tasks.length > 0 ? group.tasks[group.tasks.length - 1].end : new Date().toISOString(),
        progress: group.totalProgress,
        status: 'in_progress' as const,
        priority: 'medium' as const,
        vegetable: group.vegetable,
        isVegetableHeader: true,
        vegetableGroup: group,
        indentLevel: 0
      })
      
      // 展開されている場合はタスクを表示
      if (group.isExpanded) {
        group.tasks.forEach(task => {
          result.push({
            ...task,
            indentLevel: 1
          })
        })
      }
    })
    
    return result
  }, [vegetableGroups, refreshTrigger])

  // 日本時間（JST: UTC+9）表示用の日付変換関数
  const parseToJST = (dateString: string): Date | null => {
    if (!dateString) return null
    
    try {
      // UTC日付文字列を日本時間に変換
      // データベースのUTC日付（例：2025-08-25）を日本時間として表示
      const utcDate = parseISO(`${dateString}T00:00:00Z`) // UTC として明示的に解析
      
      // 無効な日付をチェック
      if (isNaN(utcDate.getTime())) {
        console.warn('無効な日付形式:', dateString)
        return null
      }
      
      // UTC日付をJST（UTC+9時間）に変換
      const jstDate = new Date(utcDate.getTime() + (9 * 60 * 60 * 1000))
      
      // その日の00:00:00に正規化して返す
      return startOfDay(jstDate)
      
    } catch (error) {
      console.error('JST日付変換エラー:', dateString, error)
      return null
    }
  }
  
  // JST基準の今日の日付を取得する関数
  const getJSTToday = (): Date => {
    const now = new Date()
    const jstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000)) // UTC+9
    return startOfDay(jstNow)
  }
  
  // 統一された日付解析関数（JST表示対応版）
  const parseWithFallback = (dateString: string): Date | null => {
    // JST日付解析を使用
    const result = parseToJST(dateString)
    if (result) return result
    
    // フォールバック: 標準のdate-fns処理
    try {
      console.warn('標準日付解析でフォールバック:', dateString)
      return startOfDay(parseISO(dateString))
    } catch (error) {
      console.error('日付解析完全失敗:', dateString, error)
      return null
    }
  }

  const chartData = useMemo(() => {
    if (hierarchicalTasks.length === 0) return null

    // タスクの日付範囲をJSTで統一的に計算
    const taskDates = hierarchicalTasks
      .filter(task => !task.isVegetableHeader)
      .flatMap(task => {
        const startDate = parseWithFallback(task.start)
        const endDate = parseWithFallback(task.end)
        
        if (!startDate || !endDate) {
          console.warn('タスク日付解析失敗:', { task: task.name, start: task.start, end: task.end })
          return []
        }
        
        return [startDate, endDate]
      })

    // チャート範囲をJST基準で統一的に計算
    const chartStart = startDate ? parseToJST(startDate) : (taskDates.length > 0 ? startOfDay(new Date(Math.min(...taskDates.map(d => d.getTime())))) : getJSTToday())
    const chartEnd = endDate ? parseToJST(endDate) : (taskDates.length > 0 ? startOfDay(new Date(Math.max(...taskDates.map(d => d.getTime())))) : addDays(getJSTToday(), 30))
    
    if (!chartStart || !chartEnd) {
      console.error('チャート日付範囲の解析に失敗:', { startDate, endDate })
      return null
    }
    
    const totalDays = differenceInDays(chartEnd, chartStart) + 1
    
    console.log('🔍 JST基準チャート日付範囲:', {
      入力開始日: startDate,
      入力終了日: endDate,
      JST開始日: chartStart.toISOString(),
      JST終了日: chartEnd.toISOString(),
      JST開始日表示: format(chartStart, 'yyyy-MM-dd (E)', { locale: ja }),
      JST終了日表示: format(chartEnd, 'yyyy-MM-dd (E)', { locale: ja }),
      タスク数: taskDates.length / 2,
      総日数: totalDays
    })
    
    // 表示モードに応じてスケールを調整
    let dayWidth: number
    let step: number
    let dateFormat: string
    
    if (viewUnit === 'day') {
      dayWidth = 24 // 日単位：各日に十分な幅
      step = 1
      dateFormat = 'MM/dd'
    } else if (viewUnit === 'week') {
      dayWidth = 20 // 週単位
      step = 7
      dateFormat = 'MM/dd'
    } else { // month
      dayWidth = 6 // 月単位相当の幅を調整
      step = 15 // 約半月ごとでより細かく
      dateFormat = 'MM/dd'
    }

    // Generate hierarchical date headers
    const dateHeaders = []
    const yearMonthHeaders = []
    const dayHeaders = []
    const weekdayHeaders = []
    
    let lastYearMonth = null
    
    console.log('🔍 JST日付ヘッダー生成開始:', {
      JSTチャート開始: chartStart.toISOString(),
      JSTチャート開始表示: format(chartStart, 'yyyy-MM-dd (E)', { locale: ja }),
      総日数: totalDays,
      dayWidth,
      step
    })

    for (let i = 0; i < totalDays; i++) {
      const date = addDays(chartStart, i)
      const currentYear = getYear(date)
      const currentMonth = getMonth(date)
      const currentYearMonth = `${currentYear}-${currentMonth}`
      const dayOfWeek = getDay(date)
      const isHoliday = isWeekend(date)
      
      if (i < 5) {
        console.log(`🗺 JST日付ヘッダー ${i}:`, {
          JST日付: date.toISOString(),
          JST日付表示: format(date, 'yyyy-MM-dd (E)', { locale: ja }),
          曜日コード: dayOfWeek,
          休日フラグ: isHoliday,
          チャート開始日からの日数: i
        })
      }
      
      // 日ヘッダーは毎日追加
      dayHeaders.push({
        date,
        dayOfMonth: format(date, 'd'),
        isHoliday,
        position: i * dayWidth,
        width: dayWidth
      })
      
      // 曜日ヘッダー
      weekdayHeaders.push({
        date,
        weekday: ['日', '月', '火', '水', '木', '金', '土'][dayOfWeek],
        isHoliday,
        position: i * dayWidth,
        width: dayWidth
      })
      
      // 年月ヘッダー（年月が変わったときのみ）
      if (lastYearMonth !== currentYearMonth) {
        const monthStart = startOfMonth(date)
        const monthStartInRange = Math.max(0, differenceInDays(monthStart, chartStart))
        const monthEndInRange = Math.min(totalDays - 1, differenceInDays(addDays(monthStart, 31), chartStart))
        const monthWidth = (monthEndInRange - monthStartInRange + 1) * dayWidth
        
        yearMonthHeaders.push({
          yearMonth: format(date, 'yyyy/MM', { locale: ja }),
          position: monthStartInRange * dayWidth,
          width: Math.max(monthWidth, 60) // 最低幅を設定
        })
        lastYearMonth = currentYearMonth
      }
    }
    
    // 表示単位に応じた日ヘッダーのフィルタリング
    const filteredDayHeaders = dayHeaders.filter((_, index) => {
      if (viewUnit === 'day') {
        return true // 日単位は全て表示
      } else if (viewUnit === 'week') {
        return index % 7 === 0 // 週単位は7日おき
      } else {
        return index % 15 === 0 // 月単位は15日おき
      }
    })
    
    const filteredWeekdayHeaders = weekdayHeaders.filter((_, index) => {
      if (viewUnit === 'day') {
        return true
      } else if (viewUnit === 'week') {
        return index % 7 === 0
      } else {
        return index % 15 === 0
      }
    })

    // Process hierarchical tasks - filter only tasks within the display range
    const processedTasks = hierarchicalTasks
      .filter(task => {
        const taskStart = parseWithFallback(task.start)
        const taskEnd = parseWithFallback(task.end)
        if (!taskStart || !taskEnd) return false
        // Show task if it overlaps with the chart range
        return taskStart <= chartEnd && taskEnd >= chartStart
      })
      .map(task => {
        const taskStart = parseWithFallback(task.start)
        const taskEnd = parseWithFallback(task.end)
        
        if (!taskStart || !taskEnd) {
          console.warn('タスク日付がnull:', task)
          return null
        }
        
        const startOffset = differenceInDays(taskStart, chartStart)
        const taskDuration = differenceInDays(taskEnd, taskStart) + 1
        
        // 🎯 プロット位置を2日右にずらして表示調整
        const DISPLAY_OFFSET_DAYS = 2
        const adjustedStartOffset = startOffset + DISPLAY_OFFSET_DAYS
        
        // Adjust left position and width for tasks that start before or end after the chart range
        const adjustedLeft = Math.max(0, adjustedStartOffset * dayWidth)
        const adjustedWidth = taskDuration * dayWidth
        
        // Calculate clipped width based on chart boundaries
        let clippedWidth = adjustedWidth
        let clippedLeft = adjustedLeft
        
        // If task starts before chart, adjust left and width
        if (adjustedStartOffset < 0) {
          clippedLeft = 0
          clippedWidth = adjustedWidth + (adjustedStartOffset * dayWidth)
        }
        
        // If task extends beyond chart, clip the width
        const taskEndOffset = adjustedStartOffset + taskDuration - 1
        if (taskEndOffset >= totalDays) {
          const excessDays = taskEndOffset - totalDays + 1
          clippedWidth = clippedWidth - (excessDays * dayWidth)
        }
        
        // Ensure minimum width for visibility
        clippedWidth = Math.max(20, clippedWidth)
        
        return {
          ...task,
          startOffset,
          taskDuration,
          left: clippedLeft,
          width: clippedWidth,
          color: task.color || '#3b82f6',
          formattedStart: format(taskStart, 'yyyy/MM/dd', { locale: ja }),
          formattedEnd: format(taskEnd, 'yyyy/MM/dd', { locale: ja })
        }
      })
      .filter(task => task !== null) // nullになったタスクを除外

    // 作業レポートデータの処理
    const processedReports = workReports
      .filter(report => {
        // work_dateが存在し、有効な日付形式かをチェック
        if (!report.work_date) return false
        const reportDate = parseWithFallback(report.work_date)
        if (!reportDate) {
          console.warn('無効な作業日付をスキップ:', report.work_date)
          return false
        }
        return reportDate >= chartStart && reportDate <= chartEnd
      })
      .map(report => {
        const reportDate = parseWithFallback(report.work_date)
        if (!reportDate) {
          console.warn('作業レポート日付解析失敗:', report.work_date)
          return null
        }
        
        try {
          const dateOffset = differenceInDays(reportDate, chartStart)
          // 🎯 作業報告プロット位置も2日右にずらして表示調整
          const REPORT_DISPLAY_OFFSET_DAYS = 2
          const adjustedDateOffset = dateOffset + REPORT_DISPLAY_OFFSET_DAYS
          const position = adjustedDateOffset * dayWidth
          
          // 作業種類に応じた色とアイコン
          const workTypeConfig = {
            seeding: { color: '#10b981', icon: '🌱', label: '播種' },
            planting: { color: '#3b82f6', icon: '🌿', label: '定植' },
            fertilizing: { color: '#8b5cf6', icon: '🧪', label: '施肥' },
            watering: { color: '#06b6d4', icon: '💧', label: '灌水' },
            weeding: { color: '#eab308', icon: '🌾', label: '除草' },
            pruning: { color: '#f97316', icon: '✂️', label: '整枝' },
            harvesting: { color: '#ef4444', icon: '🍅', label: '収穫' },
            other: { color: '#6b7280', icon: '⚡', label: 'その他' }
          }
          
          const config = workTypeConfig[report.work_type] || workTypeConfig.other
          
          return {
            ...report,
            position,
            config,
            // ツールチップ用の詳細データ
            details: {
              cost: 0, // 会計データベースから取得
              harvest: report.harvest_amount,
              revenue: report.expected_revenue,
              notes: report.work_notes
            }
          }
        } catch (error) {
          console.warn('作業レポート処理エラー:', report, error)
          return null
        }
      })
      .filter(report => report !== null) // nullになったレポートを除外

    return {
      chartStart,
      chartEnd,
      totalDays,
      dayWidth,
      step,
      yearMonthHeaders,
      dayHeaders: filteredDayHeaders,
      weekdayHeaders: filteredWeekdayHeaders,
      processedTasks,
      processedReports,
      totalWidth: totalDays * dayWidth
    }
  }, [hierarchicalTasks, workReports, startDate, endDate, viewUnit, selectedVegetable, selectedPriority, refreshTrigger])
  
  React.useEffect(() => {
    // 親コンポーネントでのデータ再取得に依存するため、
    // ここでは視覚的フィードバックのみ提供
    setIsUpdating(true)
    setRefreshTrigger(prev => prev + 1)
    
    const timer = setTimeout(() => {
      setIsUpdating(false)
    }, 500) // 少し長めにして視覚的フィードバックを確保
    
    return () => clearTimeout(timer)
  }, [selectedVegetable, selectedPriority, customStartDate, customEndDate])

  // 野菜の展開/折りたたみトグル
  const toggleVegetableExpansion = (vegetableId: string) => {
    setExpandedVegetables(prev => {
      const newSet = new Set(prev)
      if (newSet.has(vegetableId)) {
        newSet.delete(vegetableId)
      } else {
        newSet.add(vegetableId)
      }
      return newSet
    })
  }

  if (!chartData || hierarchicalTasks.length === 0) {
    return (
      <Card className={className}>
        {/* ヘッダーとフィルターは常に表示 */}
        <CardHeader className="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 text-white rounded-t-lg">
          <div className="space-y-4">
            {/* タイトル行 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold">🗓️ 野菜別ガントチャート & 表示コントロール</CardTitle>
                  <p className="text-sm text-blue-100 mt-1 opacity-90">
                    階層表示・フィルタリング・期間設定を統合管理
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                {isUpdating && (
                  <div className="bg-amber-500/20 px-3 py-2 rounded-lg backdrop-blur-sm border border-amber-300/30">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="font-medium text-amber-100">更新中...</span>
                    </div>
                  </div>
                )}
                <div className="bg-white/20 px-3 py-2 rounded-lg backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    <span className="font-medium">{filteredTasks.length}/{tasks.length}タスク</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 統合コントロール行 */}
            <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-white/20">
              {/* 野菜選択 */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">🥬野菜:</span>
                <Select value={selectedVegetable} onValueChange={onVegetableChange}>
                  <SelectTrigger className="w-40 h-8 bg-white/90 border-white/50 text-gray-800 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">すべて</SelectItem>
                    {vegetables.map(vegetable => (
                      <SelectItem key={vegetable.id} value={vegetable.id}>
                        {vegetable.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* 優先度選択 */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">⚡優先度:</span>
                <Select value={selectedPriority} onValueChange={onPriorityChange}>
                  <SelectTrigger className="w-32 h-8 bg-white/90 border-white/50 text-gray-800 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">すべて</SelectItem>
                    <SelectItem value="high">高</SelectItem>
                    <SelectItem value="medium">中</SelectItem>
                    <SelectItem value="low">低</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* 期間設定 */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">📅期間:</span>
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => onDateRangeChange?.(e.target.value, customEndDate)}
                  className="w-36 h-8 bg-white/90 border-white/50 text-gray-800 text-sm"
                  placeholder="開始日"
                />
                <span className="text-white/80">〜</span>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => onDateRangeChange?.(customStartDate, e.target.value)}
                  className="w-36 h-8 bg-white/90 border-white/50 text-gray-800 text-sm"
                  placeholder="終了日"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        
        {/* 空の状態のコンテンツ部分のみ */}
        <CardContent className="p-6">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📊</div>
            <p className="text-lg font-semibold text-gray-700 mb-2">
              表示するタスクがありません
            </p>
            <p className="text-sm text-gray-500">
              フィルター条件を変更するか、タスクを追加してください
            </p>
            <div className="mt-4 text-xs text-gray-400">
              利用可能なタスク: {tasks.length}件 | 野菜: {vegetables.length}種類
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const { yearMonthHeaders, dayHeaders, weekdayHeaders, processedTasks, processedReports, totalWidth, dayWidth, step } = chartData

  return (
    <Card className={className}>
        {/* 改善されたヘッダーデザイン */}
        <CardHeader className="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 text-white rounded-t-lg">
          <div className="space-y-4">
            {/* タイトル行 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold">🗓️ 野菜別ガントチャート & 表示コントロール</CardTitle>
                  <p className="text-sm text-blue-100 mt-1 opacity-90">
                    階層表示・フィルタリング・期間設定を統合管理
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                {isUpdating && (
                  <div className="bg-amber-500/20 px-3 py-2 rounded-lg backdrop-blur-sm border border-amber-300/30">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="font-medium text-amber-100">更新中...</span>
                    </div>
                  </div>
                )}
                <div className="bg-white/20 px-3 py-2 rounded-lg backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    <span className="font-medium">{filteredTasks.length}/{tasks.length}タスク</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 統合コントロール行 */}
            <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-white/20">
              {/* 野菜選択 */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">🥬野菜:</span>
                <Select value={selectedVegetable} onValueChange={onVegetableChange}>
                  <SelectTrigger className="w-40 h-8 bg-white/90 border-white/50 text-gray-800 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">すべて</SelectItem>
                    {vegetables.map(vegetable => (
                      <SelectItem key={vegetable.id} value={vegetable.id}>
                        {vegetable.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* 優先度選択 */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">⚡優先度:</span>
                <Select value={selectedPriority} onValueChange={onPriorityChange}>
                  <SelectTrigger className="w-32 h-8 bg-white/90 border-white/50 text-gray-800 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">すべて</SelectItem>
                    <SelectItem value="high">高</SelectItem>
                    <SelectItem value="medium">中</SelectItem>
                    <SelectItem value="low">低</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* 期間設定 */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">📅期間:</span>
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => onDateRangeChange?.(e.target.value, customEndDate)}
                  className="w-36 h-8 bg-white/90 border-white/50 text-gray-800 text-sm"
                  placeholder="開始日"
                />
                <span className="text-white/80">〜</span>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => onDateRangeChange?.(customStartDate, e.target.value)}
                  className="w-36 h-8 bg-white/90 border-white/50 text-gray-800 text-sm"
                  placeholder="終了日"
                />
              </div>
            </div>
          </div>
        </CardHeader>
      <CardContent className="p-0">
        <div className="relative">
          {/* スクロール可能エリア */}
          <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
            <div 
              className="relative min-h-[400px] bg-white"
              style={{ width: Math.max(1200, totalWidth + 420) }}
            >
              {/* Header - 階層化された固定ヘッダー */}
              <div className="sticky top-0 z-40 bg-white border-b shadow-sm flex">
                {/* タスク情報ヘッダー - 上下左右固定 */}
                <div className="sticky top-0 left-0 z-50 bg-white border-r border-gray-200 shadow-sm">
                  <div className="flex" style={{ height: viewUnit === 'day' ? '84px' : '68px' }}>
                    <div className="w-80 px-2 py-1 border-r border-gray-100 font-bold text-sm text-gray-800 flex items-center justify-center bg-gradient-to-r from-gray-50 to-gray-100">
                      野菜・タスク名 (階層表示)
                    </div>
                    <div className="w-24 px-2 py-1 border-r border-gray-100 font-bold text-xs text-gray-800 text-center flex items-center justify-center bg-gradient-to-r from-gray-50 to-gray-100">
                      開始日
                    </div>
                    <div className="w-24 px-2 py-1 border-r border-gray-100 font-bold text-xs text-gray-800 text-center flex items-center justify-center bg-gradient-to-r from-gray-50 to-gray-100">
                      終了日
                    </div>
                    <div className="w-20 px-2 py-1 border-r border-gray-100 font-bold text-xs text-gray-800 text-center flex items-center justify-center bg-gradient-to-r from-gray-50 to-gray-100">
                      進捗
                    </div>
                    <div className="w-16 px-2 py-1 border-r border-gray-100 font-bold text-xs text-gray-800 text-center flex items-center justify-center bg-gradient-to-r from-gray-50 to-gray-100">
                      優先度
                    </div>
                    <div className="w-20 px-2 py-1 font-bold text-xs text-gray-800 text-center flex items-center justify-center bg-gradient-to-r from-gray-50 to-gray-100">
                      担当者
                    </div>
                  </div>
                </div>
                
                {/* 時間軸ヘッダー - スクロール（3行構造） */}
                <div className="flex-1 sticky top-0 relative bg-white overflow-hidden">
                  {/* 年月ヘッダー */}
                  <div className="relative h-8 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-blue-100">
                    {yearMonthHeaders.map((yearMonthHeader, index) => (
                      <div
                        key={`yearmonth-${index}`}
                        className="absolute top-0 h-full flex items-center justify-center border-r border-blue-200 bg-gradient-to-r from-blue-100 to-blue-200"
                        style={{
                          left: yearMonthHeader.position,
                          width: yearMonthHeader.width
                        }}
                      >
                        <span className="font-bold text-sm text-blue-900">
                          {yearMonthHeader.yearMonth}
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  {/* 日ヘッダー */}
                  <div className="relative h-7 border-b border-gray-100 bg-gray-50">
                    {dayHeaders.map((dayHeader, index) => (
                      <div
                        key={`day-${index}`}
                        className={`absolute top-0 h-full flex items-center justify-center border-r border-gray-100 ${
                          dayHeader.isHoliday 
                            ? 'bg-red-50 text-red-600 font-semibold' 
                            : 'bg-white text-gray-700'
                        }`}
                        style={{
                          left: dayHeader.position,
                          width: dayHeader.width
                        }}
                      >
                        <span className="text-xs">
                          {dayHeader.dayOfMonth}
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  {/* 曜日ヘッダー（日単位のみ） */}
                  {viewUnit === 'day' && (
                    <div className="relative h-5 border-b border-gray-100 bg-gray-25">
                      {weekdayHeaders.map((weekdayHeader, index) => (
                        <div
                          key={`weekday-${index}`}
                          className={`absolute top-0 h-full flex items-center justify-center border-r border-gray-100 ${
                            weekdayHeader.isHoliday 
                              ? 'bg-red-100 text-red-700 font-bold' 
                              : 'bg-white text-gray-600'
                          }`}
                          style={{
                            left: weekdayHeader.position,
                            width: weekdayHeader.width
                          }}
                        >
                          <span className="text-xs">
                            {weekdayHeader.weekday}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Tasks */}
              <div className="relative">
                {processedTasks.map((task, taskIndex) => {
                  const priorityRowStyle = getPriorityRowColor(task.priority)
                  return (
                    <div
                      key={task.id}
                      className={`flex border-b hover:bg-blue-50/30 transition-colors duration-200 ${priorityRowStyle}`}
                      style={{ minHeight: viewUnit === 'day' ? 64 : 56 }}
                    >
                      {/* Task info - 固定列 */}
                      <div className="sticky left-0 z-20 bg-white/95 border-r border-gray-200 shadow-sm">
                        <div className="flex" style={{ height: viewUnit === 'day' ? '64px' : '56px' }}>
                          {/* 階層タスク名表示 */}
                          <div 
                            className={`w-80 p-3 border-r border-gray-100 flex items-center transition-colors duration-200 select-none ${
                              task.isVegetableHeader 
                                ? 'bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 cursor-pointer border-l-4 border-l-green-500' 
                                : 'hover:bg-blue-50 cursor-pointer'
                            }`}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              if (task.isVegetableHeader && task.vegetableGroup) {
                                toggleVegetableExpansion(task.vegetableGroup.vegetable.id)
                              } else {
                                onTaskClick?.(task)
                              }
                            }}
                            onMouseDown={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                            }}
                            style={{ 
                              userSelect: 'none',
                              paddingLeft: task.indentLevel ? `${12 + (task.indentLevel * 24)}px` : '12px'
                            }}
                          >
                            {task.isVegetableHeader ? (
                              // 野菜ヘッダー表示
                              <>
                                <div className="flex items-center mr-3">
                                  {task.vegetableGroup?.isExpanded ? (
                                    <ChevronDown className="w-5 h-5 text-green-600" />
                                  ) : (
                                    <ChevronRight className="w-5 h-5 text-green-600" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                                      <span className="text-white text-lg">🥬</span>
                                    </div>
                                    <div>
                                      <div className="text-lg font-bold text-green-800">
                                        {task.name}
                                      </div>
                                      <div className="flex items-center gap-4 text-sm">
                                        <div className="flex items-center gap-1 text-green-600">
                                          <BarChart3 className="w-4 h-4" />
                                          <span className="font-medium">{task.vegetableGroup?.taskCount || 0}タスク</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <div className="w-16 bg-gray-200 rounded-full h-2">
                                            <div 
                                              className="bg-green-500 h-2 rounded-full transition-all"
                                              style={{ width: `${task.progress}%` }}
                                            />
                                          </div>
                                          <span className="text-green-700 font-semibold text-xs">{task.progress}%</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </>
                            ) : (
                              // 通常タスク表示
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-blue-400 rounded-full" />
                                  <div className="text-sm font-medium text-gray-900 truncate">
                                    {task.name}
                                  </div>
                                  <Badge 
                                    variant="outline" 
                                    className={`text-xs ${
                                      task.priority === 'high' ? 'bg-red-50 text-red-700 border-red-200' :
                                      task.priority === 'medium' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                      'bg-gray-50 text-gray-600 border-gray-200'
                                    }`}
                                  >
                                    {task.priority === 'high' ? '高' :
                                     task.priority === 'medium' ? '中' : '低'}
                                  </Badge>
                                </div>
                                <div className="text-xs text-gray-500 mt-1 ml-4">
                                  進捗: {task.progress}% | {task.assignedUser?.name || '未割当'}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* 開始日 */}
                          <div className="hidden lg:flex w-24 p-3 border-r border-gray-100 items-center justify-center">
                            <div className="text-xs text-gray-600 text-center">
                              {(task as any).formattedStart}
                            </div>
                          </div>
                          
                          {/* 終了日 */}
                          <div className="hidden lg:flex w-24 p-3 border-r border-gray-100 items-center justify-center">
                            <div className="text-xs text-gray-600 text-center">
                              {(task as any).formattedEnd}
                            </div>
                          </div>
                          
                          {/* 進捗率 */}
                          <div className="w-16 lg:w-20 p-2 lg:p-3 border-r border-gray-100 flex items-center justify-center">
                            <div className="text-center">
                              <div className="text-xs lg:text-sm font-bold text-gray-800">{task.progress}%</div>
                              <div className="w-8 lg:w-full bg-gray-200 rounded-full h-1 mt-1">
                                <div 
                                  className="bg-blue-500 h-1 rounded-full transition-all"
                                  style={{ width: `${task.progress}%` }}
                                />
                              </div>
                            </div>
                          </div>
                          
                          {/* 優先度 */}
                          <div className="hidden sm:flex w-16 p-3 border-r border-gray-100 items-center justify-center">
                            <div className={`px-1.5 lg:px-2 py-1 rounded-full text-xs font-medium ${
                              task.priority === 'high' ? 'bg-red-100 text-red-800' :
                              task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {task.priority === 'high' ? '高' :
                               task.priority === 'medium' ? '中' : '低'}
                            </div>
                          </div>
                          
                          {/* 担当者 */}
                          <div className="hidden lg:flex w-20 p-3 items-center justify-center">
                            <div className="text-xs text-gray-600 text-center truncate">
                              {task.assignedUser?.name || '未割当'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Timeline - スクロールエリア */}
                      <div className="flex-1 relative bg-white">
                        {/* Grid lines with weekend highlighting */}
                        {Array.from({ length: Math.ceil(totalWidth / dayWidth) + 1 }).map((_, dayIndex) => {
                          const currentDay = addDays(chartData.chartStart, dayIndex)
                          const isHoliday = isWeekend(currentDay)
                          
                          // Show vertical lines based on step
                          if (dayIndex % step === 0) {
                            return (
                              <div
                                key={`line-${dayIndex}`}
                                className={`absolute top-0 bottom-0 border-r ${
                                  isHoliday ? 'border-gray-200' : 'border-gray-100'
                                }`}
                                style={{ left: dayIndex * dayWidth }}
                              />
                            )
                          }
                          
                          // Add background color for weekends
                          if (viewUnit === 'day' && isHoliday) {
                            return (
                              <div
                                key={`weekend-${dayIndex}`}
                                className="absolute top-0 bottom-0 bg-gray-50/40 pointer-events-none"
                                style={{ 
                                  left: dayIndex * dayWidth, 
                                  width: dayWidth 
                                }}
                              />
                            )
                          }
                          
                          return null
                        })}

                        {/* Task bar - 野菜ヘッダーかタスクかで表示を変更 */}
                        {task.isVegetableHeader ? (
                          // 野菜ヘッダーのバー表示
                          <div
                            className="absolute top-2 h-12 rounded-lg flex items-center px-4 text-white text-sm font-bold shadow-lg border-2 border-white/30 select-none"
                            style={{
                              left: 0,
                              width: totalWidth,
                              backgroundColor: '#10b981',
                              background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
                              userSelect: 'none'
                            }}
                            title={`${task.vegetableGroup?.vegetable.name}\n全体進捗: ${task.progress}%\nタスク数: ${task.vegetableGroup?.taskCount || 0}\n作業レポート数: ${task.vegetableGroup?.workReports.length || 0}`}
                          >
                            {/* Progress indicator */}
                            <div
                              className="absolute top-0 left-0 h-full bg-white/20 rounded-l-lg"
                              style={{ width: `${task.progress}%` }}
                            />
                            <div className="relative z-10 flex items-center justify-between w-full">
                              <span className="font-bold text-white">
                                🥬 {task.vegetableGroup?.vegetable.name}
                              </span>
                              <span className="text-sm bg-white/20 px-2 py-1 rounded">
                                {task.progress}% ({task.vegetableGroup?.taskCount || 0}タスク)
                              </span>
                            </div>
                          </div>
                        ) : (
                          // 通常タスクのバー表示
                          <div
                            className="absolute top-3 h-10 rounded-lg flex items-center px-3 text-white text-sm font-medium shadow-lg cursor-pointer hover:shadow-xl hover:scale-105 transition-all duration-200 border border-white/30 select-none"
                            style={{
                              left: task.left,
                              width: Math.max(task.width, 40),
                              backgroundColor: task.color,
                              userSelect: 'none'
                            }}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              onTaskClick?.(task)
                            }}
                            onMouseDown={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                            }}
                            title={`${task.name}\n進捗率: ${task.progress}%\n期間: ${(task as any).formattedStart} ～ ${(task as any).formattedEnd}\n担当者: ${task.assignedUser?.name || '未割当'}\n優先度: ${task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'}`}
                          >
                            {/* Progress indicator */}
                            <div
                              className="absolute top-0 left-0 h-full bg-white/25 rounded-l-lg"
                              style={{ width: `${task.progress}%` }}
                            />
                            <span className="relative z-10 truncate font-semibold select-none" style={{ userSelect: 'none' }}>
                              {task.progress}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

            {/* Work Report Plots */}
            {processedReports && processedReports.map((report, index) => {
              // レポートに対応するタスクを見つける（より柔軟なマッチング）
              const matchingTaskIndex = processedTasks.findIndex(task => {
                // 同じ野菜であることを最優先でチェック
                if (task.vegetable.id !== report.vegetable_id) return false
                
                // 作業種類とタスク名の大まかなマッチング
                const workTypeMatch = {
                  seeding: ['播種', '育苗', '種まき'],
                  planting: ['定植', '植付', '移植'],
                  fertilizing: ['施肥', '肥料', '追肥'],
                  watering: ['灌水', '水やり', '散水'],
                  weeding: ['除草', '草取り'],
                  pruning: ['整枝', '摘苽', '剪定', '摘葉'],
                  harvesting: ['収穫'],
                  other: ['その他', '管理', '点検']
                }
                
                const matchingKeywords = workTypeMatch[report.work_type] || []
                return matchingKeywords.some(keyword => task.name.includes(keyword))
              })
              
              // マッチするタスクがない場合は、同じ野菜の最初のタスクに表示
              const taskIndex = matchingTaskIndex !== -1 ? matchingTaskIndex : 
                               processedTasks.findIndex(task => task.vegetable.id === report.vegetable_id)
              
              if (taskIndex === -1) return null
              
              const headerHeight = viewUnit === 'day' ? 84 : 68
              const taskRowHeight = viewUnit === 'day' ? 64 : 56
              const verticalPosition = headerHeight + (taskIndex * taskRowHeight) + (taskRowHeight / 2) - 8
              
              return (
                <div
                  key={`report-${report.id}-${index}`}
                  className="absolute z-30"
                  style={{ 
                    left: FIXED_COLUMNS_WIDTH + report.position,
                    top: verticalPosition
                  }}
                >
                  <WorkReportPopover
                    report={report}
                    onView={onWorkReportView}
                    onEdit={onWorkReportEdit}
                  >
                    <div className="relative cursor-pointer">
                      {/* Work report marker */}
                      <div
                        className="w-5 h-5 rounded-full border-2 border-white shadow-lg hover:shadow-xl hover:scale-125 transition-all duration-200 select-none"
                        style={{ backgroundColor: report.config.color, userSelect: 'none' }}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                        }}
                      >
                      </div>
                      {/* Work type icon */}
                      <div className="absolute -top-1 -left-1 text-sm pointer-events-none flex items-center justify-center w-6 h-6">
                        <span className="drop-shadow-sm">{report.config.icon}</span>
                      </div>
                      {/* Date label */}
                      <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs bg-white border border-gray-200 rounded px-1 py-0.5 shadow-sm whitespace-nowrap pointer-events-none">
                        {format(parseWithFallback(report.work_date) || new Date(), 'MM/dd', { locale: ja })}
                      </div>
                    </div>
                  </WorkReportPopover>
                </div>
              )
            })}

              {/* Today line */}
              {(() => {
                // 今日の日付をJST基準で処理
                const todayJST = getJSTToday()
                
                // チャート開始日と同じJST処理で統一
                const chartStartDate = chartData.chartStart
                
                const todayOffset = differenceInDays(todayJST, chartStartDate)
                // 🎯 今日線も2日右にずらして表示調整
                const TODAY_DISPLAY_OFFSET_DAYS = 2
                const adjustedTodayOffset = todayOffset + TODAY_DISPLAY_OFFSET_DAYS
                
                console.log('🔍 JST今日線の位置計算:', {
                  現在時刻UTC: new Date().toISOString(),
                  現在時刻JST: format(todayJST, 'yyyy-MM-dd (E) HH:mm:ss', { locale: ja }),
                  JST今日: todayJST.toISOString(),
                  JST今日表示: format(todayJST, 'yyyy-MM-dd (E)', { locale: ja }),
                  JSTチャート開始: chartData.chartStart.toISOString(),
                  JSTチャート開始表示: format(chartData.chartStart, 'yyyy-MM-dd (E)', { locale: ja }),
                  日数差: todayOffset,
                  調整後日数差: adjustedTodayOffset,
                  総日数: chartData.totalDays,
                  計算確認: `${format(todayJST, 'yyyy-MM-dd')} - ${format(chartStartDate, 'yyyy-MM-dd')} = ${todayOffset} days (調整後: ${adjustedTodayOffset})`
                })
                
                // 今日が表示範囲内にある場合のみ表示
                if (adjustedTodayOffset >= 0 && adjustedTodayOffset <= chartData.totalDays) {
                  const todayPosition = FIXED_COLUMNS_WIDTH + (adjustedTodayOffset * dayWidth)
                  const headerHeight = viewUnit === 'day' ? 84 : 68 // ヘッダーの高さ調整（年月8px + 日7px + 曜日5px = 20px、曜日なし時15px）
                  
                  return (
                    <div
                      className="absolute bottom-0 w-0.5 bg-red-500 z-30 pointer-events-none shadow-lg"
                      style={{ 
                        left: todayPosition,
                        top: headerHeight + 'px'
                      }}
                    >
                      <div className="absolute -top-2 -left-8 bg-red-500 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap font-medium">
                        今日 {format(todayJST, 'MM/dd', { locale: ja })}
                      </div>
                    </div>
                  )
                }
                return null
              })()}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default GanttChart