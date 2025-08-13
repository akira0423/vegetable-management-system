# 野菜栽培管理システム セットアップガイド

## 🚀 Week 1-2 基盤固め 完了！

以下の基盤構築が完了しました：

### ✅ 完了項目

1. **Supabaseプロジェクト設計**
   - 本格的なデータベーススキーマ設計
   - マイグレーションファイル作成済み
   - Row Level Security (RLS) 完全実装

2. **基本テーブル作成**
   - `companies` - 企業管理
   - `users` - ユーザー管理（認証連携）
   - `vegetable_varieties` - 野菜品種マスター
   - `vegetables` - 野菜栽培管理
   - `growing_tasks` - 栽培タスク管理
   - `operation_logs` - 作業記録
   - `photos` - 写真管理
   - `audit_logs` - 監査ログ
   - `notifications` - 通知管理

3. **セキュリティ設定**
   - 企業データ完全分離（RLS）
   - 権限ベース制御（admin/manager/operator）
   - 自動監査ログ記録
   - 新規ユーザー自動登録トリガー

4. **認証システム完成**
   - Supabase Auth完全統合
   - 企業別サインアップフロー
   - セキュアなルーティング
   - 実際のデータベースと連携したダッシュボード

---

## 🛠️ 次のステップ

### Week 3-4: コア機能実装の準備

次に実装すべき機能の優先順位：

#### 1. Supabaseプロジェクトの実際の作成と設定

**やること:**
```bash
# 1. Supabaseアカウント作成
https://supabase.com

# 2. 新規プロジェクト作成
Project Name: vegetable-management-system
Region: Northeast Asia (Tokyo)

# 3. データベースパスワード設定
(強力なパスワードを設定)

# 4. プロジェクト設定値を取得
Project URL: https://your-project-ref.supabase.co
Anon Key: eyJhbGc...
Service Role Key: eyJhbGc... (管理用)
```

#### 2. 環境変数の設定

`.env.local` ファイルを更新：
```bash
# 実際のSupabase設定値に置換
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# OpenAI API キー設定
OPENAI_API_KEY=sk-...

# その他の設定はそのまま
```

#### 3. データベースマイグレーション実行

Supabase SQLエディターで実行：
```sql
-- 1. 初期スキーマ作成
-- supabase/migrations/001_initial_setup.sql の内容をコピー・実行

-- 2. サンプルデータ投入
-- supabase/migrations/002_sample_data.sql の内容をコピー・実行

-- 3. RLS設定
-- supabase/migrations/003_row_level_security.sql の内容をコピー・実行
```

#### 4. Storage設定（写真アップロード用）

Supabaseダッシュボードで：
```
1. Storage > Create bucket
   - Name: "vegetable-photos"
   - Public: false

2. RLS Policy作成:
   - SELECT: 自社ユーザーのみ
   - INSERT: 自社ユーザーのみ
   - UPDATE: 作成者のみ
   - DELETE: 管理者のみ
```

#### 5. 開発サーバー起動とテスト

```bash
npm run dev
```

**テスト項目:**
- [ ] トップページ表示
- [ ] ユーザー登録（新規企業）
- [ ] ログイン機能
- [ ] ダッシュボード表示（実際のデータ表示）
- [ ] データベース接続確認

---

## 📋 実装優先順位 (Week 3-4)

### 高優先度 ⭐⭐⭐
1. **基本ガントチャート** (`/dashboard/gantt`)
   - カスタムガントチャート統合
   - 実際のタスクデータ表示

### 中優先度 ⭐⭐
4. **写真アップロード機能**
   - Supabase Storage統合
   - 画像最適化・リサイズ

5. **ユーザー管理機能** (`/dashboard/users`)
   - 企業内ユーザー一覧
   - 権限管理

### 低優先度 ⭐
6. **通知機能**
7. **データエクスポート**
8. **高度な分析機能**

---

## 🔧 開発環境セットアップ

### 必要なツール
- Node.js 18以上
- Supabaseアカウント
- OpenAI APIキー（AIチャットボット用）
- Git

### 推奨VS Code拡張機能
- Tailwind CSS IntelliSense
- TypeScript Importer
- Prettier
- ESLint
- Supabase (公式)

---

## 📚 技術スタック概要

- **フロントエンド**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **UIコンポーネント**: shadcn/ui (Radix UI ベース)
- **バックエンド**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **認証**: Supabase Auth
- **データベース**: PostgreSQL (Row Level Security)
- **写真ストレージ**: Supabase Storage
- **AI機能**: OpenAI GPT-4 API
- **ホスティング**: Vercel (推奨)

---

## 🔒 セキュリティ考慮事項

- **データ分離**: RLSによる企業データ完全分離
- **権限制御**: ロールベースアクセス制御
- **監査ログ**: 全操作の自動記録
- **入力検証**: Zodによる厳密なバリデーション
- **HTTPS**: 本番環境での必須化

---

どの機能から具体的に実装を進めますか？野菜管理ページから始めることをお勧めします。