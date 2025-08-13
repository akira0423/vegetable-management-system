'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog'
import { GanttChart } from '@/components/charts/gantt-chart'
import NewTaskForm from '@/components/forms/NewTaskForm'
import { unifiedTestData } from '@/lib/unified-test-data'
import { 
  Calendar, 
  Filter, 
  Download, 
  Plus, 
  RefreshCw, 
  Settings,
  ChevronDown,
  Search,
  CalendarDays,
  Sprout,
  MapPin,
  TrendingUp,
  Archive,
  BarChart3
} from 'lucide-react'
import { format, subMonths, addMonths, startOfMonth, endOfMonth, differenceInDays, parseISO, addDays } from 'date-fns'
import { ja } from 'date-fns/locale'

interface GanttTask {
  id: string
  name: string
  start: string
  end: string
  progress: number
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high'
  assignedUser?: {
    id: string
    name: string
  }
  vegetable: {
    id: string
    name: string
    variety: string
  }
  color?: string
}

interface Vegetable {
  id: string
  name: string
  variety: string
  status: string
}

const STATUS_COLORS = {
  pending: '#94a3b8',      // グレー
  in_progress: '#3b82f6',  // ブルー  
  completed: '#10b981',    // グリーン
  cancelled: '#ef4444',    // レッド
}

const PRIORITY_COLORS = {
  low: '#94a3b8',
  medium: '#f59e0b', 
  high: '#ef4444',
}

export default function GanttPage() {
  const [tasks, setTasks] = useState<GanttTask[]>([])
  const [vegetables, setVegetables] = useState<Vegetable[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  // フィルター状態
  const [selectedVegetable, setSelectedVegetable] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedPriority, setSelectedPriority] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  
  // 期間設定
  const [viewPeriod, setViewPeriod] = useState<'6months' | '1year' | '3years' | '5years'>('1year')
  const [viewUnit, setViewUnit] = useState<'day' | 'week' | 'month'>('day')
  const [currentDate, setCurrentDate] = useState(new Date())
  
  // タスク詳細モーダル
  const [selectedTask, setSelectedTask] = useState<GanttTask | null>(null)
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  
  // selectedTaskの変化を監視
  useEffect(() => {
    if (selectedTask) {
      setIsTaskModalOpen(true)
      console.log('Modal should open for task:', selectedTask.name)
    } else {
      setIsTaskModalOpen(false)
      console.log('Modal should close')
    }
  }, [selectedTask])
  
  // タブ状態管理
  const [activeTab, setActiveTab] = useState('filters')
  
  // 新規タスク作成モーダル
  const [showNewTaskModal, setShowNewTaskModal] = useState(false)
  
  // 期間計算
  const getDateRange = useCallback(() => {
    const now = currentDate
    let start: Date, end: Date

    switch (viewPeriod) {
      case '6months':
        // 半年間：基準月を中心とした6ヶ月（前3ヶ月、後3ヶ月）
        start = startOfMonth(subMonths(now, 3))
        end = endOfMonth(addMonths(now, 3))
        break
      case '1year':
        // 1年間：基準月を中心とした1年（前6ヶ月、後6ヶ月）
        start = startOfMonth(subMonths(now, 6))
        end = endOfMonth(addMonths(now, 6))
        break
      case '3years':
        // 3年間：基準月を中心とした3年（前18ヶ月、後18ヶ月）
        start = startOfMonth(subMonths(now, 18))
        end = endOfMonth(addMonths(now, 18))
        break
      case '5years':
      default:
        // 5年間：基準月を中心とした5年（前30ヶ月、後30ヶ月）
        start = startOfMonth(subMonths(now, 30))
        end = endOfMonth(addMonths(now, 30))
        break
    }

    return {
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd')
    }
  }, [viewPeriod, currentDate])

  // 作業レポート状態
  const [workReports, setWorkReports] = useState([])

  // データ読み込み
  useEffect(() => {
    fetchData()
  }, [])

  // フィルター変更時にデータを再取得
  useEffect(() => {
    if (tasks.length > 0) { // 初回読み込み後のフィルター変更のみ
      fetchData()
    }
  }, [selectedVegetable, selectedStatus, viewPeriod, currentDate])

  const fetchData = async () => {
    setLoading(true)
    try {
      // API から実際のデータを取得（会社IDは将来的に認証から取得）
      const companyId = 'sample-company-id'
      const { start, end } = getDateRange()
      
      const params = new URLSearchParams({
        company_id: companyId,
        start_date: start,
        end_date: end
      })

      if (selectedVegetable !== 'all') {
        params.append('vegetable_id', selectedVegetable)
      }
      if (selectedStatus !== 'all') {
        params.append('status', selectedStatus)
      }

      // ガントチャートデータと作業レポートデータを並行取得
      const [ganttResponse, reportsResponse] = await Promise.all([
        fetch(`/api/gantt?${params}`),
        fetch(`/api/reports?company_id=${companyId}&start_date=${start}&end_date=${end}`)
      ])

      const ganttResult = await ganttResponse.json()
      let reportsResult = { success: false, data: [] }
      
      if (reportsResponse.ok) {
        reportsResult = await reportsResponse.json()
      }

      if (ganttResult.success) {
        setTasks(ganttResult.data.tasks || [])
        setVegetables(ganttResult.data.vegetables || [])
      } else {
        // APIエラーの場合はサンプルデータを使用
        console.log('API エラー、サンプルデータを使用:', ganttResult.error)
        setTasks(unifiedTestData.tasks || [])
        setVegetables(unifiedTestData.vegetables || [])
      }

      // 作業レポートデータの設定
      if (reportsResult.success) {
        setWorkReports(reportsResult.data || [])
      } else {
        // サンプル作業レポートデータ
        setWorkReports([
          {
            id: 'wr1',
            work_date: '2025-08-05',
            work_type: 'harvesting',
            vegetable_id: 'v1',
            harvest_amount: 15.5,
            expected_revenue: 3100,
            work_notes: 'トマト収穫、品質良好'
          },
          {
            id: 'wr2',
            work_date: '2025-07-15',
            work_type: 'pruning',
            vegetable_id: 'v1',
            estimated_cost: 1200,
            work_notes: 'トマトの整枝・摘芽作業'
          },
          {
            id: 'wr3',
            work_date: '2025-08-07',
            work_type: 'pruning',
            vegetable_id: 'v2',
            estimated_cost: 900,
            work_notes: 'キュウリの整枝・摘芽作業'
          },
          {
            id: 'wr4',
            work_date: '2025-06-20',
            work_type: 'harvesting',
            vegetable_id: 'v2',
            harvest_amount: 25.2,
            expected_revenue: 5040,
            work_notes: 'キュウリの収穫作業'
          },
          {
            id: 'wr5',
            work_date: '2025-08-22',
            work_type: 'fertilizing',
            vegetable_id: 'v3',
            estimated_cost: 1500,
            work_notes: 'レタスの施肥作業'
          }
        ])
      }
    } catch (error) {
      console.error('データ取得エラー:', error)
      // ネットワークエラーの場合は統合テストデータを使用
      await loadUnifiedData()
      setWorkReports([])
    } finally {
      setLoading(false)
    }
  }

  const loadUnifiedData = async () => {
    // 統合テストデータ
    const sampleVegetables: Vegetable[] = [
      { id: 'v1', name: 'A棟トマト（桃太郎）', variety: '桃太郎', status: 'growing' },
      { id: 'v2', name: 'B棟キュウリ（四葉）', variety: '四葉', status: 'growing' },
      { id: 'v3', name: '露地レタス（春作）', variety: 'グリーンリーフ', status: 'planning' }
    ]

    const currentYear = new Date().getFullYear()
    const sampleTasks: GanttTask[] = [
      {
        id: 't1',
        name: '播種・育苗',
        start: `${currentYear}-03-01`,
        end: `${currentYear}-03-15`,
        progress: 100,
        status: 'completed',
        priority: 'high',
        vegetable: { id: 'v1', name: 'A棟トマト（桃太郎）', variety: '桃太郎' },
        assignedUser: { id: 'u1', name: '田中太郎' },
        color: STATUS_COLORS.completed
      },
      {
        id: 't2',
        name: '定植',
        start: `${currentYear}-03-16`,
        end: `${currentYear}-03-20`,
        progress: 100,
        status: 'completed',
        priority: 'high',
        vegetable: { id: 'v1', name: 'A棟トマト（桃太郎）', variety: '桃太郎' },
        assignedUser: { id: 'u1', name: '田中太郎' },
        color: STATUS_COLORS.completed
      },
      {
        id: 't3',
        name: '整枝・摘芽',
        start: `${currentYear}-03-21`,
        end: `${currentYear}-06-10`,
        progress: 75,
        status: 'in_progress',
        priority: 'medium',
        vegetable: { id: 'v1', name: 'A棟トマト（桃太郎）', variety: '桃太郎' },
        assignedUser: { id: 'u2', name: '佐藤花子' },
        color: STATUS_COLORS.in_progress
      },
      {
        id: 't4',
        name: '収穫',
        start: `${currentYear}-06-11`,
        end: `${currentYear}-08-31`,
        progress: 20,
        status: 'in_progress',
        priority: 'high',
        vegetable: { id: 'v1', name: 'A棟トマト（桃太郎）', variety: '桃太郎' },
        assignedUser: { id: 'u1', name: '田中太郎' },
        color: STATUS_COLORS.in_progress
      },
      {
        id: 't5',
        name: '播種・育苗',
        start: `${currentYear}-03-15`,
        end: `${currentYear}-03-25`,
        progress: 100,
        status: 'completed',
        priority: 'high',
        vegetable: { id: 'v2', name: 'B棟キュウリ（四葉）', variety: '四葉' },
        assignedUser: { id: 'u2', name: '佐藤花子' },
        color: STATUS_COLORS.completed
      },
      {
        id: 't6',
        name: '定植・支柱設置',
        start: `${currentYear}-03-26`,
        end: `${currentYear}-04-05`,
        progress: 100,
        status: 'completed',
        priority: 'high',
        vegetable: { id: 'v2', name: 'B棟キュウリ（四葉）', variety: '四葉' },
        assignedUser: { id: 'u2', name: '佐藤花子' },
        color: STATUS_COLORS.completed
      },
      {
        id: 't7',
        name: '整枝・摘芽',
        start: `${currentYear}-04-06`,
        end: `${currentYear}-05-20`,
        progress: 90,
        status: 'in_progress',
        priority: 'medium',
        vegetable: { id: 'v2', name: 'B棟キュウリ（四葉）', variety: '四葉' },
        assignedUser: { id: 'u3', name: '山田次郎' },
        color: STATUS_COLORS.in_progress
      },
      {
        id: 't8',
        name: '収穫',
        start: `${currentYear}-05-21`,
        end: `${currentYear}-07-15`,
        progress: 30,
        status: 'in_progress',
        priority: 'high',
        vegetable: { id: 'v2', name: 'B棟キュウリ（四葉）', variety: '四葉' },
        assignedUser: { id: 'u2', name: '佐藤花子' },
        color: STATUS_COLORS.in_progress
      },
      {
        id: 't9',
        name: '施肥',
        start: `${currentYear}-08-20`,
        end: `${currentYear}-08-25`,
        progress: 60,
        status: 'in_progress',
        priority: 'medium',
        vegetable: { id: 'v3', name: '露地レタス（秋作）', variety: 'グリーンリーフ' },
        assignedUser: { id: 'u3', name: '山田次郎' },
        color: STATUS_COLORS.in_progress
      },
      {
        id: 't10',
        name: '播種・育苗',
        start: `${currentYear}-08-26`,
        end: `${currentYear}-09-10`,
        progress: 0,
        status: 'pending',
        priority: 'medium',
        vegetable: { id: 'v3', name: '露地レタス（秋作）', variety: 'グリーンリーフ' },
        assignedUser: { id: 'u1', name: '田中太郎' },
        color: STATUS_COLORS.pending
      }
    ]

    setVegetables(sampleVegetables)
    setTasks(sampleTasks)
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const handleTaskClick = (task: GanttTask) => {
    console.log('Task clicked:', task.name) // デバッグ用
    setSelectedTask(task)
  }

  const handleExport = () => {
    // CSV出力
    const csvHeaders = ['タスク名', '野菜', '担当者', '開始日', '終了日', '進捗率', 'ステータス', '優先度']
    const csvData = filteredTasks.map(task => [
      task.name,
      task.vegetable.name,
      task.assignedUser?.name || '未割当',
      task.start,
      task.end,
      task.progress + '%',
      task.status === 'pending' ? '未開始' : 
      task.status === 'in_progress' ? '進行中' :
      task.status === 'completed' ? '完了' : '中止',
      task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'
    ])
    
    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `gantt_chart_${format(new Date(), 'yyyyMMdd')}.csv`
    link.click()
  }

  const handleNewTask = () => {
    setShowNewTaskModal(true)
  }

  const handleCreateTask = (taskData: Partial<GanttTask>) => {
    const newTask: GanttTask = {
      id: `new-${Date.now()}`,
      name: taskData.name || '新規タスク',
      start: taskData.start || format(new Date(), 'yyyy-MM-dd'),
      end: taskData.end || format(addDays(new Date(), 7), 'yyyy-MM-dd'),
      progress: 0,
      status: 'pending',
      priority: taskData.priority || 'medium',
      vegetable: taskData.vegetable || { id: 'v1', name: 'A棟トマト（桃太郎）', variety: '桃太郎' },
      assignedUser: taskData.assignedUser || { id: 'u1', name: '田中太郎' },
      color: STATUS_COLORS.pending
    }
    setTasks(prev => [...prev, newTask])
    setShowNewTaskModal(false)
  }

  const handleProgressUpdate = (taskId: string, newProgress: number) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId 
        ? { ...task, progress: newProgress, 
            status: newProgress === 100 ? 'completed' : 
                   newProgress > 0 ? 'in_progress' : 'pending',
            color: newProgress === 100 ? STATUS_COLORS.completed :
                   newProgress > 0 ? STATUS_COLORS.in_progress : STATUS_COLORS.pending
          }
        : task
    ))
  }

  // フィルタリング
  const filteredTasks = tasks.filter(task => {
    if (selectedVegetable !== 'all' && task.vegetable.id !== selectedVegetable) return false
    if (selectedStatus !== 'all' && task.status !== selectedStatus) return false
    if (selectedPriority !== 'all' && task.priority !== selectedPriority) return false
    if (searchQuery && !task.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const { start, end } = getDateRange()

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">栽培野菜管理</h1>
          <p className="text-gray-600">
            栽培野菜の進行状況をカレンダー・ガントチャート形式で管理
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            更新
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            エクスポート
          </Button>
          <Button size="sm" onClick={handleNewTask}>
            <Plus className="w-4 h-4 mr-2" />
            新規タスク
          </Button>
        </div>
      </div>

      {/* 📊 野菜管理統計カード */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-lg transition-shadow bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700 font-medium">管理中野菜</p>
                <p className="text-2xl font-bold text-green-800">
                  {vegetables.filter(v => v.status === 'growing').length}
                </p>
                <p className="text-xs text-green-600 mt-1">アクティブ栽培</p>
              </div>
              <div className="bg-green-500 p-3 rounded-full">
                <Sprout className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700 font-medium">総栽培面積</p>
                <p className="text-2xl font-bold text-blue-800">
                  {vegetables.reduce((sum, v) => sum + (parseFloat(v.variety) || 0), 0)}㎡
                </p>
                <p className="text-xs text-blue-600 mt-1">全区画合計</p>
              </div>
              <div className="bg-blue-500 p-3 rounded-full">
                <MapPin className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-700 font-medium">進行中タスク</p>
                <p className="text-2xl font-bold text-yellow-800">
                  {tasks.filter(t => t.status === 'in_progress').length}
                </p>
                <p className="text-xs text-yellow-600 mt-1">実行中作業</p>
              </div>
              <div className="bg-yellow-500 p-3 rounded-full">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-700 font-medium">完了済みタスク</p>
                <p className="text-2xl font-bold text-purple-800">
                  {tasks.filter(t => t.status === 'completed').length}
                </p>
                <p className="text-xs text-purple-600 mt-1">完了した作業</p>
              </div>
              <div className="bg-purple-500 p-3 rounded-full">
                <Archive className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 📈 進捗サマリーカード */}
      <Card className="bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">作業進捗サマリー</h3>
            <BarChart3 className="w-5 h-5 text-gray-600" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 全体進捗 */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">全体進捗</span>
                <span className="font-medium text-gray-800">
                  {Math.round((tasks.reduce((sum, t) => sum + t.progress, 0) / Math.max(tasks.length, 1)))}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${Math.round((tasks.reduce((sum, t) => sum + t.progress, 0) / Math.max(tasks.length, 1)))}%` 
                  }}
                />
              </div>
            </div>

            {/* タスク状況 */}
            <div className="space-y-2">
              <div className="text-sm text-gray-600 mb-2">タスク状況</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-center">
                  <div className="text-lg font-bold text-yellow-600">
                    {tasks.filter(t => t.status === 'pending').length}
                  </div>
                  <div className="text-gray-500">待機中</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600">
                    {tasks.filter(t => t.status === 'in_progress').length}
                  </div>
                  <div className="text-gray-500">進行中</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">
                    {tasks.filter(t => t.status === 'completed').length}
                  </div>
                  <div className="text-gray-500">完了</div>
                </div>
              </div>
            </div>

            {/* 優先度分布 */}
            <div className="space-y-2">
              <div className="text-sm text-gray-600 mb-2">優先度分布</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-center">
                  <div className="text-lg font-bold text-red-600">
                    {tasks.filter(t => t.priority === 'high').length}
                  </div>
                  <div className="text-gray-500">高</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-yellow-600">
                    {tasks.filter(t => t.priority === 'medium').length}
                  </div>
                  <div className="text-gray-500">中</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-600">
                    {tasks.filter(t => t.priority === 'low').length}
                  </div>
                  <div className="text-gray-500">低</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* コントロールパネル */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center text-gray-800">
            <Settings className="w-5 h-5 mr-2 text-blue-600" />
            表示コントロール
          </CardTitle>
          <CardDescription className="text-gray-600">
            データの表示方法とフィルタリング条件を設定
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-gray-50 p-1 rounded-lg">
              <TabsTrigger 
                value="filters" 
                className="data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium"
              >
                <Filter className="w-4 h-4 mr-2" />
                フィルター設定
              </TabsTrigger>
              <TabsTrigger 
                value="display"
                className="data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium"
              >
                <CalendarDays className="w-4 h-4 mr-2" />
                表示設定
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="filters" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>野菜で絞り込み</Label>
                  <Select value={selectedVegetable} onValueChange={setSelectedVegetable}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">すべて</SelectItem>
                      {vegetables.map(vegetable => (
                        <SelectItem key={vegetable.id} value={vegetable.id}>
                          {vegetable.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>ステータス</Label>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">すべて</SelectItem>
                      <SelectItem value="pending">未開始</SelectItem>
                      <SelectItem value="in_progress">進行中</SelectItem>
                      <SelectItem value="completed">完了</SelectItem>
                      <SelectItem value="cancelled">中止</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>優先度</Label>
                  <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">すべて</SelectItem>
                      <SelectItem value="high">高</SelectItem>
                      <SelectItem value="medium">中</SelectItem>
                      <SelectItem value="low">低</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>タスク検索</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="タスク名で検索..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="display" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>表示期間</Label>
                  <Select value={viewPeriod} onValueChange={(value: '6months' | '1year' | '3years' | '5years') => setViewPeriod(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6months">半年</SelectItem>
                      <SelectItem value="1year">1年</SelectItem>
                      <SelectItem value="3years">3年</SelectItem>
                      <SelectItem value="5years">5年</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>表示単位</Label>
                  <Select value={viewUnit} onValueChange={(value: 'day' | 'week' | 'month') => setViewUnit(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">日単位</SelectItem>
                      <SelectItem value="week">週単位</SelectItem>
                      <SelectItem value="month">月単位</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>基準月</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                    >
                      ←
                    </Button>
                    <span className="text-sm font-medium min-w-[120px] text-center">
                      {format(currentDate, 'yyyy年MM月', { locale: ja })}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                    >
                      →
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>表示範囲</Label>
                  <div className="text-sm text-gray-600">
                    {format(new Date(start), 'yyyy/MM/dd', { locale: ja })} 〜{' '}
                    {format(new Date(end), 'yyyy/MM/dd', { locale: ja })}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 統計情報 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{filteredTasks.filter(t => t.status === 'in_progress').length}</div>
            <div className="text-sm text-gray-600">進行中タスク</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{filteredTasks.filter(t => t.status === 'completed').length}</div>
            <div className="text-sm text-gray-600">完了済み</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-gray-600">{filteredTasks.filter(t => t.status === 'pending').length}</div>
            <div className="text-sm text-gray-600">未開始</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">
              {Math.round(filteredTasks.reduce((acc, task) => acc + task.progress, 0) / filteredTasks.length || 0)}%
            </div>
            <div className="text-sm text-gray-600">平均進捗</div>
          </CardContent>
        </Card>
      </div>

      {/* 栽培野菜管理チャート */}
      <GanttChart 
        tasks={filteredTasks}
        workReports={workReports}
        startDate={start}
        endDate={end}
        viewUnit={viewUnit}
        onTaskClick={handleTaskClick}
        className="min-h-[500px]"
      />

      {/* タスク詳細リスト */}
      <Card>
        <CardHeader>
          <CardTitle>タスク詳細リスト</CardTitle>
          <CardDescription>
            表示中のタスク: {filteredTasks.length}件
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* ヘッダー行 */}
            <div className="grid grid-cols-12 gap-4 pb-2 border-b bg-gray-50 rounded-lg px-4 py-2 font-medium text-sm text-gray-700">
              <div className="col-span-3">
                登録されている野菜
              </div>
              <div className="col-span-6">
                タスク名・詳細
              </div>
              <div className="col-span-3 text-right">
                進捗
              </div>
            </div>
            
            {filteredTasks.map(task => (
              <div 
                key={task.id} 
                className="grid grid-cols-12 items-center gap-4 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  console.log('List item clicked:', task.name) // デバッグ用
                  handleTaskClick(task)
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleTaskClick(task)
                  }
                }}
              >
                {/* 野菜名列 */}
                <div className="col-span-3">
                  <div className="font-medium text-blue-600 text-sm">
                    {task.vegetable.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {task.vegetable.variety}
                  </div>
                </div>
                
                {/* タスク名と詳細列 */}
                <div className="col-span-6">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-medium">{task.name}</h4>
                    <Badge 
                      variant="secondary"
                      style={{ backgroundColor: task.color, color: 'white' }}
                    >
                      {task.status === 'pending' && '未開始'}
                      {task.status === 'in_progress' && '進行中'}
                      {task.status === 'completed' && '完了'}
                      {task.status === 'cancelled' && '中止'}
                    </Badge>
                    <Badge variant="outline">
                      {task.priority === 'high' && '高優先度'}
                      {task.priority === 'medium' && '中優先度'}
                      {task.priority === 'low' && '低優先度'}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600">
                    {task.assignedUser?.name || '未割当'} • 
                    {format(new Date(task.start), 'yyyy/MM/dd', { locale: ja })} 〜 
                    {format(new Date(task.end), 'yyyy/MM/dd', { locale: ja })}
                  </div>
                </div>
                {/* 進捗列 */}
                <div className="col-span-3 text-right">
                  <div className="text-lg font-semibold">{task.progress}%</div>
                  <div className="w-24 h-2 bg-gray-200 rounded-full mt-1 ml-auto">
                    <div 
                      className="h-2 rounded-full transition-all"
                      style={{ 
                        width: `${task.progress}%`,
                        backgroundColor: task.color
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* タスク詳細モーダル */}
      <Dialog open={isTaskModalOpen} onOpenChange={(open) => {
        console.log('Dialog onOpenChange called with:', open)
        if (!open) {
          setSelectedTask(null)
          setIsTaskModalOpen(false)
        }
      }}>
        <DialogContent className="max-w-4xl bg-white shadow-xl border-0 rounded-xl">
          {selectedTask && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedTask.name}</DialogTitle>
                <DialogDescription>
                  タスクの詳細情報と進捗を管理します
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">野菜情報</Label>
                    <p className="text-sm text-gray-600">{selectedTask.vegetable.name}</p>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">担当者</Label>
                    <p className="text-sm text-gray-600">
                      {selectedTask.assignedUser?.name || '未割当'}
                    </p>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">期間</Label>
                    <p className="text-sm text-gray-600">
                      {format(new Date(selectedTask.start), 'yyyy年MM月dd日', { locale: ja })} 〜{' '}
                      {format(new Date(selectedTask.end), 'yyyy年MM月dd日', { locale: ja })}
                    </p>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">ステータス</Label>
                    <Badge 
                      variant="secondary"
                      style={{ backgroundColor: selectedTask.color, color: 'white' }}
                      className="ml-2"
                    >
                      {selectedTask.status === 'pending' && '未開始'}
                      {selectedTask.status === 'in_progress' && '進行中'}
                      {selectedTask.status === 'completed' && '完了'}
                      {selectedTask.status === 'cancelled' && '中止'}
                    </Badge>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">優先度</Label>
                    <Badge variant="outline" className="ml-2">
                      {selectedTask.priority === 'high' && '高優先度'}
                      {selectedTask.priority === 'medium' && '中優先度'}
                      {selectedTask.priority === 'low' && '低優先度'}
                    </Badge>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">進捗率</Label>
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl font-bold">{selectedTask.progress}%</span>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={selectedTask.progress}
                          onChange={(e) => {
                            const newProgress = parseInt(e.target.value) || 0
                            handleProgressUpdate(selectedTask.id, Math.min(100, Math.max(0, newProgress)))
                          }}
                          className="w-20 text-right"
                        />
                      </div>
                      <div className="w-full h-3 bg-gray-200 rounded-full">
                        <div 
                          className="h-3 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${selectedTask.progress}%`,
                            backgroundColor: selectedTask.color
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">作業日数</Label>
                    <p className="text-sm text-gray-600">
                      {differenceInDays(parseISO(selectedTask.end), parseISO(selectedTask.start)) + 1}日間
                    </p>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">残り日数</Label>
                    <p className="text-sm text-gray-600">
                      {Math.max(0, differenceInDays(parseISO(selectedTask.end), new Date()))}日
                    </p>
                  </div>
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedTask(null)}>
                  閉じる
                </Button>
                <Button 
                  onClick={() => {
                    if (selectedTask.progress < 100) {
                      handleProgressUpdate(selectedTask.id, selectedTask.progress + 10)
                    }
                  }}
                  disabled={selectedTask.progress >= 100}
                >
                  進捗+10%
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 新規タスク作成モーダル */}
      <Dialog open={showNewTaskModal} onOpenChange={setShowNewTaskModal}>
        <DialogContent className="max-w-4xl bg-white shadow-xl border-0 rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center text-xl">
              <Plus className="w-5 h-5 mr-2 text-green-600" />
              新規タスク作成
            </DialogTitle>
            <DialogDescription>
              新しい作業タスクの詳細情報を入力してください
            </DialogDescription>
          </DialogHeader>
          
          <NewTaskForm 
            vegetables={vegetables} 
            onSubmit={handleCreateTask}
            onCancel={() => setShowNewTaskModal(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}