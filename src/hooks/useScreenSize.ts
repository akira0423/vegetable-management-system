'use client'

import { useState, useEffect } from 'react'

export interface ScreenSizeInfo {
  width: number
  height: number
  isMobile: boolean      // < 768px
  isTablet: boolean      // 768px - 1023px
  isDesktop: boolean     // >= 1024px
  maxVisibleItems: number // レスポンシブ表示件数
}

export function useScreenSize(): ScreenSizeInfo {
  const [screenSize, setScreenSize] = useState<ScreenSizeInfo>(() => {
    // サーバーサイドレンダリング対応
    if (typeof window === 'undefined') {
      return {
        width: 1024,
        height: 768,
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        maxVisibleItems: 5
      }
    }

    const width = window.innerWidth
    const height = window.innerHeight
    const isMobile = width < 768
    const isTablet = width >= 768 && width < 1024
    const isDesktop = width >= 1024
    
    return {
      width,
      height,
      isMobile,
      isTablet,
      isDesktop,
      maxVisibleItems: isMobile ? 3 : isTablet ? 4 : 5
    }
  })

  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const handleResize = () => {
      // デバウンス処理（パフォーマンス最適化）
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        const width = window.innerWidth
        const height = window.innerHeight
        const isMobile = width < 768
        const isTablet = width >= 768 && width < 1024
        const isDesktop = width >= 1024

        setScreenSize({
          width,
          height,
          isMobile,
          isTablet,
          isDesktop,
          maxVisibleItems: isMobile ? 3 : isTablet ? 4 : 5
        })
      }, 150) // 150ms のデバウンス
    }

    window.addEventListener('resize', handleResize, { passive: true })

    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(timeoutId)
    }
  }, [])

  return screenSize
}