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
import { Calendar, Clock, Plus, Edit, Trash2, User, FileText, Timer } from 'lucide-react'

interface OperationLog {
  id: string
  task_id?: string
  operation_type: string
  description: string
  work_date: string
  start_time?: string
  end_time?: string
  hours_worked?: number
  weather?: string
  temperature?: string
  notes?: string
  created_by?: string
}

interface WorkLogProps {
  vegetableId: string
  tasks: Array<{
    id: string
    name: string
    task_type: string
    status: string
  }>
  onLogUpdated?: () => void
}

const operationTypes = [
  { value: 'seeding', label: '播種' },
  { value: 'transplanting', label: '移植' },
  { value: 'fertilizing', label: '施肥' },
  { value: 'watering', label: '水やり' },
  { value: 'pruning', label: '剪定' },
  { value: 'harvesting', label: '収穫' },
  { value: 'inspection', label: '点検' },
  { value: 'pest_control', label: '病害虫対策' },
  { value: 'weeding', label: '除草' },
  { value: 'other', label: 'その他' }
]

const weatherOptions = [
  { value: 'sunny', label: '晴れ' },
  { value: 'cloudy', label: '曇り' },
  { value: 'rainy', label: '雨' },
  { value: 'partly_cloudy', label: '晴れ時々曇り' },
  { value: 'drizzle', label: '小雨' }
]

export default function WorkLog({ vegetableId, tasks, onLogUpdated }: WorkLogProps) {
  const [logs, setLogs] = useState<OperationLog[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingLog, setEditingLog] = useState<OperationLog | null>(null)
  const [formData, setFormData] = useState({
    task_id: '',
    operation_type: 'other',
    description: '',
    work_date: new Date().toISOString().split('T')[0],
    start_time: '',
    end_time: '',
    weather: 'sunny',
    temperature: '',
    notes: ''
  })

  useEffect(() => {
    fetchLogs()
  }, [vegetableId])

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('operation_logs')
        .select('*')
        .eq('vegetable_id', vegetableId)
        .order('work_date', { ascending: false })
        .order('start_time', { ascending: false })

      if (error) {
        console.error('作業記録の取得エラー:', error)
        // エラーの場合はテストデータを表示
        const testLogs: OperationLog[] = [
          {
            id: 'log-1',
            operation_type: 'seeding',
            description: 'トマト桃太郎の種まき作業を実施',
            work_date: '2024-03-01',
            start_time: '09:00',
            end_time: '10:30',
            hours_worked: 1.5,
            weather: 'sunny',
            temperature: '18',
            notes: '発芽率を高めるため温床で管理'
          },
          {
            id: 'log-2',
            operation_type: 'watering',
            description: '育苗トレイに水やり実施',
            work_date: '2024-03-05',
            start_time: '08:00',
            end_time: '08:30',
            hours_worked: 0.5,
            weather: 'cloudy',
            temperature: '15',
            notes: '土壌の乾燥状態を確認して適量散水'
          },
          {
            id: 'log-3',
            operation_type: 'transplanting',
            description: '育苗から本圃場への移植作業',
            work_date: '2024-03-30',
            start_time: '07:00',
            end_time: '11:00',
            hours_worked: 4.0,
            weather: 'partly_cloudy',
            temperature: '22',
            notes: '50株すべて移植完了、根張り良好'
          }
        ]
        setLogs(testLogs)
        return
      }

      setLogs(data || [])
    } catch (error) {
      console.error('予期しないエラー:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateHours = (startTime: string, endTime: string): number => {
    if (!startTime || !endTime) return 0
    
    const start = new Date(`2024-01-01 ${startTime}:00`)
    const end = new Date(`2024-01-01 ${endTime}:00`)
    
    if (end <= start) return 0
    
    const diffMs = end.getTime() - start.getTime()
    return Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10
  }

  const handleSaveLog = async () => {
    try {
      const calculatedHours = formData.start_time && formData.end_time 
        ? calculateHours(formData.start_time, formData.end_time)
        : null

      const logData = {
        vegetable_id: vegetableId,
        task_id: formData.task_id || null,
        operation_type: formData.operation_type,
        description: formData.description,
        work_date: formData.work_date,
        start_time: formData.start_time || null,
        end_time: formData.end_time || null,
        hours_worked: calculatedHours,
        weather: formData.weather || null,
        temperature: formData.temperature ? parseFloat(formData.temperature) : null,
        notes: formData.notes || null,
        created_by: null // 認証未実装のためnull
      }

      if (editingLog) {
        // 編集の場合
        const { error } = await supabase
          .from('operation_logs')
          .update(logData)
          .eq('id', editingLog.id)

        if (error) {
          console.error('作業記録更新エラー:', error)
          alert('作業記録の更新に失敗しました')
          return
        }
      } else {
        // 新規作成の場合
        const { error } = await supabase
          .from('operation_logs')
          .insert(logData)

        if (error) {
          console.error('作業記録作成エラー:', error)
          alert('作業記録の作成に失敗しました')
          return
        }
      }

      // 成功時の処理
      alert(editingLog ? '作業記録を更新しました' : '作業記録を作成しました')
      setIsDialogOpen(false)
      resetForm()
      fetchLogs()
      onLogUpdated?.()
    } catch (error) {
      console.error('予期しないエラー:', error)
      alert('予期しないエラーが発生しました')
    }
  }

  const handleDeleteLog = async (log: OperationLog) => {
    if (!confirm(`「${log.description}」を削除しますか？`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('operation_logs')
        .delete()
        .eq('id', log.id)

      if (error) {
        console.error('作業記録削除エラー:', error)
        alert('作業記録の削除に失敗しました')
        return
      }

      alert('作業記録を削除しました')
      fetchLogs()
      onLogUpdated?.()
    } catch (error) {
      console.error('予期しないエラー:', error)
      alert('予期しないエラーが発生しました')
    }
  }

  const handleEditLog = (log: OperationLog) => {
    setEditingLog(log)
    setFormData({
      task_id: log.task_id || '',
      operation_type: log.operation_type,
      description: log.description,
      work_date: log.work_date,
      start_time: log.start_time || '',
      end_time: log.end_time || '',
      weather: log.weather || 'sunny',
      temperature: log.temperature?.toString() || '',
      notes: log.notes || ''
    })
    setIsDialogOpen(true)
  }

  const resetForm = () => {
    setEditingLog(null)
    setFormData({
      task_id: '',
      operation_type: 'other',
      description: '',
      work_date: new Date().toISOString().split('T')[0],
      start_time: '',
      end_time: '',
      weather: 'sunny',
      temperature: '',
      notes: ''
    })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      weekday: 'short'
    })
  }

  const formatTime = (timeString: string) => {
    return timeString.slice(0, 5) // HH:MM形式
  }

  const getOperationTypeLabel = (type: string) => {
    return operationTypes.find(t => t.value === type)?.label || type
  }

  const getWeatherLabel = (weather: string) => {
    return weatherOptions.find(w => w.value === weather)?.label || weather
  }

  const getTaskName = (taskId: string) => {
    return tasks.find(t => t.id === taskId)?.name || '関連タスクなし'
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
        <h3 className="text-lg font-semibold">作業記録</h3>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              記録追加
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
            <DialogHeader>
              <DialogTitle>
                {editingLog ? '作業記録編集' : '新規作業記録'}
              </DialogTitle>
              <DialogDescription>
                実施した作業内容を記録してください
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="work_date">作業日 *</Label>
                  <Input
                    id="work_date"
                    type="date"
                    value={formData.work_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, work_date: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="operation_type">作業種別 *</Label>
                  <Select value={formData.operation_type} onValueChange={(value) => setFormData(prev => ({ ...prev, operation_type: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {operationTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="task_id">関連タスク</Label>
                <Select value={formData.task_id} onValueChange={(value) => setFormData(prev => ({ ...prev, task_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="関連するタスクを選択（任意）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">関連タスクなし</SelectItem>
                    {tasks.map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">作業内容 *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="実施した作業の詳細内容"
                  rows={3}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_time">開始時間</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_time">終了時間</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                  />
                </div>
              </div>

              {formData.start_time && formData.end_time && (
                <div className="text-sm text-gray-600 bg-blue-50 p-2 rounded">
                  作業時間: {calculateHours(formData.start_time, formData.end_time)}時間
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="weather">天候</Label>
                  <Select value={formData.weather} onValueChange={(value) => setFormData(prev => ({ ...prev, weather: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {weatherOptions.map((weather) => (
                        <SelectItem key={weather.value} value={weather.value}>
                          {weather.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="temperature">気温 (°C)</Label>
                  <Input
                    id="temperature"
                    type="number"
                    step="0.1"
                    value={formData.temperature}
                    onChange={(e) => setFormData(prev => ({ ...prev, temperature: e.target.value }))}
                    placeholder="25.5"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">備考</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="特記事項、気づいた点など"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  キャンセル
                </Button>
                <Button onClick={handleSaveLog}>
                  {editingLog ? '更新' : '作成'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {logs.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              作業記録がありません
            </h3>
            <p className="text-gray-600 mb-4">
              最初の作業記録を追加して栽培履歴を管理しましょう
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <Card key={log.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold">{log.description}</h4>
                      <Badge variant="outline" className="bg-blue-100 text-blue-800">
                        {getOperationTypeLabel(log.operation_type)}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(log.work_date)}
                        </span>
                        {log.start_time && log.end_time && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {formatTime(log.start_time)} 〜 {formatTime(log.end_time)}
                          </span>
                        )}
                        {log.hours_worked && (
                          <span className="flex items-center gap-1">
                            <Timer className="w-4 h-4" />
                            {log.hours_worked}時間
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        {log.weather && (
                          <span>天候: {getWeatherLabel(log.weather)}</span>
                        )}
                        {log.temperature && (
                          <span>気温: {log.temperature}°C</span>
                        )}
                        {log.task_id && (
                          <span>関連タスク: {getTaskName(log.task_id)}</span>
                        )}
                      </div>
                      
                      {log.notes && (
                        <div className="text-sm text-gray-500 bg-gray-50 p-2 rounded">
                          <strong>備考:</strong> {log.notes}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-1 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditLog(log)}
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteLog(log)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}