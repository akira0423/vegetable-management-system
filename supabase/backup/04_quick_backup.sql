-- ============================================
-- Supabase クイックバックアップ用SQL
-- すべてのテーブル情報を1つのクエリで取得
-- 実行日: 2025-09-15
-- ============================================

-- このクエリを実行して、結果全体をコピー＆保存してください

WITH table_info AS (
    SELECT
        'companies' as table_name,
        COUNT(*) as row_count,
        json_agg(row_to_json(t)) as data
    FROM companies t
    UNION ALL
    SELECT
        'users' as table_name,
        COUNT(*) as row_count,
        json_agg(row_to_json(t)) as data
    FROM users t
    UNION ALL
    SELECT
        'vegetables' as table_name,
        COUNT(*) as row_count,
        json_agg(row_to_json(t)) as data
    FROM vegetables t
    UNION ALL
    SELECT
        'plots' as table_name,
        COUNT(*) as row_count,
        json_agg(row_to_json(t)) as data
    FROM plots t
    UNION ALL
    SELECT
        'tasks' as table_name,
        COUNT(*) as row_count,
        json_agg(row_to_json(t)) as data
    FROM tasks t
    UNION ALL
    SELECT
        'work_reports' as table_name,
        COUNT(*) as row_count,
        json_agg(row_to_json(t)) as data
    FROM work_reports t
    UNION ALL
    SELECT
        'work_accounting' as table_name,
        COUNT(*) as row_count,
        json_agg(row_to_json(t)) as data
    FROM work_accounting t
    UNION ALL
    SELECT
        'work_accounting_items' as table_name,
        COUNT(*) as row_count,
        json_agg(row_to_json(t)) as data
    FROM work_accounting_items t
    UNION ALL
    SELECT
        'work_report_comments' as table_name,
        COUNT(*) as row_count,
        json_agg(row_to_json(t)) as data
    FROM work_report_comments t
    UNION ALL
    SELECT
        'work_report_images' as table_name,
        COUNT(*) as row_count,
        json_agg(row_to_json(t)) as data
    FROM work_report_images t
    UNION ALL
    SELECT
        'notifications' as table_name,
        COUNT(*) as row_count,
        json_agg(row_to_json(t)) as data
    FROM notifications t
)
SELECT json_build_object(
    'backup_date', NOW(),
    'backup_type', 'full_database',
    'tables', json_agg(
        json_build_object(
            'table_name', table_name,
            'row_count', row_count,
            'data', data
        )
    )
) as full_backup
FROM table_info;