-- ====================================================
-- Phase 0-3: インデックスの作成
-- 実行方法: Supabase SQL Editorで個別に実行
-- 注意: CREATE INDEX CONCURRENTLYはトランザクション外で実行
-- ====================================================

-- ⚠️ 重要: 以下のコマンドは一つずつ個別に実行してください
-- CONCURRENTLYオプションは本番環境でテーブルロックを避けるために使用

-- ====================================================
-- 1. usersテーブルのインデックス（get_current_company_id用）
-- ====================================================

-- このインデックスが最も重要（すべてのRLSチェックで使用）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_id_company
    ON users(id, company_id);

-- ====================================================
-- 2. work_reportsテーブルの複合インデックス
-- ====================================================

-- 最頻出のクエリパターン用
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_reports_composite
    ON work_reports(company_id, work_date DESC, created_at DESC)
    WHERE deleted_at IS NULL;

-- 野菜別の検索用
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_reports_vegetable_date
    ON work_reports(vegetable_id, work_date DESC)
    WHERE deleted_at IS NULL;

-- ====================================================
-- 3. work_report_accountingテーブルのインデックス
-- ====================================================

-- JOINとフィルタリング用の複合インデックス
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_report_accounting_composite
    ON work_report_accounting(work_report_id, accounting_item_id)
    INCLUDE (amount);  -- カバリングインデックス（PostgreSQL 11+）

-- 会計項目別の集計用
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_report_accounting_item_amount
    ON work_report_accounting(accounting_item_id, amount);

-- ====================================================
-- 4. accounting_itemsテーブルのインデックス
-- ====================================================

-- cost_type別の検索用
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounting_items_cost_type
    ON accounting_items(cost_type, id)
    INCLUDE (name, code);  -- よく一緒に取得されるカラムを含める

-- ====================================================
-- 5. accounting_recommendationsテーブルのインデックス
-- ====================================================

-- 会社と作業タイプでの検索用
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounting_recommendations_company_work
    ON accounting_recommendations(company_id, work_type);

-- 使用頻度での並び替え用
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounting_recommendations_usage
    ON accounting_recommendations(company_id, usage_count DESC, confidence_score DESC);

-- ====================================================
-- 6. vegetablesテーブルのインデックス
-- ====================================================

-- 会社とステータスでの検索用
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vegetables_company_status
    ON vegetables(company_id, status)
    WHERE deleted_at IS NULL;

-- ====================================================
-- 7. 統計情報の更新（インデックス作成後に実行）
-- ====================================================

-- 各テーブルの統計情報を最新化
ANALYZE users;
ANALYZE work_reports;
ANALYZE work_report_accounting;
ANALYZE accounting_items;
ANALYZE accounting_recommendations;
ANALYZE vegetables;
ANALYZE companies;

-- ====================================================
-- 実行後の確認用クエリ
-- ====================================================

-- インデックスの作成状況確認
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid::regclass)) as index_size,
    idx_scan as times_used
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND tablename IN ('users', 'work_reports', 'work_report_accounting', 'accounting_items', 'vegetables', 'accounting_recommendations')
ORDER BY tablename, indexname;

-- インデックス使用率の確認
SELECT
    schemaname,
    tablename,
    100 * idx_scan / NULLIF(seq_scan + idx_scan, 0) AS index_usage_percent,
    seq_scan,
    idx_scan
FROM pg_stat_user_tables
WHERE schemaname = 'public'
    AND tablename IN ('work_reports', 'work_report_accounting', 'accounting_items', 'vegetables')
ORDER BY index_usage_percent DESC NULLS LAST;

-- 統計情報の更新状況確認
SELECT
    schemaname,
    tablename,
    n_live_tup AS live_rows,
    n_dead_tup AS dead_rows,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
    AND tablename IN ('work_reports', 'work_report_accounting', 'accounting_items', 'vegetables')
ORDER BY tablename;