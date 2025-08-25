'use client'

import React, { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getWorkTypeIcon, getWorkTypeLabel, safeFormatDate, formatCurrency } from '@/lib/work-report-utils'
import { 
  Calendar, 
  Clock, 
  TrendingUp,
  Sprout,
  FileText,
  Edit,
  Eye
} from 'lucide-react'

interface WorkReportPopoverProps {
  report: any
  children: React.ReactNode
  onEdit?: (report: any) => void
  onView?: (report: any) => void
}


const getWeatherIcon = (weather: string) => {
  const icons: { [key: string]: string } = {
    sunny: '☀️',
    cloudy: '☁️',
    rainy: '🌧️',
    windy: '💨'
  }
  return icons[weather] || '🌤️'
}

export function WorkReportPopover({ report, children, onEdit, onView }: WorkReportPopoverProps) {
  const [accountingData, setAccountingData] = useState<any>(null)
  const [isOpen, setIsOpen] = useState(false)
  
  // 会計データを取得
  useEffect(() => {
    if (report?.id && isOpen) {
      const fetchAccountingData = async () => {
        try {
          const response = await fetch(`/api/work-accounting?work_report_id=${report.id}`)
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
  }, [report?.id, isOpen])

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsOpen(false)
    if (onEdit) onEdit(report)
  }

  const handleView = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsOpen(false)
    if (onView) onView(report)
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent 
        className="w-96 p-0 shadow-2xl border-2 bg-white" 
        side="top" 
        align="center"
        sideOffset={10}
      >
        <Card className="border-0 shadow-none">
          {/* ヘッダー */}
          <CardHeader className="pb-3 bg-gradient-to-r from-blue-50 via-green-50 to-blue-50 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border">
                  <span className="text-xl">{getWorkTypeIcon(report.work_type)}</span>
                </div>
                <div>
                  <CardTitle className="text-lg text-gray-900">
                    {getWorkTypeLabel(report.work_type)}
                  </CardTitle>
                  <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                    <Calendar className="w-4 h-4" />
                    {safeFormatDate(report.work_date)}
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="basic" className="text-xs">基本・会計</TabsTrigger>
                <TabsTrigger value="details" className="text-xs">詳細・備考</TabsTrigger>
              </TabsList>
              
              <TabsContent value="basic" className="space-y-4 mt-0">
                {/* 基本情報 */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    基本情報
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {report.duration_hours && (
                      <div className="bg-blue-50 p-2 rounded border border-blue-200">
                        <div className="font-semibold text-blue-700">{Math.round(report.duration_hours * 60)}分</div>
                        <div className="text-xs text-blue-600">作業時間</div>
                      </div>
                    )}
                    
                    {report.worker_count && (
                      <div className="bg-green-50 p-2 rounded border border-green-200">
                        <div className="font-semibold text-green-700">{report.worker_count}人</div>
                        <div className="text-xs text-green-600">作業人数</div>
                      </div>
                    )}
                    
                    {report.weather && (
                      <div className="bg-yellow-50 p-2 rounded border border-yellow-200">
                        <div className="font-semibold text-yellow-700 flex items-center gap-1">
                          <span>{getWeatherIcon(report.weather)}</span>
                          {report.weather === 'sunny' ? '晴れ' :
                           report.weather === 'cloudy' ? '曇り' :
                           report.weather === 'rainy' ? '雨' :
                           report.weather === 'windy' ? '風' : report.weather}
                        </div>
                        <div className="text-xs text-yellow-600">天候</div>
                      </div>
                    )}
                    
                    {report.temperature && (
                      <div className="bg-red-50 p-2 rounded border border-red-200">
                        <div className="font-semibold text-red-700">{report.temperature}℃</div>
                        <div className="text-xs text-red-600">気温</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 会計情報 */}
                {accountingData && (accountingData.income_items?.length > 0 || accountingData.expense_items?.length > 0) && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-emerald-700 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      収支サマリー
                    </h4>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-green-50 p-2 rounded text-center border border-green-200">
                        <div className="font-bold text-green-700">{formatCurrency(accountingData.income_total)}</div>
                        <div className="text-green-600">収入</div>
                      </div>
                      <div className="bg-red-50 p-2 rounded text-center border border-red-200">
                        <div className="font-bold text-red-700">{formatCurrency(accountingData.expense_total)}</div>
                        <div className="text-red-600">支出</div>
                      </div>
                      <div className="bg-emerald-50 p-2 rounded text-center border border-emerald-200">
                        <div className={`font-bold ${accountingData.net_income >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          {formatCurrency(accountingData.net_income)}
                        </div>
                        <div className="text-emerald-600">純利益</div>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="details" className="space-y-4 mt-0">
                {/* 成果情報 */}
                {report.harvest_amount && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-green-700 flex items-center gap-2">
                      <Sprout className="w-4 h-4" />
                      収穫成果
                    </h4>
                    <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-green-800">
                            {report.harvest_amount}{report.harvest_unit || 'kg'}
                          </span>
                          {report.harvest_quality && (
                            <Badge variant="outline" className={`ml-2 ${
                              report.harvest_quality === 'excellent' ? 'bg-green-100 text-green-700' :
                              report.harvest_quality === 'good' ? 'bg-blue-100 text-blue-700' :
                              report.harvest_quality === 'average' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {report.harvest_quality === 'excellent' && '優秀'}
                              {report.harvest_quality === 'good' && '良好'}
                              {report.harvest_quality === 'average' && '平均'}
                              {report.harvest_quality === 'poor' && '要改善'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 作業備考 */}
                {(report.work_notes || report.notes) && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      備考・メモ
                    </h4>
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {report.work_notes || report.notes}
                      </p>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* アクションボタン */}
            <div className="flex justify-center gap-2 mt-4 pt-4 border-t border-gray-200">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleView}
                className="flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                詳細表示
              </Button>
              <Button 
                size="sm" 
                onClick={handleEdit}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <Edit className="w-4 h-4" />
                編集
              </Button>
            </div>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  )
}