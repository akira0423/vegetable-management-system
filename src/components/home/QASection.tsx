'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { HelpCircle, MessageCircle, TrendingUp, Award, Clock, Users } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ja } from 'date-fns/locale'

interface Question {
  id: string
  title: string
  body?: string
  bounty_amount: number
  status: 'DRAFT' | 'PENDING_PAYMENT' | 'FUNDED' | 'ANSWERING' | 'BEST_SELECTED' | 'RESOLVED' | 'EXPIRED' | 'CANCELLED' | 'REFUNDED'
  answer_count: number
  created_at: string
  deadline_at?: string
  category?: string
  tags?: string[]
  asker?: {
    display_name?: string
  }
}

export default function QASection() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 質問データを取得
    fetchQuestions()
  }, [])

  const fetchQuestions = async () => {
    try {
      const response = await fetch('/api/questions?limit=6&status=ANSWERING,BEST_SELECTED,RESOLVED')
      if (response.ok) {
        const data = await response.json()
        setQuestions(data.questions || [])
      }
    } catch (error) {
      console.error('Failed to fetch questions:', error)
      // デモデータを表示
      setQuestions(getDemoQuestions())
    } finally {
      setLoading(false)
    }
  }

  const getDemoQuestions = (): Question[] => [
    {
      id: '1',
      title: 'トマトのうどんこ病、有機栽培での緊急対策を教えてください',
      bounty_amount: 500,
      status: 'ANSWERING',
      answer_count: 3,
      created_at: new Date(Date.now() - 86400000).toISOString(),
      category: '病害虫対策',
      tags: ['トマト', 'うどんこ病', '有機栽培'],
      asker: { display_name: '田中農園' }
    },
    {
      id: '2',
      title: 'ナスの連作障害を改善する効果的な方法',
      bounty_amount: 1000,
      status: 'RESOLVED',
      answer_count: 5,
      created_at: new Date(Date.now() - 172800000).toISOString(),
      category: '土壌管理',
      tags: ['ナス', '連作障害', '土壌改良'],
      asker: { display_name: '山田ファーム' }
    },
    {
      id: '3',
      title: 'キャベツの害虫対策（オーガニック）でおすすめの方法',
      bounty_amount: 300,
      status: 'ANSWERING',
      answer_count: 2,
      created_at: new Date(Date.now() - 259200000).toISOString(),
      category: '病害虫対策',
      tags: ['キャベツ', '害虫', 'オーガニック'],
      asker: { display_name: '鈴木農場' }
    },
    {
      id: '4',
      title: '水稲の収量を上げるための施肥管理について',
      bounty_amount: 800,
      status: 'BEST_SELECTED',
      answer_count: 4,
      created_at: new Date(Date.now() - 345600000).toISOString(),
      category: '施肥管理',
      tags: ['水稲', '施肥', '収量向上'],
      asker: { display_name: '佐藤農園' }
    },
    {
      id: '5',
      title: 'イチゴのハウス栽培での温度管理のコツ',
      bounty_amount: 600,
      status: 'ANSWERING',
      answer_count: 1,
      created_at: new Date(Date.now() - 432000000).toISOString(),
      category: '栽培技術',
      tags: ['イチゴ', 'ハウス栽培', '温度管理'],
      asker: { display_name: '高橋農園' }
    },
    {
      id: '6',
      title: '有機JAS認証取得の手順と必要書類について',
      bounty_amount: 1500,
      status: 'RESOLVED',
      answer_count: 7,
      created_at: new Date(Date.now() - 518400000).toISOString(),
      category: '認証・規格',
      tags: ['有機JAS', '認証', '書類'],
      asker: { display_name: '伊藤オーガニック' }
    }
  ]

  const getStatusBadge = (status: Question['status']) => {
    switch (status) {
      case 'ANSWERING':
        return <Badge className="bg-blue-500 text-white">回答募集中</Badge>
      case 'BEST_SELECTED':
      case 'RESOLVED':
        return <Badge className="bg-green-500 text-white">解決済み</Badge>
      default:
        return null
    }
  }

  const formatBounty = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount)
  }

  return (
    <section id="qa" className="py-20 px-4 bg-gradient-to-b from-white to-green-50">
      <div className="container mx-auto">
        {/* セクションヘッダー */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <HelpCircle className="h-12 w-12 text-green-600" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            農業の疑問を
            <span className="text-green-600">みんなで解決</span>
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            専門家や経験豊富な農家が、あなたの質問に回答します。
            懸賞金付きの質問で、より質の高い回答を得られます。
          </p>
        </div>

        {/* 統計情報 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <Card className="text-center">
            <CardContent className="pt-6">
              <Users className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="text-2xl font-bold">1,234</p>
              <p className="text-sm text-gray-600">アクティブユーザー</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <MessageCircle className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <p className="text-2xl font-bold">5,678</p>
              <p className="text-sm text-gray-600">解決済み質問</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <Award className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
              <p className="text-2xl font-bold">89%</p>
              <p className="text-sm text-gray-600">解決率</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <Clock className="h-8 w-8 text-purple-600 mx-auto mb-2" />
              <p className="text-2xl font-bold">3時間</p>
              <p className="text-sm text-gray-600">平均回答時間</p>
            </CardContent>
          </Card>
        </div>

        {/* 質問カード */}
        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {questions.map((question) => (
              <Link href={`/questions/${question.id}`} key={question.id}>
                <Card className="hover:shadow-lg transition-shadow duration-200 cursor-pointer h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        {getStatusBadge(question.status)}
                      </div>
                      <span className="text-lg font-bold text-green-600">
                        {formatBounty(question.bounty_amount)}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900 line-clamp-2">
                      {question.title}
                    </h3>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {question.tags?.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <MessageCircle className="h-4 w-4" />
                        <span>{question.answer_count} 回答</span>
                      </div>
                      <span>
                        {formatDistanceToNow(new Date(question.created_at), {
                          addSuffix: true,
                          locale: ja
                        })}
                      </span>
                    </div>
                    {question.asker?.display_name && (
                      <div className="mt-2 text-xs text-gray-500">
                        質問者: {question.asker.display_name}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* CTA ボタン */}
        <div className="text-center">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/questions">
              <Button size="lg" variant="outline" className="min-w-[200px]">
                <MessageCircle className="mr-2 h-5 w-5" />
                すべての質問を見る
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white min-w-[200px]">
                <TrendingUp className="mr-2 h-5 w-5" />
                質問を投稿する
              </Button>
            </Link>
          </div>
          <p className="text-sm text-gray-600 mt-4">
            質問の投稿には会員登録（無料）が必要です
          </p>
        </div>
      </div>
    </section>
  )
}