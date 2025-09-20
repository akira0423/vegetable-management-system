'use client'

import { useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Camera, Upload, X, Loader2, Image as ImageIcon } from 'lucide-react'
import Image from 'next/image'

interface PhotoUploadProps {
  vegetableId: string
  operationLogId?: string
  onUploadSuccess?: () => void
}

interface UploadingFile {
  file: File
  preview: string
  progress: number
  uploading: boolean
}

export default function PhotoUpload({ vegetableId, operationLogId, onUploadSuccess }: PhotoUploadProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return

    const newFiles: UploadingFile[] = []
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      
      // ファイル形式チェック
      if (!file.type.startsWith('image/')) {
        alert(`${file.name} は画像ファイルではありません`)
        continue
      }
      
      // ファイルサイズチェック (10MB制限)
      if (file.size > 10 * 1024 * 1024) {
        alert(`${file.name} のサイズが大きすぎます（10MB以下にしてください）`)
        continue
      }
      
      // プレビュー用のURL作成
      const preview = URL.createObjectURL(file)
      
      newFiles.push({
        file,
        preview,
        progress: 0,
        uploading: false
      })
    }
    
    setUploadingFiles(prev => [...prev, ...newFiles])
  }, [])

  const removeFile = useCallback((index: number) => {
    setUploadingFiles(prev => {
      const newFiles = [...prev]
      URL.revokeObjectURL(newFiles[index].preview) // メモリリーク防止
      newFiles.splice(index, 1)
      return newFiles
    })
  }, [])

  const uploadFile = async (uploadingFile: UploadingFile, index: number) => {
    const { file } = uploadingFile
    
    // ファイル名を生成（タイムスタンプ + ランダム文字列）
    const timestamp = new Date().toISOString().split('T')[0]
    const randomId = Math.random().toString(36).substring(2, 15)
    const fileExtension = file.name.split('.').pop()
    const fileName = `${timestamp}-${randomId}.${fileExtension}`
    
    // Storageパス（野菜ID/ファイル名の形式に変更）
    const storagePath = `${vegetableId}/${fileName}`

    try {
      // アップロード進捗更新
      setUploadingFiles(prev => {
        const newFiles = [...prev]
        newFiles[index] = { ...newFiles[index], uploading: true, progress: 0 }
        return newFiles
      })

      // Supabase Storageにアップロード
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('vegetable-photos')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        
        
        alert(`ファイルアップロードエラー: ${uploadError.message}`)
        throw uploadError
      }

      // 進捗100%に更新
      setUploadingFiles(prev => {
        const newFiles = [...prev]
        newFiles[index] = { ...newFiles[index], progress: 100 }
        return newFiles
      })

      // 公開URLを取得
      const { data: urlData } = supabase.storage
        .from('vegetable-photos')
        .getPublicUrl(storagePath)

      // データベースに写真情報を保存
      const photoData = {
        vegetable_id: vegetableId,
        operation_log_id: operationLogId || null,
        storage_path: storagePath,
        original_filename: file.name,
        file_size: file.size,
        mime_type: file.type,
        taken_at: new Date().toISOString(),
        description: description || null,
        tags: tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : null,
        created_by: null, // 認証未実装のためnull
        is_primary: false
      }

      const { error: dbError } = await supabase
        .from('photos')
        .insert(photoData)

      if (dbError) {
        
        
        alert(`データベース保存エラー: ${dbError.message}`)
        // アップロードされたファイルを削除
        await supabase.storage
          .from('vegetable-photos')
          .remove([storagePath])
        throw dbError
      }

      return { success: true, storagePath, publicUrl: urlData.publicUrl }

    } catch (error: any) {
      
      
      
      // エラー状態に更新
      setUploadingFiles(prev => {
        const newFiles = [...prev]
        newFiles[index] = { ...newFiles[index], uploading: false, progress: 0 }
        return newFiles
      })
      
      throw error
    }
  }

  const handleUploadAll = async () => {
    const filesToUpload = uploadingFiles.filter(f => !f.uploading && f.progress === 0)
    
    if (filesToUpload.length === 0) {
      return
    }

    try {
      const uploadPromises = uploadingFiles.map((file, index) => {
        if (!file.uploading && file.progress === 0) {
          return uploadFile(file, index)
        }
        return Promise.resolve(null)
      })

      await Promise.all(uploadPromises)
      
      // 成功時の処理
      alert(`${filesToUpload.length}枚の写真をアップロードしました！`)
      
      // 状態をリセット
      uploadingFiles.forEach(file => URL.revokeObjectURL(file.preview))
      setUploadingFiles([])
      setDescription('')
      setTags('')
      setIsOpen(false)
      
      // 親コンポーネントに通知
      onUploadSuccess?.()

    } catch (error) {
      alert('アップロードに失敗しました。もう一度お試しください。')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Camera className="w-4 h-4 mr-2" />
          写真追加
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
        <DialogHeader>
          <DialogTitle>写真をアップロード</DialogTitle>
          <DialogDescription>
            栽培の様子を写真で記録しましょう（最大10MB、複数選択可）
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* ファイル選択エリア */}
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition-colors bg-gray-50 hover:bg-gray-100"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                handleFileSelect(e.dataTransfer.files)
              }}
            >
              <ImageIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 mb-2">
                クリックまたはドラッグ＆ドロップで写真を追加
              </p>
              <p className="text-sm text-gray-400">
                JPG, PNG, WebP, GIF（最大10MB）
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
              />
            </div>
          </div>

          {/* 選択されたファイルのプレビュー */}
          {uploadingFiles.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-semibold">選択された写真</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {uploadingFiles.map((uploadingFile, index) => (
                  <Card key={index} className="relative">
                    <CardContent className="p-2">
                      <div className="aspect-square relative mb-2">
                        <Image
                          src={uploadingFile.preview}
                          alt={`プレビュー ${index + 1}`}
                          fill
                          className="object-cover rounded"
                        />
                        {!uploadingFile.uploading && (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="absolute top-1 right-1 h-6 w-6 p-0"
                            onClick={() => removeFile(index)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      
                      {uploadingFile.uploading && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            アップロード中...
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1">
                            <div 
                              className="bg-blue-500 h-1 rounded-full transition-all"
                              style={{ width: `${uploadingFile.progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                      
                      <p className="text-xs text-gray-600 truncate">
                        {uploadingFile.file.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {(uploadingFile.file.size / 1024 / 1024).toFixed(1)}MB
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* 説明・タグ入力 */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">説明（任意）</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="写真の説明を入力してください"
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="tags">タグ（任意）</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="花, 葉, 病気, 収穫 など（カンマ区切り）"
              />
            </div>
          </div>

          {/* アップロードボタン */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              キャンセル
            </Button>
            <Button 
              onClick={handleUploadAll}
              disabled={uploadingFiles.length === 0 || uploadingFiles.some(f => f.uploading)}
            >
              {uploadingFiles.some(f => f.uploading) ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  アップロード中...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  {uploadingFiles.length}枚をアップロード
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}