'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
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
  Sprout
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import Image from 'next/image'
import PhotoUpload from '@/components/photo-upload'

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

const VIEW_MODES = [
  { value: 'grid', label: 'グリッド表示', icon: Grid3X3 },
  { value: 'list', label: 'リスト表示', icon: List }
]

const SORT_OPTIONS = [
  { value: 'newest', label: '新しい順' },
  { value: 'oldest', label: '古い順' },
  { value: 'name', label: '名前順' },
  { value: 'size', label: 'サイズ順' }
]

export default function PhotosPage() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [vegetables, setVegetables] = useState<Vegetable[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  // フィルター・検索状態
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedVegetable, setSelectedVegetable] = useState<string>('all')
  const [selectedDateRange, setSelectedDateRange] = useState<string>('all')
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [sortBy, setSortBy] = useState<string>('newest')
  
  // モーダル状態
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showImageExpanded, setShowImageExpanded] = useState(false)
  
  // 選択状態（バルク操作用）
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // 会社IDは将来的に認証から取得
      const companyId = 'a1111111-1111-1111-1111-111111111111'

      let vegetables: Vegetable[] = []
      let photos: Photo[] = []

      try {
        // 野菜データと写真データを並行取得（エラー耐性付き）
        const [vegetablesResponse, photosResponse] = await Promise.all([
          fetch(`/api/gantt?company_id=${companyId}&start_date=2024-01-01&end_date=2024-12-31`)
            .catch(err => {
              console.warn('Vegetables API fetch failed:', err)
              return { ok: false }
            }),
          fetch(`/api/photos?company_id=${companyId}&limit=100`)
            .catch(err => {
              console.warn('Photos API fetch failed:', err)  
              return { ok: false }
            })
        ])

        // 野菜データの処理（エラー耐性）
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
          console.warn('Failed to process vegetables data:', err)
        }

        // 写真データの処理（エラー耐性）
        try {
          if (photosResponse.ok) {
            const photosResult = await photosResponse.json()
            if (photosResult.success && Array.isArray(photosResult.data)) {
              photos = photosResult.data
            }
          }
        } catch (err) {
          console.warn('Failed to process photos data:', err)
        }
      } catch (networkError) {
        console.error('Network error during API calls:', networkError)
      }

      // APIからデータが取得できない場合はサンプルデータを使用
      if (vegetables.length === 0) {
        vegetables = [
          { id: 'v1', name: 'A棟トマト（桃太郎）', variety: '桃太郎', plot_name: 'A棟温室' },
          { id: 'v2', name: 'B棟キュウリ（四葉）', variety: '四葉', plot_name: 'B棟温室' },
          { id: 'v3', name: '露地レタス（春作）', variety: 'グリーンリーフ', plot_name: '露地第1圃場' }
        ]
      }

      if (photos.length === 0) {
        // サンプル写真データ
        photos = [
          {
            id: 'p1',
            vegetable_id: 'v1',
            storage_path: '/sample-images/tomato-1.jpg',
            original_filename: 'トマト成長記録_0808.jpg',
            file_size: 1024000,
            mime_type: 'image/jpeg',
            taken_at: '2024-08-08T10:30:00Z',
            description: '第2回目収穫。品質良好、サイズも大きく育っています。',
            tags: ['収穫', '品質良好', '成長記録'],
            created_at: '2024-08-08T10:35:00Z',
            vegetable: {
              id: 'v1',
              name: 'A棟トマト（桃太郎）',
              variety: '桃太郎',
              plot_name: 'A棟温室'
            },
            operation_log: {
              id: 'ol1',
              work_type: 'harvesting',
              work_date: '2024-08-08'
            },
            public_url: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400&h=300&fit=crop'
          },
          {
            id: 'p2',
            vegetable_id: 'v2',
            storage_path: '/sample-images/cucumber-1.jpg',
            original_filename: 'キュウリ誘引作業_0807.jpg',
            file_size: 856000,
            mime_type: 'image/jpeg',
            taken_at: '2024-08-07T14:15:00Z',
            description: '誘引作業完了。成長が順調で、花芽も多数確認。',
            tags: ['誘引', '成長期', '花芽'],
            created_at: '2024-08-07T14:20:00Z',
            vegetable: {
              id: 'v2',
              name: 'B棟キュウリ（四葉）',
              variety: '四葉',
              plot_name: 'B棟温室'
            },
            operation_log: {
              id: 'ol2',
              work_type: 'pruning',
              work_date: '2024-08-07'
            },
            public_url: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400&h=300&fit=crop'
          },
          {
            id: 'p3',
            vegetable_id: 'v1',
            storage_path: '/sample-images/tomato-2.jpg',
            original_filename: 'トマト病害チェック_0806.jpg',
            file_size: 1200000,
            mime_type: 'image/jpeg',
            taken_at: '2024-08-06T09:00:00Z',
            description: '下位葉に若干の病斑あり。早期対処が必要。',
            tags: ['病害チェック', '下位葉', '要注意'],
            created_at: '2024-08-06T09:15:00Z',
            vegetable: {
              id: 'v1',
              name: 'A棟トマト（桃太郎）',
              variety: '桃太郎',
              plot_name: 'A棟温室'
            },
            public_url: 'https://images.unsplash.com/photo-1592841200221-a6898f307baa?w=400&h=300&fit=crop'
          },
          {
            id: 'p4',
            vegetable_id: 'v3',
            storage_path: '/sample-images/lettuce-1.jpg',
            original_filename: 'レタス播種状況_0805.jpg',
            file_size: 678000,
            mime_type: 'image/jpeg',
            taken_at: '2024-08-05T16:30:00Z',
            description: '春作レタスの播種完了。発芽率も良好な状況です。',
            tags: ['播種', '発芽', '春作'],
            created_at: '2024-08-05T16:45:00Z',
            vegetable: {
              id: 'v3',
              name: '露地レタス（春作）',
              variety: 'グリーンリーフ',
              plot_name: '露地第1圃場'
            },
            operation_log: {
              id: 'ol3',
              work_type: 'seeding',
              work_date: '2024-08-05'
            },
            public_url: 'https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?w=400&h=300&fit=crop'
          },
          {
            id: 'p5',
            vegetable_id: 'v2',
            storage_path: '/sample-images/cucumber-2.jpg',
            original_filename: 'キュウリ施肥作業_0804.jpg',
            file_size: 945000,
            mime_type: 'image/jpeg',
            taken_at: '2024-08-04T11:20:00Z',
            description: '追肥実施。液肥散布により栄養補給を実施しました。',
            tags: ['追肥', '液肥', '栄養補給'],
            created_at: '2024-08-04T11:30:00Z',
            vegetable: {
              id: 'v2',
              name: 'B棟キュウリ（四葉）',
              variety: '四葉',
              plot_name: 'B棟温室'
            },
            operation_log: {
              id: 'ol4',
              work_type: 'fertilizing',
              work_date: '2024-08-04'
            },
            public_url: 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=400&h=300&fit=crop'
          }
        ]
      }

      setVegetables(vegetables)
      setPhotos(photos)
    } catch (error) {
      console.error('データ取得エラー:', error)
      // エラー時もサンプルデータを設定
      setVegetables([
        { id: 'v1', name: 'A棟トマト（桃太郎）', variety: '桃太郎', plot_name: 'A棟温室' },
        { id: 'v2', name: 'B棟キュウリ（四葉）', variety: '四葉', plot_name: 'B棟温室' },
        { id: 'v3', name: '露地レタス（春作）', variety: 'グリーンリーフ', plot_name: '露地第1圃場' }
      ])
      setPhotos([])
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  // フィルタリング・ソート処理
  const filteredAndSortedPhotos = photos
    .filter(photo => {
      // 検索クエリフィルター
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesFilename = photo.original_filename.toLowerCase().includes(query)
        const matchesDescription = photo.description?.toLowerCase().includes(query)
        const matchesTags = photo.tags?.some(tag => tag.toLowerCase().includes(query))
        const matchesVegetable = photo.vegetable?.name.toLowerCase().includes(query)
        
        if (!matchesFilename && !matchesDescription && !matchesTags && !matchesVegetable) {
          return false
        }
      }
      
      // 野菜フィルター
      if (selectedVegetable !== 'all' && photo.vegetable_id !== selectedVegetable) {
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
        case 'name':
          return a.original_filename.localeCompare(b.original_filename)
        case 'size':
          return b.file_size - a.file_size
        default:
          return 0
      }
    })

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
    console.log('バルクダウンロード対象:', selectedPhotoList)
    alert(`${selectedPhotos.size}枚の写真をダウンロードします`)
  }

  const handleBulkDelete = async () => {
    if (selectedPhotos.size === 0) return
    
    if (!confirm(`選択した${selectedPhotos.size}枚の写真を削除しますか？`)) return
    
    try {
      // 実装では実際の削除APIを呼び出し
      console.log('バルク削除対象:', Array.from(selectedPhotos))
      
      // ローカル状態から削除
      setPhotos(photos.filter(p => !selectedPhotos.has(p.id)))
      setSelectedPhotos(new Set())
      setSelectMode(false)
      
      alert(`${selectedPhotos.size}枚の写真を削除しました`)
    } catch (error) {
      console.error('削除エラー:', error)
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

  if (loading) {
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
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">フォトギャラリー</h1>
          <p className="text-gray-600">
            栽培記録写真の管理・閲覧 • {filteredAndSortedPhotos.length}枚の写真
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            更新
          </Button>
          
          {selectMode && selectedPhotos.size > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={handleBulkDownload}>
                <Download className="w-4 h-4 mr-2" />
                ダウンロード ({selectedPhotos.size})
              </Button>
              <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                <Trash2 className="w-4 h-4 mr-2" />
                削除 ({selectedPhotos.size})
              </Button>
            </>
          )}
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setSelectMode(!selectMode)}
          >
            {selectMode ? '選択解除' : '選択モード'}
          </Button>
          
          <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                写真追加
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>写真をアップロード</DialogTitle>
                <DialogDescription>
                  新しい写真をアップロードします
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>対象野菜</Label>
                  <Select value={selectedVegetable === 'all' ? 'all' : selectedVegetable} onValueChange={setSelectedVegetable}>
                    <SelectTrigger>
                      <SelectValue placeholder="野菜を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">すべて</SelectItem>
                      {vegetables.map(vegetable => (
                        <SelectItem key={vegetable.id} value={vegetable.id}>
                          {vegetable.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <PhotoUpload
                  vegetableId={selectedVegetable === 'all' ? '' : selectedVegetable}
                  onUploadSuccess={() => {
                    setShowUploadModal(false)
                    handleRefresh()
                  }}
                />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* フィルター・検索バー */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Filter className="w-5 h-5 mr-2" />
            フィルター・検索
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="space-y-2">
              <Label>検索</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="ファイル名・説明・タグで検索"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>野菜</Label>
              <Select value={selectedVegetable} onValueChange={setSelectedVegetable}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  {vegetables.map(vegetable => (
                    <SelectItem key={vegetable.id} value={vegetable.id}>
                      {vegetable.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>期間</Label>
              <Select value={selectedDateRange} onValueChange={setSelectedDateRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  <SelectItem value="today">今日</SelectItem>
                  <SelectItem value="week">1週間</SelectItem>
                  <SelectItem value="month">1か月</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>タグ</Label>
              <Select value={selectedTag} onValueChange={setSelectedTag}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  {allTags.map(tag => (
                    <SelectItem key={tag} value={tag}>
                      {tag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>表示</Label>
              <Select value={viewMode} onValueChange={(value: 'grid' | 'list') => setViewMode(value)}>
                <SelectTrigger>
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
              <Label>並び順</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
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
            <div className="mt-4 pt-4 border-t flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedPhotos.size === filteredAndSortedPhotos.length ? '全選択解除' : '全選択'}
              </Button>
              <span className="text-sm text-gray-600">
                {selectedPhotos.size} / {filteredAndSortedPhotos.length} 枚選択中
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 写真グリッド */}
      {filteredAndSortedPhotos.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Camera className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              写真がありません
            </h3>
            <p className="text-gray-600 mb-4">
              {searchQuery || selectedVegetable !== 'all' ? 
                'フィルター条件に一致する写真が見つかりません' :
                '最初の写真をアップロードしてください'
              }
            </p>
            <Button onClick={() => setShowUploadModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              写真を追加
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className={
          viewMode === 'grid'
            ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4"
            : "space-y-4"
        }>
          {filteredAndSortedPhotos.map((photo) => (
            <div
              key={photo.id}
              className={`relative group cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow'
                  : 'flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50'
              } ${selectMode ? 'cursor-default' : ''}`}
            >
              {selectMode && (
                <div 
                  className={`absolute ${viewMode === 'grid' ? 'top-2 left-2' : 'left-2 top-1/2 -translate-y-1/2'} z-10`}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSelectPhoto(photo.id)
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedPhotos.has(photo.id)}
                    onChange={() => handleSelectPhoto(photo.id)}
                    className="w-5 h-5 rounded border-gray-300"
                  />
                </div>
              )}

              <div
                className={`${
                  viewMode === 'grid' 
                    ? 'aspect-square w-full relative overflow-hidden' 
                    : 'w-20 h-20 relative overflow-hidden rounded-lg'
                }`}
                onClick={() => !selectMode && handlePhotoClick(photo)}
              >
                <Image
                  src={photo.public_url || '/placeholder-image.jpg'}
                  alt={photo.original_filename}
                  fill
                  className="object-cover transition-transform group-hover:scale-105"
                  sizes={viewMode === 'grid' ? '(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 16vw' : '80px'}
                />
                
                {viewMode === 'grid' && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/0 to-transparent group-hover:from-black/60 transition-all duration-300">
                    <div className="absolute bottom-0 left-0 right-0 p-3 text-white transform translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                      <p className="text-sm font-semibold truncate mb-1">{photo.original_filename}</p>
                      <div className="flex justify-between items-center text-xs">
                        <span>{format(parseISO(photo.taken_at), 'MM/dd')}</span>
                        <span>{formatFileSize(photo.file_size)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* グリッド表示時の詳細情報 */}
              {viewMode === 'grid' && (
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
                    <span>{formatFileSize(photo.file_size)}</span>
                  </div>
                  
                  {photo.tags && photo.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {photo.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs py-0 px-1">
                          {tag}
                        </Badge>
                      ))}
                      {photo.tags.length > 2 && (
                        <span className="text-xs text-gray-400">+{photo.tags.length - 2}</span>
                      )}
                    </div>
                  )}
                  
                  {photo.description && (
                    <p className="text-xs text-gray-600 line-clamp-2 leading-tight">
                      {photo.description}
                    </p>
                  )}
                </div>
              )}

              {viewMode === 'list' && (
                <div className="flex-1 min-w-0" onClick={() => !selectMode && handlePhotoClick(photo)}>
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-medium truncate">{photo.original_filename}</h4>
                    <span className="text-xs text-gray-500">{formatFileSize(photo.file_size)}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                    <Calendar className="w-3 h-3" />
                    {format(parseISO(photo.taken_at), 'yyyy/MM/dd HH:mm', { locale: ja })}
                    
                    {photo.vegetable && (
                      <>
                        <MapPin className="w-3 h-3 ml-2" />
                        {photo.vegetable.name}
                      </>
                    )}
                  </div>
                  
                  {photo.tags && photo.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {photo.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {photo.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{photo.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                  
                  {photo.description && (
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{photo.description}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
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