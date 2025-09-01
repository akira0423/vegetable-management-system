'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Save, Loader2 } from 'lucide-react'

export interface VegetableVariety {
  id: string
  name: string
  variety: string
  category: string
  standard_growth_days: number
}

export interface VegetableFormData {
  name: string
  variety_id: string
  variety_name: string
  plot_name: string
  area_size: string
  plant_count: string
  planting_date: string
  expected_harvest_start: string
  expected_harvest_end: string
  status: string
  notes: string
}

const statusOptions = [
  { value: 'planning', label: '計画中' },
  { value: 'growing', label: '栽培中' },
  { value: 'harvesting', label: '収穫中' },
  { value: 'completed', label: '完了' },
]

interface VegetableFormProps {
  varieties: VegetableVariety[]
  onSubmit: (data: VegetableFormData) => Promise<void>
  onCancel: () => void
  loading?: boolean
  initialData?: Partial<VegetableFormData>
}

export function VegetableForm({
  varieties,
  onSubmit,
  onCancel,
  loading = false,
  initialData = {}
}: VegetableFormProps) {
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState<VegetableFormData>({
    name: '',
    variety_id: '',
    variety_name: '',
    plot_name: '',
    area_size: '',
    plant_count: '',
    planting_date: '',
    expected_harvest_start: '',
    expected_harvest_end: '',
    status: 'planning',
    notes: '',
    ...initialData
  })

  const handleInputChange = (field: keyof VegetableFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleVarietyChange = (varietyId: string) => {
    const variety = varieties.find(v => v.id === varietyId)
    if (variety) {
      setFormData(prev => ({
        ...prev,
        variety_id: varietyId,
        variety_name: variety.variety,
        name: prev.name || `${prev.plot_name}${variety.name}（${variety.variety}）`
      }))
      
      // 植付日から収穫予定日を自動計算
      if (formData.planting_date) {
        calculateHarvestDates(formData.planting_date, variety.standard_growth_days)
      }
    }
  }

  const handlePlantingDateChange = (date: string) => {
    setFormData(prev => ({ ...prev, planting_date: date }))
    
    const variety = varieties.find(v => v.id === formData.variety_id)
    if (variety && date) {
      calculateHarvestDates(date, variety.standard_growth_days)
    }
  }

  const calculateHarvestDates = (plantingDate: string, growthDays: number) => {
    const planting = new Date(plantingDate)
    const harvestStart = new Date(planting)
    harvestStart.setDate(planting.getDate() + growthDays - 10) // 少し早め
    
    const harvestEnd = new Date(planting)
    harvestEnd.setDate(planting.getDate() + growthDays + 20) // 少し遅め
    
    setFormData(prev => ({
      ...prev,
      expected_harvest_start: harvestStart.toISOString().split('T')[0],
      expected_harvest_end: harvestEnd.toISOString().split('T')[0]
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // バリデーション
    if (!formData.name || !formData.variety_id || !formData.plot_name || !formData.planting_date) {
      alert('必須項目を入力してください')
      return
    }

    setSubmitting(true)
    try {
      await onSubmit(formData)
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Form submission error:', error)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div data-testid="loading-spinner" className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="h-96 bg-gray-200 rounded"></div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl" data-testid="vegetable-form">
      <div className="grid lg:grid-cols-2 gap-6">
        {/* 基本情報 */}
        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
            <CardDescription>野菜の基本的な情報を入力してください</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="variety">野菜品種 *</Label>
              <Select value={formData.variety_id} onValueChange={handleVarietyChange}>
                <SelectTrigger data-testid="variety-select">
                  <SelectValue placeholder="品種を選択してください" />
                </SelectTrigger>
                <SelectContent>
                  {varieties.map((variety) => (
                    <SelectItem key={variety.id} value={variety.id}>
                      {variety.name} - {variety.variety} ({variety.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">管理名称 *</Label>
              <Input
                id="name"
                data-testid="name-input"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="例: A棟トマト（桃太郎）"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plot_name">圃場名 *</Label>
              <Input
                id="plot_name"
                data-testid="plot-name-input"
                value={formData.plot_name}
                onChange={(e) => handleInputChange('plot_name', e.target.value)}
                placeholder="例: A棟温室"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="area_size">栽培面積（㎡）</Label>
                <Input
                  id="area_size"
                  data-testid="area-size-input"
                  type="number"
                  step="0.1"
                  value={formData.area_size}
                  onChange={(e) => handleInputChange('area_size', e.target.value)}
                  placeholder="100.0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="plant_count">株数</Label>
                <Input
                  id="plant_count"
                  data-testid="plant-count-input"
                  type="number"
                  value={formData.plant_count}
                  onChange={(e) => handleInputChange('plant_count', e.target.value)}
                  placeholder="50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">栽培状況</Label>
              <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
                <SelectTrigger data-testid="status-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* 日程情報 */}
        <Card>
          <CardHeader>
            <CardTitle>栽培日程</CardTitle>
            <CardDescription>植付と収穫の予定日を設定してください</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="planting_date">植付日 *</Label>
              <Input
                id="planting_date"
                data-testid="planting-date-input"
                type="date"
                value={formData.planting_date}
                onChange={(e) => handlePlantingDateChange(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expected_harvest_start">収穫開始予定日</Label>
              <Input
                id="expected_harvest_start"
                data-testid="harvest-start-input"
                type="date"
                value={formData.expected_harvest_start}
                onChange={(e) => handleInputChange('expected_harvest_start', e.target.value)}
              />
              <p className="text-xs text-gray-500">
                品種と植付日から自動計算されます
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expected_harvest_end">収穫終了予定日</Label>
              <Input
                id="expected_harvest_end"
                data-testid="harvest-end-input"
                type="date"
                value={formData.expected_harvest_end}
                onChange={(e) => handleInputChange('expected_harvest_end', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">備考</Label>
              <Textarea
                id="notes"
                data-testid="notes-textarea"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="特記事項があれば記入してください"
                rows={4}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* アクションボタン */}
      <div className="mt-6 flex gap-4">
        <Button type="submit" disabled={submitting} data-testid="submit-button">
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              登録中...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              登録する
            </>
          )}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} data-testid="cancel-button">
          キャンセル
        </Button>
      </div>
    </form>
  )
}