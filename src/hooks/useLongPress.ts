'use client'

import { useRef, useEffect, RefObject } from 'react'

interface LongPressOptions {
  onLongPress: (e: TouchEvent | MouseEvent) => void
  delay?: number // 長押し判定時間（ms）
  threshold?: number // 移動許容距離（px）
}

export function useLongPress<T extends HTMLElement>(
  elementRef: RefObject<T>,
  options: LongPressOptions
) {
  const { onLongPress, delay = 500, threshold = 10 } = options
  const longPressTimer = useRef<NodeJS.Timeout>()
  const startPosition = useRef<{ x: number; y: number } | null>(null)
  const isLongPressed = useRef(false)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const startLongPress = (e: TouchEvent | MouseEvent) => {
      const position = 'touches' in e 
        ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
        : { x: e.clientX, y: e.clientY }
      
      startPosition.current = position
      isLongPressed.current = false

      longPressTimer.current = setTimeout(() => {
        if (startPosition.current) {
          isLongPressed.current = true
          onLongPress(e)
          
          // ハプティックフィードバック（対応デバイス）
          if ('vibrate' in navigator) {
            navigator.vibrate(100)
          }
        }
      }, delay)
    }

    const cancelLongPress = (e?: TouchEvent | MouseEvent) => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current)
      }

      // 移動距離をチェック
      if (e && startPosition.current) {
        const currentPosition = 'touches' in e && e.touches.length > 0
          ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
          : 'changedTouches' in e && e.changedTouches.length > 0
          ? { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }
          : 'clientX' in e
          ? { x: e.clientX, y: e.clientY }
          : startPosition.current

        const distance = Math.sqrt(
          Math.pow(currentPosition.x - startPosition.current.x, 2) +
          Math.pow(currentPosition.y - startPosition.current.y, 2)
        )

        if (distance > threshold) {
          isLongPressed.current = false
        }
      }

      startPosition.current = null
    }

    const preventContextMenu = (e: Event) => {
      if (isLongPressed.current) {
        e.preventDefault()
      }
    }

    // タッチイベント
    element.addEventListener('touchstart', startLongPress, { passive: false })
    element.addEventListener('touchmove', cancelLongPress, { passive: false })
    element.addEventListener('touchend', cancelLongPress, { passive: false })
    element.addEventListener('touchcancel', cancelLongPress, { passive: false })

    // マウスイベント（デスクトップ対応）
    element.addEventListener('mousedown', startLongPress)
    element.addEventListener('mousemove', cancelLongPress)
    element.addEventListener('mouseup', cancelLongPress)
    element.addEventListener('mouseleave', cancelLongPress)

    // コンテキストメニューの抑制
    element.addEventListener('contextmenu', preventContextMenu)

    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current)
      }

      // タッチイベントのクリーンアップ
      element.removeEventListener('touchstart', startLongPress)
      element.removeEventListener('touchmove', cancelLongPress)
      element.removeEventListener('touchend', cancelLongPress)
      element.removeEventListener('touchcancel', cancelLongPress)

      // マウスイベントのクリーンアップ
      element.removeEventListener('mousedown', startLongPress)
      element.removeEventListener('mousemove', cancelLongPress)
      element.removeEventListener('mouseup', cancelLongPress)
      element.removeEventListener('mouseleave', cancelLongPress)

      element.removeEventListener('contextmenu', preventContextMenu)
    }
  }, [elementRef, onLongPress, delay, threshold])

  return { isLongPressed: isLongPressed.current }
}