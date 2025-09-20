'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
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
  X,
  ChevronDown,
  ChevronUp,
  Layers,
  TestTube,
  AlertTriangle,
  UserPlus,
  Info
} from 'lucide-react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import WorkAccountingInputDemo from '@/components/demo/work-accounting-input-demo'
import { useRouter } from 'next/navigation'

interface WorkReport {
  id?: string
  vegetable_id: string
  work_date: string
  work_type: 'seeding' | 'planting' | 'fertilizing' | 'watering' | 'weeding' | 'pruning' | 'harvesting' | 'other'
  work_notes?: string

  // 量・単位
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
  soil_ec?: number
  phosphorus_absorption?: number
  cec?: number
  exchangeable_calcium?: number
  exchangeable_magnesium?: number
  exchangeable_potassium?: number
  base_saturation?: number
  calcium_magnesium_ratio?: number
  magnesium_potassium_ratio?: number
  available_phosphorus?: number
  available_silica?: number
  humus_content?: number
  ammonium_nitrogen?: number
  nitrate_nitrogen?: number
  manganese?: number
  boron?: number
  free_iron_oxide?: number
  soil_notes?: string

  // 収穫データ
  harvest_amount?: number
  harvest_unit?: 'kg' | 'g' | '個' | '束'
  harvest_quality?: 'excellent' | 'good' | 'average' | 'poor'
  expected_price?: number
  expected_revenue?: number

  // 天候・環境
  weather?: 'sunny' | 'cloudy' | 'rainy' | 'windy'
  temperature?: number
  humidity?: number

  // その他
  work_duration?: number
  worker_count?: number
}

interface Vegetable {
  id: string
  name: string
  variety: string
  plot_name?: string
  status: string
}

interface WorkReportFormDemoV2Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  vegetables: any[]
  onSubmit?: (data: any) => void
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

export default function WorkReportFormDemoV2({
  open,
  onOpenChange,
  vegetables,
  onSubmit
}: WorkReportFormDemoV2Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // フォーム状態
  const [selectedVegetable, setSelectedVegetable] = useState('')
  const [soilInfoVisible, setSoilInfoVisible] = useState(false)
  const [showDemoLimitModal, setShowDemoLimitModal] = useState(false)
  const [showValidationModal, setShowValidationModal] = useState(false)
  const [validationWarnings, setValidationWarnings] = useState<string[]>([])

  const [currentReport, setCurrentReport] = useState<WorkReport>({
    vegetable_id: '',
    work_date: format(new Date(), 'yyyy-MM-dd'),
    work_type: 'other'
  })

  // 会計データ状態
  const [accountingData, setAccountingData] = useState<{
    income_items: any[]
    expense_items: any[]
    income_total: number
    expense_total: number
    net_income: number
  }>({
    income_items: [],
    expense_items: [],
    income_total: 0,
    expense_total: 0,
    net_income: 0
  })

  // 手動反映機能用
  const [manualReflectFunction, setManualReflectFunction] = useState<((amount: number, itemName: string) => void) | null>(null)

  const handleManualReflectCallback = (reflectFunction: (amount: number, itemName: string) => void) => {
    
    setManualReflectFunction(() => reflectFunction)
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

  // 会計記録に手動反映する関数
  const handleReflectToAccounting = () => {
    

    if (manualReflectFunction && currentReport.expected_revenue && currentReport.expected_revenue > 0) {
      
      manualReflectFunction(currentReport.expected_revenue, '収穫売上')
    }
  }

  // 作業種類に応じた動的フィールドを取得
  const getDynamicFields = (workType: string) => {
    switch (workType) {
      case 'seeding':
        return {
          showAmount: true,
          showFertilizer: false,
          showHarvest: false,
          amountLabel: '播種量',
          amountUnits: ['kg', 'g', '粒', '株']
        }
      case 'planting':
        return {
          showAmount: true,
          showFertilizer: false,
          showHarvest: false,
          amountLabel: '定植数',
          amountUnits: ['株', '個']
        }
      case 'fertilizing':
        return {
          showAmount: false,
          showFertilizer: true,
          showHarvest: false
        }
      case 'watering':
        return {
          showAmount: true,
          showFertilizer: false,
          showHarvest: false,
          amountLabel: '灌水量',
          amountUnits: ['L', 'ml', 'm2']
        }
      case 'harvesting':
        return {
          showAmount: false,
          showFertilizer: false,
          showHarvest: true
        }
      default:
        return {
          showAmount: false,
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

  const validateAccountingData = (): string[] => {
    const warnings: string[] = []

    const hasIncompleteIncome = accountingData.income_items.some(item =>
      !item.accounting_item_id || item.accounting_item_id === ''
    )
    const hasIncompleteExpense = accountingData.expense_items.some(item =>
      !item.accounting_item_id || item.accounting_item_id === ''
    )

    if (hasIncompleteIncome) {
      warnings.push('収入項目で選択されていない項目があります')
    }
    if (hasIncompleteExpense) {
      warnings.push('支出項目で選択されていない項目があります')
    }

    return warnings
  }

  const handleSubmit = async () => {
    const validationErrors = validateReport()
    if (validationErrors.length > 0) {
      alert('入力内容に問題があります:\n\n' + validationErrors.join('\n'))
      return
    }

    // 会計データのバリデーション
    const accountingWarnings = validateAccountingData()
    if (accountingWarnings.length > 0) {
      setValidationWarnings(accountingWarnings)
      setShowValidationModal(true)
      return
    }

    // デモ版では制限モーダルを表示
    setShowDemoLimitModal(true)
  }

  const proceedWithSave = async () => {
    // デモ版では制限モーダルを表示
    setShowValidationModal(false)
    setShowDemoLimitModal(true)
  }

  const handleRegistration = () => {
    onOpenChange(false)
    router.push('/login')
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] xl:max-w-[1200px] max-h-[95vh] p-0 bg-white overflow-hidden flex flex-col">
          <DialogTitle className="sr-only">新規作業記録</DialogTitle>

          {/* ヘッダー */}
          <div className="border-b border-gray-200 px-6 py-4 bg-white">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 p-2 rounded-full">
                <FileText className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900">新規作業記録</h2>
                <p className="text-sm text-gray-600 mt-1">
                  本日の作業内容を記録してデータベースに保存します
                </p>
              </div>
              <Badge variant="outline" className="text-orange-600 border-orange-300">
                デモ版
              </Badge>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row flex-1 min-h-0 bg-white">
            {/* メインフォーム */}
            <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-4 lg:py-6 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100" style={{ maxHeight: 'calc(100vh - 120px)' }}>
              <div className="space-y-6 max-w-3xl pb-6">
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
                        {vegetables.length > 0 ? (
                          vegetables.map(vegetable => (
                            <SelectItem key={vegetable.id} value={vegetable.id}>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {vegetable.name}（{vegetable.variety_name || vegetable.variety}）
                                </span>
                                {vegetable.plot_name && (
                                  <Badge variant="outline" className="text-xs bg-gray-100">
                                    {vegetable.plot_name}
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-4 text-center text-gray-500 text-sm">
                            デモ版では野菜データを登録してください
                          </div>
                        )}
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

                        {/* 天候・環境情報 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                            <Label>気温（℃）</Label>
                            <Input
                              type="number"
                              value={currentReport.temperature || ''}
                              onChange={(e) => handleInputChange('temperature', parseFloat(e.target.value) || undefined)}
                              placeholder="例: 25.3"
                              step="0.1"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>湿度（%）</Label>
                            <Input
                              type="number"
                              value={currentReport.humidity || ''}
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
                              value={currentReport.work_duration || ''}
                              onChange={(e) => handleInputChange('work_duration', parseInt(e.target.value) || undefined)}
                              placeholder="例: 120"
                              min="1"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>作業人数（人）</Label>
                            <Input
                              type="number"
                              value={currentReport.worker_count || ''}
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
                                  value={currentReport.soil_ph || ''}
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
                                  value={currentReport.soil_ec || ''}
                                  onChange={(e) => handleInputChange('soil_ec', parseFloat(e.target.value) || undefined)}
                                  placeholder="例: 0.8"
                                  step="0.01"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label className="text-amber-700">りん酸吸収係数</Label>
                                <Input
                                  type="number"
                                  value={currentReport.phosphorus_absorption || ''}
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value)
                                    if (!isNaN(value) && value <= 999) {
                                      handleInputChange('phosphorus_absorption', value)
                                    } else if (e.target.value === '') {
                                      handleInputChange('phosphorus_absorption', undefined)
                                    }
                                  }}
                                  placeholder="例: 999以下"
                                  step="1"
                                  max="999"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label className="text-amber-700">CEC（me/100g）</Label>
                                <Input
                                  type="number"
                                  value={currentReport.cec || ''}
                                  onChange={(e) => handleInputChange('cec', parseFloat(e.target.value) || undefined)}
                                  placeholder="例: 25.0"
                                  step="0.1"
                                />
                              </div>
                            </div>
                          </div>

                          {/* その他の土壌パラメータ（簡略版） */}
                          <div className="space-y-2">
                            <Label className="text-amber-700">土壌観察メモ</Label>
                            <Textarea
                              value={currentReport.soil_notes || ''}
                              onChange={(e) => handleInputChange('soil_notes', e.target.value)}
                              placeholder="土壌の色、質感、構造、根張りの状況など..."
                              rows={3}
                            />
                          </div>

                          <div className="mt-4 p-3 bg-amber-100 border border-amber-300 rounded-lg">
                            <p className="text-sm text-amber-800">
                              💡 <strong>プロフェッショナル土壌診断：</strong>
                              pH6.0-6.8、CEC20以上、塩基飽和度80%以上が理想的です。
                            </p>
                          </div>
                        </div>
                      )}
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
                                  <div className="flex gap-2 items-end">
                                    <Input
                                      type="number"
                                      value={currentReport.expected_revenue || ''}
                                      readOnly
                                      className="bg-gray-50 flex-1"
                                      placeholder="自動計算されます"
                                    />
                                    {currentReport.expected_revenue && currentReport.expected_revenue > 0 && (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleReflectToAccounting}
                                        className="whitespace-nowrap bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                                      >
                                        <TrendingUp className="w-4 h-4 mr-1" />
                                        会計記録反映
                                      </Button>
                                    )}
                                  </div>
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
                        </>
                      )
                    })()}

                    {/* 会計入力セクション */}
                    <div className="bg-gradient-to-br from-emerald-50 via-blue-50 to-indigo-50 rounded-xl p-5 border border-emerald-200">
                      <h4 className="text-lg font-semibold text-emerald-800 mb-4 flex items-center">
                        <TrendingUp className="w-5 h-5 mr-2" />
                        収入・支出記録 （実績会計データ）
                      </h4>
                      <div className="text-sm text-emerald-700 mb-4">
                        この作業に関連する収入・支出を記録して、経営分析に活用しましょう。
                        <br />
                        <span className="text-emerald-600 font-medium">
                          💡 作業種類に応じてAIが適切な会計項目を推奨します。
                        </span>
                      </div>

                      <WorkAccountingInputDemo
                        workType={currentReport.work_type}
                        onDataChange={setAccountingData}
                        onManualReflect={handleManualReflectCallback}
                      />
                    </div>

                    {/* 写真アップロード（デモ版） */}
                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
                      <h4 className="text-lg font-semibold text-purple-800 mb-4 flex items-center">
                        <Camera className="w-5 h-5 mr-2" />
                        現場写真
                      </h4>
                      <div className="border-2 border-dashed border-purple-300 rounded-lg p-8 text-center bg-white">
                        <Camera className="w-12 h-12 mx-auto mb-3 text-purple-400" />
                        <p className="text-sm text-purple-700 font-medium">
                          デモ版では写真アップロード機能は利用できません
                        </p>
                        <p className="text-xs text-purple-600 mt-2">
                          実際の機能は会員登録後にご利用いただけます
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* サイドバー（アクション） */}
            <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-gray-200 bg-gray-50 p-4 lg:p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100" style={{ maxHeight: 'calc(100vh - 120px)' }}>
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

                    {/* デモ版の制限表示 */}
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Info className="w-4 h-4 text-orange-600" />
                        <h4 className="text-sm font-medium text-orange-800">デモ版の制限</h4>
                      </div>
                      <ul className="text-xs text-orange-700 space-y-1">
                        <li>• データの保存はできません</li>
                        <li>• 写真アップロード不可</li>
                        <li>• 全機能は会員登録後に利用可能</li>
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
        </DialogContent>
      </Dialog>

      {/* バリデーション警告モーダル */}
      <Dialog open={showValidationModal} onOpenChange={setShowValidationModal}>
        <DialogContent className="max-w-md bg-white border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <span className="text-orange-600">⚠️</span>
              入力内容の確認
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              以下の項目に不完全な入力があります：
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <ul className="text-sm space-y-1 bg-orange-50 p-3 rounded-lg border border-orange-200">
              {validationWarnings.map((warning, index) => (
                <li key={index} className="text-orange-600 font-medium">• {warning}</li>
              ))}
            </ul>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-sm text-orange-700">
                このまま保存すると、未選択の項目は保存されません。
                <br />
                <strong>続行しますか？</strong>
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowValidationModal(false)}
                className="flex-1 bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                戻って修正
              </Button>
              <Button
                onClick={proceedWithSave}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
              >
                このまま保存
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* デモ版制限モーダル */}
      <Dialog open={showDemoLimitModal} onOpenChange={setShowDemoLimitModal}>
        <DialogContent className="max-w-md bg-white border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              デモ版の制限
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              機能制限のお知らせ
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-sm text-orange-800 font-medium mb-2">
                デモ版では作業記録の登録はできません。
              </p>
              <p className="text-sm text-orange-700">
                実際の機能は会員登録後にご利用いただけます。
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 font-medium mb-2">
                会員登録で利用できる機能：
              </p>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>✅ 作業記録の保存・管理</li>
                <li>✅ 写真アップロード機能</li>
                <li>✅ データ分析・レポート機能</li>
                <li>✅ 会計管理・収支分析</li>
                <li>✅ マルチデバイス同期</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDemoLimitModal(false)}
              className="mr-2"
            >
              了解
            </Button>
            <Button
              onClick={handleRegistration}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              会員登録・ログイン
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}