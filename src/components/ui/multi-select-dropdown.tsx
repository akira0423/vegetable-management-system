'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Check,
  ChevronDown,
  X,
  Search,
  Leaf,
  TrendingUp,
  Filter,
  Sprout,
  BarChart3,
  DollarSign,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface Option {
  id: string
  name: string
  variety?: string
}

interface MultiSelectDropdownProps {
  options: Option[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  className?: string
  isLoading?: boolean
}

// CSSアニメーション用のスタイル
const animationStyles = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes grow {
    0% { width: 0%; }
    100% { width: 100%; }
  }

  @keyframes ripple {
    0% {
      transform: scale(0);
      opacity: 1;
    }
    100% {
      transform: scale(4);
      opacity: 0;
    }
  }

  .animate-grow {
    animation: grow 2s ease-out infinite;
  }

  .animate-ripple {
    animation: ripple 0.6s ease-out;
  }
`

export function MultiSelectDropdown({
  options,
  selected,
  onChange,
  placeholder = '選択してください',
  className,
  isLoading = false,
}: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [tempSelected, setTempSelected] = useState<string[]>(selected)
  const [justSelected, setJustSelected] = useState<string | null>(null)
  const [isApplying, setIsApplying] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // ポップオーバーが開かれたときに一時選択状態を初期化
  useEffect(() => {
    if (open) {
      setTempSelected(selected)
    }
  }, [open, selected])

  // 検索でフィルタリングされたオプション
  const filteredOptions = options.filter(option =>
    option.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    option.variety?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // 全選択/全解除の状態（一時選択状態を使用）
  const isAllSelected = tempSelected.length === options.length
  const isPartiallySelected = tempSelected.length > 0 && tempSelected.length < options.length

  // 選択状態の表示テキスト（シンプルな件数表示）
  const getDisplayText = () => {
    if (selected.length === 0) {
      return 'すべての野菜'
    }
    if (selected.length === options.length) {
      return `すべて選択 (${options.length}/${options.length})`
    }
    return `${selected.length}/${options.length} 野菜選択`
  }

  // オプションの選択/解除（一時選択状態を更新）
  const toggleOption = (optionId: string) => {
    setJustSelected(optionId)
    setTimeout(() => setJustSelected(null), 600)

    if (tempSelected.includes(optionId)) {
      setTempSelected(tempSelected.filter(id => id !== optionId))
    } else {
      setTempSelected([...tempSelected, optionId])
    }
  }

  // 全選択/全解除（一時選択状態を更新）
  const toggleAll = () => {
    if (isAllSelected) {
      setTempSelected([])
    } else {
      setTempSelected(options.map(opt => opt.id))
    }
  }

  // 適用ボタンクリック（選択を確定して反映）
  const handleApply = async () => {
    setIsApplying(true)
    // アニメーションのための少しの遅延
    await new Promise(resolve => setTimeout(resolve, 500))
    onChange(tempSelected)
    setIsApplying(false)
    setOpen(false)
    setSearchQuery('')
  }

  // キャンセルボタンクリック（変更を破棄）
  const handleCancel = () => {
    setTempSelected(selected)
    setOpen(false)
    setSearchQuery('')
  }

  // ポップオーバーが開いたときに検索フィールドにフォーカス
  useEffect(() => {
    if (open && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100)
    }
  }, [open])

  return (
    <>
      <style jsx>{animationStyles}</style>
      <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-[240px] justify-between relative overflow-hidden',
            'bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100',
            'border-green-300 hover:border-green-400',
            'shadow-sm hover:shadow-md transition-all duration-200',
            'group',
            className
          )}
        >
          <div className="flex items-center gap-2">
            {isLoading ? (
              <Loader2 className="h-4 w-4 text-green-600 animate-spin" />
            ) : (
              <Sprout className="h-4 w-4 text-green-600" />
            )}
            <span className="truncate font-medium text-gray-700">
              {isLoading ? 'データ取得中...' : getDisplayText()}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {selected.length > 0 && (
              <Badge
                variant="secondary"
                className="h-5 px-1.5 bg-green-600 text-white text-xs"
              >
                {selected.length}
              </Badge>
            )}
            <ChevronDown className={cn(
              "h-4 w-4 text-green-600 transition-transform duration-200",
              open && "rotate-180"
            )} />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-green-400/0 via-green-400/5 to-green-400/0 group-hover:via-green-400/10 transition-colors duration-300" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[360px] p-0 bg-white border-green-200 shadow-xl"
        align="start"
        sideOffset={5}
      >
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur">
                <Filter className="h-4 w-4 text-white" />
              </div>
              <h3 className="text-white font-semibold">品種フィルター</h3>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-white/70" />
              <span className="text-white/80 text-sm">データ分析</span>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-green-600" />
            <Input
              ref={searchInputRef}
              placeholder="野菜名で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white border-green-200 focus:bg-white focus:border-green-400 placeholder:text-gray-500"
            />
          </div>
        </div>

        {/* 全選択ボタン */}
        <div className="border-b border-green-100 p-2 bg-gradient-to-r from-emerald-50 to-green-50">
          <div
            onClick={toggleAll}
            className="flex items-center w-full px-3 py-2 text-sm hover:bg-green-100 rounded-lg cursor-pointer transition-colors group"
          >
            <Checkbox
              checked={isAllSelected}
              className="mr-3 border-green-400 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
              onCheckedChange={toggleAll}
            />
            <div className="flex items-center justify-between flex-1">
              <span className="font-medium text-gray-700 group-hover:text-green-700">
                {isAllSelected ? 'すべてクリア' : 'すべて選択'}
              </span>
              <TrendingUp className="h-4 w-4 text-green-600 opacity-50 group-hover:opacity-100" />
            </div>
          </div>
        </div>

        {/* オプションリスト */}
        <div className="max-h-[320px] overflow-y-auto p-3 space-y-1 bg-white">
          {isLoading ? (
            // ローディングアニメーション
            <div className="flex flex-col items-center py-8">
              <div className="relative">
                <Leaf className="h-12 w-12 text-green-600 animate-spin" />
                <div className="absolute inset-0 rounded-full border-4 border-green-400 animate-ping opacity-20" />
              </div>
              <p className="mt-4 text-sm text-gray-600 animate-pulse">
                野菜データを収集中...
              </p>
              <div className="mt-3 w-48 h-1 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-green-400 to-emerald-500 animate-grow" />
              </div>
            </div>
          ) : filteredOptions.length === 0 ? (
            <div className="py-8 text-center">
              <Leaf className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">該当する野菜が見つかりません</p>
            </div>
          ) : (
            filteredOptions.map((option, index) => (
              <div
                key={option.id}
                onClick={() => toggleOption(option.id)}
                className={cn(
                  "relative",
                  "flex items-center w-full px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200",
                  "hover:bg-gradient-to-r hover:from-green-100 hover:to-emerald-100",
                  "border border-transparent hover:border-green-200",
                  "group",
                  tempSelected.includes(option.id) && "bg-gradient-to-r from-green-100 to-emerald-100 border-green-300"
                )}
                style={{
                  animationDelay: `${index * 20}ms`,
                  animation: open ? 'fadeInUp 0.3s ease-out forwards' : ''
                }}
              >
                {/* リップルエフェクト */}
                {justSelected === option.id && (
                  <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none">
                    <div className="absolute inset-0 bg-green-400 opacity-20 animate-ripple" />
                  </div>
                )}
                <Checkbox
                  checked={tempSelected.includes(option.id)}
                  className="mr-3 border-green-400 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                  onCheckedChange={() => toggleOption(option.id)}
                />
                <div className="flex items-center gap-2 flex-1">
                  <Leaf className={cn(
                    "h-4 w-4 transition-colors",
                    tempSelected.includes(option.id) ? "text-green-600" : "text-gray-400"
                  )} />
                  <div className="flex-1">
                    <span className={cn(
                      "font-medium transition-colors",
                      tempSelected.includes(option.id) ? "text-green-700" : "text-gray-700"
                    )}>
                      {option.name}
                    </span>
                    {option.variety && (
                      <span className="text-gray-500 text-xs ml-2">
                        {option.variety}
                      </span>
                    )}
                  </div>
                </div>
                {tempSelected.includes(option.id) && (
                  <Check className="h-4 w-4 text-green-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
            ))
          )}
        </div>

        {/* フッター */}
        <div className="border-t border-green-100 p-4 bg-gradient-to-r from-gray-50 to-green-50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-gray-700">
                選択品種: <span className="text-green-600">{tempSelected.length}</span> / {options.length}
              </span>
            </div>
            {tempSelected.length > 0 && (
              <span className="text-xs text-gray-500">
                複数選択で統合分析
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleApply}
              disabled={isApplying}
              className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-70"
            >
              {isApplying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  反映中...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  フィルター反映
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              className="flex-1 border-gray-300 hover:border-gray-400 hover:bg-gray-50"
            >
              <X className="h-4 w-4 mr-1" />
              キャンセル
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
    </>
  )
}