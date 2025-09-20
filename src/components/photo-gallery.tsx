'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Calendar, Download, Eye, Trash2, User, Tag } from 'lucide-react'
import Image from 'next/image'

interface Photo {
  id: string
  storage_path: string
  original_filename: string
  file_size: number
  taken_at: string
  description?: string
  tags?: string[]
  is_primary: boolean
  created_by?: string
  operation_log_id?: string
}

interface PhotoGalleryProps {
  vegetableId: string
  onPhotoDeleted?: () => void
}

export default function PhotoGallery({ vegetableId, onPhotoDeleted }: PhotoGalleryProps) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchPhotos()
  }, [vegetableId])

  const fetchPhotos = async () => {
    try {
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('vegetable_id', vegetableId)
        .order('taken_at', { ascending: false })

      if (error) {
        
        return
      }

      setPhotos(data || [])
      
      // 各写真の公開URLを取得
      const urls: Record<string, string> = {}
      for (const photo of data || []) {
        const { data: urlData } = supabase.storage
          .from('vegetable-photos')
          .getPublicUrl(photo.storage_path)
        urls[photo.id] = urlData.publicUrl
      }
      setImageUrls(urls)

    } catch (error) {
      
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (photo: Photo) => {
    if (!confirm(`「${photo.original_filename}」を削除しますか？`)) {
      return
    }

    try {
      // データベースから削除
      const { error: dbError } = await supabase
        .from('photos')
        .delete()
        .eq('id', photo.id)

      if (dbError) {
        
        throw dbError
      }

      // Storageからも削除
      const { error: storageError } = await supabase.storage
        .from('vegetable-photos')
        .remove([photo.storage_path])

      if (storageError) {
        
        // Storage削除エラーは警告のみ（データベースは削除済み）
      }

      // 状態を更新
      setPhotos(prev => prev.filter(p => p.id !== photo.id))
      setSelectedPhoto(null)
      onPhotoDeleted?.()
      
      alert('写真を削除しました')

    } catch (error) {
      alert('削除に失敗しました')
    }
  }

  const handleDownload = async (photo: Photo) => {
    try {
      const { data, error } = await supabase.storage
        .from('vegetable-photos')
        .download(photo.storage_path)

      if (error) {
        
        throw error
      }

      // ブラウザでダウンロード
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = photo.original_filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

    } catch (error) {
      alert('ダウンロードに失敗しました')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 B'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="aspect-square bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (photos.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <p className="text-lg font-medium mb-2">写真がありません</p>
        <p className="text-sm">栽培の様子を写真で記録してみましょう</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {photos.map((photo) => (
          <Card key={photo.id} className="group cursor-pointer hover:shadow-lg transition-all">
            <CardContent className="p-2">
              <div 
                className="aspect-square relative mb-2 overflow-hidden rounded"
                onClick={() => setSelectedPhoto(photo)}
              >
                {imageUrls[photo.id] && (
                  <Image
                    src={imageUrls[photo.id]}
                    alt={photo.description || photo.original_filename}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform"
                  />
                )}
                
                {photo.is_primary && (
                  <Badge className="absolute top-2 left-2 bg-blue-500">
                    メイン
                  </Badge>
                )}
                
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                  <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              
              <div className="space-y-1">
                <p className="text-xs font-medium truncate">
                  {photo.original_filename}
                </p>
                <p className="text-xs text-gray-500">
                  {formatDate(photo.taken_at)}
                </p>
                <p className="text-xs text-gray-400">
                  {formatFileSize(photo.file_size)}
                </p>
                
                {photo.tags && photo.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {photo.tags.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs px-1 py-0">
                        {tag}
                      </Badge>
                    ))}
                    {photo.tags.length > 2 && (
                      <Badge variant="secondary" className="text-xs px-1 py-0">
                        +{photo.tags.length - 2}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 写真詳細モーダル */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl">
          {selectedPhoto && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedPhoto.original_filename}</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* 写真表示 */}
                <div className="relative max-h-96 overflow-hidden rounded-lg bg-gray-100 border border-gray-200 shadow-sm">
                  {imageUrls[selectedPhoto.id] && (
                    <Image
                      src={imageUrls[selectedPhoto.id]}
                      alt={selectedPhoto.description || selectedPhoto.original_filename}
                      width={800}
                      height={600}
                      className="w-full h-auto object-contain"
                    />
                  )}
                </div>
                
                {/* 写真情報 */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-semibold mb-2 text-gray-800">写真情報</h4>
                      <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <span>{formatDate(selectedPhoto.taken_at)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">サイズ:</span>
                          <span>{formatFileSize(selectedPhoto.file_size)}</span>
                        </div>
                        {selectedPhoto.created_by && (
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-500" />
                            <span>撮影者: {selectedPhoto.created_by}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {selectedPhoto.description && (
                      <div className="p-3 bg-white rounded border">
                        <h4 className="font-semibold mb-2 text-gray-800">説明</h4>
                        <p className="text-sm text-gray-600">{selectedPhoto.description}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                    {selectedPhoto.tags && selectedPhoto.tags.length > 0 && (
                      <div className="p-3 bg-white rounded border">
                        <h4 className="font-semibold mb-2 flex items-center gap-2 text-gray-800">
                          <Tag className="w-4 h-4" />
                          タグ
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedPhoto.tags.map((tag) => (
                            <Badge key={tag} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-white border-blue-200 text-blue-700 hover:bg-blue-50"
                        onClick={() => handleDownload(selectedPhoto)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        ダウンロード
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="bg-red-500 hover:bg-red-600 text-white"
                        onClick={() => handleDelete(selectedPhoto)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        削除
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}