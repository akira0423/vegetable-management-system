import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'デモ版 - 栽培野菜スケジュール管理',
  description: '栽培野菜の進行状況をガントチャート形式で管理するデモンストレーション',
}

export default function GanttDemoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // デモページ専用のレイアウト
  // サイドバーなし、ヘッダーなし、完全に独立したページ
  return <>{children}</>
}