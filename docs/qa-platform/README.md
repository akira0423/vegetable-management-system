# 📚 Q&Aプラットフォーム ドキュメント一覧

## 🎯 プロジェクト概要

懸賞金型Q&Aプラットフォームの設計・実装ドキュメント集です。
既存の農業管理システムに追加する形で実装し、完全に独立した設計により、いつでも安全に切り離し可能です。

## 📊 現在のステータス

**フェーズ:** 設計完了・実装未着手
**進捗率:** 20%（設計フェーズのみ完了）
**最終更新:** 2025年9月22日

詳細は → **[`IMPLEMENTATION-STATUS.md`](./IMPLEMENTATION-STATUS.md)**

## 📁 ドキュメント構成

### 🔴 必読ドキュメント（優先度：高）

| ドキュメント | 説明 | 対象者 |
|-------------|------|--------|
| **[`IMPLEMENTATION-STATUS.md`](./IMPLEMENTATION-STATUS.md)** | 📊 **実装状況・進捗管理** | 全員 |
| **[`implementation-plan.md`](./implementation-plan.md)** | 📐 **実装計画書**（スケジュール、アーキテクチャ） | PM、開発者 |
| **[`user-journey-guide.md`](./user-journey-guide.md)** | 👥 **ユーザー体験ガイド**（画面イメージ、フロー） | 全員 |

### 🟡 技術仕様書（優先度：中）

| ドキュメント | 説明 | 対象者 |
|-------------|------|--------|
| **[`database-schema.sql`](./database-schema.sql)** | 💾 データベース設計（テーブル定義） | バックエンド開発者 |
| **[`api-specification.md`](./api-specification.md)** | 🔌 API仕様書（エンドポイント定義） | フロント・バック開発者 |

### 🟢 運用・保守（優先度：後）

| ドキュメント | 説明 | 対象者 |
|-------------|------|--------|
| **[`isolation-strategy.md`](./isolation-strategy.md)** | 🔒 分離戦略（既存システムとの独立性） | アーキテクト |
| **[`REMOVAL-MANUAL.md`](./REMOVAL-MANUAL.md)** | 🔧 切り離しマニュアル | 運用担当者 |
| **[`remove-qa-platform.ps1`](./remove-qa-platform.ps1)** | 🖥️ Windows用削除スクリプト | 運用担当者 |
| **[`remove-qa-platform.sh`](./remove-qa-platform.sh)** | 🐧 Mac/Linux用削除スクリプト | 運用担当者 |

## 🚀 クイックスタート

### 1. 現状を把握する

```bash
# 実装状況を確認
cat docs/qa-platform/IMPLEMENTATION-STATUS.md
```

### 2. 設計を理解する

1. **ユーザー視点** → [`user-journey-guide.md`](./user-journey-guide.md) を読む
2. **技術視点** → [`implementation-plan.md`](./implementation-plan.md) を読む
3. **データ構造** → [`database-schema.sql`](./database-schema.sql) を確認

### 3. 実装を開始する

```bash
# 環境変数設定
echo "QA_ENABLE_PLATFORM=true" >> .env.local

# 必要なディレクトリ作成
mkdir -p src/app/qa
mkdir -p src/components/qa
mkdir -p src/lib/qa

# データベース構築
supabase migration new qa_platform_initial
# database-schema.sql の内容をコピー
```

## 📋 実装チェックリスト

### Phase 1: 基盤構築（2-3週間）
- [ ] Supabaseスキーマ作成
- [ ] Stripe Connect設定
- [ ] 基本API実装
- [ ] 認証フロー拡張

### Phase 2: 主要機能（2週間）
- [ ] 質問投稿機能
- [ ] 回答機能
- [ ] 決済フロー
- [ ] ウォレット管理

### Phase 3: 運用機能（2週間）
- [ ] 管理画面
- [ ] 請求書発行
- [ ] 出金処理
- [ ] セキュリティ強化

## 🔑 重要な設計原則

### ✅ 完全分離設計
- すべてのテーブルに `qa_` プレフィックス
- 独立したAPIパス `/api/qa/`
- 環境変数でON/OFF可能

### ✅ 既存システムへの影響ゼロ
- 既存テーブル変更なし
- 既存機能への依存なし
- 15分で完全削除可能

### ✅ セキュリティ重視
- Row Level Security必須
- エスクロー決済
- 監査ログ完備

## 🛠️ 開発環境セットアップ

```bash
# 1. Stripe CLIインストール
brew install stripe/stripe-cli/stripe  # Mac
# または https://stripe.com/docs/stripe-cli

# 2. Stripe Connectアカウント作成
# https://dashboard.stripe.com/connect

# 3. 環境変数設定
cat >> .env.local << EOF
QA_ENABLE_PLATFORM=true
QA_STRIPE_SECRET_KEY=sk_test_xxx
QA_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
QA_STRIPE_WEBHOOK_SECRET=whsec_xxx
EOF

# 4. 依存パッケージインストール
npm install stripe @stripe/stripe-js
npm install @react-pdf/renderer

# 5. データベース構築
supabase db push
```

## 📊 進捗確認方法

### 日次確認
```bash
# 実装状況の確認
cat docs/qa-platform/IMPLEMENTATION-STATUS.md | grep "進捗率"

# TODOリストの確認
grep -r "TODO" src/app/qa src/components/qa src/lib/qa
```

### 週次レビュー
- [ ] IMPLEMENTATION-STATUS.md の更新
- [ ] 実装済み機能のテスト
- [ ] 次週のタスク確認

## 🔗 関連リンク

### 内部リソース
- [既存システムドキュメント](../../README.md)
- [Supabaseダッシュボード](https://app.supabase.com)

### 外部リソース
- [Stripe Connect](https://stripe.com/docs/connect)
- [Supabase Docs](https://supabase.com/docs)
- [Next.js Docs](https://nextjs.org/docs)
- [適格請求書について](https://www.nta.go.jp/taxes/shiraberu/zeimokubetsu/shohi/keigenzeiritsu/invoice.htm)

## 👥 連絡先

| 役割 | 担当 | 備考 |
|------|------|------|
| プロジェクト責任者 | - | 全体統括 |
| 技術リード | - | アーキテクチャ決定 |
| フロントエンド | - | UI/UX実装 |
| バックエンド | - | API・DB実装 |
| QA | - | テスト実施 |

## 📝 ドキュメント更新ルール

1. **実装開始時** → IMPLEMENTATION-STATUS.md を更新
2. **機能完成時** → 該当ドキュメントに完了マーク追加
3. **仕様変更時** → 関連するすべてのドキュメントを更新
4. **週次** → 進捗率を更新

## ⚠️ 注意事項

- **本番環境での作業前に必ずバックアップ**
- **Stripe APIキーは絶対にコミットしない**
- **qa_ プレフィックスを必ず使用**
- **既存テーブルは絶対に変更しない**

---

**質問・不明点がある場合:**
1. まず関連ドキュメントを確認
2. IMPLEMENTATION-STATUS.md で現状確認
3. 担当者に連絡

*最終更新: 2025年9月22日*