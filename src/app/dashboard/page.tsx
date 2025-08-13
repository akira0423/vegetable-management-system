'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/utils'
import WorkReportForm from '@/components/work-report-form'
import FarmMapView from '@/components/farm-map-view'
import { 
  Sprout, 
  TrendingUp, 
  Calendar,
  Camera,
  Users,
  BarChart3,
  Clock,
  CheckCircle,
  MapPin,
  Beaker,
  Droplets,
  RefreshCw,
  Plus,
  Map
} from 'lucide-react'
import Link from 'next/link'

interface DashboardStats {
  totalVegetables: number
  activeTasks: number
  upcomingDeadlines: number
  completedTasks: number
  totalPhotos: number
  recentActivity: Array<{
    id: string
    type: string
    action: string
    timestamp: string
  }>
}

interface UpcomingTask {
  id: string
  name: string
  vegetable_id: string
  start_date: string
  vegetable?: {
    id: string
    name: string
  }
  assigned_user?: {
    full_name: string
  }
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalVegetables: 0,
    activeTasks: 0,
    upcomingDeadlines: 0,
    completedTasks: 0,
    totalPhotos: 0,
    recentActivity: []
  })
  const [upcomingTasks, setUpcomingTasks] = useState<UpcomingTask[]>([])
  const [loading, setLoading] = useState(true)
  const [showWorkReportForm, setShowWorkReportForm] = useState(false)
  const [showMapView, setShowMapView] = useState(false)
  const [user, setUser] = useState({ full_name: 'システム管理者', company_id: 'a1111111-1111-1111-1111-111111111111' })

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      // サンプルデータで代替（実際のAPIが利用可能になるまで）
      setStats({
        totalVegetables: 4,
        activeTasks: 8,
        upcomingDeadlines: 3,
        completedTasks: 15,
        totalPhotos: 23,
        recentActivity: [
          {
            id: '1',
            type: 'harvesting',
            action: 'A棟トマトの収穫作業完了',
            timestamp: new Date().toISOString()
          },
          {
            id: '2',
            type: 'fertilizing',
            action: 'B棟キュウリの追肥作業',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
          },
          {
            id: '3',
            type: 'watering',
            action: '露地レタスの灌水作業',
            timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
          }
        ]
      })

      setUpcomingTasks([
        {
          id: '1',
          name: 'トマト収穫',
          vegetable_id: 'v1',
          start_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          vegetable: { id: 'v1', name: 'A棟トマト（桃太郎）' },
          assigned_user: { full_name: '田中太郎' }
        },
        {
          id: '2',
          name: 'キュウリ整枝',
          vegetable_id: 'v2',
          start_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          vegetable: { id: 'v2', name: 'B棟キュウリ（四葉）' },
          assigned_user: { full_name: '佐藤花子' }
        }
      ])
    } catch (error) {
      console.error('ダッシュボードデータ取得エラー:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleWorkReportSuccess = () => {
    // 作業記録成功時にダッシュボードデータを再取得
    fetchDashboardData()
  }

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            おかえりなさい、{user.full_name || 'さん'}
          </h1>
          <p className="text-gray-600">
            今日も効率的な栽培管理を始めましょう
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline"
            className="bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 hover:border-emerald-700"
            onClick={() => setShowMapView(true)}
          >
            <Map className="w-4 h-4 mr-2" />
            地図上で栽培野菜計画を追加
          </Button>
          <Button 
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => setShowWorkReportForm(true)}
          >
            <Calendar className="w-4 h-4 mr-2" />
            作業報告を記録
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">管理中野菜</CardTitle>
            <Sprout className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalVegetables}</div>
            <p className="text-xs text-muted-foreground">
              種類の野菜を栽培中
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">進行中タスク</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeTasks}</div>
            <p className="text-xs text-muted-foreground">
              {stats.upcomingDeadlines}件が今週期限
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">完了済みタスク</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedTasks}</div>
            <p className="text-xs text-muted-foreground">
              累計完了タスク数
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">記録写真数</CardTitle>
            <Camera className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPhotos}</div>
            <p className="text-xs text-muted-foreground">
              作業記録写真
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick actions */}
        <Card>
          <CardHeader>
            <CardTitle>クイックアクション</CardTitle>
            <CardDescription>
              よく使用する機能へのショートカット
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/dashboard/photos">
              <Button variant="outline" className="w-full justify-start" size="sm">
                <Camera className="mr-2 h-4 w-4" />
                写真をアップロード
              </Button>
            </Link>
            <Link href="/dashboard/gantt">
              <Button variant="outline" className="w-full justify-start" size="sm">
                <BarChart3 className="mr-2 h-4 w-4" />
                栽培野菜管理を表示
              </Button>
            </Link>
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              size="sm"
              onClick={() => setShowMapView(true)}
            >
              <Map className="mr-2 h-4 w-4" />
              地図上で栽培野菜計画を追加・メッシュ管理
            </Button>
          </CardContent>
        </Card>

        {/* Recent activities */}
        <Card>
          <CardHeader>
            <CardTitle>最近のアクティビティ</CardTitle>
            <CardDescription>
              直近の作業記録と更新
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recentActivity.length > 0 ? (
                stats.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      {activity.type === 'seeding' && (
                        <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                          <Sprout className="h-4 w-4 text-green-600" />
                        </div>
                      )}
                      {activity.type === 'planting' && (
                        <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <MapPin className="h-4 w-4 text-blue-600" />
                        </div>
                      )}
                      {activity.type === 'fertilizing' && (
                        <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                          <Beaker className="h-4 w-4 text-purple-600" />
                        </div>
                      )}
                      {activity.type === 'watering' && (
                        <div className="h-8 w-8 bg-cyan-100 rounded-full flex items-center justify-center">
                          <Droplets className="h-4 w-4 text-cyan-600" />
                        </div>
                      )}
                      {activity.type === 'weeding' && (
                        <div className="h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center">
                          <Sprout className="h-4 w-4 text-yellow-600" />
                        </div>
                      )}
                      {activity.type === 'pruning' && (
                        <div className="h-8 w-8 bg-orange-100 rounded-full flex items-center justify-center">
                          <Sprout className="h-4 w-4 text-orange-600" />
                        </div>
                      )}
                      {activity.type === 'harvesting' && (
                        <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center">
                          <TrendingUp className="h-4 w-4 text-red-600" />
                        </div>
                      )}
                      {!['seeding', 'planting', 'fertilizing', 'watering', 'weeding', 'pruning', 'harvesting'].includes(activity.type) && (
                        <div className="h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center">
                          <CheckCircle className="h-4 w-4 text-gray-600" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {activity.action}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatDateTime(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  まだ作業記録がありません
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming deadlines */}
      <Card>
        <CardHeader>
          <CardTitle>今後の予定</CardTitle>
          <CardDescription>
            期限が近づいているタスクと重要な作業
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {upcomingTasks.length > 0 ? (
              upcomingTasks.slice(0, 5).map((task) => (
                <div key={task.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex items-center space-x-3">
                    <Clock className="h-4 w-4 text-yellow-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {task.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {task.vegetable?.name} - {formatDateTime(task.start_date)}
                        {task.assigned_user?.full_name && ` (担当: ${task.assigned_user.full_name})`}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" disabled>
                    詳細
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                近日中に予定されているタスクはありません
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 作業記録フォーム */}
      <WorkReportForm
        open={showWorkReportForm}
        onOpenChange={setShowWorkReportForm}
        onSuccess={handleWorkReportSuccess}
      />

      {/* 農地編集ビュー */}
      {showMapView && (
        <div className="fixed inset-0 z-50 bg-white">
          <FarmMapView onClose={() => setShowMapView(false)} />
        </div>
      )}
    </div>
  )
}