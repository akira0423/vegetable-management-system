-- ====================================================
-- Phase 0-3: インデックス作成状況の確認（修正版）
-- エラー修正: pg_stat_user_indexesのカラム名を正しく使用
-- ====================================================

-- 1. インデックス作成状況の確認
SELECT
    schemaname,
    relname AS tablename,  -- tablename → relname に修正
    indexrelname AS indexname,
    pg_size_pretty(pg_relation_size(indexrelid::regclass)) AS index_size,
    idx_scan AS times_used
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND relname IN ('users', 'work_reports', 'work_report_accounting', 'accounting_items', 'vegetables', 'accounting_recommendations')
ORDER BY relname, indexrelname;

-- 2. インデックス使用率の確認
SELECT
    tablename,
    ROUND(100.0 * idx_scan / NULLIF(seq_scan + idx_scan, 0), 2) AS index_usage_percent,
    seq_scan AS sequential_scans,
    idx_scan AS index_scans,
    n_live_tup AS live_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
    AND tablename IN ('work_reports', 'work_report_accounting', 'accounting_items', 'users', 'vegetables')
ORDER BY tablename;

-- 3. 作成されたインデックスの詳細確認
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN ('users', 'work_reports', 'work_report_accounting', 'accounting_items', 'vegetables', 'accounting_recommendations')
    AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- 4. 重要なインデックスの存在確認
SELECT
    'idx_users_id_company' AS index_name,
    EXISTS(
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_users_id_company'
        AND schemaname = 'public'
    ) AS exists,
    CASE
        WHEN EXISTS(
            SELECT 1 FROM pg_indexes
            WHERE indexname = 'idx_users_id_company'
            AND schemaname = 'public'
        ) THEN '✅ 作成済み'
        ELSE '❌ 未作成'
    END AS status
UNION ALL
SELECT
    'idx_work_reports_composite',
    EXISTS(
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_work_reports_composite'
        AND schemaname = 'public'
    ),
    CASE
        WHEN EXISTS(
            SELECT 1 FROM pg_indexes
            WHERE indexname = 'idx_work_reports_composite'
            AND schemaname = 'public'
        ) THEN '✅ 作成済み'
        ELSE '❌ 未作成'
    END
UNION ALL
SELECT
    'idx_work_report_accounting_composite',
    EXISTS(
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_work_report_accounting_composite'
        AND schemaname = 'public'
    ),
    CASE
        WHEN EXISTS(
            SELECT 1 FROM pg_indexes
            WHERE indexname = 'idx_work_report_accounting_composite'
            AND schemaname = 'public'
        ) THEN '✅ 作成済み'
        ELSE '❌ 未作成'
    END
UNION ALL
SELECT
    'idx_accounting_items_cost_type',
    EXISTS(
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_accounting_items_cost_type'
        AND schemaname = 'public'
    ),
    CASE
        WHEN EXISTS(
            SELECT 1 FROM pg_indexes
            WHERE indexname = 'idx_accounting_items_cost_type'
            AND schemaname = 'public'
        ) THEN '✅ 作成済み'
        ELSE '❌ 未作成'
    END
ORDER BY index_name;

-- 5. インデックスのサイズと効率性
SELECT
    schemaname,
    tablename,
    COUNT(*) AS index_count,
    pg_size_pretty(SUM(pg_relation_size(indexname::regclass))) AS total_index_size
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN ('users', 'work_reports', 'work_report_accounting', 'accounting_items', 'vegetables', 'accounting_recommendations')
GROUP BY schemaname, tablename
ORDER BY tablename;

-- 6. 統計情報の更新状況
SELECT
    schemaname,
    tablename,
    n_live_tup AS live_rows,
    n_dead_tup AS dead_rows,
    last_analyze,
    last_autoanalyze,
    CASE
        WHEN last_analyze IS NULL AND last_autoanalyze IS NULL THEN '⚠️ 統計未更新'
        WHEN last_analyze > CURRENT_TIMESTAMP - INTERVAL '1 hour' THEN '✅ 最近更新'
        ELSE '📊 更新推奨'
    END AS status
FROM pg_stat_user_tables
WHERE schemaname = 'public'
    AND tablename IN ('users', 'work_reports', 'work_report_accounting', 'accounting_items')
ORDER BY tablename;