'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  Calendar, 
  Save, 
  Camera,
  FileText,
  Sprout,
  Beaker,
  Droplets,
  TrendingUp,
  MapPin,
  Clock,
  X
} from 'lucide-react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import PhotoUpload from '@/components/photo-upload'
import { analyticsDataSync } from '@/lib/analytics-data-sync'

interface WorkReport {
  id?: string
  vegetable_id: string
  work_date: string
  work_type: 'seeding' | 'planting' | 'fertilizing' | 'watering' | 'weeding' | 'pruning' | 'harvesting' | 'other'
  work_notes?: string
  
  // 量・単位（播種・育苗、定植など）
  work_amount?: number
  work_unit?: 'kg' | 'g' | '粒' | '株' | 'L' | 'ml' | 'm2'
  
  // 肥料データ
  fertilizer_type?: string
  fertilizer_amount?: number
  fertilizer_unit?: 'kg' | 'g' | 'L' | 'ml'
  
  // 土壌データ
  soil_ph?: number
  soil_moisture?: number
  soil_temperature?: number
  
  // 収穫データ
  harvest_amount?: number
  harvest_unit?: 'kg' | 'g' | '個' | '束'
  harvest_quality?: 'excellent' | 'good' | 'average' | 'poor'
  expected_price?: number // 想定単価
  expected_revenue?: number // 想定売上高
  
  // コスト管理
  estimated_cost?: number // 想定コスト（円）
  
  // 天候・環境
  weather?: 'sunny' | 'cloudy' | 'rainy' | 'windy'
  temperature_morning?: number
  temperature_afternoon?: number
  humidity?: number
  
  // その他
  work_duration?: number // 分
  worker_count?: number
  created_by?: string
  photos?: string[]
}

interface Vegetable {
  id: string
  name: string
  variety: string
  plot_name?: string
  status: string
}

interface WorkReportFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

const WORK_TYPES = [
  { value: 'seeding', label: '播種・育苗', icon: Sprout },
  { value: 'planting', label: '定植', icon: MapPin },
  { value: 'fertilizing', label: '施肥', icon: Beaker },
  { value: 'watering', label: '灌水', icon: Droplets },
  { value: 'weeding', label: '除草', icon: Sprout },
  { value: 'pruning', label: '整枝・摘芽', icon: Sprout },
  { value: 'harvesting', label: '収穫', icon: TrendingUp },
  { value: 'other', label: 'その他', icon: FileText }
]

const WEATHER_OPTIONS = [
  { value: 'sunny', label: '晴れ', icon: '☀️' },
  { value: 'cloudy', label: '曇り', icon: '☁️' },
  { value: 'rainy', label: '雨', icon: '🌧️' },
  { value: 'windy', label: '風', icon: '💨' }
]

const QUALITY_OPTIONS = [
  { value: 'excellent', label: '優', color: 'bg-green-100 text-green-800' },
  { value: 'good', label: '良', color: 'bg-blue-100 text-blue-800' },
  { value: 'average', label: '可', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'poor', label: '不可', color: 'bg-red-100 text-red-800' }
]

export default function WorkReportForm({ open, onOpenChange, onSuccess }: WorkReportFormProps) {
  const [vegetables, setVegetables] = useState<Vegetable[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // フォーム状態
  const [selectedVegetable, setSelectedVegetable] = useState('')
  const [currentReport, setCurrentReport] = useState<WorkReport>({
    vegetable_id: '',
    work_date: format(new Date(), 'yyyy-MM-dd'),
    work_type: 'other'
  })
  
  // 写真アップロード状態
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      fetchVegetables()
    }
  }, [open])

  const fetchVegetables = async () => {
    setLoading(true)
    try {
      const companyId = 'a1111111-1111-1111-1111-111111111111'
      const response = await fetch(`/api/vegetables?company_id=${companyId}&limit=100`)
      
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data && result.data.length > 0) {
          const vegetables = result.data.map((v: any) => ({
            id: v.id,
            name: `${v.name}（${v.variety_name}）`,
            variety: v.variety_name,
            plot_name: v.plot_name,
            status: v.status
          }))
          setVegetables(vegetables)
        } else {
          console.log('APIからのデータが空のため、サンプルデータを使用します')
          // フォールバック用サンプルデータ
          setVegetables([
            { id: 'd1111111-1111-1111-1111-111111111111', name: 'A棟トマト（桃太郎）', variety: '桃太郎', plot_name: 'A棟温室', status: 'growing' },
            { id: 'd2222222-2222-2222-2222-222222222222', name: 'B棟キュウリ（四葉）', variety: '四葉', plot_name: 'B棟温室', status: 'growing' },
            { id: 'd3333333-3333-3333-3333-333333333333', name: '露地レタス（春作）', variety: 'グリーンリーフ', plot_name: '露地第1圃場', status: 'planning' },
            { id: 'd4444444-4444-4444-4444-444444444444', name: 'C棟ナス（千両二号）', variety: '千両二号', plot_name: 'C棟温室', status: 'growing' }
          ])
        }
      } else {
        console.log('API呼び出しが失敗しました:', response.status)
        // レスポンスが失敗した場合もサンプルデータ
        setVegetables([
          { id: 'd1111111-1111-1111-1111-111111111111', name: 'A棟トマト（桃太郎）', variety: '桃太郎', plot_name: 'A棟温室', status: 'growing' },
          { id: 'd2222222-2222-2222-2222-222222222222', name: 'B棟キュウリ（四葉）', variety: '四葉', plot_name: 'B棟温室', status: 'growing' },
          { id: 'd3333333-3333-3333-3333-333333333333', name: '露地レタス（春作）', variety: 'グリーンリーフ', plot_name: '露地第1圃場', status: 'planning' },
          { id: 'd4444444-4444-4444-4444-444444444444', name: 'C棟ナス（千両二号）', variety: '千両二号', plot_name: 'C棟温室', status: 'growing' }
        ])
      }
    } catch (error) {
      console.error('野菜データ取得エラー:', error)
      // エラー時もサンプルデータを設定
      setVegetables([
        { id: 'd1111111-1111-1111-1111-111111111111', name: 'A棟トマト（桃太郎）', variety: '桃太郎', plot_name: 'A棟温室', status: 'growing' },
        { id: 'd2222222-2222-2222-2222-222222222222', name: 'B棟キュウリ（四葉）', variety: '四葉', plot_name: 'B棟温室', status: 'growing' },
        { id: 'd3333333-3333-3333-3333-333333333333', name: '露地レタス（春作）', variety: 'グリーンリーフ', plot_name: '露地第1圃場', status: 'planning' },
        { id: 'd4444444-4444-4444-4444-444444444444', name: 'C棟ナス（千両二号）', variety: '千両二号', plot_name: 'C棟温室', status: 'growing' }
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleVegetableChange = (vegetableId: string) => {
    setSelectedVegetable(vegetableId)
    setCurrentReport(prev => ({
      ...prev,
      vegetable_id: vegetableId
    }))
  }

  const handleInputChange = (field: keyof WorkReport, value: any) => {
    setCurrentReport(prev => {
      const newReport = {
        ...prev,
        [field]: value
      }

      // 収穫量または想定単価が変更された場合、想定売上高を自動計算
      if ((field === 'harvest_amount' || field === 'expected_price') && newReport.work_type === 'harvesting') {
        const amount = newReport.harvest_amount || 0
        const price = newReport.expected_price || 0
        newReport.expected_revenue = amount * price
      }

      return newReport
    })
  }

  // 作業種類に応じた動的フィールドを取得
  const getDynamicFields = (workType: string) => {
    switch (workType) {
      case 'seeding':
        return {
          showAmount: true,
          showCost: true,
          showFertilizer: false,
          showHarvest: false,
          amountLabel: '播種量',
          amountUnits: ['kg', 'g', '粒', '株']
        }
      case 'planting':
        return {
          showAmount: true,
          showCost: true,
          showFertilizer: false,
          showHarvest: false,
          amountLabel: '定植数',
          amountUnits: ['株', '個']
        }
      case 'fertilizing':
        return {
          showAmount: false,
          showCost: true,
          showFertilizer: true,
          showHarvest: false
        }
      case 'watering':
        return {
          showAmount: true,
          showCost: true,
          showFertilizer: false,
          showHarvest: false,
          amountLabel: '灌水量',
          amountUnits: ['L', 'ml', 'm2']
        }
      case 'harvesting':
        return {
          showAmount: false,
          showCost: false,
          showFertilizer: false,
          showHarvest: true
        }
      default:
        return {
          showAmount: false,
          showCost: true,
          showFertilizer: false,
          showHarvest: false
        }
    }
  }

  const validateReport = (): string[] => {
    const errors: string[] = []

    if (!currentReport.vegetable_id) {
      errors.push('野菜を選択してください')
    }
    if (!currentReport.work_date) {
      errors.push('作業日を入力してください')
    }
    if (!currentReport.work_type) {
      errors.push('作業種類を選択してください')
    }

    return errors
  }

  const handleSubmit = async () => {
    const validationErrors = validateReport()
    if (validationErrors.length > 0) {
      alert('入力内容に問題があります:\n\n' + validationErrors.join('\n'))
      return
    }

    setSaving(true)
    try {
      const reportToSave = {
        ...currentReport,
        company_id: 'a1111111-1111-1111-1111-111111111111',
        photos: uploadedPhotos,
        created_by: 'd0efa1ac-7e7e-420b-b147-dabdf01454b7' // テスト用ユーザーID
      }

      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportToSave)
      })

      const result = await response.json()

      if (result.success) {
        alert('作業報告を保存しました！')
        
        // 分析データと自動同期
        try {
          analyticsDataSync.syncWorkReportToAnalytics(reportToSave, vegetables)
        } catch (syncError) {
          console.error('分析データ同期エラー:', syncError)
        }
        
        // フォームリセット
        setCurrentReport({
          vegetable_id: '',
          work_date: format(new Date(), 'yyyy-MM-dd'),
          work_type: 'other'
        })
        setSelectedVegetable('')
        setUploadedPhotos([])
        
        // コールバック実行
        if (onSuccess) {
          onSuccess()
        }
        
        // モーダルを閉じる
        onOpenChange(false)
      } else {
        alert(`保存に失敗しました: ${result.error}`)
      }
    } catch (error) {
      console.error('保存エラー:', error)
      alert('保存に失敗しました。ネットワーク接続を確認してください。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] xl:max-w-[1200px] max-h-[95vh] p-0 bg-white overflow-hidden">
        <DialogTitle className="sr-only">新規作業記録</DialogTitle>
        {/* ヘッダー */}
        <div className="border-b border-gray-200 px-6 py-4 bg-white">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-2 rounded-full">
              <FileText className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">新規作業記録</h2>
              <p className="text-sm text-gray-600 mt-1">
                本日の作業内容を記録してデータベースに保存します
              </p>
            </div>
          </div>
        </div>
        
        {loading ? (
          <div className="py-8 text-center bg-white">
            <Clock className="w-8 h-8 mx-auto mb-4 animate-spin text-green-600" />
            <p className="text-gray-600">データを読み込み中...</p>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row h-full min-h-0 bg-white">
            {/* メインフォーム */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="space-y-6 max-w-3xl">
                {/* 野菜選択 */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <h4 className="text-lg font-semibold text-blue-800 mb-3 flex items-center">
                    <Sprout className="w-5 h-5 mr-2" />
                    対象野菜選択
                  </h4>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">野菜を選択 *</Label>
                    <Select value={selectedVegetable} onValueChange={handleVegetableChange}>
                      <SelectTrigger className="bg-white border-blue-200">
                        <SelectValue placeholder="報告対象の野菜を選択してください" />
                      </SelectTrigger>
                      <SelectContent>
                        {vegetables.map(vegetable => (
                          <SelectItem key={vegetable.id} value={vegetable.id}>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{vegetable.name}</span>
                              <Badge variant="outline" className="text-xs bg-gray-100">
                                {vegetable.plot_name}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedVegetable && (
                  <>
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
                              value={currentReport.work_date}
                              onChange={(e) => handleInputChange('work_date', e.target.value)}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>作業種類 *</Label>
                            <Select 
                              value={currentReport.work_type} 
                              onValueChange={(value) => handleInputChange('work_type', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
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
                          <Label>作業内容・備考</Label>
                          <Textarea
                            value={currentReport.work_notes || ''}
                            onChange={(e) => handleInputChange('work_notes', e.target.value)}
                            placeholder="今日の作業内容を詳しく記録してください..."
                            rows={3}
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>天候</Label>
                            <Select 
                              value={currentReport.weather || ''} 
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
                            <Label>作業時間 (分)</Label>
                            <Input
                              type="number"
                              value={currentReport.work_duration || ''}
                              onChange={(e) => handleInputChange('work_duration', parseInt(e.target.value) || undefined)}
                              placeholder="120"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>作業人数</Label>
                            <Input
                              type="number"
                              value={currentReport.worker_count || ''}
                              onChange={(e) => handleInputChange('worker_count', parseInt(e.target.value) || undefined)}
                              placeholder="2"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                {/* 動的フィールド */}
                {(() => {
                  const dynamicFields = getDynamicFields(currentReport.work_type)
                  
                  return (
                    <>
                      {/* 収穫情報 */}
                      {dynamicFields.showHarvest && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                          <h4 className="text-lg font-semibold text-red-800 mb-4 flex items-center">
                            <TrendingUp className="w-5 h-5 mr-2" />
                            収穫情報
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>収穫量</Label>
                              <div className="flex gap-2">
                                <Input
                                  type="number"
                                  step="0.1"
                                  value={currentReport.harvest_amount || ''}
                                  onChange={(e) => handleInputChange('harvest_amount', parseFloat(e.target.value) || undefined)}
                                  placeholder="15.5"
                                  className="flex-1"
                                />
                                <Select 
                                  value={currentReport.harvest_unit || ''} 
                                  onValueChange={(value) => handleInputChange('harvest_unit', value)}
                                >
                                  <SelectTrigger className="w-20">
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
                            </div>
                            
                            <div className="space-y-2">
                              <Label>品質評価</Label>
                              <Select 
                                value={currentReport.harvest_quality || ''} 
                                onValueChange={(value) => handleInputChange('harvest_quality', value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="評価を選択" />
                                </SelectTrigger>
                                <SelectContent>
                                  {QUALITY_OPTIONS.map(quality => (
                                    <SelectItem key={quality.value} value={quality.value}>
                                      <Badge className={quality.color} variant="secondary">
                                        {quality.label}
                                      </Badge>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label>想定単価（円/単位）</Label>
                              <Input
                                type="number"
                                value={currentReport.expected_price || ''}
                                onChange={(e) => handleInputChange('expected_price', parseFloat(e.target.value) || undefined)}
                                placeholder="200"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>想定売上高（円）</Label>
                              <Input
                                type="number"
                                value={currentReport.expected_revenue || ''}
                                readOnly
                                className="bg-gray-50"
                                placeholder="自動計算されます"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 肥料情報 */}
                      {dynamicFields.showFertilizer && (
                        <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
                          <h4 className="text-lg font-semibold text-purple-800 mb-4 flex items-center">
                            <Beaker className="w-5 h-5 mr-2" />
                            肥料情報
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>肥料種類</Label>
                              <Input
                                value={currentReport.fertilizer_type || ''}
                                onChange={(e) => handleInputChange('fertilizer_type', e.target.value)}
                                placeholder="例：ハイポネックス液肥"
                              />
                            </div>
                            
                            <div className="space-y-2">
                              <Label>投入量</Label>
                              <div className="flex gap-2">
                                <Input
                                  type="number"
                                  step="0.1"
                                  value={currentReport.fertilizer_amount || ''}
                                  onChange={(e) => handleInputChange('fertilizer_amount', parseFloat(e.target.value) || undefined)}
                                  placeholder="2.5"
                                  className="flex-1"
                                />
                                <Select 
                                  value={currentReport.fertilizer_unit || ''} 
                                  onValueChange={(value) => handleInputChange('fertilizer_unit', value)}
                                >
                                  <SelectTrigger className="w-20">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="kg">kg</SelectItem>
                                    <SelectItem value="g">g</SelectItem>
                                    <SelectItem value="L">L</SelectItem>
                                    <SelectItem value="ml">ml</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 量・単位フィールド */}
                      {dynamicFields.showAmount && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                          <h4 className="text-lg font-semibold text-blue-800 mb-4 flex items-center">
                            <Droplets className="w-5 h-5 mr-2" />
                            {dynamicFields.amountLabel}
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>{dynamicFields.amountLabel}</Label>
                              <div className="flex gap-2">
                                <Input
                                  type="number"
                                  step="0.1"
                                  value={currentReport.work_amount || ''}
                                  onChange={(e) => handleInputChange('work_amount', parseFloat(e.target.value) || undefined)}
                                  placeholder="0"
                                  className="flex-1"
                                />
                                <Select 
                                  value={currentReport.work_unit || ''} 
                                  onValueChange={(value) => handleInputChange('work_unit', value)}
                                >
                                  <SelectTrigger className="w-24">
                                    <SelectValue placeholder="単位" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {dynamicFields.amountUnits?.map(unit => (
                                      <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* コスト情報 */}
                      {dynamicFields.showCost && (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                          <h4 className="text-lg font-semibold text-green-800 mb-4 flex items-center">
                            <TrendingUp className="w-5 h-5 mr-2" />
                            コスト情報
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>想定コスト（円）</Label>
                              <Input
                                type="number"
                                value={currentReport.estimated_cost || ''}
                                onChange={(e) => handleInputChange('estimated_cost', parseFloat(e.target.value) || undefined)}
                                placeholder="0"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )
                })()}

                    {/* 写真アップロード */}
                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
                      <h4 className="text-lg font-semibold text-purple-800 mb-4 flex items-center">
                        <Camera className="w-5 h-5 mr-2" />
                        現場写真
                      </h4>
                      <PhotoUpload
                        vegetableId={selectedVegetable}
                        onUploadSuccess={() => {
                          console.log('写真アップロード成功')
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* サイドバー（アクション） */}
            <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-gray-200 bg-gray-50 p-6">
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">作業記録の保存</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    入力した作業内容をデータベースに保存し、ガントチャートや分析データと連携します。
                  </p>
                </div>

                {selectedVegetable ? (
                  <div className="space-y-3">
                    <Button 
                      onClick={handleSubmit} 
                      disabled={saving} 
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                      size="lg"
                    >
                      {saving ? (
                        <>
                          <Clock className="w-4 h-4 mr-2 animate-spin" />
                          保存中...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          作業報告を保存
                        </>
                      )}
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      onClick={() => onOpenChange(false)}
                      className="w-full"
                      disabled={saving}
                    >
                      <X className="w-4 h-4 mr-2" />
                      キャンセル
                    </Button>
                    
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                      <h4 className="text-sm font-medium text-blue-800 mb-2">💡 データ連携</h4>
                      <ul className="text-xs text-blue-700 space-y-1">
                        <li>• 作業レポートページと自動同期</li>
                        <li>• ガントチャート進捗更新</li>
                        <li>• 分析データベースに反映</li>
                        <li>• 写真ギャラリーに連携</li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Sprout className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                    <p className="text-sm text-gray-500">
                      まず対象野菜を選択してください
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}