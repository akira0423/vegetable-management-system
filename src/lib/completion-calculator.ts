// 作業記録の完了度計算ロジック

export interface CompletionStep {
  id: string
  name: string
  required: boolean
  icon: string
  weight: number
  fields: string[]
}

export interface QuickAction {
  id: string
  label: string
  icon: string
  estimatedTime: number
  category: 'accounting' | 'details' | 'media' | 'analysis'
  action: () => void
}

export const completionSteps: CompletionStep[] = [
  {
    id: 'basic',
    name: '基本記録',
    required: true,
    icon: '📝',
    weight: 40,
    fields: ['work_date', 'work_type', 'work_notes']
  },
  {
    id: 'details',
    name: '詳細情報',
    required: false,
    icon: '📊',
    weight: 30,
    fields: ['weather', 'temperature', 'humidity', 'work_duration', 'worker_count']
  },
  {
    id: 'accounting',
    name: '会計情報',
    required: false,
    icon: '💰',
    weight: 20,
    fields: ['expected_price', 'harvest_amount', 'harvest_unit']
  },
  {
    id: 'analysis',
    name: '分析データ',
    required: false,
    icon: '🔬',
    weight: 10,
    fields: ['harvest_quality', 'photos']
  }
]

export const calculateCompletionRate = (workReport: any): number => {
  let totalWeight = 0
  let completedWeight = 0

  for (const step of completionSteps) {
    totalWeight += step.weight
    
    const filledFields = step.fields.filter(field => {
      const value = workReport[field]
      return value !== null && value !== undefined && value !== ''
    })

    if (step.required && filledFields.length === 0) {
      // 必須項目が未入力の場合
      continue
    }

    const fieldCompletionRate = filledFields.length / step.fields.length
    completedWeight += step.weight * fieldCompletionRate
  }

  return Math.round((completedWeight / totalWeight) * 100)
}

export const getCompletionLevel = (completionRate: number): 'incomplete' | 'basic' | 'detailed' | 'complete' => {
  if (completionRate < 40) return 'incomplete'
  if (completionRate < 60) return 'basic'
  if (completionRate < 90) return 'detailed'
  return 'complete'
}

export const getMissingSteps = (workReport: any): CompletionStep[] => {
  return completionSteps.filter(step => {
    const filledFields = step.fields.filter(field => {
      const value = workReport[field]
      return value !== null && value !== undefined && value !== ''
    })
    return filledFields.length < step.fields.length
  })
}

export const getNextSuggestedAction = (workReport: any): string => {
  const missingSteps = getMissingSteps(workReport)
  if (missingSteps.length === 0) return '記録は完了しています！'
  
  const nextStep = missingSteps[0]
  return `${nextStep.icon} ${nextStep.name}を追加して記録を充実させましょう`
}