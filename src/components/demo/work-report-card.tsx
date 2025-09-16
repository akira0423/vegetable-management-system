'use client'

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Calendar,
  Clock,
  Users,
  Thermometer,
  Sprout,
  Settings,
  Trash2,
  Eye
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface WorkReportCardProps {
  report: any
  onClick?: (report: any) => void
  onEdit?: (report: any) => void
  onDelete?: (report: any) => void
}

const getWorkTypeIcon = (workType: string) => {
  switch (workType) {
    case 'seeding': return '🌱'
    case 'planting': return '🪴'
    case 'fertilizing': return '💊'
    case 'watering': return '💧'
    case 'weeding': return '🌿'
    case 'pruning': return '✂️'
    case 'harvesting': return '🥬'
    default: return '📝'
  }
}

const getWorkTypeLabel = (workType: string) => {
  const labels: { [key: string]: string } = {
    seeding: '播種・育苗',
    planting: '定植',
    fertilizing: '施肥',
    watering: '灌水',
    weeding: '除草',
    pruning: '整枝・摘芽',
    harvesting: '収穫',
    other: 'その他'
  }
  return labels[workType] || workType
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

const safeFormatDate = (dateString: string, formatType: string = 'MM/dd') => {
  if (!dateString) return '未記録'
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return '未記録'

    if (formatType === 'MM/dd') {
      return date.toLocaleDateString('ja-JP', {
        month: '2-digit',
        day: '2-digit'
      })
    }
    return date.toLocaleDateString('ja-JP')
  } catch (error) {
    return '未記録'
  }
}

export function WorkReportCard({ report, onClick, onEdit, onDelete }: WorkReportCardProps) {
  const handleCardClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (onClick) {
      onClick(report)
    }
  }

  const handleActionClick = (e: React.MouseEvent, action: string) => {
    e.preventDefault()
    e.stopPropagation()

    switch (action) {
      case 'edit':
        if (onEdit) onEdit(report)
        break
      case 'delete':
        if (onDelete) onDelete(report)
        break
    }
  }

  return (
    <Card className="relative overflow-hidden hover:shadow-lg transition-all duration-300 border border-gray-200 hover:border-blue-300 bg-white">
      {/* アクションメニュー */}
      <div className="absolute top-3 right-3 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 bg-white/90 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 shadow-sm"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem
              onClick={(e) => handleActionClick(e, 'edit')}
              className="flex items-center cursor-pointer"
            >
              <Eye className="w-4 h-4 mr-2" />
              詳細・編集
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => handleActionClick(e, 'delete')}
              className="flex items-center text-red-600 hover:bg-red-50 cursor-pointer"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              削除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CardContent className="p-0 cursor-pointer" onClick={handleCardClick}>
        {/* ヘッダー層 */}
        <div className="bg-gradient-to-r from-blue-50 via-green-50 to-blue-50 p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border">
                <span className="text-xl">{getWorkTypeIcon(report.work_type)}</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-600 text-white text-sm font-medium">
                    {getWorkTypeLabel(report.work_type)}
                  </Badge>
                  <div className="flex items-center gap-1 text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span className="font-medium">{safeFormatDate(report.work_date)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 基本情報層 */}
        <div className="p-4 bg-gray-50/50 border-b border-gray-100">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {(report.duration_hours) && (
              <div className="flex items-center gap-2 bg-white p-2 rounded-lg border">
                <Clock className="w-4 h-4 text-blue-500" />
                <div>
                  <div className="font-semibold text-blue-700">
                    {report.duration_hours ? `${report.duration_hours}時間` : ''}
                  </div>
                  <div className="text-xs text-gray-500">作業時間</div>
                </div>
              </div>
            )}

            {report.worker_count && (
              <div className="flex items-center gap-2 bg-white p-2 rounded-lg border">
                <Users className="w-4 h-4 text-green-500" />
                <div>
                  <div className="font-semibold text-green-700">{report.worker_count}人</div>
                  <div className="text-xs text-gray-500">作業人数</div>
                </div>
              </div>
            )}

            {report.weather && (
              <div className="flex items-center gap-2 bg-white p-2 rounded-lg border">
                <span className="text-base">{getWeatherIcon(report.weather)}</span>
                <div>
                  <div className="font-semibold text-gray-700">
                    {report.weather === 'sunny' ? '晴れ' :
                     report.weather === 'cloudy' ? '曇り' :
                     report.weather === 'rainy' ? '雨' :
                     report.weather === 'windy' ? '風' : report.weather}
                  </div>
                  <div className="text-xs text-gray-500">天候</div>
                </div>
              </div>
            )}

            {report.temperature && (
              <div className="flex items-center gap-2 bg-white p-2 rounded-lg border">
                <Thermometer className="w-4 h-4 text-red-500" />
                <div>
                  <div className="font-semibold text-red-700">{report.temperature}℃</div>
                  <div className="text-xs text-gray-500">気温</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 成果・備考層 */}
        <div className="p-4">
          <div className="space-y-3">
            {/* 収穫情報 */}
            {report.harvest_amount && (
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                <Sprout className="w-5 h-5 text-green-600" />
                <div>
                  <span className="font-semibold text-green-800">
                    収穫: {report.harvest_amount}{report.harvest_unit || 'kg'}
                  </span>
                </div>
              </div>
            )}

            {/* 備考 */}
            {(report.work_notes || report.notes) && (
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-700 line-clamp-3">
                  📝 {report.work_notes || report.notes}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}