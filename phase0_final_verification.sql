-- ====================================================
-- Phase 0 最終確認クエリ（エラー修正版）
-- ====================================================

-- 1. インデックス使用率の確認（修正版）
SELECT
    schemaname,
    tablename,  -- pg_stat_user_tablesではtablenameが正しい
    ROUND(100.0 * idx_scan / NULLIF(seq_scan + idx_scan, 0), 2) AS index_usage_percent,
    seq_scan AS sequential_scans,
    idx_scan AS index_scans,
    n_live_tup AS live_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
    AND tablename IN ('work_reports', 'work_report_accounting', 'accounting_items', 'users', 'vegetables')
ORDER BY tablename;

-- 2. 統計情報の更新状況（修正版）
SELECT
    schemaname,
    tablename,  -- pg_stat_user_tablesではtablenameが正しい
    n_live_tup AS live_rows,
    n_dead_tup AS dead_rows,
    last_analyze,
    last_autoanalyze,
    CASE
        WHEN last_analyze IS NULL AND last_autoanalyze IS NULL THEN '⚠️ 統計未更新 - ANALYZE実行推奨'
        WHEN last_analyze > CURRENT_TIMESTAMP - INTERVAL '1 hour' OR last_autoanalyze > CURRENT_TIMESTAMP - INTERVAL '1 hour' THEN '✅ 最近更新'
        ELSE '📊 更新推奨'
    END AS status
FROM pg_stat_user_tables
WHERE schemaname = 'public'
    AND tablename IN ('users', 'work_reports', 'work_report_accounting', 'accounting_items', 'vegetables')
ORDER BY tablename;

-- 3. 新規作成インデックスの使用状況
SELECT
    'Phase 0で作成した重要インデックスの使用状況' AS description;

SELECT
    indexrelname AS index_name,
    idx_scan AS times_used,
    CASE
        WHEN idx_scan = 0 THEN '⚠️ 未使用（統計情報更新後に再確認）'
        WHEN idx_scan < 10 THEN '📊 使用開始'
        ELSE '✅ 活用中'
    END AS status,
    pg_size_pretty(pg_relation_size(indexrelid::regclass)) AS size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND indexrelname IN (
        'idx_users_id_company',
        'idx_work_reports_composite',
        'idx_work_report_accounting_composite',
        'idx_accounting_items_cost_type',
        'idx_work_reports_vegetable_date'
    )
ORDER BY idx_scan DESC;

-- 4. Phase 0の全体的な改善効果の推定
SELECT
    '📊 Phase 0 完了後の改善効果推定' AS assessment;

WITH index_stats AS (
    SELECT
        schemaname,
        tablename,
        ROUND(100.0 * idx_scan / NULLIF(seq_scan + idx_scan, 0), 2) AS index_usage_percent
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
        AND tablename IN ('work_reports', 'work_report_accounting', 'accounting_items', 'users')
)
SELECT
    ROUND(AVG(index_usage_percent), 1) AS avg_index_usage_percent,
    CASE
        WHEN AVG(index_usage_percent) < 30 THEN '❌ インデックス使用率低い'
        WHEN AVG(index_usage_percent) < 50 THEN '⚠️ 改善中'
        WHEN AVG(index_usage_percent) < 70 THEN '📊 良好'
        ELSE '✅ 優秀'
    END AS performance_status,
    CASE
        WHEN AVG(index_usage_percent) < 30 THEN '20-30%の改善'
        WHEN AVG(index_usage_percent) < 50 THEN '30-50%の改善'
        WHEN AVG(index_usage_percent) < 70 THEN '50-70%の改善'
        ELSE '70%以上の改善達成'
    END AS estimated_improvement
FROM index_stats;

-- 5. 統計情報の更新が必要なテーブル
SELECT
    'ANALYZE実行が必要なテーブル' AS action_required;

SELECT
    'ANALYZE ' || tablename || ';' AS execute_command
FROM pg_stat_user_tables
WHERE schemaname = 'public'
    AND tablename IN ('users', 'work_reports', 'work_report_accounting', 'accounting_items', 'vegetables')
    AND (last_analyze IS NULL OR last_analyze < CURRENT_TIMESTAMP - INTERVAL '1 day')
    AND (last_autoanalyze IS NULL OR last_autoanalyze < CURRENT_TIMESTAMP - INTERVAL '1 day')
ORDER BY tablename;

-- 6. Phase 0 完了チェックリスト
SELECT
    'Phase 0 完了確認' AS checklist;

SELECT
    'RLSポリシー整理' AS task,
    CASE
        WHEN (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'accounting_items') = 4
        AND (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'work_report_accounting') = 1
        AND (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'accounting_recommendations') = 1
        THEN '✅ 完了'
        ELSE '❌ 未完了'
    END AS status
UNION ALL
SELECT
    '関数最適化（STABLE化）' AS task,
    CASE
        WHEN (SELECT provolatile FROM pg_proc WHERE proname = 'get_current_company_id' AND pronamespace = 'public'::regnamespace) = 's'
        THEN '✅ 完了'
        ELSE '❌ 未完了'
    END AS status
UNION ALL
SELECT
    '重要インデックス作成' AS task,
    CASE
        WHEN EXISTS(SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_id_company')
        AND EXISTS(SELECT 1 FROM pg_indexes WHERE indexname = 'idx_work_reports_composite')
        AND EXISTS(SELECT 1 FROM pg_indexes WHERE indexname = 'idx_work_report_accounting_composite')
        THEN '✅ 完了'
        ELSE '❌ 未完了'
    END AS status
ORDER BY task;