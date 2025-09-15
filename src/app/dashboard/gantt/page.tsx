'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
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
// サンプルデータのインポートを削除
// import { unifiedTestData } from '@/lib/unified-test-data'
import WorkReportForm from '@/components/work-report-form'
import WorkReportViewModal from '@/components/work-report-view-modal'
import WorkReportEditModalFull from '@/components/work-report-edit-modal-full'
import { WorkReportCard } from '@/components/work-report-card'
import { CollapsibleSearchFilter } from '@/components/collapsible-search-filter'
import FarmMapView from '@/components/farm-map-view'
import { 
  Calendar, 
  Filter, 
  Download, 
  Plus, 
  RefreshCw, 
  Settings,
  ChevronDown,
  ChevronUp,
  X,
  Search,
  CalendarDays,
  Sprout,
  MapPin,
  TrendingUp,
  Archive,
  BarChart3,
  Map,
  FileText,
  Trash2,
  AlertTriangle,
  MoreHorizontal,
  Edit,
  Package,
  DollarSign,
  Clock
} from 'lucide-react'
import { format, subMonths, addMonths, startOfMonth, endOfMonth, differenceInDays, parseISO, addDays } from 'date-fns'
import { ja } from 'date-fns/locale'
import { useToast } from '@/components/ui/toast'

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
  description?: string
  workType?: string
  isTemporary?: boolean // 楽観的更新用フラグ
  createdAt?: string
  updatedAt?: string
}

interface Vegetable {
  id: string
  name: string
  variety: string
  status: string
  area_size?: number
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

// 作業種類のラベル変換関数
const getWorkTypeLabel = (workType: string) => {
  const workTypeLabels: Record<string, string> = {
    'seeding': '🌱 播種・育苗',
    'planting': '🌿 定植', 
    'fertilizing': '🌾 施肥',
    'watering': '💧 灌水',
    'weeding': '🔧 除草',
    'pruning': '✂️ 整枝・摘芽',
    'harvesting': '🥕 収穫',
    'inspection': '🔍 点検・観察',
    'other': '⚙️ その他'
  }
  return workTypeLabels[workType] || workType
}

export default function GanttPage() {
  // プロフェッショナルUI機能
  const { toast } = useToast()

  const [tasks, setTasks] = useState<GanttTask[]>([])
  const [vegetables, setVegetables] = useState<Vegetable[]>([])
  const [users, setUsers] = useState<{id: string, name: string}[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  
  // Supabaseクライアントの初期化
  const supabase = createClient()
  
  // フィルター状態
  const [selectedVegetable, setSelectedVegetable] = useState<string>('all')
  const [selectedPriority, setSelectedPriority] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  
  // 期間設定
  const [viewPeriod, setViewPeriod] = useState<'6months' | '1year' | '3years' | '5years'>('1year')
  const [viewUnit, setViewUnit] = useState<'day' | 'week' | 'month'>('day')
  const [currentDate, setCurrentDate] = useState(new Date())
  
  // カスタム期間設定
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')
  const [dateRangeError, setDateRangeError] = useState<string>('')
  const [isUsingCustomRange, setIsUsingCustomRange] = useState<boolean>(false)
  const [customRange, setCustomRange] = useState<{start: Date, end: Date} | null>(null)
  
  // フィルター状態変更の監視
  useEffect(() => {
    console.log('🔄 親コンポーネント - フィルター状態変更:', {
      selectedVegetable,
      selectedPriority,
      customStartDate,
      customEndDate
    })
  }, [selectedVegetable, selectedPriority, customStartDate, customEndDate])
  
  // タスク詳細モーダル
  const [selectedTask, setSelectedTask] = useState<GanttTask | null>(null)
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [pendingTaskChanges, setPendingTaskChanges] = useState<Partial<GanttTask> | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  
  // 実績記録モーダル管理
  const [selectedWorkReport, setSelectedWorkReport] = useState<any>(null)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  
  // 実績記録のクリックハンドラー
  const handleWorkReportClick = (workReport: any) => {
    setSelectedWorkReport(workReport)
    setIsViewModalOpen(true)
  }

  // 編集モーダルを開く
  const handleEditWorkReport = (workReport: any) => {
    console.log('🔧 handleEditWorkReport - 受け取った作業レポート:', workReport)
    console.log('🔧 handleEditWorkReport - 作業レポートのID:', workReport?.id)
    setSelectedWorkReport(workReport)
    setIsViewModalOpen(false)
    setIsEditModalOpen(true)
  }

  // 実績記録の更新
  const handleUpdateWorkReport = async (updatedReport: any) => {
    try {
      const response = await fetch(`/api/reports/${updatedReport.id || updatedReport.report_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedReport),
      })

      if (!response.ok) {
        throw new Error('Failed to update work report')
      }

      const result = await response.json()
      
      if (result.success) {
        // データを再取得してUI更新
        await fetchData()
        setIsEditModalOpen(false)
        setSelectedWorkReport(null)
        
        // 成功メッセージ（必要に応じて）
        console.log('実績記録が更新されました')
      } else {
        throw new Error(result.error || 'Update failed')
      }
    } catch (error) {
      console.error('実績記録の更新エラー:', error)
      // エラーハンドリング（トースト通知など）
    }
  }

  // モーダルを閉じる
  const handleCloseModals = () => {
    setIsViewModalOpen(false)
    setIsEditModalOpen(false)
    setSelectedWorkReport(null)
  }
  
  // 認証情報の取得
  useEffect(() => {
    const fetchUserAuth = async () => {
      try {
        console.log('🔍 Gantt: 認証情報取得開始')
        const response = await fetch('/api/auth/user')
        
        if (!response.ok) {
          throw new Error(`認証エラー: ${response.status}`)
        }
        
        const result = await response.json()
        
        if (result.success && result.user?.company_id) {
          console.log('✅ Gantt: 認証成功, company_id:', result.user.company_id)
          setCompanyId(result.user.company_id)
          setAuthError(null)
        } else {
          throw new Error('ユーザー情報の取得に失敗しました')
        }
      } catch (error) {
        console.error('❌ Gantt: 認証エラー:', error)
        setAuthError(error instanceof Error ? error.message : '認証エラーが発生しました')
        setCompanyId(null)
      }
    }
    
    fetchUserAuth()
  }, [])

  // selectedTaskの変化を監視
  useEffect(() => {
    if (selectedTask) {
      setIsTaskModalOpen(true)
      // モーダルを開いた時に編集状態をリセット
      setPendingTaskChanges(null)
      setHasUnsavedChanges(false)
    } else {
      setIsTaskModalOpen(false)
    }
  }, [selectedTask])
  
  // タブ状態管理
  const [activeTab, setActiveTab] = useState('filters')
  
  // 新規タスク作成モーダル
  const [showNewTaskModal, setShowNewTaskModal] = useState(false)
  
  // 新しく追加するモーダル状態
  const [showWorkReportForm, setShowWorkReportForm] = useState(false)
  const [showMapView, setShowMapView] = useState(false)
  
  // 削除機能関連の状態（プロフェッショナル拡張版）
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    show: boolean
    item: any
    type: 'task' | 'report'
    validation: {
      can_delete: boolean
      task_info?: any
      related_reports_count?: number
      warnings: string[]
    } | null
    isValidating: boolean
  }>({
    show: false,
    item: null,
    type: 'task',
    validation: null,
    isValidating: false
  })
  
  // プロフェッショナル機能用状態管理
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [isUpdatingTask, setIsUpdatingTask] = useState(false)
  const [isDeletingTask, setIsDeletingTask] = useState<string | null>(null)
  const [networkError, setNetworkError] = useState(false)
  const [error, setError] = useState('')
  
  // フィルター展開状態
  const [isFilterExpanded, setIsFilterExpanded] = useState(false)
  const [activeFilterCount, setActiveFilterCount] = useState(0)

  // 各野菜セクションの展開状態（デフォルトは全て展開）
  const [expandedVegetables, setExpandedVegetables] = useState<Set<string>>(new Set())
  
  // 検索フィルター状態
  const [filteredVegetableData, setFilteredVegetableData] = useState<{
    filteredVegetables: any[]
    filteredTasks: any[]
    filteredReports: any[]
    resultSummary: string
  }>({
    filteredVegetables: [],
    filteredTasks: [],
    filteredReports: [],
    resultSummary: ''
  })
  
  // 検索フィルター変更ハンドラー
  const handleFiltersChange = useCallback((filters: any, filteredData: any) => {
    setFilteredVegetableData(filteredData)
    // アクティブフィルター数を計算
    let count = 0
    if (filteredData.hasActiveFilters) {
      if (filters.selectedVegetables?.length > 0 && filters.selectedVegetables.length < vegetables.length) count++
      if (filters.workType !== 'all') count++
      if (filters.period !== 'all') count++
      if (!filters.showPlanned || !filters.showCompleted) count++
    }
    setActiveFilterCount(count)
  }, [vegetables.length])

  const handleResetFilters = () => {
    // フィルターをリセット
    setFilteredVegetableData({
      filteredVegetables: [],
      filteredTasks: [],
      filteredReports: [],
      resultSummary: '',
      hasActiveFilters: false
    })
    setActiveFilterCount(0)
  }
  
  // 期間計算
  const getDateRange = useCallback(() => {
    // ガントチャートヘッダー内のカスタム期間設定を優先
    if (customStartDate && customEndDate) {
      console.log('🔍 getDateRange - ガントチャートカスタム期間使用:', { customStartDate, customEndDate })
      return {
        start: customStartDate,
        end: customEndDate
      }
    }
    
    // レガシーカスタム範囲が設定されている場合はそれを使用
    if (isUsingCustomRange && customRange) {
      console.log('🔍 getDateRange - レガシーカスタム範囲使用:', customRange)
      return {
        start: format(customRange.start, 'yyyy-MM-dd'),
        end: format(customRange.end, 'yyyy-MM-dd')
      }
    }

    // デフォルトの期間計算
    console.log('🔍 getDateRange - デフォルト期間計算:', { viewPeriod, currentDate })
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

    const result = {
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd')
    }
    console.log('🔍 getDateRange - 計算結果:', result)
    return result
  }, [viewPeriod, currentDate, isUsingCustomRange, customRange, customStartDate, customEndDate])

  // 作業レポート状態
  const [workReports, setWorkReports] = useState([])

  // ネットワーク状態の監視
  useEffect(() => {
    const handleOnline = () => {
      setNetworkError(false)
      toast({
        title: '接続復旧',
        description: 'インターネット接続が復旧しました。データを同期します。',
        type: 'success'
      })
      // 自動でデータを再取得
      fetchData()
    }
    
    const handleOffline = () => {
      setNetworkError(true)
      toast({
        title: '接続の問題',
        description: 'インターネット接続が失われました。操作は一時的に保存されます。',
        type: 'warning',
        duration: 10000
      })
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // ネットワークユーティリティ関数
  const retryWithBackoff = async (fn: () => Promise<any>, maxRetries = 3) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn()
      } catch (error) {
        if (i === maxRetries - 1) throw error
        const delay = Math.pow(2, i) * 1000 // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  const isNetworkError = (error: any) => {
    return !navigator.onLine || 
           error.message?.includes('fetch') ||
           error.message?.includes('network') ||
           error.status >= 500
  }

  // 分析システムとの連携機能
  const syncTaskToAnalytics = async (task: GanttTask) => {
    try {
      // 分析データ同期処理
      const analyticsData = {
        task_id: task.id,
        vegetable_id: task.vegetable.id,
        task_type: task.workType || 'other',
        planned_start: task.start,
        planned_end: task.end,
        priority: task.priority,
        status: task.status,
        assigned_user_id: task.assignedUser?.id,
        created_at: new Date().toISOString()
      }
      
      // 分析システムに通知（イベント発行）
      window.dispatchEvent(new CustomEvent('taskAnalyticsUpdate', { 
        detail: analyticsData 
      }))
      
      console.log('タスクが分析システムに同期されました:', task.id)
    } catch (error) {
      console.warn('分析システムへの同期に失敗しました:', error)
      // 分析同期エラーはユーザーには表示しない（サイレントエラー）
    }
  }

  // データ読み込み
  useEffect(() => {
    fetchData()
  }, [])

  // グローバルなフォーカス管理 - モーダル関連の問題を解決
  useEffect(() => {
    const handleGlobalClick = () => {
      // 定期的にページ状態をリセット
      if (document.body.style.pointerEvents === 'none') {
        document.body.style.pointerEvents = 'auto'
      }
      if (document.documentElement.style.pointerEvents === 'none') {
        document.documentElement.style.pointerEvents = 'auto'
      }
    }

    document.addEventListener('click', handleGlobalClick)
    return () => document.removeEventListener('click', handleGlobalClick)
  }, [])

  // 初回データ取得（companyIdが取得された後に実行）
  useEffect(() => {
    if (companyId) {
      console.log('📊 Gantt: companyId取得完了、初回データフェッチ開始:', companyId)
      fetchData()
    }
  }, [companyId])

  // フィルター変更時にデータを再取得
  useEffect(() => {
    if (companyId) {
      console.log('🔄 フィルター変更でデータ再取得:', { selectedVegetable, viewPeriod, currentDate, customStartDate, customEndDate })
      fetchData()
    }
  }, [companyId, selectedVegetable, viewPeriod, currentDate, customStartDate, customEndDate])

  // viewPeriodが変更された際にカスタム範囲をリセット
  useEffect(() => {
    if (isUsingCustomRange) {
      setIsUsingCustomRange(false)
      setCustomRange(null)
      setCustomStartDate('')
      setCustomEndDate('')
      setDateRangeError('')
    }
  }, [viewPeriod])

  // タスク作成後の専用データ取得関数（作成されたタスクの日付範囲を考慮）
  const fetchDataWithTaskDateRange = async (newTask?: any) => {
    if (!companyId) {
      console.log('❌ Gantt: companyIdが未設定のため、データ取得をスキップ')
      return
    }
    
    setLoading(true)
    try {
      console.log('📊 Gantt: fetchDataWithTaskDateRange開始, companyId:', companyId)
      let { start, end } = getDateRange()
      
      // 新しく作成されたタスクの日付範囲を既存の表示範囲に含める
      if (newTask) {
        const taskStart = new Date(newTask.start_date || newTask.start)
        const taskEnd = new Date(newTask.end_date || newTask.end)
        const currentStart = new Date(start)
        const currentEnd = new Date(end)
        
        // タスクの日付が現在の表示範囲外の場合、範囲を拡張
        if (taskStart < currentStart) {
          start = taskStart.toISOString().split('T')[0]
        }
        if (taskEnd > currentEnd) {
          end = taskEnd.toISOString().split('T')[0]
        }
        
        console.log('📅 タスク作成により表示期間を調整:', { 
          元の期間: `${currentStart.toLocaleDateString()} - ${currentEnd.toLocaleDateString()}`,
          新しい期間: `${new Date(start).toLocaleDateString()} - ${new Date(end).toLocaleDateString()}`,
          作成されたタスク: `${taskStart.toLocaleDateString()} - ${taskEnd.toLocaleDateString()}`
        })
      }
      
      const params = new URLSearchParams({
        company_id: companyId,
        start_date: start,
        end_date: end
      })

      if (selectedVegetable !== 'all') {
        params.append('vegetable_id', selectedVegetable)
      }

      params.append('active_only', 'true')
      
      console.log('🔍 fetchDataWithTaskDateRange - APIリクエスト:', `/api/gantt?${params.toString()}`)

      // ガントチャートデータ、作業レポートデータ、野菜データ、ユーザーデータを並行取得
      const [ganttResponse, reportsResponse, vegetablesResponse, usersResponse] = await Promise.all([
        fetch(`/api/gantt?${params.toString()}`),
        fetch(`/api/reports?company_id=${companyId}&start_date=${start}&end_date=${end}&active_only=true&limit=999999`),  // 実質無制限
        fetch(`/api/vegetables?company_id=${companyId}`), // 最新の野菜データを直接取得
        fetch(`/api/users?company_id=${companyId}`) // ユーザーデータを取得
      ])

      const ganttResult = await ganttResponse.json()
      let reportsResult = { success: false, data: [] }
      let vegetablesResult = { success: false, data: [] }
      let usersResult = { success: false, users: [] }
      
      if (reportsResponse.ok) {
        reportsResult = await reportsResponse.json()
      }
      
      if (vegetablesResponse.ok) {
        vegetablesResult = await vegetablesResponse.json()
      }

      console.log('👥 ユーザーAPIレスポンスステータス:', usersResponse.status, usersResponse.ok)
      if (usersResponse.ok) {
        usersResult = await usersResponse.json()
        console.log('👥 取得したユーザーデータ:', usersResult)
        console.log('👥 ユーザーデータの構造:', {
          success: usersResult.success,
          dataLength: usersResult.data?.length,
          firstUser: usersResult.data?.[0]
        })
        if (usersResult.success && usersResult.data) {
          const formattedUsers = usersResult.data.map((u: any) => ({
            id: u.id,
            name: u.full_name || u.email || '名前未設定'
          }))
          console.log('👥 フォーマット済みユーザー:', formattedUsers)
          setUsers(formattedUsers)
        } else {
          console.log('❌ ユーザーデータ取得失敗:', usersResult)
        }
      } else {
        console.error('❌ ユーザーAPI呼び出し失敗:', usersResponse.status, usersResponse.statusText)
        try {
          const errorText = await usersResponse.text()
          console.error('❌ エラー詳細:', errorText)
        } catch (e) {
          console.error('❌ エラーテキスト取得失敗:', e)
        }
      }

      console.log('🔍 fetchDataWithTaskDateRange - APIレスポンス:', {
        ganttSuccess: ganttResult.success,
        ganttTasksCount: ganttResult.data?.tasks?.length || 0,
        ganttError: ganttResult.error
      })

      // タスクデータの設定（実データのみ）
      if (ganttResult.success) {
        console.log('🔍 fetchDataWithTaskDateRange - 取得されたタスク詳細:', ganttResult.data.tasks?.map((t: any) => ({
          id: t.id,
          name: t.name,
          start: t.start_date,
          end: t.end_date,
          vegetable_id: t.vegetable_id
        })))
        setTasks(ganttResult.data.tasks || [])
      } else {
        console.log('❌ fetchDataWithTaskDateRange - Gantt API エラー:', ganttResult.error)
        setTasks([])
      }

      // 野菜データは専用APIから取得（実データのみ）
      if (vegetablesResult.success && vegetablesResult.data) {
        setVegetables(vegetablesResult.data.map((v: any) => ({
          id: v.id,
          name: v.name,
          variety: v.variety_name,
          status: v.status,
          area_size: v.area_size || 0
        })))
      } else {
        console.log('野菜API エラー:', vegetablesResult.error)
        setVegetables([])
      }

      // 作業レポートデータの設定（実データのみ）
      if (reportsResult.success) {
        setWorkReports(reportsResult.data || [])
      } else {
        console.log('作業レポートAPI エラー:', reportsResult.error)
        setWorkReports([])
      }
    } catch (error) {
      console.error('データ取得エラー:', error)
      // エラー時は空のデータを設定
      setTasks([])
      setVegetables([])
      setWorkReports([])
    } finally {
      setLoading(false)
    }
  }

  const fetchData = async () => {
    if (!companyId) {
      console.log('❌ Gantt: companyIdが未設定のため、データ取得をスキップ')
      return
    }
    
    setLoading(true)
    try {
      console.log('📊 Gantt: fetchData開始, companyId:', companyId, 'selectedVegetable:', selectedVegetable)
      const { start, end } = getDateRange()
      
      const params = new URLSearchParams({
        company_id: companyId,
        start_date: start,
        end_date: end
      })

      if (selectedVegetable !== 'all') {
        params.append('vegetable_id', selectedVegetable)
        console.log('🔍 fetchData - 野菜フィルター適用:', selectedVegetable)
      } else {
        console.log('🔍 fetchData - 全野菜表示')
      }

      params.append('active_only', 'true')
      
      console.log('🔍 fetchData - APIパラメータ:', params.toString())
      
      // ガントチャートデータ、作業レポートデータ、野菜データを並行取得
      console.log('🔍 fetchData - 野菜API呼び出し準備 company_id:', companyId)
      console.log('🔍 fetchData - 野菜API URL:', `/api/vegetables?company_id=${companyId}`)
      
      // JWTトークンを取得
      const { data: { session } } = await supabase.auth.getSession()
      const authHeaders = {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      }

      console.log('🔍 ユーザーAPI呼び出し準備 - URL:', `/api/users?company_id=${companyId}`)
      console.log('🔍 認証ヘッダー存在確認:', !!session?.access_token)

      const [ganttResponse, reportsResponse, vegetablesResponse, usersResponse] = await Promise.all([
        fetch(`/api/gantt?${params.toString()}`, { headers: authHeaders }),
        fetch(`/api/reports?company_id=${companyId}&start_date=${start}&end_date=${end}&active_only=true&limit=999999`, { headers: authHeaders }),  // 実質無制限
        fetch(`/api/vegetables?company_id=${companyId}`, { headers: authHeaders }), // 最新の野菜データを直接取得
        fetch(`/api/users?company_id=${companyId}`, { headers: authHeaders }) // ユーザーデータを取得
      ])

      const ganttResult = await ganttResponse.json()
      let reportsResult = { success: false, data: [] }
      let vegetablesResult = { success: false, data: [] }
      let usersResult = { success: false, users: [] }
      
      if (reportsResponse.ok) {
        reportsResult = await reportsResponse.json()
      }
      
      if (vegetablesResponse.ok) {
        vegetablesResult = await vegetablesResponse.json()
      }

      console.log('👥 ユーザーAPIレスポンスステータス:', usersResponse.status, usersResponse.ok)
      if (usersResponse.ok) {
        usersResult = await usersResponse.json()
        console.log('👥 取得したユーザーデータ:', usersResult)
        console.log('👥 ユーザーデータの構造:', {
          success: usersResult.success,
          dataLength: usersResult.data?.length,
          firstUser: usersResult.data?.[0]
        })
        if (usersResult.success && usersResult.data) {
          const formattedUsers = usersResult.data.map((u: any) => ({
            id: u.id,
            name: u.full_name || u.email || '名前未設定'
          }))
          console.log('👥 フォーマット済みユーザー:', formattedUsers)
          setUsers(formattedUsers)
        } else {
          console.log('❌ ユーザーデータ取得失敗:', usersResult)
        }
      } else {
        console.error('❌ ユーザーAPI呼び出し失敗:', usersResponse.status, usersResponse.statusText)
        try {
          const errorText = await usersResponse.text()
          console.error('❌ エラー詳細:', errorText)
        } catch (e) {
          console.error('❌ エラーテキスト取得失敗:', e)
        }
      }

      // タスクデータの設定（実データのみ）
      if (ganttResult.success) {
        console.log('📊 fetchData - 取得されたタスク数:', ganttResult.data.tasks?.length || 0)
        console.log('📊 fetchData - タスク詳細:', ganttResult.data.tasks?.map(t => ({ id: t.id, name: t.name })) || [])
        setTasks(ganttResult.data.tasks || [])
      } else {
        console.log('Gantt API エラー:', ganttResult.error)
        setTasks([])
      }

      // 野菜データは専用APIから取得（実データのみ）
      console.log('🔍 fetchData - 野菜API結果:', vegetablesResult)
      if (vegetablesResult.success && vegetablesResult.data) {
        console.log('🔍 fetchData - 取得された野菜数:', vegetablesResult.data.length)
        console.log('🔍 fetchData - 野菜詳細:', vegetablesResult.data.map((v: any) => ({ id: v.id, name: v.name, company_id: v.company_id })))
        const vegetableData = vegetablesResult.data.map((v: any) => ({
          id: v.id,
          name: v.name,
          variety: v.variety_name,
          status: v.status,
          area_size: v.area_size || 0
        }))
        setVegetables(vegetableData)

        // 初回ロード時は全ての野菜を展開状態にする
        if (expandedVegetables.size === 0) {
          setExpandedVegetables(new Set(vegetableData.map(v => v.id)))
        }
      } else {
        console.log('❌ fetchData - 野菜API エラー:', vegetablesResult.error)
        setVegetables([])
      }

      // 作業レポートデータの設定（実データのみ）
      if (reportsResult.success) {
        console.log('📊 fetchData - 作業レポートデータ詳細:', reportsResult.data?.map(r => ({ 
          id: r.id, 
          work_date: r.work_date, 
          work_type: r.work_type,
          vegetable_id: r.vegetable_id 
        })) || [])
        console.log('📊 fetchData - 作業レポート生データ（最初の3件）:', reportsResult.data?.slice(0, 3) || [])
        setWorkReports(reportsResult.data || [])
      } else {
        console.log('作業レポートAPI エラー:', reportsResult.error)
        setWorkReports([])
      }
    } catch (error) {
      console.error('データ取得エラー:', error)
      // エラー時は空のデータを設定
      setTasks([])
      setVegetables([])
      setWorkReports([])
    } finally {
      setLoading(false)
    }
  }

  // 期間検証関数
  const validateDateRange = (startDate: string, endDate: string): boolean => {
    if (!startDate || !endDate) {
      setDateRangeError('開始日と終了日の両方を選択してください')
      return false
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    if (start >= end) {
      setDateRangeError('終了日は開始日より後の日付を選択してください')
      return false
    }

    // 最低1ヶ月の制約チェック
    const oneMonthLater = new Date(start)
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1)
    
    if (end < oneMonthLater) {
      setDateRangeError('表示期間は最低1ヶ月以上で設定してください')
      return false
    }

    setDateRangeError('')
    return true
  }

  // カスタム期間でのデータ取得関数
  const fetchDataWithCustomRange = async (startDate: Date, endDate: Date) => {
    if (!companyId) {
      console.log('❌ Gantt: companyIdが未設定のため、カスタム範囲データ取得をスキップ')
      return
    }
    
    setLoading(true)
    try {
      console.log('📊 Gantt: fetchDataWithCustomRange開始, companyId:', companyId)
      
      const startStr = format(startDate, 'yyyy-MM-dd')
      const endStr = format(endDate, 'yyyy-MM-dd')
      
      const params = new URLSearchParams({
        company_id: companyId,
        start_date: startStr,
        end_date: endStr
      })

      if (selectedVegetable !== 'all') {
        params.append('vegetable_id', selectedVegetable)
      }

      params.append('active_only', 'true')
      
      // データを並行取得
      const [ganttResponse, reportsResponse, vegetablesResponse, usersResponse] = await Promise.all([
        fetch(`/api/gantt?${params.toString()}`),
        fetch(`/api/reports?company_id=${companyId}&start_date=${startStr}&end_date=${endStr}&active_only=true`),
        fetch(`/api/vegetables?company_id=${companyId}`),
        fetch(`/api/users?company_id=${companyId}`) // ユーザーデータを取得
      ])

      const ganttResult = await ganttResponse.json()
      let reportsResult = { success: false, data: [] }
      let vegetablesResult = { success: false, data: [] }
      let usersResult = { success: false, users: [] }
      
      if (reportsResponse.ok) {
        reportsResult = await reportsResponse.json()
      }
      
      if (vegetablesResponse.ok) {
        vegetablesResult = await vegetablesResponse.json()
      }

      console.log('👥 ユーザーAPIレスポンスステータス:', usersResponse.status, usersResponse.ok)
      if (usersResponse.ok) {
        usersResult = await usersResponse.json()
        console.log('👥 取得したユーザーデータ:', usersResult)
        console.log('👥 ユーザーデータの構造:', {
          success: usersResult.success,
          dataLength: usersResult.data?.length,
          firstUser: usersResult.data?.[0]
        })
        if (usersResult.success && usersResult.data) {
          const formattedUsers = usersResult.data.map((u: any) => ({
            id: u.id,
            name: u.full_name || u.email || '名前未設定'
          }))
          console.log('👥 フォーマット済みユーザー:', formattedUsers)
          setUsers(formattedUsers)
        } else {
          console.log('❌ ユーザーデータ取得失敗:', usersResult)
        }
      } else {
        console.error('❌ ユーザーAPI呼び出し失敗:', usersResponse.status, usersResponse.statusText)
        try {
          const errorText = await usersResponse.text()
          console.error('❌ エラー詳細:', errorText)
        } catch (e) {
          console.error('❌ エラーテキスト取得失敗:', e)
        }
      }

      // 取得したデータでUIを更新
      if (ganttResult.success && ganttResult.data?.tasks) {
        setTasks(ganttResult.data.tasks || [])
      } else {
        setTasks([])
      }

      if (vegetablesResult.success && vegetablesResult.data) {
        setVegetables(vegetablesResult.data.map((v: any) => ({
          id: v.id,
          name: v.name,
          variety: v.variety_name || '（未定）'
        })))
      } else {
        setVegetables([])
      }

      if (reportsResult.success && reportsResult.data) {
        setWorkReports(reportsResult.data.map((r: any) => ({
          id: r.id,
          vegetable_id: r.vegetable_id
        })))
      } else {
        setWorkReports([])
      }

      console.log(`✅ カスタム期間データ取得完了: ${startStr} 〜 ${endStr}`)
      
    } catch (error) {
      console.error('カスタム期間データ取得エラー:', error)
      setTasks([])
      setVegetables([])
      setWorkReports([])
    } finally {
      setLoading(false)
    }
  }

  // 安全な日付フォーマット関数
  const safeFormatDate = (dateValue: any, formatStr: string = 'MM/dd'): string => {
    if (!dateValue) return '-'
    
    try {
      const date = new Date(dateValue)
      if (isNaN(date.getTime())) {
        return '-'
      }
      return format(date, formatStr, { locale: ja })
    } catch (error) {
      console.warn('日付フォーマットエラー:', dateValue, error)
      return '-'
    }
  }

  // カスタム期間変更処理
  const handleCustomDateChange = () => {
    if (validateDateRange(customStartDate, customEndDate)) {
      const startDate = new Date(customStartDate)
      const endDate = new Date(customEndDate)
      
      // カスタム範囲を設定
      setCustomRange({ start: startDate, end: endDate })
      setIsUsingCustomRange(true)
      
      // データを再取得
      fetchDataWithCustomRange(startDate, endDate)
    }
  }

  // テストデータ生成を完全に削除 - 実データベースのみ使用

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
    // CSV出力（ガントチャートの全データを出力）
    const csvHeaders = ['タスク名', '野菜', '担当者', '開始日', '終了日', '進捗率', 'ステータス', '優先度']
    const csvData = ganttTasks.map(task => [
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

  const handleNewTask = async () => {
    if (!companyId) {
      console.log('❌ Gantt: companyIdが未設定のため、新規タスク作成をスキップ')
      return
    }
    
    // タスク作成前に最新の野菜データを取得
    try {
      console.log('🎯 Gantt: handleNewTask開始, companyId:', companyId)
      
      const response = await fetch(`/api/vegetables?company_id=${companyId}`)
      
      if (response.ok) {
        const result = await response.json()
        console.log('🎯 handleNewTask - 野菜API結果:', result)
        if (result.success && result.data) {
          console.log('🎯 handleNewTask - 取得した野菜数:', result.data.length)
          // 最新の野菜データで更新
          setVegetables(result.data.map((v: any) => ({
            id: v.id,
            name: v.name,
            variety: v.variety_name,
            status: v.status
          })))
        } else {
          console.log('❌ handleNewTask - APIからのデータが空のため、空の野菜設定とします')
          setVegetables([])
        }
      }
    } catch (error) {
      console.error('野菜データの更新に失敗:', error)
    }
    
    setShowNewTaskModal(true)
  }

  // 作業記録成功時のハンドラー
  const handleWorkReportSuccess = () => {
    // 作業記録成功時にデータを再取得
    fetchData()
    toast({
      title: '成功',
      description: '作業記録を保存しました',
      type: 'success'
    })
  }

  // タスク作成処理 - プロフェッショナル実装
  const handleCreateTask = async (taskData: Partial<GanttTask>) => {
    // バリデーション
    if (!taskData.name?.trim()) {
      toast({
        title: '入力エラー',
        description: 'タスク名を入力してください',
        type: 'error'
      })
      return
    }
    if (!taskData.vegetable?.id) {
      toast({
        title: '入力エラー',
        description: '野菜を選択してください',
        type: 'error'
      })
      return
    }
    if (!taskData.start || !taskData.end) {
      toast({
        title: '入力エラー',
        description: '開始日と終了日を設定してください',
        type: 'error'
      })
      return
    }
    if (new Date(taskData.start) >= new Date(taskData.end)) {
      toast({
        title: '入力エラー',
        description: '終了日は開始日より後に設定してください',
        type: 'error'
      })
      return
    }

    setIsCreatingTask(true)
    setError('')
    
    try {
      // 認証情報から作成者IDを取得
      let createdBy = 'd0efa1ac-7e7e-420b-b147-dabdf01454b7' // デフォルト
      
      const userResponse = await fetch('/api/auth/user')
      if (userResponse.ok) {
        const userData = await userResponse.json()
        if (userData.success && userData.user?.id) {
          createdBy = userData.user.id
          console.log('✅ handleCreateTask - 作成者ID:', createdBy)
        }
      }
      
      // 統一アーキテクチャでのデータベース保存（work_reportsと同じパターン）
      const payload = {
        vegetable_id: taskData.vegetable.id,
        name: taskData.name,
        start_date: taskData.start,
        end_date: taskData.end,
        priority: taskData.priority || 'medium',
        task_type: taskData.workType || 'other',
        description: taskData.description,
        assigned_user_id: taskData.assignedUser?.id,
        company_id: companyId,
        created_by: createdBy
      }
      
      console.log('🚀 統一アーキテクチャでタスク作成:', payload)
      
      const response = await retryWithBackoff(() => fetch('/api/growing-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      }))

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP error! status: ${response.status}, ${errorText}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'タスクの作成に失敗しました')
      }

      console.log('✅ タスク作成成功:', result.data)

      // /api/growing-tasksのレスポンス形式をガンチャート用に変換
      const getStatusColor = (status: string): string => {
        const colors = {
          pending: '#94a3b8',      // グレー
          in_progress: '#3b82f6',  // ブルー
          completed: '#10b981',    // グリーン
          cancelled: '#ef4444',    // レッド
        }
        return colors[status as keyof typeof colors] || colors.pending
      }
      
      const ganttFormattedTask = {
        id: result.data.id,
        name: result.data.name,
        start: result.data.start_date,
        end: result.data.end_date,
        progress: result.data.progress || 0,
        status: result.data.status,
        priority: result.data.priority,
        workType: result.data.task_type,
        description: result.data.description,
        vegetable: result.data.vegetable,
        assignedUser: result.data.assigned_to ? {
          id: result.data.assigned_to,
          name: 'User' // 一時的
        } : null,
        color: getStatusColor(result.data.status)
      }

      // 成功: 作業記録と同じように即座にリフレッシュ
      toast({
        title: '成功',
        description: 'タスクを作成しました',
        type: 'success'
      })
      setShowNewTaskModal(false)
      
      // タスク作成成功
      console.log('✅ タスク作成成功:', result.data.name)
      
      // データを再取得して確実に最新状態を表示
      // 新しく作成されたタスクの日付を含むように期間を調整
      await fetchDataWithTaskDateRange(ganttFormattedTask)
      
      // 分析データ同期（非同期で実行）
      try {
        await syncTaskToAnalytics(result.data)
      } catch (syncError) {
        console.warn('分析データ同期エラー:', syncError)
      }
      
    } catch (error) {
      console.error('タスク作成エラー:', error)
      
      // ネットワークエラーの特別処理
      if (isNetworkError(error)) {
        setNetworkError(true)
        toast({
          title: 'ネットワークエラー',
          description: 'インターネット接続を確認してください。自動で再試行しましたが失敗しました。',
          type: 'error',
          duration: 8000
        })
      } else {
        // エラーメッセージ表示
        const errorMessage = error instanceof Error ? error.message : 'タスクの作成に失敗しました'
        setError(errorMessage)
        toast({
          title: 'エラー',
          description: errorMessage,
          type: 'error'
        })
      }
    } finally {
      setIsCreatingTask(false)
    }
  }

  // 進捗率更新用の一時的な値を管理
  const [tempProgress, setTempProgress] = useState<{[key: string]: number}>({})
  const [progressUpdateTimeout, setProgressUpdateTimeout] = useState<NodeJS.Timeout | null>(null)

  const handleProgressUpdate = async (taskId: string, newProgress: number, immediate: boolean = false) => {
    // 楽観的更新: 即座にUIを更新
    const oldTasks = tasks
    const newStatus = newProgress === 100 ? 'completed' :
                     newProgress > 0 ? 'in_progress' : 'pending'

    setTasks(prev => prev.map(task =>
      task.id === taskId
        ? { ...task,
            progress: newProgress,
            status: newStatus,
            color: STATUS_COLORS[newStatus]
          }
        : task
    ))

    // タスク詳細モーダルが開いている場合は、そのデータも更新
    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask(prev => prev ? { ...prev, progress: newProgress, status: newStatus, color: STATUS_COLORS[newStatus] } : null)
    }

    // ボタンクリックまたはimmediateフラグがある場合は即座に保存
    if (immediate) {
      await saveProgressToDatabase(taskId, newProgress, newStatus, oldTasks)
    } else {
      // デバウンス処理: 500ms待ってから保存
      if (progressUpdateTimeout) {
        clearTimeout(progressUpdateTimeout)
      }
      const timeout = setTimeout(async () => {
        await saveProgressToDatabase(taskId, newProgress, newStatus, oldTasks)
      }, 500)
      setProgressUpdateTimeout(timeout)
    }
  }

  const saveProgressToDatabase = async (taskId: string, newProgress: number, newStatus: string, oldTasks: any[]) => {

    try {
      // データベースを更新
      const response = await fetch('/api/gantt', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: taskId,
          progress: newProgress,
          status: newStatus
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || '進捗の更新に失敗しました')
      }

      // 分析データ同期
      const updatedTask = tasks.find(t => t.id === taskId)
      if (updatedTask) {
        await syncTaskToAnalytics({...updatedTask, progress: newProgress, status: newStatus})
      }

      // 成功時のフィードバック
      console.log(`✅ タスク進捗を${newProgress}%に更新しました`)

    } catch (error) {
      console.error('進捗更新エラー:', error)
      // ロールバック
      setTasks(oldTasks)
      toast({
        title: 'エラー',
        description: '進捗の更新に失敗しました',
        type: 'error'
      })
    }
  }

  // タスク更新処理
  const handleUpdateTask = async (taskId: string, updates: Partial<GanttTask>) => {
    const oldTasks = tasks
    setIsUpdatingTask(true)
    setError('')

    // 楽観的更新
    setTasks(prev => prev.map(task => 
      task.id === taskId ? { ...task, ...updates } : task
    ))

    try {
      const response = await fetch('/api/gantt', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: taskId,
          name: updates.name,
          start_date: updates.start,
          end_date: updates.end,
          priority: updates.priority,
          description: updates.description,
          assigned_user_id: updates.assigned_user_id !== undefined ? updates.assigned_user_id : updates.assignedUser?.id
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'タスクの更新に失敗しました')
      }

      // 成功メッセージ
      toast({
        title: '成功',
        description: 'タスクを更新しました',
        type: 'success'
      })
      
      // 分析データ同期
      const updatedTask = tasks.find(t => t.id === taskId)
      if (updatedTask) {
        await syncTaskToAnalytics({...updatedTask, ...updates})
      }
      
    } catch (error) {
      console.error('タスク更新エラー:', error)
      // ロールバック
      setTasks(oldTasks)
      toast({
        title: 'エラー',
        description: error instanceof Error ? error.message : 'タスクの更新に失敗しました',
        type: 'error'
      })
    } finally {
      setIsUpdatingTask(false)
    }
  }

  // プロフェッショナル削除処理：楽観的更新＋ロールバック対応
  const handleDeleteTask = async (taskId: string, reason?: string) => {
    console.log('🗑️ プロフェッショナル削除処理開始:', taskId)
    
    const taskToDelete = tasks.find(t => t.id === taskId)
    if (!taskToDelete) {
      console.log('❌ タスクが見つかりません:', taskId)
      toast({
        title: 'エラー',
        description: 'タスクが見つかりません',
        type: 'error'
      })
      return
    }

    // 1. 楽観的更新：即座にUIからタスクを削除
    console.log('⚡ 楽観的更新実行中...')
    const originalTasks = tasks
    setTasks(prev => prev.filter(task => task.id !== taskId))
    setIsDeletingTask(taskId)
    setError('')

    // 2. 成功の仮定でトースト表示（後でロールバック可能）
    const optimisticToastId = Date.now().toString()
    toast({
      id: optimisticToastId,
      title: '削除中',
      description: `"${taskToDelete.name}" を削除しています...`,
      type: 'info',
      duration: 3000
    })

    try {
      // 3. サーバーAPIコール（統一エンドポイント使用）
      console.log('🌐 統一削除API呼び出し:', `/api/growing-tasks/${taskId}`)
      const response = await fetch(`/api/growing-tasks/${taskId}?reason=${encodeURIComponent(reason || '手動削除')}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      const result = await response.json()
      console.log('📡 削除API レスポンス:', result)

      if (!result.success) {
        console.error('🗑️ 削除API詳細エラー:', result)
        throw new Error(result.error || 'タスクの削除に失敗しました')
      }

      // 4. 削除成功：楽観的更新を確定
      console.log('✅ 削除成功確定:', result.data?.deleted_name)
      
      toast({
        title: '削除完了',
        description: `"${result.data?.deleted_name || taskToDelete.name}" を削除しました`,
        type: 'success'
      })
      
      // 確実にタスクが消えるよう強制リロード
      setTimeout(() => {
        window.location.reload()
      }, 1000)

      // 5. 分析システム通知
      window.dispatchEvent(new CustomEvent('taskAnalyticsDelete', { 
        detail: { 
          taskId, 
          vegetableId: taskToDelete.vegetable.id,
          deletedName: taskToDelete.name
        } 
      }))

      // 6. 関連データ更新通知
      console.log('📊 関連データ更新イベント発行')
      window.dispatchEvent(new CustomEvent('tasksDataChanged', {
        detail: { action: 'delete', taskId, vegetableName: result.data?.vegetable_info?.name }
      }))

    } catch (error) {
      // 7. エラー発生：楽観的更新をロールバック
      console.error('❌ 削除エラー - ロールバック実行:', error)
      
      // タスクリストを元に戻す（ソート順も保持）
      setTasks(originalTasks)
      
      // エラートースト表示
      toast({
        title: '削除エラー',
        description: error instanceof Error ? error.message : 'タスクの削除に失敗しました',
        type: 'error',
        duration: 6000
      })

      // 詳細エラー情報をログ出力
      console.error('削除エラー詳細:', {
        taskId,
        taskName: taskToDelete.name,
        error: error.message,
        timestamp: new Date().toISOString()
      })

    } finally {
      // 8. 後処理
      setIsDeletingTask(null)
      console.log('🏁 削除処理完了')
    }
  }

  // 実績記録削除処理
  const handleDeleteReport = async (reportId: string) => {
    try {
      const response = await fetch('/api/reports', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: reportId })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || '実績記録の削除に失敗しました')
      }

      toast({
        title: '成功',
        description: result.message || '実績記録を削除しました',
        type: 'success'
      })
      
      // データを再取得
      fetchData()
      
    } catch (error) {
      console.error('実績記録削除エラー:', error)
      toast({
        title: 'エラー',
        description: error instanceof Error ? error.message : '実績記録の削除に失敗しました',
        type: 'error'
      })
    }
  }

  // プロフェッショナル削除確認：事前検証付き
  const showDeleteConfirmation = async (item: any, type: 'task' | 'report') => {
    console.log('🗑️ 削除確認ダイアログ準備中:', { item: item.name, type, id: item.id })
    
    // 初期ダイアログ表示
    setDeleteConfirmDialog({
      show: true,
      item,
      type,
      validation: null, // 検証中
      isValidating: true
    })

    // タスクの場合は削除前検証を実行
    if (type === 'task') {
      try {
        console.log('🔍 削除前検証実行中...')
        const response = await fetch(`/api/growing-tasks/${item.id}`, {
          method: 'GET'
        })
        
        const validation = await response.json()
        console.log('🔍 検証結果:', validation)
        
        setDeleteConfirmDialog(prev => ({
          ...prev,
          validation,
          isValidating: false
        }))
      } catch (error) {
        console.error('削除前検証エラー:', error)
        setDeleteConfirmDialog(prev => ({
          ...prev,
          validation: {
            can_delete: true,
            warnings: ['検証に失敗しましたが、削除は可能です']
          },
          isValidating: false
        }))
      }
    } else {
      // レポートの場合は検証なし
      setDeleteConfirmDialog(prev => ({
        ...prev,
        validation: { can_delete: true, warnings: [] },
        isValidating: false
      }))
    }
  }

  // プロフェッショナル削除実行：理由付きでの削除
  const handleConfirmDelete = async (reason?: string) => {
    const { item, type, validation } = deleteConfirmDialog
    
    console.log('🗑️ 削除実行開始:', { 
      item: item?.name, 
      type, 
      id: item?.id, 
      reason: reason || '理由未指定',
      can_delete: validation?.can_delete 
    })
    
    // 削除不可能な場合の確認
    if (validation && !validation.can_delete) {
      toast({
        title: '削除不可',
        description: '削除条件を満たしていません',
        type: 'error'
      })
      return
    }

    // ダイアログを閉じる
    setDeleteConfirmDialog({ 
      show: false, 
      item: null, 
      type: 'task',
      validation: null,
      isValidating: false
    })
    
    if (type === 'task') {
      console.log('🗑️ タスク削除処理を呼び出し:', item.id, '理由:', reason)
      await handleDeleteTask(item.id, reason)
    } else {
      console.log('🗑️ レポート削除処理を呼び出し:', item.id)
      await handleDeleteReport(item.id)
    }
  }

  // 旧フィルタリング（CollapsibleSearchFilterが優先されるため、現在は使用されない）
  const oldFilteredTasks = tasks.filter(task => {
    if (selectedVegetable !== 'all' && task.vegetable.id !== selectedVegetable) return false
    if (selectedPriority !== 'all' && task.priority !== selectedPriority) return false
    if (searchQuery && !task.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  // ガントチャート用データ（フィルター適用なし）
  const ganttVegetables = vegetables
  const ganttTasks = tasks
  const ganttReports = workReports
  
  // 個別野菜管理用データ（フィルター適用）
  const displayVegetables = filteredVegetableData.hasActiveFilters 
    ? filteredVegetableData.filteredVegetables 
    : vegetables
  
  const displayTasks = filteredVegetableData.hasActiveFilters 
    ? filteredVegetableData.filteredTasks 
    : tasks
  
  const displayReports = filteredVegetableData.hasActiveFilters 
    ? filteredVegetableData.filteredReports 
    : workReports

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
        
        <div className="flex items-center gap-2">
          {/* 栽培管理グループ */}
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowMapView(true)}
              className="bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 hover:border-emerald-300 shadow-sm transition-all duration-200"
            >
              <Map className="w-4 h-4 mr-1" />
              <span className="hidden xl:inline">地図上で栽培野菜計画登録</span>
              <span className="hidden md:inline xl:hidden">地図計画登録</span>
              <span className="md:hidden">地図</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleNewTask}
              className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:text-blue-800 hover:border-blue-300 shadow-sm transition-all duration-200"
            >
              <Plus className="w-4 h-4 mr-1" />
              <span className="hidden xl:inline">栽培スケジュール・タスク登録</span>
              <span className="hidden md:inline xl:hidden">タスク登録</span>
              <span className="md:hidden">新規</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowWorkReportForm(true)}
              className="bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100 hover:text-orange-800 hover:border-orange-300 shadow-sm transition-all duration-200"
            >
              <Calendar className="w-4 h-4 mr-1" />
              <span className="hidden xl:inline">栽培作業記録・報告</span>
              <span className="hidden md:inline xl:hidden">作業記録</span>
              <span className="md:hidden">記録</span>
            </Button>
          </div>

          {/* データ操作グループ */}
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleExport}
              className="text-green-700 hover:text-green-800 hover:bg-green-100 transition-all duration-200"
            >
              <Download className="w-4 h-4 mr-1" />
              <span className="hidden md:inline">エクスポート</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-blue-700 hover:text-blue-800 hover:bg-blue-100 transition-all duration-200"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">更新</span>
            </Button>
          </div>
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded-full"></div>
            <h3 className="text-sm font-medium text-red-800">エラーが発生しました</h3>
          </div>
          <p className="text-sm text-red-700 mt-1">{error}</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setError('')}
            className="mt-2 text-red-700 border-red-200 hover:bg-red-100"
          >
            閉じる
          </Button>
        </div>
      )}



      {/* 栽培野菜管理チャート */}
      {ganttTasks.length > 0 || ganttVegetables.length > 0 ? (
        <GanttChart 
          tasks={ganttTasks}
          workReports={ganttReports}
          vegetables={ganttVegetables}
          startDate={start}
          endDate={end}
          viewUnit={viewUnit}
          onTaskClick={handleTaskClick}
          onWorkReportView={handleWorkReportClick}
          onWorkReportEdit={handleEditWorkReport}
          className="min-h-[500px]"
          selectedVegetable={selectedVegetable}
          selectedPriority={selectedPriority}
          customStartDate={customStartDate}
          customEndDate={customEndDate}
          onVegetableChange={(value) => {
            console.log('🔄 親コンポーネント - 野菜変更:', value)
            setSelectedVegetable(value)
          }}
          onPriorityChange={(value) => {
            console.log('🔄 親コンポーネント - 優先度変更:', value)
            setSelectedPriority(value)
          }}
          onDateRangeChange={(startDate, endDate) => {
            console.log('🔄 親コンポーネント - 日付変更:', startDate, endDate)
            setCustomStartDate(startDate)
            setCustomEndDate(endDate)
          }}
        />
      ) : (
        <Card className="min-h-[500px]">
          <CardContent className="flex items-center justify-center h-full">
            <div className="text-center py-12">
              <Sprout className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">登録情報がありません</h3>
              <p className="text-gray-500 text-sm mb-6">野菜やタスクを登録すると、ガントチャートが表示されます</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button 
                  variant="outline" 
                  onClick={() => setShowMapView(true)}
                  className="bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                >
                  <Map className="w-4 h-4 mr-2" />
                  野菜を登録
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleNewTask}
                  className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  タスクを登録
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 野菜別 計画タスク・実績記録 */}
      <div className="space-y-6">
        {/* ガントチャートと同じ緑色ヘッダーデザイン */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
              <Sprout className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold">野菜別 計画・実績管理</h2>
              <p className="text-green-100 text-sm">
                各野菜の栽培計画と作業実績を個別に管理
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
                {vegetables.length}種類の野菜
              </Badge>
              <Button 
                onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                variant="ghost" 
                size="sm" 
                className="text-white hover:bg-white/20 border border-white/30 h-9 px-3"
              >
                <Filter className="w-4 h-4 mr-1.5" />
                フィルター
                {activeFilterCount > 0 && (
                  <Badge className="ml-2 px-1.5 py-0.5 text-xs bg-yellow-400 text-green-800 border-0">
                    {activeFilterCount}
                  </Badge>
                )}
                {isFilterExpanded ? <ChevronUp className="w-4 h-4 ml-1.5" /> : <ChevronDown className="w-4 h-4 ml-1.5" />}
              </Button>
              {activeFilterCount > 0 && (
                <Button 
                  onClick={handleResetFilters} 
                  variant="ghost" 
                  size="sm" 
                  className="text-white hover:bg-white/20 border border-white/30 h-9 w-9 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* フィルターパネル */}
        <CollapsibleSearchFilter
          vegetables={vegetables}
          workReports={workReports}
          tasks={tasks}
          onFiltersChange={handleFiltersChange}
          isExpanded={isFilterExpanded}
          onToggleExpanded={setIsFilterExpanded}
        />

        {/* フィルター結果がない場合のメッセージ */}
        {filteredVegetableData.filteredVegetables.length === 0 && filteredVegetableData.resultSummary && (
          <Card className="py-8 border-orange-200 bg-orange-50">
            <CardContent className="text-center">
              <div className="text-orange-600">
                <Search className="w-12 h-12 mx-auto mb-2" />
                <p className="font-medium">検索条件に該当する記録が見つかりません</p>
                <p className="text-sm mt-1">検索条件を変更してお試しください</p>
              </div>
            </CardContent>
          </Card>
        )}

        {vegetables.length === 0 ? (
          <Card className="py-16">
            <CardContent className="flex items-center justify-center">
              <div className="text-center">
                <Sprout className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">登録情報がありません</h3>
                <p className="text-gray-500 text-sm mb-6">野菜を登録すると、計画・実績管理が表示されます</p>
                <Button 
                  variant="outline" 
                  onClick={() => setShowMapView(true)}
                  className="bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                >
                  <Map className="w-4 h-4 mr-2" />
                  野菜を登録する
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          // フィルター済みデータを使用して個別野菜を表示
          displayVegetables.map(vegetable => {
            const vegetableTasks = displayTasks.filter(task => task.vegetable?.id === vegetable.id)
            const vegetableReports = displayReports.filter((report: any) => report.vegetable_id === vegetable.id)
            const isExpanded = expandedVegetables.has(vegetable.id)

            // データがない野菜はスキップ
            if (vegetableTasks.length === 0 && vegetableReports.length === 0) {
              return null
            }

            const toggleExpanded = () => {
              const newExpanded = new Set(expandedVegetables)
              if (isExpanded) {
                newExpanded.delete(vegetable.id)
              } else {
                newExpanded.add(vegetable.id)
              }
              setExpandedVegetables(newExpanded)
            }

          return (
            <Card key={vegetable.id} className="shadow-sm">
              <CardHeader
                className="bg-gradient-to-r from-green-50 to-blue-50 border-b cursor-pointer hover:from-green-100 hover:to-blue-100 transition-colors"
                onClick={toggleExpanded}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1 h-auto"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleExpanded()
                      }}
                    >
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </Button>
                    <div className="bg-green-500 p-2 rounded-full">
                      <Sprout className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-gray-800">{vegetable.name}</CardTitle>
                      <CardDescription className="text-sm">
                        品種: {vegetable.variety} • ステータス: {vegetable.status}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-blue-300 text-blue-700">
                      計画 {vegetableTasks.length}件
                    </Badge>
                    <Badge variant="outline" className="border-green-300 text-green-700">
                      実績 {vegetableReports.length}件
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              
              {isExpanded && (
                <CardContent className="p-0">
                  <div className="grid grid-cols-1 xl:grid-cols-2">
                  {/* 左側: 計画タスク */}
                  <div className="border-r border-gray-200 bg-blue-50/30">
                    <div className="bg-blue-100/50 px-4 py-3 border-b">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-600" />
                        <h3 className="font-medium text-blue-800">計画タスク</h3>
                        <Badge variant="secondary" className="bg-blue-200 text-blue-800 text-xs">
                          {vegetableTasks.length}件
                        </Badge>
                      </div>
                    </div>
                    <div className="p-4 min-h-[200px] max-h-96 overflow-y-auto">
                      {vegetableTasks.length > 0 ? (
                        <div className="space-y-3">
                          {vegetableTasks.map(task => (
                            <div 
                              key={task.id}
                              className="border rounded-lg p-3 bg-white hover:bg-blue-50/50 cursor-pointer transition-all duration-200 group relative select-none"
                              onClick={(e) => {
                                // ドロップダウンメニューがクリックされた場合はタスククリックを無効化
                                if (e.target instanceof Element && e.target.closest('[data-radix-dropdown-menu-trigger]')) {
                                  return
                                }
                                e.preventDefault()
                                e.stopPropagation()
                                handleTaskClick(task)
                              }}
                              role="button"
                              tabIndex={0}
                              style={{ userSelect: 'none' }}
                            >
                              {/* アクションメニュー */}
                              <div className="absolute top-2 right-2">
                                <DropdownMenu onOpenChange={(open) => {
                                  if (!open) {
                                    // ドロップダウンが閉じられた時にフォーカスをリセット
                                    setTimeout(() => {
                                      if (document.activeElement instanceof HTMLElement) {
                                        document.activeElement.blur()
                                      }
                                      document.body.focus()
                                    }, 10)
                                  }
                                }}>
                                  <DropdownMenuTrigger asChild>
                                    <Button 
                                      size="sm" 
                                      variant="ghost" 
                                      className="h-7 w-7 p-1.5 text-slate-500 hover:text-blue-600 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105"
                                      onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                      }}
                                      onMouseDown={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                      }}
                                      style={{ userSelect: 'none' }}
                                    >
                                      <Settings className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent 
                                    align="end" 
                                    className="w-48 bg-white border border-gray-200 rounded-lg shadow-lg p-1 backdrop-blur-sm"
                                  >
                                    <DropdownMenuItem 
                                      onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        handleTaskClick(task)
                                      }}
                                      className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md cursor-pointer transition-colors duration-200"
                                    >
                                      <Edit className="w-4 h-4 mr-3 text-blue-500" />
                                      詳細・編集
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        showDeleteConfirmation(task, 'task')
                                      }}
                                      className="flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 rounded-md cursor-pointer transition-colors duration-200"
                                    >
                                      <Trash2 className="w-4 h-4 mr-3 text-red-500" />
                                      削除
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                              <div className="mb-2">
                                <h4 className="font-medium text-sm mb-1">{task.name}</h4>
                                <div className="flex items-center gap-2">
                                  {task.workType && (
                                    <span className="text-xs text-gray-500">
                                      {getWorkTypeLabel(task.workType)}
                                    </span>
                                  )}
                                  <Badge 
                                    variant="secondary"
                                    style={{ backgroundColor: task.color, color: 'white' }}
                                    className="text-xs"
                                  >
                                    {task.status === 'pending' && '未開始'}
                                    {task.status === 'in_progress' && '進行中'}
                                    {task.status === 'completed' && '完了'}
                                    {task.status === 'cancelled' && '中止'}
                                  </Badge>
                                </div>
                              </div>
                              
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-xs text-gray-600">
                                  {safeFormatDate(task.start, 'MM/dd')} 〜 
                                  {safeFormatDate(task.end, 'MM/dd')}
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {task.priority === 'high' && '高'}
                                  {task.priority === 'medium' && '中'}
                                  {task.priority === 'low' && '低'}
                                </Badge>
                              </div>

                              <div className="flex items-center justify-between">
                                <div className="text-xs text-gray-500">
                                  {task.assignedUser?.name || '未割当'}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium">{task.progress}%</span>
                                  <div className="w-16 h-1.5 bg-gray-200 rounded-full">
                                    <div 
                                      className="h-1.5 rounded-full transition-all"
                                      style={{ 
                                        width: `${task.progress}%`,
                                        backgroundColor: task.color
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                          <p className="text-sm text-gray-500">計画タスクがありません</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 右側: 実績記録 */}
                  <div className="bg-green-50/30">
                    <div className="bg-green-100/50 px-4 py-3 border-b">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-green-600" />
                        <h3 className="font-medium text-green-800">実績記録</h3>
                        <Badge variant="secondary" className="bg-green-200 text-green-800 text-xs">
                          {vegetableReports.length}件
                        </Badge>
                      </div>
                    </div>
                    <div className="p-4 min-h-[200px] max-h-96 overflow-y-auto">
                      {vegetableReports.length > 0 ? (
                        <div className="space-y-4">
                          {vegetableReports.map((report: any) => (
                            <WorkReportCard 
                              key={report.id}
                              report={report}
                              onClick={handleWorkReportClick}
                              onEdit={handleEditWorkReport}
                              onDelete={(report) => showDeleteConfirmation(report, 'report')}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                          <p className="text-sm text-gray-500">実績記録がありません</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
              )}
            </Card>
          )
        }))}
      </div>

      {/* タスク詳細モーダル */}
      <Dialog open={isTaskModalOpen} onOpenChange={(open) => {
        console.log('Dialog onOpenChange called with:', open)
        if (!open) {
          setSelectedTask(null)
          setIsTaskModalOpen(false)
          // ダイアログが閉じられた時にフォーカスをリセット
          setTimeout(() => {
            if (document.activeElement instanceof HTMLElement) {
              document.activeElement.blur()
            }
            document.body.focus()
            // ページ全体のポインターイベントを確実に有効化
            document.body.style.pointerEvents = 'auto'
            document.documentElement.style.pointerEvents = 'auto'
          }, 100)
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
                    <Select
                      value={pendingTaskChanges?.assignedUser?.id ?? selectedTask.assignedUser?.id ?? 'unassigned'}
                      onValueChange={(value) => {
                        const newAssignee = value === 'unassigned' ? null : users.find(u => u.id === value)
                        setPendingTaskChanges(prev => ({
                          ...prev,
                          assignedUser: newAssignee,
                          assigned_user_id: newAssignee?.id || null
                        }))
                        setHasUnsavedChanges(true)
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="担当者を選択" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">未割当</SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">期間</Label>
                    <p className="text-sm text-gray-600">
                      {safeFormatDate(selectedTask.start, 'yyyy年MM月dd日')} 〜{' '}
                      {safeFormatDate(selectedTask.end, 'yyyy年MM月dd日')}
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
                    <Select
                      value={pendingTaskChanges?.priority ?? selectedTask.priority ?? 'medium'}
                      onValueChange={(value) => {
                        setPendingTaskChanges(prev => ({
                          ...prev,
                          priority: value
                        }))
                        setHasUnsavedChanges(true)
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="優先度を選択" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">高優先度</SelectItem>
                        <SelectItem value="medium">中優先度</SelectItem>
                        <SelectItem value="low">低優先度</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">進捗率</Label>
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl font-bold">{pendingTaskChanges?.progress ?? selectedTask.progress}%</span>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const currentProgress = pendingTaskChanges?.progress ?? selectedTask.progress
                              const newProgress = Math.max(0, currentProgress - 10)
                              setPendingTaskChanges(prev => ({
                                ...prev,
                                progress: newProgress
                              }))
                              setHasUnsavedChanges(true)
                            }}
                            disabled={selectedTask.progress <= 0}
                            className="w-10 h-10 p-0"
                          >
                            -10
                          </Button>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            min="0"
                            max="100"
                            value={tempProgress[selectedTask.id] !== undefined ? tempProgress[selectedTask.id] : selectedTask.progress}
                            onChange={(e) => {
                              const value = e.target.value
                              // 数字以外を除去
                              const numericValue = value.replace(/[^0-9]/g, '')
                              // 空文字の場合は0として扱う
                              const newProgress = numericValue === '' ? 0 : parseInt(numericValue, 10) || 0
                              const clampedProgress = Math.min(100, Math.max(0, newProgress))
                              setTempProgress(prev => ({ ...prev, [selectedTask.id]: clampedProgress }))
                              handleProgressUpdate(selectedTask.id, clampedProgress, false)
                            }}
                            onFocus={(e) => {
                              // フォーカス時に0の場合は選択状態にする
                              if (e.target.value === '0') {
                                e.target.select()
                              }
                            }}
                            onBlur={(e) => {
                              // フォーカスが外れたら保存
                              // 空の場合は元の値に戻す
                              const value = e.target.value
                              let finalProgress
                              if (value === '' || value === null || value === undefined) {
                                finalProgress = selectedTask.progress // 元の値に戻す
                              } else {
                                finalProgress = tempProgress[selectedTask.id] !== undefined ? tempProgress[selectedTask.id] : selectedTask.progress
                              }
                              handleProgressUpdate(selectedTask.id, finalProgress, true)
                              setTempProgress(prev => {
                                const newTemp = { ...prev }
                                delete newTemp[selectedTask.id]
                                return newTemp
                              })
                            }}
                            className="w-20 text-center px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            style={{
                              // 先頭のゼロを視覚的に隠す
                              MozAppearance: 'textfield',
                              WebkitAppearance: 'none',
                              appearance: 'none'
                            }}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const currentProgress = pendingTaskChanges?.progress ?? selectedTask.progress
                              const newProgress = Math.min(100, currentProgress + 10)
                              setPendingTaskChanges(prev => ({
                                ...prev,
                                progress: newProgress
                              }))
                              setHasUnsavedChanges(true)
                            }}
                            disabled={selectedTask.progress >= 100}
                            className="w-10 h-10 p-0"
                          >
                            +10
                          </Button>
                        </div>
                      </div>
                      <div className="w-full h-3 bg-gray-200 rounded-full">
                        <div
                          className="h-3 rounded-full transition-all duration-300"
                          style={{
                            width: `${pendingTaskChanges?.progress ?? selectedTask.progress}%`,
                            backgroundColor: selectedTask.color
                          }}
                        />
                      </div>
                      {/* タスク完了ボタン */}
                      <Button
                        variant="default"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setPendingTaskChanges(prev => ({
                            ...prev,
                            progress: 100,
                            status: 'completed'
                          }))
                          setHasUnsavedChanges(true)
                        }}
                        disabled={selectedTask.progress >= 100}
                        className="mt-3 w-full bg-green-600 hover:bg-green-700 text-white"
                      >
                        タスクを完全に完了する (100%)
                      </Button>
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
                {hasUnsavedChanges && (
                  <Button
                    variant="default"
                    onClick={async (e) => {
                      e.preventDefault()
                      if (selectedTask && pendingTaskChanges) {
                        // 全ての変更を一度に送信
                        const updates: any = {}

                        if (pendingTaskChanges.assigned_user_id !== undefined) {
                          updates.assigned_user_id = pendingTaskChanges.assigned_user_id
                        }
                        if (pendingTaskChanges.priority !== undefined) {
                          updates.priority = pendingTaskChanges.priority
                        }
                        if (pendingTaskChanges.progress !== undefined) {
                          updates.progress = pendingTaskChanges.progress
                        }
                        if (pendingTaskChanges.status !== undefined) {
                          updates.status = pendingTaskChanges.status
                        }

                        await handleUpdateTask(selectedTask.id, updates)

                        // 更新後、pendingTaskChangesをリセット
                        setPendingTaskChanges(null)
                        setHasUnsavedChanges(false)
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    編集を更新する
                  </Button>
                )}
                <Button variant="outline" onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setSelectedTask(null)
                  setPendingTaskChanges(null)
                  setHasUnsavedChanges(false)
                }}>
                  閉じる
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 新規タスク作成モーダル */}
      <Dialog open={showNewTaskModal} onOpenChange={setShowNewTaskModal}>
        <DialogContent className="max-w-[95vw] xl:max-w-[1000px] max-h-[95vh] p-0 bg-white overflow-hidden shadow-2xl border-0 rounded-xl">
          <DialogTitle className="sr-only">新規栽培スケジュール・タスク作成</DialogTitle>
          <NewTaskForm 
            vegetables={vegetables} 
            onSubmit={handleCreateTask}
            onCancel={() => setShowNewTaskModal(false)}
            isLoading={isCreatingTask}
          />
        </DialogContent>
      </Dialog>

      {/* 作業記録フォーム */}
      <WorkReportForm
        open={showWorkReportForm}
        onOpenChange={setShowWorkReportForm}
        onSuccess={handleWorkReportSuccess}
      />

      {/* 実績記録詳細表示モーダル（第1段階） */}
      <WorkReportViewModal
        workReport={selectedWorkReport}
        isOpen={isViewModalOpen}
        onClose={handleCloseModals}
        onEdit={handleEditWorkReport}
      />

      {/* 実績記録編集モーダル（第2段階） */}
      <WorkReportEditModalFull
        workReport={selectedWorkReport}
        isOpen={isEditModalOpen}
        onClose={handleCloseModals}
        onSave={handleUpdateWorkReport}
        onCancel={handleCloseModals}
      />

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteConfirmDialog.show} onOpenChange={(open) => {
        setDeleteConfirmDialog({ show: open, item: null, type: 'task' })
        if (!open) {
          // ダイアログが閉じられた時にフォーカスをリセット
          setTimeout(() => {
            if (document.activeElement instanceof HTMLElement) {
              document.activeElement.blur()
            }
            document.body.focus()
            // ページ全体のポインターイベントを確実に有効化
            document.body.style.pointerEvents = 'auto'
            document.documentElement.style.pointerEvents = 'auto'
          }, 100)
        }
      }}>
        <DialogContent className="max-w-lg bg-white border-0 shadow-2xl rounded-xl">
          <DialogHeader className="text-center pb-2">
            <DialogTitle className="flex items-center justify-center gap-3 text-lg font-semibold text-gray-800">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              プロフェッショナル削除確認
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 px-2">
            {/* 削除対象の表示 */}
            {deleteConfirmDialog.item && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-lg border border-amber-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {deleteConfirmDialog.type === 'task' ? '📋' : '📝'}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">
                      {deleteConfirmDialog.type === 'task' 
                        ? deleteConfirmDialog.item.name 
                        : getWorkTypeLabel(deleteConfirmDialog.item.work_type)
                      }
                    </p>
                    <p className="text-sm text-gray-600">
                      {deleteConfirmDialog.type === 'task' 
                        ? `${deleteConfirmDialog.item.vegetable?.name} - ${safeFormatDate(deleteConfirmDialog.item.start, 'yyyy/MM/dd')}〜${safeFormatDate(deleteConfirmDialog.item.end, 'yyyy/MM/dd')}`
                        : `${safeFormatDate(deleteConfirmDialog.item.work_date, 'yyyy年MM月dd日')} - ${deleteConfirmDialog.item.work_notes || '詳細なし'}`
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 削除前検証結果の表示 */}
            {deleteConfirmDialog.isValidating && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <p className="text-blue-800 font-medium">削除前検証中...</p>
                </div>
              </div>
            )}

            {/* 検証完了時の結果表示 */}
            {deleteConfirmDialog.validation && !deleteConfirmDialog.isValidating && (
              <div>
                {/* 警告がある場合 */}
                {deleteConfirmDialog.validation.warnings.length > 0 && (
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 mb-4">
                    <p className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
                      ⚠️ 確認事項
                    </p>
                    <ul className="text-yellow-700 space-y-1 text-sm">
                      {deleteConfirmDialog.validation.warnings.map((warning, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-yellow-500 font-bold">•</span>
                          {warning}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 関連情報の表示 */}
                {deleteConfirmDialog.validation.related_reports_count !== undefined && (
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-4">
                    <p className="text-sm text-gray-600">
                      関連作業レポート: <span className="font-bold">{deleteConfirmDialog.validation.related_reports_count}件</span>
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 削除理由入力 */}
            {deleteConfirmDialog.type === 'task' && !deleteConfirmDialog.isValidating && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">削除理由（オプション）</Label>
                <Input
                  id="deletion-reason"
                  placeholder="例：不要になったため、重複作成、計画変更等"
                  className="w-full"
                  maxLength={100}
                />
              </div>
            )}

            {/* プロフェッショナル削除情報 */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                🔐 プロフェッショナル削除システム
              </p>
              <ul className="text-blue-700 space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold">✓</span>
                  削除前の関連データ自動検証
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold">✓</span>
                  楽観的更新による即座のUI反映
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold">✓</span>
                  エラー時の自動ロールバック機能
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold">✓</span>
                  削除操作の完全な監査ログ記録
                </li>
              </ul>
            </div>
          </div>

          {/* アクションボタン */}
          <div className="flex gap-3 justify-center pt-4">
            <Button 
              variant="outline" 
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setDeleteConfirmDialog({ 
                  show: false, 
                  item: null, 
                  type: 'task',
                  validation: null,
                  isValidating: false
                })
              }}
              className="min-w-[100px] border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              キャンセル
            </Button>
            <Button 
              variant="destructive" 
              disabled={deleteConfirmDialog.isValidating || (deleteConfirmDialog.validation && !deleteConfirmDialog.validation.can_delete)}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                
                // 削除理由を取得
                const reasonInput = document.getElementById('deletion-reason') as HTMLInputElement
                const reason = reasonInput?.value || '理由未指定'
                
                handleConfirmDelete(reason)
              }}
              className="min-w-[100px] bg-red-600 hover:bg-red-700 text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {deleteConfirmDialog.isValidating ? '検証中...' : 'プロフェッショナル削除'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 農地編集ビュー */}
      {showMapView && (
        <div className="fixed inset-0 z-50 bg-white">
          <FarmMapView onClose={() => setShowMapView(false)} />
        </div>
      )}
    </div>
  )
}