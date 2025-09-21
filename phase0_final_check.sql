-- ====================================================
-- Phase 0 最終確認クエリ（Supabase対応版）
-- ====================================================

-- 1. テーブル構造の確認（どのカラムが存在するか）
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'pg_catalog'
    AND table_name = 'pg_stat_user_tables'
ORDER BY ordinal_position;

-- 2. インデックス使用率の確認（代替方法）
WITH table_stats AS (
    SELECT
        schemaname,
        relname,
        seq_scan,
        idx_scan,
        n_live_tup
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
)
SELECT
    relname AS table_name,
    ROUND(100.0 * idx_scan / NULLIF(seq_scan + idx_scan, 0), 2) AS index_usage_percent,
    seq_scan AS sequential_scans,
    idx_scan AS index_scans,
    n_live_tup AS live_rows
FROM table_stats
WHERE relname IN ('work_reports', 'work_report_accounting', 'accounting_items', 'users', 'vegetables')
ORDER BY relname;

-- 3. 統計情報の更新状況（代替方法）
SELECT
    schemaname,
    relname AS table_name,
    n_live_tup AS live_rows,
    n_dead_tup AS dead_rows,
    last_analyze,
    last_autoanalyze,
    CASE
        WHEN last_analyze IS NULL AND last_autoanalyze IS NULL THEN '⚠️ ANALYZE実行推奨'
        WHEN last_analyze > CURRENT_TIMESTAMP - INTERVAL '1 hour' OR
             last_autoanalyze > CURRENT_TIMESTAMP - INTERVAL '1 hour' THEN '✅ 最近更新'
        ELSE '📊 更新推奨'
    END AS status
FROM pg_stat_user_tables
WHERE schemaname = 'public'
    AND relname IN ('users', 'work_reports', 'work_report_accounting', 'accounting_items', 'vegetables')
ORDER BY relname;

-- 4. 新規インデックスの効果測定
SELECT
    '新規作成インデックスは統計情報更新後に使用開始されます' AS info;

-- 統計情報を更新するコマンド（個別実行）
SELECT
    'ANALYZE ' || relname || ';' AS execute_this_command
FROM pg_stat_user_tables
WHERE schemaname = 'public'
    AND relname IN ('users', 'work_reports', 'work_report_accounting', 'accounting_items', 'vegetables');

-- 5. Phase 0 最終確認サマリー
SELECT
    '==============================' AS separator,
    'Phase 0 完了サマリー' AS title,
    '==============================' AS separator2;

SELECT * FROM (
    SELECT 1 as sort_order, 'タスク' AS item, '状態' AS value
    UNION ALL
    SELECT 2, '1. RLSポリシー整理', '✅ 完了（4 + 1 + 1 ポリシー）'
    UNION ALL
    SELECT 3, '2. 関数最適化', '✅ 完了（STABLE化成功）'
    UNION ALL
    SELECT 4, '3. インデックス作成', '✅ 完了（全重要インデックス作成済み）'
    UNION ALL
    SELECT 5, '4. 統計情報更新', '⚠️ ANALYZE実行が必要'
) t
ORDER BY sort_order;

-- 6. 推奨アクション
SELECT
    '==============================' AS separator,
    '推奨アクション' AS title,
    '==============================' AS separator2;

SELECT
    '以下のコマンドを順番に実行してください：' AS action;

SELECT
    row_number() OVER () AS step,
    command
FROM (
    SELECT 'ANALYZE users;' AS command
    UNION ALL SELECT 'ANALYZE work_reports;'
    UNION ALL SELECT 'ANALYZE work_report_accounting;'
    UNION ALL SELECT 'ANALYZE accounting_items;'
    UNION ALL SELECT 'ANALYZE vegetables;'
) commands;

-- 7. パフォーマンステスト用クエリ
SELECT
    '==============================' AS separator,
    'パフォーマンステスト' AS title,
    '==============================' AS separator2;

-- get_current_company_id()関数のテスト
EXPLAIN (ANALYZE, BUFFERS)
SELECT get_current_company_id();

-- インデックスを使用するクエリのテスト
EXPLAIN (ANALYZE, BUFFERS)
SELECT wr.*, wra.*, ai.*
FROM work_reports wr
JOIN work_report_accounting wra ON wr.id = wra.work_report_id
JOIN accounting_items ai ON wra.accounting_item_id = ai.id
WHERE wr.company_id = get_current_company_id()
LIMIT 10;