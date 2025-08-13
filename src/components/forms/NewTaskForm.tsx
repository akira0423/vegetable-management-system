'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DialogFooter } from '@/components/ui/dialog'
import { Calendar, User, Sprout, AlertTriangle, Plus, Loader2 } from 'lucide-react'
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

const assignedUsers: AssignedUser[] = [
  { id: 'none', name: '👤 担当者なし', isNone: true },
  { id: 'd0efa1ac-7e7e-420b-b147-dabdf01454b7', name: '👨‍🌾 田中太郎', isNone: false },
  { id: 'a1b2c3d4-5e6f-7890-1234-567890abcdef', name: '👩‍🌾 佐藤花子', isNone: false },
  { id: 'b2c3d4e5-6f78-9012-3456-789abcdef012', name: '👨‍🌾 山田次郎', isNone: false }
]

export default function NewTaskForm({ vegetables, onSubmit, onCancel, isLoading = false }: NewTaskFormProps) {
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
    if (!formData.vegetableId) {
      newErrors.vegetableId = '野菜を選択してください'
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 左列 */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="workType" className="text-sm font-medium flex items-center">
              <Sprout className="w-4 h-4 mr-2 text-green-600" />
              作業種類 <span className="text-red-500 ml-1">*</span>
            </Label>
            <Select
              value={formData.workType}
              onValueChange={(value) => handleInputChange('workType', value)}
            >
              <SelectTrigger className={`transition-colors ${errors.workType ? 'border-red-500' : 'border-gray-300 focus:border-green-500'}`}>
                <SelectValue placeholder="🌱 作業種類を選択してください" />
              </SelectTrigger>
              <SelectContent>
                {WORK_TYPES.map(workType => (
                  <SelectItem key={workType.value} value={workType.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{workType.label}</span>
                      <span className="text-xs text-gray-500">{workType.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.workType && <p className="text-xs text-red-500">{errors.workType}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="vegetable" className="text-sm font-medium">
              対象野菜 <span className="text-red-500 ml-1">*</span>
            </Label>
            <Select
              value={formData.vegetableId}
              onValueChange={(value) => handleInputChange('vegetableId', value)}
            >
              <SelectTrigger className={`transition-colors ${errors.vegetableId ? 'border-red-500' : 'border-gray-300 focus:border-green-500'}`}>
                <SelectValue placeholder="🥬 野菜を選択してください" />
              </SelectTrigger>
              <SelectContent>
                {vegetables.map(vegetable => (
                  <SelectItem key={vegetable.id} value={vegetable.id}>
                    {vegetable.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.vegetableId && <p className="text-xs text-red-500">{errors.vegetableId}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignedUser" className="text-sm font-medium flex items-center">
              <User className="w-4 h-4 mr-2 text-blue-600" />
              担当者 <span className="text-gray-400 ml-1 text-xs">(任意)</span>
            </Label>
            <Select
              value={formData.assignedUserId}
              onValueChange={(value) => handleInputChange('assignedUserId', value)}
            >
              <SelectTrigger className={`transition-colors ${errors.assignedUserId ? 'border-red-500' : 'border-gray-300 focus:border-blue-500'}`}>
                <SelectValue placeholder="👤 担当者を選択してください" />
              </SelectTrigger>
              <SelectContent>
                {assignedUsers.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className={`flex items-center space-x-2 ${user.isNone ? 'text-gray-500' : 'text-gray-900'}`}>
                      <span>{user.name}</span>
                      {user.isNone && <span className="text-xs text-gray-400">(未割り当て)</span>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.assignedUserId && <p className="text-xs text-red-500">{errors.assignedUserId}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority" className="text-sm font-medium flex items-center">
              <AlertTriangle className="w-4 h-4 mr-2 text-orange-600" />
              優先度
            </Label>
            <Select
              value={formData.priority}
              onValueChange={(value: 'low' | 'medium' | 'high') => handleInputChange('priority', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-gray-400 mr-2"></div>
                    低
                  </div>
                </SelectItem>
                <SelectItem value="medium">
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-yellow-400 mr-2"></div>
                    中
                  </div>
                </SelectItem>
                <SelectItem value="high">
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-red-400 mr-2"></div>
                    高
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 右列 */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="startDate" className="text-sm font-medium flex items-center">
              <Calendar className="w-4 h-4 mr-2 text-blue-600" />
              開始日
            </Label>
            <Input
              id="startDate"
              type="date"
              value={formData.startDate}
              onChange={(e) => handleInputChange('startDate', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate" className="text-sm font-medium flex items-center">
              <Calendar className="w-4 h-4 mr-2 text-blue-600" />
              終了日
            </Label>
            <Input
              id="endDate"
              type="date"
              value={formData.endDate}
              onChange={(e) => handleInputChange('endDate', e.target.value)}
              className={errors.endDate ? 'border-red-500' : ''}
            />
            {errors.endDate && <p className="text-xs text-red-500">{errors.endDate}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              作業内容・備考 {formData.workType === 'other' && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Textarea
              id="description"
              placeholder={formData.workType === 'other' ? '具体的な作業内容を入力してください（必須）' : '作業の詳細、使用する資材、注意事項など...'}
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className={`min-h-[120px] resize-none ${errors.description ? 'border-red-500' : ''}`}
            />
            {errors.description && <p className="text-xs text-red-500">{errors.description}</p>}
          </div>
        </div>
      </div>

      <DialogFooter className="flex gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          キャンセル
        </Button>
        <Button 
          type="submit" 
          className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed"
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Plus className="w-4 h-4 mr-2" />
          )}
          {isLoading ? '作成中...' : 'タスクを作成'}
        </Button>
      </DialogFooter>
    </form>
  )
}