'use client'

import { useState } from 'react'
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Sprout, Users, BarChart3, Shield, Map, GanttChart } from "lucide-react"
import DemoFarmMapView from '@/components/demo/farm-map-view'

export default function Home() {
  const [showDemoFarmMap, setShowDemoFarmMap] = useState(false)
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sprout className="h-8 w-8 text-green-600" />
            <span className="text-xl font-bold text-gray-900">野菜栽培管理システム</span>
          </div>
          
          <nav className="hidden md:flex items-center space-x-6">
            <a href="#features" className="text-gray-600 hover:text-green-600 transition-colors">
              機能
            </a>
            <a href="#about" className="text-gray-600 hover:text-green-600 transition-colors">
              会社情報
            </a>
            <a href="#contact" className="text-gray-600 hover:text-green-600 transition-colors">
              お問い合わせ
            </a>
          </nav>

          <Link href="/login">
            <Button variant="default" className="bg-green-600 hover:bg-green-700 text-white">
              会員ログイン
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            栽培進捗を
            <span className="text-green-600">簡単・安全</span>
            に管理
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            契約企業様の野菜栽培進捗を一元管理。
            簡単な記録・共有システムで、効率的な農業経営をサポートします。
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login">
              <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white">
                システムにログイン
              </Button>
            </Link>
            <Button variant="outline" size="lg">
              サービス資料をダウンロード
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-white">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              主要機能
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              企業様の栽培管理業務を効率化する機能を豊富に搭載
            </p>
          </div>

          {/* デモ機能ボタン */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <Card className="border-2 border-green-500 bg-green-50 flex flex-col">
              <CardHeader className="flex-grow">
                <Map className="h-12 w-12 text-green-600 mb-4" />
                <CardTitle>栽培野菜・農地ポリゴン管理</CardTitle>
                <CardDescription>
                  作物ごとの進行状況をカレンダー・ガントチャート形式で視覚的に管理
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => setShowDemoFarmMap(true)}
                >
                  <Map className="mr-2 h-4 w-4 text-white" />
                  デモ機能を体験する
                </Button>
              </CardContent>
            </Card>

            <Card className="border-2 border-green-500 bg-green-50 flex flex-col">
              <CardHeader className="flex-grow">
                <GanttChart className="h-12 w-12 text-green-600 mb-4" />
                <CardTitle>栽培野菜スケジュール管理</CardTitle>
                <CardDescription>
                  日次作業と写真をかんたんアップロード。現場の状況を即座に共有
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/gantt-demo">
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                  >
                    <GanttChart className="mr-2 h-4 w-4 text-white" />
                    デモ機能を体験する
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="border-2 border-green-500 bg-green-50 flex flex-col">
              <CardHeader className="flex-grow">
                <BarChart3 className="h-12 w-12 text-green-600 mb-4" />
                <CardTitle>データ自動主計分析</CardTitle>
                <CardDescription>
                  投入肥料量、土壌データ、収穫量を自動でガントチャートに反映
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/analytics-demo">
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                  >
                    <BarChart3 className="mr-2 h-4 w-4 text-white" />
                    デモ機能を体験する
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-2 border-green-500 bg-green-50">
              <CardHeader>
                <Users className="h-12 w-12 text-green-600 mb-4" />
                <CardTitle>企業別管理</CardTitle>
                <CardDescription>
                  100社以上の契約企業データを安全に管理。権限設定も柔軟に対応
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 border-green-500 bg-green-50">
              <CardHeader>
                <Shield className="h-12 w-12 text-green-600 mb-4" />
                <CardTitle>セキュア認証</CardTitle>
                <CardDescription>
                  企業別ログインシステムで安全なデータアクセスを保証
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 border-green-500 bg-green-50">
              <CardHeader>
                <Sprout className="h-12 w-12 text-green-600 mb-4" />
                <CardTitle>AIアドバイス</CardTitle>
                <CardDescription>
                  栽培データに基づくAIチャットボットが最適な栽培アドバイスを提供
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 px-4 bg-green-50">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                会社情報
              </h2>
              <p className="text-gray-600 mb-6">
                私たちは、現代農業のDX化を支援する専門企業として、
                契約企業様の栽培データ管理と効率的な農業経営をサポートしています。
              </p>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900">ビジネスゴール</h3>
                  <p className="text-gray-600">
                    契約企業が自社で栽培する野菜の進捗を、簡単・安全に記録・共有できるポータルを提供し、
                    運営側は一元的なデータ管理とマーケティング用コンテンツ配信を実現する。
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">対象ユーザー</h3>
                  <p className="text-gray-600">
                    B2B企業様（初期100社、今後拡大予定）
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                お問い合わせ
              </h3>
              <div className="space-y-4 text-gray-600">
                <p>システム導入に関するご相談は、お気軽にお問い合わせください。</p>
                <div>
                  <strong>メール:</strong> contact@example.com
                </div>
                <div>
                  <strong>電話:</strong> 03-1234-5678
                </div>
                <div>
                  <strong>営業時間:</strong> 平日 9:00-18:00
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 px-4">
        <div className="container mx-auto text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Sprout className="h-6 w-6" />
            <span className="text-lg font-semibold">野菜栽培管理システム</span>
          </div>
          <p className="text-gray-400">
            © 2024 野菜栽培管理システム. All rights reserved.
          </p>
        </div>
      </footer>

      {/* デモ版農地管理ビュー */}
      {showDemoFarmMap && (
        <div className="fixed inset-0 z-50 bg-white">
          <DemoFarmMapView onClose={() => setShowDemoFarmMap(false)} />
        </div>
      )}
    </div>
  )
}
