export const getWorkTypeIcon = (workType: string) => {
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

export const getWorkTypeLabel = (workType: string) => {
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

export const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  })
}

export const formatCurrency = (amount: number | undefined) => {
  if (!amount) return '¥0'
  return new Intl.NumberFormat('ja-JP', { 
    style: 'currency', 
    currency: 'JPY',
    minimumFractionDigits: 0 
  }).format(amount)
}

export const safeFormatDate = (dateString: string) => {
  if (!dateString) return '未記録'
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return '未記録'
    return date.toLocaleDateString('ja-JP', { 
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      weekday: 'short'
    })
  } catch (error) {
    return '未記録'
  }
}