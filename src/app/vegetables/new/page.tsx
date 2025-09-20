'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Save, Loader2, Sprout, Calendar } from 'lucide-react'
import Link from 'next/link'

interface VegetableFormData {
  vegetable_name: string
  variety_name: string
  scientific_name: string
  plot_name: string
  area_size: string
  planting_date: string
  expected_harvest_date: string
  status: string
  notes: string
}

const statusOptions = [
  { value: 'planning', label: '計画中' },
  { value: 'growing', label: '栽培中' },
  { value: 'harvesting', label: '収穫中' },
  { value: 'completed', label: '完了' },
]

export default function NewVegetablePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState<VegetableFormData>({
    vegetable_name: '',
    variety_name: '',
    scientific_name: '',
    plot_name: '',
    area_size: '',
    planting_date: new Date().toISOString().split('T')[0],
    expected_harvest_date: '',
    status: 'planning',
    notes: ''
  })

  const handleInputChange = (field: keyof VegetableFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const validateForm = (): string[] => {
    const errors: string[] = []
    
    if (!formData.vegetable_name) errors.push('野菜名を入力してください')
    if (!formData.variety_name) errors.push('品種名を入力してください')
    if (!formData.plot_name) errors.push('区画名を入力してください')
    if (!formData.area_size) errors.push('栽培面積を入力してください')
    if (!formData.planting_date) errors.push('植付日を入力してください')
    
    return errors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const validationErrors = validateForm()
    if (validationErrors.length > 0) {
      alert('入力内容に問題があります:\n\n' + validationErrors.join('\n'))
      return
    }

    setSubmitting(true)

    try {
      const vegetableData = {
        name: formData.vegetable_name,
        variety_name: formData.variety_name,
        scientific_name: formData.scientific_name || null,
        plot_name: formData.plot_name,
        plot_size: parseFloat(formData.area_size) || 0,
        planting_date: formData.planting_date,
        expected_harvest_date: formData.expected_harvest_date || null,
        status: formData.status,
        growth_stage: 'seedling',
        notes: formData.notes || null,
        company_id: 'a1111111-1111-1111-1111-111111111111',
        created_by: 'd0efa1ac-7e7e-420b-b147-dabdf01454b7' // テスト用ユーザーID
      }

      const response = await fetch('/api/vegetables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(vegetableData)
      })

      const result = await response.json()

      if (result.success) {
        alert('新しい野菜を登録しました！')
        router.push('/vegetables')
      } else {
        alert(`登録に失敗しました: ${result.error}`)
      }
    } catch (error) {
      
      alert('登録に失敗しました。ネットワーク接続を確認してください。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-0 overflow-hidden">
      {/* ヘッダー */}
      <div className="border-b border-gray-200 px-6 py-4 bg-white">
        <div className="flex items-center gap-3">
          <div className="bg-green-100 p-2 rounded-full">
            <Sprout className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">新しい野菜を追加</h2>
            <p className="text-sm text-gray-600 mt-1">
              新しい野菜の栽培を登録してデータベースに保存します
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row h-full min-h-0 bg-white">
        {/* メインフォーム */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
            {/* 基本情報 */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
              <h4 className="text-lg font-semibold text-blue-800 mb-4 flex items-center">
                <Sprout className="w-5 h-5 mr-2" />
                基本情報
              </h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>野菜名 *</Label>
                  <Input
                    value={formData.vegetable_name}
                    onChange={(e) => handleInputChange('vegetable_name', e.target.value)}
                    placeholder="例: トマト"
                  />
                </div>

                <div className="space-y-2">
                  <Label>品種名 *</Label>
                  <Input
                    value={formData.variety_name}
                    onChange={(e) => handleInputChange('variety_name', e.target.value)}
                    placeholder="例: 桃太郎"
                  />
                </div>

                <div className="space-y-2">
                  <Label>学名</Label>
                  <Input
                    value={formData.scientific_name}
                    onChange={(e) => handleInputChange('scientific_name', e.target.value)}
                    placeholder="例: Solanum lycopersicum"
                  />
                </div>

                <div className="space-y-2">
                  <Label>区画名 *</Label>
                  <Input
                    value={formData.plot_name}
                    onChange={(e) => handleInputChange('plot_name', e.target.value)}
                    placeholder="例: A棟温室"
                  />
                </div>

                <div className="space-y-2">
                  <Label>栽培面積（㎡）*</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.area_size}
                    onChange={(e) => handleInputChange('area_size', e.target.value)}
                    placeholder="100.0"
                  />
                </div>

                <div className="space-y-2">
                  <Label>栽培状況</Label>
                  <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
                    <SelectTrigger className="bg-white border-blue-200">
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
              </div>
            </div>

            {/* 栽培日程 */}
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
              <h4 className="text-lg font-semibold text-purple-800 mb-4 flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                栽培日程
              </h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>植付日 *</Label>
                  <Input
                    type="date"
                    value={formData.planting_date}
                    onChange={(e) => handleInputChange('planting_date', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>収穫予定日</Label>
                  <Input
                    type="date"
                    value={formData.expected_harvest_date}
                    onChange={(e) => handleInputChange('expected_harvest_date', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>備考</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    placeholder="特記事項があれば記入してください"
                    rows={4}
                  />
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* サイドバー（アクション） */}
        <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-gray-200 bg-gray-50 p-6">
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">野菜登録</h3>
              <p className="text-sm text-gray-600 mb-4">
                入力した野菜情報をデータベースに保存し、作業管理システムと連携します。
              </p>
            </div>

            <div className="space-y-3">
              <Button 
                onClick={handleSubmit} 
                disabled={submitting} 
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                size="lg"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    登録中...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    野菜を登録
                  </>
                )}
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => router.push('/vegetables')}
                className="w-full"
                disabled={submitting}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                一覧に戻る
              </Button>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                <h4 className="text-sm font-medium text-blue-800 mb-2">💡 データ連携</h4>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• ダッシュボードと自動同期</li>
                  <li>• ガントチャートでタスク生成</li>
                  <li>• 作業記録で選択可能に</li>
                  <li>• データ分析に反映</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}