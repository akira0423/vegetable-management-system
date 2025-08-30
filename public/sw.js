// AgriFinance Pro - Service Worker
// 農作業現場でのオフライン対応を重視したキャッシュ戦略

const CACHE_NAME = 'agrifinance-pro-v1'
const CACHE_VERSION = '1.0.0'

// キャッシュするリソース（農作業に必要な最小限）
const STATIC_CACHE = [
  '/',
  '/dashboard',
  '/dashboard/gantt',
  '/dashboard/analytics', 
  '/dashboard/photos',
  '/dashboard/users',
  '/manifest.json',
  // 基本的なスタイルとスクリプト
  '/globals.css',
  // アイコンフォント（オフラインでも表示）
  'https://cdnjs.cloudflare.com/ajax/libs/lucide/0.263.1/lucide.min.css'
]

// API キャッシュ対象（読み取り専用データ）
const API_CACHE_PATTERNS = [
  '/api/vegetables',
  '/api/pesticides',
  '/api/weather',
  '/api/companies'
]

// オフライン時に優先表示するページ
const OFFLINE_PAGES = {
  '/': '/dashboard',
  '/dashboard': '/dashboard',
  '/dashboard/gantt': '/dashboard/gantt',
  '/dashboard/analytics': '/offline-analytics.html',
  '/dashboard/photos': '/offline-photos.html'
}

// インストール時の処理
self.addEventListener('install', (event) => {
  console.log('🚀 AgriFinance Pro SW - インストール開始')
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 静的リソースをキャッシュ中...')
      return cache.addAll(STATIC_CACHE)
    }).then(() => {
      console.log('✅ AgriFinance Pro SW - インストール完了')
      return self.skipWaiting()
    }).catch((error) => {
      console.error('❌ SW インストールエラー:', error)
    })
  )
})

// アクティベート時の処理（古いキャッシュ削除）
self.addEventListener('activate', (event) => {
  console.log('🔄 AgriFinance Pro SW - アクティベート開始')
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ 古いキャッシュを削除:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    }).then(() => {
      console.log('✅ AgriFinance Pro SW - アクティベート完了')
      return self.clients.claim()
    })
  )
})

// フェッチイベント（リクエスト処理）
self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  
  // POST/PUT/DELETE は キャッシュしない（作業記録等の更新）
  if (request.method !== 'GET') {
    return
  }
  
  // 農作業に特化したキャッシュ戦略
  if (url.pathname.startsWith('/api/')) {
    // API: ネットワーク優先、フォールバックでキャッシュ
    event.respondWith(networkFirstStrategy(request))
  } else if (url.pathname.includes('/dashboard/')) {
    // ダッシュボード: キャッシュ優先、フォールバックでネットワーク
    event.respondWith(cacheFirstStrategy(request))
  } else {
    // その他: ネットワーク優先
    event.respondWith(networkFirstStrategy(request))
  }
})

// ネットワーク優先戦略（リアルタイム性重視）
async function networkFirstStrategy(request) {
  const cache = await caches.open(CACHE_NAME)
  
  try {
    // ネットワークから取得を試行
    const networkResponse = await fetch(request)
    
    if (networkResponse.ok) {
      // 成功時はキャッシュに保存
      const responseClone = networkResponse.clone()
      
      // API データは短期間キャッシュ
      if (request.url.includes('/api/')) {
        const cachedResponse = await cache.put(request, responseClone)
        
        // 5分後に期限切れとマーク
        setTimeout(() => {
          cache.delete(request)
        }, 5 * 60 * 1000)
      } else {
        cache.put(request, responseClone)
      }
    }
    
    return networkResponse
  } catch (error) {
    console.warn('🌐 ネットワークエラー、キャッシュから取得:', request.url)
    
    // ネットワークエラー時はキャッシュから取得
    const cachedResponse = await cache.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    
    // キャッシュにもない場合はオフラインページ
    return getOfflinePage(request.url)
  }
}

// キャッシュ優先戦略（表示速度重視）
async function cacheFirstStrategy(request) {
  const cache = await caches.open(CACHE_NAME)
  const cachedResponse = await cache.match(request)
  
  if (cachedResponse) {
    // バックグラウンドでネットワークから更新
    fetch(request).then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone())
      }
    }).catch(() => {
      // ネットワークエラーは無視
    })
    
    return cachedResponse
  }
  
  // キャッシュにない場合はネットワークから取得
  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (error) {
    return getOfflinePage(request.url)
  }
}

// オフライン用ページの取得
async function getOfflinePage(url) {
  const pathname = new URL(url).pathname
  const offlinePage = OFFLINE_PAGES[pathname] || '/offline.html'
  
  const cache = await caches.open(CACHE_NAME)
  const cachedOfflinePage = await cache.match(offlinePage)
  
  if (cachedOfflinePage) {
    return cachedOfflinePage
  }
  
  // 最終フォールバック: シンプルなオフラインレスポンス
  return new Response(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>AgriFinance Pro - オフライン</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 0;
          padding: 20px;
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container {
          text-align: center;
          background: white;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          max-width: 400px;
        }
        .icon {
          font-size: 64px;
          margin-bottom: 20px;
        }
        h1 {
          color: #059669;
          margin: 0 0 16px 0;
        }
        p {
          color: #6b7280;
          margin: 0 0 20px 0;
          line-height: 1.6;
        }
        .retry-btn {
          background: #059669;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 16px;
        }
        .retry-btn:hover {
          background: #047857;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">🌾</div>
        <h1>オフラインモード</h1>
        <p>インターネット接続を確認してください。<br>一部の機能は利用できませんが、記録した作業データは保存されています。</p>
        <button class="retry-btn" onclick="window.location.reload()">再試行</button>
      </div>
    </body>
    </html>
  `, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8'
    }
  })
}

// バックグラウンド同期（オンライン復帰時の自動同期）
self.addEventListener('sync', (event) => {
  console.log('🔄 バックグラウンド同期:', event.tag)
  
  if (event.tag === 'work-report-sync') {
    event.waitUntil(syncWorkReports())
  } else if (event.tag === 'pesticide-record-sync') {
    event.waitUntil(syncPesticideRecords())
  }
})

// 作業記録の同期
async function syncWorkReports() {
  try {
    // IndexedDB から未同期の作業記録を取得
    const pendingReports = await getPendingWorkReports()
    
    for (const report of pendingReports) {
      try {
        const response = await fetch('/api/reports', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(report)
        })
        
        if (response.ok) {
          await removePendingWorkReport(report.id)
          console.log('✅ 作業記録同期成功:', report.id)
        }
      } catch (error) {
        console.error('❌ 作業記録同期エラー:', error)
      }
    }
  } catch (error) {
    console.error('❌ バックグラウンド同期エラー:', error)
  }
}

// 農薬記録の同期
async function syncPesticideRecords() {
  try {
    const pendingRecords = await getPendingPesticideRecords()
    
    for (const record of pendingRecords) {
      try {
        const response = await fetch('/api/pesticide-applications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(record)
        })
        
        if (response.ok) {
          await removePendingPesticideRecord(record.id)
          console.log('✅ 農薬記録同期成功:', record.id)
        }
      } catch (error) {
        console.error('❌ 農薬記録同期エラー:', error)
      }
    }
  } catch (error) {
    console.error('❌ 農薬記録同期エラー:', error)
  }
}

// IndexedDB 操作（オフライン時のデータ保存用）
async function getPendingWorkReports() {
  // TODO: IndexedDB から未同期データを取得
  return []
}

async function removePendingWorkReport(id) {
  // TODO: IndexedDB から同期済みデータを削除
}

async function getPendingPesticideRecords() {
  // TODO: IndexedDB から未同期農薬記録を取得
  return []
}

async function removePendingPesticideRecord(id) {
  // TODO: IndexedDB から同期済み農薬記録を削除
}

// プッシュ通知（気象警報等）
self.addEventListener('push', (event) => {
  console.log('📱 プッシュ通知受信:', event)
  
  if (!event.data) return
  
  try {
    const data = event.data.json()
    const options = {
      body: data.body || '重要な通知があります',
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: data.tag || 'agrifinance-notification',
      data: data.data || {},
      requireInteraction: data.urgent || false,
      actions: data.actions || [
        {
          action: 'view',
          title: '確認する',
          icon: '/action-view.png'
        },
        {
          action: 'dismiss',
          title: '閉じる'
        }
      ]
    }
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'AgriFinance Pro', options)
    )
  } catch (error) {
    console.error('❌ プッシュ通知処理エラー:', error)
  }
})

// 通知クリック処理
self.addEventListener('notificationclick', (event) => {
  console.log('📱 通知クリック:', event)
  
  event.notification.close()
  
  if (event.action === 'view') {
    const url = event.notification.data?.url || '/dashboard'
    event.waitUntil(
      self.clients.openWindow(url)
    )
  }
})

console.log('✅ AgriFinance Pro Service Worker 読み込み完了')