'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Calendar, User, Sprout, AlertTriangle, Plus, Loader2, X } from 'lucide-react'
import { format, addDays } from 'date-fns'

interface Vegetable {
  id: string
  name: string
  variety: string
  status: string
}

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
  description?: string
  color?: string
}

interface NewTaskFormProps {
  vegetables: Vegetable[]
  onSubmit: (task: Partial<GanttTask>) => void
  onCancel: () => void
  isLoading?: boolean
}

interface WorkType {
  value: string
  label: string
  description: string
}

const WORK_TYPES: WorkType[] = [
  { value: 'seeding', label: '🌱 播種・育苗', description: '種まき、苗の管理' },
  { value: 'planting', label: '🌿 定植', description: '苗の植え付け' },
  { value: 'fertilizing', label: '🌾 施肥', description: '肥料の散布' },
  { value: 'watering', label: '💧 灌水', description: '水やり、スプリンクラー' },
  { value: 'weeding', label: '🔧 除草', description: '雑草の除去' },
  { value: 'pruning', label: '✂️ 整枝・摘芽', description: '剪定、芽かき' },
  { value: 'harvesting', label: '🥕 収穫', description: '農作物の収穫' },
  { value: 'inspection', label: '🔍 点検・観察', description: '生育状況の確認' },
  { value: 'other', label: '⚙️ その他', description: '上記以外の作業' }
]

interface AssignedUser {
  id: string
  name: string
  isNone: boolean
}

export default function NewTaskForm({ vegetables, onSubmit, onCancel, isLoading = false }: NewTaskFormProps) {
  const [assignedUsers, setAssignedUsers] = useState<AssignedUser[]>([
    { id: 'none', name: '👤 担当者なし', isNone: true }
  ])

  // ユーザーデータを取得
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const userResponse = await fetch('/api/auth/user')
        if (userResponse.ok) {
          const userData = await userResponse.json()
          if (userData.success && userData.user?.company_id) {
            const usersResponse = await fetch(`/api/users?company_id=${userData.user.company_id}`)
            if (usersResponse.ok) {
              const usersData = await usersResponse.json()
              if (usersData.users) {
                const formattedUsers = usersData.users.map((u: any) => ({
                  id: u.id,
                  name: u.full_name || u.email || '名前未設定',
                  isNone: false
                }))
                setAssignedUsers([
                  { id: 'none', name: '👤 担当者なし', isNone: true },
                  ...formattedUsers
                ])
              }
            }
          }
        }
      } catch (error) {
        console.error('ユーザー取得エラー:', error)
      }
    }
    fetchUsers()
  }, [])
  const [formData, setFormData] = useState({
    workType: 'inspection' as string, // より実用的な初期値
    description: '',
    vegetableId: '',
    assignedUserId: 'none',
    priority: 'medium' as 'low' | 'medium' | 'high',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(addDays(new Date(), 7), 'yyyy-MM-dd')
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.workType) {
      newErrors.workType = '作業種類を選択してください'
    }
    if (formData.workType === 'other' && !formData.description.trim()) {
      newErrors.description = 'その他の場合は作業内容・備考の入力が必須です'
    }
    if (!formData.vegetableId || formData.vegetableId === 'no-vegetables') {
      newErrors.vegetableId = vegetables.length === 0 
        ? '野菜が登録されていません。まず野菜を登録してください。'
        : '野菜を選択してください'
    }
    // 担当者は任意項目になりました
    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      newErrors.endDate = '終了日は開始日以降である必要があります'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    const selectedVegetable = vegetables.find(v => v.id === formData.vegetableId)
    const selectedUser = assignedUsers.find(u => u.id === formData.assignedUserId)

    if (!selectedVegetable) return

    const selectedWorkType = WORK_TYPES.find(wt => wt.value === formData.workType)
    const taskName = selectedWorkType ? selectedWorkType.label : formData.workType

    const taskData: Partial<GanttTask> = {
      name: taskName,
      start: formData.startDate,
      end: formData.endDate,
      priority: formData.priority,
      workType: formData.workType,
      vegetable: {
        id: selectedVegetable.id,
        name: selectedVegetable.name,
        variety: selectedVegetable.variety
      },
      assignedUser: selectedUser && !selectedUser.isNone ? {
        id: selectedUser.id,
        name: selectedUser.name
      } : undefined,
      description: formData.description.trim() || undefined
    }

    onSubmit(taskData)
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // 作業種類が変更された場合、適切な期間を自動設定
    if (field === 'workType') {
      const workTypeDurations: Record<string, number> = {
        'seeding': 30,      // 播種・育苗: 30日
        'planting': 1,      // 定植: 1日
        'fertilizing': 1,   // 施肥: 1日
        'watering': 1,      // 灌水: 1日
        'weeding': 2,       // 除草: 2日
        'pruning': 3,       // 整枝・摘芽: 3日
        'harvesting': 14,   // 収穫: 14日
        'inspection': 1,    // 点検・観察: 1日
        'other': 7          // その他: 7日
      }
      
      const duration = workTypeDurations[value] || 7
      const newEndDate = format(addDays(new Date(formData.startDate), duration), 'yyyy-MM-dd')
      setFormData(prev => ({ ...prev, [field]: value, endDate: newEndDate }))
    } else {
      setFormData(prev => ({ ...prev, [field]: value }))
    }
    
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  return (
    <div className="p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ヘッダー情報 */}
        <div className="text-center mb-4">
          <div className="bg-blue-100 p-2 rounded-full w-fit mx-auto mb-2">
            <Plus className="w-5 h-5 text-blue-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">新規栽培スケジュール・タスク作成</h2>
          <p className="text-xs text-gray-600 mt-1">栽培作業のタスクを作成してスケジュール管理を効率化します</p>
        </div>

        {/* 2列レイアウト */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 左列 - 基本情報セクション */}
          <div className="space-y-4">
            {/* 対象野菜選択 */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-green-800 mb-3 flex items-center">
                <Sprout className="w-4 h-4 mr-2" />
                対象野菜選択
              </h4>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-700">
                  対象野菜 <span className="text-red-500 ml-1">*</span>
                </Label>
                <Select value={formData.vegetableId} onValueChange={(value) => handleInputChange('vegetableId', value)}>
                  <SelectTrigger className={`bg-white border-green-200 h-9 text-sm ${errors.vegetableId ? 'border-red-400' : ''}`}>
                    <SelectValue placeholder="🥬 野菜を選択してください" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    {vegetables.length === 0 ? (
                      <SelectItem value="no-vegetables" disabled>
                        <span className="text-gray-500 text-sm">
                          登録された野菜がありません。まず野菜を登録してから作業記録を作成してください。
                        </span>
                      </SelectItem>
                    ) : (
                      vegetables.map(vegetable => (
                        <SelectItem key={vegetable.id} value={vegetable.id}>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{vegetable.name}</span>
                            <span className="text-xs text-gray-500">{vegetable.variety}</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {errors.vegetableId && <p className="text-xs text-red-500">{errors.vegetableId}</p>}
              </div>
            </div>

            {/* 作業種類選択 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-blue-800 mb-3 flex items-center">
                <Calendar className="w-4 h-4 mr-2" />
                作業種類選択
              </h4>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-700">
                  作業種類 <span className="text-red-500 ml-1">*</span>
                </Label>
                <Select value={formData.workType} onValueChange={(value) => handleInputChange('workType', value)}>
                  <SelectTrigger className={`bg-white border-blue-200 h-9 text-sm ${errors.workType ? 'border-red-400' : ''}`}>
                    <SelectValue placeholder="🌱 作業種類を選択してください" />
                  </SelectTrigger>
                  <SelectContent>
                    {WORK_TYPES.map(workType => (
                      <SelectItem key={workType.value} value={workType.value}>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{workType.label}</span>
                          <span className="text-xs text-gray-500">{workType.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.workType && <p className="text-xs text-red-500">{errors.workType}</p>}
              </div>
            </div>
          </div>

          {/* 右列 - 設定セクション */}
          <div className="space-y-4">
            {/* スケジュール設定 */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-purple-800 mb-3 flex items-center">
                <Calendar className="w-4 h-4 mr-2" />
                スケジュール設定
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-700">開始日</Label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => handleInputChange('startDate', e.target.value)}
                    className="bg-white border-purple-200 h-9 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-700">終了日</Label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => handleInputChange('endDate', e.target.value)}
                    className={`bg-white border-purple-200 h-9 text-sm ${errors.endDate ? 'border-red-400' : ''}`}
                  />
                  {errors.endDate && <p className="text-xs text-red-500">{errors.endDate}</p>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 担当・詳細セクション（全幅） */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-orange-800 mb-3 flex items-center">
            <User className="w-4 h-4 mr-2" />
            担当・詳細設定
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-700">
                担当者 <span className="text-gray-400 text-xs">(任意)</span>
              </Label>
              <Select value={formData.assignedUserId} onValueChange={(value) => handleInputChange('assignedUserId', value)}>
                <SelectTrigger className="bg-white border-orange-200 h-9 text-sm">
                  <SelectValue placeholder="👤 担当者を選択してください" />
                </SelectTrigger>
                <SelectContent>
                  {assignedUsers.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      <span className={`text-sm ${user.isNone ? 'text-gray-500' : 'text-gray-900'}`}>
                        {user.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-700">優先度</Label>
              <Select value={formData.priority} onValueChange={(value: 'low' | 'medium' | 'high') => handleInputChange('priority', value)}>
                <SelectTrigger className="bg-white border-orange-200 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-gray-400 mr-2"></div>
                      <span className="text-sm">低優先度</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="medium">
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-yellow-400 mr-2"></div>
                      <span className="text-sm">中優先度</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="high">
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-red-400 mr-2"></div>
                      <span className="text-sm">高優先度</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* 作業内容・備考 */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-700">
              作業内容・備考 {formData.workType === 'other' && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Textarea
              placeholder={formData.workType === 'other' ? '具体的な作業内容を入力してください（必須）' : '作業の詳細、使用する資材、注意事項など...'}
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className={`min-h-[60px] resize-none bg-white border-orange-200 focus:border-orange-400 text-sm ${errors.description ? 'border-red-400' : ''}`}
            />
            {errors.description && <p className="text-xs text-red-500">{errors.description}</p>}
          </div>
        </div>


        {/* アクションボタン */}
        <div className="flex gap-3 justify-center pt-2">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            className="px-6 py-2 text-sm"
            disabled={isLoading}
          >
            <X className="w-4 h-4 mr-1" />
            キャンセル
          </Button>
          <Button 
            type="submit" 
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                作成中...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-1" />
                栽培タスクを作成
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}