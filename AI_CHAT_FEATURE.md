# AIチャット機能 - 将来の実装ガイド

## 📋 概要
農業専門のAIアシスタント機能。栽培相談、病害診断、施肥提案などを提供予定。

## 🗂️ 削除されたファイル
- `src/app/dashboard/ai-chat/page.tsx` - メインのチャットページ
- サイドバーナビゲーション内の「AIアドバイス」リンク

## 🔄 再導入手順

### 1. APIエンドポイント作成
```typescript
// src/app/api/ai-chat/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { message, context } = await request.json()
  
  // AI API統合（OpenAI/Claude/Gemini等）
  const response = await aiProvider.chat({
    messages: [
      { role: 'system', content: '農業専門AIアシスタント...' },
      { role: 'user', content: message }
    ],
    context: context // 野菜情報、土壌データ等
  })
  
  return NextResponse.json({ reply: response })
}
```

### 2. フロントエンドページ復活
```bash
mkdir src/app/dashboard/ai-chat
```

### 3. サイドバーメニューに追加
```typescript
// src/components/dashboard/sidebar.tsx
import { MessageSquare } from 'lucide-react' // インポート追加

const navigation = [
  // ... 他のメニュー
  {
    name: 'AIアドバイス',
    href: '/dashboard/ai-chat',
    icon: MessageSquare,
  },
  // ...
]
```

## 💰 推奨AI API

### 無料・低コスト選択肢
1. **Google Gemini API** (推奨)
   - 無料枠: 15万トークン/月
   - 農業知識豊富
   - コスト: $0.00125/1Kトークン

2. **OpenAI GPT-3.5 Turbo**
   - コスト: $0.002/1Kトークン
   - 安定した性能

3. **Ollama (ローカル)**
   - 完全無料
   - サーバー負荷高

### 実装時の推定コスト
- 月1000回利用 × 平均500トークン = 約$1-5/月

## 🌱 機能仕様

### 基本機能
- リアルタイムチャット
- 野菜データ連携
- 履歴管理
- 画像診断（病害虫）

### 専門分野
- 栽培技術相談
- 病害虫診断
- 施肥提案
- 収穫時期予測
- 土壌分析

## 📦 必要な追加パッケージ
```bash
npm install openai  # または @anthropic/sdk, @google/generative-ai
```

## 🔧 設定項目
```env
# .env.local
OPENAI_API_KEY=your_api_key_here
# または
GOOGLE_AI_API_KEY=your_api_key_here
ANTHROPIC_API_KEY=your_api_key_here
```

---
**削除日**: 2024年8月11日  
**理由**: 経済的考慮により一時的に削除  
**再導入予定**: 予算確保後