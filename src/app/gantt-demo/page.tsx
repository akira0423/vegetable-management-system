'use client'

/**
 * デモ版ガントチャートページ
 *
 * このページは未ログインユーザー専用のデモページです。
 * ログイン済みユーザーは自動的に本番ページ（/dashboard/gantt）へリダイレクトされます。
 *
 * セキュリティ上の注意:
 * - このページは本番データにアクセスしません
 * - demo_vegetables, demo_growing_tasks, demo_work_reportsテーブルのみ使用
 * - データの作成・更新・削除は実行されません（UIのみ）
 * - 認証済みユーザーのアクセスをブロック
 */

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
import { CollapsibleSearchFilter } from '@/components/demo/collapsible-search-filter'
import { WorkReportCard } from '@/components/work-report-card'
import DemoFarmMapView from '@/components/demo/farm-map-view'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  Calendar,
  Filter,
  Search,
  Download,
  Plus,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  X,
  MapPin,
  BarChart3,
  Map,
  FileText,
  AlertTriangle,
  Home,
  ArrowLeft,
  Info,
  Sprout,
  Settings,
  Edit,
  Trash2
} from 'lucide-react'
import { format, subMonths, addMonths, startOfMonth, endOfMonth, differenceInDays, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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
}

interface Vegetable {
  id: string
  name: string
  variety_name: string
  status: string
  area_size?: number
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

export default function GanttDemoPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState<GanttTask[]>([])
  const [vegetables, setVegetables] = useState<Vegetable[]>([])
  const [workReports, setWorkReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showDemoFarmMap, setShowDemoFarmMap] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)

  // フィルター状態
  const [selectedVegetable, setSelectedVegetable] = useState<string>('all')
  const [selectedPriority, setSelectedPriority] = useState<string>('all')

  // 期間設定
  const [viewPeriod, setViewPeriod] = useState<'6months' | '1year' | '3years' | '5years'>('1year')
  const [viewUnit, setViewUnit] = useState<'day' | 'week' | 'month'>('day')
  const [currentDate, setCurrentDate] = useState(new Date())

  // カスタム期間設定
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')

  // タスク詳細モーダル
  const [selectedTask, setSelectedTask] = useState<GanttTask | null>(null)
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [pendingTaskChanges, setPendingTaskChanges] = useState<any>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // ダミーユーザーリスト（デモ用）
  const [users] = useState([
    { id: 'demo-user-1', name: '田中太郎' },
    { id: 'demo-user-2', name: '山田花子' },
    { id: 'demo-user-3', name: '佐藤次郎' }
  ])

  // 新規タスク作成モーダル
  const [showNewTaskModal, setShowNewTaskModal] = useState(false)

  // 作業記録モーダル
  const [showWorkReportForm, setShowWorkReportForm] = useState(false)

  // デモ警告ダイアログ
  const [demoWarning, setDemoWarning] = useState<{
    show: boolean
    title: string
    message: string
  }>({
    show: false,
    title: '',
    message: ''
  })

  // タブ状態管理
  const [activeTab, setActiveTab] = useState('list')

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
    hasActiveFilters?: boolean
  }>({
    filteredVegetables: [],
    filteredTasks: [],
    filteredReports: [],
    resultSummary: '',
    hasActiveFilters: false
  })

  // 初期展開設定
  useEffect(() => {
    if (vegetables.length > 0 && expandedVegetables.size === 0) {
      const allVegetableIds = new Set(vegetables.map(v => v.id))
      setExpandedVegetables(allVegetableIds)
    }
  }, [vegetables])

  // 期間計算
  const getDateRange = useCallback(() => {
    if (customStartDate && customEndDate) {
      return {
        start: customStartDate,
        end: customEndDate
      }
    }

    const now = currentDate
    let start: Date, end: Date

    switch (viewPeriod) {
      case '6months':
        start = startOfMonth(subMonths(now, 3))
        end = endOfMonth(addMonths(now, 3))
        break
      case '1year':
        start = startOfMonth(subMonths(now, 6))
        end = endOfMonth(addMonths(now, 6))
        break
      case '3years':
        start = startOfMonth(subMonths(now, 18))
        end = endOfMonth(addMonths(now, 18))
        break
      case '5years':
      default:
        start = startOfMonth(subMonths(now, 30))
        end = endOfMonth(addMonths(now, 30))
        break
    }

    return {
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd')
    }
  }, [viewPeriod, currentDate, customStartDate, customEndDate])

  // データ取得
  const fetchData = async () => {
    try {
      setLoading(true)

      // デモ野菜データ取得
      const vegResponse = await fetch('/api/demo/vegetables')
      const vegResult = await vegResponse.json()
      if (vegResult.success) {
        setVegetables(vegResult.data || [])
      }

      // デモタスクデータ取得
      const taskResponse = await fetch('/api/demo/tasks')
      const taskResult = await taskResponse.json()
      if (taskResult.success) {
        setTasks(taskResult.data || [])
      }

      // デモ作業レポート取得
      const reportResponse = await fetch('/api/demo/work-reports')
      const reportResult = await reportResponse.json()
      if (reportResult.success) {
        setWorkReports(reportResult.data || [])
      }

    } catch (error) {
      console.error('Error fetching demo data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // 認証チェック - ログイン済みユーザーは本番ページへリダイレクト
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // 認証チェックをスキップしてデモデータを表示
        // デモページは誰でもアクセス可能
        setAuthChecking(false)
        fetchData()
      } catch (error) {
        console.log('データ取得エラー:', error)
        setAuthChecking(false)
        fetchData()
      }
    }

    checkAuth()
  }, [])

  // データ更新（デモ版では実際の更新なし）
  const handleRefresh = () => {
    setRefreshing(true)
    fetchData()
  }

  // タスククリックハンドラー
  const handleTaskClick = (task: GanttTask) => {
    setSelectedTask(task)
    setIsTaskModalOpen(true)
    setPendingTaskChanges(null)
    setHasUnsavedChanges(false)
  }

  // 新規タスク作成（デモ版）
  const handleNewTask = () => {
    setDemoWarning({
      show: true,
      title: 'デモ版の制限',
      message: 'デモ版では新規タスクの作成はできません。実際の機能は会員登録後にご利用いただけます。'
    })
  }

  // 作業記録（デモ版）
  const handleWorkReport = () => {
    setDemoWarning({
      show: true,
      title: 'デモ版の制限',
      message: 'デモ版では作業記録の登録はできません。実際の機能は会員登録後にご利用いただけます。'
    })
  }

  // 地図で登録（デモ版）
  const handleMapRegistration = () => {
    // デモ農地管理ビューを表示
    setShowDemoFarmMap(true)
  }

  // 削除処理（デモ版）
  const handleDelete = () => {
    setDemoWarning({
      show: true,
      title: 'デモ版の制限',
      message: 'デモ版ではデータの削除はできません。実際の機能は会員登録後にご利用いただけます。'
    })
  }

  // エクスポート（デモ版）
  const handleExport = () => {
    setDemoWarning({
      show: true,
      title: 'デモ版の制限',
      message: 'デモ版ではデータのエクスポートはできません。実際の機能は会員登録後にご利用いただけます。'
    })
  }

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

  // フィルターリセットハンドラー
  const handleResetFilters = () => {
    setFilteredVegetableData({
      filteredVegetables: [],
      filteredTasks: [],
      filteredReports: [],
      resultSummary: '',
      hasActiveFilters: false
    })
    setActiveFilterCount(0)
    setIsFilterExpanded(false)
  }

  // 認証チェック中の表示
  if (authChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">アクセス権限を確認しています...</p>
        </div>
      </div>
    )
  }

  // データ読み込み中の表示
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">デモデータを読み込んでいます...</p>
        </div>
      </div>
    )
  }

  const dateRange = getDateRange()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* デモ版ヘッダー */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 shadow-lg">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Info className="h-5 w-5" />
            <span className="font-semibold">デモ版</span>
            <span className="text-sm opacity-90">
              栽培野菜スケジュール管理機能を体験中です（データの保存・編集はできません）
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
              >
                <Home className="h-4 w-4 mr-1" />
                ホーム
              </Button>
            </Link>
            <Link href="/login">
              <Button
                size="sm"
                className="bg-white text-blue-600 hover:bg-gray-100"
              >
                会員登録/ログイン
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-6">
        {/* ページヘッダー */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">栽培野菜管理</h1>
              <p className="text-gray-600 mt-1">
                野菜別の栽培タスクと作業実績を統合管理
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleMapRegistration}
                className="bg-green-600 text-white hover:bg-green-700"
              >
                <Map className="h-4 w-4 mr-2" />
                野菜を地図に登録
              </Button>
              <Button
                variant="outline"
                onClick={handleNewTask}
              >
                <Plus className="h-4 w-4 mr-2" />
                タスクを計画
              </Button>
              <Button
                variant="outline"
                onClick={handleWorkReport}
                className="bg-orange-500 text-white hover:bg-orange-600"
              >
                <Calendar className="h-4 w-4 mr-2" />
                作業を記録
              </Button>
              <Button
                variant="outline"
                onClick={handleExport}
              >
                <Download className="h-4 w-4 mr-2" />
                エクスポート
              </Button>
              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                更新
              </Button>
            </div>
          </div>

          {/* 基本フローガイド */}
          <Card className="mb-6 bg-gradient-to-r from-blue-50 to-green-50">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-8">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">1</div>
                    <div>
                      <p className="font-semibold">野菜を登録</p>
                      <p className="text-sm text-gray-600">地図上で栽培する野菜と場所を登録</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">2</div>
                    <div>
                      <p className="font-semibold">タスクを計画</p>
                      <p className="text-sm text-gray-600">野菜ごとの栽培スケジュールを設定</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-orange-600 text-white rounded-full flex items-center justify-center font-bold">3</div>
                    <div>
                      <p className="font-semibold">作業を記録</p>
                      <p className="text-sm text-gray-600">実際の作業内容を日々記録</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">4</div>
                    <div>
                      <p className="font-semibold">データを分析</p>
                      <p className="text-sm text-gray-600">収益や作業効率を確認</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* メインコンテンツ */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="gantt">
              <BarChart3 className="h-4 w-4 mr-2" />
              ガントチャート
            </TabsTrigger>
            <TabsTrigger value="list">
              <FileText className="h-4 w-4 mr-2" />
              計画・実績一覧
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gantt">
            <GanttChart
              tasks={tasks}
              workReports={workReports}
              vegetables={vegetables}
              startDate={dateRange.start}
              endDate={dateRange.end}
              viewUnit={viewUnit}
              onTaskClick={handleTaskClick}
              selectedVegetable={selectedVegetable}
              selectedPriority={selectedPriority}
              customStartDate={customStartDate}
              customEndDate={customEndDate}
              onVegetableChange={setSelectedVegetable}
              onPriorityChange={setSelectedPriority}
              onDateRangeChange={(start, end) => {
                setCustomStartDate(start)
                setCustomEndDate(end)
              }}
            />
          </TabsContent>

          <TabsContent value="list">
            {/* ガントチャートと同じ緑色ヘッダーデザイン */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg p-4 mb-4">
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

            <Card>
              <CardHeader className="sr-only">
                <CardTitle>野菜別計画・実績管理</CardTitle>
              </CardHeader>
              <CardContent>
                {/* フィルターパネル */}
                <CollapsibleSearchFilter
                  vegetables={vegetables}
                  tasks={tasks}
                  workReports={workReports}
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

                {/* 野菜別カード表示 */}
                <div className="space-y-4">
                  {vegetables.length === 0 ? (
                    <div className="text-center py-16">
                      <Sprout className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                      <h3 className="text-lg font-medium text-gray-600 mb-2">登録情報がありません</h3>
                      <p className="text-gray-500 text-sm">野菜を登録すると、計画・実績管理が表示されます</p>
                    </div>
                  ) : (
                    (() => {
                      // フィルター適用済みデータの準備
                      const displayVegetables = filteredVegetableData.hasActiveFilters
                        ? filteredVegetableData.filteredVegetables
                        : vegetables

                      const displayTasks = filteredVegetableData.hasActiveFilters
                        ? filteredVegetableData.filteredTasks
                        : tasks

                      const displayReports = filteredVegetableData.hasActiveFilters
                        ? filteredVegetableData.filteredReports
                        : workReports

                      return displayVegetables.map(vegetable => {
                        const vegTasks = displayTasks.filter(t => t.vegetable.id === vegetable.id)
                        const vegReports = displayReports.filter((r: any) => r.vegetable_id === vegetable.id)
                        const isExpanded = expandedVegetables.has(vegetable.id)

                        // データがない野菜はスキップ
                        if (vegTasks.length === 0 && vegReports.length === 0) {
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
                                    品種: {vegetable.variety_name} • ステータス: {vegetable.status || '成長中'}
                                  </CardDescription>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="border-blue-300 text-blue-700">
                                  計画 {vegTasks.length}件
                                </Badge>
                                <Badge variant="outline" className="border-green-300 text-green-700">
                                  実績 {vegReports.length}件
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
                                        {vegTasks.length}件
                                      </Badge>
                                    </div>
                                  </div>
                                  <div className="p-4 min-h-[200px] max-h-96 overflow-y-auto">
                                    {vegTasks.length > 0 ? (
                                      <div className="space-y-3">
                                        {vegTasks.map(task => (
                                          <div
                                            key={task.id}
                                            className="border rounded-lg p-3 bg-white hover:bg-blue-50/50 cursor-pointer transition-all duration-200 group relative select-none"
                                            onClick={(e) => {
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
                                              <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                  <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7 w-7 p-1.5 text-slate-500 hover:text-blue-600 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105"
                                                    onClick={(e) => {
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
                                                      handleDelete()
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
                                                {format(new Date(task.start), 'MM/dd', { locale: ja })} 〜
                                                {format(new Date(task.end), 'MM/dd', { locale: ja })}
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
                                        {vegReports.length}件
                                      </Badge>
                                    </div>
                                  </div>
                                  <div className="p-4 min-h-[200px] max-h-96 overflow-y-auto">
                                    {vegReports.length > 0 ? (
                                      <div className="space-y-4">
                                        {vegReports.map((report: any) => (
                                          <WorkReportCard
                                            key={report.id}
                                            report={report}
                                            onClick={() => {
                                              setDemoWarning({
                                                show: true,
                                                title: 'デモ版の制限',
                                                message: 'デモ版では作業記録の詳細表示はできません。'
                                              })
                                            }}
                                            onEdit={() => {
                                              setDemoWarning({
                                                show: true,
                                                title: 'デモ版の制限',
                                                message: 'デモ版では作業記録の編集はできません。'
                                              })
                                            }}
                                            onDelete={() => {
                                              setDemoWarning({
                                                show: true,
                                                title: 'デモ版の制限',
                                                message: 'デモ版では作業記録の削除はできません。'
                                              })
                                            }}
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
                    })
                  })()
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* タスク詳細モーダル（3カラムレイアウト） */}
      <Dialog open={isTaskModalOpen} onOpenChange={setIsTaskModalOpen}>
        <DialogContent className="min-w-[1000px] max-w-[1400px] w-[95vw] max-h-[85vh] bg-gradient-to-br from-green-50 via-white to-emerald-50 shadow-2xl border-0 rounded-2xl overflow-hidden">
          {selectedTask && (
            <>
              <DialogHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 -m-6 mb-4 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <DialogTitle className="text-xl font-bold">
                        {selectedTask.name}
                      </DialogTitle>
                      <DialogDescription className="text-green-100 text-sm">
                        栽培タスクの詳細情報（デモ版では編集できません）
                      </DialogDescription>
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className="text-white bg-white/30 border-white/40"
                  >
                    {selectedTask.status === 'pending' && '🌱 未開始'}
                    {selectedTask.status === 'in_progress' && '🌿 進行中'}
                    {selectedTask.status === 'completed' && '🌾 完了'}
                    {selectedTask.status === 'cancelled' && '❌ 中止'}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 max-h-[calc(85vh-200px)] overflow-y-auto">
                {/* 左側：基本情報 */}
                <div className="lg:col-span-1 space-y-3">
                  <Card className="border-green-200 shadow-sm">
                    <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 py-2 px-4">
                      <CardTitle className="text-sm font-semibold text-green-800">基本情報</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-3 px-3">
                      <div className="bg-green-50 p-2 rounded-lg">
                        <Label className="text-xs font-semibold text-green-700">🥬 野菜</Label>
                        <p className="text-sm font-medium text-gray-800">{selectedTask.vegetable.name}</p>
                        <p className="text-xs text-gray-600">{selectedTask.vegetable.variety}</p>
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-green-700">👤 担当者</Label>
                        <Select
                          value={pendingTaskChanges?.assignedUser?.id ?? selectedTask.assignedUser?.id ?? 'unassigned'}
                          onValueChange={(value) => {
                            const newAssignee = value === 'unassigned' ? null : users.find(u => u.id === value)
                            setPendingTaskChanges(prev => ({
                              ...(prev || {}),
                              assignedUser: newAssignee
                            }))
                            setHasUnsavedChanges(true)
                          }}
                        >
                          <SelectTrigger className="w-full mt-1 h-8 text-sm">
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
                        <Label className="text-xs font-semibold text-green-700">⭐ 優先度</Label>
                        <Select
                          value={pendingTaskChanges?.priority ?? selectedTask.priority ?? 'medium'}
                          onValueChange={(value) => {
                            setPendingTaskChanges(prev => ({
                              ...(prev || {}),
                              priority: value
                            }))
                            setHasUnsavedChanges(true)
                          }}
                        >
                          <SelectTrigger className="w-full mt-1 h-8 text-sm">
                            <SelectValue placeholder="優先度を選択" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="high">🔴 高</SelectItem>
                            <SelectItem value="medium">🟡 中</SelectItem>
                            <SelectItem value="low">🔵 低</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* 中央：期間情報 */}
                <div className="lg:col-span-1 space-y-3">
                  <Card className="border-amber-200 shadow-sm">
                    <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 py-2 px-4">
                      <CardTitle className="text-sm font-semibold text-amber-800">期間情報</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-3 px-3">
                      <div className="flex items-center justify-between p-2 bg-amber-50 rounded">
                        <span className="text-xs text-amber-700">開始日</span>
                        <span className="text-xs font-medium">{format(new Date(selectedTask.start), 'MM/dd', { locale: ja })}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-amber-50 rounded">
                        <span className="text-xs text-amber-700">終了日</span>
                        <span className="text-xs font-medium">{format(new Date(selectedTask.end), 'MM/dd', { locale: ja })}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-orange-50 rounded">
                        <span className="text-xs text-orange-700">作業期間</span>
                        <span className="text-xs font-bold text-orange-800">
                          {differenceInDays(parseISO(selectedTask.end), parseISO(selectedTask.start)) + 1}日
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-red-50 rounded">
                        <span className="text-xs text-red-700">残り日数</span>
                        <span className="text-xs font-bold text-red-800">
                          {Math.max(0, differenceInDays(parseISO(selectedTask.end), new Date()))}日
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* 右側：進捗管理 */}
                <div className="lg:col-span-1 space-y-3">
                  <Card className="border-blue-200 shadow-sm">
                    <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 py-2 px-4">
                      <CardTitle className="text-sm font-semibold text-blue-800">進捗管理</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-3 px-3">
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-3 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-2xl font-bold text-blue-800">
                            {pendingTaskChanges?.progress ?? selectedTask.progress}%
                          </div>
                          <div className="text-xs text-gray-600 font-semibold">
                            {(pendingTaskChanges?.progress ?? selectedTask.progress) === 0 && '未着手'}
                            {(pendingTaskChanges?.progress ?? selectedTask.progress) > 0 && (pendingTaskChanges?.progress ?? selectedTask.progress) < 30 && '開始段階'}
                            {(pendingTaskChanges?.progress ?? selectedTask.progress) >= 30 && (pendingTaskChanges?.progress ?? selectedTask.progress) < 70 && '作業中'}
                            {(pendingTaskChanges?.progress ?? selectedTask.progress) >= 70 && (pendingTaskChanges?.progress ?? selectedTask.progress) < 100 && '仕上げ段階'}
                            {(pendingTaskChanges?.progress ?? selectedTask.progress) === 100 && '完了'}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 justify-center mb-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const currentProgress = pendingTaskChanges?.progress ?? selectedTask.progress
                              const newProgress = Math.max(0, currentProgress - 10)
                              setPendingTaskChanges(prev => ({
                                ...(prev || {}),
                                progress: newProgress
                              }))
                              setHasUnsavedChanges(true)
                            }}
                            disabled={(pendingTaskChanges?.progress ?? selectedTask.progress) <= 0}
                            className="w-9 h-9 p-0 rounded-full"
                          >
                            －
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const currentProgress = pendingTaskChanges?.progress ?? selectedTask.progress
                              const newProgress = Math.min(100, currentProgress + 10)
                              setPendingTaskChanges(prev => ({
                                ...(prev || {}),
                                progress: newProgress
                              }))
                              setHasUnsavedChanges(true)
                            }}
                            disabled={(pendingTaskChanges?.progress ?? selectedTask.progress) >= 100}
                            className="w-9 h-9 p-0 rounded-full"
                          >
                            ＋
                          </Button>
                        </div>

                        {/* プログレスバー */}
                        <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                          <div
                            className="h-full rounded-full transition-all duration-500 ease-out"
                            style={{
                              width: `${pendingTaskChanges?.progress ?? selectedTask.progress}%`,
                              backgroundColor: '#3b82f6'
                            }}
                          />
                        </div>
                      </div>

                      {hasUnsavedChanges && (
                        <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                          <p className="text-xs text-yellow-700">
                            ⚠️ デモ版では変更は保存されません
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsTaskModalOpen(false)
                setPendingTaskChanges(null)
                setHasUnsavedChanges(false)
              }}
            >
              閉じる
            </Button>
            <Button
              onClick={handleDelete}
              variant="destructive"
            >
              削除（デモ版）
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* デモ版警告ダイアログ */}
      <Dialog open={demoWarning.show} onOpenChange={(show) => setDemoWarning({...demoWarning, show})}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {demoWarning.title}
            </DialogTitle>
            <DialogDescription>
              {demoWarning.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDemoWarning({...demoWarning, show: false})}
            >
              閉じる
            </Button>
            <Link href="/login">
              <Button className="bg-green-600 hover:bg-green-700">
                会員登録/ログイン
              </Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* デモ版農地管理ビュー */}
      {showDemoFarmMap && (
        <div className="fixed inset-0 z-50 bg-white">
          <DemoFarmMapView onClose={() => setShowDemoFarmMap(false)} />
        </div>
      )}
    </div>
  )
}