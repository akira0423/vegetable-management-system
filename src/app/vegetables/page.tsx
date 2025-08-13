'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CalendarDays, MapPin, Sprout, Plus, Eye } from 'lucide-react'
import Link from 'next/link'

interface Vegetable {
  id: string
  name: string
  variety_name: string
  plot_name: string
  area_size: number
  plant_count: number
  planting_date: string
  expected_harvest_start: string
  expected_harvest_end: string
  status: 'planning' | 'growing' | 'harvesting' | 'completed' | 'cancelled'
  variety: {
    name: string
    variety: string
    category: string
  }
}

const statusConfig = {
  planning: { label: '計画中', color: 'bg-gray-100 text-gray-800' },
  growing: { label: '栽培中', color: 'bg-green-100 text-green-800' },
  harvesting: { label: '収穫中', color: 'bg-orange-100 text-orange-800' },
  completed: { label: '完了', color: 'bg-blue-100 text-blue-800' },
  cancelled: { label: '中止', color: 'bg-red-100 text red-800' }
}

export default function VegetablesPage() {
  const [vegetables, setVegetables] = useState<Vegetable[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchVegetables()
  }, [])

  async function fetchVegetables() {
    // テスト用のサンプルデータ（常に表示）
    const testData = [
      {
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
      {
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
      {
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
    ]

    try {
      const { data, error } = await supabase
        .from('vegetables')
        .select(`
          *,
          variety:vegetable_varieties(
            name,
            variety,
            category
          )
        `)
        .order('planting_date', { ascending: false })

      if (error || !data || data.length === 0) {
        console.log('データベースデータが取得できないため、テストデータを表示します')
        setVegetables(testData)
        return
      }

      // データベースデータとテストデータを結合
      setVegetables([...data, ...testData])
    } catch (error) {
      console.error('予期しないエラー:', error)
      setVegetables(testData)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP')
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">野菜管理</h1>
          <p className="text-gray-600 mt-1">栽培中の野菜一覧と管理</p>
        </div>
        <Button asChild>
          <Link href="/vegetables/new">
            <Plus className="w-4 h-4 mr-2" />
            新しい野菜を追加
          </Link>
        </Button>
      </div>

      {vegetables.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Sprout className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              野菜が登録されていません
            </h3>
            <p className="text-gray-600 mb-4">
              最初の野菜を登録して栽培管理を始めましょう
            </p>
            <Button asChild>
              <Link href="/vegetables/new">
                <Plus className="w-4 h-4 mr-2" />
                新しい野菜を追加
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vegetables.map((vegetable) => (
            <Card key={vegetable.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{vegetable.name}</CardTitle>
                    <CardDescription>
                      {vegetable.variety?.name} - {vegetable.variety?.variety}
                    </CardDescription>
                  </div>
                  <Badge 
                    className={statusConfig[vegetable.status]?.color}
                    variant="secondary"
                  >
                    {statusConfig[vegetable.status]?.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center text-sm text-gray-600">
                  <MapPin className="w-4 h-4 mr-2" />
                  {vegetable.plot_name} ({vegetable.area_size}㎡)
                </div>
                
                <div className="flex items-center text-sm text-gray-600">
                  <Sprout className="w-4 h-4 mr-2" />
                  {vegetable.plant_count}株
                </div>
                
                <div className="flex items-center text-sm text-gray-600">
                  <CalendarDays className="w-4 h-4 mr-2" />
                  植付: {formatDate(vegetable.planting_date)}
                </div>
                
                {vegetable.expected_harvest_start && (
                  <div className="text-sm text-gray-600 pl-6">
                    収穫予定: {formatDate(vegetable.expected_harvest_start)} 〜 
                    {formatDate(vegetable.expected_harvest_end)}
                  </div>
                )}
                
                <div className="pt-2">
                  <Badge variant="outline" className="text-xs">
                    {vegetable.variety?.category}
                  </Badge>
                </div>
                
                <div className="pt-3 space-y-2">
                  <Button asChild size="sm" className="w-full" variant="outline">
                    <Link href="/test-photo">
                      <Eye className="w-4 h-4 mr-2" />
                      写真管理
                    </Link>
                  </Button>
                  <Button asChild size="sm" className="w-full" disabled>
                    <Link href={`/vegetables/${vegetable.id}`}>
                      <Eye className="w-4 h-4 mr-2" />
                      詳細（準備中）
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}