'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { 
  Save, 
  Loader2, 
  Sprout,
  Calendar,
  FileText,
  MapPin
} from 'lucide-react'

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

import type { MeshCell } from '@/types/database'

interface VegetableAddFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  selectedCells?: MeshCell[]
  farmPlotId?: string
  farmAreaData?: {
    id?: string
    name: string
    description: string
    area_hectares: number
    area_square_meters: number
    estimated_cell_count: number
    geometry?: any
  }
}

const statusOptions = [
  { value: 'planning', label: '計画中' },
  { value: 'growing', label: '栽培中' },
  { value: 'harvesting', label: '収穫中' },
  { value: 'completed', label: '完了' },
]

export default function VegetableAddForm({ 
  open, 
  onOpenChange, 
  onSuccess,
  selectedCells = [],
  farmPlotId,
  farmAreaData
}: VegetableAddFormProps) {
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState<VegetableFormData>({
    vegetable_name: '',
    variety_name: '',
    scientific_name: '',
    plot_name: farmAreaData?.name || '',
    area_size: farmAreaData?.area_square_meters?.toString() || '',
    planting_date: new Date().toISOString().split('T')[0],
    expected_harvest_date: '',
    status: 'planning',
    notes: farmAreaData?.description || ''
  })

  const handleInputChange = (field: keyof VegetableFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // 野菜セルテーブルに選択セルを登録
  const registerVegetableCells = async (vegetableId: string, cells: MeshCell[]) => {
    try {
      const cellRegistrations = cells.map(cell => ({
        vegetable_id: vegetableId,
        plot_cell_id: cell.id,
        planting_date: formData.planting_date,
        expected_harvest_date: formData.expected_harvest_date || null,
        plant_count: 1, // デフォルト1株
        growth_stage: 'seedling',
        health_status: 'healthy',
        created_by: '11111111-1111-1111-1111-111111111111' // テスト管理者
      }))

      const response = await fetch('/api/vegetable-cells', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vegetable_id: vegetableId,
          cells: cellRegistrations
        })
      })

      if (!response.ok) {
        console.warn('セル登録に失敗しましたが、野菜登録は成功しました')
      }
    } catch (error) {
      console.warn('セル登録エラー:', error)
    }
  }

  const validateForm = (): string[] => {
    const errors: string[] = []
    
    if (!formData.vegetable_name) errors.push('野菜名を入力してください')
    if (!formData.variety_name) errors.push('品種名を入力してください')
    if (!formData.plot_name) errors.push('区画名を入力してください')
    
    // 選択セルがない場合のみ面積入力をチェック
    if (selectedCells.length === 0 && !formData.area_size) {
      errors.push('栽培面積を入力してください')
    }
    
    if (!formData.planting_date) errors.push('植付日を入力してください')
    
    return errors
  }

  const handleSubmit = async () => {
    const validationErrors = validateForm()
    if (validationErrors.length > 0) {
      alert('入力内容に問題があります:\n\n' + validationErrors.join('\n'))
      return
    }

    setSubmitting(true)

    try {
      // 面積計算（優先順位: 農地エリア > 選択セル > 手動入力）
      let calculatedAreaSqm = 0
      if (farmAreaData?.area_square_meters) {
        calculatedAreaSqm = farmAreaData.area_square_meters
      } else if (selectedCells.length > 0) {
        calculatedAreaSqm = selectedCells.length * 25
      } else {
        calculatedAreaSqm = parseFloat(formData.area_size) || 0
      }
      
      const vegetableData = {
        name: formData.vegetable_name,
        variety_name: formData.variety_name,
        scientific_name: formData.scientific_name || null,
        plot_name: formData.plot_name,
        plot_size: calculatedAreaSqm, // 平方メートルで送信
        planting_date: formData.planting_date,
        expected_harvest_date: formData.expected_harvest_date || null,
        status: formData.status,
        growth_stage: 'seedling',
        notes: formData.notes || null,
        company_id: 'a1111111-1111-1111-1111-111111111111', // 株式会社グリーンファーム
        created_by: '11111111-1111-1111-1111-111111111111', // テスト管理者
        farm_plot_id: farmPlotId || null,
        selected_cells_count: selectedCells.length,
        total_cultivation_area_sqm: calculatedAreaSqm,
        // 農地エリア情報を含める
        farm_area_data: farmAreaData ? {
          area_hectares: farmAreaData.area_hectares,
          area_square_meters: farmAreaData.area_square_meters,
          estimated_cell_count: farmAreaData.estimated_cell_count,
          geometry: farmAreaData.geometry
        } : null
      }
      
      console.log('📤 野菜登録データを送信:', vegetableData)

      const response = await fetch('/api/vegetables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(vegetableData)
      })

      const result = await response.json()
      console.log('🌱 野菜登録API レスポンス:', result)

      if (result.success) {
        // 野菜登録成功後、選択されたセルがあれば野菜セルテーブルにも登録
        if (selectedCells.length > 0 && result.data?.id) {
          await registerVegetableCells(result.data.id, selectedCells)
        }
        
        alert('新しい野菜を登録しました！')
        
        // 野菜登録完了イベントを発行（farm-map-view の自動更新のため）
        const vegetableRegisteredEvent = new CustomEvent('vegetableRegistered', {
          detail: {
            vegetable: result.data,
            message: '野菜登録が完了しました'
          }
        })
        window.dispatchEvent(vegetableRegisteredEvent)
        console.log('🔔 vegetableRegistered イベントを発行しました:', result.data)
        
        // フォームリセット
        setFormData({
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
        
        // コールバック実行
        if (onSuccess) {
          onSuccess()
        }
        
        // モーダルを閉じる
        onOpenChange(false)
      } else {
        console.error('❌ 野菜登録に失敗:', result)
        alert(`登録に失敗しました: ${result.error || 'エラーの詳細が不明です'}`)
      }
    } catch (error) {
      console.error('登録エラー:', error)
      alert('登録に失敗しました。ネットワーク接続を確認してください。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] xl:max-w-[1200px] max-h-[95vh] p-0 bg-white flex flex-col">
        <DialogTitle className="sr-only">新しい野菜を追加</DialogTitle>
        
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

        <div className="flex flex-col lg:flex-row flex-1 min-h-0 bg-white">
          {/* メインフォーム */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-6 max-w-4xl pb-6">
              {/* 農地エリア情報表示 */}
              {farmAreaData ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <h4 className="text-lg font-semibold text-emerald-800 mb-3 flex items-center">
                    <MapPin className="w-5 h-5 mr-2" />
                    描画された農地エリア
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-emerald-700 font-medium">面積:</span>
                      <span className="ml-2">{farmAreaData.area_hectares.toFixed(2)} ha</span>
                    </div>
                    <div>
                      <span className="text-emerald-700 font-medium">平方メートル:</span>
                      <span className="ml-2">{farmAreaData.area_square_meters.toFixed(0)} ㎡</span>
                    </div>
                    <div>
                      <span className="text-emerald-700 font-medium">推定セル数:</span>
                      <span className="ml-2">{farmAreaData.estimated_cell_count} セル</span>
                    </div>
                    <div>
                      <span className="text-emerald-700 font-medium">エリア名:</span>
                      <span className="ml-2">{farmAreaData.name || '未設定'}</span>
                    </div>
                  </div>
                  {farmAreaData.description && (
                    <div className="mt-2 text-xs text-emerald-600">
                      説明: {farmAreaData.description}
                    </div>
                  )}
                  <div className="mt-3 p-2 bg-emerald-100 rounded text-xs text-emerald-700">
                    💡 この農地エリアと野菜情報が自動的にリンクされ、データベースに保存されます
                  </div>
                </div>
              ) : selectedCells.length > 0 ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <h4 className="text-lg font-semibold text-emerald-800 mb-3 flex items-center">
                    <MapPin className="w-5 h-5 mr-2" />
                    選択された栽培エリア
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-emerald-700 font-medium">選択セル数:</span>
                      <span className="ml-2">{selectedCells.length} セル</span>
                    </div>
                    <div>
                      <span className="text-emerald-700 font-medium">栽培面積:</span>
                      <span className="ml-2">{selectedCells.length * 25} ㎡</span>
                    </div>
                  </div>
                  {farmPlotId && (
                    <div className="mt-2 text-xs text-emerald-600">
                      農地ID: {farmPlotId}
                    </div>
                  )}
                </div>
              ) : null}

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

                  {/* 選択セルがない場合のみ面積入力フィールドを表示 */}
                  {selectedCells.length === 0 && (
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
                  )}

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
            </div>
          </div>

          {/* サイドバー（アクション） */}
          <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-gray-200 bg-gray-50 p-6 flex-shrink-0">
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
                  onClick={() => onOpenChange(false)}
                  className="w-full"
                  disabled={submitting}
                >
                  キャンセル
                </Button>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                  <h4 className="text-sm font-medium text-blue-800 mb-2">💡 データ連携</h4>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li>• 野菜管理ページと自動同期</li>
                    <li>• ガントチャートでタスク生成</li>
                    <li>• 作業記録で選択可能に</li>
                    <li>• データ分析に反映</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}