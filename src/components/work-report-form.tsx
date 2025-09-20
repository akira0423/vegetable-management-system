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
  X,
  ChevronDown,
  ChevronUp,
  Layers,
  TestTube
} from 'lucide-react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import PhotoUpload from '@/components/photo-upload'
import { analyticsDataSync } from '@/lib/analytics-data-sync'
import { useRealtimeSync } from '@/lib/realtime-sync'
import WorkAccountingInput from '@/components/work-accounting-input'

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
  
  // コスト管理は会計記録で管理（想定コストは廃止）
  
  // 天候・環境
  weather?: 'sunny' | 'cloudy' | 'rainy' | 'windy'
  temperature?: number
  humidity?: number

  // 土壌情報（プロフェッショナル土壌検査）
  soil_ph?: number                    // pH値
  soil_ec?: number                    // EC（mS/cm）
  phosphorus_absorption?: number      // りん酸吸収係数
  available_phosphorus?: number       // 有効態りん酸（mg/100g）
  cec?: number                       // CEC（me/100g）
  exchangeable_calcium?: number       // 交換性石灰（mg/100g）
  exchangeable_magnesium?: number     // 交換性苦土（mg/100g）
  exchangeable_potassium?: number     // 交換性加里（mg/100g）
  base_saturation?: number           // 塩基飽和度（%）
  calcium_magnesium_ratio?: number   // 石灰苦土比
  magnesium_potassium_ratio?: number // 苦土加里比
  available_silica?: number          // 有効態けい酸（mg/100g）
  free_iron_oxide?: number           // 遊離酸化鉄（%）
  humus_content?: number             // 腐植含量（%）
  ammonium_nitrogen?: number         // アンモニア態窒素（mg/100g）
  nitrate_nitrogen?: number          // 硝酸態窒素（mg/100g）
  manganese?: number                 // マンガン（mg/100g）
  boron?: number                     // ホウ素（mg/100g）
  soil_notes?: string                // 土壌観察メモ
  
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
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const { notifyWorkReportChange } = useRealtimeSync()
  
  // フォーム状態
  const [selectedVegetable, setSelectedVegetable] = useState('')
  const [soilInfoVisible, setSoilInfoVisible] = useState(false)
  const [currentReport, setCurrentReport] = useState<WorkReport>({
    vegetable_id: '',
    work_date: format(new Date(), 'yyyy-MM-dd'),
    work_type: 'other'
  })
  
  // 写真アップロード状態
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([])
  
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

  // バリデーション状態
  const [showValidationModal, setShowValidationModal] = useState(false)
  const [validationWarnings, setValidationWarnings] = useState<string[]>([])

  // 手動反映機能用の参照
  const [manualReflectFunction, setManualReflectFunction] = useState<((amount: number, itemName: string) => void) | null>(null)

  // デバッグ用: onManualReflectコールバック
  const handleManualReflectCallback = (reflectFunction: (amount: number, itemName: string) => void) => {
    
    setManualReflectFunction(() => reflectFunction)
  }
  
  // ユーザー情報（会計機能用）
  const [userInfo, setUserInfo] = useState<{
    company_id: string
    user_id: string
  }>({
    company_id: '',
    user_id: ''
  })

  // 認証情報の取得
  useEffect(() => {
    const fetchUserAuth = async () => {
      try {
        
        const response = await fetch('/api/auth/user')
        
        if (!response.ok) {
          throw new Error(`認証エラー: ${response.status}`)
        }
        
        const result = await response.json()
        
        if (result.success && result.user?.company_id) {
          
          setCompanyId(result.user.company_id)
          setUserInfo({
            company_id: result.user.company_id,
            user_id: result.user.id || ''
          })
          setAuthError(null)
        } else {
          throw new Error('ユーザー情報の取得に失敗しました')
        }
      } catch (error) {
        
        setAuthError(error instanceof Error ? error.message : '認証エラーが発生しました')
        setCompanyId(null)
      }
    }
    
    fetchUserAuth()
  }, [])

  useEffect(() => {
    if (open && companyId) {
      fetchVegetables()
    }
  }, [open, companyId])

  const fetchVegetables = async () => {
    if (!companyId) {
      
      return
    }
    
    setLoading(true)
    try {
      
      
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
          
          // テストデータを表示せず、空の配列を設定
          setVegetables([])
        }
      } else {
        
        // エラー時は空の配列を設定
        setVegetables([])
      }
    } catch (error) {
      
      // エラー時は空の配列を設定
      setVegetables([])
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

  // 会計記録に手動反映する関数
  const handleReflectToAccounting = () => {
    
    
    
    if (manualReflectFunction && currentReport.expected_revenue && currentReport.expected_revenue > 0) {
      
      manualReflectFunction(currentReport.expected_revenue, '収穫売上')
    } else {
      
    }
  }

  // 作業種類に応じた動的フィールドを取得
  const getDynamicFields = (workType: string) => {
    switch (workType) {
      case 'seeding':
        return {
          showAmount: true,
          showCost: false, // 旧コスト情報は廃止
          showFertilizer: false,
          showHarvest: false,
          amountLabel: '播種量',
          amountUnits: ['kg', 'g', '粒', '株']
        }
      case 'planting':
        return {
          showAmount: true,
          showCost: false, // 旧コスト情報は廃止
          showFertilizer: false,
          showHarvest: false,
          amountLabel: '定植数',
          amountUnits: ['株', '個']
        }
      case 'fertilizing':
        return {
          showAmount: false,
          showCost: false, // 旧コスト情報は廃止
          showFertilizer: true,
          showHarvest: false
        }
      case 'watering':
        return {
          showAmount: true,
          showCost: false, // 旧コスト情報は廃止
          showFertilizer: false,
          showHarvest: false,
          amountLabel: '灌水量',
          amountUnits: ['L', 'ml', 'm2']
        }
      case 'harvesting':
        return {
          showAmount: false,
          showCost: false, // 旧コスト情報は廃止
          showFertilizer: false,
          showHarvest: true
        }
      default:
        return {
          showAmount: false,
          showCost: false, // 旧コスト情報は廃止
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
    
    // 会計データに不完全なエントリがあるかチェック
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
    
    // 金額が入力されているのに項目が選択されていない場合もチェック
    const hasAmountWithoutItem = accountingData.income_items.some(item => 
      item.amount > 0 && (!item.accounting_item_id || item.accounting_item_id === '')
    ) || accountingData.expense_items.some(item => 
      item.amount > 0 && (!item.accounting_item_id || item.accounting_item_id === '')
    )
    
    if (hasAmountWithoutItem) {
      warnings.push('金額が入力されているのに項目が選択されていない記録があります')
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

    await proceedWithSave()
  }

  const proceedWithSave = async () => {
    if (!companyId) {
      
      return
    }
    
    setSaving(true)
    try {
      
      let createdBy = userInfo.user_id || 'd0efa1ac-7e7e-420b-b147-dabdf01454b7' // デフォルト
      
      // プロフェッショナル版：包括的なデータ構造
      const reportToSave = {
        ...currentReport,
        company_id: companyId,
        photos: uploadedPhotos,
        created_by: createdBy,
        
        // 分析用追加フィールド - 分を時間に変換
        duration_hours: currentReport.work_duration ? (currentReport.work_duration / 60) : null,
        worker_count: currentReport.worker_count || 1,
        
        // 収穫データ（分析ページ連携用）
        harvest_amount: currentReport.harvest_amount || null,
        harvest_unit: currentReport.harvest_unit || null,
        harvest_quality: currentReport.harvest_quality || null,
        expected_price: currentReport.expected_price || null,
        
        // 売上データをnotesに構造化形式で保存
        notes: JSON.stringify({
          work_notes: currentReport.work_notes || null,
          expected_revenue: currentReport.expected_revenue || null,
          sales_amount: currentReport.expected_revenue || null
        }),
        
        // 環境データ
        weather: currentReport.weather || null,
        temperature_morning: currentReport.temperature_morning || null,
        temperature_afternoon: currentReport.temperature_afternoon || null,
        humidity: currentReport.humidity || null,
        
        // 肥料データ
        fertilizer_type: currentReport.fertilizer_type || null,
        fertilizer_amount: currentReport.fertilizer_amount || null,
        fertilizer_unit: currentReport.fertilizer_unit || null,
        
        // 土壌データ
        soil_ph: currentReport.soil_ph || null,
        soil_moisture: currentReport.soil_moisture || null,
        soil_temperature: currentReport.soil_temperature || null,
        
        // 作業詳細（notes統合）
        description: currentReport.work_notes || currentReport.description || null,
        work_notes: currentReport.work_notes || null
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
        
        
        // 会計データの保存（完全なデータのみ）
        const validIncomeItems = accountingData.income_items.filter(item => 
          item.accounting_item_id && item.accounting_item_id !== '' && item.amount > 0
        )
        const validExpenseItems = accountingData.expense_items.filter(item => 
          item.accounting_item_id && item.accounting_item_id !== '' && item.amount > 0
        )
        
        if (validIncomeItems.length > 0 || validExpenseItems.length > 0) {
          try {
            const accountingPayload = {
              work_report_id: result.data.id,
              company_id: userInfo.company_id,
              work_type: currentReport.work_type,
              income_items: validIncomeItems,
              expense_items: validExpenseItems
            }
            
            
            
            const accountingResponse = await fetch('/api/work-accounting', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(accountingPayload)
            })
            
            
            
            const accountingResult = await accountingResponse.json()
            
            
            if (accountingResult.success) {
              
            } else {
              
              
              alert(`❌ 会計データ保存失敗: "${accountingResult.error}"`)
              setSaving(false)
              return
            }
          } catch (accountingError) {
            
          }
        }
        
        // プロフェッショナル通知
        const netIncomeText = accountingData.net_income !== 0 ? `\n純損益: ¥${accountingData.net_income.toLocaleString()}` : ''
        alert(`作業報告を保存しました！\n\n作業種類: ${WORK_TYPES.find(t => t.value === currentReport.work_type)?.label}\n対象野菜: ${vegetables.find(v => v.id === currentReport.vegetable_id)?.name}\n作業日: ${currentReport.work_date}${netIncomeText}`)
        
        // 分析データ同期通知
        analyticsDataSync.syncWorkReportToAnalytics(result.data, vegetables)
        
        // リアルタイム同期通知
        notifyWorkReportChange('created', result.data)
        
        // フォームリセット
        setCurrentReport({
          vegetable_id: '',
          work_date: format(new Date(), 'yyyy-MM-dd'),
          work_type: 'other'
        })
        setSelectedVegetable('')
        setUploadedPhotos([])
        
        // 会計データリセット
        setAccountingData({
          income_items: [],
          expense_items: [],
          income_total: 0,
          expense_total: 0,
          net_income: 0
        })
        
        // 成功コールバック
        if (onSuccess) onSuccess()
        
        // モーダル閉じる
        onOpenChange(false)
        
        // 分析データと自動同期
        try {
          analyticsDataSync.syncWorkReportToAnalytics(reportToSave, vegetables)
        } catch (syncError) {
          
        }
        
        // フォームリセット
        setCurrentReport({
          vegetable_id: '',
          work_date: format(new Date(), 'yyyy-MM-dd'),
          work_type: 'other'
        })
        setSelectedVegetable('')
        setUploadedPhotos([])
        
        // 会計データリセット
        setAccountingData({
          income_items: [],
          expense_items: [],
          income_total: 0,
          expense_total: 0,
          net_income: 0
        })
        
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
      
      alert('保存に失敗しました。ネットワーク接続を確認してください。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] xl:max-w-[1200px] max-h-[95vh] p-0 bg-white overflow-hidden flex flex-col">
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
          <div className="py-8 text-center bg-white flex-1 flex flex-col items-center justify-center">
            <Clock className="w-8 h-8 mx-auto mb-4 animate-spin text-green-600" />
            <p className="text-gray-600">データを読み込み中...</p>
          </div>
        ) : (
          <>
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
                                <span className="font-medium">{vegetable.name}</span>
                                <Badge variant="outline" className="text-xs bg-gray-100">
                                  {vegetable.plot_name}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-4 text-center text-gray-500 text-sm">
                            登録された野菜がありません。<br />
                            まず野菜を登録してから作業記録を作成してください。
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
                                    // NUMERIC(4,1)の制限を考慮（最大999）
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

                          {/* 交換性塩基類 */}
                          <div>
                            <h5 className="text-md font-medium text-amber-800 mb-3">交換性塩基類</h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                              <div className="space-y-2">
                                <Label className="text-amber-700">交換性石灰（mg/100g）</Label>
                                <Input
                                  type="number"
                                  value={currentReport.exchangeable_calcium || ''}
                                  onChange={(e) => handleInputChange('exchangeable_calcium', parseFloat(e.target.value) || undefined)}
                                  placeholder="例: 350"
                                  step="1"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label className="text-amber-700">交換性苦土（mg/100g）</Label>
                                <Input
                                  type="number"
                                  value={currentReport.exchangeable_magnesium || ''}
                                  onChange={(e) => handleInputChange('exchangeable_magnesium', parseFloat(e.target.value) || undefined)}
                                  placeholder="例: 60"
                                  step="1"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label className="text-amber-700">交換性加里（mg/100g）</Label>
                                <Input
                                  type="number"
                                  value={currentReport.exchangeable_potassium || ''}
                                  onChange={(e) => handleInputChange('exchangeable_potassium', parseFloat(e.target.value) || undefined)}
                                  placeholder="例: 25"
                                  step="1"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label className="text-amber-700">塩基飽和度（%）</Label>
                                <Input
                                  type="number"
                                  value={currentReport.base_saturation || ''}
                                  onChange={(e) => handleInputChange('base_saturation', parseFloat(e.target.value) || undefined)}
                                  placeholder="例: 85.0"
                                  step="0.1"
                                  min="0"
                                  max="100"
                                />
                              </div>
                            </div>
                          </div>

                          {/* 塩基バランス */}
                          <div>
                            <h5 className="text-md font-medium text-amber-800 mb-3">塩基バランス</h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-amber-700">石灰苦土比</Label>
                                <Input
                                  type="number"
                                  value={currentReport.calcium_magnesium_ratio || ''}
                                  onChange={(e) => handleInputChange('calcium_magnesium_ratio', parseFloat(e.target.value) || undefined)}
                                  placeholder="例: 5.8"
                                  step="0.1"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label className="text-amber-700">苦土加里比</Label>
                                <Input
                                  type="number"
                                  value={currentReport.magnesium_potassium_ratio || ''}
                                  onChange={(e) => handleInputChange('magnesium_potassium_ratio', parseFloat(e.target.value) || undefined)}
                                  placeholder="例: 2.4"
                                  step="0.1"
                                />
                              </div>
                            </div>
                          </div>

                          {/* 養分・有機物 */}
                          <div>
                            <h5 className="text-md font-medium text-amber-800 mb-3">養分・有機物</h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              <div className="space-y-2">
                                <Label className="text-amber-700">有効態りん酸（mg/100g）</Label>
                                <Input
                                  type="number"
                                  value={currentReport.available_phosphorus || ''}
                                  onChange={(e) => handleInputChange('available_phosphorus', parseFloat(e.target.value) || undefined)}
                                  placeholder="例: 30"
                                  step="0.1"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label className="text-amber-700">有効態けい酸（mg/100g）</Label>
                                <Input
                                  type="number"
                                  value={currentReport.available_silica || ''}
                                  onChange={(e) => handleInputChange('available_silica', parseFloat(e.target.value) || undefined)}
                                  placeholder="例: 15"
                                  step="0.1"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label className="text-amber-700">腐植含量（%）</Label>
                                <Input
                                  type="number"
                                  value={currentReport.humus_content || ''}
                                  onChange={(e) => handleInputChange('humus_content', parseFloat(e.target.value) || undefined)}
                                  placeholder="例: 4.2"
                                  step="0.1"
                                />
                              </div>
                            </div>
                          </div>

                          {/* 窒素形態 */}
                          <div>
                            <h5 className="text-md font-medium text-amber-800 mb-3">窒素形態</h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-amber-700">アンモニア態窒素（mg/100g）</Label>
                                <Input
                                  type="number"
                                  value={currentReport.ammonium_nitrogen || ''}
                                  onChange={(e) => handleInputChange('ammonium_nitrogen', parseFloat(e.target.value) || undefined)}
                                  placeholder="例: 5.2"
                                  step="0.1"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label className="text-amber-700">硝酸態窒素（mg/100g）</Label>
                                <Input
                                  type="number"
                                  value={currentReport.nitrate_nitrogen || ''}
                                  onChange={(e) => handleInputChange('nitrate_nitrogen', parseFloat(e.target.value) || undefined)}
                                  placeholder="例: 8.5"
                                  step="0.1"
                                />
                              </div>
                            </div>
                          </div>

                          {/* 微量要素・その他 */}
                          <div>
                            <h5 className="text-md font-medium text-amber-800 mb-3">微量要素・その他</h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                              <div className="space-y-2">
                                <Label className="text-amber-700">マンガン（mg/100g）</Label>
                                <Input
                                  type="number"
                                  value={currentReport.manganese || ''}
                                  onChange={(e) => handleInputChange('manganese', parseFloat(e.target.value) || undefined)}
                                  placeholder="例: 15.0"
                                  step="0.1"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label className="text-amber-700">ホウ素（mg/100g）</Label>
                                <Input
                                  type="number"
                                  value={currentReport.boron || ''}
                                  onChange={(e) => handleInputChange('boron', parseFloat(e.target.value) || undefined)}
                                  placeholder="例: 0.8"
                                  step="0.1"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label className="text-amber-700">遊離酸化鉄（%）</Label>
                                <Input
                                  type="number"
                                  value={currentReport.free_iron_oxide || ''}
                                  onChange={(e) => handleInputChange('free_iron_oxide', parseFloat(e.target.value) || undefined)}
                                  placeholder="例: 2.5"
                                  step="0.1"
                                />
                              </div>
                            </div>
                          </div>

                          {/* 土壌観察メモ */}
                          <div className="space-y-2">
                            <Label className="text-amber-700">土壌観察メモ</Label>
                            <Textarea
                              value={currentReport.soil_notes || ''}
                              onChange={(e) => handleInputChange('soil_notes', e.target.value)}
                              placeholder="土壌の色、質感、構造、根張りの状況、土壌検査機関の所見など..."
                              rows={3}
                            />
                          </div>

                          <div className="mt-4 p-3 bg-amber-100 border border-amber-300 rounded-lg">
                            <p className="text-sm text-amber-800">
                              💡 <strong>プロフェッショナル土壌診断：</strong>
                              pH6.0-6.8、CEC20以上、塩基飽和度80%以上、石灰苦土比5-7、苦土加里比2-3が理想的です。
                              定期検査で土壌改良効果を科学的に追跡できます。
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

                      {/* 旧コスト情報セクションは削除 - 新しい会計記録システムに統合 */}
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
                        <span className="text-emerald-600 font-medium">💡 作業種類に応じてAIが適切な会計項目を推奨します。実績金額を入力するだけで正確な経営分析が可能です。</span>
                      </div>
                      
                      {userInfo.company_id ? (
                        <WorkAccountingInput
                          workType={currentReport.work_type}
                          companyId={userInfo.company_id}
                          onDataChange={setAccountingData}
                          onManualReflect={handleManualReflectCallback}
                        />
                      ) : (
                        <div className="text-center py-6">
                          <div className="text-gray-500">会社情報の取得中...</div>
                        </div>
                      )}
                    </div>
                    
                    {/* 写真アップロード */}
                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
                      <h4 className="text-lg font-semibold text-purple-800 mb-4 flex items-center">
                        <Camera className="w-5 h-5 mr-2" />
                        現場写真
                      </h4>
                      <PhotoUpload
                        vegetableId={selectedVegetable}
                        onUploadSuccess={() => {
                          
                        }}
                      />
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
                    onClick={async () => {
                      setShowValidationModal(false)
                      await proceedWithSave()
                    }}
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    このまま保存
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}