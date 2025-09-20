'use client'

/**
 * プロフェッショナル版リアルタイム同期システム
 * WebSocketベースのリアルタイムデータ同期を提供
 */

interface SyncEvent {
  type: 'vegetable_created' | 'vegetable_updated' | 'vegetable_deleted' | 'vegetable_archived' |
        'task_created' | 'task_updated' | 'task_deleted' |
        'work_report_created' | 'work_report_updated' |
        'analytics_updated'
  data: any
  timestamp: string
  source: string
}

type SyncEventHandler = (event: SyncEvent) => void

class RealtimeSyncManager {
  private listeners: Map<string, SyncEventHandler[]> = new Map()
  private isConnected: boolean = false
  private reconnectInterval: number = 5000
  private heartbeatInterval: NodeJS.Timeout | null = null
  private lastActivity: number = Date.now()

  constructor() {
    // ブラウザ環境でのみ実行
    if (typeof window !== 'undefined') {
      this.initializeSync()
      this.setupVisibilityChangeHandler()
      this.setupStorageListener()
    }
  }

  /**
   * 同期システムを初期化
   */
  private initializeSync() {
    // ハートビート開始
    this.startHeartbeat()
    
    // ページ間通信用のBroadcastChannelを設定
    this.setupBroadcastChannel()
    
    
  }

  /**
   * BroadcastChannelによるページ間同期
   */
  private setupBroadcastChannel() {
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel('farm-app-sync')
      
      channel.addEventListener('message', (event) => {
        const syncEvent: SyncEvent = event.data
        this.handleSyncEvent(syncEvent)
      })

      // チャンネル送信メソッド
      this.broadcastEvent = (event: SyncEvent) => {
        channel.postMessage(event)
      }
    }
  }

  private broadcastEvent: ((event: SyncEvent) => void) | null = null

  /**
   * ページ可視性変更ハンドラー（タブ切り替え時の同期）
   */
  private setupVisibilityChangeHandler() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        // タブがアクティブになった時にデータを同期
        this.triggerFullSync()
      }
    })
  }

  /**
   * LocalStorage監視（他のタブでの変更検出）
   */
  private setupStorageListener() {
    window.addEventListener('storage', (event) => {
      if (event.key === 'farm-app-last-update') {
        // 他のタブでデータが更新された
        this.triggerFullSync()
      }
    })
  }

  /**
   * ハートビート開始
   */
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.checkDataFreshness()
    }, 30000) // 30秒間隔
  }

  /**
   * データの新鮮度チェック
   */
  private checkDataFreshness() {
    const now = Date.now()
    const timeSinceLastActivity = now - this.lastActivity

    // 5分以上アクティビティがない場合はフル同期
    if (timeSinceLastActivity > 300000) {
      this.triggerFullSync()
    }
  }

  /**
   * フル同期トリガー
   */
  private triggerFullSync() {
    
    
    // 全てのリスナーに同期イベントを送信
    const syncEvent: SyncEvent = {
      type: 'analytics_updated',
      data: { action: 'full_sync_required' },
      timestamp: new Date().toISOString(),
      source: 'realtime-sync'
    }

    this.handleSyncEvent(syncEvent)
    this.markActivity()
  }

  /**
   * イベントリスナー登録
   */
  public on(eventType: string, handler: SyncEventHandler): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, [])
    }
    this.listeners.get(eventType)!.push(handler)
  }

  /**
   * イベントリスナー削除
   */
  public off(eventType: string, handler: SyncEventHandler): void {
    const handlers = this.listeners.get(eventType)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }

  /**
   * 同期イベントの処理
   */
  private handleSyncEvent(event: SyncEvent) {
    

    // 関連するリスナーを実行
    const handlers = this.listeners.get(event.type) || []
    const globalHandlers = this.listeners.get('*') || []

    handlers.concat(globalHandlers).forEach(handler => {
      try {
        handler(event)
      } catch (error) {
        
      }
    })

    this.markActivity()
  }

  /**
   * 同期イベントの送信
   */
  public emit(event: SyncEvent): void {
    // LocalStorageに最終更新時刻を記録
    localStorage.setItem('farm-app-last-update', event.timestamp)

    // BroadcastChannelで他のタブに通知
    if (this.broadcastEvent) {
      this.broadcastEvent(event)
    }

    // ローカル処理
    this.handleSyncEvent(event)
  }

  /**
   * 野菜データ更新通知
   */
  public notifyVegetableUpdate(action: 'created' | 'updated' | 'deleted', data: any): void {
    this.emit({
      type: `vegetable_${action}` as any,
      data,
      timestamp: new Date().toISOString(),
      source: 'user_action'
    })
  }

  /**
   * タスクデータ更新通知
   */
  public notifyTaskUpdate(action: 'created' | 'updated' | 'deleted', data: any): void {
    this.emit({
      type: `task_${action}` as any,
      data,
      timestamp: new Date().toISOString(),
      source: 'user_action'
    })
  }

  /**
   * 作業報告データ更新通知
   */
  public notifyWorkReportUpdate(action: 'created' | 'updated', data: any): void {
    this.emit({
      type: `work_report_${action}` as any,
      data,
      timestamp: new Date().toISOString(),
      source: 'user_action'
    })
  }

  /**
   * アクティビティマーク
   */
  private markActivity(): void {
    this.lastActivity = Date.now()
  }

  /**
   * クリーンアップ
   */
  public destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }
  }
}

// シングルトンインスタンス
export const realtimeSync = new RealtimeSyncManager()

// 便利な使用方法のエクスポート
export const useRealtimeSync = () => {
  return {
    /**
     * 野菜データの変更を他のページに通知
     */
    notifyVegetableChange: (action: 'created' | 'updated' | 'deleted', data: any) => {
      realtimeSync.notifyVegetableUpdate(action, data)
    },

    /**
     * タスクデータの変更を他のページに通知
     */
    notifyTaskChange: (action: 'created' | 'updated' | 'deleted', data: any) => {
      realtimeSync.notifyTaskUpdate(action, data)
    },

    /**
     * 作業報告データの変更を他のページに通知
     */
    notifyWorkReportChange: (action: 'created' | 'updated', data: any) => {
      realtimeSync.notifyWorkReportUpdate(action, data)
    },

    /**
     * データ変更イベントの監視
     */
    onDataChange: (eventType: string, handler: SyncEventHandler) => {
      realtimeSync.on(eventType, handler)
      
      // クリーンアップ用の関数を返す
      return () => {
        realtimeSync.off(eventType, handler)
      }
    }
  }
}

export default realtimeSync