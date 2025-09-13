-- 現在のSupabaseスキーマを完全に取得するSQL
-- Supabase SQL Editorで実行してください

-- ============================================
-- STEP 1: テーブル構造の完全な取得
-- ============================================

WITH table_info AS (
    SELECT
        c.table_name,
        json_build_object(
            'table_name', c.table_name,
            'columns', json_agg(
                json_build_object(
                    'column_name', c.column_name,
                    'data_type', c.data_type,
                    'is_nullable', c.is_nullable,
                    'column_default', c.column_default,
                    'character_maximum_length', c.character_maximum_length,
                    'numeric_precision', c.numeric_precision,
                    'numeric_scale', c.numeric_scale
                ) ORDER BY c.ordinal_position
            )
        ) AS table_structure
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
    GROUP BY c.table_name
)
SELECT json_agg(table_structure) AS database_schema
FROM table_info;

-- ============================================
-- STEP 2: 主要テーブルのレコード数確認
-- ============================================

SELECT
    'companies' as table_name, COUNT(*) as record_count FROM public.companies
UNION ALL
SELECT
    'users', COUNT(*) FROM public.users
UNION ALL
SELECT
    'vegetables', COUNT(*) FROM public.vegetables
UNION ALL
SELECT
    'vegetables (active)', COUNT(*) FROM public.vegetables WHERE deleted_at IS NULL
UNION ALL
SELECT
    'growing_tasks', COUNT(*) FROM public.growing_tasks
UNION ALL
SELECT
    'work_reports', COUNT(*) FROM public.work_reports
UNION ALL
SELECT
    'farm_areas', COUNT(*) FROM public.farm_areas
UNION ALL
SELECT
    'pesticide_applications', COUNT(*) FROM public.pesticide_applications
UNION ALL
SELECT
    'pesticide_masters', COUNT(*) FROM public.pesticide_masters
ORDER BY table_name;

-- ============================================
-- STEP 3: 外部キー関係の取得
-- ============================================

SELECT
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- ============================================
-- STEP 4: インデックス情報の取得
-- ============================================

SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND indexname NOT LIKE '%_pkey'  -- 主キー以外のインデックス
ORDER BY tablename, indexname;

-- ============================================
-- STEP 5: RLSポリシーの確認
-- ============================================

SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================
-- STEP 6: RLS有効状態の確認
-- ============================================

SELECT
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================
-- STEP 7: ストレージバケットの確認
-- ============================================

SELECT * FROM storage.buckets;

-- ============================================
-- STEP 8: ストレージポリシーの確認
-- ============================================

SELECT
    name,
    bucket_id,
    role,
    operation,
    definition
FROM storage.policies
ORDER BY bucket_id, name;

-- ============================================
-- STEP 9: 関数の一覧取得
-- ============================================

SELECT
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments,
    pg_get_function_result(p.oid) AS return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- ============================================
-- STEP 10: データサンプル取得（各テーブル最新5件）
-- ============================================

-- companies
SELECT * FROM public.companies ORDER BY created_at DESC LIMIT 5;

-- users
SELECT id, email, name, company_id, role, created_at FROM public.users ORDER BY created_at DESC LIMIT 5;

-- vegetables
SELECT * FROM public.vegetables WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 5;

-- growing_tasks
SELECT * FROM public.growing_tasks ORDER BY created_at DESC LIMIT 5;

-- work_reports
SELECT * FROM public.work_reports ORDER BY created_at DESC LIMIT 5;

-- farm_areas
SELECT id, company_id, name, area_type, created_at FROM public.farm_areas ORDER BY created_at DESC LIMIT 5;