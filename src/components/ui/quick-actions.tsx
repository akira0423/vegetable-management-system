import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { 
  TrendingUp, 
  Camera, 
  Cloud, 
  Clock, 
  Users,
  Weight,
  DollarSign,
  Thermometer,
  Droplets,
  FileText
} from 'lucide-react'

export interface QuickAction {
  id: string
  label: string
  icon: React.ReactNode
  estimatedTime: number
  category: 'accounting' | 'details' | 'media' | 'analysis'
  color: string
  description: string
}

interface QuickActionsProps {
  workReport: any
  onQuickUpdate: (field: string, value: any) => void
  completionRate: number
}

export function QuickActions({ workReport, onQuickUpdate, completionRate }: QuickActionsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState<string | null>(null)
  const [quickValues, setQuickValues] = useState<{[key: string]: any}>({})

  const quickActions: QuickAction[] = [
    {
      id: 'add_revenue',
      label: '売上追加',
      icon: <TrendingUp className="w-4 h-4" />,
      estimatedTime: 5,
      category: 'accounting',
      color: 'bg-green-500',
      description: '収穫量と期待価格から売上を計算'
    },
    {
      id: 'add_weather',
      label: '天候完成',
      icon: <Cloud className="w-4 h-4" />,
      estimatedTime: 3,
      category: 'details',
      color: 'bg-blue-500',
      description: '天候・気温・湿度を一括入力'
    },
    {
      id: 'add_duration',
      label: '作業時間',
      icon: <Clock className="w-4 h-4" />,
      estimatedTime: 3,
      category: 'details',
      color: 'bg-purple-500',
      description: '作業時間と作業人数を入力'
    },
    {
      id: 'add_harvest',
      label: '収穫記録',
      icon: <Weight className="w-4 h-4" />,
      estimatedTime: 10,
      category: 'accounting',
      color: 'bg-orange-500',
      description: '収穫量・品質・単価を記録'
    },
    {
      id: 'add_photos',
      label: '写真追加',
      icon: <Camera className="w-4 h-4" />,
      estimatedTime: 15,
      category: 'media',
      color: 'bg-indigo-500',
      description: '現場写真をアップロード'
    },
    {
      id: 'add_notes',
      label: 'メモ追記',
      icon: <FileText className="w-4 h-4" />,
      estimatedTime: 5,
      category: 'analysis',
      color: 'bg-gray-500',
      description: '気づいたことや注意点を記録'
    }
  ]

  const getRecommendedActions = () => {
    const recommended = []
    
    if (!workReport.expected_price && !workReport.harvest_amount) {
      recommended.push('add_revenue', 'add_harvest')
    }
    if (!workReport.weather || !workReport.temperature) {
      recommended.push('add_weather')
    }
    if (!workReport.work_duration) {
      recommended.push('add_duration')
    }
    if (!workReport.photos || workReport.photos.length === 0) {
      recommended.push('add_photos')
    }
    if (!workReport.work_notes || workReport.work_notes.length < 10) {
      recommended.push('add_notes')
    }

    return quickActions.filter(action => recommended.includes(action.id))
  }

  const handleQuickAction = (actionId: string) => {
    setIsDialogOpen(actionId)
  }

  const handleQuickSave = (actionId: string) => {
    const values = quickValues[actionId] || {}
    
    switch (actionId) {
      case 'add_revenue':
        if (values.amount && values.price) {
          onQuickUpdate('harvest_amount', parseFloat(values.amount))
          onQuickUpdate('expected_price', parseFloat(values.price))
        }
        break
      case 'add_weather':
        if (values.weather) onQuickUpdate('weather', values.weather)
        if (values.temperature) onQuickUpdate('temperature', parseFloat(values.temperature))
        if (values.humidity) onQuickUpdate('humidity', parseFloat(values.humidity))
        break
      case 'add_duration':
        if (values.duration) onQuickUpdate('work_duration', parseFloat(values.duration))
        if (values.workers) onQuickUpdate('worker_count', parseInt(values.workers))
        break
      case 'add_harvest':
        if (values.amount) onQuickUpdate('harvest_amount', parseFloat(values.amount))
        if (values.unit) onQuickUpdate('harvest_unit', values.unit)
        if (values.quality) onQuickUpdate('harvest_quality', values.quality)
        if (values.price) onQuickUpdate('expected_price', parseFloat(values.price))
        break
      case 'add_notes':
        if (values.notes) {
          const currentNotes = workReport.work_notes || ''
          const newNotes = currentNotes + (currentNotes ? '\n\n' : '') + values.notes
          onQuickUpdate('work_notes', newNotes)
        }
        break
    }
    
    setIsDialogOpen(null)
    setQuickValues({})
  }

  const renderQuickDialog = (action: QuickAction) => (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <div className={`p-2 rounded-full ${action.color} text-white`}>
            {action.icon}
          </div>
          {action.label}
        </DialogTitle>
      </DialogHeader>
      
      <div className="space-y-4">
        <p className="text-sm text-gray-600">{action.description}</p>
        
        {action.id === 'add_revenue' && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="amount">収穫量</Label>
              <Input
                id="amount"
                type="number"
                placeholder="例: 10"
                value={quickValues[action.id]?.amount || ''}
                onChange={(e) => setQuickValues(prev => ({
                  ...prev,
                  [action.id]: { ...prev[action.id], amount: e.target.value }
                }))}
              />
            </div>
            <div>
              <Label htmlFor="price">予想単価（円/kg）</Label>
              <Input
                id="price"
                type="number"
                placeholder="例: 500"
                value={quickValues[action.id]?.price || ''}
                onChange={(e) => setQuickValues(prev => ({
                  ...prev,
                  [action.id]: { ...prev[action.id], price: e.target.value }
                }))}
              />
            </div>
          </div>
        )}

        {action.id === 'add_weather' && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="weather">天候</Label>
              <select
                id="weather"
                className="w-full p-2 border rounded-md"
                value={quickValues[action.id]?.weather || ''}
                onChange={(e) => setQuickValues(prev => ({
                  ...prev,
                  [action.id]: { ...prev[action.id], weather: e.target.value }
                }))}
              >
                <option value="">選択してください</option>
                <option value="sunny">☀️ 晴れ</option>
                <option value="cloudy">☁️ 曇り</option>
                <option value="rainy">🌧️ 雨</option>
                <option value="windy">💨 風</option>
              </select>
            </div>
            <div>
              <Label htmlFor="temperature">気温（℃）</Label>
              <Input
                id="temperature"
                type="number"
                placeholder="例: 25"
                value={quickValues[action.id]?.temperature || ''}
                onChange={(e) => setQuickValues(prev => ({
                  ...prev,
                  [action.id]: { ...prev[action.id], temperature: e.target.value }
                }))}
              />
            </div>
            <div>
              <Label htmlFor="humidity">湿度（%）</Label>
              <Input
                id="humidity"
                type="number"
                placeholder="例: 60"
                value={quickValues[action.id]?.humidity || ''}
                onChange={(e) => setQuickValues(prev => ({
                  ...prev,
                  [action.id]: { ...prev[action.id], humidity: e.target.value }
                }))}
              />
            </div>
          </div>
        )}

        {action.id === 'add_duration' && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="duration">作業時間（分）</Label>
              <Input
                id="duration"
                type="number"
                placeholder="例: 120"
                value={quickValues[action.id]?.duration || ''}
                onChange={(e) => setQuickValues(prev => ({
                  ...prev,
                  [action.id]: { ...prev[action.id], duration: e.target.value }
                }))}
              />
            </div>
            <div>
              <Label htmlFor="workers">作業人数</Label>
              <Input
                id="workers"
                type="number"
                placeholder="例: 2"
                value={quickValues[action.id]?.workers || ''}
                onChange={(e) => setQuickValues(prev => ({
                  ...prev,
                  [action.id]: { ...prev[action.id], workers: e.target.value }
                }))}
              />
            </div>
          </div>
        )}

        {action.id === 'add_harvest' && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="amount">収穫量</Label>
              <Input
                id="amount"
                type="number"
                placeholder="例: 15"
                value={quickValues[action.id]?.amount || ''}
                onChange={(e) => setQuickValues(prev => ({
                  ...prev,
                  [action.id]: { ...prev[action.id], amount: e.target.value }
                }))}
              />
            </div>
            <div>
              <Label htmlFor="unit">単位</Label>
              <select
                id="unit"
                className="w-full p-2 border rounded-md"
                value={quickValues[action.id]?.unit || ''}
                onChange={(e) => setQuickValues(prev => ({
                  ...prev,
                  [action.id]: { ...prev[action.id], unit: e.target.value }
                }))}
              >
                <option value="">選択してください</option>
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="個">個</option>
                <option value="束">束</option>
              </select>
            </div>
            <div>
              <Label htmlFor="quality">品質</Label>
              <select
                id="quality"
                className="w-full p-2 border rounded-md"
                value={quickValues[action.id]?.quality || ''}
                onChange={(e) => setQuickValues(prev => ({
                  ...prev,
                  [action.id]: { ...prev[action.id], quality: e.target.value }
                }))}
              >
                <option value="">選択してください</option>
                <option value="excellent">優秀</option>
                <option value="good">良好</option>
                <option value="average">平均</option>
                <option value="poor">不良</option>
              </select>
            </div>
            <div>
              <Label htmlFor="price">予想単価（円/単位）</Label>
              <Input
                id="price"
                type="number"
                placeholder="例: 300"
                value={quickValues[action.id]?.price || ''}
                onChange={(e) => setQuickValues(prev => ({
                  ...prev,
                  [action.id]: { ...prev[action.id], price: e.target.value }
                }))}
              />
            </div>
          </div>
        )}

        {action.id === 'add_notes' && (
          <div>
            <Label htmlFor="notes">メモ・気づき</Label>
            <textarea
              id="notes"
              className="w-full p-2 border rounded-md h-20"
              placeholder="例: 今日は虫が多かった。次回防虫対策を強化する。"
              value={quickValues[action.id]?.notes || ''}
              onChange={(e) => setQuickValues(prev => ({
                ...prev,
                [action.id]: { ...prev[action.id], notes: e.target.value }
              }))}
            />
          </div>
        )}

        <div className="flex gap-2">
          <Button 
            onClick={() => handleQuickSave(action.id)}
            className="flex-1"
          >
            追加する
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setIsDialogOpen(null)}
          >
            キャンセル
          </Button>
        </div>
      </div>
    </DialogContent>
  )

  const recommendedActions = getRecommendedActions()

  return (
    <div className="space-y-4">
      {/* 完了度に基づくメッセージ */}
      <div className="text-center">
        {completionRate < 50 ? (
          <p className="text-sm text-gray-600">
            📈 記録を充実させて、より詳細な分析を可能にしましょう
          </p>
        ) : completionRate < 80 ? (
          <p className="text-sm text-blue-600">
            🎯 あと少しで完璧な記録になります！
          </p>
        ) : (
          <p className="text-sm text-green-600">
            ✨ 素晴らしい！充実した記録が完成しました
          </p>
        )}
      </div>

      {/* 推奨アクション */}
      {recommendedActions.length > 0 && (
        <div>
          <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
            💡 おすすめの追加項目
            <Badge variant="outline" className="text-xs">
              {recommendedActions.length}個
            </Badge>
          </h4>
          
          <div className="grid grid-cols-2 gap-2">
            {recommendedActions.map(action => (
              <Dialog key={action.id} open={isDialogOpen === action.id}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-auto p-3 flex flex-col items-center gap-2 hover:shadow-md transition-all"
                    onClick={() => handleQuickAction(action.id)}
                  >
                    <div className={`p-2 rounded-full ${action.color} text-white`}>
                      {action.icon}
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-xs">{action.label}</div>
                      <div className="text-xs text-gray-500">{action.estimatedTime}秒</div>
                    </div>
                  </Button>
                </DialogTrigger>
                {renderQuickDialog(action)}
              </Dialog>
            ))}
          </div>
        </div>
      )}

      {/* 全アクション */}
      <div>
        <h4 className="font-medium text-sm mb-3">🚀 クイックアクション</h4>
        <div className="grid grid-cols-3 gap-2">
          {quickActions.map(action => (
            <Dialog key={action.id} open={isDialogOpen === action.id}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-2 flex flex-col items-center gap-1"
                  onClick={() => handleQuickAction(action.id)}
                >
                  <div className={`p-1.5 rounded-full ${action.color} text-white`}>
                    {action.icon}
                  </div>
                  <div className="text-xs font-medium">{action.label}</div>
                </Button>
              </DialogTrigger>
              {renderQuickDialog(action)}
            </Dialog>
          ))}
        </div>
      </div>
    </div>
  )
}

export default QuickActions