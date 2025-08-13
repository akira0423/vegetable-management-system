/**
 * 作業レポートとデータ分析の自動同期ユーティリティ
 * データ整合性を確保し、リアルタイム分析を提供
 */

export interface WorkReport {
  id: string
  work_date: string
  work_type: 'seeding' | 'planting' | 'fertilizing' | 'watering' | 'weeding' | 'pruning' | 'harvesting' | 'other'
  vegetable_id: string
  work_notes?: string
  estimated_cost?: number
  harvest_amount?: number
  expected_revenue?: number
  work_duration?: number
  worker_count?: number
}

export interface Vegetable {
  id: string
  name: string
  variety: string
  status: string
}

export interface AnalyticsDataSync {
  syncWorkReportToAnalytics: (report: WorkReport, vegetables: Vegetable[]) => void
  validateDataIntegrity: (reports: WorkReport[], vegetables: Vegetable[]) => boolean
  generateRealTimeMetrics: (reports: WorkReport[], vegetables: Vegetable[]) => any
}

class AnalyticsDataSyncService implements AnalyticsDataSync {
  private static instance: AnalyticsDataSyncService
  private listeners: ((data: any) => void)[] = []

  static getInstance(): AnalyticsDataSyncService {
    if (!AnalyticsDataSyncService.instance) {
      AnalyticsDataSyncService.instance = new AnalyticsDataSyncService()
    }
    return AnalyticsDataSyncService.instance
  }

  // リスナー登録（分析ページで使用）
  addListener(callback: (data: any) => void): void {
    this.listeners.push(callback)
  }

  // リスナー削除
  removeListener(callback: (data: any) => void): void {
    this.listeners = this.listeners.filter(listener => listener !== callback)
  }

  // 全リスナーに変更を通知
  private notifyListeners(data: any): void {
    this.listeners.forEach(listener => listener(data))
  }

  // 作業レポート保存時の分析データ自動同期
  syncWorkReportToAnalytics(report: WorkReport, vegetables: Vegetable[]): void {
    try {
      // データ検証
      if (!this.validateReportData(report)) {
        console.warn('作業レポートデータが不正です:', report)
        return
      }

      // リアルタイムメトリクス生成
      const metrics = this.generateRealTimeMetrics([report], vegetables)
      
      // 分析ページに即座に反映
      this.notifyListeners({
        type: 'NEW_WORK_REPORT',
        data: report,
        metrics: metrics,
        timestamp: new Date().toISOString()
      })

      console.log('作業レポートが分析データに同期されました:', report.id)
      
    } catch (error) {
      console.error('分析データ同期エラー:', error)
    }
  }

  // データ整合性検証
  validateDataIntegrity(reports: WorkReport[], vegetables: Vegetable[]): boolean {
    try {
      // 基本データ検証
      const reportsValid = reports.every(report => this.validateReportData(report))
      const vegetablesValid = vegetables.every(veg => veg.id && veg.name)

      if (!reportsValid || !vegetablesValid) {
        console.error('データ整合性エラー: 基本データが不正です')
        return false
      }

      // 参照整合性検証
      const vegetableIds = new Set(vegetables.map(v => v.id))
      const referencesValid = reports.every(report => 
        vegetableIds.has(report.vegetable_id)
      )

      if (!referencesValid) {
        console.error('データ整合性エラー: 野菜参照が不正です')
        return false
      }

      // 数値データ検証
      const numbersValid = reports.every(report => {
        if (report.estimated_cost && report.estimated_cost < 0) return false
        if (report.harvest_amount && report.harvest_amount < 0) return false
        if (report.expected_revenue && report.expected_revenue < 0) return false
        if (report.work_duration && (report.work_duration < 0 || report.work_duration > 1440)) return false
        if (report.worker_count && (report.worker_count < 1 || report.worker_count > 50)) return false
        return true
      })

      if (!numbersValid) {
        console.error('データ整合性エラー: 数値データが範囲外です')
        return false
      }

      console.log('データ整合性検証: OK')
      return true

    } catch (error) {
      console.error('データ整合性検証エラー:', error)
      return false
    }
  }

  // リアルタイムメトリクス生成
  generateRealTimeMetrics(reports: WorkReport[], vegetables: Vegetable[]): any {
    if (!this.validateDataIntegrity(reports, vegetables)) {
      return null
    }

    try {
      // 今日の作業統計
      const today = new Date().toDateString()
      const todayReports = reports.filter(r => 
        new Date(r.work_date).toDateString() === today
      )

      // 月別収穫量
      const harvestByMonth = this.calculateHarvestByMonth(reports)
      
      // 作業頻度
      const workFrequency = this.calculateWorkFrequency(reports)
      
      // コスト分析
      const costAnalysis = this.calculateCostAnalysis(reports)
      
      // 野菜別パフォーマンス
      const vegetablePerformance = this.calculateVegetablePerformance(reports, vegetables)
      
      // 効率スコア
      const efficiencyScore = this.calculateEfficiencyScore(reports)

      return {
        todayStats: {
          totalReports: todayReports.length,
          totalCost: todayReports.reduce((sum, r) => sum + (r.estimated_cost || 0), 0),
          totalRevenue: todayReports.reduce((sum, r) => sum + (r.expected_revenue || 0), 0),
          totalHarvest: todayReports.reduce((sum, r) => sum + (r.harvest_amount || 0), 0)
        },
        harvestByMonth,
        workFrequency,
        costAnalysis,
        vegetablePerformance,
        efficiencyScore,
        lastUpdated: new Date().toISOString(),
        dataIntegrity: true
      }

    } catch (error) {
      console.error('リアルタイムメトリクス生成エラー:', error)
      return null
    }
  }

  // 作業レポートデータ検証
  private validateReportData(report: WorkReport): boolean {
    return !!(
      report.id &&
      report.work_date &&
      report.work_type &&
      report.vegetable_id &&
      new Date(report.work_date).getTime() // 有効な日付
    )
  }

  // 月別収穫量計算
  private calculateHarvestByMonth(reports: WorkReport[]): any[] {
    const harvestData: { [key: string]: number } = {}
    
    reports
      .filter(r => r.work_type === 'harvesting' && r.harvest_amount)
      .forEach(report => {
        const month = new Date(report.work_date).getMonth() + 1
        const monthKey = `${month}月`
        harvestData[monthKey] = (harvestData[monthKey] || 0) + report.harvest_amount!
      })

    return Object.entries(harvestData).map(([month, amount]) => ({
      label: month,
      value: Math.round(amount * 10) / 10,
      color: 'bg-green-600'
    }))
  }

  // 作業頻度計算
  private calculateWorkFrequency(reports: WorkReport[]): any[] {
    const workTypeLabels: { [key: string]: string } = {
      seeding: '播種',
      planting: '定植',
      fertilizing: '施肥',
      watering: '灌水',
      weeding: '除草',
      pruning: '整枝',
      harvesting: '収穫',
      other: 'その他'
    }

    const frequency: { [key: string]: number } = {}
    
    reports.forEach(report => {
      const label = workTypeLabels[report.work_type] || 'その他'
      frequency[label] = (frequency[label] || 0) + 1
    })

    return Object.entries(frequency).map(([type, count]) => ({
      label: type,
      value: count,
      color: this.getWorkTypeColor(type)
    }))
  }

  // コスト分析計算
  private calculateCostAnalysis(reports: WorkReport[]): any[] {
    const costData: { [key: string]: number } = {}
    const workTypeLabels: { [key: string]: string } = {
      seeding: '種苗費',
      planting: '定植費',
      fertilizing: '肥料費',
      watering: '灌水費',
      weeding: '除草費',
      pruning: '整枝費',
      harvesting: '収穫費',
      other: 'その他'
    }

    reports
      .filter(r => r.estimated_cost)
      .forEach(report => {
        const label = workTypeLabels[report.work_type] || 'その他'
        costData[label] = (costData[label] || 0) + report.estimated_cost!
      })

    return Object.entries(costData).map(([type, amount]) => ({
      label: type,
      value: Math.round(amount),
      color: 'bg-blue-600'
    }))
  }

  // 野菜別パフォーマンス計算
  private calculateVegetablePerformance(reports: WorkReport[], vegetables: Vegetable[]): any[] {
    return vegetables.map(vegetable => {
      const vegReports = reports.filter(r => r.vegetable_id === vegetable.id)
      
      const totalRevenue = vegReports
        .filter(r => r.expected_revenue)
        .reduce((sum, r) => sum + r.expected_revenue!, 0)
      
      const totalCost = vegReports
        .filter(r => r.estimated_cost)
        .reduce((sum, r) => sum + r.estimated_cost!, 0)
      
      const totalHarvest = vegReports
        .filter(r => r.harvest_amount)
        .reduce((sum, r) => sum + r.harvest_amount!, 0)
      
      const profit = totalRevenue - totalCost
      const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0
      
      let status: 'excellent' | 'good' | 'average' | 'poor' = 'average'
      if (roi > 120) status = 'excellent'
      else if (roi > 80) status = 'good'
      else if (roi < 50) status = 'poor'

      return {
        name: vegetable.name.split('（')[0] || vegetable.name,
        variety: vegetable.variety || vegetable.name.match(/（(.+?)）/)?.[1] || '',
        plot_size: 100, // デフォルト値
        harvest_amount: Math.round(totalHarvest * 10) / 10,
        revenue: Math.round(totalRevenue),
        cost: Math.round(totalCost),
        profit: Math.round(profit),
        yield_per_sqm: Math.round((totalHarvest / 100) * 10) / 10,
        roi: Math.round(roi * 10) / 10,
        status: status
      }
    })
  }

  // 効率スコア計算
  private calculateEfficiencyScore(reports: WorkReport[]): number {
    if (reports.length === 0) return 75

    // 収穫効率
    const harvestReports = reports.filter(r => r.work_type === 'harvesting')
    const harvestEfficiency = harvestReports.length > 0 ? 
      (harvestReports.reduce((sum, r) => sum + (r.harvest_amount || 0), 0) / harvestReports.length) * 2 : 50

    // コスト効率
    const totalRevenue = reports.reduce((sum, r) => sum + (r.expected_revenue || 0), 0)
    const totalCost = reports.reduce((sum, r) => sum + (r.estimated_cost || 0), 0)
    const costEfficiency = totalRevenue > 0 ? (totalRevenue - totalCost) / totalRevenue * 100 : 50

    // 作業バランス効率
    const workTypes = new Set(reports.map(r => r.work_type))
    const balanceEfficiency = Math.min(workTypes.size * 12, 84) // 作業種類の多様性

    const finalScore = Math.min(100, Math.max(60, 
      (harvestEfficiency * 0.4 + costEfficiency * 0.4 + balanceEfficiency * 0.2)
    ))

    return Math.round(finalScore)
  }

  // 作業種類別カラー取得
  private getWorkTypeColor(workType: string): string {
    const colors: { [key: string]: string } = {
      '播種': 'bg-green-500',
      '定植': 'bg-blue-500',
      '施肥': 'bg-purple-500',
      '灌水': 'bg-cyan-500',
      '除草': 'bg-yellow-500',
      '整枝': 'bg-orange-500',
      '収穫': 'bg-red-500',
      'その他': 'bg-gray-500'
    }
    return colors[workType] || 'bg-gray-500'
  }
}

// シングルトンインスタンスをエクスポート
export const analyticsDataSync = AnalyticsDataSyncService.getInstance()

// イベントタイプ定義
export const ANALYTICS_EVENTS = {
  NEW_WORK_REPORT: 'NEW_WORK_REPORT',
  DATA_INTEGRITY_CHECK: 'DATA_INTEGRITY_CHECK',
  METRICS_UPDATE: 'METRICS_UPDATE'
} as const

// ユーティリティ関数
export const formatAnalyticsNumber = (num: number, decimals = 1): string => {
  return new Intl.NumberFormat('ja-JP', { 
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals 
  }).format(num)
}

export const formatAnalyticsCurrency = (amount: number): string => {
  return new Intl.NumberFormat('ja-JP', { 
    style: 'currency', 
    currency: 'JPY',
    minimumFractionDigits: 0 
  }).format(amount)
}