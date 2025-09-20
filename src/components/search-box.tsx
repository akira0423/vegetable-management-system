'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Search, 
  Navigation, 
  MapPin, 
  Loader2,
  History,
  X,
  Target
} from 'lucide-react'

interface SearchResult {
  id: string
  type: 'address' | 'coordinate' | 'landmark'
  title: string
  subtitle?: string
  latitude: number
  longitude: number
  bounds?: [number, number, number, number] // [west, south, east, north]
  confidence: number
  source: string
}

interface SearchBoxProps {
  onLocationSelect: (result: SearchResult) => void
  onLocationMove: (lat: number, lng: number, zoom?: number) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  showHistory?: boolean
  maxResults?: number
}

interface CoordinateFormat {
  format: 'decimal' | 'dms' | 'utm'
  label: string
  example: string
  parser: (input: string) => { lat: number; lng: number } | null
}

// 座標フォーマット定義
const COORDINATE_FORMATS: CoordinateFormat[] = [
  {
    format: 'decimal',
    label: '十進度 (Decimal Degrees)',
    example: '35.6762, 139.6503',
    parser: (input: string) => {
      const match = input.match(/^(-?\d+\.?\d*),?\s*(-?\d+\.?\d*)$/)
      if (!match) return null
      const lat = parseFloat(match[1])
      const lng = parseFloat(match[2])
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng }
      }
      return null
    }
  },
  {
    format: 'dms',
    label: '度分秒 (DMS)',
    example: '35°40\'34.3"N 139°39\'01.1"E',
    parser: (input: string) => {
      // DMS形式のパーサー実装
      const dmsRegex = /(\d+)[°]\s*(\d+)['\′]?\s*(\d+\.?\d*)["\″]?\s*([NSEW])/gi
      const matches = Array.from(input.matchAll(dmsRegex))
      
      if (matches.length !== 2) return null
      
      let lat = 0, lng = 0
      
      matches.forEach(match => {
        const degrees = parseInt(match[1])
        const minutes = parseInt(match[2])
        const seconds = parseFloat(match[3])
        const direction = match[4].toUpperCase()
        
        const decimal = degrees + minutes / 60 + seconds / 3600
        
        if (direction === 'N' || direction === 'S') {
          lat = direction === 'S' ? -decimal : decimal
        } else if (direction === 'E' || direction === 'W') {
          lng = direction === 'W' ? -decimal : decimal
        }
      })
      
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng }
      }
      return null
    }
  }
]

export default function SearchBox({
  onLocationSelect,
  onLocationMove,
  placeholder = '住所・地名・座標を入力...',
  className = '',
  autoFocus = false,
  showHistory = true,
  maxResults = 10
}: SearchBoxProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [searchHistory, setSearchHistory] = useState<SearchResult[]>([])
  const [activeTab, setActiveTab] = useState<'address' | 'coordinate'>('address')
  
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>()

  // 検索履歴を localStorage から復元
  useEffect(() => {
    if (showHistory && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('farm-map-search-history')
        if (saved) {
          setSearchHistory(JSON.parse(saved).slice(0, 5))
        }
      } catch (error) {
        
      }
    }
  }, [showHistory])

  // 検索履歴を保存
  const saveToHistory = useCallback((result: SearchResult) => {
    if (!showHistory) return
    
    setSearchHistory(prev => {
      const filtered = prev.filter(item => item.id !== result.id)
      const newHistory = [result, ...filtered].slice(0, 5)
      
      // localStorage に保存
      try {
        localStorage.setItem('farm-map-search-history', JSON.stringify(newHistory))
      } catch (error) {
        
      }
      
      return newHistory
    })
  }, [showHistory])

  // 住所検索（地理院API使用）
  const searchAddress = useCallback(async (query: string): Promise<SearchResult[]> => {
    try {
      // 正しいジオコーディングAPIエンドポイントを使用
      const response = await fetch(`/api/geocoding?q=${encodeURIComponent(query)}&type=address`)
      
      if (!response.ok) {
        
        return []
      }
      
      const data = await response.json()
      
      
      if (data.success && data.results) {
        return data.results.map((item: any, index: number) => ({
          id: `addr_${index}_${Date.now()}`,
          type: 'address' as const,
          title: item.formatted_address || query,
          subtitle: `${item.prefecture || ''} ${item.city || ''}`,
          latitude: item.lat,
          longitude: item.lng,
          confidence: item.confidence || 0.8,
          source: item.source || 'geocoding_api',
          bounds: item.bounds
        }))
      }
      
      return []
    } catch (error) {
      
      return []
    }
  }, [])

  // 座標パース
  const parseCoordinates = useCallback((input: string): SearchResult[] => {
    const results: SearchResult[] = []
    
    COORDINATE_FORMATS.forEach(format => {
      const parsed = format.parser(input)
      if (parsed) {
        results.push({
          id: `coord_${format.format}_${Date.now()}`,
          type: 'coordinate',
          title: `${parsed.lat.toFixed(6)}, ${parsed.lng.toFixed(6)}`,
          subtitle: format.label,
          latitude: parsed.lat,
          longitude: parsed.lng,
          confidence: 1.0,
          source: 'user_input'
        })
      }
    })
    
    return results
  }, [])

  // 統合検索
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      return
    }

    setIsLoading(true)
    setIsOpen(true)
    
    try {
      let searchResults: SearchResult[] = []
      
      if (activeTab === 'address') {
        // 住所検索
        searchResults = await searchAddress(searchQuery)
      } else {
        // 座標解析
        searchResults = parseCoordinates(searchQuery)
      }
      
      setResults(searchResults.slice(0, maxResults))
    } catch (error) {
      
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [activeTab, searchAddress, parseCoordinates, maxResults])

  // デバウンス検索
  const debouncedSearch = useCallback((query: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    
    debounceRef.current = setTimeout(() => {
      performSearch(query)
    }, 300)
  }, [performSearch])

  // 検索実行
  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    performSearch(query)
  }, [query, performSearch])

  // 結果選択
  const handleResultSelect = useCallback((result: SearchResult) => {
    setQuery(result.title)
    setIsOpen(false)
    saveToHistory(result)
    onLocationSelect(result)
    onLocationMove(result.latitude, result.longitude, 16)
  }, [onLocationSelect, onLocationMove, saveToHistory])

  // 現在地取得
  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      alert('この端末では位置情報を取得できません')
      return
    }

    setIsLoading(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        const result: SearchResult = {
          id: `current_${Date.now()}`,
          type: 'coordinate',
          title: '現在地',
          subtitle: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          latitude,
          longitude,
          confidence: 1.0,
          source: 'geolocation'
        }
        
        handleResultSelect(result)
        setIsLoading(false)
      },
      (error) => {
        
        alert('位置情報の取得に失敗しました')
        setIsLoading(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000
      }
    )
  }, [handleResultSelect])

  // 外部クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 入力変更時の処理
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    
    if (value.trim()) {
      debouncedSearch(value)
    } else {
      setResults([])
      setIsOpen(false)
    }
  }, [debouncedSearch])

  // 履歴クリア
  const clearHistory = useCallback(() => {
    setSearchHistory([])
    try {
      localStorage.removeItem('farm-map-search-history')
    } catch (error) {
      
    }
  }, [])

  return (
    <div ref={searchRef} className={`relative w-full max-w-md ${className}`}>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-2">
          <TabsTrigger value="address" className="text-xs">
            <MapPin className="w-3 h-3 mr-1" />
            住所・地名
          </TabsTrigger>
          <TabsTrigger value="coordinate" className="text-xs">
            <Navigation className="w-3 h-3 mr-1" />
            座標
          </TabsTrigger>
        </TabsList>

        <TabsContent value="address" className="mt-0">
          <form onSubmit={handleSearch} className="relative">
            <Input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              placeholder="住所・地名・郵便番号を入力"
              className="pl-10 pr-20"
              autoFocus={autoFocus}
              onFocus={() => setIsOpen(true)}
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={getCurrentLocation}
                disabled={isLoading}
                className="p-1 h-6 w-6"
                title="現在地を取得"
              >
                {isLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Target className="w-3 h-3" />
                )}
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="coordinate" className="mt-0">
          <form onSubmit={handleSearch} className="relative">
            <Input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              placeholder="35.6762, 139.6503"
              className="pl-10 pr-8"
              autoFocus={autoFocus}
              onFocus={() => setIsOpen(true)}
            />
            <Navigation className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          </form>
          
          <div className="mt-2 text-xs text-gray-500">
            <div>対応フォーマット:</div>
            <div>• 十進度: 35.6762, 139.6503</div>
            <div>• 度分秒: 35°40'34"N 139°39'01"E</div>
          </div>
        </TabsContent>
      </Tabs>

      {/* 検索結果・履歴モーダル */}
      {isOpen && (
        <Card className="absolute top-full left-0 right-0 mt-1 z-50 max-h-80 overflow-y-auto bg-white/98 backdrop-blur-lg shadow-2xl border border-gray-200/80">
          <CardContent className="p-0">
            {isLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                <span className="text-sm text-gray-600">検索中...</span>
              </div>
            )}
            
            {!isLoading && results.length === 0 && query && (
              <div className="py-4 px-3 text-center text-gray-500 text-sm">
                検索結果が見つかりませんでした
              </div>
            )}
            
            {/* 検索結果 */}
            {results.length > 0 && (
              <div>
                <div className="px-3 py-2 bg-blue-50/90 text-xs font-medium text-blue-800 border-b border-blue-200">
                  検索結果
                </div>
                {results.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleResultSelect(result)}
                    className="w-full px-3 py-3 text-left hover:bg-blue-50/80 border-b last:border-b-0 focus:outline-none focus:bg-blue-50/80 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {result.title}
                        </div>
                        {result.subtitle && (
                          <div className="text-xs text-gray-500 truncate mt-1">
                            {result.subtitle}
                          </div>
                        )}
                      </div>
                      <div className="ml-2 flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {result.type === 'address' ? '住所' : '座標'}
                        </Badge>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            
            {/* 検索履歴 */}
            {showHistory && searchHistory.length > 0 && !query && (
              <div>
                <div className="px-3 py-2 bg-gray-50/90 text-xs font-medium text-gray-600 border-b border-gray-200 flex items-center justify-between">
                  <span>検索履歴</span>
                  <button
                    onClick={clearHistory}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    title="履歴をクリア"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                {searchHistory.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleResultSelect(result)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50/80 border-b last:border-b-0 focus:outline-none focus:bg-gray-50/80 transition-colors"
                  >
                    <div className="flex items-center">
                      <History className="w-3 h-3 mr-2 text-gray-400" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {result.title}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}