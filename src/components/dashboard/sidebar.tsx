'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { 
  Sprout, 
  Calendar,
  FileText,
  BarChart3,
  Users,
  Camera
} from 'lucide-react'

const navigation = [
  {
    name: '栽培野菜管理',
    href: '/dashboard/gantt',
    icon: Calendar,
  },
  {
    name: 'データ分析',
    href: '/dashboard/analytics',
    icon: BarChart3,
  },
  {
    name: 'フォトギャラリー',
    href: '/dashboard/photos',
    icon: Camera,
  },
  {
    name: 'ユーザー管理',
    href: '/dashboard/users',
    icon: Users,
  },
]

export default function DashboardSidebar() {
  const pathname = usePathname()

  return (
    <div className="flex flex-col w-64 bg-white border-r border-gray-200">
      {/* Logo */}
      <div className="flex items-center h-16 px-6 border-b border-gray-200">
        <Link href="/dashboard/gantt" className="flex items-center space-x-2">
          <Sprout className="h-8 w-8 text-green-600" />
          <span className="text-lg font-semibold text-gray-900">
            栽培管理
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                isActive
                  ? 'bg-green-50 text-green-700 border-r-2 border-green-500'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <item.icon
                className={cn(
                  'mr-3 h-5 w-5 flex-shrink-0',
                  isActive
                    ? 'text-green-500'
                    : 'text-gray-400 group-hover:text-gray-500'
                )}
              />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-gray-200">
        <div className="text-xs text-gray-500">
          Version 1.0.0
        </div>
      </div>
    </div>
  )
}