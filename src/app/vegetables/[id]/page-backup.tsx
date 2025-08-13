'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CalendarDays, MapPin, Sprout, Thermometer, Droplets, Sun, ArrowLeft, Plus, Camera } from 'lucide-react'
import Link from 'next/link'
import PhotoUpload from '@/components/photo-upload'
import PhotoGallery from '@/components/photo-gallery'

interface VegetableDetail {
  id: string
  name: string
  variety_name: string
  plot_name: string
  area_size: number
  plant_count: number
  planting_date: string
  expected_harvest_start: string
  expected_harvest_end: string
  actual_harvest_start?: string
  actual_harvest_end?: string
  status: string
  notes?: string
  variety: {
    name: string
    variety: string
    category: string
    optimal_temperature_min: number
    optimal_temperature_max: number
    water_requirement: string
    sunlight_requirement: string
    soil_ph_min: number
    soil_ph_max: number
    standard_growth_days: number
  }
}

interface GrowingTask {
  id: string
  name: string
  description: string
  task_type: string
  priority: string
  status: string
  start_date: string
  end_date: string
  progress: number
  estimated_hours?: number
  actual_hours?: number
}

interface OperationLog {
  id: string
  date: string
  work_type: string
  work_notes: string
  weather?: string
  temperature_morning?: number
  temperature_afternoon?: number
  work_hours?: number
  worker_count?: number
}

const statusConfig = {
  planning: { label: '計画中', color: 'bg-gray-100 text-gray-800' },
  growing: { label: '栽培中', color: 'bg-green-100 text-green-800' },
  harvesting: { label: '収穫中', color: 'bg-orange-100 text-orange-800' },
  completed: { label: '完了', color: 'bg-blue-100 text-blue-800' },
  cancelled: { label: '中止', color: 'bg-red-100 text-red-800' }
}

const priorityConfig = {
  high: { label: '高', color: 'bg-red-100 text-red-800' },
  medium: { label: '中', color: 'bg-yellow-100 text-yellow-800' },
  low: { label: '低', color: 'bg-green-100 text-green-800' }
}

const taskStatusConfig = {
  pending: { label: '未着手', color: 'bg-gray-100 text-gray-800' },
  in_progress: { label: '進行中', color: 'bg-blue-100 text-blue-800' },
  completed: { label: '完了', color: 'bg-green-100 text-green-800' },
  cancelled: { label: '中止', color: 'bg-red-100 text-red-800' },
  overdue: { label: '遅延', color: 'bg-red-100 text-red-800' }
}

export default function VegetableDetailPage() {
  const params = useParams()
  const vegetableId = params.id as string
  
  const [vegetable, setVegetable] = useState<VegetableDetail | null>(null)
  const [tasks, setTasks] = useState<GrowingTask[]>([])
  const [logs, setLogs] = useState<OperationLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (vegetableId) {
      fetchVegetableDetail()
      fetchTasks()
      fetchLogs()
    }
  }, [vegetableId])

  async function fetchVegetableDetail() {
    // テストデータのマッピング
    const testVegetables: Record<string, any> = {
      'd1111111-1111-1111-1111-111111111111': {
        id: 'd1111111-1111-1111-1111-111111111111',
        name: 'A棟トマト（桃太郎）',
        variety_name: '桃太郎',
        plot_name: 'A棟温室',
        area_size: 100.0,
        plant_count: 50,
        planting_date: '2024-03-01',
        expected_harvest_start: '2024-06-10',
        expected_harvest_end: '2024-08-31',
        status: 'growing',
        notes: 'テスト用サンプルデータ - トマトの栽培',
        variety: {
          name: 'トマト',
          variety: '桃太郎',
          category: '果菜類',
          optimal_temperature_min: 18,
          optimal_temperature_max: 28,
          water_requirement: '多',
          sunlight_requirement: '全日照',
          soil_ph_min: 6.0,
          soil_ph_max: 6.8,
          standard_growth_days: 120
        }
      },
      'd2222222-2222-2222-2222-222222222222': {
        id: 'd2222222-2222-2222-2222-222222222222',
        name: 'B棟キュウリ（四葉）',
        variety_name: '四葉',
        plot_name: 'B棟温室',
        area_size: 80.0,
        plant_count: 40,
        planting_date: '2024-03-15',
        expected_harvest_start: '2024-05-20',
        expected_harvest_end: '2024-07-15',
        status: 'growing',
        notes: 'テスト用サンプルデータ - キュウリの栽培',
        variety: {
          name: 'キュウリ',
          variety: '四葉',
          category: '果菜類',
          optimal_temperature_min: 15,
          optimal_temperature_max: 25,
          water_requirement: '多',
          sunlight_requirement: '全日照',
          soil_ph_min: 6.0,
          soil_ph_max: 6.5,
          standard_growth_days: 90
        }
      },
      'd3333333-3333-3333-3333-333333333333': {
        id: 'd3333333-3333-3333-3333-333333333333',
        name: '露地レタス（春作）',
        variety_name: 'グリーンリーフ',
        plot_name: '露地第1圃場',
        area_size: 200.0,
        plant_count: 200,
        planting_date: '2024-03-20',
        expected_harvest_start: '2024-05-10',
        expected_harvest_end: '2024-05-25',
        status: 'planning',
        notes: 'テスト用サンプルデータ - レタスの栽培',
        variety: {
          name: 'レタス',
          variety: 'グリーンリーフ',
          category: '葉菜類',
          optimal_temperature_min: 15,
          optimal_temperature_max: 20,
          water_requirement: '中',
          sunlight_requirement: '半日照',
          soil_ph_min: 6.0,
          soil_ph_max: 6.5,
          standard_growth_days: 60
        }
      }
    }

    try {
      const { data, error } = await supabase
        .from('vegetables')
        .select(`
          *,
          variety:vegetable_varieties(
            name,
            variety,
            category,
            optimal_temperature_min,
            optimal_temperature_max,
            water_requirement,
            sunlight_requirement,
            soil_ph_min,
            soil_ph_max,
            standard_growth_days
          )
        `)
        .eq('id', vegetableId)
        .single()

      if (error || !data) {
        console.log('データベースデータが取得できないため、テストデータを表示します')
        const testVegetable = testVegetables[vegetableId]
        if (testVegetable) {
          setVegetable(testVegetable)
        } else {
          console.error('該当するテストデータが見つかりません:', vegetableId)
        }
        return
      }

      setVegetable(data)
    } catch (error) {
      console.error('予期しないエラー:', error)
      const testVegetable = testVegetables[vegetableId]
      if (testVegetable) {
        setVegetable(testVegetable)
      }
    }
  }

  async function fetchTasks() {
    try {
      const { data, error } = await supabase
        .from('growing_tasks')
        .select('*')
        .eq('vegetable_id', vegetableId)
        .order('start_date', { ascending: true })

      if (error) {
        console.error('タスクの取得エラー:', error)
        return
      }

      setTasks(data || [])
    } catch (error) {
      console.error('予期しないエラー:', error)
    }
  }

  async function fetchLogs() {
    try {
      const { data, error } = await supabase
        .from('operation_logs')
        .select('*')
        .eq('vegetable_id', vegetableId)
        .order('date', { ascending: false })
        .limit(10)

      if (error) {
        console.error('作業記録の取得エラー:', error)
        return
      }

      setLogs(data || [])
    } catch (error) {
      console.error('予期しないエラー:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP')
  }

  const calculateGrowthProgress = () => {
    if (!vegetable) return 0
    
    const plantingDate = new Date(vegetable.planting_date)
    const today = new Date()
    const daysPassed = Math.floor((today.getTime() - plantingDate.getTime()) / (1000 * 60 * 60 * 24))
    const totalDays = vegetable.variety.standard_growth_days
    
    return Math.min(Math.max((daysPassed / totalDays) * 100, 0), 100)
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (!vegetable) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="text-center py-12">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              野菜が見つかりません
            </h3>
            <Button asChild>
              <Link href="/vegetables">
                <ArrowLeft className="w-4 h-4 mr-2" />
                一覧に戻る
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const growthProgress = calculateGrowthProgress()

  return (
    <div className="container mx-auto p-4">
      {/* ヘッダー */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="sm" asChild>
          <Link href="/vegetables">
            <ArrowLeft className="w-4 h-4 mr-2" />
            一覧に戻る
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{vegetable.name}</h1>
          <p className="text-gray-600">
            {vegetable.variety.name} - {vegetable.variety.variety} ({vegetable.variety.category})
          </p>
        </div>
        <div className="ml-auto">
          <Badge 
            className={statusConfig[vegetable.status as keyof typeof statusConfig]?.color}
            variant="secondary"
          >
            {statusConfig[vegetable.status as keyof typeof statusConfig]?.label}
          </Badge>
        </div>
      </div>

      {/* 基本情報カード */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">圃場・面積</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <MapPin className="w-4 h-4 mr-2 text-gray-500" />
              <span className="font-semibold">{vegetable.plot_name}</span>
            </div>
            <p className="text-2xl font-bold mt-1">{vegetable.area_size}㎡</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">株数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Sprout className="w-4 h-4 mr-2 text-green-500" />
              <span className="text-2xl font-bold">{vegetable.plant_count}株</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">植付日</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <CalendarDays className="w-4 h-4 mr-2 text-blue-500" />
              <span className="font-semibold">{formatDate(vegetable.planting_date)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">成長進捗</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>進捗</span>
                <span>{Math.round(growthProgress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${growthProgress}%` }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* タブ */}
      <Tabs defaultValue="info" className="space-y-6">
        <TabsList>
          <TabsTrigger value="info">栽培情報</TabsTrigger>
          <TabsTrigger value="tasks">タスク管理</TabsTrigger>
          <TabsTrigger value="logs">作業記録</TabsTrigger>
          <TabsTrigger value="photos">写真</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* 栽培条件 */}
            <Card>
              <CardHeader>
                <CardTitle>栽培条件</CardTitle>
                <CardDescription>
                  {vegetable.variety.name}の最適栽培条件
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Thermometer className="w-4 h-4 mr-2 text-red-500" />
                    <span>適温</span>
                  </div>
                  <span className="font-semibold">
                    {vegetable.variety.optimal_temperature_min}°C 〜 {vegetable.variety.optimal_temperature_max}°C
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Droplets className="w-4 h-4 mr-2 text-blue-500" />
                    <span>水分</span>
                  </div>
                  <span className="font-semibold">{vegetable.variety.water_requirement}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Sun className="w-4 h-4 mr-2 text-yellow-500" />
                    <span>日照</span>
                  </div>
                  <span className="font-semibold">{vegetable.variety.sunlight_requirement}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span>土壌pH</span>
                  <span className="font-semibold">
                    {vegetable.variety.soil_ph_min} 〜 {vegetable.variety.soil_ph_max}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span>標準栽培期間</span>
                  <span className="font-semibold">{vegetable.variety.standard_growth_days}日</span>
                </div>
              </CardContent>
            </Card>

            {/* 収穫予定 */}
            <Card>
              <CardHeader>
                <CardTitle>収穫予定</CardTitle>
                <CardDescription>収穫時期の計画と実績</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">予定</h4>
                  <p className="text-sm text-gray-600">
                    {formatDate(vegetable.expected_harvest_start)} 〜 
                    {formatDate(vegetable.expected_harvest_end)}
                  </p>
                </div>
                
                {vegetable.actual_harvest_start && (
                  <div>
                    <h4 className="font-semibold mb-2">実績</h4>
                    <p className="text-sm text-gray-600">
                      {formatDate(vegetable.actual_harvest_start)}
                      {vegetable.actual_harvest_end && ` 〜 ${formatDate(vegetable.actual_harvest_end)}`}
                    </p>
                  </div>
                )}
                
                {vegetable.notes && (
                  <div>
                    <h4 className="font-semibold mb-2">備考</h4>
                    <p className="text-sm text-gray-600">{vegetable.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">栽培タスク</h3>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              タスク追加
            </Button>
          </div>
          
          {tasks.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-gray-600">タスクがありません</p>
                <Button className="mt-4">
                  <Plus className="w-4 h-4 mr-2" />
                  最初のタスクを作成
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <Card key={task.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold">{task.name}</h4>
                          <Badge 
                            variant="outline"
                            className={priorityConfig[task.priority as keyof typeof priorityConfig]?.color}
                          >
                            {priorityConfig[task.priority as keyof typeof priorityConfig]?.label}
                          </Badge>
                          <Badge 
                            variant="secondary"
                            className={taskStatusConfig[task.status as keyof typeof taskStatusConfig]?.color}
                          >
                            {taskStatusConfig[task.status as keyof typeof taskStatusConfig]?.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>期间: {formatDate(task.start_date)} 〜 {formatDate(task.end_date)}</span>
                          {task.estimated_hours && (
                            <span>予定時間: {task.estimated_hours}h</span>
                          )}
                          <span>進捗: {task.progress}%</span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="w-16 h-2 bg-gray-200 rounded-full">
                          <div 
                            className="h-2 bg-blue-500 rounded-full transition-all"
                            style={{ width: `${task.progress}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">作業記録</h3>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              記録追加
            </Button>
          </div>
          
          {logs.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-gray-600">作業記録がありません</p>
                <Button className="mt-4">
                  <Plus className="w-4 h-4 mr-2" />
                  最初の記録を追加
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <Card key={log.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold">{log.work_type}</h4>
                      <div className="text-sm text-gray-500">
                        {formatDate(log.date)}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{log.work_notes}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      {log.weather && <span>天気: {log.weather}</span>}
                      {log.temperature_morning && (
                        <span>気温: {log.temperature_morning}°C〜{log.temperature_afternoon}°C</span>
                      )}
                      {log.work_hours && <span>作業時間: {log.work_hours}h</span>}
                      {log.worker_count && <span>作業者: {log.worker_count}人</span>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="photos" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">写真</h3>
            <PhotoUpload 
              vegetableId={vegetableId}
              onUploadSuccess={() => {
                // 写真一覧を再読み込み
                window.location.reload()
              }}
            />
          </div>
          
          <PhotoGallery 
            vegetableId={vegetableId}
            onPhotoDeleted={() => {
              // 写真削除時の処理
              console.log('Photo deleted')
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}