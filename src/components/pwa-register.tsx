'use client'

import { useEffect, useState } from 'react'

export function PWARegister() {
  const [isInstallable, setIsInstallable] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    // Service Worker 登録
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { 
          scope: '/',
          updateViaCache: 'none' 
        })
        .then((registration) => {
          console.log('✅ AgriFinance Pro SW - 登録成功:', registration)
          
          // 更新チェック
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // 新しいバージョンが利用可能
                  showUpdateNotification()
                }
              })
            }
          })
        })
        .catch((error) => {
          console.error('❌ AgriFinance Pro SW - 登録失敗:', error)
        })
    }

    // PWA インストールプロンプト処理
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('📱 PWA インストールプロンプト準備')
      e.preventDefault()
      setDeferredPrompt(e)
      setIsInstallable(true)
    }

    const handleAppInstalled = () => {
      console.log('✅ AgriFinance Pro PWA - インストール完了')
      setDeferredPrompt(null)
      setIsInstallable(false)
      
      // インストール完了の通知を表示
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('AgriFinance Pro', {
          body: 'アプリがインストールされました。オフラインでも作業記録が可能です。',
          icon: '/icon-192x192.png',
          tag: 'app-installed'
        })
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    // 通知許可要求
    requestNotificationPermission()

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  // アプリインストール実行
  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    try {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      
      console.log('🤔 PWA インストール選択:', outcome)
      
      if (outcome === 'accepted') {
        console.log('✅ ユーザーがPWAインストールを承認')
      } else {
        console.log('❌ ユーザーがPWAインストールを拒否')
      }
      
      setDeferredPrompt(null)
      setIsInstallable(false)
    } catch (error) {
      console.error('❌ PWA インストールエラー:', error)
    }
  }

  // 通知許可要求
  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission()
        if (permission === 'granted') {
          console.log('✅ 通知許可取得成功')
          
          // 歓迎通知
          new Notification('AgriFinance Pro', {
            body: '天気警報や作業アラートをお知らせします。',
            icon: '/icon-192x192.png',
            tag: 'welcome'
          })
        } else {
          console.log('❌ 通知許可拒否')
        }
      } catch (error) {
        console.error('❌ 通知許可要求エラー:', error)
      }
    }
  }

  // アップデート通知表示
  const showUpdateNotification = () => {
    const updateBanner = document.createElement('div')
    updateBanner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #059669;
      color: white;
      padding: 12px 16px;
      text-align: center;
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
    `
    updateBanner.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; max-width: 800px; margin: 0 auto;">
        <span>🌾 AgriFinance Pro の新しいバージョンが利用可能です</span>
        <button 
          onclick="window.location.reload()" 
          style="background: white; color: #059669; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;"
        >
          更新
        </button>
      </div>
    `
    
    document.body.insertBefore(updateBanner, document.body.firstChild)
    
    // 10秒後に自動で消す
    setTimeout(() => {
      if (updateBanner.parentNode) {
        updateBanner.parentNode.removeChild(updateBanner)
      }
    }, 10000)
  }

  // PWA インストールバナー
  if (isInstallable && deferredPrompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white p-4 rounded-lg shadow-lg z-50 max-w-md mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-lg">🌾</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">アプリをインストール</h3>
            <p className="text-xs text-green-100 mt-1">
              オフラインでも作業記録が可能になります
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => {
                setIsInstallable(false)
                setDeferredPrompt(null)
              }}
              className="text-xs px-2 py-1 text-green-100 hover:text-white"
            >
              後で
            </button>
            <button
              onClick={handleInstallClick}
              className="text-xs px-3 py-1 bg-white text-green-600 rounded font-semibold hover:bg-green-50"
            >
              インストール
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}