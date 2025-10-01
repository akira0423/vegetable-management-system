Q&A プラットフォーム 切り離しマニュアル
📋 はじめに

このマニュアルは、Q&A プラットフォームを既存の野菜管理システムから安全に切り離し、元の状態に戻すための完全ガイドです。

所要時間：約 15 分
リスクレベル：低（既存システムへの影響なし）

【更新】本マニュアルは以下の分配ルールに整合しています：
・エスクロー（懸賞金）手数料＝運営 20%、回答者受取＝ 80%
・PPV（第三者閲覧）＝運営 20%、残 80%を 質問者 40% / ベスト 24% / その他 16%（均等割）
・ベスト未確定期間中の PPV は「ベスト 24%分＝ held_for_best」として保留、「その他 16%分＝ others プール」を均等割り配分
・質問本文は全員に公開、回答本文は権限制御（ASKER/RESPONDER/PPV/ADMIN）
・回答品質要件機能（最小文字数、写真/動画必須設定）

⚠️ 切り離し前の確認事項
必須チェックリスト

すべてのユーザーのウォレット残高を確認

進行中の質問（ANSWERING/SELECTING/FUNDED 状態）の有無を確認【修正】

未処理の出金申請の有無を確認

データバックアップの準備完了

管理者権限でのアクセス確認

【新規】PPV プール残高（held_for_best=ベスト 24%、others=16%）の確認

🚨 緊急停止（1 分）

問題が発生した場合、まず以下を実行してください：

# 1. Q&A 機能を即座に無効化

echo "QA_ENABLE_PLATFORM=false" >> .env.local

# 2. アプリケーションを再起動

npm run dev

# または本番環境の場合

pm2 restart all

これだけで、ユーザーから Q&A 機能が見えなくなります。

【新規】Stripe Webhook が残存している場合は一時的に 410 を返すようルートを無効化（/api/webhooks/stripe）。

📝 段階的切り離し手順
Step 1: 事前準備（5 分）
1-1. 現在の状態を記録
-- Supabase SQL エディタで実行
-- 現在の Q&A データの統計を取得
SELECT 'questions' AS table_name, COUNT(_) AS count FROM qa_questions
UNION ALL SELECT 'answers', COUNT(_) FROM qa_answers
UNION ALL SELECT 'profiles', COUNT(_) FROM qa_user_profiles
UNION ALL SELECT 'wallet_balance', COALESCE(SUM(balance_available),0) FROM qa_wallets
UNION ALL SELECT 'ppv_pool_questions', COUNT(_) FROM qa_ppv_pools; --【新規】

1-2. アクティブな取引の確認
-- 進行中の質問を確認（FUNDED/ANSWERING/SELECTING を対象）【修正】
SELECT id, title, status, bounty_amount, deadline_at
FROM qa_questions
WHERE status IN ('FUNDED','ANSWERING','SELECTING');

-- 保留中の出金を確認
SELECT id, user_id, amount, status
FROM qa_payouts
WHERE status IN ('REQUESTED','PROCESSING');

1-3. PPV プール残高の確認【新規】
-- ベスト未確定保留（held_for_best ＝ベスト 24%）と others16% の残高
SELECT question_id, held_for_best, total_amount AS others_pool, updated_at
FROM qa_ppv_pools
ORDER BY updated_at DESC;

【新規】運用方針：切り離し直前にベストが確定している質問は
・ベスト 24%分：即時清算（best へ）
・others16%分：プールメンバー均等割（ブロック除外済）
ベスト未確定の質問は held_for_best/others を「未精算残」レポートに出力。

Step 2: 機能の無効化（2 分）
2-1. 環境変数の設定

.env.local を編集:

# Q&A プラットフォーム設定

QA_ENABLE_PLATFORM=false # true から false に変更

# QA_STRIPE_SECRET_KEY=sk_test_xxx # コメントアウト（任意）

# QA_STRIPE_WEBHOOK_SECRET=whsec_xxx # コメントアウト（任意）

# QA_STRIPE_CONNECT_CLIENT_ID=ca_xxx # コメントアウト（任意）【新規】

.env.production を編集（本番環境の場合）:

QA_ENABLE_PLATFORM=false

2-2. アプリケーションの再起動

# 開発環境

npm run dev を再起動（Ctrl+C して再度実行）

# 本番環境（PM2 使用の場合）

pm2 restart your-app-name

# 本番環境（systemd 使用の場合）

sudo systemctl restart your-app-service

# Vercel の場合

vercel --prod

【新規】Webhook ランタイムを併設している場合は /api/webhooks/stripe を同時に停止/無効化。

Step 3: データのバックアップ（5 分）
3-1. データベースバックアップスクリプトの実行（完全版）

【修正】qa*purchases/qa_reputation は廃止。PPV は qa_transactions と qa_ppv*\* に統合。

-- Q&A データ専用のバックアップスキーマを作成
CREATE SCHEMA IF NOT EXISTS qa_backup_20250922;

-- すべての Q&A テーブルをバックアップ（必要なもののみ）
CREATE TABLE qa_backup_20250922.qa_questions AS SELECT _ FROM qa_questions;
CREATE TABLE qa_backup_20250922.qa_answers AS SELECT _ FROM qa_answers;
CREATE TABLE qa_backup_20250922.qa_user_profiles AS SELECT _ FROM qa_user_profiles;
CREATE TABLE qa_backup_20250922.qa_transactions AS SELECT _ FROM qa_transactions; --【新規】
CREATE TABLE qa_backup_20250922.qa_wallets AS SELECT _ FROM qa_wallets;
CREATE TABLE qa_backup_20250922.qa_wallet_transactions AS SELECT _ FROM qa_wallet_transactions; --【新規】
CREATE TABLE qa_backup_20250922.qa_access_grants AS SELECT _ FROM qa_access_grants;
CREATE TABLE qa_backup_20250922.qa_payouts AS SELECT _ FROM qa_payouts;
CREATE TABLE qa_backup_20250922.qa_invoices AS SELECT _ FROM qa_invoices;
CREATE TABLE qa_backup_20250922.qa_notifications AS SELECT _ FROM qa_notifications;
CREATE TABLE qa_backup_20250922.qa_audit_logs AS SELECT _ FROM qa_audit_logs;
CREATE TABLE qa_backup_20250922.qa_ppv_pools AS SELECT _ FROM qa_ppv_pools; --【新規】
CREATE TABLE qa_backup_20250922.qa_ppv_pool_members AS SELECT _ FROM qa_ppv_pool_members; --【新規】
CREATE TABLE qa_backup_20250922.qa_answer_blocks AS SELECT _ FROM qa_answer_blocks; --【新規】

-- バックアップ完了の確認
SELECT 'Backup completed at ' || NOW() AS status;

3-2. ファイルバックアップ（オプション）

# コードのバックアップ

tar -czf qa-platform-backup-$(date +%Y%m%d).tar.gz \
 src/app/qa \
 src/components/qa \
 src/lib/qa \
 src/app/api/qa \
 src/app/api/webhooks/stripe \ #【新規】Webhook も退避
docs/qa-platform

# バックアップファイルを安全な場所に移動

mv qa-platform-backup-\*.tar.gz ~/backups/

Step 4: データベースのクリーンアップ（3 分）
4-1. トリガーと関数の削除
-- トリガーの削除（存在すれば）
DROP TRIGGER IF EXISTS update_qa_user_profiles_updated_at ON qa_user_profiles;
DROP TRIGGER IF EXISTS update_qa_questions_updated_at ON qa_questions;
DROP TRIGGER IF EXISTS update_qa_answers_updated_at ON qa_answers;
DROP TRIGGER IF EXISTS update_qa_wallets_updated_at ON qa_wallets;
DROP TRIGGER IF EXISTS trg_ppv_pools_updated_at ON qa_ppv_pools; --【新規】
DROP TRIGGER IF EXISTS grant_asker_access_on_question ON qa_questions; --【新規】
DROP TRIGGER IF EXISTS grant_responder_access_on_answer ON qa_answers; --【新規】
DROP TRIGGER IF EXISTS trg_enforce_answer_requirements ON qa_answers; --【回答品質強制】
DROP TRIGGER IF EXISTS trg_prevent_requirement_hardening ON qa_questions; --【要件厳格化防止】

-- 関数の削除（名称をスキーマ最新版に整合）【修正/置換】
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS generate_invoice_number(); --（旧 generate_invoice_no を置換）【修正】
DROP FUNCTION IF EXISTS has_question_access(UUID, UUID); --（旧 check_question_access を置換）【修正】
DROP FUNCTION IF EXISTS update_wallet_balance(UUID, DECIMAL, VARCHAR, VARCHAR, UUID, TEXT);
DROP FUNCTION IF EXISTS select_best_answer(UUID, UUID, TEXT); -- エスクロー 20/80 清算関数【新規】
DROP FUNCTION IF EXISTS purchase_ppv_access(UUID, UUID, VARCHAR); -- PPV 20/40/24/16【新規】
DROP FUNCTION IF EXISTS distribute_ppv_pool(UUID); -- others16%均等割【新規】
DROP FUNCTION IF EXISTS generate_monthly_invoices(); --【新規】
DROP FUNCTION IF EXISTS migrate_cold_questions(); --【新規】
DROP FUNCTION IF EXISTS record_event(VARCHAR, UUID, VARCHAR, JSONB); --【新規】
DROP FUNCTION IF EXISTS qa_count_attachments(JSONB, TEXT); -- 回答品質検証用【追加】
DROP FUNCTION IF EXISTS qa_enforce_answer_requirements(); -- 回答要件強制【追加】
DROP FUNCTION IF EXISTS qa_prevent_requirement_hardening(); -- 要件厳格化防止【追加】

-- ビュー/マテビューの削除（存在すれば）【修正】
DROP MATERIALIZED VIEW IF EXISTS qa_stats_realtime;
DROP MATERIALIZED VIEW IF EXISTS qa_stats_ppv_daily;
DROP VIEW IF EXISTS qa_user_dashboard;
DROP VIEW IF EXISTS qa_questions_list;
DROP VIEW IF EXISTS qa_performance_metrics;

4-2. テーブルの削除
-- RLS を無効化（qa\_系すべて）【修正】
ALTER TABLE qa_questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE qa_answers DISABLE ROW LEVEL SECURITY;
ALTER TABLE qa_user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE qa_transactions DISABLE ROW LEVEL SECURITY; --【新規】
ALTER TABLE qa_wallets DISABLE ROW LEVEL SECURITY;
ALTER TABLE qa_wallet_transactions DISABLE ROW LEVEL SECURITY; --【新規】
ALTER TABLE qa_access_grants DISABLE ROW LEVEL SECURITY;
ALTER TABLE qa_payouts DISABLE ROW LEVEL SECURITY;
ALTER TABLE qa_invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE qa_notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE qa_audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE qa_ratings DISABLE ROW LEVEL SECURITY;
ALTER TABLE qa_ppv_pools DISABLE ROW LEVEL SECURITY; --【新規】
ALTER TABLE qa_ppv_pool_members DISABLE ROW LEVEL SECURITY; --【新規】
ALTER TABLE qa_answer_blocks DISABLE ROW LEVEL SECURITY; --【新規】

-- テーブルを削除（依存関係に注意）【修正】
DROP TABLE IF EXISTS qa_ppv_pool_members CASCADE; --【新規】
DROP TABLE IF EXISTS qa_ppv_pools CASCADE; --【新規】
DROP TABLE IF EXISTS qa_answer_blocks CASCADE; --【新規】
DROP TABLE IF EXISTS qa_wallet_transactions CASCADE; --【新規】
DROP TABLE IF EXISTS qa_transactions CASCADE; --【新規】
DROP TABLE IF EXISTS qa_access_grants CASCADE;
DROP TABLE IF EXISTS qa_ratings CASCADE;
DROP TABLE IF EXISTS qa_notifications CASCADE;
DROP TABLE IF EXISTS qa_invoices CASCADE;
DROP TABLE IF EXISTS qa_payouts CASCADE;
DROP TABLE IF EXISTS qa_answers CASCADE;
DROP TABLE IF EXISTS qa_questions CASCADE;
DROP TABLE IF EXISTS qa_wallets CASCADE;
DROP TABLE IF EXISTS qa_user_profiles CASCADE;

-- 列挙型の削除（存在すれば）【修正】
DROP TYPE IF EXISTS qa_question_status CASCADE;
DROP TYPE IF EXISTS qa_payment_type CASCADE;
DROP TYPE IF EXISTS qa_payment_status CASCADE;
DROP TYPE IF EXISTS qa_user_tier CASCADE; --【新規】
DROP TYPE IF EXISTS qa_notification_type CASCADE; --【新規】

-- 【削除】以下の型はスキーマ外：qa_answer_status / qa_payout_status / qa_access_reason【削除】

Step 5: コードの削除（2 分）
5-1. 自動削除スクリプトの実行

remove-qa-platform.ps1 (Windows PowerShell):

# Q&A プラットフォームのコード削除スクリプト

Write-Host "Q&A プラットフォームのコード削除を開始します..." -ForegroundColor Yellow

# ディレクトリの削除

Remove-Item -Path "src\app\qa" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "src\components\qa" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "src\lib\qa" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "src\hooks\qa" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "src\app\api\qa" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "src\app\api\webhooks\stripe" -Recurse -Force -ErrorAction SilentlyContinue #【新規】
Remove-Item -Path "docs\qa-platform" -Recurse -Force -ErrorAction SilentlyContinue

# マイグレーションファイルの削除

Get-ChildItem -Path "supabase\migrations" -Filter "_qa_" | Remove-Item -Force

Write-Host "コード削除完了！" -ForegroundColor Green

remove-qa-platform.sh (Mac/Linux):

#!/bin/bash

echo "Q&A プラットフォームのコード削除を開始します..."

# ディレクトリの削除

rm -rf src/app/qa
rm -rf src/components/qa
rm -rf src/lib/qa
rm -rf src/hooks/qa
rm -rf src/app/api/qa
rm -rf src/app/api/webhooks/stripe #【新規】
rm -rf docs/qa-platform

# マイグレーションファイルの削除

rm -f supabase/migrations/_qa_.sql

echo "コード削除完了！"

5-2. package.json の確認（必要に応じて）

Q&A 専用の依存関係がある場合は削除：

# Stripe 関連（既存システムで未使用の場合のみ）

npm uninstall stripe @stripe/stripe-js

Step 6: 最終確認（2 分）
6-1. アプリケーションの動作確認

# 開発環境で起動

npm run dev

# 以下を確認：

# - ダッシュボードに Q&A メニューが表示されていないこと

# - /qa 以下のルートにアクセスできないこと（404）

# - 既存機能（野菜管理、作業記録等）が正常に動作すること

# - エラーログがないこと

6-2. データベースの確認
-- Q&A テーブルが存在しないことを確認
SELECT table*name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'qa*%';
-- 結果が 0 件であることを確認

🔄 復元手順（必要な場合）
データベースの復元
-- バックアップからテーブルを復元
CREATE TABLE qa_questions AS SELECT _ FROM qa_backup_20250922.qa_questions;
CREATE TABLE qa_answers AS SELECT _ FROM qa_backup_20250922.qa_answers;
CREATE TABLE qa_user_profiles AS SELECT _ FROM qa_backup_20250922.qa_user_profiles;
CREATE TABLE qa_transactions AS SELECT _ FROM qa_backup_20250922.qa_transactions; --【新規】
CREATE TABLE qa_wallets AS SELECT _ FROM qa_backup_20250922.qa_wallets;
CREATE TABLE qa_wallet_transactions AS SELECT _ FROM qa_backup_20250922.qa_wallet_transactions; --【新規】
CREATE TABLE qa_access_grants AS SELECT _ FROM qa_backup_20250922.qa_access_grants;
CREATE TABLE qa_payouts AS SELECT _ FROM qa_backup_20250922.qa_payouts;
CREATE TABLE qa_invoices AS SELECT _ FROM qa_backup_20250922.qa_invoices;
CREATE TABLE qa_notifications AS SELECT _ FROM qa_backup_20250922.qa_notifications;
CREATE TABLE qa_audit_logs AS SELECT _ FROM qa_backup_20250922.qa_audit_logs;
CREATE TABLE qa_ppv_pools AS SELECT _ FROM qa_backup_20250922.qa_ppv_pools; --【新規】
CREATE TABLE qa_ppv_pool_members AS SELECT _ FROM qa_backup_20250922.qa_ppv_pool_members; --【新規】
CREATE TABLE qa_answer_blocks AS SELECT _ FROM qa_backup_20250922.qa_answer_blocks; --【新規】

【新規】復元後、必要に応じて以下の関数/トリガーを再作成：
update_updated_at_column, grant_asker_access_on_question, grant_responder_access_on_answer,
select_best_answer（20/80）、purchase_ppv_access（20/40/24/16）、distribute_ppv_pool、generate_invoice_number など。

コードの復元

# バックアップから復元

tar -xzf ~/backups/qa-platform-backup-20250922.tar.gz

# 環境変数を有効化

# .env.local で QA_ENABLE_PLATFORM=true に設定

# アプリケーション再起動

npm run dev

📊 切り離し完了チェックリスト
必須確認項目

Q&A メニューが表示されていない

/qa パスにアクセスできない（404 エラー）

既存機能が正常動作

qa\_ で始まるテーブルが存在しない

エラーログなし

バックアップファイルが保存済み

【新規】Stripe Webhook が無効化されている

オプション確認項目

Stripe Connect の無効化/停止

関連ドキュメントのアーカイブ

チームへの通知完了

【新規】PPV プール未清算残のレポート保管

🆘 トラブルシューティング
Q: 削除後にエラーが発生する

# キャッシュをクリア

rm -rf .next
npm run build
npm run dev

Q: 一部の機能が動作しない
// src/config/features.ts を確認
export const FEATURES = {
QA_PLATFORM: false // 必ず false になっていること
};

Q: データベースエラーが発生
-- 外部キー制約のエラーの場合
ALTER TABLE <related_table>
DROP CONSTRAINT IF EXISTS <constraint_name>;

📞 サポート連絡先

問題が発生した場合の連絡先：

技術サポート：[メールアドレス]

緊急連絡先：[電話番号]

ドキュメント：/docs/qa-platform/

📅 切り離し実施記録
日時 実施者 結果 備考
2025-09-22 10:00 - - テンプレート

重要： このマニュアルは定期的に更新してください。
バージョン： 1.1.0【修正】
最終更新： 2025-09-22【修正】
