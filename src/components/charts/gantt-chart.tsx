'use client'

import React, { useMemo } from 'react'
import { format, differenceInDays, addDays, parseISO, isWeekend, getDay, startOfYear, startOfMonth, isSameYear, isSameMonth, getYear, getMonth } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

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
  estimated_cost?: number
  harvest_amount?: number
  expected_revenue?: number
}

interface GanttChartProps {
  tasks: GanttTask[]
  workReports?: WorkReport[]
  startDate?: string
  endDate?: string
  viewUnit?: 'day' | 'week' | 'month'
  className?: string
  onTaskClick?: (task: GanttTask) => void
}

export function GanttChart({ 
  tasks, 
  workReports = [],
  startDate, 
  endDate,
  viewUnit = 'day',
  className,
  onTaskClick
}: GanttChartProps) {
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
  const chartData = useMemo(() => {
    if (tasks.length === 0) return null

    // Calculate chart boundaries
    const taskDates = tasks.flatMap(task => [
      parseISO(task.start),
      parseISO(task.end)
    ])
    
    const chartStart = startDate ? parseISO(startDate) : new Date(Math.min(...taskDates.map(d => d.getTime())))
    const chartEnd = endDate ? parseISO(endDate) : new Date(Math.max(...taskDates.map(d => d.getTime())))
    
    const totalDays = differenceInDays(chartEnd, chartStart) + 1
    
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
    
    for (let i = 0; i < totalDays; i++) {
      const date = addDays(chartStart, i)
      const currentYear = getYear(date)
      const currentMonth = getMonth(date)
      const currentYearMonth = `${currentYear}-${currentMonth}`
      const dayOfWeek = getDay(date)
      const isHoliday = isWeekend(date)
      
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

    // Process tasks - filter only tasks within the display range
    const processedTasks = tasks
      .filter(task => {
        const taskStart = parseISO(task.start)
        const taskEnd = parseISO(task.end)
        // Show task if it overlaps with the chart range
        return taskStart <= chartEnd && taskEnd >= chartStart
      })
      .map(task => {
        const taskStart = parseISO(task.start)
        const taskEnd = parseISO(task.end)
        const startOffset = differenceInDays(taskStart, chartStart)
        const taskDuration = differenceInDays(taskEnd, taskStart) + 1
        
        // Adjust left position and width for tasks that start before or end after the chart range
        const adjustedLeft = Math.max(0, startOffset * dayWidth)
        const adjustedWidth = taskDuration * dayWidth
        
        // Calculate clipped width based on chart boundaries
        let clippedWidth = adjustedWidth
        let clippedLeft = adjustedLeft
        
        // If task starts before chart, adjust left and width
        if (startOffset < 0) {
          clippedLeft = 0
          clippedWidth = adjustedWidth + (startOffset * dayWidth)
        }
        
        // If task extends beyond chart, clip the width
        const taskEndOffset = startOffset + taskDuration - 1
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

    // 作業レポートデータの処理
    const processedReports = workReports
      .filter(report => {
        const reportDate = parseISO(report.work_date)
        return reportDate >= chartStart && reportDate <= chartEnd
      })
      .map(report => {
        const reportDate = parseISO(report.work_date)
        const dateOffset = differenceInDays(reportDate, chartStart)
        const position = dateOffset * dayWidth
        
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
            cost: report.estimated_cost,
            harvest: report.harvest_amount,
            revenue: report.expected_revenue,
            notes: report.work_notes
          }
        }
      })

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
  }, [tasks, workReports, startDate, endDate, viewUnit])

  if (!chartData) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <p className="text-muted-foreground text-center">
            表示するタスクがありません
          </p>
        </CardContent>
      </Card>
    )
  }

  const { yearMonthHeaders, dayHeaders, weekdayHeaders, processedTasks, processedReports, totalWidth, dayWidth, step } = chartData

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>ガントチャート</CardTitle>
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
                    <div className="w-48 px-2 py-1 border-r border-gray-100 font-bold text-sm text-gray-800 flex items-center justify-center bg-gradient-to-r from-gray-50 to-gray-100">
                      タスク名
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
                          {/* タスク名 */}
                          <div 
                            className="w-48 p-3 border-r border-gray-100 flex items-center cursor-pointer hover:bg-blue-50 transition-colors duration-200" 
                            onClick={() => onTaskClick?.(task)}
                          >
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900 truncate mb-1">
                                {task.name}
                              </div>
                              <div className="text-xs text-gray-500 truncate">
                                {task.vegetable.name}
                              </div>
                            </div>
                          </div>
                          
                          {/* 開始日 */}
                          <div className="w-24 p-3 border-r border-gray-100 flex items-center justify-center">
                            <div className="text-xs text-gray-600 text-center">
                              {(task as any).formattedStart}
                            </div>
                          </div>
                          
                          {/* 終了日 */}
                          <div className="w-24 p-3 border-r border-gray-100 flex items-center justify-center">
                            <div className="text-xs text-gray-600 text-center">
                              {(task as any).formattedEnd}
                            </div>
                          </div>
                          
                          {/* 進捗率 */}
                          <div className="w-20 p-3 border-r border-gray-100 flex items-center justify-center">
                            <div className="text-center">
                              <div className="text-sm font-bold text-gray-800">{task.progress}%</div>
                              <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                                <div 
                                  className="bg-blue-500 h-1 rounded-full transition-all"
                                  style={{ width: `${task.progress}%` }}
                                />
                              </div>
                            </div>
                          </div>
                          
                          {/* 優先度 */}
                          <div className="w-16 p-3 border-r border-gray-100 flex items-center justify-center">
                            <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                              task.priority === 'high' ? 'bg-red-100 text-red-800' :
                              task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {task.priority === 'high' ? '高' :
                               task.priority === 'medium' ? '中' : '低'}
                            </div>
                          </div>
                          
                          {/* 担当者 */}
                          <div className="w-20 p-3 flex items-center justify-center">
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

                        {/* Task bar */}
                        <div
                          className="absolute top-3 h-10 rounded-lg flex items-center px-3 text-white text-sm font-medium shadow-lg cursor-pointer hover:shadow-xl hover:scale-105 transition-all duration-200 border border-white/30"
                          style={{
                            left: task.left,
                            width: Math.max(task.width, 40),
                            backgroundColor: task.color
                          }}
                          onClick={() => onTaskClick?.(task)}
                          title={`${task.name}\n進捗率: ${task.progress}%\n期間: ${(task as any).formattedStart} ～ ${(task as any).formattedEnd}\n担当者: ${task.assignedUser?.name || '未割当'}\n優先度: ${task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'}`}
                        >
                          {/* Progress indicator */}
                          <div
                            className="absolute top-0 left-0 h-full bg-white/25 rounded-l-lg"
                            style={{ width: `${task.progress}%` }}
                          />
                          <span className="relative z-10 truncate font-semibold">
                            {task.progress}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

            {/* Work Report Plots */}
            {processedReports && processedReports.map((report, index) => {
              // レポートに対応するタスクを見つける
              const matchingTaskIndex = processedTasks.findIndex(task => {
                // 野菜と作業種類でマッチング
                const workTypeMatch = {
                  seeding: ['播種・育苗'],
                  planting: ['定植'],
                  fertilizing: ['施肥'],
                  watering: ['灌水'],
                  weeding: ['除草'],
                  pruning: ['整枝・摘苽'],
                  harvesting: ['収穫'],
                  other: ['その他']
                }
                
                const matchingTaskNames = workTypeMatch[report.work_type] || []
                return task.vegetable.id === report.vegetable_id && 
                       matchingTaskNames.some(name => task.name.includes(name))
              })
              
              if (matchingTaskIndex === -1) return null
              
              const taskRow = matchingTaskIndex
              const verticalPosition = 48 + (taskRow * 48) + 24 // ヘッダーの後 + タスク高さ * インデックス + 中央寄せ
              
              return (
                <div
                  key={`report-${report.id}-${index}`}
                  className="absolute z-20 pointer-events-none"
                  style={{ 
                    left: 192 + report.position,
                    top: verticalPosition
                  }}
                >
                  <div className="relative">
                    {/* Work report marker - タスク列に正確に配置 */}
                    <div
                      className="w-4 h-4 rounded-full border-2 border-white shadow-lg cursor-pointer pointer-events-auto hover:scale-110 transition-transform duration-200"
                      style={{ backgroundColor: report.config.color }}
                      title={`${report.config.label} - ${format(parseISO(report.work_date), 'MM/dd', { locale: ja })}${report.details.cost ? `\nコスト: ¥${report.details.cost.toLocaleString()}` : ''}${report.details.harvest ? `\n収穫: ${report.details.harvest}kg` : ''}${report.details.revenue ? `\n売上: ¥${report.details.revenue.toLocaleString()}` : ''}${report.details.notes ? `\n備考: ${report.details.notes}` : ''}`}
                    >
                    </div>
                    {/* Work type icon - アイコンを中央に配置 */}
                    <div className="absolute -top-0.5 -left-0.5 text-xs pointer-events-none flex items-center justify-center">
                      {report.config.icon}
                    </div>
                  </div>
                </div>
              )
            })}

              {/* Today line */}
              {(() => {
                const today = new Date()
                const todayOffset = differenceInDays(today, chartData.chartStart)
                
                // 今日が表示範囲内にある場合のみ表示
                if (todayOffset >= 0 && todayOffset <= chartData.totalDays) {
                  const todayPosition = 352 + (todayOffset * dayWidth) // 352pxは固定列の幅
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
                        今日 {format(today, 'MM/dd', { locale: ja })}
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