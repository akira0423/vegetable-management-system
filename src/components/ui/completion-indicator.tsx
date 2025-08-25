import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { completionSteps, calculateCompletionRate, getCompletionLevel, getMissingSteps } from '@/lib/completion-calculator'

interface CompletionIndicatorProps {
  workReport: any
  showDetails?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function CompletionIndicator({ workReport, showDetails = false, size = 'md' }: CompletionIndicatorProps) {
  const completionRate = calculateCompletionRate(workReport)
  const level = getCompletionLevel(completionRate)
  const missingSteps = getMissingSteps(workReport)

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'incomplete': return 'bg-red-500'
      case 'basic': return 'bg-yellow-500'
      case 'detailed': return 'bg-blue-500'
      case 'complete': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  const getLevelLabel = (level: string) => {
    switch (level) {
      case 'incomplete': return '未完了'
      case 'basic': return '基本'
      case 'detailed': return '詳細'
      case 'complete': return '完了'
      default: return '不明'
    }
  }

  return (
    <div className={`space-y-2 ${size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm'}`}>
      {/* 完了度バー */}
      <div className="flex items-center gap-3">
        <Progress 
          value={completionRate} 
          className={`flex-1 ${size === 'sm' ? 'h-2' : size === 'lg' ? 'h-4' : 'h-3'}`}
        />
        <Badge 
          variant="outline" 
          className={`${getLevelColor(level)} text-white border-0 ${size === 'sm' ? 'text-xs px-2 py-0' : 'px-3 py-1'}`}
        >
          {completionRate}%
        </Badge>
      </div>

      {/* レベル表示 */}
      <div className="flex items-center justify-between">
        <span className={`font-medium ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
          記録レベル: {getLevelLabel(level)}
        </span>
        {completionRate === 100 && (
          <span className="text-green-600 font-medium">✅ 完了</span>
        )}
      </div>

      {/* 詳細表示 */}
      {showDetails && (
        <div className="space-y-2">
          <h5 className="font-medium text-gray-700">記録状況</h5>
          <div className="grid grid-cols-2 gap-2">
            {completionSteps.map(step => {
              const filledFields = step.fields.filter(field => {
                const value = workReport[field]
                return value !== null && value !== undefined && value !== ''
              })
              const isCompleted = filledFields.length === step.fields.length
              
              return (
                <div 
                  key={step.id}
                  className={`flex items-center gap-2 p-2 rounded-lg border ${
                    isCompleted ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <span className="text-lg">{step.icon}</span>
                  <div className="flex-1">
                    <div className="font-medium text-xs">{step.name}</div>
                    <div className="text-xs text-gray-500">
                      {filledFields.length}/{step.fields.length} 項目
                    </div>
                  </div>
                  {isCompleted && <span className="text-green-600">✓</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default CompletionIndicator