import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Info, CheckCircle, AlertTriangle, Bot, User } from 'lucide-react'

interface DataSourceBadgeProps {
  source: 'accounting' | 'estimated' | 'hybrid'
  reliability: 'high' | 'medium' | 'low'
  badge: string
  amount?: number
  details?: {
    accountingAmount?: number
    estimatedAmount?: number
    aiRecommendedCount?: number
    totalEntries?: number
  }
  showTooltip?: boolean
  className?: string
}

export default function DataSourceBadge({ 
  source, 
  reliability, 
  badge, 
  amount,
  details,
  showTooltip = true,
  className = ""
}: DataSourceBadgeProps) {
  const getBadgeVariant = () => {
    switch (reliability) {
      case 'high': return 'default' // 緑系
      case 'medium': return 'secondary' // 黄系
      case 'low': return 'outline' // グレー系
      default: return 'outline'
    }
  }

  const getBadgeColor = () => {
    switch (reliability) {
      case 'high': return 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'
      case 'medium': return 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
      case 'low': return 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-300'
    }
  }

  const getIcon = () => {
    switch (reliability) {
      case 'high': return <CheckCircle className="w-3 h-3" />
      case 'medium': return <AlertTriangle className="w-3 h-3" />
      case 'low': return <Info className="w-3 h-3" />
      default: return <Info className="w-3 h-3" />
    }
  }

  const formatAmount = (value: number) => {
    return `¥${value.toLocaleString()}`
  }

  const tooltipContent = () => (
    <div className="space-y-2 p-2">
      <div className="font-semibold text-sm">データソース情報</div>
      
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span>データソース:</span>
          <span className="font-medium">
            {source === 'accounting' ? '会計記録' : 
             source === 'estimated' ? '推定計算' : 'ハイブリッド'}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>信頼度:</span>
          <span className="font-medium">
            {reliability === 'high' ? '高' : 
             reliability === 'medium' ? '中' : '低'}
          </span>
        </div>

        {amount !== undefined && (
          <div className="flex justify-between">
            <span>金額:</span>
            <span className="font-medium">{formatAmount(amount)}</span>
          </div>
        )}
      </div>

      {details && (
        <>
          <hr className="border-gray-300" />
          <div className="space-y-1 text-xs">
            {details.accountingAmount !== undefined && (
              <div className="flex justify-between">
                <span>実績額:</span>
                <span className="font-medium text-green-600">
                  {formatAmount(details.accountingAmount)}
                </span>
              </div>
            )}
            
            {details.estimatedAmount !== undefined && (
              <div className="flex justify-between">
                <span>推定額:</span>
                <span className="font-medium text-gray-600">
                  {formatAmount(details.estimatedAmount)}
                </span>
              </div>
            )}
            
            {details.totalEntries !== undefined && (
              <div className="flex justify-between">
                <span>記録数:</span>
                <span className="font-medium">{details.totalEntries}件</span>
              </div>
            )}
            
            {details.aiRecommendedCount !== undefined && details.totalEntries !== undefined && (
              <div className="flex justify-between items-center">
                <span>AI推奨:</span>
                <span className="font-medium flex items-center gap-1">
                  <Bot className="w-3 h-3" />
                  {details.aiRecommendedCount}/{details.totalEntries}
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )

  const badgeElement = (
    <Badge 
      variant={getBadgeVariant()} 
      className={`${getBadgeColor()} flex items-center gap-1 text-xs font-medium cursor-help ${className}`}
    >
      {getIcon()}
      {badge}
    </Badge>
  )

  if (!showTooltip) {
    return badgeElement
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badgeElement}
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          {tooltipContent()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// AI推奨バッジ用のコンポーネント
export function AIRecommendationBadge({ 
  isAIRecommended, 
  className = "",
  showTooltip = true 
}: { 
  isAIRecommended: boolean
  className?: string
  showTooltip?: boolean
}) {
  if (!isAIRecommended) return null

  const badgeElement = (
    <Badge 
      className={`bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200 flex items-center gap-1 text-xs cursor-help ${className}`}
    >
      <Bot className="w-3 h-3" />
      AI推奨
    </Badge>
  )

  if (!showTooltip) {
    return badgeElement
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badgeElement}
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">この項目はAIによって推奨されました</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// 予実差異バッジ用のコンポーネント
export function VarianceBadge({ 
  variance, 
  variancePercentage,
  className = "",
  showTooltip = true 
}: { 
  variance: number
  variancePercentage: number
  className?: string
  showTooltip?: boolean
}) {
  const isSignificant = Math.abs(variancePercentage) > 20
  const isPositive = variance > 0

  if (!isSignificant) return null

  const getBadgeColor = () => {
    if (Math.abs(variancePercentage) > 50) {
      return 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200'
    } else if (Math.abs(variancePercentage) > 30) {
      return 'bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200'
    } else {
      return 'bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200'
    }
  }

  const formatVariance = (value: number) => {
    const sign = value >= 0 ? '+' : ''
    return `${sign}${value.toLocaleString()}`
  }

  const badgeElement = (
    <Badge 
      className={`${getBadgeColor()} flex items-center gap-1 text-xs cursor-help ${className}`}
    >
      <AlertTriangle className="w-3 h-3" />
      差異 {Math.abs(variancePercentage).toFixed(1)}%
    </Badge>
  )

  if (!showTooltip) {
    return badgeElement
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badgeElement}
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1 text-xs">
            <div>予実差異: {formatVariance(variance)}円</div>
            <div>差異率: {variancePercentage.toFixed(1)}%</div>
            <div className="text-gray-600">
              {isPositive ? '実績が予想を上回りました' : '実績が予想を下回りました'}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}