'use client'

import { useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, MapPin, Sprout, Calendar } from 'lucide-react'
import Link from 'next/link'
import PhotoUpload from '@/components/photo-upload'
import PhotoGallery from '@/components/photo-gallery'

const testVegetables: Record<string, any> = {
  'd1111111-1111-1111-1111-111111111111': {
    id: 'd1111111-1111-1111-1111-111111111111',
    name: 'A棟トマト（桃太郎）',
    variety_name: '桃太郎',
    plot_name: 'A棟温室',
    area_size: 100.0,
    plant_count: 50,
    planting_date: '2024-03-01',
    expected_harvest_start: '2024-06-10',
    expected_harvest_end: '2024-08-31',
    status: 'growing',
    variety: {
      name: 'トマト',
      variety: '桃太郎',
      category: '果菜類'
    }
  },
  'd2222222-2222-2222-2222-222222222222': {
    id: 'd2222222-2222-2222-2222-222222222222',
    name: 'B棟キュウリ（四葉）',
    variety_name: '四葉',
    plot_name: 'B棟温室',
    area_size: 80.0,
    plant_count: 40,
    planting_date: '2024-03-15',
    expected_harvest_start: '2024-05-20',
    expected_harvest_end: '2024-07-15',
    status: 'growing',
    variety: {
      name: 'キュウリ',
      variety: '四葉',
      category: '果菜類'
    }
  },
  'd3333333-3333-3333-3333-333333333333': {
    id: 'd3333333-3333-3333-3333-333333333333',
    name: '露地レタス（春作）',
    variety_name: 'グリーンリーフ',
    plot_name: '露地第1圃場',
    area_size: 200.0,
    plant_count: 200,
    planting_date: '2024-03-20',
    expected_harvest_start: '2024-05-10',
    expected_harvest_end: '2024-05-25',
    status: 'planning',
    variety: {
      name: 'レタス',
      variety: 'グリーンリーフ',
      category: '葉菜類'
    }
  }
}

const statusConfig = {
  planning: { label: '計画中', color: 'bg-gray-100 text-gray-800' },
  growing: { label: '栽培中', color: 'bg-green-100 text-green-800' },
  harvesting: { label: '収穫中', color: 'bg-orange-100 text-orange-800' },
  completed: { label: '完了', color: 'bg-blue-100 text-blue-800' }
}

export default function VegetableDetailPageSimple() {
  const params = useParams()
  const vegetableId = params.id as string
  
  const vegetable = testVegetables[vegetableId]

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP')
  }

  if (!vegetable) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="text-center py-12">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              野菜が見つかりません
            </h3>
            <Button asChild>
              <Link href="/vegetables">
                <ArrowLeft className="w-4 h-4 mr-2" />
                一覧に戻る
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      {/* ヘッダー */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="sm" asChild>
          <Link href="/vegetables">
            <ArrowLeft className="w-4 h-4 mr-2" />
            一覧に戻る
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{vegetable.name}</h1>
          <p className="text-gray-600">
            {vegetable.variety.name} - {vegetable.variety.variety} ({vegetable.variety.category})
          </p>
        </div>
        <div className="ml-auto">
          <Badge 
            className={statusConfig[vegetable.status as keyof typeof statusConfig]?.color}
            variant="secondary"
          >
            {statusConfig[vegetable.status as keyof typeof statusConfig]?.label}
          </Badge>
        </div>
      </div>

      {/* 基本情報カード */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">圃場・面積</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <MapPin className="w-4 h-4 mr-2 text-gray-500" />
              <span className="font-semibold">{vegetable.plot_name}</span>
            </div>
            <p className="text-2xl font-bold mt-1">{vegetable.area_size}㎡</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">株数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Sprout className="w-4 h-4 mr-2 text-green-500" />
              <span className="text-2xl font-bold">{vegetable.plant_count}株</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">植付日</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Calendar className="w-4 h-4 mr-2 text-blue-500" />
              <span className="font-semibold">{formatDate(vegetable.planting_date)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* タブ */}
      <Tabs defaultValue="info" className="space-y-6">
        <TabsList>
          <TabsTrigger value="info">基本情報</TabsTrigger>
          <TabsTrigger value="photos">写真</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>栽培情報</CardTitle>
              <CardDescription>{vegetable.variety.name}の栽培詳細</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">基本データ</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>品種:</span>
                      <span>{vegetable.variety.variety}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>分類:</span>
                      <span>{vegetable.variety.category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>面積:</span>
                      <span>{vegetable.area_size}㎡</span>
                    </div>
                    <div className="flex justify-between">
                      <span>株数:</span>
                      <span>{vegetable.plant_count}株</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">栽培日程</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>植付:</span>
                      <span>{formatDate(vegetable.planting_date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>収穫開始予定:</span>
                      <span>{formatDate(vegetable.expected_harvest_start)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>収穫終了予定:</span>
                      <span>{formatDate(vegetable.expected_harvest_end)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="photos" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">写真</h3>
            <PhotoUpload 
              vegetableId={vegetableId}
              onUploadSuccess={() => {
                // 写真一覧を再読み込み
                window.location.reload()
              }}
            />
          </div>
          
          <PhotoGallery 
            vegetableId={vegetableId}
            onPhotoDeleted={() => {
              console.log('Photo deleted')
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}