-- ====================================================
-- Supabase分析クエリの修正版
-- 作成日: 2025-01-21
-- 目的: Supabase_20250921.mdでエラーが発生したクエリの修正版
-- ====================================================

-- ====================================================
-- 1. インデックス構造の確認（修正版）
-- ====================================================

-- 1.1 既存インデックスの詳細（スキーマ名の曖昧さを解決）
SELECT
    idx.schemaname,
    idx.tablename,
    idx.indexname,
    idx.indexdef,
    pg_size_pretty(pg_relation_size(indexrelid::regclass)) as index_size
FROM pg_indexes idx
INNER JOIN pg_stat_user_indexes stat
    ON idx.schemaname = stat.schemaname
    AND idx.tablename = stat.relname
    AND idx.indexname = stat.indexrelname
WHERE idx.schemaname = 'public'
    AND idx.tablename IN ('work_reports', 'work_report_accounting', 'accounting_items', 'vegetables', 'accounting_recommendations')
ORDER BY idx.tablename, idx.indexname;

-- 1.2 インデックスの使用頻度（適切なテーブル結合）
SELECT
    stat.schemaname,
    stat.relname AS tablename,
    stat.indexrelname AS indexname,
    stat.idx_scan AS index_scans,
    stat.idx_tup_read AS tuples_read,
    stat.idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes stat
WHERE stat.schemaname = 'public'
    AND stat.relname IN ('work_reports', 'work_report_accounting', 'accounting_items', 'vegetables', 'accounting_recommendations')
ORDER BY stat.relname, stat.idx_scan DESC;

-- ====================================================
-- 2. テーブル統計情報の確認（修正版）
-- ====================================================

-- 2.1 各テーブルのレコード数と容量
SELECT
    schemaname,
    tablename,
    n_live_tup AS row_count,
    n_dead_tup AS dead_rows,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
    AND tablename IN ('work_reports', 'work_report_accounting', 'accounting_items', 'vegetables', 'companies', 'users', 'accounting_recommendations')
ORDER BY tablename;

-- 2.2 テーブル統計の鮮度確認
SELECT
    schemaname,
    tablename,
    n_mod_since_analyze AS modifications_since_analyze,
    last_analyze,
    last_autoanalyze,
    CASE
        WHEN last_analyze IS NULL AND last_autoanalyze IS NULL THEN 'NEVER ANALYZED'
        WHEN n_mod_since_analyze > n_live_tup * 0.1 THEN 'NEEDS ANALYZE'
        ELSE 'UP TO DATE'
    END AS stats_status
FROM pg_stat_user_tables
WHERE schemaname = 'public'
    AND tablename IN ('work_reports', 'work_report_accounting', 'accounting_items', 'vegetables', 'accounting_recommendations')
ORDER BY tablename;

-- ====================================================
-- 3. ストレージとパフォーマンスの予測（修正版）
-- ====================================================

-- 3.1 ストレージ使用状況
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS index_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    n_live_tup AS live_rows,
    CASE
        WHEN n_live_tup > 0 THEN
            pg_relation_size(schemaname||'.'||tablename) / n_live_tup
        ELSE 0
    END AS avg_row_size_bytes
FROM pg_stat_user_tables
WHERE schemaname = 'public'
    AND tablename IN ('work_reports', 'work_report_accounting', 'accounting_items', 'vegetables', 'accounting_recommendations')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 3.2 将来のストレージ予測（1年後を想定）
WITH current_stats AS (
    SELECT
        tablename,
        n_live_tup AS current_rows,
        pg_total_relation_size(schemaname||'.'||tablename) AS current_size,
        CASE tablename
            WHEN 'work_reports' THEN 365 * 5  -- 1日5件の作業記録
            WHEN 'work_report_accounting' THEN 365 * 10  -- 1日10件の会計記録
            WHEN 'vegetables' THEN 50  -- 年間50品目
            WHEN 'accounting_items' THEN 10  -- 年間10項目追加
            WHEN 'accounting_recommendations' THEN 100  -- 年間100レコメンド
            ELSE 0
        END AS estimated_annual_growth
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
        AND tablename IN ('work_reports', 'work_report_accounting', 'accounting_items', 'vegetables', 'accounting_recommendations')
)
SELECT
    tablename,
    current_rows,
    estimated_annual_growth,
    current_rows + estimated_annual_growth AS projected_rows_1year,
    pg_size_pretty(current_size) AS current_size,
    pg_size_pretty(
        CASE
            WHEN current_rows > 0 THEN
                (current_size::numeric / current_rows) * (current_rows + estimated_annual_growth)
            ELSE current_size
        END::bigint
    ) AS projected_size_1year
FROM current_stats
ORDER BY tablename;

-- ====================================================
-- 4. 推奨インデックスの作成
-- ====================================================

-- 4.1 頻繁に使用されるクエリパターンに基づくインデックス
-- work_reportsテーブル
CREATE INDEX IF NOT EXISTS idx_work_reports_company_date
    ON work_reports(company_id, work_date DESC, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_work_reports_vegetable_date
    ON work_reports(vegetable_id, work_date DESC)
    WHERE deleted_at IS NULL;

-- work_report_accountingテーブル
CREATE INDEX IF NOT EXISTS idx_work_report_accounting_report_item
    ON work_report_accounting(work_report_id, accounting_item_id);

CREATE INDEX IF NOT EXISTS idx_work_report_accounting_item_amount
    ON work_report_accounting(accounting_item_id, amount);

-- accounting_recommendationsテーブル
CREATE INDEX IF NOT EXISTS idx_accounting_recommendations_company_work
    ON accounting_recommendations(company_id, work_type);

CREATE INDEX IF NOT EXISTS idx_accounting_recommendations_usage
    ON accounting_recommendations(company_id, usage_count DESC, confidence_score DESC);

-- ====================================================
-- 5. 統計情報の更新
-- ====================================================

-- 統計情報を最新に更新
ANALYZE work_reports;
ANALYZE work_report_accounting;
ANALYZE accounting_items;
ANALYZE vegetables;
ANALYZE accounting_recommendations;
ANALYZE companies;
ANALYZE users;

-- ====================================================
-- 6. クエリパフォーマンスの確認
-- ====================================================

-- 6.1 最も時間のかかっているクエリ（pg_stat_statementsが有効な場合）
-- 注: pg_stat_statementsエクステンションが必要
-- CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

/*
SELECT
    calls,
    mean_exec_time,
    total_exec_time,
    min_exec_time,
    max_exec_time,
    stddev_exec_time,
    rows / calls AS avg_rows,
    LEFT(query, 100) AS query_sample
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
    AND query LIKE '%work_report%'
ORDER BY mean_exec_time DESC
LIMIT 10;
*/

-- 6.2 テーブルアクセスパターンの分析
SELECT
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    CASE
        WHEN seq_scan + idx_scan > 0 THEN
            ROUND(100.0 * idx_scan / (seq_scan + idx_scan), 2)
        ELSE 0
    END AS index_usage_percent
FROM pg_stat_user_tables
WHERE schemaname = 'public'
    AND tablename IN ('work_reports', 'work_report_accounting', 'accounting_items', 'vegetables', 'accounting_recommendations')
ORDER BY seq_scan + idx_scan DESC;

-- ====================================================
-- 7. データ整合性チェック
-- ====================================================

-- 7.1 孤立した会計レコードの確認
SELECT COUNT(*) AS orphaned_accounting_records
FROM work_report_accounting wra
LEFT JOIN work_reports wr ON wra.work_report_id = wr.id
WHERE wr.id IS NULL;

-- 7.2 無効な会計項目参照の確認
SELECT COUNT(*) AS invalid_accounting_items
FROM work_report_accounting wra
LEFT JOIN accounting_items ai ON wra.accounting_item_id = ai.id
WHERE wra.accounting_item_id IS NOT NULL
    AND ai.id IS NULL;

-- 7.3 削除済みレポートに紐づく会計レコードの確認
SELECT COUNT(*) AS accounting_for_deleted_reports
FROM work_report_accounting wra
INNER JOIN work_reports wr ON wra.work_report_id = wr.id
WHERE wr.deleted_at IS NOT NULL;

-- ====================================================
-- 8. 月別データ量の推移
-- ====================================================

SELECT
    DATE_TRUNC('month', wr.work_date) AS month,
    COUNT(DISTINCT wr.company_id) AS company_count,
    COUNT(DISTINCT wr.id) AS report_count,
    COUNT(DISTINCT wra.id) AS accounting_record_count,
    SUM(CASE WHEN ai.cost_type = 'income' THEN wra.amount ELSE 0 END) AS total_income,
    SUM(CASE WHEN ai.cost_type IN ('fixed_cost', 'variable_cost') THEN wra.amount ELSE 0 END) AS total_expense,
    AVG(wr.duration_hours) AS avg_work_hours
FROM work_reports wr
LEFT JOIN work_report_accounting wra ON wr.id = wra.work_report_id
LEFT JOIN accounting_items ai ON wra.accounting_item_id = ai.id
WHERE wr.deleted_at IS NULL
GROUP BY DATE_TRUNC('month', wr.work_date)
ORDER BY month DESC;

-- ====================================================
-- メモ
-- ====================================================
-- このスクリプトは以下の問題を解決します：
-- 1. スキーマ名の曖昧な参照を明確化
-- 2. 存在しないカラム名の修正
-- 3. 適切なシステムカタログビューの使用
-- 4. パフォーマンス最適化のためのインデックス追加
--
-- 実行前の確認事項：
-- - PostgreSQLのバージョン確認（9.6以上推奨）
-- - 適切な権限があることを確認
-- - 本番環境では必ずバックアップを取得してから実行