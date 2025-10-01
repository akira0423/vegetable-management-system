# 🔄 Q&Aプラットフォーム 作業再開ガイド

## 📋 このガイドの目的

Claude Codeで作業を中断した後、別のセッションで作業を再開する際の依頼方法を示します。

## 🎯 作業再開時の依頼例

### 1️⃣ 実装フェーズを開始する場合

```markdown
Q&Aプラットフォームの実装を開始したいです。

現在の状況：
- 設計フェーズ完了（docs/qa-platform/に全ドキュメント保存済み）
- データベース設計: supabase-complete-schema.sql (Version 3.0.0)
- 進捗: 20%（IMPLEMENTATION-STATUS.md参照）

次のステップ：
1. Supabaseマイグレーションファイルの作成
2. docs/qa-platform/supabase-complete-schema.sqlの内容をマイグレーションとして実行

まずデータベースを構築してください。
```

### 2️⃣ 特定の機能を実装する場合

```markdown
Q&Aプラットフォームの質問投稿APIを実装してください。

参照ドキュメント：
- API仕様: docs/qa-platform/api-specification.md の「3.1 質問投稿」
- DB設計: docs/qa-platform/supabase-complete-schema.sql

実装内容：
- POST /api/qa/questions エンドポイント
- エスクロー決済（Stripe PaymentIntent）
- 懸賞金は最低10円、プラットフォーム手数料10%

src/app/api/qa/questions/route.ts を作成してください。
```

### 3️⃣ 進捗確認と次のタスク選択

```markdown
Q&Aプラットフォームの現在の実装状況を確認して、次に実施すべきタスクを提案してください。

確認ファイル：
- docs/qa-platform/IMPLEMENTATION-STATUS.md
- docs/qa-platform/implementation-plan.md

未実装の中で優先度が高いものから着手したいです。
```

### 4️⃣ フロントエンド開発

```markdown
Q&Aプラットフォームの質問一覧画面を実装してください。

参照：
- UXガイド: docs/qa-platform/user-journey-guide.md の「質問一覧画面」
- API仕様: docs/qa-platform/api-specification.md

実装要件：
- 無限スクロール対応
- リアルタイム更新（新着質問）
- フィルター機能（ステータス、カテゴリ、懸賞金額）

src/app/qa/page.tsx を作成してください。
```

### 5️⃣ Stripe Connect統合

```markdown
Q&AプラットフォームのStripe Connect統合を実装してください。

参照：
- implementation-plan.mdの「Phase 3: 決済システム」
- 既存のStripe設定確認

実装内容：
1. アカウント連携フロー（/api/qa/stripe/connect）
2. オンボーディング完了確認
3. 適格請求書対応

.env.localにSTRIPE_CONNECT_CLIENT_IDが必要です。
```

### 6️⃣ トラブルシューティング

```markdown
Q&Aプラットフォームでパフォーマンス問題が発生しています。

症状：
- 質問一覧の表示に3秒かかる
- 同時接続1000ユーザーでタイムアウト

関連ファイル：
- docs/qa-platform/supabase-migration-guide.md（チューニングパラメータ）
- docs/qa-platform/supabase-complete-schema.sql（インデックス設計）

パフォーマンス改善方法を提案してください。
```

### 7️⃣ テスト実装

```markdown
Q&Aプラットフォームのテストを実装してください。

テスト対象：
- エスクロー決済フロー
- PPV購入フロー
- ウォレット残高管理

テストファイル作成：
- __tests__/qa/escrow.test.ts
- __tests__/qa/ppv.test.ts
- __tests__/qa/wallet.test.ts

JestとSupabase Test Helpersを使用してください。
```

### 8️⃣ デプロイ準備

```markdown
Q&Aプラットフォームの本番デプロイ準備をしてください。

チェックリスト：
- [ ] 環境変数の確認（.env.production）
- [ ] Supabase本番環境へのマイグレーション
- [ ] Stripe本番キーの設定
- [ ] パフォーマンステスト実施
- [ ] ロールバック手順の確認

docs/qa-platform/deployment-checklist.md を作成してください。
```

### 9️⃣ 機能削除（緊急時）

```markdown
Q&Aプラットフォームを完全に削除する必要があります。

参照：
- docs/qa-platform/REMOVAL-MANUAL.md

削除スクリプトを実行して、15分以内に全機能を無効化してください。
バックアップも取得してください。
```

## 💡 効果的な依頼のコツ

### ✅ 良い依頼例の特徴

1. **現在の状況を明確に伝える**
   - どこまで完了しているか
   - どのファイルが関連するか

2. **具体的な成果物を指定**
   - 作成するファイルパス
   - 実装する機能の範囲

3. **参照すべきドキュメントを明示**
   - 既存の設計書
   - API仕様書

### ❌ 避けるべき依頼

```markdown
# 曖昧すぎる例
「Q&Aの続きをやって」

# コンテキスト不足の例
「APIを作って」

# 範囲が広すぎる例
「全部実装して」
```

## 📂 重要ファイルの場所

| カテゴリ | ファイル | 内容 |
|---------|---------|------|
| **現状把握** | `IMPLEMENTATION-STATUS.md` | 進捗管理 |
| **設計** | `supabase-complete-schema.sql` | DB設計 |
| **手順** | `supabase-migration-guide.md` | 構築手順 |
| **計画** | `implementation-plan.md` | 全体計画 |
| **API** | `api-specification.md` | API仕様 |
| **UX** | `user-journey-guide.md` | 画面設計 |
| **削除** | `REMOVAL-MANUAL.md` | 削除手順 |

## 🔍 状況確認コマンド

```bash
# ファイル構成の確認
ls -la docs/qa-platform/

# 進捗状況の確認
cat docs/qa-platform/IMPLEMENTATION-STATUS.md

# DBマイグレーション状態の確認
supabase migration list

# 環境変数の確認（秘密情報は伏せる）
cat .env.local | grep -E "STRIPE|SUPABASE" | sed 's/=.*/=***/'
```

## 🚀 クイックスタート

最も一般的な再開パターン：

```markdown
Q&Aプラットフォームの実装を継続します。
まず docs/qa-platform/IMPLEMENTATION-STATUS.md を確認して、
次に実施すべきタスクを教えてください。
その後、そのタスクを実装してください。
```

---

**最終更新:** 2025-09-22
**バージョン:** 1.0.0