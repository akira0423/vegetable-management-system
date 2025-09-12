'use client'

import { useRef, useEffect, RefObject } from 'react'

interface SwipeGestureOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
  threshold?: number  // 最小スワイプ距離（px）
  velocity?: number   // 最小スワイプ速度（px/ms）
}

export function useSwipeGesture<T extends HTMLElement>(
  elementRef: RefObject<T>,
  options: SwipeGestureOptions
) {
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null)
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    threshold = 50,
    velocity = 0.3
  } = options

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      touchStart.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now()
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStart.current) return

      const touch = e.changedTouches[0]
      const deltaX = touch.clientX - touchStart.current.x
      const deltaY = touch.clientY - touchStart.current.y
      const deltaTime = Date.now() - touchStart.current.time
      const absX = Math.abs(deltaX)
      const absY = Math.abs(deltaY)

      // 最小距離とスピードをチェック
      if (Math.max(absX, absY) < threshold) return
      if (Math.max(absX, absY) / deltaTime < velocity) return

      // 水平方向のスワイプが優位の場合
      if (absX > absY) {
        if (deltaX > 0 && onSwipeRight) {
          e.preventDefault()
          onSwipeRight()
        } else if (deltaX < 0 && onSwipeLeft) {
          e.preventDefault()
          onSwipeLeft()
        }
      }
      // 垂直方向のスワイプが優位の場合
      else {
        if (deltaY > 0 && onSwipeDown) {
          e.preventDefault()
          onSwipeDown()
        } else if (deltaY < 0 && onSwipeUp) {
          e.preventDefault()
          onSwipeUp()
        }
      }

      touchStart.current = null
    }

    const handleTouchMove = (e: TouchEvent) => {
      // スワイプ中のデフォルト動作を防止（必要に応じて）
      if (touchStart.current) {
        // e.preventDefault(); // 必要に応じてコメントアウト
      }
    }

    element.addEventListener('touchstart', handleTouchStart, { passive: false })
    element.addEventListener('touchend', handleTouchEnd, { passive: false })
    element.addEventListener('touchmove', handleTouchMove, { passive: false })

    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchend', handleTouchEnd)
      element.removeEventListener('touchmove', handleTouchMove)
    }
  }, [elementRef, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold, velocity])
}