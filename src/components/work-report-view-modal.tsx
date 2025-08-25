'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { InfoCard } from '@/components/ui/info-card'
import CompletionIndicator from '@/components/ui/completion-indicator'
import { getWorkTypeIcon, getWorkTypeLabel, formatDate } from '@/lib/work-report-utils'
import { 
  Edit, 
  Calendar, 
  MapPin, 
  Clock,
  Camera,
  FileText,
  TrendingUp
} from 'lucide-react'

interface WorkReportViewModalProps {
  workReport: any
  isOpen: boolean
  onClose: () => void
  onEdit: (workReport: any) => void
}


export default function WorkReportViewModal({ 
  workReport, 
  isOpen, 
  onClose, 
  onEdit 
}: WorkReportViewModalProps) {
  const [vegetableInfo, setVegetableInfo] = useState<any>(null)
  const [accountingData, setAccountingData] = useState<any>(null)

  useEffect(() => {
    if (workReport?.vegetable_id && workReport?.vegetables) {
      setVegetableInfo({
        name: workReport.vegetables.name,
        variety: workReport.vegetables.variety_name,
        plot_name: workReport.vegetables.plot_name
      })
    } else if (workReport?.vegetable_id) {
      const fetchVegetableInfo = async () => {
        try {
          const response = await fetch(`/api/vegetables?company_id=${workReport.company_id}&limit=1000`)
          if (response.ok) {
            const result = await response.json()
            if (result.success && result.data) {
              const vegetable = result.data.find((v: any) => v.id === workReport.vegetable_id)
              if (vegetable) {
                setVegetableInfo({
                  name: vegetable.name,
                  variety: vegetable.variety_name,
                  plot_name: vegetable.plot_name
                })
              }
            }
          }
        } catch (error) {
          console.error('野菜情報取得エラー:', error)
          setVegetableInfo({
            name: 'Unknown',
            variety: '',
            plot_name: 'Unknown'
          })
        }
      }
      fetchVegetableInfo()
    }
  }, [workReport?.vegetable_id, workReport?.vegetables, workReport?.company_id])

  useEffect(() => {
    if (workReport?.id && isOpen) {
      const fetchAccountingData = async () => {
        try {
          const response = await fetch(`/api/work-accounting?work_report_id=${workReport.id}`)
          if (response.ok) {
            const result = await response.json()
            if (result.success) {
              setAccountingData(result.data)
            }
          }
        } catch (error) {
          console.error('会計データ取得エラー:', error)
        }
      }
      fetchAccountingData()
    }
  }, [workReport?.id, isOpen])

  if (!workReport) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose} modal>
      <DialogContent className="max-w-4xl w-[99vw] max-h-[98vh] overflow-y-auto bg-white shadow-2xl border-0 p-0 gap-0">
        <DialogHeader className="sr-only">
          <DialogTitle>
            {vegetableInfo?.name || 'Unknown'} - {getWorkTypeLabel(workReport.work_type)} 作業記録詳細
          </DialogTitle>
        </DialogHeader>
        
        <div className="bg-gradient-to-r from-slate-50 via-blue-50 to-indigo-50 p-6 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-md border border-gray-200">
                  <span className="text-2xl">{getWorkTypeIcon(workReport.work_type)}</span>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-2xl font-bold text-gray-900">
                      {vegetableInfo?.name || 'Unknown'}
                    </h2>
                    {vegetableInfo?.variety && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        {vegetableInfo.variety}
                      </Badge>
                    )}
                    <Badge className="bg-blue-600 text-white">
                      {getWorkTypeLabel(workReport.work_type)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(workReport.work_date)}
                    </div>
                    {vegetableInfo?.plot_name && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {vegetableInfo.plot_name}
                      </div>
                    )}
                    {workReport.created_at && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        記録日: {new Date(workReport.created_at).toLocaleDateString('ja-JP')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white">
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-3">📊 記録の完成度</h4>
            <CompletionIndicator 
              workReport={workReport} 
              showDetails={false} 
              size="md" 
            />
          </div>

          <div className="bg-gradient-to-r from-blue-50 via-green-50 to-blue-50 p-6 rounded-xl mb-6 border border-blue-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {workReport.work_duration && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-700">{workReport.work_duration}</div>
                  <div className="text-sm text-blue-600">分</div>
                  <div className="text-xs text-gray-600 mt-1">作業時間</div>
                </div>
              )}
              {workReport.worker_count && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-700">{workReport.worker_count}</div>
                  <div className="text-sm text-green-600">人</div>
                  <div className="text-xs text-gray-600 mt-1">作業人数</div>
                </div>
              )}
              {workReport.harvest_amount && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-700">
                    {workReport.harvest_amount}
                    <span className="text-base ml-1">{workReport.harvest_unit || 'kg'}</span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">収穫量</div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <InfoCard title="基本情報" data={workReport} type="basic" />
            <InfoCard title="天候・環境情報" data={workReport} type="environment" />
            {workReport.work_type === 'harvesting' && (
              <InfoCard title="収穫情報" data={workReport} type="harvest" />
            )}
            <InfoCard title="土壌情報" data={workReport} type="soil" />
          </div>

          {/* 追加情報セクション */}
          <div className="mt-6 space-y-4">
            {/* 肥料情報 */}
            {workReport.work_type === 'fertilizing' && (workReport.fertilizer_type || workReport.fertilizer_amount) && (
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <h4 className="font-medium text-purple-800 mb-2 flex items-center gap-2">
                  💊 肥料情報
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {workReport.fertilizer_type && (
                    <div>
                      <span className="text-gray-600">種類: </span>
                      <span className="font-medium">{workReport.fertilizer_type}</span>
                    </div>
                  )}
                  {workReport.fertilizer_amount && (
                    <div>
                      <span className="text-gray-600">使用量: </span>
                      <span className="font-medium">
                        {workReport.fertilizer_amount}{workReport.fertilizer_unit || 'kg'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 会計・経済情報の統合表示 */}
            {(accountingData && (accountingData.income_items?.length > 0 || accountingData.expense_items?.length > 0)) ? (
              <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                <h4 className="font-medium text-emerald-800 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> 収支情報
                </h4>
                <div className="space-y-3">
                  {accountingData.income_items?.length > 0 && (
                    <div>
                      <h5 className="text-sm font-semibold text-green-700 mb-2">💰 収入</h5>
                      {accountingData.income_items.map((item: any, index: number) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span className="text-gray-600">{item.accounting_items?.name || item.custom_item_name}</span>
                          <span className="font-medium text-green-600">+¥{new Intl.NumberFormat('ja-JP').format(item.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {accountingData.expense_items?.length > 0 && (
                    <div>
                      <h5 className="text-sm font-semibold text-red-700 mb-2">💸 支出</h5>
                      {accountingData.expense_items.map((item: any, index: number) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span className="text-gray-600">{item.accounting_items?.name || item.custom_item_name}</span>
                          <span className="font-medium text-red-600">-¥{new Intl.NumberFormat('ja-JP').format(Math.abs(item.amount))}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="border-t border-emerald-200 pt-2">
                    <div className="flex justify-between font-bold">
                      <span className="text-emerald-800">純利益:</span>
                      <span className={`text-lg ${accountingData.net_income >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {accountingData.net_income >= 0 ? '+' : ''}¥{new Intl.NumberFormat('ja-JP').format(accountingData.net_income)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : workReport.expected_revenue && (
              <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                <h4 className="font-medium text-emerald-800 mb-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> 経済情報
                </h4>
                <div className="text-sm">
                  <span className="text-gray-600">想定売上: </span>
                  <span className="font-bold text-emerald-700 text-lg">
                    {new Intl.NumberFormat('ja-JP', { 
                      style: 'currency', 
                      currency: 'JPY',
                      minimumFractionDigits: 0 
                    }).format(workReport.expected_revenue)}
                  </span>
                </div>
              </div>
            )}

            {/* 写真セクション */}
            {workReport.photos && workReport.photos.length > 0 && (
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <Camera className="w-4 h-4" /> 現場写真 ({workReport.photos.length}枚)
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {workReport.photos.map((photo: string, index: number) => (
                    <img
                      key={index}
                      src={photo}
                      alt={`現場写真 ${index + 1}`}
                      className="w-full h-24 object-cover rounded border hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => window.open(photo, '_blank')}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-center gap-3 mt-8 pt-6 border-t border-gray-200 bg-gray-50 -mx-6 px-6 pb-6 rounded-b-lg">
            <Button 
              onClick={() => onEdit(workReport)} 
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 px-8 py-3 text-base font-semibold"
            >
              <Edit className="w-5 h-5 mr-2" />この記録を編集する
            </Button>
            <Button 
              onClick={onClose}
              variant="outline"
              size="lg"
              className="px-6 py-3 text-base border-gray-300 hover:bg-gray-100"
            >
              閉じる
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}