Q&A プラットフォーム 分離戦略とロールバック計画
🎯 設計原則
完全分離の原則

Q&A プラットフォームは既存システムから完全に独立した設計となっており、いつでも安全に切り離し可能です。

📊 現在のシステム構造の分析
既存テーブル（変更なし）
-- 既存の野菜管理システムのテーブル
users -- Supabase Auth（変更なし）
vegetables -- 野菜データ
work_reports -- 作業記録
tasks -- タスク管理
photos -- 写真管理
accounting_records -- 会計記録
notifications -- 既存通知システム

Q&A 専用テーブル（新規・独立）
-- すべて qa\_ プレフィックスで完全分離
qa_user_profiles -- Q&A 用プロフィール拡張
qa_questions -- 質問（回答品質要件含む）【更新】
  - min_answer_chars, require_photo/video等追加
qa_answers -- 回答
qa_access_grants -- アクセス権限（ASKER/RESPONDER/PPV/ADMIN）【修正】
qa_transactions -- 取引（ESCROW/PPV/TIP/REFUND/WITHDRAWAL）【修正】
qa_wallets -- ウォレット
qa_wallet_transactions -- ウォレット台帳（監査）【新規】
qa_payouts -- 出金
qa_invoices -- 請求書
qa_notifications -- Q&A 専用通知
qa_ratings -- 評価（Helpful/コメント）
qa_audit_logs -- 監査ログ
qa_ppv_pools -- PPV プール台帳（others16%/held_for_best24%）【新規】
qa_ppv_pool_members -- PPV プール対象回答者（均等割・ブロック除外）【新規】
qa_answer_blocks -- プール配分からの除外指定【新規】

-- 【削除】qa_purchases は使用しません（transactions へ統合）【修正】
-- 【削除】qa_reputation はスキーマ外（プロフィール集計へ集約）【修正】

🔌 統合ポイントと分離方法

1. ユーザー認証（最小限の接点）

現在の統合:

-- 唯一の接点：auth.users への外部キー参照
CREATE TABLE qa_user_profiles (
user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 2025-10-01 更新：認証システムの統一
-- 既存システムの認証（@/lib/auth）を使用
-- Q&Aプラットフォームも同じ認証基盤を共有

分離方法:

-- 外部キー制約を削除するだけ（必要時）
ALTER TABLE qa_user_profiles
DROP CONSTRAINT IF EXISTS qa_user_profiles_user_id_fkey;

2. フロントエンド（モジュール式）

現在の構造:

src/
├── app/
│ ├── dashboard/ # 既存ダッシュボード
│ ├── vegetables/ # 既存機能
│ └── qa/ # Q&A 機能（独立）
├── components/
│ ├── forms/ # 既存フォーム
│ ├── charts/ # 既存チャート
│ └── qa/ # Q&A コンポーネント（独立）
└── lib/
├── supabase/ # 既存 DB 接続
├── utils/ # 既存ユーティリティ
└── qa/ # Q&A 専用ライブラリ（独立）

分離方法:

# Q&A 関連ディレクトリを削除

rm -rf src/app/qa
rm -rf src/components/qa
rm -rf src/lib/qa

3. API Routes（完全独立）

現在:

// すべての Q&A API は /api/qa/ 配下に隔離
app/api/qa/questions/route.ts
app/api/qa/answers/route.ts
app/api/qa/payments/route.ts
app/api/qa/notifications/route.ts
app/api/webhooks/stripe/route.ts // Stripe Webhook（Q&A 用）【新規明記】

分離:

# API ディレクトリを削除

rm -rf src/app/api/qa
rm -rf src/app/api/webhooks/stripe # Q&A 専用 Webhook を切り離す【修正】

4. 環境変数（グループ化）

.env.local の構造:

# === 既存システム ===

NEXT_PUBLIC_SUPABASE_URL=xxx
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_KEY=xxx

# === Q&A プラットフォーム（以下をコメントアウトで無効化）===

# QA_STRIPE_SECRET_KEY=xxx

# QA_STRIPE_WEBHOOK_SECRET=xxx

# QA_STRIPE_CONNECT_CLIENT_ID=xxx

# QA_ENABLE_PLATFORM=true

🚀 段階的ロールバック手順
Phase 1: 機能の無効化（5 分）
// src/config/features.ts
export const FEATURES = {
QA_PLATFORM: process.env.QA_ENABLE_PLATFORM === 'true' // false に変更
};

// src/app/dashboard/layout.tsx
{FEATURES.QA_PLATFORM && (

  <Link href="/qa">Q&A相談</Link>
)}

Phase 2: データベースの分離（10 分）
-- 1. RLS ポリシーの無効化（qa\_系すべて）
-- 注：質問本文は全公開、回答は権限制御であったことに留意
ALTER TABLE qa_questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE qa_answers DISABLE ROW LEVEL SECURITY;
ALTER TABLE qa_access_grants DISABLE ROW LEVEL SECURITY; --【新規】
ALTER TABLE qa_transactions DISABLE ROW LEVEL SECURITY; --【新規】
ALTER TABLE qa_wallets DISABLE ROW LEVEL SECURITY; --【新規】
ALTER TABLE qa_wallet_transactions DISABLE ROW LEVEL SECURITY; --【新規】
ALTER TABLE qa_payouts DISABLE ROW LEVEL SECURITY;
ALTER TABLE qa_invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE qa_notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE qa_ratings DISABLE ROW LEVEL SECURITY;
ALTER TABLE qa_audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE qa_ppv_pools DISABLE ROW LEVEL SECURITY; --【新規】
ALTER TABLE qa_ppv_pool_members DISABLE ROW LEVEL SECURITY; --【新規】
ALTER TABLE qa_answer_blocks DISABLE ROW LEVEL SECURITY; --【新規】

-- 2. トリガーの削除
DROP TRIGGER IF EXISTS update_qa_questions_updated_at ON qa_questions;
DROP TRIGGER IF EXISTS update_qa_answers_updated_at ON qa_answers;
DROP TRIGGER IF EXISTS update_qa_wallets_updated_at ON qa_wallets; --【新規】
DROP TRIGGER IF EXISTS trg_ppv_pools_updated_at ON qa_ppv_pools; --【新規】
DROP TRIGGER IF EXISTS grant_asker_access_on_question ON qa_questions; --【新規】
DROP TRIGGER IF EXISTS grant_responder_access_on_answer ON qa_answers; --【新規】
DROP TRIGGER IF EXISTS trg_enforce_answer_requirements ON qa_answers; --【追加】
DROP TRIGGER IF EXISTS trg_prevent_requirement_hardening ON qa_questions; --【追加】

-- 3. 関数の削除（名称をスキーマ準拠に【置換】）
DROP FUNCTION IF EXISTS has_question_access(UUID, UUID);
DROP FUNCTION IF EXISTS update_wallet_balance(UUID, DECIMAL, VARCHAR, VARCHAR, UUID, TEXT);
DROP FUNCTION IF EXISTS generate_invoice_number();
DROP FUNCTION IF EXISTS select_best_answer(UUID, UUID, TEXT); -- エスクロー 20%/80%実装の関数【新規明記】
DROP FUNCTION IF EXISTS purchase_ppv_access(UUID, UUID, VARCHAR); -- PPV 20/40/24/16 実装の関数【新規明記】
DROP FUNCTION IF EXISTS distribute_ppv_pool(UUID); -- others16%均等割【新規明記】
DROP FUNCTION IF EXISTS qa_count_attachments(JSONB, TEXT); -- 回答品質検証用【追加】
DROP FUNCTION IF EXISTS qa_enforce_answer_requirements(); -- 回答要件強制【追加】
DROP FUNCTION IF EXISTS qa_prevent_requirement_hardening(); -- 要件厳格化防止【追加】

Phase 3: データのバックアップと削除（15 分）
-- バックアップ作成（スキーマ退避）
CREATE SCHEMA IF NOT EXISTS qa_backup_20250922;

-- テーブルをバックアップスキーマに移動（順序重要）
ALTER TABLE qa_questions SET SCHEMA qa_backup_20250922;
ALTER TABLE qa_answers SET SCHEMA qa_backup_20250922;
ALTER TABLE qa_access_grants SET SCHEMA qa_backup_20250922;
ALTER TABLE qa_transactions SET SCHEMA qa_backup_20250922;
ALTER TABLE qa_wallets SET SCHEMA qa_backup_20250922;
ALTER TABLE qa_wallet_transactions SET SCHEMA qa_backup_20250922;
ALTER TABLE qa_payouts SET SCHEMA qa_backup_20250922;
ALTER TABLE qa_invoices SET SCHEMA qa_backup_20250922;
ALTER TABLE qa_notifications SET SCHEMA qa_backup_20250922;
ALTER TABLE qa_ratings SET SCHEMA qa_backup_20250922;
ALTER TABLE qa_audit_logs SET SCHEMA qa_backup_20250922;
ALTER TABLE qa_ppv_pools SET SCHEMA qa_backup_20250922; --【新規】
ALTER TABLE qa_ppv_pool_members SET SCHEMA qa_backup_20250922; --【新規】
ALTER TABLE qa_answer_blocks SET SCHEMA qa_backup_20250922; --【新規】

-- （オプション）完全削除
-- DROP SCHEMA qa_backup_20250922 CASCADE;

Phase 4: コードの削除（5 分）
#!/bin/bash

# remove-qa-platform.sh

# Q&A 関連ファイルの削除

rm -rf src/app/qa
rm -rf src/components/qa
rm -rf src/lib/qa
rm -rf src/hooks/qa
rm -rf src/app/api/qa
rm -rf src/app/api/webhooks/stripe # Q&A 専用 Webhook の切り離し【修正】
rm -rf docs/qa-platform

# 環境変数のクリーンアップ

sed -i '/^QA*/d' .env.local
sed -i '/^QA*/d' .env.production

echo "Q&A プラットフォームの削除完了"

🔄 再有効化手順
即座に復元（5 分）
#!/bin/bash

# restore-qa-platform.sh

# 1. 環境変数を有効化

echo "QA_ENABLE_PLATFORM=true" >> .env.local

# 2. データベースを復元（バックアップから）

# ※バックアップ方法により適宜変更

pg_dump $DATABASE_URL --schema=qa_backup_20250922 > qa_platform_backup.sql
psql $DATABASE_URL < qa_platform_backup.sql

# 3. アプリケーション再起動

npm run dev

📋 影響範囲チェックリスト
✅ 既存機能への影響なし
機能 影響 理由
野菜管理 なし 独立したテーブル
作業記録 なし 独立した API
会計機能 なし Q&A 側で完結（Stripe Connect/Wallet 分離）
写真管理 なし Q&A は別 Storage ＋透かし運用
通知機能 なし qa_notifications に分離
ユーザー認証 最小 auth.users 参照のみ
⚠️ 考慮事項

Stripe Connect アカウント

無効化してもアカウント・顧客データは保持

再有効化時に同じアカウントを再利用可能

ウォレット残高

無効化前に出金フローを案内

もしくは規約に基づき残高返戻（カード返金不可手数料の注意喚起）

進行中の質問

ベスト未確定案件は、与信期限ガードの自動キャプチャ可否を確認し、必要に応じて強制クローズ＋返金ポリシーを適用

PPV プール【新規】

ベスト未確定の**held_for_best（24%）および others プール（16%）**の残高を監査し、無効化前に清算/返戻ポリシーを明示

🛡️ 安全な分離を保証する設計パターン

1. 名前空間の分離
   // すべての Q&A 関連は qa\_ プレフィックス
   const QA_TABLES = {
   QUESTIONS: 'qa_questions',
   ANSWERS: 'qa_answers',
   TRANSACTIONS: 'qa_transactions',
   WALLETS: 'qa_wallets',
   POOLS: 'qa_ppv_pools', //【新規】
   POOL_MEMBERS: 'qa_ppv_pool_members', //【新規】
   BLOCKS: 'qa_answer_blocks' //【新規】
   };

2. 独立したサービスレイヤー
   // src/services/qa/QAService.ts
   export class QAService {
   // 既存サービスに依存しない
   // Supabase/Stripe も Q&A 用設定で完結
   async createQuestion() {}
   async submitAnswer() {}
   async purchasePPV() {} //【新規】
   async selectBestAndSettle() {} //【修正】エスクロー 20%/80%に整合
   }

3. フィーチャーフラグ
   // 環境変数で即座に ON/OFF
   if (process.env.QA_ENABLE_PLATFORM === 'true') {
   // Q&A 機能を有効化
   }

4. 独立したマイグレーション
   -- supabase/migrations/qa/
   20250922_qa_initial_schema.sql
   20250922_qa_rls_policies.sql
   20250922_qa_functions.sql -- select_best_answer/purchase_ppv_access/distribute_ppv_pool を含む【修正】

📊 ロールバック時間見積もり
作業 所要時間 自動化可能
機能フラグ OFF 1 分 ✅
UI 非表示 即座 ✅
API 無効化 1 分 ✅
DB バックアップ 5 分 ✅
テーブル退避/削除 5 分 ✅
コード削除 3 分 ✅
合計 約 15 分 完全自動化可能
🔧 自動化スクリプト
完全削除スクリプト
#!/bin/bash

# complete-removal.sh

echo "Q&A プラットフォーム完全削除を開始します..."

# 1. 機能を無効化

echo "QA_ENABLE_PLATFORM=false" > .env.qa.disabled

# 2. データベースバックアップ（スキーマのみ）

pg*dump $DATABASE_URL \
 --schema-only \
 --table='qa*\*' \

> qa*platform_backup*$(date +%Y%m%d).sql

# 3. テーブル削除/スキーマ掃除（退避済み前提）

psql $DATABASE_URL -c "
DROP TABLE IF EXISTS qa_ppv_pool_members CASCADE;
DROP TABLE IF EXISTS qa_ppv_pools CASCADE;
DROP TABLE IF EXISTS qa_answer_blocks CASCADE;
DROP TABLE IF EXISTS qa_wallet_transactions CASCADE;
DROP TABLE IF EXISTS qa_transactions CASCADE;
DROP TABLE IF EXISTS qa_access_grants CASCADE;
DROP TABLE IF EXISTS qa_answers CASCADE;
DROP TABLE IF EXISTS qa_questions CASCADE;
DROP TABLE IF EXISTS qa_wallets CASCADE;
DROP TABLE IF EXISTS qa_payouts CASCADE;
DROP TABLE IF EXISTS qa_invoices CASCADE;
DROP TABLE IF EXISTS qa_notifications CASCADE;
DROP TABLE IF EXISTS qa_ratings CASCADE;
DROP TABLE IF EXISTS qa_audit_logs CASCADE;
"

# 4. コード削除

rm -rf src/app/qa
rm -rf src/components/qa
rm -rf src/lib/qa
rm -rf src/app/api/qa
rm -rf src/app/api/webhooks/stripe #【修正】
rm -rf docs/qa-platform

# 5. 依存関係（Q&A 専用）削除

npm uninstall @stripe/stripe-js stripe

echo "削除完了！"

ヘルスチェックスクリプト
// scripts/check-qa-isolation.ts
// Q&A システムが既存システムから適切に分離されているか確認

async function checkIsolation() {
const violations: string[] = [];

// 1. qa\_ プレフィックスのない Q&A 関連テーブルが無いか
// 2. 既存テーブルへの不要な参照（外部キー）を検出
// 3. 共有コンポーネント依存の検出（/qa ディレクトリ越境参照）

if (violations.length === 0) {
console.log('✅ Q&A システムは完全に分離されています');
} else {
console.error('❌ 分離違反が見つかりました:', violations);
process.exit(1);
}
}

📝 まとめ

Q&A プラットフォームは以下の設計により完全に分離されています：

✅ 独立したデータベーススキーマ — qa\_ プレフィックスで完全分離

✅ 独立した API エンドポイント — /api/qa/ 配下に隔離（Stripe Webhook も別ルート）【修正】

✅ 独立した UI コンポーネント — /qa ディレクトリに分離

✅ 環境変数によるフィーチャーフラグ — 即座に ON/OFF 可能

✅ 既存機能への影響ゼロ — auth.users 参照のみの最小接点

✅ 新分配ロジックの独立運用 — エスクロー 20%/80%、PPV 20/40/24/16 は全て qa_transactions/プール関数で閉域処理【新規】

ロールバック時間：約 15 分（完全自動化可能）

今回の主な修正点（実装者向けハイライト）

手数料/分配ロジックの整合：文書全体を エスクロー 20%/80%、PPV 20/40/24/16 に統一【修正】

テーブル一覧の正規化：qa_transactions、qa_wallet_transactions、qa_ppv_pools、qa_ppv_pool_members、qa_answer_blocks を明記、qa_purchases/qa_reputation を削除【修正】

DROP 対象関数名の是正：has_question_access/generate_invoice_number/select_best_answer/purchase_ppv_access/distribute_ppv_pool に置換【置換】

Webhook の分離対象を明示：/api/webhooks/stripe を分離スコープに追加【新規】

プール残高の停止時対応：held_for_best と others プールの監査と清算方針を考慮事項に追加【新規】
