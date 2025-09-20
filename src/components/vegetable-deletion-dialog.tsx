'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, Clock, Database, Image, TrendingUp, FileText, MapPin, Calendar } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Progress } from '@/components/ui/progress'

interface DeletionImpact {
  vegetable: {
    id: string
    name: string
    variety_name: string
    plot_name: string
    planting_date: string
    area_size: number
    plant_count: number
    growth_period_days: number
    status: string
  }
  relatedData: {
    growingTasks: {
      total: number
      byStatus: Record<string, number>
      criticalTasks: any[]
    }
    workReports: {
      total: number
      byType: Record<string, number>
      harvestData: {
        totalAmount: number
        totalRevenue: number
        lastHarvestDate: string | null
      }
    }
    photos: {
      total: number
      storageSize: number
      keyMilestones: any[]
    }
  }
  businessImpact: {
    dataLossWarning: string[]
    alternativeActions: string[]
    riskLevel: 'low' | 'medium' | 'high'
  }
}

interface VegetableDeletionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vegetableId: string
  onConfirmDeletion: (deletionData: {
    reason: string
    confirmationText: string
    acknowledgeDataLoss: boolean
  }) => Promise<void>
}

export function VegetableDeletionDialog({
  open,
  onOpenChange,
  vegetableId,
  onConfirmDeletion
}: VegetableDeletionDialogProps) {
  const [step, setStep] = useState(1)
  const [impact, setImpact] = useState<DeletionImpact | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  
  // Confirmation state
  const [confirmationText, setConfirmationText] = useState('')
  const [reason, setReason] = useState<'cultivation_completed' | 'data_cleanup' | 'error_correction'>('cultivation_completed')
  const [acknowledgeDataLoss, setAcknowledgeDataLoss] = useState(false)

  const resetState = () => {
    setStep(1)
    setImpact(null)
    setConfirmationText('')
    setReason('cultivation_completed')
    setAcknowledgeDataLoss(false)
  }

  useEffect(() => {
    if (open && vegetableId) {
      fetchDeletionImpact()
    } else {
      resetState()
    }
  }, [open, vegetableId])

  const fetchDeletionImpact = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/vegetables/${vegetableId}/deletion-impact`)
      if (!response.ok) throw new Error('Failed to fetch deletion impact')
      
      const result = await response.json()
      setImpact(result.data)
    } catch (error) {
      
      // Show error message to user
    } finally {
      setLoading(false)
    }
  }

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'high': return 'bg-red-100 border-red-500 text-red-900'
      case 'medium': return 'bg-orange-100 border-orange-500 text-orange-900'
      case 'low': return 'bg-green-100 border-green-500 text-green-900'
      default: return 'bg-gray-100 border-gray-500 text-gray-900'
    }
  }

  const getRiskIcon = (riskLevel: string) => {
    switch (riskLevel) {
      case 'high': return '🔴'
      case 'medium': return '🟡' 
      case 'low': return '🟢'
      default: return '⚪'
    }
  }

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case 'cultivation_completed': return '栽培完了による削除'
      case 'data_cleanup': return 'データクリーンアップ'
      case 'error_correction': return '登録ミス修正'
      default: return reason
    }
  }

  const handleConfirm = async () => {
    if (!impact) return
    
    setDeleting(true)
    try {
      await onConfirmDeletion({
        reason: getReasonLabel(reason),
        confirmationText,
        acknowledgeDataLoss
      })
      onOpenChange(false)
    } catch (error) {
      
    } finally {
      setDeleting(false)
    }
  }

  const isConfirmationValid = 
    confirmationText.trim() === '削除' && 
    acknowledgeDataLoss &&
    impact?.vegetable.name

  if (loading || !impact) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3">削除影響を分析中...</span>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <DialogHeader className={`pb-4 border-b ${getRiskColor(impact.businessImpact.riskLevel)}`}>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                野菜計画の完全削除 {getRiskIcon(impact.businessImpact.riskLevel)}
              </DialogTitle>
              <p className="text-sm opacity-75 mt-1">
                この操作は取り消すことができません - すべての関連データが完全に削除されます
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm opacity-75">削除対象</div>
              <div className="font-semibold text-lg">{impact.vegetable.name}</div>
            </div>
          </div>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-6 py-6">
            {/* 野菜基本情報 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  削除対象の詳細
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">野菜名:</span>
                      <span className="font-semibold">{impact.vegetable.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">品種:</span>
                      <span>{impact.vegetable.variety_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">圃場:</span>
                      <span>{impact.vegetable.plot_name}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">植付日:</span>
                      <span>{new Date(impact.vegetable.planting_date).toLocaleDateString('ja-JP')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">栽培期間:</span>
                      <span>{impact.vegetable.growth_period_days} 日</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">面積:</span>
                      <span>{impact.vegetable.area_size} ㎡</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 削除される関連データ */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  削除される関連データ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-6">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                    <div className="text-2xl font-bold text-blue-900">
                      {impact.relatedData.growingTasks.total}
                    </div>
                    <div className="text-sm text-blue-700">栽培タスク</div>
                    {impact.relatedData.growingTasks.criticalTasks.length > 0 && (
                      <Badge variant="destructive" className="mt-1 text-xs">
                        進行中 {impact.relatedData.growingTasks.criticalTasks.length} 件
                      </Badge>
                    )}
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-600" />
                    <div className="text-2xl font-bold text-green-900">
                      {impact.relatedData.workReports.total}
                    </div>
                    <div className="text-sm text-green-700">作業記録</div>
                    {impact.relatedData.workReports.harvestData.totalRevenue > 0 && (
                      <div className="text-xs text-green-600 mt-1">
                        ¥{impact.relatedData.workReports.harvestData.totalRevenue.toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <Image className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                    <div className="text-2xl font-bold text-purple-900">
                      {impact.relatedData.photos.total}
                    </div>
                    <div className="text-sm text-purple-700">写真</div>
                    <div className="text-xs text-purple-600 mt-1">
                      {impact.relatedData.photos.storageSize.toFixed(1)} MB
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* データ損失警告 */}
            {impact.businessImpact.dataLossWarning.length > 0 && (
              <Card className="border-red-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-700">
                    <AlertTriangle className="w-5 h-5" />
                    データ損失の警告
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {impact.businessImpact.dataLossWarning.map((warning, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-red-500 text-lg leading-none">•</span>
                        <span className="text-red-700">{warning}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* 代替アクション */}
            {impact.businessImpact.alternativeActions.length > 0 && (
              <Card className="border-blue-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-700">
                    💡 推奨される代替アクション
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {impact.businessImpact.alternativeActions.map((action, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-blue-500 text-lg leading-none">•</span>
                        <span className="text-blue-700">{action}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                キャンセル
              </Button>
              <Button 
                onClick={() => setStep(2)}
                className="bg-red-600 hover:bg-red-700"
              >
                削除を続行
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 py-6">
            <div className="text-center py-4">
              <h3 className="text-xl font-bold text-red-900 mb-2">最終確認</h3>
              <p className="text-red-700">
                以下の確認事項をすべて完了してください
              </p>
            </div>

            {/* 削除理由選択 */}
            <Card>
              <CardHeader>
                <CardTitle>削除理由の選択</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup value={reason} onValueChange={(value: any) => setReason(value)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cultivation_completed" id="completed" />
                    <Label htmlFor="completed">栽培完了による削除</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="data_cleanup" id="cleanup" />
                    <Label htmlFor="cleanup">データクリーンアップ</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="error_correction" id="error" />
                    <Label htmlFor="error">登録ミス修正</Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            {/* テキスト確認 */}
            <Card>
              <CardHeader>
                <CardTitle>削除確認</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-gray-700">
                    <strong>「{impact.vegetable.name}」</strong> を完全に削除することを確認するため、
                    以下のボックスに <strong className="text-red-600">「削除」</strong> と入力してください。
                  </p>
                  <Input
                    placeholder="削除"
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value)}
                    className={confirmationText === '削除' ? 'border-green-500' : 'border-red-300'}
                  />
                </div>
              </CardContent>
            </Card>

            {/* データ損失の理解確認 */}
            <Card>
              <CardHeader>
                <CardTitle>データ損失の理解</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="acknowledge"
                    checked={acknowledgeDataLoss}
                    onCheckedChange={(checked) => setAcknowledgeDataLoss(!!checked)}
                  />
                  <Label htmlFor="acknowledge" className="text-sm leading-relaxed">
                    この野菜に関連するすべてのデータ（栽培タスク、作業記録、写真など）が
                    <strong className="text-red-600">完全に削除される</strong>ことを理解し、
                    この操作が<strong className="text-red-600">取り消し不可能</strong>であることを承認します。
                  </Label>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                戻る
              </Button>
              <Button 
                onClick={handleConfirm}
                disabled={!isConfirmationValid || deleting}
                className="bg-red-600 hover:bg-red-700 min-w-[120px]"
              >
                {deleting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    削除中...
                  </div>
                ) : (
                  '完全削除を実行'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}