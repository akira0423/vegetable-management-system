'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AuthUser } from '@/types'
import { Bell, User, LogOut, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import NotificationCenter from '@/components/notification-center'

interface DashboardHeaderProps {
  user: AuthUser
}

export default function DashboardHeader({ user }: DashboardHeaderProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true)
      await supabase.auth.signOut()
      router.push('/login')
    } catch (error) {
      
    } finally {
      setIsLoggingOut(false)
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800'
      case 'manager':
        return 'bg-blue-100 text-blue-800'
      case 'operator':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'admin':
        return '管理者'
      case 'manager':
        return 'マネージャー'
      case 'operator':
        return '作業者'
      default:
        return '不明'
    }
  }

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      {/* Page title and breadcrumb */}
      <div className="flex items-center space-x-4">
        <h1 className="text-xl font-semibold text-gray-900">
          ダッシュボード
        </h1>
      </div>

      {/* Right side - notifications and user menu */}
      <div className="flex items-center space-x-4">
        {/* Notifications */}
        <NotificationCenter />

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center space-x-3 text-sm text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 rounded-md p-2"
          >
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-green-600" />
              </div>
              <div className="text-left">
                <div className="font-medium">
                  {user.full_name || 'ユーザー'}
                </div>
                <div className="text-xs text-gray-500">
                  {user.email}
                </div>
              </div>
            </div>
            <ChevronDown className="h-4 w-4" />
          </button>

          {/* Dropdown menu */}
          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg border border-gray-200 z-10">
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                    <User className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      {user.full_name || 'ユーザー'}
                    </div>
                    <div className="text-sm text-gray-500 mb-1">
                      {user.email}
                    </div>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                      {getRoleDisplayName(user.role)}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="py-1">
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false)
                    handleLogout()
                  }}
                  disabled={isLoggingOut}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span>{isLoggingOut ? 'ログアウト中...' : 'ログアウト'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Overlay to close dropdown */}
      {isUserMenuOpen && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setIsUserMenuOpen(false)}
        />
      )}
    </header>
  )
}