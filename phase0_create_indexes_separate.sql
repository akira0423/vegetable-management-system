-- ====================================================
-- Phase 0-3: インデックスの作成（個別実行用）
-- 実行方法: 各コマンドを個別にSupabase SQL Editorで実行
-- 重要: CONCURRENTLYはトランザクション外で実行する必要があります
-- ====================================================

-- ⚠️ 以下のコマンドを一つずつ個別に実行してください
-- 各インデックス作成後、完了を待ってから次を実行

-- ====================================================
-- 1. 最重要: usersテーブルのインデックス
-- get_current_company_id()関数の高速化
-- ====================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_id_company
ON users(id, company_id);

-- ====================================================
-- 2. work_reportsテーブルの複合インデックス
-- 最頻出のクエリパターン用
-- ====================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_reports_composite
ON work_reports(company_id, work_date DESC, created_at DESC)
WHERE deleted_at IS NULL;

-- ====================================================
-- 3. work_reports野菜別インデックス
-- ====================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_reports_vegetable_date
ON work_reports(vegetable_id, work_date DESC)
WHERE deleted_at IS NULL;

-- ====================================================
-- 4. work_report_accountingの複合インデックス
-- ====================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_report_accounting_composite
ON work_report_accounting(work_report_id, accounting_item_id)
INCLUDE (amount);

-- ====================================================
-- 5. work_report_accountingの会計項目インデックス
-- ====================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_report_accounting_item_amount
ON work_report_accounting(accounting_item_id, amount);

-- ====================================================
-- 6. accounting_itemsのコストタイプインデックス
-- ====================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounting_items_cost_type
ON accounting_items(cost_type, id)
INCLUDE (name, code);

-- ====================================================
-- 7. accounting_recommendationsの複合インデックス
-- ====================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounting_recommendations_company_work
ON accounting_recommendations(company_id, work_type);

-- ====================================================
-- 8. accounting_recommendationsの使用頻度インデックス
-- ====================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounting_recommendations_usage
ON accounting_recommendations(company_id, usage_count DESC, confidence_score DESC);

-- ====================================================
-- 9. vegetablesテーブルのインデックス
-- ====================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vegetables_company_status
ON vegetables(company_id, status)
WHERE deleted_at IS NULL;

-- ====================================================
-- 10. 統計情報の更新（すべてのインデックス作成後に実行）
-- ====================================================

ANALYZE users;
ANALYZE work_reports;
ANALYZE work_report_accounting;
ANALYZE accounting_items;
ANALYZE accounting_recommendations;
ANALYZE vegetables;
ANALYZE companies;

-- ====================================================
-- インデックス作成状況の確認（実行後）
-- ====================================================

SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid::regclass)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND tablename IN ('users', 'work_reports', 'work_report_accounting', 'accounting_items', 'vegetables', 'accounting_recommendations')
ORDER BY tablename, indexname;

-- インデックス使用率の確認
SELECT
    tablename,
    ROUND(100.0 * idx_scan / NULLIF(seq_scan + idx_scan, 0), 2) AS index_usage_percent,
    seq_scan AS sequential_scans,
    idx_scan AS index_scans
FROM pg_stat_user_tables
WHERE schemaname = 'public'
    AND tablename IN ('work_reports', 'work_report_accounting', 'accounting_items')
ORDER BY tablename;