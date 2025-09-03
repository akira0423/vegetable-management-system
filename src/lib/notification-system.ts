'use client'

/**
 * プロフェッショナル通知システム
 * タスク期限・収穫時期・重要アラートの管理
 */

import { createClient } from '@/lib/supabase/client'

interface NotificationData {
  id: string
  type: 'task_deadline' | 'harvest_alert' | 'weather_warning' | 'work_reminder' | 'system_alert'
  title: string
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  vegetable_id?: string
  task_id?: string
  due_date?: string
  created_at: string
  read: boolean
  action_url?: string
}

interface VegetableData {
  id: string
  name: string
  variety_name: string
  plot_name: string
  planting_date?: string
  harvest_expected_date?: string
}

interface TaskData {
  id: string
  title: string
  vegetable_id: string
  due_date: string
  status: string
}

type NotificationHandler = (notification: NotificationData) => void

class NotificationManager {
  private notifications: NotificationData[] = []
  private listeners: NotificationHandler[] = []
  private checkInterval: NodeJS.Timeout | null = null
  private isInitialized: boolean = false

  constructor() {
    if (typeof window !== 'undefined') {
      this.initialize()
    }
  }

  /**
   * 通知システム初期化
   */
  private initialize() {
    this.loadStoredNotifications()
    this.startPeriodicCheck()
    this.requestNotificationPermission()
    this.isInitialized = true
    console.log('🔔 通知システム初期化完了')
  }

  /**
   * 保存された通知を読み込み
   */
  private loadStoredNotifications() {
    try {
      const stored = localStorage.getItem('farm-notifications')
      if (stored) {
        this.notifications = JSON.parse(stored)
      }
    } catch (error) {
      console.error('通知データ読み込みエラー:', error)
      this.notifications = []
    }
  }

  /**
   * 通知をローカルストレージに保存
   */
  private saveNotifications() {
    try {
      localStorage.setItem('farm-notifications', JSON.stringify(this.notifications))
    } catch (error) {
      console.error('通知データ保存エラー:', error)
    }
  }

  /**
   * ブラウザ通知許可の要求
   */
  private async requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission()
        console.log('通知許可状況:', permission)
      } catch (error) {
        console.error('通知許可要求エラー:', error)
      }
    }
  }

  /**
   * 定期チェック開始（30分間隔）
   */
  private startPeriodicCheck() {
    this.checkInterval = setInterval(() => {
      this.checkDeadlinesAndAlerts()
    }, 30 * 60 * 1000) // 30分間隔

    // 初回実行
    setTimeout(() => {
      this.checkDeadlinesAndAlerts()
    }, 5000) // 5秒後に初回チェック
  }

  /**
   * タスク期限と収穫時期のチェック
   */
  private async checkDeadlinesAndAlerts() {
    try {
      console.log('🔍 期限・アラートチェック実行中...')
      
      // 野菜データを取得
      const vegetables = await this.fetchVegetables()
      
      // タスクデータを取得
      const tasks = await this.fetchTasks()

      // 期限チェック
      this.checkTaskDeadlines(tasks, vegetables)
      
      // 収穫時期チェック
      this.checkHarvestAlerts(vegetables)
      
      // 天候関連アラート（サンプル）
      this.checkWeatherAlerts()

    } catch (error) {
      console.error('期限チェックエラー:', error)
    }
  }

  /**
   * 野菜データ取得
   */
  private async fetchVegetables(): Promise<VegetableData[]> {
    try {
      // 動的にcompany_idを取得
      const userResponse = await fetch('/api/auth/user')
      let companyId = 'a1111111-1111-1111-1111-111111111111' // デフォルト
      
      if (userResponse.ok) {
        const userData = await userResponse.json()
        if (userData.success && userData.user?.company_id) {
          companyId = userData.user.company_id
          console.log('📢 通知システム - 使用するcompany_id:', companyId)
        }
      }
      
      // JWTトークンを含めたリクエスト
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      const response = await fetch(`/api/vegetables?company_id=${companyId}&limit=100`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const result = await response.json()
        console.log('📢 通知システム - 取得した野菜数:', result.data?.length || 0)
        return result.data || []
      }
    } catch (error) {
      console.error('野菜データ取得エラー:', error)
    }
    
    return []
  }

  /**
   * タスクデータ取得
   */
  private async fetchTasks(): Promise<TaskData[]> {
    try {
      // 動的にcompany_idを取得
      const userResponse = await fetch('/api/auth/user')
      let companyId = 'a1111111-1111-1111-1111-111111111111' // デフォルト
      
      if (userResponse.ok) {
        const userData = await userResponse.json()
        if (userData.success && userData.user?.company_id) {
          companyId = userData.user.company_id
          console.log('📢 通知システム - タスク用company_id:', companyId)
        }
      }
      
      const response = await fetch(`/api/growing-tasks?company_id=${companyId}&limit=100`)
      
      if (response.ok) {
        const result = await response.json()
        console.log('📢 通知システム - 取得したタスク数:', result.data?.length || 0)
        return result.data || []
      }
    } catch (error) {
      console.error('タスクデータ取得エラー:', error)
    }
    
    return []
  }

  /**
   * タスク期限チェック
   */
  private checkTaskDeadlines(tasks: TaskData[], vegetables: VegetableData[]) {
    const now = new Date()
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

    tasks.forEach(task => {
      if (task.status === 'completed') return

      const dueDate = new Date(task.due_date)
      const vegetable = vegetables.find(v => v.id === task.vegetable_id)
      const vegetableName = vegetable ? `${vegetable.name}（${vegetable.plot_name}）` : '不明な野菜'

      // 期限超過チェック
      if (dueDate < now) {
        this.addNotification({
          type: 'task_deadline',
          title: '⚠️ タスク期限超過',
          message: `${task.title} - ${vegetableName}\n期限: ${this.formatDate(dueDate)}`,
          severity: 'critical',
          vegetable_id: task.vegetable_id,
          task_id: task.id,
          due_date: task.due_date,
          action_url: '/dashboard/gantt'
        })
      }
      // 明日が期限
      else if (dueDate <= tomorrow) {
        this.addNotification({
          type: 'task_deadline',
          title: '🔶 タスク期限間近（明日まで）',
          message: `${task.title} - ${vegetableName}\n期限: ${this.formatDate(dueDate)}`,
          severity: 'high',
          vegetable_id: task.vegetable_id,
          task_id: task.id,
          due_date: task.due_date,
          action_url: '/dashboard/gantt'
        })
      }
      // 3日以内
      else if (dueDate <= threeDaysLater) {
        this.addNotification({
          type: 'task_deadline',
          title: '🔔 タスク期限が近づいています',
          message: `${task.title} - ${vegetableName}\n期限: ${this.formatDate(dueDate)}`,
          severity: 'medium',
          vegetable_id: task.vegetable_id,
          task_id: task.id,
          due_date: task.due_date,
          action_url: '/dashboard/gantt'
        })
      }
    })
  }

  /**
   * 収穫時期アラートチェック
   */
  private checkHarvestAlerts(vegetables: VegetableData[]) {
    const now = new Date()
    const oneWeekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

    vegetables.forEach(vegetable => {
      if (!vegetable.harvest_expected_date) return

      const harvestDate = new Date(vegetable.harvest_expected_date)
      const vegetableName = `${vegetable.name}（${vegetable.plot_name}）`

      // 収穫予定日を過ぎている
      if (harvestDate < now) {
        this.addNotification({
          type: 'harvest_alert',
          title: '🍅 収穫時期を過ぎています',
          message: `${vegetableName}\n予定収穫日: ${this.formatDate(harvestDate)}`,
          severity: 'high',
          vegetable_id: vegetable.id,
          action_url: '/dashboard/map'
        })
      }
      // 1週間以内
      else if (harvestDate <= oneWeekLater) {
        this.addNotification({
          type: 'harvest_alert',
          title: '🌟 収穫時期が近づいています',
          message: `${vegetableName}\n予定収穫日: ${this.formatDate(harvestDate)}`,
          severity: 'medium',
          vegetable_id: vegetable.id,
          action_url: '/dashboard/map'
        })
      }
      // 2週間以内（準備通知）
      else if (harvestDate <= twoWeeksLater) {
        this.addNotification({
          type: 'harvest_alert',
          title: '📅 収穫準備のお知らせ',
          message: `${vegetableName}\n予定収穫日: ${this.formatDate(harvestDate)}\n収穫準備を始めましょう`,
          severity: 'low',
          vegetable_id: vegetable.id,
          action_url: '/dashboard/map'
        })
      }
    })
  }

  /**
   * 天候関連アラート（サンプル実装）
   */
  private checkWeatherAlerts() {
    // 実際の実装では気象APIと連携
    const now = new Date()
    const isWinterSeason = now.getMonth() >= 11 || now.getMonth() <= 2
    
    if (isWinterSeason) {
      // 冬季の霜注意報（サンプル）
      this.addNotification({
        type: 'weather_warning',
        title: '❄️ 霜注意報',
        message: '今夜は冷え込みが予想されます。\n施設の保温対策をご確認ください。',
        severity: 'medium',
        action_url: '/dashboard'
      })
    }
  }

  /**
   * 通知追加（重複チェック付き）
   */
  private addNotification(notificationData: Omit<NotificationData, 'id' | 'created_at' | 'read'>) {
    const notificationId = this.generateNotificationId(notificationData)
    
    // 重複チェック（同じタイプ・対象・期限の通知が既にある場合はスキップ）
    const exists = this.notifications.some(n => 
      n.type === notificationData.type &&
      n.vegetable_id === notificationData.vegetable_id &&
      n.task_id === notificationData.task_id &&
      n.due_date === notificationData.due_date &&
      !n.read
    )

    if (exists) {
      return
    }

    const notification: NotificationData = {
      ...notificationData,
      id: notificationId,
      created_at: new Date().toISOString(),
      read: false
    }

    this.notifications.unshift(notification)
    this.saveNotifications()

    // リスナーに通知
    this.notifyListeners(notification)

    // ブラウザ通知
    this.showBrowserNotification(notification)

    console.log('🔔 新しい通知を追加:', notification.title)
  }

  /**
   * 通知ID生成
   */
  private generateNotificationId(data: Omit<NotificationData, 'id' | 'created_at' | 'read'>): string {
    const components = [
      data.type,
      data.vegetable_id || '',
      data.task_id || '',
      data.due_date || '',
      Date.now().toString()
    ]
    return components.join('-')
  }

  /**
   * ブラウザ通知表示
   */
  private showBrowserNotification(notification: NotificationData) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const browserNotification = new Notification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: notification.id
        })

        // 5秒後に自動で閉じる
        setTimeout(() => {
          browserNotification.close()
        }, 5000)

        // クリック時の動作
        browserNotification.onclick = () => {
          if (notification.action_url) {
            window.open(notification.action_url, '_blank')
          }
          browserNotification.close()
        }
      } catch (error) {
        console.error('ブラウザ通知エラー:', error)
      }
    }
  }

  /**
   * リスナー通知
   */
  private notifyListeners(notification: NotificationData) {
    this.listeners.forEach(listener => {
      try {
        listener(notification)
      } catch (error) {
        console.error('通知リスナーエラー:', error)
      }
    })
  }

  /**
   * 日付フォーマット
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short'
    })
  }

  /**
   * 通知リスナー登録
   */
  public onNotification(handler: NotificationHandler): () => void {
    this.listeners.push(handler)
    
    // クリーンアップ関数を返す
    return () => {
      const index = this.listeners.indexOf(handler)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  /**
   * 全通知取得
   */
  public getAllNotifications(): NotificationData[] {
    return [...this.notifications]
  }

  /**
   * 未読通知取得
   */
  public getUnreadNotifications(): NotificationData[] {
    return this.notifications.filter(n => !n.read)
  }

  /**
   * 重要度別通知取得
   */
  public getNotificationsBySeverity(severity: NotificationData['severity']): NotificationData[] {
    return this.notifications.filter(n => n.severity === severity)
  }

  /**
   * 通知を既読にする
   */
  public markAsRead(notificationId: string): void {
    const notification = this.notifications.find(n => n.id === notificationId)
    if (notification) {
      notification.read = true
      this.saveNotifications()
    }
  }

  /**
   * 全通知を既読にする
   */
  public markAllAsRead(): void {
    this.notifications.forEach(n => n.read = true)
    this.saveNotifications()
  }

  /**
   * 通知削除
   */
  public deleteNotification(notificationId: string): void {
    this.notifications = this.notifications.filter(n => n.id !== notificationId)
    this.saveNotifications()
  }

  /**
   * 古い通知のクリーンアップ（30日以上前）
   */
  public cleanupOldNotifications(): void {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    this.notifications = this.notifications.filter(n => 
      new Date(n.created_at) > thirtyDaysAgo
    )
    this.saveNotifications()
  }

  /**
   * 手動チェック実行
   */
  public async checkNow(): Promise<void> {
    await this.checkDeadlinesAndAlerts()
  }

  /**
   * 統計情報取得
   */
  public getStats() {
    const total = this.notifications.length
    const unread = this.getUnreadNotifications().length
    const critical = this.getNotificationsBySeverity('critical').length
    const high = this.getNotificationsBySeverity('high').length

    return {
      total,
      unread,
      critical,
      high,
      read: total - unread
    }
  }

  /**
   * システム終了時のクリーンアップ
   */
  public destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
    }
    this.listeners = []
  }
}

// シングルトンインスタンス
export const notificationManager = new NotificationManager()

// 便利なフック
export const useNotifications = () => {
  return {
    /**
     * 全通知取得
     */
    getAllNotifications: () => notificationManager.getAllNotifications(),

    /**
     * 未読通知取得
     */
    getUnreadNotifications: () => notificationManager.getUnreadNotifications(),

    /**
     * 通知リスナー登録
     */
    onNotification: (handler: NotificationHandler) => notificationManager.onNotification(handler),

    /**
     * 通知を既読にする
     */
    markAsRead: (id: string) => notificationManager.markAsRead(id),

    /**
     * 全通知を既読にする
     */
    markAllAsRead: () => notificationManager.markAllAsRead(),

    /**
     * 通知削除
     */
    deleteNotification: (id: string) => notificationManager.deleteNotification(id),

    /**
     * 統計情報取得
     */
    getStats: () => notificationManager.getStats(),

    /**
     * 手動チェック実行
     */
    checkNow: () => notificationManager.checkNow()
  }
}

export default notificationManager