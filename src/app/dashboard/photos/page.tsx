'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { 
  Camera, 
  Search, 
  Filter,
  Download, 
  Trash2,
  Eye,
  Edit3,
  Plus,
  Grid3X3,
  List,
  Calendar,
  Tag,
  MapPin,
  FileImage,
  ChevronLeft,
  ChevronRight,
  X,
  MoreHorizontal,
  RefreshCw,
  FileText,
  Activity,
  Sprout,
  AlertTriangle,
  TrendingUp,
  Shield,
  PieChart,
  Clock,
  Database,
  Zap,
  Archive,
  HardDrive
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import Image from 'next/image'

// 作業種類別分類定義（農業特化）
interface WorkTypeCategory {
  id: string
  name: string
  description: string
  icon: string
  color: string
  retention_days: number
  priority: number
  legal_requirement: string
}

// 容量管理情報
interface StorageInfo {
  used_bytes: number
  limit_bytes: number
  category_usage: {
    [category_id: string]: {
      count: number
      bytes: number
      percentage: number
    }
  }
}

interface Photo {
  id: string
  vegetable_id?: string
  operation_log_id?: string
  storage_path: string
  original_filename: string
  file_size: number
  mime_type: string
  taken_at: string
  description?: string
  tags?: string[]
  created_by?: string
  created_at: string
  category_id?: string
  expiry_date?: string
  importance_score?: number
  vegetable?: {
    id: string
    name: string
    variety: string
    plot_name?: string
  }
  operation_log?: {
    id: string
    work_type: string
    work_date: string
  }
  public_url?: string
}

interface Vegetable {
  id: string
  name: string
  variety: string
  plot_name?: string
}

// 作業種類別分類定義（農業×金融の実務フローに基づく）
const WORK_TYPE_CATEGORIES: WorkTypeCategory[] = [
  {
    id: 'seeding',
    name: '播種・育苗',
    description: '種まき・苗作りの記録写真',
    icon: '🌱',
    color: 'green',
    retention_days: 1095, // 3年（品種改良・系譜管理）
    priority: 1,
    legal_requirement: '種苗法・品種管理・GAP認証'
  },
  {
    id: 'planting',
    name: '定植',
    description: '移植・定植作業の記録写真',
    icon: '🌿',
    color: 'emerald',
    retention_days: 1095, // 3年
    priority: 2,
    legal_requirement: 'GAP認証・栽培履歴管理'
  },
  {
    id: 'fertilizing',
    name: '施肥',
    description: '肥料投入・土壌改良の記録写真',
    icon: '💧',
    color: 'blue',
    retention_days: 1825, // 5年（環境影響評価）
    priority: 3,
    legal_requirement: '肥料取締法・環境保全・GAP認証'
  },
  {
    id: 'watering',
    name: '灌水',
    description: '水やり・灌漑の記録写真',
    icon: '💦',
    color: 'cyan',
    retention_days: 365, // 1年
    priority: 4,
    legal_requirement: '水質管理・GAP認証'
  },
  {
    id: 'weeding',
    name: '除草',
    description: '除草作業の記録写真',
    icon: '🌾',
    color: 'yellow',
    retention_days: 1095, // 3年（農薬使用記録）
    priority: 5,
    legal_requirement: '農薬取締法・GAP認証'
  },
  {
    id: 'pruning',
    name: '整枝・摘芽',
    description: '整枝・剪定作業の記録写真',
    icon: '✂️',
    color: 'purple',
    retention_days: 365, // 1年
    priority: 6,
    legal_requirement: '栽培技術管理・GAP認証'
  },
  {
    id: 'harvesting',
    name: '収穫',
    description: '収穫作業・品質記録写真',
    icon: '📊',
    color: 'orange',
    retention_days: 1825, // 5年（税務・収益分析）
    priority: 7,
    legal_requirement: '食品安全・税務申告・収益分析'
  },
  {
    id: 'other',
    name: 'その他作業',
    description: '病害虫防除・その他の記録写真',
    icon: '🔧',
    color: 'gray',
    retention_days: 1095, // 3年
    priority: 8,
    legal_requirement: 'GAP認証・作業履歴管理'
  }
]

const VIEW_MODES = [
  { value: 'work_type', label: '作業種類別表示', icon: Activity },
  { value: 'timeline', label: '時系列表示', icon: Calendar },
  { value: 'vegetable', label: '野菜別表示', icon: Sprout },
  { value: 'grid', label: 'グリッド表示', icon: Grid3X3 }
]

const SORT_OPTIONS = [
  { value: 'newest', label: '新しい順' },
  { value: 'oldest', label: '古い順' },
  { value: 'work_type', label: '作業種類順' },
  { value: 'vegetable', label: '野菜順' },
  { value: 'importance', label: '重要度順' },
  { value: 'size', label: 'サイズ順' }
]

// 容量制限設定（作業種類別・法的要件対応）
const STORAGE_LIMITS = {
  seeding: { monthly_gb: 2, unlimited: false }, // 品種管理・系譜追跡
  planting: { monthly_gb: 1.5, unlimited: false }, // 定植記録
  fertilizing: { monthly_gb: 3, unlimited: false }, // 環境影響評価のため多めに確保
  watering: { monthly_gb: 1, unlimited: false }, // 水質管理記録
  weeding: { monthly_gb: 2.5, unlimited: false }, // 農薬使用記録（法的要件）
  pruning: { monthly_gb: 1, unlimited: false }, // 栽培技術記録
  harvesting: { monthly_gb: 5, unlimited: true }, // 税務・収益分析（無制限）
  other: { monthly_gb: 2, unlimited: false } // その他作業記録
}

export default function PhotosPage() {
  const { user: currentUser, loading: authLoading } = useAuth()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [vegetables, setVegetables] = useState<Vegetable[]>([])
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  // フィルター・検索状態
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedVegetable, setSelectedVegetable] = useState<string>('all')
  const [selectedDateRange, setSelectedDateRange] = useState<string>('all')
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const [selectedWorkType, setSelectedWorkType] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'work_type' | 'timeline' | 'vegetable' | 'grid'>('work_type')
  const [sortBy, setSortBy] = useState<string>('work_type')
  
  // モーダル状態
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showStorageModal, setShowStorageModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  
  // 選択状態（バルク操作用）
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode] = useState(false)

  useEffect(() => {
    if (currentUser?.company_id) {
      fetchData()
    }
  }, [currentUser])

  // 写真の作業種類別分類（作業ログ連携）
  const categorizePhotoByWorkType = (photo: any): string => {
    // 作業記録から直接分類（優先度最高）
    if (photo.operation_log?.work_type) {
      return photo.operation_log.work_type
    }

    // タグベースの推測分類（作業記録がない場合）
    if (photo.tags && photo.tags.length > 0) {
      const tags = photo.tags.map((tag: string) => tag.toLowerCase())
      
      // 播種・育苗関連
      if (tags.some((tag: string) => ['種', '播種', '育苗', '苗', '発芽'].includes(tag))) {
        return 'seeding'
      }
      // 定植関連
      if (tags.some((tag: string) => ['定植', '移植', '植付け'].includes(tag))) {
        return 'planting'
      }
      // 施肥関連
      if (tags.some((tag: string) => ['施肥', '肥料', '堆肥', '追肥'].includes(tag))) {
        return 'fertilizing'
      }
      // 灌水関連
      if (tags.some((tag: string) => ['灌水', '水やり', '散水'].includes(tag))) {
        return 'watering'
      }
      // 除草関連
      if (tags.some((tag: string) => ['除草', '草取り', '除草剤'].includes(tag))) {
        return 'weeding'
      }
      // 整枝・摘芽関連
      if (tags.some((tag: string) => ['整枝', '摘芽', '剪定', '摘心'].includes(tag))) {
        return 'pruning'
      }
      // 収穫関連
      if (tags.some((tag: string) => ['収穫', '出荷', '品質', '選別'].includes(tag))) {
        return 'harvesting'
      }
    }

    // デフォルトはその他作業
    return 'other'
  }

  // 期限日付計算（作業種類別保存期間）
  const calculateExpiryDate = (takenAt: string, workType: string): string => {
    const workCategory = WORK_TYPE_CATEGORIES.find(c => c.id === workType)
    if (!workCategory) return takenAt

    const takenDate = new Date(takenAt)
    const expiryDate = new Date(takenDate.getTime() + workCategory.retention_days * 24 * 60 * 60 * 1000)
    return expiryDate.toISOString()
  }

  const fetchData = async () => {
    if (!currentUser?.company_id) {
      
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      // 認証されたユーザーの実際の会社IDを使用
      const companyId = currentUser.company_id

      let vegetables: Vegetable[] = []
      let photos: Photo[] = []
      let storage: StorageInfo | null = null

      try {
        // 野菜データ、写真データ、容量情報を並行取得
        const [vegetablesResponse, photosResponse, storageResponse] = await Promise.all([
          fetch(`/api/gantt?company_id=${companyId}&start_date=2024-01-01&end_date=2024-12-31`)
            .catch(err => {
              
              return { ok: false }
            }),
          fetch(`/api/photos?company_id=${companyId}&limit=1000`)
            .catch(err => {
                
              return { ok: false }
            }),
          fetch(`/api/photos/storage?company_id=${companyId}`)
            .catch(err => {
              
              return { ok: false }
            })
        ])

        // 野菜データの処理
        try {
          if (vegetablesResponse.ok) {
            const vegetablesResult = await vegetablesResponse.json()
            if (vegetablesResult.success && vegetablesResult.data?.vegetables) {
              vegetables = vegetablesResult.data.vegetables.map((v: any) => ({
                id: v.id,
                name: v.name,
                variety: v.variety_name || v.variety,
                plot_name: v.plot_name
              }))
            }
          }
        } catch (err) {
          
        }

        // 写真データの処理と作業種類別分類
        try {
          if (photosResponse.ok) {
            const photosResult = await photosResponse.json()
            if (photosResult.success && Array.isArray(photosResult.data)) {
              photos = photosResult.data.map((photo: any) => {
                const workType = categorizePhotoByWorkType(photo)
                const workCategory = WORK_TYPE_CATEGORIES.find(c => c.id === workType)
                
                return {
                  ...photo,
                  work_type: workType,
                  expiry_date: calculateExpiryDate(photo.taken_at, workType),
                  importance_score: workCategory?.priority === 1 ? 100 : // 播種・育苗
                                  workCategory?.priority === 7 ? 95 : // 収穫
                                  workCategory?.priority === 3 ? 85 : // 施肥
                                  workCategory?.priority === 5 ? 75 : // 除草
                                  workCategory?.priority === 2 ? 65 : // 定植
                                  workCategory?.priority === 6 ? 55 : // 整枝・摘芽
                                  workCategory?.priority === 4 ? 45 : // 灌水
                                  35, // その他
                  work_category: workCategory
                }
              })
            }
          }
        } catch (err) {
          
        }

        // 容量情報の処理
        try {
          if (storageResponse.ok) {
            const storageResult = await storageResponse.json()
            if (storageResult.success && storageResult.data) {
              // category_usageが存在しない場合は初期化
              if (!storageResult.data.category_usage) {
                const workTypeUsage: { [key: string]: any } = {}
                WORK_TYPE_CATEGORIES.forEach(workCategory => {
                  workTypeUsage[workCategory.id] = {
                    count: 0,
                    bytes: 0,
                    percentage: 0
                  }
                })
                storageResult.data.category_usage = workTypeUsage
              }
              storage = storageResult.data
            }
          }
        } catch (err) {
          
        }
      } catch (networkError) {
        
      }

      // データが取得できない場合の初期設定
      if (vegetables.length === 0) {
        
        vegetables = [
          { id: 'v1', name: 'A棟トマト（桃太郎）', variety: '桃太郎', plot_name: 'A棟温室' },
          { id: 'v2', name: 'B棟キュウリ（四葉）', variety: '四葉', plot_name: 'B棟温室' },
          { id: 'v3', name: '露地レタス（春作）', variety: 'グリーンリーフ', plot_name: '露地第1圃場' }
        ]
      }

      // 容量情報が取得できない場合の初期化（作業種類別）
      if (!storage) {
        const workTypeUsage: { [key: string]: any } = {}
        WORK_TYPE_CATEGORIES.forEach(workCategory => {
          workTypeUsage[workCategory.id] = {
            count: 0,
            bytes: 0,
            percentage: 0
          }
        })
        
        storage = {
          used_bytes: 0,
          limit_bytes: 15 * 1024 * 1024 * 1024, // 15GB デフォルト（作業記録特化のため増量）
          category_usage: workTypeUsage
        }
      }

      setVegetables(vegetables)
      setPhotos(photos)
      setStorageInfo(storage)
      
    } catch (error) {
      
      // エラー時の初期設定
      setVegetables([
        { id: 'v1', name: 'A棟トマト（桃太郎）', variety: '桃太郎', plot_name: 'A棟温室' },
        { id: 'v2', name: 'B棟キュウリ（四葉）', variety: '四葉', plot_name: 'B棟温室' },
        { id: 'v3', name: '露地レタス（春作）', variety: 'グリーンリーフ', plot_name: '露地第1圃場' }
      ])
      setPhotos([])
      
      // エラー時のデフォルト容量情報（作業種類別）
      const workTypeUsage: { [key: string]: any } = {}
      WORK_TYPE_CATEGORIES.forEach(workCategory => {
        workTypeUsage[workCategory.id] = { count: 0, bytes: 0, percentage: 0 }
      })
      setStorageInfo({
        used_bytes: 0,
        limit_bytes: 15 * 1024 * 1024 * 1024, // 15GB デフォルト
        category_usage: workTypeUsage
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  // フィルタリング・ソート処理（作業種類対応）
  const filteredAndSortedPhotos = photos
    .filter(photo => {
      // 検索クエリフィルター
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesFilename = photo.original_filename.toLowerCase().includes(query)
        const matchesDescription = photo.description?.toLowerCase().includes(query)
        const matchesTags = photo.tags?.some(tag => tag.toLowerCase().includes(query))
        const matchesVegetable = photo.vegetable?.name.toLowerCase().includes(query)
        const matchesWorkType = photo.work_category?.name.toLowerCase().includes(query)
        const matchesOperationLog = photo.operation_log?.work_notes?.toLowerCase().includes(query)
        
        if (!matchesFilename && !matchesDescription && !matchesTags && !matchesVegetable && !matchesWorkType && !matchesOperationLog) {
          return false
        }
      }
      
      // 野菜フィルター
      if (selectedVegetable !== 'all' && photo.vegetable_id !== selectedVegetable) {
        return false
      }
      
      // 作業種類フィルター
      if (selectedWorkType !== 'all' && photo.work_type !== selectedWorkType) {
        return false
      }
      
      // 日付フィルター
      if (selectedDateRange !== 'all') {
        const photoDate = new Date(photo.taken_at)
        const now = new Date()
        
        switch (selectedDateRange) {
          case 'today':
            if (photoDate.toDateString() !== now.toDateString()) return false
            break
          case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            if (photoDate < weekAgo) return false
            break
          case 'month':
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            if (photoDate < monthAgo) return false
            break
          case 'expiring':
            // 30日以内に期限切れ
            const expiryDate = new Date(photo.expiry_date || photo.taken_at)
            const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
            if (expiryDate > thirtyDaysFromNow) return false
            break
        }
      }
      
      // タグフィルター
      if (selectedTag !== 'all') {
        if (!photo.tags?.includes(selectedTag)) return false
      }
      
      return true
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime()
        case 'oldest':
          return new Date(a.taken_at).getTime() - new Date(b.taken_at).getTime()
        case 'work_type':
          const aWorkType = WORK_TYPE_CATEGORIES.find(c => c.id === a.work_type)?.priority || 999
          const bWorkType = WORK_TYPE_CATEGORIES.find(c => c.id === b.work_type)?.priority || 999
          return aWorkType - bWorkType
        case 'vegetable':
          return (a.vegetable?.name || '').localeCompare(b.vegetable?.name || '')
        case 'importance':
          return (b.importance_score || 0) - (a.importance_score || 0)
        case 'size':
          return b.file_size - a.file_size
        default:
          return 0
      }
    })

  // 作業種類別グループ化（作業種類表示用）
  const photosByWorkType = WORK_TYPE_CATEGORIES.reduce((acc, workCategory) => {
    acc[workCategory.id] = filteredAndSortedPhotos.filter(photo => photo.work_type === workCategory.id)
    return acc
  }, {} as { [key: string]: Photo[] })

  // 野菜別グループ化（野菜表示用）
  const photosByVegetable = vegetables.reduce((acc, vegetable) => {
    acc[vegetable.id] = filteredAndSortedPhotos.filter(photo => photo.vegetable_id === vegetable.id)
    return acc
  }, {} as { [key: string]: Photo[] })

  // 日付別グループ化（タイムライン表示用）
  const photosByDate = filteredAndSortedPhotos.reduce((acc, photo) => {
    const dateKey = format(parseISO(photo.taken_at), 'yyyy-MM-dd')
    if (!acc[dateKey]) acc[dateKey] = []
    acc[dateKey].push(photo)
    return acc
  }, {} as { [key: string]: Photo[] })

  // 全タグを取得
  const allTags = Array.from(new Set(photos.flatMap(photo => photo.tags || [])))

  const handlePhotoClick = (photo: Photo) => {
    setSelectedPhoto(photo)
    setShowPhotoModal(true)
  }

  const handleSelectPhoto = (photoId: string) => {
    const newSelected = new Set(selectedPhotos)
    if (newSelected.has(photoId)) {
      newSelected.delete(photoId)
    } else {
      newSelected.add(photoId)
    }
    setSelectedPhotos(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedPhotos.size === filteredAndSortedPhotos.length) {
      setSelectedPhotos(new Set())
    } else {
      setSelectedPhotos(new Set(filteredAndSortedPhotos.map(p => p.id)))
    }
  }

  const handleBulkDownload = async () => {
    if (selectedPhotos.size === 0) return
    
    const selectedPhotoList = filteredAndSortedPhotos.filter(p => selectedPhotos.has(p.id))
    
    // 実装では実際のダウンロードAPIを呼び出し
    
    alert(`${selectedPhotos.size}枚の写真をダウンロードします`)
  }

  const handleBulkDelete = async () => {
    if (selectedPhotos.size === 0) return
    
    if (!confirm(`選択した${selectedPhotos.size}枚の写真を削除しますか？`)) return
    
    try {
      // 実装では実際の削除APIを呼び出し

      // ローカル状態から削除
      setPhotos(photos.filter(p => !selectedPhotos.has(p.id)))
      setSelectedPhotos(new Set())
      setSelectMode(false)
      
      alert(`${selectedPhotos.size}枚の写真を削除しました`)
    } catch (error) {
      
      alert('削除に失敗しました')
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (authLoading || loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="aspect-square bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 bg-gradient-to-br from-green-50 to-blue-50 min-h-screen p-6">
      {/* 🌱 農業×金融 プロフェッショナルヘッダー */}
      <div className="bg-white rounded-lg shadow-lg border-2 border-green-100">
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6 rounded-t-lg">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                <Camera className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">📋 作業記録フォト管理システム</h1>
                <p className="text-green-100 text-lg">
                  作業フロー統合型・法的要件対応による専門的記録管理
                </p>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <span className="bg-white/20 px-3 py-1 rounded-full">
                    総写真数: {filteredAndSortedPhotos.length}枚
                  </span>
                  <span className="bg-white/20 px-3 py-1 rounded-full">
                    容量使用: {storageInfo ? (storageInfo.used_bytes / (1024 * 1024 * 1024)).toFixed(2) : 0}GB
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col lg:flex-row items-center gap-3">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setShowStorageModal(true)}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <HardDrive className="w-4 h-4 mr-2" />
                容量管理
              </Button>
              
              <Button
                variant="outline"
                size="lg"
                onClick={handleRefresh}
                disabled={refreshing}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                更新
              </Button>
              
              <Button 
                size="lg" 
                className="bg-white text-green-600 hover:bg-gray-100 font-bold"
                onClick={() => window.location.href = '/dashboard/gantt'}
              >
                <Plus className="w-4 h-4 mr-2" />
                作業記録で写真追加
              </Button>
            </div>
          </div>
        </div>

        {/* 💾 作業種類別ストレージダッシュボード */}
        <div className="bg-white p-6 border-t border-green-200">
          <div className="grid grid-cols-1 md:grid-cols-4 xl:grid-cols-8 gap-3">
            {WORK_TYPE_CATEGORIES.map(workCategory => {
              const usage = storageInfo?.category_usage?.[workCategory.id]
              const limitGB = STORAGE_LIMITS[workCategory.id as keyof typeof STORAGE_LIMITS]?.monthly_gb || 1
              const usageGB = usage ? usage.bytes / (1024 * 1024 * 1024) : 0
              const percentage = usage ? Math.min((usageGB / limitGB) * 100, 100) : 0
              
              return (
                <div key={workCategory.id} className={`p-3 rounded-lg border-2 ${
                  workCategory.color === 'green' ? 'border-green-200 bg-green-50' :
                  workCategory.color === 'emerald' ? 'border-emerald-200 bg-emerald-50' :
                  workCategory.color === 'blue' ? 'border-blue-200 bg-blue-50' :
                  workCategory.color === 'cyan' ? 'border-cyan-200 bg-cyan-50' :
                  workCategory.color === 'yellow' ? 'border-yellow-200 bg-yellow-50' :
                  workCategory.color === 'purple' ? 'border-purple-200 bg-purple-50' :
                  workCategory.color === 'orange' ? 'border-orange-200 bg-orange-50' :
                  'border-gray-200 bg-gray-50'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1">
                      <span className="text-lg">{workCategory.icon}</span>
                      <span className="font-semibold text-xs truncate">{workCategory.name}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {usage?.count || 0}枚
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <Progress value={percentage} className="h-2" />
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>{usageGB.toFixed(1)}GB</span>
                      <span>{STORAGE_LIMITS[workCategory.id as keyof typeof STORAGE_LIMITS]?.unlimited ? '無制限' : `${limitGB}GB`}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      保存期間: {Math.floor(workCategory.retention_days / 365)}年{(workCategory.retention_days % 365) ? `${Math.floor((workCategory.retention_days % 365) / 30)}ヶ月` : ''}
                    </div>
                    <div className="text-xs text-gray-400">
                      法的根拠: {workCategory.legal_requirement.split('・')[0]}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 🔍 高度検索・フィルターパネル */}
      <Card className="border-2 border-blue-100 shadow-md">
        <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                <Filter className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">
                  🔍 高度検索・フィルター
                </CardTitle>
                <p className="text-green-100 text-sm">
                  農業記録に特化した多角的検索システム
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-green-100 uppercase tracking-wider">AgriFinance Pro</div>
              <div className="text-sm font-medium">検索システム</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Search className="w-4 h-4" />
                統合検索
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="ファイル名・説明・タグ・カテゴリで検索"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 border-2 border-blue-200 focus:border-blue-400"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4" />
                作業種類
              </Label>
              <Select value={selectedWorkType} onValueChange={setSelectedWorkType}>
                <SelectTrigger className="border-2 border-blue-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべての作業種類</SelectItem>
                  {WORK_TYPE_CATEGORIES.map(workCategory => (
                    <SelectItem key={workCategory.id} value={workCategory.id}>
                      <div className="flex items-center gap-2">
                        <span>{workCategory.icon}</span>
                        {workCategory.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Sprout className="w-4 h-4" />
                野菜・品種
              </Label>
              <Select value={selectedVegetable} onValueChange={setSelectedVegetable}>
                <SelectTrigger className="border-2 border-green-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべての野菜</SelectItem>
                  {vegetables.map(vegetable => (
                    <SelectItem key={vegetable.id} value={vegetable.id}>
                      {vegetable.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                期間・期限
              </Label>
              <Select value={selectedDateRange} onValueChange={setSelectedDateRange}>
                <SelectTrigger className="border-2 border-orange-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべての期間</SelectItem>
                  <SelectItem value="today">今日</SelectItem>
                  <SelectItem value="week">1週間以内</SelectItem>
                  <SelectItem value="month">1ヶ月以内</SelectItem>
                  <SelectItem value="expiring">期限間近（30日以内）</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Tag className="w-4 h-4" />
                タグフィルター
              </Label>
              <Select value={selectedTag} onValueChange={setSelectedTag}>
                <SelectTrigger className="border-2 border-purple-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべてのタグ</SelectItem>
                  {allTags.map(tag => (
                    <SelectItem key={tag} value={tag}>
                      #{tag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Eye className="w-4 h-4" />
                表示モード
              </Label>
              <Select value={viewMode} onValueChange={(value: 'grid' | 'list' | 'category') => setViewMode(value)}>
                <SelectTrigger className="border-2 border-indigo-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIEW_MODES.map(mode => {
                    const Icon = mode.icon
                    return (
                      <SelectItem key={mode.value} value={mode.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          {mode.label}
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                並び順
              </Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="border-2 border-teal-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectMode && (
            <div className="mt-6 pt-4 border-t border-blue-200 bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    className="border-blue-300"
                  >
                    {selectedPhotos.size === filteredAndSortedPhotos.length ? '全選択解除' : '全選択'}
                  </Button>
                  <span className="text-sm text-blue-700 font-semibold">
                    {selectedPhotos.size} / {filteredAndSortedPhotos.length} 枚選択中
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleBulkDownload}>
                    <Download className="w-4 h-4 mr-2" />
                    一括ダウンロード
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    一括削除
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSelectMode(false)}>
                    選択モード終了
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!selectMode && (
            <div className="mt-6 flex justify-center">
              <Button 
                variant="outline" 
                onClick={() => setSelectMode(true)}
                className="border-blue-300 text-blue-700 hover:bg-blue-50"
              >
                一括操作モード開始
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 📸 写真表示エリア */}
      {filteredAndSortedPhotos.length === 0 ? (
        <Card className="border-2 border-gray-200 shadow-lg">
          <CardContent className="text-center py-16">
            <div className="max-w-md mx-auto">
              <div className="w-24 h-24 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-6">
                <Camera className="w-12 h-12 text-gray-500" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-4">
                📋 作業記録写真が未登録です
              </h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                {searchQuery || selectedVegetable !== 'all' || selectedWorkType !== 'all' ? 
                  'フィルター条件に一致する写真が見つかりません。検索条件を変更してみてください。' :
                  'ガントチャートの作業記録で写真を追加して、作業フロー統合型の記録管理を開始しましょう。'
                }
              </p>
              
              {/* サンプル画像表示 */}
              <div className="mb-8">
                <h4 className="text-lg font-semibold text-gray-700 mb-4">登録されたときのイメージ例</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { workType: 'seeding', name: '播種・育苗', icon: '🌱', color: 'bg-green-100 border-green-300', url: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=200&h=150&fit=crop' },
                    { workType: 'planting', name: '定植', icon: '🌿', color: 'bg-emerald-100 border-emerald-300', url: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=200&h=150&fit=crop' },
                    { workType: 'harvesting', name: '収穫', icon: '📊', color: 'bg-orange-100 border-orange-300', url: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=200&h=150&fit=crop' },
                    { workType: 'other', name: 'その他作業', icon: '🔧', color: 'bg-gray-100 border-gray-300', url: 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=200&h=150&fit=crop' }
                  ].map((sample, index) => (
                    <div key={index} className={`p-3 rounded-lg border-2 ${sample.color}`}>
                      <div className="aspect-square w-full relative mb-2 rounded-lg overflow-hidden">
                        <Image
                          src={sample.url}
                          alt={sample.name}
                          fill
                          className="object-cover opacity-75"
                          sizes="150px"
                        />
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                          <span className="text-2xl">{sample.icon}</span>
                        </div>
                      </div>
                      <p className="text-xs font-medium text-gray-700 text-center">{sample.name}</p>
                    </div>
                  ))}
                </div>
              </div>

              <Button 
                onClick={() => window.location.href = '/dashboard/gantt'}
                size="lg" 
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-8 py-3 rounded-lg font-bold shadow-lg"
              >
                <Plus className="w-5 h-5 mr-2" />
                作業記録で写真を追加
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : viewMode === 'work_type' ? (
        // 作業種類別表示
        <div className="space-y-6">
          {WORK_TYPE_CATEGORIES.map(workCategory => {
            const workTypePhotos = photosByWorkType[workCategory.id] || []
            if (workTypePhotos.length === 0) return null
            
            return (
              <Card key={workCategory.id} className="border-2 border-gray-100 shadow-md">
                <CardHeader className={`bg-gradient-to-r ${
                  workCategory.color === 'green' ? 'from-green-500 to-green-600' :
                  workCategory.color === 'emerald' ? 'from-emerald-500 to-emerald-600' :
                  workCategory.color === 'blue' ? 'from-blue-500 to-blue-600' :
                  workCategory.color === 'cyan' ? 'from-cyan-500 to-cyan-600' :
                  workCategory.color === 'yellow' ? 'from-yellow-500 to-yellow-600' :
                  workCategory.color === 'purple' ? 'from-purple-500 to-purple-600' :
                  workCategory.color === 'orange' ? 'from-orange-500 to-orange-600' :
                  'from-gray-500 to-gray-600'
                } text-white`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{workCategory.icon}</span>
                      <div>
                        <CardTitle className="text-xl">{workCategory.name}</CardTitle>
                        <CardDescription className="text-white/80">
                          {workCategory.description} • {workTypePhotos.length}枚
                        </CardDescription>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-white/80">保存期間</div>
                      <div className="font-bold">
                        {Math.floor(workCategory.retention_days / 365)}年
                        {(workCategory.retention_days % 365) ? `${Math.floor((workCategory.retention_days % 365) / 30)}ヶ月` : ''}
                      </div>
                      <div className="text-xs text-white/60 mt-1">
                        法的根拠: {workCategory.legal_requirement.split('・')[0]}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                    {workTypePhotos.map((photo) => (
                      <div
                        key={photo.id}
                        className="relative group cursor-pointer bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200"
                        onClick={() => handlePhotoClick(photo)}
                      >
                        {selectMode && (
                          <div className="absolute top-2 left-2 z-10">
                            <input
                              type="checkbox"
                              checked={selectedPhotos.has(photo.id)}
                              onChange={() => handleSelectPhoto(photo.id)}
                              className="w-4 h-4 rounded border-gray-300"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        )}

                        <div className="aspect-square w-full relative overflow-hidden">
                          <Image
                            src={photo.public_url || `https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=300&h=300&fit=crop&seed=${photo.id}`}
                            alt={photo.original_filename}
                            fill
                            className="object-cover transition-transform group-hover:scale-110 duration-300"
                            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 16vw"
                          />
                          
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <div className="absolute bottom-2 left-2 right-2 text-white">
                              <p className="text-sm font-semibold truncate mb-1">{photo.original_filename}</p>
                              <div className="flex justify-between items-center text-xs">
                                <span>{format(parseISO(photo.taken_at), 'MM/dd')}</span>
                                <span>{formatFileSize(photo.file_size)}</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* 期限警告 */}
                          {photo.expiry_date && new Date(photo.expiry_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) && (
                            <div className="absolute top-2 right-2">
                              <Badge variant="destructive" className="text-xs">
                                <Clock className="w-3 h-3 mr-1" />
                                期限間近
                              </Badge>
                            </div>
                          )}
                        </div>

                        <div className="p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold truncate flex-1 mr-2">{photo.original_filename}</p>
                            {photo.vegetable && (
                              <Badge variant="outline" className="text-xs shrink-0">
                                {photo.vegetable.name}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>{format(parseISO(photo.taken_at), 'MM/dd HH:mm')}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Zap className="w-3 h-3" />
                              <span>重要度 {photo.importance_score || 0}</span>
                            </div>
                          </div>
                          
                          {photo.tags && photo.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {photo.tags.slice(0, 2).map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs py-0 px-1">
                                  #{tag}
                                </Badge>
                              ))}
                              {photo.tags.length > 2 && (
                                <span className="text-xs text-gray-400">+{photo.tags.length - 2}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        // グリッド・リスト表示
        <Card className="border-2 border-gray-100 shadow-md">
          <CardHeader className="bg-gradient-to-r from-gray-600 to-gray-700 text-white">
            <CardTitle className="flex items-center gap-2">
              <FileImage className="w-6 h-6" />
              📸 {viewMode === 'grid' ? 'グリッド表示' : 'リスト表示'} • {filteredAndSortedPhotos.length}枚
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className={
              viewMode === 'grid'
                ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4"
                : "space-y-4"
            }>
              {filteredAndSortedPhotos.map((photo) => {
                const category = PHOTO_CATEGORIES.find(c => c.id === photo.category_id)
                return (
                  <div
                    key={photo.id}
                    className={`relative group cursor-pointer ${
                      viewMode === 'grid'
                        ? 'bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-all'
                        : 'flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50'
                    }`}
                    onClick={() => !selectMode && handlePhotoClick(photo)}
                  >
                    {selectMode && (
                      <div className="absolute top-2 left-2 z-10">
                        <input
                          type="checkbox"
                          checked={selectedPhotos.has(photo.id)}
                          onChange={() => handleSelectPhoto(photo.id)}
                          className="w-4 h-4 rounded"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    )}

                    <div className={viewMode === 'grid' ? 'aspect-square relative' : 'w-20 h-20 relative rounded-lg overflow-hidden'}>
                      <Image
                        src={photo.public_url || `https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=300&h=300&fit=crop&seed=${photo.id}`}
                        alt={photo.original_filename}
                        fill
                        className="object-cover"
                        sizes={viewMode === 'grid' ? '300px' : '80px'}
                      />
                      
                      {category && (
                        <div className="absolute top-1 right-1">
                          <span className="text-lg">{category.icon}</span>
                        </div>
                      )}
                    </div>

                    {viewMode === 'grid' && (
                      <div className="p-3">
                        <p className="font-semibold text-sm truncate">{photo.original_filename}</p>
                        <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                          <span>{format(parseISO(photo.taken_at), 'MM/dd')}</span>
                          <Badge variant="outline" className="text-xs">
                            {category?.name || 'その他'}
                          </Badge>
                        </div>
                      </div>
                    )}

                    {viewMode === 'list' && (
                      <div className="flex-1">
                        <h4 className="font-semibold">{photo.original_filename}</h4>
                        <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                          <span>{format(parseISO(photo.taken_at), 'yyyy/MM/dd')}</span>
                          <Badge variant="outline">{category?.name || 'その他'}</Badge>
                          <span>重要度: {photo.importance_score || 0}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 写真詳細モーダル */}
      {selectedPhoto && (
        <Dialog open={showPhotoModal} onOpenChange={setShowPhotoModal}>
          <DialogContent className="max-w-[90vw] xl:max-w-[1400px] max-h-[92vh] p-0 bg-white overflow-hidden">
            {/* ヘッダー */}
            <div className="border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 truncate">
                    {selectedPhoto.original_filename}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {format(parseISO(selectedPhoto.taken_at), 'yyyy年MM月dd日 HH:mm', { locale: ja })} • {formatFileSize(selectedPhoto.file_size)}
                  </p>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    ダウンロード
                  </Button>
                  <Button variant="outline" size="sm">
                    <Edit3 className="w-4 h-4 mr-2" />
                    編集
                  </Button>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="w-4 h-4 mr-2" />
                    削除
                  </Button>
                </div>
              </div>
            </div>
            
            {/* メインコンテンツ */}
            <div className="flex flex-col lg:flex-row h-full min-h-0">
              {/* 写真表示エリア */}
              <div className="flex-1 flex flex-col justify-center bg-gray-50 p-6">
                <div className="relative mx-auto max-w-full max-h-full flex items-center justify-center">
                  <Image
                    src={selectedPhoto.public_url || '/placeholder-image.jpg'}
                    alt={selectedPhoto.original_filename}
                    width={800}
                    height={600}
                    className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-lg cursor-zoom-in"
                    sizes="(max-width: 1024px) 100vw, 70vw"
                  />
                </div>
                
                {selectedPhoto.description && (
                  <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <h3 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      説明・メモ
                    </h3>
                    <p className="text-sm text-gray-700 leading-relaxed">{selectedPhoto.description}</p>
                  </div>
                )}
              </div>
              
              {/* 詳細情報サイドバー */}
              <div className="w-80 border-l border-gray-200 bg-gray-50/50 p-6 overflow-y-auto">
                <div className="space-y-4">
                {/* 基本情報 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileImage className="w-4 h-4" />
                      基本情報
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">ファイルサイズ</span>
                      <span className="font-medium">{formatFileSize(selectedPhoto.file_size)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">形式</span>
                      <Badge variant="outline">{selectedPhoto.mime_type}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">アップロード</span>
                      <span>{format(parseISO(selectedPhoto.created_at), 'MM/dd HH:mm')}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* 野菜情報 */}
                {selectedPhoto.vegetable && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sprout className="w-4 h-4" />
                        野菜情報
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">名前</span>
                        <span className="font-medium">{selectedPhoto.vegetable.name}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">品種</span>
                        <Badge variant="secondary">{selectedPhoto.vegetable.variety}</Badge>
                      </div>
                      {selectedPhoto.vegetable.plot_name && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">圃場</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {selectedPhoto.vegetable.plot_name}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* 作業情報 */}
                {selectedPhoto.operation_log && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        作業情報
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">作業種類</span>
                        <Badge variant="outline">
                          {selectedPhoto.operation_log.work_type === 'seeding' && '播種・育苗'}
                          {selectedPhoto.operation_log.work_type === 'planting' && '定植'}
                          {selectedPhoto.operation_log.work_type === 'fertilizing' && '施肥'}
                          {selectedPhoto.operation_log.work_type === 'watering' && '灌水'}
                          {selectedPhoto.operation_log.work_type === 'pruning' && '整枝・摘芽'}
                          {selectedPhoto.operation_log.work_type === 'harvesting' && '収穫'}
                        </Badge>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">作業日</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(parseISO(selectedPhoto.operation_log.work_date), 'MM/dd')}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* タグ */}
                {selectedPhoto.tags && selectedPhoto.tags.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Tag className="w-4 h-4" />
                        タグ
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {selectedPhoto.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}