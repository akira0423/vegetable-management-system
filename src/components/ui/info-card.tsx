'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, Thermometer, Droplets, Eye, Users, Coins, Sprout } from 'lucide-react'

interface InfoCardProps {
  title: string
  data: any
  type?: 'basic' | 'environment' | 'soil' | 'accounting' | 'harvest'
}

const formatCurrency = (amount: number | undefined) => {
  if (!amount) return '未記録'
  return new Intl.NumberFormat('ja-JP', { 
    style: 'currency', 
    currency: 'JPY',
    minimumFractionDigits: 0 
  }).format(amount)
}

const formatNumber = (num: number | undefined, unit = '') => {
  if (num === undefined || num === null) return '未記録'
  return `${num}${unit}`
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

const getWeatherLabel = (weather: string) => {
  const labels: { [key: string]: { label: string, icon: string } } = {
    sunny: { label: '晴れ', icon: '☀️' },
    cloudy: { label: '曇り', icon: '☁️' },
    rainy: { label: '雨', icon: '🌧️' },
    windy: { label: '風', icon: '💨' }
  }
  return labels[weather] || { label: weather || '未記録', icon: '📝' }
}

export function InfoCard({ title, data, type = 'basic' }: InfoCardProps) {
  const renderBasicInfo = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-500" />
          <span className="text-sm text-gray-600">作業日:</span>
          <span className="font-medium">{data.work_date || '未記録'}</span>
        </div>
        <Badge variant="outline" className="bg-blue-50 text-blue-700">
          {getWorkTypeLabel(data.work_type)}
        </Badge>
      </div>
      
      {data.work_notes && (
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-700">{data.work_notes}</p>
        </div>
      )}
      
      <div className="grid grid-cols-2 gap-4">
        {data.work_duration && (
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-green-500" />
            <span className="text-sm">作業時間: {data.work_duration}分</span>
          </div>
        )}
        {data.worker_count && (
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-500" />
            <span className="text-sm">作業人数: {data.worker_count}人</span>
          </div>
        )}
      </div>
    </div>
  )

  const renderEnvironmentInfo = () => {
    const weather = getWeatherLabel(data.weather)
    
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{weather.icon}</span>
            <span className="font-medium">{weather.label}</span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          {data.temperature && (
            <div className="flex items-center gap-2">
              <Thermometer className="w-4 h-4 text-red-500" />
              <span className="text-sm">気温: {data.temperature}℃</span>
            </div>
          )}
          {data.humidity && (
            <div className="flex items-center gap-2">
              <Droplets className="w-4 h-4 text-blue-500" />
              <span className="text-sm">湿度: {data.humidity}%</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderSoilInfo = () => {
    // 基本表示（常に表示）
    const basicSoilFields = [
      { key: 'soil_ph', label: 'pH', unit: '' },
      { key: 'soil_ec', label: 'EC', unit: 'mS/cm' },
      { key: 'phosphorus_absorption', label: 'リン酸吸収係数', unit: '' }
    ]
    
    // 詳細表示（展開時のみ表示）
    const detailedSoilFields = [
      { key: 'cec', label: 'CEC', unit: 'me/100g' },
      { key: 'base_saturation', label: '塩基飽和度', unit: '%' },
      { key: 'exchangeable_calcium', label: '交換性カルシウム', unit: 'mg/100g' },
      { key: 'exchangeable_magnesium', label: '交換性マグネシウム', unit: 'mg/100g' },
      { key: 'exchangeable_potassium', label: '交換性カリウム', unit: 'mg/100g' },
      { key: 'humus_content', label: '腐植含量', unit: '%' },
      { key: 'available_phosphorus', label: '可給態リン酸', unit: 'mg/100g' },
      { key: 'available_silica', label: '可給態ケイ酸', unit: 'mg/100g' },
      { key: 'ammonium_nitrogen', label: 'アンモニア態窒素', unit: 'mg/100g' },
      { key: 'nitrate_nitrogen', label: '硝酸態窒素', unit: 'mg/100g' }
    ]

    const hasBasicSoilData = basicSoilFields.some(field => data[field.key])
    const hasDetailedSoilData = detailedSoilFields.some(field => data[field.key])
    
    const [isExpanded, setIsExpanded] = React.useState(false)

    if (!hasBasicSoilData && !hasDetailedSoilData) {
      return (
        <div className="text-center py-4 text-gray-500">
          <Eye className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">土壌情報は記録されていません</p>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        {/* 基本土壌情報（常に表示） */}
        <div className="grid grid-cols-3 gap-2">
          {basicSoilFields.map(field => (
            data[field.key] && (
              <div key={field.key} className="bg-amber-50 p-2 rounded border border-amber-200">
                <div className="text-xs text-amber-700 font-medium">{field.label}</div>
                <div className="text-sm font-bold text-amber-800">
                  {formatNumber(data[field.key], field.unit)}
                </div>
              </div>
            )
          ))}
        </div>

        {/* 詳細表示展開ボタン */}
        {hasDetailedSoilData && (
          <div className="flex justify-center">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg border border-amber-300 transition-colors"
            >
              📋 詳細土壌データを{isExpanded ? '閉じる' : '表示'}
              <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>
          </div>
        )}

        {/* 詳細土壌情報（展開時のみ表示） */}
        {isExpanded && (
          <div className="bg-amber-25 p-4 rounded-lg border border-amber-200">
            <div className="text-xs text-amber-700 font-semibold mb-3">📊 詳細分析データ</div>
            <div className="grid grid-cols-2 gap-2">
              {detailedSoilFields.map(field => (
                data[field.key] && (
                  <div key={field.key} className="bg-white p-2 rounded border border-amber-150">
                    <div className="text-xs text-amber-600 font-medium">{field.label}</div>
                    <div className="text-sm font-bold text-amber-700">
                      {formatNumber(data[field.key], field.unit)}
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
        )}
        
        {/* 土壌メモ */}
        {data.soil_notes && (
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
            <div className="text-xs text-amber-700 font-medium mb-1">🗒️ 観察メモ</div>
            <p className="text-sm text-amber-800">{data.soil_notes}</p>
          </div>
        )}
      </div>
    )
  }

  const renderHarvestInfo = () => {
    if (!data.harvest_amount && !data.expected_revenue) {
      return (
        <div className="text-center py-4 text-gray-500">
          <Sprout className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">収穫情報は記録されていません</p>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {data.harvest_amount && (
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-2">
              <Sprout className="w-5 h-5 text-green-600" />
              <span className="font-medium text-green-800">収穫量</span>
            </div>
            <span className="text-lg font-bold text-green-800">
              {data.harvest_amount}{data.harvest_unit || 'kg'}
            </span>
          </div>
        )}
        
        {data.expected_revenue && (
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-blue-800">想定売上</span>
            </div>
            <span className="text-lg font-bold text-blue-800">
              {formatCurrency(data.expected_revenue)}
            </span>
          </div>
        )}

        {data.harvest_quality && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">品質:</span>
            <Badge 
              variant="outline" 
              className={`
                ${data.harvest_quality === 'excellent' ? 'bg-green-100 text-green-700 border-green-300' : ''}
                ${data.harvest_quality === 'good' ? 'bg-blue-100 text-blue-700 border-blue-300' : ''}
                ${data.harvest_quality === 'average' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' : ''}
                ${data.harvest_quality === 'poor' ? 'bg-red-100 text-red-700 border-red-300' : ''}
              `}
            >
              {data.harvest_quality === 'excellent' && '優秀'}
              {data.harvest_quality === 'good' && '良好'}
              {data.harvest_quality === 'average' && '平均'}
              {data.harvest_quality === 'poor' && '要改善'}
            </Badge>
          </div>
        )}
      </div>
    )
  }

  const renderContent = () => {
    switch (type) {
      case 'basic': return renderBasicInfo()
      case 'environment': return renderEnvironmentInfo()
      case 'soil': return renderSoilInfo()
      case 'harvest': return renderHarvestInfo()
      default: return renderBasicInfo()
    }
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium text-gray-700">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {renderContent()}
      </CardContent>
    </Card>
  )
}