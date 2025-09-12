/**
 * MapLibre GL 動的ローダー
 * Next.js 15での動的インポートエラーを解決する統一ライブラリ
 */

import type maplibregl from 'maplibre-gl'

// MapLibre GLライブラリの型定義
export type MapLibreGL = typeof maplibregl

// ロード状態の管理
let mapLibrePromise: Promise<MapLibreGL> | null = null
let mapLibreInstance: MapLibreGL | null = null

/**
 * MapLibre GLを安全に動的ロードする
 * エラーハンドリングとリトライ機能付き
 */
export async function loadMapLibreGL(retries: number = 3): Promise<MapLibreGL> {
  // 既にロード済みの場合は即座に返す
  if (mapLibreInstance) {
    return mapLibreInstance
  }

  // ロード中の場合は既存のPromiseを返す
  if (mapLibrePromise) {
    return mapLibrePromise
  }

  // 新しくロードを開始
  mapLibrePromise = attemptLoad(retries)
  
  try {
    mapLibreInstance = await mapLibrePromise
    return mapLibreInstance
  } catch (error) {
    // ロード失敗時はPromiseをリセット
    mapLibrePromise = null
    throw error
  }
}

/**
 * ロード試行（リトライ機能付き）
 */
async function attemptLoad(retries: number): Promise<MapLibreGL> {
  let lastError: Error | null = null

  for (let i = 0; i <= retries; i++) {
    try {
      console.log(`🗺️ MapLibre GL ロード試行 ${i + 1}/${retries + 1}`)
      
      // 動的インポート実行
      const maplibreModule = await import('maplibre-gl')
      
      // デフォルトエクスポートまたは名前付きエクスポートを確認
      const maplibre = maplibreModule.default || maplibreModule
      
      if (!maplibre || typeof maplibre.Map !== 'function') {
        throw new Error('MapLibre GL Mapクラスが見つかりません')
      }

      console.log('✅ MapLibre GL ロード成功')
      return maplibre as MapLibreGL
      
    } catch (error) {
      lastError = error as Error
      console.warn(`❌ MapLibre GL ロード失敗 (試行 ${i + 1}):`, error)
      
      // 最後の試行でない場合は少し待つ
      if (i < retries) {
        await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)))
      }
    }
  }

  // 全て失敗した場合
  throw new Error(`MapLibre GL のロードに失敗しました (${retries + 1}回試行): ${lastError?.message}`)
}

/**
 * MapLibre GLがロード済みかどうかを確認
 */
export function isMapLibreLoaded(): boolean {
  return mapLibreInstance !== null
}

/**
 * ロード済みのMapLibre GLインスタンスを取得（ロードされていない場合はnull）
 */
export function getMapLibreInstance(): MapLibreGL | null {
  return mapLibreInstance
}

/**
 * MapLibre GLのロード状態をリセット（テスト用）
 */
export function resetMapLibreLoader(): void {
  mapLibrePromise = null
  mapLibreInstance = null
}

/**
 * CSS（maplibre-gl/dist/maplibre-gl.css）の動的ロード
 */
export function loadMapLibreCSS(): Promise<void> {
  return new Promise((resolve, reject) => {
    // 既にロード済みかチェック
    if (document.querySelector('link[href*="maplibre-gl.css"]')) {
      resolve()
      return
    }

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css'
    
    link.onload = () => {
      console.log('✅ MapLibre GL CSS ロード完了')
      resolve()
    }
    
    link.onerror = () => {
      console.error('❌ MapLibre GL CSS ロード失敗')
      reject(new Error('MapLibre GL CSSのロードに失敗しました'))
    }
    
    document.head.appendChild(link)
  })
}

/**
 * MapLibre GLの完全初期化（ライブラリ + CSS）
 */
export async function initializeMapLibre(retries: number = 3): Promise<MapLibreGL> {
  try {
    // CSS と ライブラリを並行ロード
    const [maplibre] = await Promise.all([
      loadMapLibreGL(retries),
      loadMapLibreCSS()
    ])
    
    console.log('🎯 MapLibre GL 初期化完了')
    return maplibre
  } catch (error) {
    console.error('❌ MapLibre GL 初期化失敗:', error)
    throw error
  }
}