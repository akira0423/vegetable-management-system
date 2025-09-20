'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Share2, Users, Twitter, Facebook, Instagram, Download, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

interface PhotoData {
  id: string
  imageUrl: string
  caption: string
  cropName: string
  workDate: Date
  location?: string
  tags?: string[]
}

interface ShareButtonsProps {
  photoData: PhotoData
  onInternalShare?: (data: any) => Promise<void>
}

export default function ShareButtons({ photoData, onInternalShare }: ShareButtonsProps) {
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState<string>('')
  const [shareText, setShareText] = useState(photoData.caption)
  const [includeHashtags, setIncludeHashtags] = useState(true)
  const [isCopied, setIsCopied] = useState(false)
  const [isSharing, setIsSharing] = useState(false)

  const generateHashtags = () => {
    const tags = ['野菜栽培', '農業', photoData.cropName]
    if (photoData.tags) {
      tags.push(...photoData.tags)
    }
    return tags.map(tag => `#${tag}`).join(' ')
  }

  const getFullShareText = () => {
    return includeHashtags ? `${shareText}\n\n${generateHashtags()}` : shareText
  }

  const handleShare = async (platform: string) => {
    setSelectedPlatform(platform)

    if (platform === 'internal') {
      setShowShareDialog(true)
    } else if (platform === 'x') {
      shareToX()
    } else if (platform === 'facebook') {
      shareToFacebook()
    } else if (platform === 'instagram') {
      setShowShareDialog(true)
    }
  }

  const shareToX = () => {
    const text = getFullShareText()
    const url = `${window.location.origin}/gallery/${photoData.id}`

    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      '_blank',
      'width=550,height=420'
    )

    toast.success('X（Twitter）の共有画面を開きました')
  }

  const shareToFacebook = () => {
    const url = `${window.location.origin}/gallery/${photoData.id}`

    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(getFullShareText())}`,
      '_blank',
      'width=550,height=420'
    )

    toast.success('Facebookの共有画面を開きました')
  }

  const handleInternalShare = async () => {
    if (!onInternalShare) return

    setIsSharing(true)
    try {
      await onInternalShare({
        content: shareText,
        hashtags: includeHashtags ? generateHashtags() : '',
        photoData: photoData
      })
      toast.success('内部SNSに投稿しました')
      setShowShareDialog(false)
    } catch (error) {
      toast.error('投稿に失敗しました')
    } finally {
      setIsSharing(false)
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(getFullShareText())
      setIsCopied(true)
      toast.success('キャプションをコピーしました')
      setTimeout(() => setIsCopied(false), 2000)
    } catch (error) {
      toast.error('コピーに失敗しました')
    }
  }

  const downloadImage = async () => {
    try {
      const response = await fetch(photoData.imageUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${photoData.cropName}_${photoData.workDate}.jpg`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast.success('画像をダウンロードしました')
    } catch (error) {
      toast.error('ダウンロードに失敗しました')
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Share2 className="h-4 w-4" />
            共有
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleShare('internal')}>
            <Users className="mr-2 h-4 w-4" />
            内部SNSに投稿
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShare('x')}>
            <Twitter className="mr-2 h-4 w-4" />
            Xに共有
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShare('facebook')}>
            <Facebook className="mr-2 h-4 w-4" />
            Facebookに共有
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShare('instagram')}>
            <Instagram className="mr-2 h-4 w-4" />
            Instagramに共有
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>
              {selectedPlatform === 'internal' ? '内部SNSに投稿' : 'Instagramに共有'}
            </DialogTitle>
            <DialogDescription>
              {selectedPlatform === 'internal'
                ? '作業記録を内部SNSに共有します'
                : '画像とキャプションを準備します'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedPlatform === 'internal' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="share-text">投稿内容</Label>
                  <Textarea
                    id="share-text"
                    value={shareText}
                    onChange={(e) => setShareText(e.target.value)}
                    placeholder="投稿内容を入力..."
                    className="min-h-[100px]"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="hashtags"
                    checked={includeHashtags}
                    onCheckedChange={setIncludeHashtags}
                  />
                  <Label htmlFor="hashtags">
                    ハッシュタグを含める
                  </Label>
                </div>

                {includeHashtags && (
                  <div className="text-sm text-muted-foreground">
                    {generateHashtags()}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm mb-2">Instagramへの共有手順：</p>
                  <ol className="text-sm space-y-1 list-decimal list-inside">
                    <li>下記のボタンで画像をダウンロード</li>
                    <li>キャプションをコピー</li>
                    <li>Instagramアプリで投稿</li>
                  </ol>
                </div>

                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-2">キャプション：</p>
                  <p className="text-sm whitespace-pre-wrap">{getFullShareText()}</p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={downloadImage}
                    className="flex-1"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    画像をダウンロード
                  </Button>
                  <Button
                    variant="outline"
                    onClick={copyToClipboard}
                    className="flex-1"
                  >
                    {isCopied ? (
                      <Check className="mr-2 h-4 w-4" />
                    ) : (
                      <Copy className="mr-2 h-4 w-4" />
                    )}
                    {isCopied ? 'コピー済み' : 'キャプションをコピー'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            {selectedPlatform === 'internal' ? (
              <>
                <Button variant="outline" onClick={() => setShowShareDialog(false)}>
                  キャンセル
                </Button>
                <Button onClick={handleInternalShare} disabled={isSharing}>
                  {isSharing ? '投稿中...' : '投稿する'}
                </Button>
              </>
            ) : (
              <Button onClick={() => setShowShareDialog(false)}>
                閉じる
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}