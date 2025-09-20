'use client'

/**
 * プロフェッショナルデータエクスポート機能
 * CSV・Excel形式での農業データエクスポート
 */

import { createClient } from '@/lib/supabase/client'

interface ExportOptions {
  format: 'csv' | 'excel'
  dateRange?: {
    start: string
    end: string
  }
  filters?: {
    vegetable_id?: string
    work_type?: string
    plot_name?: string
  }
  includePhotos?: boolean
}

interface VegetableExportData {
  id: string
  name: string
  variety_name: string
  plot_name: string
  status: string
  planting_date: string
  harvest_expected_date: string
  created_at: string
}

interface WorkReportExportData {
  id: string
  vegetable_name: string
  plot_name: string
  work_type: string
  work_date: string
  description: string
  duration_hours: number
  weather: string
  temperature: number
  harvest_amount: number
  harvest_unit: string
  created_at: string
}

interface AnalyticsExportData {
  period: string
  total_work_hours: number
  total_harvest: number
  total_revenue: number
  total_cost: number
  profit: number
  productivity_score: number
}

class DataExportManager {
  
  /**
   * 野菜データのエクスポート
   */
  async exportVegetables(options: ExportOptions): Promise<void> {
    try {
      
      
      const companyId = 'a1111111-1111-1111-1111-111111111111'
      
      // JWTトークンを含めたリクエスト
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      const response = await fetch(`/api/vegetables?company_id=${companyId}&limit=1000`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error('野菜データの取得に失敗しました')
      }
      
      const result = await response.json()
      const vegetables: VegetableExportData[] = result.data || []
      
      // フィルタリング
      const filteredVegetables = this.filterVegetables(vegetables, options)
      
      if (options.format === 'csv') {
        this.exportVegetablesToCSV(filteredVegetables)
      } else {
        this.exportVegetablesToExcel(filteredVegetables)
      }
      
    } catch (error) {
      
      alert('野菜データのエクスポートに失敗しました')
    }
  }

  /**
   * 作業報告データのエクスポート
   */
  async exportWorkReports(options: ExportOptions): Promise<void> {
    try {
      
      
      const companyId = 'a1111111-1111-1111-1111-111111111111'
      let url = `/api/reports?company_id=${companyId}&limit=1000`
      
      // 日付範囲フィルター
      if (options.dateRange) {
        url += `&start_date=${options.dateRange.start}&end_date=${options.dateRange.end}`
      }
      
      // その他フィルター
      if (options.filters?.vegetable_id) {
        url += `&vegetable_id=${options.filters.vegetable_id}`
      }
      if (options.filters?.work_type) {
        url += `&work_type=${options.filters.work_type}`
      }
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error('作業報告データの取得に失敗しました')
      }
      
      const result = await response.json()
      const workReports: WorkReportExportData[] = result.data || []
      
      if (options.format === 'csv') {
        this.exportWorkReportsToCSV(workReports)
      } else {
        this.exportWorkReportsToExcel(workReports)
      }
      
    } catch (error) {
      
      alert('作業報告データのエクスポートに失敗しました')
    }
  }

  /**
   * 分析データのエクスポート
   */
  async exportAnalytics(options: ExportOptions): Promise<void> {
    try {
      
      
      // 分析データを生成
      const analyticsData = await this.generateAnalyticsData(options)
      
      if (options.format === 'csv') {
        this.exportAnalyticsToCSV(analyticsData)
      } else {
        this.exportAnalyticsToExcel(analyticsData)
      }
      
    } catch (error) {
      
      alert('分析データのエクスポートに失敗しました')
    }
  }

  /**
   * 包括的データエクスポート（全データ）
   */
  async exportAllData(options: ExportOptions): Promise<void> {
    try {
      
      
      // 全データを並行取得
      const [vegetables, workReports, analytics] = await Promise.all([
        this.fetchVegetables(),
        this.fetchWorkReports(options),
        this.generateAnalyticsData(options)
      ])
      
      if (options.format === 'csv') {
        this.exportAllDataToCSV(vegetables, workReports, analytics)
      } else {
        this.exportAllDataToExcel(vegetables, workReports, analytics)
      }
      
    } catch (error) {
      
      alert('全データのエクスポートに失敗しました')
    }
  }

  /**
   * 野菜データフィルタリング
   */
  private filterVegetables(vegetables: VegetableExportData[], options: ExportOptions): VegetableExportData[] {
    let filtered = [...vegetables]
    
    if (options.filters?.plot_name) {
      filtered = filtered.filter(v => v.plot_name === options.filters!.plot_name)
    }
    
    if (options.dateRange) {
      const startDate = new Date(options.dateRange.start)
      const endDate = new Date(options.dateRange.end)
      
      filtered = filtered.filter(v => {
        const createdDate = new Date(v.created_at)
        return createdDate >= startDate && createdDate <= endDate
      })
    }
    
    return filtered
  }

  /**
   * 野菜データCSVエクスポート
   */
  private exportVegetablesToCSV(vegetables: VegetableExportData[]): void {
    const headers = [
      'ID',
      '野菜名',
      '品種',
      '圃場名',
      'ステータス',
      '定植日',
      '収穫予定日',
      '登録日'
    ]
    
    const csvContent = [
      headers.join(','),
      ...vegetables.map(v => [
        v.id,
        `"${v.name}"`,
        `"${v.variety_name}"`,
        `"${v.plot_name}"`,
        v.status,
        v.planting_date || '',
        v.harvest_expected_date || '',
        this.formatDateForExport(v.created_at)
      ].join(','))
    ].join('\n')
    
    this.downloadCSV(csvContent, `野菜データ_${this.getDateString()}.csv`)
  }

  /**
   * 作業報告データCSVエクスポート
   */
  private exportWorkReportsToCSV(workReports: WorkReportExportData[]): void {
    const headers = [
      'ID',
      '野菜名',
      '圃場名',
      '作業種類',
      '作業日',
      '作業内容',
      '作業時間（時間）',
      '天候',
      '気温',
      '収穫量',
      '収穫単位',
      '登録日'
    ]
    
    const csvContent = [
      headers.join(','),
      ...workReports.map(w => [
        w.id,
        `"${w.vegetable_name || ''}"`,
        `"${w.plot_name || ''}"`,
        w.work_type,
        w.work_date,
        `"${w.description || ''}"`,
        w.duration_hours || '',
        w.weather || '',
        w.temperature || '',
        w.harvest_amount || '',
        w.harvest_unit || '',
        this.formatDateForExport(w.created_at)
      ].join(','))
    ].join('\n')
    
    this.downloadCSV(csvContent, `作業報告データ_${this.getDateString()}.csv`)
  }

  /**
   * 分析データCSVエクスポート
   */
  private exportAnalyticsToCSV(analytics: AnalyticsExportData[]): void {
    const headers = [
      '期間',
      '総作業時間（時間）',
      '総収穫量（kg）',
      '総売上（円）',
      '総コスト（円）',
      '利益（円）',
      '生産性スコア'
    ]
    
    const csvContent = [
      headers.join(','),
      ...analytics.map(a => [
        `"${a.period}"`,
        a.total_work_hours,
        a.total_harvest,
        a.total_revenue,
        a.total_cost,
        a.profit,
        a.productivity_score
      ].join(','))
    ].join('\n')
    
    this.downloadCSV(csvContent, `分析データ_${this.getDateString()}.csv`)
  }

  /**
   * 全データCSVエクスポート
   */
  private exportAllDataToCSV(
    vegetables: VegetableExportData[], 
    workReports: WorkReportExportData[], 
    analytics: AnalyticsExportData[]
  ): void {
    // 個別エクスポートを実行
    this.exportVegetablesToCSV(vegetables)
    
    setTimeout(() => {
      this.exportWorkReportsToCSV(workReports)
    }, 1000)
    
    setTimeout(() => {
      this.exportAnalyticsToCSV(analytics)
    }, 2000)
    
    alert('全データのCSVエクスポートを開始しました。\n複数のファイルがダウンロードされます。')
  }

  /**
   * Excelエクスポート（基本実装）
   * 実際の実装では xlsx ライブラリを使用することを推奨
   */
  private exportVegetablesToExcel(vegetables: VegetableExportData[]): void {
    // 簡易実装：CSV形式でダウンロード（.xlsx拡張子）
    this.exportVegetablesToCSV(vegetables)
    alert('Excel形式は今後のアップデートで対応予定です。現在はCSV形式でエクスポートされます。')
  }

  private exportWorkReportsToExcel(workReports: WorkReportExportData[]): void {
    this.exportWorkReportsToCSV(workReports)
    alert('Excel形式は今後のアップデートで対応予定です。現在はCSV形式でエクスポートされます。')
  }

  private exportAnalyticsToExcel(analytics: AnalyticsExportData[]): void {
    this.exportAnalyticsToCSV(analytics)
    alert('Excel形式は今後のアップデートで対応予定です。現在はCSV形式でエクスポートされます。')
  }

  private exportAllDataToExcel(
    vegetables: VegetableExportData[], 
    workReports: WorkReportExportData[], 
    analytics: AnalyticsExportData[]
  ): void {
    this.exportAllDataToCSV(vegetables, workReports, analytics)
    alert('Excel形式は今後のアップデートで対応予定です。現在はCSV形式でエクスポートされます。')
  }

  /**
   * CSVダウンロード
   */
  private downloadCSV(csvContent: string, filename: string): void {
    // BOMを追加してExcelでの文字化けを防ぐ
    const bom = '\uFEFF'
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
    
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    
  }

  /**
   * 野菜データ取得
   */
  private async fetchVegetables(): Promise<VegetableExportData[]> {
    const companyId = 'a1111111-1111-1111-1111-111111111111'
    
    // JWTトークンを含めたリクエスト
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    const response = await fetch(`/api/vegetables?company_id=${companyId}&limit=1000`, {
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error('野菜データの取得に失敗しました')
    }
    
    const result = await response.json()
    return result.data || []
  }

  /**
   * 作業報告データ取得
   */
  private async fetchWorkReports(options: ExportOptions): Promise<WorkReportExportData[]> {
    const companyId = 'a1111111-1111-1111-1111-111111111111'
    let url = `/api/reports?company_id=${companyId}&limit=1000`
    
    if (options.dateRange) {
      url += `&start_date=${options.dateRange.start}&end_date=${options.dateRange.end}`
    }
    
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error('作業報告データの取得に失敗しました')
    }
    
    const result = await response.json()
    return result.data || []
  }

  /**
   * 分析データ生成
   */
  private async generateAnalyticsData(options: ExportOptions): Promise<AnalyticsExportData[]> {
    // 実際の実装では過去のデータから分析を生成
    const currentDate = new Date()
    const analytics: AnalyticsExportData[] = []
    
    // 過去6ヶ月分の分析データを生成
    for (let i = 0; i < 6; i++) {
      const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1)
      const period = `${monthDate.getFullYear()}年${monthDate.getMonth() + 1}月`
      
      analytics.push({
        period,
        total_work_hours: Math.floor(Math.random() * 200) + 100,
        total_harvest: Math.floor(Math.random() * 500) + 200,
        total_revenue: Math.floor(Math.random() * 100000) + 50000,
        total_cost: Math.floor(Math.random() * 30000) + 20000,
        profit: Math.floor(Math.random() * 70000) + 30000,
        productivity_score: Math.floor(Math.random() * 30) + 70
      })
    }
    
    return analytics.reverse() // 古い順に並び替え
  }

  /**
   * 日付文字列取得
   */
  private getDateString(): string {
    const now = new Date()
    return `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`
  }

  /**
   * エクスポート用日付フォーマット
   */
  private formatDateForExport(dateString: string): string {
    try {
      const date = new Date(dateString)
      return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`
    } catch {
      return dateString
    }
  }
}

// シングルトンインスタンス
export const dataExportManager = new DataExportManager()

// 便利なフック
export const useDataExport = () => {
  return {
    /**
     * 野菜データエクスポート
     */
    exportVegetables: (options: ExportOptions) => dataExportManager.exportVegetables(options),

    /**
     * 作業報告データエクスポート
     */
    exportWorkReports: (options: ExportOptions) => dataExportManager.exportWorkReports(options),

    /**
     * 分析データエクスポート
     */
    exportAnalytics: (options: ExportOptions) => dataExportManager.exportAnalytics(options),

    /**
     * 全データエクスポート
     */
    exportAllData: (options: ExportOptions) => dataExportManager.exportAllData(options)
  }
}

export default dataExportManager