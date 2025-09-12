'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { 
  Sprout, 
  Calendar,
  BarChart3,
  Users,
  Camera,
  Menu,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

const navigation = [
  {
    name: '栽培野菜管理',
    href: '/dashboard/gantt',
    icon: Calendar,
    shortName: '栽培'
  },
  {
    name: 'データ分析',
    href: '/dashboard/analytics',
    icon: BarChart3,
    shortName: '分析'
  },
  {
    name: 'フォトギャラリー',
    href: '/dashboard/photos',
    icon: Camera,
    shortName: '写真'
  },
  {
    name: 'ユーザー管理',
    href: '/dashboard/users',
    icon: Users,
    shortName: 'ユーザー'
  },
]

interface ResponsiveSidebarProps {
  className?: string
}

export default function ResponsiveSidebar({ className = '' }: ResponsiveSidebarProps) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [screenSize, setScreenSize] = useState<'mobile' | 'tablet' | 'desktop'>('desktop')

  // レスポンシブ検知とデフォルト状態設定
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth
      if (width < 768) {
        setScreenSize('mobile')
        setIsCollapsed(true)
        setIsMobileOpen(false)
      } else if (width < 1024) {
        setScreenSize('tablet')
        setIsCollapsed(true)
        setIsMobileOpen(false)
      } else {
        setScreenSize('desktop')
        setIsCollapsed(false)
        setIsMobileOpen(false)
      }
    }
    
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // モバイルメニューの背景クリックで閉じる
  const handleOverlayClick = () => {
    if (screenSize === 'mobile') {
      setIsMobileOpen(false)
    }
  }

  // ESCキーでモバイルメニューを閉じる
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && screenSize === 'mobile' && isMobileOpen) {
        setIsMobileOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscKey)
    return () => document.removeEventListener('keydown', handleEscKey)
  }, [screenSize, isMobileOpen])

  // サイドバーの幅を動的に決定
  const getSidebarWidth = () => {
    if (screenSize === 'mobile') return 'w-80'
    return isCollapsed ? 'w-16' : 'w-64'
  }

  // サイドバーの表示状態を決定
  const getSidebarVisibility = () => {
    if (screenSize === 'mobile') {
      return isMobileOpen ? 'translate-x-0' : '-translate-x-full'
    }
    return 'translate-x-0'
  }

  // ハンバーガーメニューボタン（モバイル用）
  const MobileMenuButton = () => {
    if (screenSize !== 'mobile') return null
    
    return (
      <button
        onClick={() => setIsMobileOpen(true)}
        className="fixed top-4 left-4 z-50 bg-green-600 hover:bg-green-700 text-white p-3 rounded-lg shadow-lg transition-colors lg:hidden"
        aria-label="メニューを開く"
      >
        <Menu className="w-6 h-6" />
      </button>
    )
  }

  // コラプストグルボタン（デスクトップ・タブレット用）
  const CollapseToggleButton = () => {
    if (screenSize === 'mobile') return null
    
    return (
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-6 z-10 bg-white border border-gray-300 hover:border-gray-400 rounded-full p-1.5 shadow-sm transition-all"
        aria-label={isCollapsed ? 'サイドバーを展開' : 'サイドバーを折りたたみ'}
      >
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4 text-gray-600" />
        ) : (
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        )}
      </button>
    )
  }

  // ロゴセクション
  const LogoSection = () => (
    <div className={cn(
      "flex items-center border-b border-gray-200 transition-all duration-300",
      isCollapsed && screenSize !== 'mobile' ? 'h-16 px-3 justify-center' : 'h-16 px-6'
    )}>
      <Link 
        href="/dashboard/gantt" 
        className="flex items-center space-x-2"
        onClick={() => screenSize === 'mobile' && setIsMobileOpen(false)}
      >
        <Sprout className="h-8 w-8 text-green-600 flex-shrink-0" />
        {(!isCollapsed || screenSize === 'mobile') && (
          <span className="text-lg font-semibold text-gray-900 whitespace-nowrap">
            栽培管理
          </span>
        )}
      </Link>
    </div>
  )

  // ナビゲーション項目
  const NavigationItem = ({ item }: { item: typeof navigation[0] }) => {
    const isActive = pathname === item.href
    
    return (
      <Link
        href={item.href}
        onClick={() => screenSize === 'mobile' && setIsMobileOpen(false)}
        className={cn(
          'group flex items-center rounded-md transition-all duration-200',
          isCollapsed && screenSize !== 'mobile' 
            ? 'px-2 py-3 justify-center' 
            : 'px-3 py-2',
          isActive
            ? 'bg-green-50 text-green-700 border-r-2 border-green-500'
            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
        )}
        title={isCollapsed && screenSize !== 'mobile' ? item.name : undefined}
      >
        <item.icon
          className={cn(
            'flex-shrink-0 transition-colors',
            isCollapsed && screenSize !== 'mobile' ? 'h-6 w-6' : 'mr-3 h-5 w-5',
            isActive
              ? 'text-green-500'
              : 'text-gray-400 group-hover:text-gray-500'
          )}
        />
        {(!isCollapsed || screenSize === 'mobile') && (
          <span className="font-medium text-sm whitespace-nowrap">
            {item.name}
          </span>
        )}
        {isCollapsed && screenSize !== 'mobile' && (
          <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
            {item.name}
          </span>
        )}
      </Link>
    )
  }

  // フッターセクション
  const FooterSection = () => (
    <div className={cn(
      "border-t border-gray-200 transition-all duration-300",
      isCollapsed && screenSize !== 'mobile' 
        ? 'py-4 px-2 text-center' 
        : 'px-4 py-4'
    )}>
      {(!isCollapsed || screenSize === 'mobile') ? (
        <div className="text-xs text-gray-500">
          Version 1.0.0
        </div>
      ) : (
        <div className="text-xs text-gray-500 transform -rotate-90 origin-center whitespace-nowrap">
          v1.0
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* モバイル用ハンバーガーメニューボタン */}
      <MobileMenuButton />

      {/* モバイル用オーバーレイ */}
      {screenSize === 'mobile' && isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={handleOverlayClick}
          aria-hidden="true"
        />
      )}

      {/* サイドバー本体 */}
      <div className={cn(
        "flex flex-col bg-white border-r border-gray-200 relative transition-all duration-300 ease-in-out",
        getSidebarWidth(),
        screenSize === 'mobile' 
          ? `fixed top-0 left-0 h-full z-50 shadow-xl transform ${getSidebarVisibility()}` 
          : 'h-full',
        className
      )}>
        
        {/* コラプストグルボタン */}
        <CollapseToggleButton />
        
        {/* モバイル用クローズボタン */}
        {screenSize === 'mobile' && (
          <button
            onClick={() => setIsMobileOpen(false)}
            className="absolute top-4 right-4 z-10 text-gray-500 hover:text-gray-700 lg:hidden"
            aria-label="メニューを閉じる"
          >
            <X className="w-6 h-6" />
          </button>
        )}

        {/* ロゴ */}
        <LogoSection />

        {/* ナビゲーション */}
        <nav className={cn(
          "flex-1 overflow-y-auto transition-all duration-300",
          isCollapsed && screenSize !== 'mobile' 
            ? 'px-2 py-6 space-y-1' 
            : 'px-4 py-6 space-y-1'
        )}>
          {navigation.map((item) => (
            <NavigationItem key={item.href} item={item} />
          ))}
        </nav>

        {/* フッター */}
        <FooterSection />
      </div>
    </>
  )
}