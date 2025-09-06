'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { X, MapPin, Loader2 } from 'lucide-react'

interface FarmMapViewProps {
  onClose: () => void
}

export default function FarmMapView({ onClose }: FarmMapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // CDNライブラリの読み込み確認
    const checkLibraries = () => {
      if (typeof window === 'undefined') return false
      
      const maplibregl = (window as any).maplibregl
      const MapboxDraw = (window as any).MapboxDraw
      
      if (!maplibregl || !MapboxDraw) {
        console.log('Libraries check:', { 
          maplibregl: !!maplibregl, 
          MapboxDraw: !!MapboxDraw 
        })
        return false
      }
      
      return { maplibregl, MapboxDraw }
    }

    const initMap = () => {
      try {
        const libs = checkLibraries()
        if (!libs) {
          setTimeout(initMap, 1000) // 1秒後にリトライ
          return
        }

        const { maplibregl } = libs

        if (!mapContainer.current) return

        // 国土地理院の地図タイルを使用
        const mapInstance = new maplibregl.Map({
          container: mapContainer.current,
          style: {
            version: 8,
            sources: {
              'gsi-pale': {
                type: 'raster',
                tiles: [
                  'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'
                ],
                tileSize: 256,
                attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html">地理院タイル</a>'
              }
            },
            layers: [
              {
                id: 'gsi-pale',
                type: 'raster',
                source: 'gsi-pale'
              }
            ]
          },
          center: [139.6917, 35.6895], // 東京駅
          zoom: 10
        })

        mapInstance.on('load', () => {
          console.log('地図が正常に読み込まれました')
          setIsLoading(false)
          setMap(mapInstance)
        })

        mapInstance.on('error', (e) => {
          console.error('地図エラー:', e)
          setError('地図の読み込みに失敗しました')
          setIsLoading(false)
        })

      } catch (error) {
        console.error('地図初期化エラー:', error)
        setError('地図の初期化に失敗しました')
        setIsLoading(false)
      }
    }

    // ライブラリの読み込みを待機
    const checkInterval = setInterval(() => {
      if (checkLibraries()) {
        clearInterval(checkInterval)
        initMap()
      }
    }, 500)

    // 10秒でタイムアウト
    const timeout = setTimeout(() => {
      clearInterval(checkInterval)
      if (isLoading) {
        setError('地図ライブラリの読み込みがタイムアウトしました')
        setIsLoading(false)
      }
    }, 10000)

    return () => {
      clearInterval(checkInterval)
      clearTimeout(timeout)
      if (map) {
        map.remove()
      }
    }
  }, [])

  if (error) {
    return (
      <div className="h-screen flex flex-col bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-red-600 to-red-700 rounded-xl flex items-center justify-center">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">地図エラー</h1>
                <p className="text-sm text-gray-600">地図の読み込みに問題が発生しました</p>
              </div>
            </div>
            <Button onClick={onClose} variant="outline" size="sm">
              <X className="w-4 h-4 mr-2" />
              閉じる
            </Button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="w-24 h-24 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
              <MapPin className="w-12 h-12 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">地図読み込みエラー</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Button onClick={() => window.location.reload()} variant="outline">
              ページを再読み込み
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-green-600 to-green-700 rounded-xl flex items-center justify-center">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">農地マップ</h1>
              <p className="text-sm text-gray-600">栽培野菜計画登録</p>
            </div>
          </div>
          <Button onClick={onClose} variant="outline" size="sm" className="hover:bg-gray-100">
            <X className="w-4 h-4 mr-2" />
            閉じる
          </Button>
        </div>
      </div>

      {/* 地図エリア */}
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white bg-opacity-75">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-green-600" />
              <p className="text-gray-600 font-medium">国土地理院地図を読み込み中...</p>
            </div>
          </div>
        )}
        <div 
          ref={mapContainer} 
          className="w-full h-full"
          style={{ minHeight: '400px' }}
        />
      </div>

      {/* フッター情報 */}
      <div className="bg-white border-t border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <p>国土地理院タイル使用</p>
          <p>地図機能: 基本表示モード</p>
        </div>
      </div>
    </div>
  )
}