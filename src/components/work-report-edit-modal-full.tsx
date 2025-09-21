'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import PhotoUpload from '@/components/photo-upload'
import WorkAccountingInput from '@/components/work-accounting-input'
import { useCurrentUser } from '@/hooks/use-current-user'

interface WorkReportEditModalFullProps {
  workReport: any
  isOpen: boolean
  onClose: () => void
  onSave: (updatedReport: any) => Promise<void>
  onCancel: () => void
}

const WORK_TYPES = [
  { value: 'seeding', label: '播種・育苗', icon: Sprout },
  { value: 'planting', label: '定植', icon: Sprout },
  { value: 'fertilizing', label: '施肥', icon: Beaker },
  { value: 'watering', label: '灌水', icon: Droplets },
  { value: 'weeding', label: '除草', icon: Sprout },
  { value: 'pruning', label: '整枝・摘芽', icon: Sprout },
  { value: 'harvesting', label: '収穫', icon: TrendingUp },
  { value: 'other', label: 'その他', icon: Edit }
]

const WEATHER_OPTIONS = [
  { value: 'sunny', label: '晴れ', icon: '☀️' },
  { value: 'cloudy', label: '曇り', icon: '☁️' },
  { value: 'rainy', label: '雨', icon: '🌧️' },
  { value: 'windy', label: '風', icon: '💨' }
]

export default function WorkReportEditModalFull({
  workReport,
  isOpen,
  onClose,
  onSave,
  onCancel
}: WorkReportEditModalFullProps) {
  const { user } = useCurrentUser()
  const [editData, setEditData] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [soilInfoVisible, setSoilInfoVisible] = useState(false)
  const [vegetableInfo, setVegetableInfo] = useState<any>(null)
  const [showAbnormalValueModal, setShowAbnormalValueModal] = useState(false)
  const [abnormalValues, setAbnormalValues] = useState<Array<{field: string, label: string, value: number, normalRange: string, unit: string}>>([])
  const [pendingData, setPendingData] = useState<any>(null)

  // workReportの初期設定は一度だけ実行
  useEffect(() => {
    if (workReport && isOpen) {
      setEditData({ ...workReport })
      // 既存の土壌データがある場合は展開表示
      const hasSoilData = workReport.soil_ph || workReport.soil_ec || workReport.exchangeable_calcium
      setSoilInfoVisible(!!hasSoilData)
      
      // 野菜情報も一緒に設定
      if (workReport.vegetable_id) {
        setVegetableInfo({
          name: 'トマト',
          variety: '桃太郎',
          plot_name: 'A区画-1'
        })
      }
    }
  }, [workReport?.id, isOpen]) // IDとisOpenだけに依存

  const handleInputChange = useCallback((field: string, value: any) => {
    setEditData((prev: any) => ({
      ...prev,
      [field]: value
    }))
  }, [])

  const handlePhotosChange = useCallback((photos: any) => {
    handleInputChange('photos', photos)
  }, [handleInputChange])

  const handleAccountingDataChange = useCallback((data: any) => {
    setEditData((prev: any) => ({
      ...prev,
      income_items: data.income_items,
      expense_items: data.expense_items,
      income_total: data.income_total,
      expense_total: data.expense_total,
      net_income: data.net_income
    }))
  }, [])

  const handleSave = async () => {
    try {
      setSaving(true)
      
      // 異常値検知システム
      const detectAbnormalValues = (data: any) => {
        const abnormalities: Array<{field: string, label: string, value: number, normalRange: string, unit: string}> = []
        
        const checkValue = (field: string, label: string, value: any, min: number, max: number, unit: string = '') => {
          if (value !== null && value !== undefined && (value < min || value > max)) {
            abnormalities.push({
              field,
              label,
              value: Number(value),
              normalRange: `${min}～${max}`,
              unit
            })
          }
        }
        
        // 基本環境データ
        checkValue('temperature', '気温', data.temperature, -20, 50, '℃')
        checkValue('humidity', '湿度', data.humidity, 0, 100, '%')
        // 作業時間と作業者数のチェックを削除（農家によって大きく異なるため）
        // checkValue('work_duration', '作業時間', data.work_duration, 0, 480, '分')
        // checkValue('worker_count', '作業者数', data.worker_count, 1, 20, '人')
        
        // 土壌データ
        checkValue('soil_ph', 'pH', data.soil_ph, 3, 12, '')
        checkValue('soil_ec', 'EC', data.soil_ec, 0, 5, 'mS/cm')
        checkValue('base_saturation', '塩基飽和度', data.base_saturation, 0, 100, '%')
        checkValue('cec', 'CEC', data.cec, 0, 80, 'me/100g')
        checkValue('exchangeable_calcium', '交換性Ca', data.exchangeable_calcium, 0, 800, 'mg/100g')
        checkValue('exchangeable_magnesium', '交換性Mg', data.exchangeable_magnesium, 0, 300, 'mg/100g')
        checkValue('exchangeable_potassium', '交換性K', data.exchangeable_potassium, 0, 200, 'mg/100g')
        checkValue('available_phosphorus', '可給態リン酸', data.available_phosphorus, 0, 500, 'mg/100g')
        checkValue('humus_content', '腐植含量', data.humus_content, 0, 20, '%')
        
        return abnormalities
      }
      
      // 安全な値に修正
      const validateAllData = (data: any) => {
        const validatedData = { ...data }
        
        // 温度: -20～50℃ (安全範囲)
        if (validatedData.temperature !== null && validatedData.temperature !== undefined) {
          validatedData.temperature = Math.max(-20, Math.min(50, validatedData.temperature))
        }
        
        // 湿度: 0-100%
        if (validatedData.humidity !== null && validatedData.humidity !== undefined) {
          validatedData.humidity = Math.max(0, Math.min(100, validatedData.humidity))
        }
        
        // 作業時間: 制限なし（農家によって大きく異なるため）
        // 最小値0のみチェック（負の値は防ぐ）
        if (validatedData.work_duration !== null && validatedData.work_duration !== undefined) {
          validatedData.work_duration = Math.max(0, validatedData.work_duration)
        }

        // 作業者数: 制限なし（農家規模によって異なるため）
        // 最小値1のみチェック（0人は防ぐ）
        if (validatedData.worker_count !== null && validatedData.worker_count !== undefined) {
          validatedData.worker_count = Math.max(1, validatedData.worker_count)
        }
        
        // 土壌データ検証（現実的な範囲）
        if (validatedData.soil_ph !== null && validatedData.soil_ph !== undefined) {
          validatedData.soil_ph = Math.max(3, Math.min(12, validatedData.soil_ph))
        }
        
        if (validatedData.soil_ec !== null && validatedData.soil_ec !== undefined) {
          validatedData.soil_ec = Math.max(0, Math.min(5, validatedData.soil_ec))
        }
        
        if (validatedData.base_saturation !== null && validatedData.base_saturation !== undefined) {
          validatedData.base_saturation = Math.max(0, Math.min(100, validatedData.base_saturation))
        }
        
        if (validatedData.cec !== null && validatedData.cec !== undefined) {
          validatedData.cec = Math.max(0, Math.min(80, validatedData.cec))
        }
        
        // 交換性成分の現実的な上限
        if (validatedData.exchangeable_calcium !== null && validatedData.exchangeable_calcium !== undefined) {
          validatedData.exchangeable_calcium = Math.max(0, Math.min(800, validatedData.exchangeable_calcium))
        }
        
        if (validatedData.exchangeable_magnesium !== null && validatedData.exchangeable_magnesium !== undefined) {
          validatedData.exchangeable_magnesium = Math.max(0, Math.min(300, validatedData.exchangeable_magnesium))
        }
        
        if (validatedData.exchangeable_potassium !== null && validatedData.exchangeable_potassium !== undefined) {
          validatedData.exchangeable_potassium = Math.max(0, Math.min(200, validatedData.exchangeable_potassium))
        }
        
        if (validatedData.available_phosphorus !== null && validatedData.available_phosphorus !== undefined) {
          validatedData.available_phosphorus = Math.max(0, Math.min(500, validatedData.available_phosphorus))
        }
        
        if (validatedData.humus_content !== null && validatedData.humus_content !== undefined) {
          validatedData.humus_content = Math.max(0, Math.min(20, validatedData.humus_content))
        }
        
        // その他の土壌成分
        const otherComponents = [
          'phosphorus_absorption', 'available_silica', 'free_iron_oxide', 
          'ammonium_nitrogen', 'nitrate_nitrogen', 'calcium_magnesium_ratio', 
          'magnesium_potassium_ratio'
        ]
        
        otherComponents.forEach(component => {
          if (validatedData[component] !== null && validatedData[component] !== undefined) {
            validatedData[component] = Math.max(0, Math.min(500, validatedData[component]))
          }
        })
        
        return validatedData
      }
      
      // 完全版：全フィールド保存可能
      const completeData = {
        id: editData.id,
        work_date: editData.work_date,
        work_type: editData.work_type,
        work_notes: editData.work_notes,
        weather: editData.weather,
        temperature: editData.temperature,
        humidity: editData.humidity,
        work_duration: editData.work_duration,
        // work_durationからduration_hoursを自動計算
        duration_hours: editData.work_duration ? (editData.work_duration / 60) : null,
        worker_count: editData.worker_count,
        work_amount: editData.work_amount,
        work_unit: editData.work_unit,
        fertilizer_type: editData.fertilizer_type,
        fertilizer_amount: editData.fertilizer_amount,
        fertilizer_unit: editData.fertilizer_unit,
        harvest_amount: editData.harvest_amount,
        harvest_unit: editData.harvest_unit,
        harvest_quality: editData.harvest_quality,
        expected_price: editData.expected_price,
        expected_revenue: editData.expected_revenue,
        // 土壌情報
        soil_ph: editData.soil_ph,
        soil_ec: editData.soil_ec,
        phosphorus_absorption: editData.phosphorus_absorption,
        available_phosphorus: editData.available_phosphorus,
        cec: editData.cec,
        exchangeable_calcium: editData.exchangeable_calcium,
        exchangeable_magnesium: editData.exchangeable_magnesium,
        exchangeable_potassium: editData.exchangeable_potassium,
        base_saturation: editData.base_saturation,
        calcium_magnesium_ratio: editData.calcium_magnesium_ratio,
        magnesium_potassium_ratio: editData.magnesium_potassium_ratio,
        available_silica: editData.available_silica,
        free_iron_oxide: editData.free_iron_oxide,
        humus_content: editData.humus_content,
        ammonium_nitrogen: editData.ammonium_nitrogen,
        nitrate_nitrogen: editData.nitrate_nitrogen,
        manganese: editData.manganese,
        boron: editData.boron,
        soil_notes: editData.soil_notes,
        // 会計データ
        income_items: editData.income_items,
        expense_items: editData.expense_items,
        income_total: editData.income_total,
        expense_total: editData.expense_total,
        net_income: editData.net_income,
        // 写真
        photos: editData.photos,
        updated_at: new Date().toISOString()
      }
      
      // 異常値をチェック
      const abnormalities = detectAbnormalValues(completeData)
      
      if (abnormalities.length > 0) {
        // 異常値が見つかった場合は確認モーダルを表示
        setAbnormalValues(abnormalities)
        setPendingData(completeData)
        setShowAbnormalValueModal(true)
        setSaving(false)
        return
      }
      
      // 異常値がない場合は通常の保存処理
      const validatedData = validateAllData(completeData)
      
      // nullや未定義値を除外
      const filteredData = Object.fromEntries(
        Object.entries(validatedData).filter(([key, value]) => value !== null && value !== undefined && value !== '')
      )
      
      await onSave(filteredData)
      
      // 会計データがある場合は別途保存
      if (editData.income_items || editData.expense_items) {
        try {
          const response = await fetch('/api/work-accounting', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              work_report_id: editData.id,
              company_id: editData.company_id || user?.company_id,
              work_type: editData.work_type,
              income_items: editData.income_items || [],
              expense_items: editData.expense_items || []
            })
          })
          
          if (!response.ok) {
            
          } else {
            
          }
        } catch (error) {
          
        }
      }
      
      onClose()
    } catch (error) {
      
    } finally {
      setSaving(false)
    }
  }


  // 異常値確認のキャンセル
  const handleCancelAbnormalValues = () => {
    setShowAbnormalValueModal(false)
    setPendingData(null)
    setAbnormalValues([])
    setSaving(false)
  }

  const handleCancel = () => {
    // 元のデータで復元
    if (workReport) {
      setEditData({ ...workReport })
    }
    onCancel()
    onClose()
  }

  if (!workReport) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose} modal>
      <DialogContent className="w-[90vw] min-w-[1200px] max-w-[1280px] max-h-[80vh] overflow-y-auto bg-white shadow-2xl border-0 p-0 gap-0">
        <DialogHeader className="sr-only">
          <DialogTitle>
            実績記録を編集 - {workReport.work_type}
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
                  全ての情報を入力・編集して記録を完成させましょう
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
        </div>

        <div className="p-6 bg-white space-y-6">
          {/* 基本情報セクション */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
            <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-gray-600" />
              基本情報
            </h4>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="work_date">作業日 *</Label>
                  <Input
                    id="work_date"
                    type="date"
                    value={editData.work_date || ''}
                    onChange={(e) => handleInputChange('work_date', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="work_type">作業種類 *</Label>
                  <Select 
                    value={editData.work_type || ''} 
                    onValueChange={(value) => handleInputChange('work_type', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="作業種類を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {WORK_TYPES.map(type => {
                        const Icon = type.icon
                        return (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <Icon className="w-4 h-4" />
                              {type.label}
                            </div>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="work_notes">作業内容・備考</Label>
                <Textarea
                  id="work_notes"
                  value={editData.work_notes || ''}
                  onChange={(e) => handleInputChange('work_notes', e.target.value)}
                  placeholder="今日の作業内容を詳しく記録してください..."
                  rows={3}
                />
              </div>

              {/* 天候・環境情報 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="weather">天候</Label>
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
                  <Label htmlFor="temperature">気温（℃）</Label>
                  <Input
                    id="temperature"
                    type="number"
                    value={editData.temperature || ''}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value)
                      // -50.0 ～ 50.0 の範囲に制限（現実的な気温範囲）
                      if (!isNaN(value) && value >= -50.0 && value <= 50.0) {
                        handleInputChange('temperature', value)
                      } else if (e.target.value === '') {
                        handleInputChange('temperature', undefined)
                      }
                    }}
                    placeholder="例: 25.3"
                    step="0.1"
                    min="-50"
                    max="50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="humidity">湿度（%）</Label>
                  <Input
                    id="humidity"
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
                  <Label htmlFor="work_duration">作業時間（分）</Label>
                  <Input
                    id="work_duration"
                    type="number"
                    value={editData.work_duration || ''}
                    onChange={(e) => handleInputChange('work_duration', parseInt(e.target.value) || undefined)}
                    placeholder="例: 120"
                    min="1"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="worker_count">作業人数（人）</Label>
                  <Input
                    id="worker_count"
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
                      <Label className="text-amber-700">りん酸吸収係数</Label>
                      <Input
                        type="number"
                        value={editData.phosphorus_absorption || ''}
                        onChange={(e) => handleInputChange('phosphorus_absorption', parseFloat(e.target.value) || undefined)}
                        placeholder="例: 800"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-amber-700">有効態りん酸（mg/100g）</Label>
                      <Input
                        type="number"
                        value={editData.available_phosphorus || ''}
                        onChange={(e) => handleInputChange('available_phosphorus', parseFloat(e.target.value) || undefined)}
                        placeholder="例: 45"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-amber-700">CEC（me/100g）</Label>
                      <Input
                        type="number"
                        value={editData.cec || ''}
                        onChange={(e) => handleInputChange('cec', parseFloat(e.target.value) || undefined)}
                        placeholder="例: 15"
                        step="0.1"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-amber-700">交換性石灰（mg/100g）</Label>
                      <Input
                        type="number"
                        value={editData.exchangeable_calcium || ''}
                        onChange={(e) => handleInputChange('exchangeable_calcium', parseFloat(e.target.value) || undefined)}
                        placeholder="例: 250"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-amber-700">交換性苦土（mg/100g）</Label>
                      <Input
                        type="number"
                        value={editData.exchangeable_magnesium || ''}
                        onChange={(e) => handleInputChange('exchangeable_magnesium', parseFloat(e.target.value) || undefined)}
                        placeholder="例: 40"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-amber-700">交換性加里（mg/100g）</Label>
                      <Input
                        type="number"
                        value={editData.exchangeable_potassium || ''}
                        onChange={(e) => handleInputChange('exchangeable_potassium', parseFloat(e.target.value) || undefined)}
                        placeholder="例: 30"
                      />
                    </div>
                  </div>
                </div>

                {/* 追加土壌成分 */}
                <div>
                  <h5 className="text-md font-medium text-amber-800 mb-3 flex items-center">
                    <Beaker className="w-4 h-4 mr-2" />
                    詳細土壌成分
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-amber-700">塩基飽和度（%）</Label>
                      <Input
                        type="number"
                        value={editData.base_saturation || ''}
                        onChange={(e) => handleInputChange('base_saturation', parseFloat(e.target.value) || undefined)}
                        placeholder="例: 85"
                        step="0.1"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-amber-700">石灰苦土比</Label>
                      <Input
                        type="number"
                        value={editData.calcium_magnesium_ratio || ''}
                        onChange={(e) => handleInputChange('calcium_magnesium_ratio', parseFloat(e.target.value) || undefined)}
                        placeholder="例: 6.2"
                        step="0.1"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-amber-700">苦土加里比</Label>
                      <Input
                        type="number"
                        value={editData.magnesium_potassium_ratio || ''}
                        onChange={(e) => handleInputChange('magnesium_potassium_ratio', parseFloat(e.target.value) || undefined)}
                        placeholder="例: 1.3"
                        step="0.1"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-amber-700">有効態けい酸（mg/100g）</Label>
                      <Input
                        type="number"
                        value={editData.available_silica || ''}
                        onChange={(e) => handleInputChange('available_silica', parseFloat(e.target.value) || undefined)}
                        placeholder="例: 12"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-amber-700">遊離酸化鉄（%）</Label>
                      <Input
                        type="number"
                        value={editData.free_iron_oxide || ''}
                        onChange={(e) => handleInputChange('free_iron_oxide', parseFloat(e.target.value) || undefined)}
                        placeholder="例: 2.5"
                        step="0.1"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-amber-700">腐植含量（%）</Label>
                      <Input
                        type="number"
                        value={editData.humus_content || ''}
                        onChange={(e) => handleInputChange('humus_content', parseFloat(e.target.value) || undefined)}
                        placeholder="例: 3.2"
                        step="0.1"
                      />
                    </div>
                  </div>
                </div>

                {/* 土壌メモ */}
                <div className="space-y-2">
                  <Label className="text-amber-700">土壌観察メモ</Label>
                  <Textarea
                    value={editData.soil_notes || ''}
                    onChange={(e) => handleInputChange('soil_notes', e.target.value)}
                    placeholder="土壌の色、質感、水はけ、根の状態など気づいたことを記録してください..."
                    rows={3}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 収入・支出記録セクション */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-5">
            <h4 className="text-lg font-semibold text-green-800 mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2" />
              収入・支出記録 （実績会計データ）
            </h4>
            
            {editData.id && (
              <WorkAccountingInput
                workType={editData.work_type || ''}
                companyId={editData.company_id || user?.company_id}
                workReportId={editData.id || editData.report_id}
                onDataChange={handleAccountingDataChange}
              />
            )}
          </div>

          {/* 現場写真セクション */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <h4 className="text-lg font-semibold text-blue-800 mb-4 flex items-center">
              <Camera className="w-5 h-5 mr-2" />
              現場写真
            </h4>
            
            
            {editData && (
              <PhotoUpload
                onPhotosChange={handlePhotosChange}
                maxPhotos={10}
                existingPhotos={editData.photos || []}
              />
            )}
          </div>
        </div>
      </DialogContent>

      {/* 異常値確認モーダル */}
      <Dialog open={showAbnormalValueModal} onOpenChange={() => {}} modal>
        <DialogContent className="max-w-2xl bg-white border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-red-600 flex items-center gap-2">
              ⚠️ 異常値が検出されました
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-gray-700">
              以下の項目で通常の範囲を超える値が入力されています。<br/>
              単位間違いや入力ミスがないかご確認ください。
            </p>
            
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-semibold text-red-800 mb-3">⚠️ 検出された異常値:</h3>
              <div className="space-y-2">
                {abnormalValues.map((item, index) => (
                  <div key={index} className="flex justify-between items-center bg-white p-3 rounded border border-red-200">
                    <div>
                      <span className="font-medium text-red-700">{item.label}</span>
                      <div className="text-sm text-gray-600">
                        通常範囲: {item.normalRange}{item.unit}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-red-600">
                        {item.value}{item.unit}
                      </div>
                      <div className="text-sm text-red-500">
                        ←異常値
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 mb-2">💡 よくある原因:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• 単位の間違い（mg/100g と mg/kg など）</li>
                <li>• 小数点の位置ミス（6.5 と 65 など）</li>
                <li>• 測定機器の表示単位の違い</li>
                <li>• 別の成分の値を間違えて入力</li>
              </ul>
            </div>
          </div>
          
          <div className="flex justify-center pt-4">
            <Button
              onClick={handleCancelAbnormalValues}
              variant="outline"
              size="lg"
              className="px-8"
            >
              ❌ 入力画面に戻って修正する
            </Button>
          </div>
          
          <div className="text-xs text-red-600 text-center mt-4 font-medium">
            異常値が含まれている場合は保存できません。正しい値を入力してください。
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}