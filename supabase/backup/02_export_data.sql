-- ============================================
-- Supabase データエクスポート用SQL
-- 実行日: 2025-09-15
-- ============================================
-- 各テーブルのデータをJSON形式でエクスポート
-- このSQLをSupabase SQL Editorで実行して結果を保存してください

-- 1. companies テーブルのデータ
SELECT json_agg(row_to_json(t)) as companies_data
FROM (SELECT * FROM companies ORDER BY id) t;

-- 2. users テーブルのデータ
SELECT json_agg(row_to_json(t)) as users_data
FROM (SELECT * FROM users ORDER BY id) t;

-- 3. vegetables テーブルのデータ
SELECT json_agg(row_to_json(t)) as vegetables_data
FROM (SELECT * FROM vegetables ORDER BY id) t;

-- 4. plots テーブルのデータ
SELECT json_agg(row_to_json(t)) as plots_data
FROM (SELECT * FROM plots ORDER BY id) t;

-- 5. tasks テーブルのデータ
SELECT json_agg(row_to_json(t)) as tasks_data
FROM (SELECT * FROM tasks ORDER BY id) t;

-- 6. work_reports テーブルのデータ
SELECT json_agg(row_to_json(t)) as work_reports_data
FROM (SELECT * FROM work_reports ORDER BY id) t;

-- 7. work_accounting テーブルのデータ
SELECT json_agg(row_to_json(t)) as work_accounting_data
FROM (SELECT * FROM work_accounting ORDER BY id) t;

-- 8. work_accounting_items テーブルのデータ
SELECT json_agg(row_to_json(t)) as work_accounting_items_data
FROM (SELECT * FROM work_accounting_items ORDER BY id) t;

-- 9. work_report_comments テーブルのデータ
SELECT json_agg(row_to_json(t)) as work_report_comments_data
FROM (SELECT * FROM work_report_comments ORDER BY id) t;

-- 10. work_report_images テーブルのデータ
SELECT json_agg(row_to_json(t)) as work_report_images_data
FROM (SELECT * FROM work_report_images ORDER BY id) t;

-- 11. notifications テーブルのデータ
SELECT json_agg(row_to_json(t)) as notifications_data
FROM (SELECT * FROM notifications ORDER BY id) t;

-- ============================================
-- CSV形式でのエクスポート（代替方法）
-- ============================================
-- 以下のCOPY文を使用してCSV形式でもエクスポート可能
-- ただし、Supabase SQLエディタでは直接ファイル出力できないため、
-- SELECT文の結果をコピー＆ペーストで保存する必要があります

-- companies テーブル（CSV形式用）
SELECT
    id,
    name,
    description,
    contact_email,
    contact_phone,
    address,
    created_at,
    updated_at
FROM companies
ORDER BY id;

-- users テーブル（CSV形式用）
SELECT
    id,
    company_id,
    name,
    email,
    role,
    is_active,
    created_at,
    updated_at
FROM users
ORDER BY id;

-- vegetables テーブル（CSV形式用）
SELECT
    id,
    company_id,
    name,
    variety,
    description,
    planting_date,
    expected_harvest_date,
    actual_harvest_date,
    area_size,
    expected_yield,
    actual_yield,
    plot_number,
    status,
    notes,
    created_at,
    updated_at
FROM vegetables
ORDER BY id;

-- tasks テーブル（CSV形式用）
SELECT
    id,
    company_id,
    vegetable_id,
    name,
    description,
    start_date,
    end_date,
    status,
    priority,
    progress,
    assigned_to,
    task_type,
    parent_task_id,
    created_by,
    created_at,
    updated_at
FROM tasks
ORDER BY id;

-- work_reports テーブル（CSV形式用）
SELECT
    id,
    company_id,
    vegetable_id,
    task_id,
    user_id,
    work_date,
    work_type,
    work_duration,
    worker_count,
    weather,
    temperature,
    humidity,
    harvest_amount,
    harvest_unit,
    harvest_quality,
    work_notes,
    created_at,
    updated_at
FROM work_reports
ORDER BY id;