'use client'

import React, { useState, useEffect } from 'react'
import { X, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ToastProps {
  id: string
  title?: string
  description?: string
  type?: 'success' | 'error' | 'warning' | 'info'
  duration?: number
  onClose?: () => void
}

interface ToastContextType {
  toast: (props: Omit<ToastProps, 'id'>) => void
}

const ToastContext = React.createContext<ToastContextType | null>(null)

export function Toast({ id, title, description, type = 'info', duration = 5000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  useEffect(() => {
    setIsVisible(true)
    const timer = setTimeout(() => {
      handleClose()
    }, duration)

    return () => clearTimeout(timer)
  }, [duration])

  const handleClose = () => {
    setIsLeaving(true)
    setTimeout(() => {
      onClose?.()
    }, 150)
  }

  const icons = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertTriangle,
    info: Info
  }

  const Icon = icons[type]

  const colors = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  }

  const iconColors = {
    success: 'text-green-600',
    error: 'text-red-600',
    warning: 'text-yellow-600',
    info: 'text-blue-600'
  }

  return (
    <div
      className={cn(
        'fixed top-4 right-4 z-50 w-96 rounded-lg border p-4 shadow-lg transition-all duration-150',
        colors[type],
        isVisible && !isLeaving ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', iconColors[type])} />
        <div className="flex-1 min-w-0">
          {title && (
            <div className="font-semibold text-sm">{title}</div>
          )}
          {description && (
            <div className={cn('text-sm', title ? 'mt-1' : '')}>
              {description}
            </div>
          )}
        </div>
        <button
          onClick={handleClose}
          className={cn(
            'flex-shrink-0 rounded-md p-1.5 transition-colors',
            'hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/40'
          )}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      
      {/* プログレスバー */}
      <div className="absolute bottom-0 left-0 h-1 bg-white/20 rounded-b-lg overflow-hidden">
        <div 
          className="h-full bg-white/40 transition-all duration-linear"
          style={{
            width: '100%',
            animation: `shrink ${duration}ms linear forwards`
          }}
        />
      </div>
      
      <style jsx>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastProps[]>([])

  const toast = ({ title, description, type = 'info', duration = 5000 }: Omit<ToastProps, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast = { id, title, description, type, duration }
    
    setToasts(prev => [...prev, newToast])
  }

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          {...toast}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}