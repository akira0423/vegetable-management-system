'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Calendar, Clock, Plus, Edit, Trash2, CheckCircle, AlertCircle, User } from 'lucide-react'

interface GrowingTask {
  id: string
  name: string
  description: string
  task_type: string
  priority: 'high' | 'medium' | 'low'
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'overdue'
  start_date: string
  end_date: string
  estimated_hours?: number
  actual_hours?: number
  progress: number
  assigned_to?: string
  notes?: string
  created_by?: string
}

interface TaskManagementProps {
  vegetableId: string
  onTaskUpdated?: () => void
}

const priorityConfig = {
  high: { label: '高', color: 'bg-red-100 text-red-800' },
  medium: { label: '中', color: 'bg-yellow-100 text-yellow-800' },
  low: { label: '低', color: 'bg-green-100 text-green-800' }
}

const statusConfig = {
  pending: { label: '未着手', color: 'bg-gray-100 text-gray-800', icon: Clock },
  in_progress: { label: '進行中', color: 'bg-blue-100 text-blue-800', icon: Clock },
  completed: { label: '完了', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  cancelled: { label: '中止', color: 'bg-red-100 text-red-800', icon: AlertCircle },
  overdue: { label: '遅延', color: 'bg-red-100 text-red-800', icon: AlertCircle }
}

const taskTypes = [
  { value: 'seeding', label: '播種' },
  { value: 'transplanting', label: '移植' },
  { value: 'fertilizing', label: '施肥' },
  { value: 'watering', label: '水やり' },
  { value: 'pruning', label: '剪定' },
  { value: 'harvesting', label: '収穫' },
  { value: 'other', label: 'その他' }
]

export default function TaskManagement({ vegetableId, onTaskUpdated }: TaskManagementProps) {
  const [tasks, setTasks] = useState<GrowingTask[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<GrowingTask | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    task_type: 'other',
    priority: 'medium',
    status: 'pending',
    start_date: '',
    end_date: '',
    estimated_hours: '',
    progress: '0',
    notes: ''
  })

  useEffect(() => {
    fetchTasks()
  }, [vegetableId])

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('growing_tasks')
        .select('*')
        .eq('vegetable_id', vegetableId)
        .order('start_date', { ascending: true })

      if (error) {
        
        // エラーの場合はテストデータを表示
        const testTasks = [
          {
            id: 'task-1',
            name: '種まき',
            description: 'トマト桃太郎の種まき作業',
            task_type: 'seeding',
            priority: 'high' as const,
            status: 'completed' as const,
            start_date: '2024-03-01',
            end_date: '2024-03-01',
            estimated_hours: 2,
            actual_hours: 1.5,
            progress: 100,
            notes: '発芽率良好'
          },
          {
            id: 'task-2',
            name: '移植',
            description: '育苗トレイから本圃場への移植',
            task_type: 'transplanting',
            priority: 'high' as const,
            status: 'completed' as const,
            start_date: '2024-03-30',
            end_date: '2024-03-30',
            estimated_hours: 3,
            actual_hours: 3.5,
            progress: 100,
            notes: '50株すべて移植完了'
          },
          {
            id: 'task-3',
            name: '第1回追肥',
            description: '開花期の追肥作業',
            task_type: 'fertilizing',
            priority: 'medium' as const,
            status: 'in_progress' as const,
            start_date: '2024-05-01',
            end_date: '2024-05-01',
            estimated_hours: 1.5,
            progress: 75,
            notes: 'トマト専用肥料使用'
          },
          {
            id: 'task-4',
            name: '収穫開始',
            description: 'トマトの収穫作業開始',
            task_type: 'harvesting',
            priority: 'high' as const,
            status: 'pending' as const,
            start_date: '2024-06-10',
            end_date: '2024-08-31',
            estimated_hours: 40,
            progress: 0,
            notes: '予定収穫量：200kg'
          }
        ]
        setTasks(testTasks)
        return
      }

      setTasks(data || [])
    } catch (error) {
      
    } finally {
      setLoading(false)
    }
  }

  const handleSaveTask = async () => {
    try {
      const taskData = {
        vegetable_id: vegetableId,
        name: formData.name,
        description: formData.description,
        task_type: formData.task_type,
        priority: formData.priority,
        status: formData.status,
        start_date: formData.start_date,
        end_date: formData.end_date,
        estimated_hours: parseFloat(formData.estimated_hours) || null,
        progress: parseInt(formData.progress) || 0,
        notes: formData.notes || null,
        created_by: null // 認証未実装のためnull
      }

      if (editingTask) {
        // 編集の場合
        const { error } = await supabase
          .from('growing_tasks')
          .update(taskData)
          .eq('id', editingTask.id)

        if (error) {
          
          alert('タスクの更新に失敗しました')
          return
        }
      } else {
        // 新規作成の場合
        const { error } = await supabase
          .from('growing_tasks')
          .insert(taskData)

        if (error) {
          
          alert('タスクの作成に失敗しました')
          return
        }
      }

      // 成功時の処理
      alert(editingTask ? 'タスクを更新しました' : 'タスクを作成しました')
      setIsDialogOpen(false)
      resetForm()
      fetchTasks()
      onTaskUpdated?.()
    } catch (error) {
      
      alert('予期しないエラーが発生しました')
    }
  }

  const handleDeleteTask = async (task: GrowingTask) => {
    if (!confirm(`「${task.name}」を削除しますか？`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('growing_tasks')
        .delete()
        .eq('id', task.id)

      if (error) {
        
        alert('タスクの削除に失敗しました')
        return
      }

      alert('タスクを削除しました')
      fetchTasks()
      onTaskUpdated?.()
    } catch (error) {
      
      alert('予期しないエラーが発生しました')
    }
  }

  const handleEditTask = (task: GrowingTask) => {
    setEditingTask(task)
    setFormData({
      name: task.name,
      description: task.description,
      task_type: task.task_type,
      priority: task.priority,
      status: task.status,
      start_date: task.start_date,
      end_date: task.end_date,
      estimated_hours: task.estimated_hours?.toString() || '',
      progress: task.progress.toString(),
      notes: task.notes || ''
    })
    setIsDialogOpen(true)
  }

  const resetForm = () => {
    setEditingTask(null)
    setFormData({
      name: '',
      description: '',
      task_type: 'other',
      priority: 'medium',
      status: 'pending',
      start_date: '',
      end_date: '',
      estimated_hours: '',
      progress: '0',
      notes: ''
    })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-200 rounded-lg animate-pulse"></div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">栽培タスク</h3>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              タスク追加
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
            <DialogHeader>
              <DialogTitle>
                {editingTask ? 'タスク編集' : '新規タスク作成'}
              </DialogTitle>
              <DialogDescription>
                栽培タスクの詳細を入力してください
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">タスク名 *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="例: 種まき"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="task_type">作業種別</Label>
                  <Select value={formData.task_type} onValueChange={(value) => setFormData(prev => ({ ...prev, task_type: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {taskTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">説明</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="タスクの詳細説明"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priority">優先度</Label>
                  <Select value={formData.priority} onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">高</SelectItem>
                      <SelectItem value="medium">中</SelectItem>
                      <SelectItem value="low">低</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">ステータス</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">未着手</SelectItem>
                      <SelectItem value="in_progress">進行中</SelectItem>
                      <SelectItem value="completed">完了</SelectItem>
                      <SelectItem value="cancelled">中止</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="progress">進捗 (%)</Label>
                  <Input
                    id="progress"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.progress}
                    onChange={(e) => setFormData(prev => ({ ...prev, progress: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">開始日 *</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_date">終了日 *</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="estimated_hours">予定時間 (h)</Label>
                  <Input
                    id="estimated_hours"
                    type="number"
                    step="0.5"
                    value={formData.estimated_hours}
                    onChange={(e) => setFormData(prev => ({ ...prev, estimated_hours: e.target.value }))}
                    placeholder="2.0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">備考</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="特記事項があれば記入"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  キャンセル
                </Button>
                <Button onClick={handleSaveTask}>
                  {editingTask ? '更新' : '作成'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Clock className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              タスクがありません
            </h3>
            <p className="text-gray-600 mb-4">
              最初のタスクを作成して栽培管理を始めましょう
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const StatusIcon = statusConfig[task.status]?.icon || Clock
            return (
              <Card key={task.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">{task.name}</h4>
                        <Badge 
                          variant="outline"
                          className={priorityConfig[task.priority]?.color}
                        >
                          {priorityConfig[task.priority]?.label}
                        </Badge>
                        <Badge 
                          variant="secondary"
                          className={statusConfig[task.status]?.color}
                        >
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusConfig[task.status]?.label}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                      
                      <div className="space-y-2">
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(task.start_date)} 〜 {formatDate(task.end_date)}
                          </span>
                          {task.estimated_hours && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              予定: {task.estimated_hours}h
                            </span>
                          )}
                          {task.actual_hours && (
                            <span className="flex items-center gap-1">
                              実績: {task.actual_hours}h
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span>進捗</span>
                              <span>{task.progress}%</span>
                            </div>
                            <Progress value={task.progress} className="h-2" />
                          </div>
                        </div>
                        
                        {task.notes && (
                          <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                            <strong>備考:</strong> {task.notes}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-1 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditTask(task)}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteTask(task)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}