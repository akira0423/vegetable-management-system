import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'データ自動主計分析デモ | 野菜栽培管理システム',
  description: 'AI搭載の栽培データ分析機能をデモンストレーション。収益性分析、コスト管理、作業効率の可視化を体験できます。',
  keywords: '農業分析, データ分析, AI分析, 収益管理, コスト分析, 農業経営, デモ',
  openGraph: {
    title: 'データ自動主計分析デモ | 野菜栽培管理システム',
    description: 'AI搭載の栽培データ分析で経営を最適化。デモ版で全機能をお試しいただけます。',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'データ自動主計分析デモ'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'データ自動主計分析デモ',
    description: 'AI搭載の栽培データ分析機能をデモンストレーション'
  },
  robots: {
    index: true,
    follow: true
  }
}

export default function AnalyticsDemoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {children}
    </>
  )
}