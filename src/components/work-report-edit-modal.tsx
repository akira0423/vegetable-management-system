'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import CompletionIndicator from '@/components/ui/completion-indicator'
import QuickActions from '@/components/ui/quick-actions'
import { calculateCompletionRate, getNextSuggestedAction } from '@/lib/completion-calculator'
import { 
  Save, 
  X,
  Edit,
  Calendar,
  Sprout,
  Beaker,
  Droplets,
  TrendingUp,
  MapPin,
  Clock,
  ChevronDown,
  ChevronUp,
  Layers,
  TestTube,
  Camera
} from 'lucide-react'
import { format } from 'date-fns'

interface WorkReportEditModalProps {
  workReport: any
  isOpen: boolean
  onClose: () => void
  onSave: (updatedReport: any) => Promise<void>
  onCancel: () => void
}

const WORK_TYPES = [
  { value: 'seeding', label: '播種・育苗', icon: '🌱' },
  { value: 'planting', label: '定植', icon: '🪴' },
  { value: 'fertilizing', label: '施肥', icon: '💊' },
  { value: 'watering', label: '灌水', icon: '💧' },
  { value: 'weeding', label: '除草', icon: '🌿' },
  { value: 'pruning', label: '整枝・摘芽', icon: '✂️' },
  { value: 'harvesting', label: '収穫', icon: '🥬' },
  { value: 'other', label: 'その他', icon: '📝' }
]

const getWorkTypeLabel = (workType: string) => {
  const workTypeObj = WORK_TYPES.find(type => type.value === workType)
  return workTypeObj ? workTypeObj.label : workType
}

const WEATHER_OPTIONS = [
  { value: 'sunny', label: '晴れ', icon: '☀️' },
  { value: 'cloudy', label: '曇り', icon: '☁️' },
  { value: 'rainy', label: '雨', icon: '🌧️' },
  { value: 'windy', label: '風', icon: '💨' }
]

export default function WorkReportEditModal({
  workReport,
  isOpen,
  onClose,
  onSave,
  onCancel
}: WorkReportEditModalProps) {
  const [editData, setEditData] = useState(workReport || {})
  const [saving, setSaving] = useState(false)
  const [soilInfoVisible, setSoilInfoVisible] = useState(false)
  const [vegetableInfo, setVegetableInfo] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('quick')
  const [completionRate, setCompletionRate] = useState(0)

  useEffect(() => {
    if (workReport) {
      setEditData(workReport)
      // 既存の土壌データがある場合は展開表示
      const hasSoilData = workReport.soil_ph || workReport.soil_ec || workReport.exchangeable_calcium
      setSoilInfoVisible(hasSoilData)
      // 完了度を計算
      setCompletionRate(calculateCompletionRate(workReport))
    }
  }, [workReport])

  // 編集データが変更されたら完了度を再計算
  useEffect(() => {
    if (editData) {
      setCompletionRate(calculateCompletionRate(editData))
    }
  }, [editData])

  useEffect(() => {
    if (workReport?.vegetable_id) {
      // 野菜情報を取得（実際のAPIコールに置き換える）
      setVegetableInfo({
        name: 'トマト',
        variety: '桃太郎',
        plot_name: 'A区画-1'
      })
    }
  }, [workReport?.vegetable_id])

  const handleInputChange = (field: string, value: any) => {
    setEditData((prev: any) => ({
      ...prev,
      [field]: value
    }))
  }

  const handleQuickUpdate = (field: string, value: any) => {
    setEditData((prev: any) => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      await onSave(editData)
      onClose()
    } catch (error) {
      console.error('保存エラー:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditData(workReport)
    onCancel()
    onClose()
  }

  if (!workReport) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose} modal>
      <DialogContent className="!max-w-[1000px] !w-[99vw] max-h-[98vh] overflow-y-auto bg-white shadow-2xl border-0 p-0 gap-0" style={{maxWidth: '1000px', width: '99vw'}}>
        <DialogHeader className="sr-only">
          <DialogTitle>
            作業記録編集 - {getWorkTypeLabel(workReport.work_type)}
          </DialogTitle>
        </DialogHeader>
        
        <div className="bg-gradient-to-r from-emerald-50 via-blue-50 to-violet-50 p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-md border border-gray-200">
                <Edit className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-2xl font-bold text-gray-900">実績記録を編集</h2>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    {vegetableInfo?.name || 'Unknown'}
                  </Badge>
                </div>
                <div className="text-sm text-gray-600 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  {format(new Date(workReport.work_date), 'yyyy年MM月dd日')}の記録を編集中
                </div>
                <div className="text-xs text-blue-600">
                  {getNextSuggestedAction(editData)}
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={handleCancel}
                className="border-gray-300 hover:bg-gray-100"
                size="lg"
              >
                <X className="w-4 h-4 mr-2" />
                キャンセル
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={saving} 
                className="bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                size="lg"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? '保存中...' : '保存する'}
              </Button>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-200">
            <CompletionIndicator 
              workReport={editData} 
              showDetails={false} 
              size="md" 
            />
          </div>
        </div>

        <div className="p-6 bg-white">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="quick" className="flex items-center gap-2">
                <span>⚡</span>
                <span>クイック補完</span>
              </TabsTrigger>
              <TabsTrigger value="detailed" className="flex items-center gap-2">
                <span>📊</span>
                <span>詳細編集</span>
              </TabsTrigger>
              <TabsTrigger value="analysis" className="flex items-center gap-2">
                <span>📈</span>
                <span>完了状況</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="quick" className="mt-6">
              <QuickActions 
                workReport={editData}
                onQuickUpdate={handleQuickUpdate}
                completionRate={completionRate}
              />
            </TabsContent>

            <TabsContent value="detailed" className="mt-6 space-y-6">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
                <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <Calendar className="w-5 h-5 mr-2 text-gray-600" />
                  基本情報
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="work_date" className="text-sm font-medium text-gray-700">作業日</Label>
                    <Input
                      id="work_date"
                      type="date"
                      value={editData.work_date || ''}
                      onChange={(e) => handleInputChange('work_date', e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="work_type" className="text-sm font-medium text-gray-700">作業種類</Label>
                    <Select value={editData.work_type || ''} onValueChange={(value) => handleInputChange('work_type', value)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="作業種類を選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {WORK_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <span>{type.icon}</span>
                              <span>{type.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="weather" className="text-sm font-medium text-gray-700">天候</Label>
                    <Select value={editData.weather || ''} onValueChange={(value) => handleInputChange('weather', value)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="天候を選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {WEATHER_OPTIONS.map((weather) => (
                          <SelectItem key={weather.value} value={weather.value}>
                            <div className="flex items-center gap-2">
                              <span>{weather.icon}</span>
                              <span>{weather.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="temperature" className="text-sm font-medium text-gray-700">気温 (℃)</Label>
                    <Input
                      id="temperature"
                      type="number"
                      value={editData.temperature || ''}
                      onChange={(e) => handleInputChange('temperature', parseFloat(e.target.value) || null)}
                      className="mt-1"
                      placeholder="例: 25"
                    />
                  </div>

                  <div>
                    <Label htmlFor="humidity" className="text-sm font-medium text-gray-700">湿度 (%)</Label>
                    <Input
                      id="humidity"
                      type="number"
                      value={editData.humidity || ''}
                      onChange={(e) => handleInputChange('humidity', parseFloat(e.target.value) || null)}
                      className="mt-1"
                      placeholder="例: 60"
                    />
                  </div>

                  <div>
                    <Label htmlFor="work_duration" className="text-sm font-medium text-gray-700">作業時間 (分)</Label>
                    <Input
                      id="work_duration"
                      type="number"
                      value={editData.work_duration || ''}
                      onChange={(e) => handleInputChange('work_duration', parseFloat(e.target.value) || null)}
                      className="mt-1"
                      placeholder="例: 120"
                    />
                  </div>

                  <div>
                    <Label htmlFor="worker_count" className="text-sm font-medium text-gray-700">作業人数</Label>
                    <Input
                      id="worker_count"
                      type="number"
                      value={editData.worker_count || ''}
                      onChange={(e) => handleInputChange('worker_count', parseInt(e.target.value) || null)}
                      className="mt-1"
                      placeholder="例: 2"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <Label htmlFor="work_notes" className="text-sm font-medium text-gray-700">作業メモ</Label>
                  <Textarea
                    id="work_notes"
                    value={editData.work_notes || ''}
                    onChange={(e) => handleInputChange('work_notes', e.target.value)}
                    className="mt-1"
                    rows={3}
                    placeholder="作業の詳細や気づいたことを記録してください"
                  />
                </div>
              </div>

              {(editData.work_type === 'harvesting' || editData.harvest_amount) && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                  <h4 className="text-lg font-semibold text-green-800 mb-4 flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2" />
                    収穫・経済情報
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="harvest_amount" className="text-sm font-medium text-gray-700">収穫量</Label>
                      <Input
                        id="harvest_amount"
                        type="number"
                        value={editData.harvest_amount || ''}
                        onChange={(e) => handleInputChange('harvest_amount', parseFloat(e.target.value) || null)}
                        className="mt-1"
                        placeholder="例: 15"
                      />
                    </div>

                    <div>
                      <Label htmlFor="harvest_unit" className="text-sm font-medium text-gray-700">単位</Label>
                      <Select value={editData.harvest_unit || ''} onValueChange={(value) => handleInputChange('harvest_unit', value)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="単位を選択" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="g">g</SelectItem>
                          <SelectItem value="個">個</SelectItem>
                          <SelectItem value="束">束</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="harvest_quality" className="text-sm font-medium text-gray-700">品質</Label>
                      <Select value={editData.harvest_quality || ''} onValueChange={(value) => handleInputChange('harvest_quality', value)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="品質を選択" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="excellent">優秀</SelectItem>
                          <SelectItem value="good">良好</SelectItem>
                          <SelectItem value="average">平均</SelectItem>
                          <SelectItem value="poor">不良</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="expected_price" className="text-sm font-medium text-gray-700">期待価格 (円)</Label>
                      <Input
                        id="expected_price"
                        type="number"
                        value={editData.expected_price || ''}
                        onChange={(e) => handleInputChange('expected_price', parseFloat(e.target.value) || null)}
                        className="mt-1"
                        placeholder="例: 5000"
                      />
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="analysis" className="mt-6">
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-lg font-semibold mb-2">記録の完成度</h3>
                  <p className="text-gray-600 mb-6">
                    より充実した記録にすることで、詳細な分析と改善提案が可能になります
                  </p>
                </div>
                
                <CompletionIndicator 
                  workReport={editData} 
                  showDetails={true} 
                  size="lg" 
                />
                
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
                    💡 記録充実のメリット
                  </h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• 作業効率の分析・改善提案</li>
                    <li>• 収益性の詳細な把握</li>
                    <li>• 天候と収穫量の相関分析</li>
                    <li>• 年間を通した作業計画の最適化</li>
                  </ul>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}