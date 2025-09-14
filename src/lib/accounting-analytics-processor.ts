/**
 * プロフェッショナル会計分析プロセッサー
 * 会計データの統合・分析・予実差異・AIレコメンデーション活用
 */

export interface AccountingEntry {
  id: string
  work_report_id: string
  accounting_item_id: string
  amount: number
  custom_item_name?: string
  notes?: string
  is_ai_recommended?: boolean
  accounting_items?: {
    id: string
    code: string
    name: string
    type: 'income' | 'expense' | 'both'
    category: string
  }
}

export interface WorkReport {
  id: string
  work_date: string
  work_type: string
  vegetable_id: string
  duration_hours?: number
  worker_count?: number
  // estimated_cost?: number // データベースに存在しない
  expected_revenue?: number
  harvest_amount?: number
  expected_price?: number
  work_report_accounting?: AccountingEntry[]
}

export interface DataSource {
  amount: number
  source: 'accounting' | 'estimated' | 'hybrid'
  reliability: 'high' | 'medium' | 'low'
  badge: string
  details?: {
    accountingAmount?: number
    estimatedAmount?: number
    aiRecommendedCount?: number
    totalEntries?: number
  }
}

export interface AccountingSummary {
  actualIncome: number
  actualExpense: number
  netIncome: number
  aiUsageRate: number
  recordCount: number
  topIncomeCategories: CategorySummary[]
  topExpenseCategories: CategorySummary[]
  dataQuality: DataQualityMetrics
  variance: VarianceAnalysis
}

export interface CategorySummary {
  category: string
  amount: number
  count: number
  percentage: number
  aiRecommendedPercentage: number
}

export interface DataQualityMetrics {
  completenessRate: number
  accountingCoverageRate: number
  estimationFallbackRate: number
  inconsistencyCount: number
}

export interface VarianceAnalysis {
  totalEstimated: number
  totalActual: number
  variance: number
  variancePercentage: number
  significantVariances: VarianceItem[]
}

export interface VarianceItem {
  workType: string
  estimated: number
  actual: number
  variance: number
  variancePercentage: number
  reportCount: number
}

export class AccountingAnalyticsProcessor {
  private static instance: AccountingAnalyticsProcessor

  static getInstance(): AccountingAnalyticsProcessor {
    if (!AccountingAnalyticsProcessor.instance) {
      AccountingAnalyticsProcessor.instance = new AccountingAnalyticsProcessor()
    }
    return AccountingAnalyticsProcessor.instance
  }

  /**
   * 会計サマリーの生成
   */
  generateAccountingSummary(reports: WorkReport[]): AccountingSummary {
    const accountingEntries = this.extractAccountingEntries(reports)
    
    const actualIncome = this.calculateTotalByType(accountingEntries, 'income')
    const actualExpense = this.calculateTotalByType(accountingEntries, 'expense')
    const netIncome = actualIncome - actualExpense
    
    const aiUsageRate = this.calculateAIUsageRate(accountingEntries)
    const recordCount = accountingEntries.length
    
    const topIncomeCategories = this.getTopCategories(accountingEntries, 'income')
    const topExpenseCategories = this.getTopCategories(accountingEntries, 'expense')
    
    const dataQuality = this.calculateDataQuality(reports, accountingEntries)
    const variance = this.calculateVarianceAnalysis(reports)
    
    return {
      actualIncome,
      actualExpense,
      netIncome,
      aiUsageRate,
      recordCount,
      topIncomeCategories,
      topExpenseCategories,
      dataQuality,
      variance
    }
  }

  /**
   * データソース情報付きでコストデータを取得
   */
  getCostDataWithSource(report: WorkReport, fallbackToEstimate = false): DataSource {
    const accountingEntries = report.work_report_accounting?.filter(
      entry => entry.accounting_items?.type === 'expense'
    ) || []

    const accountingAmount = accountingEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0)
    const aiRecommendedCount = accountingEntries.filter(e => e.is_ai_recommended).length

    if (accountingAmount > 0) {
      return {
        amount: accountingAmount,
        source: 'accounting',
        reliability: 'high',
        badge: '実績',
        details: {
          accountingAmount,
          aiRecommendedCount,
          totalEntries: accountingEntries.length
        }
      }
    }

    // 会計データがない場合は0を返す（推定計算は行わない）
    return {
      amount: 0,
      source: 'accounting',
      reliability: 'low',
      badge: 'なし'
    }
  }

  /**
   * データソース情報付きで収入データを取得
   */
  getIncomeDataWithSource(report: WorkReport, fallbackToEstimate = false): DataSource {
    const accountingEntries = report.work_report_accounting?.filter(
      entry => entry.accounting_items?.type === 'income'
    ) || []

    const accountingAmount = accountingEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0)
    const aiRecommendedCount = accountingEntries.filter(e => e.is_ai_recommended).length

    if (accountingAmount > 0) {
      return {
        amount: accountingAmount,
        source: 'accounting',
        reliability: 'high',
        badge: '実績',
        details: {
          accountingAmount,
          aiRecommendedCount,
          totalEntries: accountingEntries.length
        }
      }
    }

    // 会計データがない場合は0を返す（推定計算は行わない）
    return {
      amount: 0,
      source: 'accounting',
      reliability: 'low',
      badge: 'なし'
    }
  }

  /**
   * 月次コスト推移（会計データ統合版）
   */
  generateMonthlyCostFromAccounting(reports: WorkReport[], startMonth: string): any[] {
    const monthLabels = this.generateMonthLabels(startMonth, 12)
    
    return monthLabels.map(monthLabel => {
      const monthReports = reports.filter(report => {
        const reportMonth = report.work_date.substring(0, 7)
        return reportMonth === monthLabel
      })
      
      const categoryTotals: { [category: string]: number } = {}
      const dataSourceInfo: { [category: string]: { estimated: number, actual: number } } = {}
      
      monthReports.forEach(report => {
        const costData = this.getCostDataWithSource(report, true)
        const category = this.getCategoryFromWorkType(report.work_type)
        
        if (!categoryTotals[category]) {
          categoryTotals[category] = 0
          dataSourceInfo[category] = { estimated: 0, actual: 0 }
        }
        
        categoryTotals[category] += costData.amount
        
        if (costData.source === 'accounting') {
          dataSourceInfo[category].actual += costData.amount
        } else {
          dataSourceInfo[category].estimated += costData.amount
        }
      })
      
      return {
        month: monthLabel,
        data: categoryTotals,
        sources: dataSourceInfo
      }
    })
  }

  /**
   * カテゴリ別詳細分析
   */
  generateCategoryAnalysis(reports: WorkReport[]): any[] {
    const accountingEntries = this.extractAccountingEntries(reports)
    const categoryAnalysis: { [category: string]: any } = {}
    
    accountingEntries.forEach(entry => {
      const category = entry.accounting_items?.category || 'その他'
      const type = entry.accounting_items?.type || 'expense'
      
      if (!categoryAnalysis[category]) {
        categoryAnalysis[category] = {
          category,
          totalAmount: 0,
          incomeAmount: 0,
          expenseAmount: 0,
          entryCount: 0,
          aiRecommendedCount: 0,
          averageAmount: 0,
          items: []
        }
      }
      
      const analysis = categoryAnalysis[category]
      analysis.totalAmount += Math.abs(entry.amount || 0)
      analysis.entryCount += 1
      
      if (type === 'income') {
        analysis.incomeAmount += entry.amount || 0
      } else {
        analysis.expenseAmount += entry.amount || 0
      }
      
      if (entry.is_ai_recommended) {
        analysis.aiRecommendedCount += 1
      }
      
      analysis.items.push({
        itemName: entry.accounting_items?.name || entry.custom_item_name || '不明',
        amount: entry.amount,
        isAIRecommended: entry.is_ai_recommended,
        notes: entry.notes
      })
    })
    
    // 平均金額計算と並び替え
    return Object.values(categoryAnalysis).map((analysis: any) => ({
      ...analysis,
      averageAmount: analysis.entryCount > 0 ? analysis.totalAmount / analysis.entryCount : 0,
      aiUsageRate: analysis.entryCount > 0 ? (analysis.aiRecommendedCount / analysis.entryCount) * 100 : 0
    })).sort((a, b) => b.totalAmount - a.totalAmount)
  }

  /**
   * AIレコメンデーション分析
   */
  generateAIRecommendationAnalysis(reports: WorkReport[]): any {
    const accountingEntries = this.extractAccountingEntries(reports)
    const aiEntries = accountingEntries.filter(e => e.is_ai_recommended)
    const manualEntries = accountingEntries.filter(e => !e.is_ai_recommended)
    
    const aiStats = {
      totalEntries: accountingEntries.length,
      aiRecommendedEntries: aiEntries.length,
      manualEntries: manualEntries.length,
      aiUsageRate: accountingEntries.length > 0 ? (aiEntries.length / accountingEntries.length) * 100 : 0,
      
      aiAverage: aiEntries.length > 0 ? 
        aiEntries.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0) / aiEntries.length : 0,
      manualAverage: manualEntries.length > 0 ? 
        manualEntries.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0) / manualEntries.length : 0,
      
      aiTotal: aiEntries.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0),
      manualTotal: manualEntries.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0),
      
      topAICategories: this.getTopCategories(aiEntries, null, 5),
      accuracyMetrics: this.calculateAIAccuracy(accountingEntries)
    }
    
    return aiStats
  }

  // ヘルパーメソッド
  private extractAccountingEntries(reports: WorkReport[]): AccountingEntry[] {
    return reports.flatMap(report => report.work_report_accounting || [])
  }

  private calculateTotalByType(entries: AccountingEntry[], type: 'income' | 'expense'): number {
    return entries
      .filter(entry => entry.accounting_items?.type === type)
      .reduce((sum, entry) => sum + (entry.amount || 0), 0)
  }

  private calculateAIUsageRate(entries: AccountingEntry[]): number {
    if (entries.length === 0) return 0
    const aiCount = entries.filter(e => e.is_ai_recommended).length
    return (aiCount / entries.length) * 100
  }

  private getTopCategories(entries: AccountingEntry[], type: 'income' | 'expense' | null, limit = 5): CategorySummary[] {
    const filteredEntries = type ? entries.filter(e => e.accounting_items?.type === type) : entries
    const categoryMap: { [category: string]: CategorySummary } = {}
    
    filteredEntries.forEach(entry => {
      const category = entry.accounting_items?.category || 'その他'
      
      if (!categoryMap[category]) {
        categoryMap[category] = {
          category,
          amount: 0,
          count: 0,
          percentage: 0,
          aiRecommendedPercentage: 0
        }
      }
      
      categoryMap[category].amount += Math.abs(entry.amount || 0)
      categoryMap[category].count += 1
    })
    
    const totalAmount = Object.values(categoryMap).reduce((sum, cat) => sum + cat.amount, 0)
    
    return Object.values(categoryMap)
      .map(cat => ({
        ...cat,
        percentage: totalAmount > 0 ? (cat.amount / totalAmount) * 100 : 0,
        aiRecommendedPercentage: this.calculateCategoryAIRate(filteredEntries, cat.category)
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, limit)
  }

  private calculateDataQuality(reports: WorkReport[], entries: AccountingEntry[]): DataQualityMetrics {
    const reportsWithAccounting = reports.filter(r => 
      r.work_report_accounting && r.work_report_accounting.length > 0
    ).length
    
    const completenessRate = reports.length > 0 ? (reportsWithAccounting / reports.length) * 100 : 0
    const accountingCoverageRate = completenessRate
    const estimationFallbackRate = 100 - completenessRate
    
    // 不整合の検出（簡易版）
    const inconsistencyCount = reports.filter(report => {
      // 推定コストのフィールドがないため、会計データの有無で判断
      const hasEstimated = false // report.estimated_cost && report.estimated_cost > 0
      const hasAccounting = report.work_report_accounting && report.work_report_accounting.length > 0
      return hasEstimated && hasAccounting // 両方存在する場合は潜在的不整合
    }).length
    
    return {
      completenessRate,
      accountingCoverageRate, 
      estimationFallbackRate,
      inconsistencyCount
    }
  }

  private calculateVarianceAnalysis(reports: WorkReport[]): VarianceAnalysis {
    let totalEstimated = 0
    let totalActual = 0
    const workTypeVariances: { [workType: string]: VarianceItem } = {}

    reports.forEach(report => {
      const estimated = 0  // 推定計算は行わない
      const actual = this.getActualCost(report)
      
      totalEstimated += estimated
      totalActual += actual
      
      if (!workTypeVariances[report.work_type]) {
        workTypeVariances[report.work_type] = {
          workType: report.work_type,
          estimated: 0,
          actual: 0,
          variance: 0,
          variancePercentage: 0,
          reportCount: 0
        }
      }
      
      const wtv = workTypeVariances[report.work_type]
      wtv.estimated += estimated
      wtv.actual += actual
      wtv.reportCount += 1
    })
    
    const variance = totalActual - totalEstimated
    const variancePercentage = totalEstimated > 0 ? (variance / totalEstimated) * 100 : 0
    
    // 作業種類別差異計算
    const significantVariances = Object.values(workTypeVariances)
      .map(wtv => ({
        ...wtv,
        variance: wtv.actual - wtv.estimated,
        variancePercentage: wtv.estimated > 0 ? ((wtv.actual - wtv.estimated) / wtv.estimated) * 100 : 0
      }))
      .filter(wtv => Math.abs(wtv.variancePercentage) > 20) // 20%以上の差異
      .sort((a, b) => Math.abs(b.variancePercentage) - Math.abs(a.variancePercentage))
    
    return {
      totalEstimated,
      totalActual,
      variance,
      variancePercentage,
      significantVariances
    }
  }

  private calculateEstimatedCost(report: WorkReport): number {
    // 推定計算は行わない - 常に0を返す
    return 0
  }

  private calculateEstimatedRevenue(report: WorkReport): number {
    // 推定計算は行わない - 常に0を返す
    return 0
  }

  private getActualCost(report: WorkReport): number {
    return report.work_report_accounting?.filter(
      entry => entry.accounting_items?.type === 'expense'
    ).reduce((sum, entry) => sum + (entry.amount || 0), 0) || 0
  }

  private getCategoryFromWorkType(workType: string): string {
    const mapping: { [workType: string]: string } = {
      'seeding': '種苗関連',
      'planting': '栽培作業', 
      'fertilizing': '資材費',
      'watering': '栽培作業',
      'weeding': '栽培作業',
      'pruning': '栽培作業',
      'harvesting': '収穫・出荷',
      'other': 'その他'
    }
    return mapping[workType] || 'その他'
  }

  private generateMonthLabels(startMonth: string, count: number): string[] {
    const labels: string[] = []
    const [year, month] = startMonth.split('-').map(Number)
    let currentYear = year
    let currentMonth = month
    
    for (let i = 0; i < count; i++) {
      const monthStr = currentMonth.toString().padStart(2, '0')
      labels.push(`${currentYear}-${monthStr}`)
      
      currentMonth++
      if (currentMonth > 12) {
        currentMonth = 1
        currentYear++
      }
    }
    
    return labels
  }

  private calculateCategoryAIRate(entries: AccountingEntry[], category: string): number {
    const categoryEntries = entries.filter(e => e.accounting_items?.category === category)
    if (categoryEntries.length === 0) return 0
    
    const aiCount = categoryEntries.filter(e => e.is_ai_recommended).length
    return (aiCount / categoryEntries.length) * 100
  }

  private calculateAIAccuracy(entries: AccountingEntry[]): any {
    // AI精度分析（簡易版）
    const aiEntries = entries.filter(e => e.is_ai_recommended)
    const manualEntries = entries.filter(e => !e.is_ai_recommended)
    
    return {
      aiAverageAmount: aiEntries.length > 0 ? 
        aiEntries.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0) / aiEntries.length : 0,
      manualAverageAmount: manualEntries.length > 0 ?
        manualEntries.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0) / manualEntries.length : 0,
      consistencyScore: this.calculateConsistencyScore(aiEntries, manualEntries)
    }
  }

  private calculateConsistencyScore(aiEntries: AccountingEntry[], manualEntries: AccountingEntry[]): number {
    // 一貫性スコア（AIと手動入力の類似性）
    if (aiEntries.length === 0 || manualEntries.length === 0) return 0
    
    const aiAvg = aiEntries.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0) / aiEntries.length
    const manualAvg = manualEntries.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0) / manualEntries.length
    
    const difference = Math.abs(aiAvg - manualAvg)
    const average = (aiAvg + manualAvg) / 2
    
    return average > 0 ? Math.max(0, 100 - (difference / average) * 100) : 0
  }
}

// シングルトンインスタンス
export const accountingAnalyticsProcessor = AccountingAnalyticsProcessor.getInstance()