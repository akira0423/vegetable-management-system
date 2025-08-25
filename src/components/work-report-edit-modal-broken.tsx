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
      // エラーハンドリング（トースト通知など）
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditData(workReport) // 元のデータにリセット
    onCancel()
    onClose()
  }

  if (!workReport) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose} modal>
      <DialogContent className="!max-w-[1000px] !w-[99vw] max-h-[98vh] overflow-y-auto bg-white shadow-2xl border-0 p-0 gap-0" style={{maxWidth: '1000px', width: '99vw'}}>
        {/* アクセシビリティ用の非表示タイトル */}
        <DialogHeader className="sr-only">
          <DialogTitle>
            作業記録編集 - {getWorkTypeLabel(workReport.work_type)}
          </DialogTitle>
        </DialogHeader>
        
        {/* カスタムヘッダー */}
        <div className="bg-gradient-to-r from-emerald-50 via-blue-50 to-violet-50 p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
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
          
          {/* 完了度インジケーター */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <CompletionIndicator 
              workReport={editData} 
              showDetails={false} 
              size="md" 
            />
          </div>
        </div>

        <div className="p-6 bg-white">
          {/* タブナビゲーション */}
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

            {/* クイック補完タブ */}
            <TabsContent value="quick" className="mt-6">
              <QuickActions 
                workReport={editData}
                onQuickUpdate={handleQuickUpdate}
                completionRate={completionRate}
              />
            </TabsContent>

            {/* 詳細編集タブ */}
            <TabsContent value="detailed" className="mt-6 space-y-6">
          {/* 基本情報 */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
            <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-gray-600" />
              基本情報
            </h4>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>作業日</Label>
                  <Input
                    type="date"
                    value={editData.work_date || ''}
                    onChange={(e) => handleInputChange('work_date', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>作業種類</Label>
                  <Select 
                    value={editData.work_type || ''} 
                    onValueChange={(value) => handleInputChange('work_type', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="作業種類を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {WORK_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          <span className="flex items-center gap-2">
                            {type.icon} {type.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>作業内容</Label>
                <Textarea
                  value={editData.work_notes || ''}
                  onChange={(e) => handleInputChange('work_notes', e.target.value)}
                  placeholder="今日の作業内容を詳しく記録してください..."
                  rows={3}
                />
              </div>

              {/* 天候・環境情報 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>天候</Label>
                  <Select 
                    value={editData.weather || ''} 
                    onValueChange={(value) => handleInputChange('weather', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {WEATHER_OPTIONS.map(weather => (
                        <SelectItem key={weather.value} value={weather.value}>
                          {weather.icon} {weather.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>気温（℃）</Label>
                  <Input
                    type="number"
                    value={editData.temperature || ''}
                    onChange={(e) => handleInputChange('temperature', parseFloat(e.target.value) || undefined)}
                    placeholder="例: 25.3"
                    step="0.1"
                  />
                </div>

                <div className="space-y-2">
                  <Label>湿度（%）</Label>
                  <Input
                    type="number"
                    value={editData.humidity || ''}
                    onChange={(e) => handleInputChange('humidity', parseInt(e.target.value) || undefined)}
                    placeholder="例: 65"
                    min="0"
                    max="100"
                  />
                </div>
              </div>

              {/* 作業・人員情報 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>作業時間（分）</Label>
                  <Input
                    type="number"
                    value={editData.work_duration || ''}
                    onChange={(e) => handleInputChange('work_duration', parseInt(e.target.value) || undefined)}
                    placeholder="例: 120"
                    min="1"
                  />
                </div>

                <div className="space-y-2">
                  <Label>作業人数（人）</Label>
                  <Input
                    type="number"
                    value={editData.worker_count || ''}
                    onChange={(e) => handleInputChange('worker_count', parseInt(e.target.value) || undefined)}
                    placeholder="例: 2"
                    min="1"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 土壌情報記録セクション */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-amber-800 flex items-center">
                <Layers className="w-5 h-5 mr-2" />
                土壌情報記録
              </h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSoilInfoVisible(!soilInfoVisible)}
                className="flex items-center gap-2 text-amber-700 border-amber-300 hover:bg-amber-100"
              >
                <TestTube className="w-4 h-4" />
                詳細土壌状況記録
                {soilInfoVisible ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>
            
            {soilInfoVisible && (
              <div className="space-y-6 pt-4 border-t border-amber-200">
                {/* 基本土壌化学性 */}
                <div>
                  <h5 className="text-md font-medium text-amber-800 mb-3 flex items-center">
                    <TestTube className="w-4 h-4 mr-2" />
                    基本土壌化学性
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label className="text-amber-700">pH</Label>
                      <Input
                        type="number"
                        value={editData.soil_ph || ''}
                        onChange={(e) => handleInputChange('soil_ph', parseFloat(e.target.value) || undefined)}
                        placeholder="例: 6.5"
                        step="0.1"
                        min="3.0"
                        max="10.0"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-amber-700">EC（mS/cm）</Label>
                      <Input
                        type="number"
                        value={editData.soil_ec || ''}
                        onChange={(e) => handleInputChange('soil_ec', parseFloat(e.target.value) || undefined)}
                        placeholder="例: 0.8"
                        step="0.01"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-amber-700">CEC（me/100g）</Label>
                      <Input
                        type="number"
                        value={editData.cec || ''}
                        onChange={(e) => handleInputChange('cec', parseFloat(e.target.value) || undefined)}
                        placeholder="例: 25.0"
                        step="0.1"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-amber-700">塩基飽和度（%）</Label>
                      <Input
                        type="number"
                        value={editData.base_saturation || ''}
                        onChange={(e) => handleInputChange('base_saturation', parseFloat(e.target.value) || undefined)}
                        placeholder="例: 85.0"
                        step="0.1"
                        min="0"
                        max="100"
                      />
                    </div>
                  </div>
                </div>

                {/* 交換性塩基類 */}
                <div>
                  <h5 className="text-md font-medium text-amber-800 mb-3">交換性塩基類</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-amber-700">交換性石灰（mg/100g）</Label>
                      <Input
                        type="number"
                        value={editData.exchangeable_calcium || ''}
                        onChange={(e) => handleInputChange('exchangeable_calcium', parseFloat(e.target.value) || undefined)}
                        placeholder="例: 350"
                        step="1"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-amber-700">交換性苦土（mg/100g）</Label>
                      <Input
                        type="number"
                        value={editData.exchangeable_magnesium || ''}
                        onChange={(e) => handleInputChange('exchangeable_magnesium', parseFloat(e.target.value) || undefined)}
                        placeholder="例: 60"
                        step="1"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-amber-700">交換性加里（mg/100g）</Label>
                      <Input
                        type="number"
                        value={editData.exchangeable_potassium || ''}
                        onChange={(e) => handleInputChange('exchangeable_potassium', parseFloat(e.target.value) || undefined)}
                        placeholder="例: 25"
                        step="1"
                      />
                    </div>
                  </div>
                </div>

                {/* 土壌観察メモ */}
                <div className="space-y-2">
                  <Label className="text-amber-700">土壌観察メモ</Label>
                  <Textarea
                    value={editData.soil_notes || ''}
                    onChange={(e) => handleInputChange('soil_notes', e.target.value)}
                    placeholder="土壌の色、質感、構造、根張りの状況、土壌検査機関の所見など..."
                    rows={3}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 収穫情報（収穫作業の場合） */}
          {editData.work_type === 'harvesting' && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5">
              <h4 className="text-lg font-semibold text-green-800 mb-4 flex items-center">
                <Sprout className="w-5 h-5 mr-2" />
                収穫情報
              </h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-green-700">収穫量</Label>
                  <Input
                    type="number"
                    value={editData.harvest_amount || ''}
                    onChange={(e) => handleInputChange('harvest_amount', parseFloat(e.target.value) || undefined)}
                    placeholder="例: 25.5"
                    step="0.1"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-green-700">収穫単位</Label>
                  <Select 
                    value={editData.harvest_unit || 'kg'} 
                    onValueChange={(value) => handleInputChange('harvest_unit', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="g">g</SelectItem>
                      <SelectItem value="個">個</SelectItem>
                      <SelectItem value="束">束</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-green-700">想定売上</Label>
                  <Input
                    type="number"
                    value={editData.expected_revenue || ''}
                    onChange={(e) => handleInputChange('expected_revenue', parseInt(e.target.value) || undefined)}
                    placeholder="例: 15000"
                  />
                </div>
              </div>
            </div>
          )}

            
            {/* 完了状況タブ */}
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
          
          {/* 保存ボタンエリア */}
          <div className="flex justify-center gap-3 mt-8 pt-6 border-t border-gray-200 bg-gray-50 -mx-6 px-6 pb-6 rounded-b-lg">
            <Button 
              variant="outline" 
              onClick={handleCancel}
              className="border-gray-300 hover:bg-gray-100 px-6 py-3 text-base"
              size="lg"
            >
              <X className="w-5 h-5 mr-2" />
              キャンセル
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={saving}
              size="lg"
              className="bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 px-8 py-3 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5 mr-2" />
              {saving ? '保存中...' : '変更を保存'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}