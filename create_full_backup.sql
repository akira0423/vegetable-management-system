-- Supabase完全バックアップスクリプト
-- 実行日: 2025-09-14
--
-- このスクリプトは3つの部分に分かれています：
-- 1. スキーマ構造の完全バックアップ
-- 2. データの完全バックアップ
-- 3. 復元用スクリプト

-- ============================================
-- PART 1: スキーマ構造のバックアップ
-- ============================================

-- すべてのテーブルのCREATE文を生成
SELECT
    'CREATE TABLE IF NOT EXISTS ' || table_name || ' (' || chr(10) ||
    string_agg(
        '    ' || column_name || ' ' ||
        CASE
            WHEN data_type = 'character varying' THEN 'varchar(' || character_maximum_length || ')'
            WHEN data_type = 'numeric' THEN 'numeric(' || numeric_precision || ',' || numeric_scale || ')'
            WHEN data_type = 'timestamp with time zone' THEN 'timestamptz'
            WHEN data_type = 'timestamp without time zone' THEN 'timestamp'
            WHEN data_type = 'boolean' THEN 'boolean'
            WHEN data_type = 'integer' THEN 'integer'
            WHEN data_type = 'bigint' THEN 'bigint'
            WHEN data_type = 'text' THEN 'text'
            WHEN data_type = 'uuid' THEN 'uuid'
            WHEN data_type = 'jsonb' THEN 'jsonb'
            WHEN data_type = 'date' THEN 'date'
            WHEN data_type = 'time without time zone' THEN 'time'
            WHEN data_type = 'double precision' THEN 'double precision'
            WHEN data_type = 'real' THEN 'real'
            WHEN data_type = 'USER-DEFINED' THEN udt_name
            ELSE data_type
        END ||
        CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
        CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END,
        ',' || chr(10) ORDER BY ordinal_position
    ) || chr(10) || ');' AS create_statement
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY table_name
ORDER BY table_name;

-- ============================================
-- PART 2: データのJSONバックアップ
-- ============================================

-- データを1つのJSONオブジェクトとして取得
WITH backup_data AS (
    SELECT json_build_object(
        'backup_date', CURRENT_TIMESTAMP,
        'database_version', version(),
        'tables', json_build_object(
            'companies', (SELECT json_agg(row_to_json(t)) FROM public.companies t),
            'users', (SELECT json_agg(row_to_json(t)) FROM public.users t),
            'vegetables', (SELECT json_agg(row_to_json(t)) FROM public.vegetables t),
            'growing_tasks', (SELECT json_agg(row_to_json(t)) FROM public.growing_tasks t),
            'work_reports', (SELECT json_agg(row_to_json(t)) FROM public.work_reports t),
            'farm_areas', (SELECT json_agg(row_to_json(t)) FROM public.farm_areas t),
            'pesticide_applications', (SELECT json_agg(row_to_json(t)) FROM public.pesticide_applications t),
            'pesticide_masters', (SELECT json_agg(row_to_json(t)) FROM public.pesticide_masters t),
            'photos', (SELECT json_agg(row_to_json(t)) FROM public.photos t)
        )
    ) AS full_backup
)
SELECT full_backup FROM backup_data;

-- ============================================
-- PART 3: CREATE文で完全な復元スクリプト生成
-- ============================================

-- このクエリを実行して結果をコピーし、restore_schema.sqlとして保存
WITH RECURSIVE table_deps AS (
    -- テーブルの依存関係を解決
    SELECT
        c.table_name,
        c.table_name AS base_table,
        0 AS level
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
        AND NOT EXISTS (
            SELECT 1
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_schema = 'public'
                AND tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_name = c.table_name
        )
    GROUP BY c.table_name

    UNION ALL

    SELECT
        tc.table_name,
        td.base_table,
        td.level + 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    JOIN table_deps td ON ccu.table_name = td.table_name
    WHERE tc.table_schema = 'public'
        AND tc.constraint_type = 'FOREIGN KEY'
),
ordered_tables AS (
    SELECT DISTINCT ON (table_name)
        table_name,
        MIN(level) AS min_level
    FROM table_deps
    GROUP BY table_name
    ORDER BY table_name, min_level
)
SELECT
    '-- Table: ' || ot.table_name || chr(10) ||
    'CREATE TABLE IF NOT EXISTS public.' || ot.table_name || ' (' || chr(10) ||
    string_agg(
        '    ' || c.column_name || ' ' ||
        CASE
            WHEN c.data_type = 'character varying' THEN 'varchar(' || c.character_maximum_length || ')'
            WHEN c.data_type = 'numeric' THEN 'numeric(' || c.numeric_precision || ',' || c.numeric_scale || ')'
            WHEN c.data_type = 'timestamp with time zone' THEN 'timestamptz'
            WHEN c.data_type = 'timestamp without time zone' THEN 'timestamp'
            WHEN c.data_type = 'USER-DEFINED' THEN c.udt_name
            ELSE c.data_type
        END ||
        CASE WHEN c.is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
        CASE WHEN c.column_default IS NOT NULL THEN ' DEFAULT ' || c.column_default ELSE '' END,
        ',' || chr(10) ORDER BY c.ordinal_position
    ) || chr(10) || ');' || chr(10) || chr(10) AS create_statement
FROM ordered_tables ot
JOIN information_schema.columns c ON ot.table_name = c.table_name
WHERE c.table_schema = 'public'
GROUP BY ot.table_name, ot.min_level
ORDER BY ot.min_level, ot.table_name;

-- ============================================
-- PART 4: 主キーと外部キー制約の追加
-- ============================================

-- 主キー制約
SELECT
    'ALTER TABLE public.' || tc.table_name ||
    ' ADD CONSTRAINT ' || tc.constraint_name ||
    ' PRIMARY KEY (' || string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) || ');'
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
    AND tc.constraint_type = 'PRIMARY KEY'
GROUP BY tc.table_name, tc.constraint_name
ORDER BY tc.table_name;

-- 外部キー制約
SELECT
    'ALTER TABLE public.' || tc.table_name ||
    ' ADD CONSTRAINT ' || tc.constraint_name ||
    ' FOREIGN KEY (' || kcu.column_name || ')' ||
    ' REFERENCES public.' || ccu.table_name || '(' || ccu.column_name || ')' ||
    CASE
        WHEN rc.delete_rule != 'NO ACTION' THEN ' ON DELETE ' || rc.delete_rule
        ELSE ''
    END ||
    CASE
        WHEN rc.update_rule != 'NO ACTION' THEN ' ON UPDATE ' || rc.update_rule
        ELSE ''
    END || ';'
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
    AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name;

-- ============================================
-- PART 5: インデックスの再作成
-- ============================================

SELECT
    indexdef || ';'
FROM pg_indexes
WHERE schemaname = 'public'
    AND indexname NOT LIKE '%_pkey'
ORDER BY tablename, indexname;

-- ============================================
-- PART 6: RLSポリシーのバックアップ
-- ============================================

SELECT
    '-- Enable RLS for ' || tablename || chr(10) ||
    'ALTER TABLE public.' || tablename || ' ENABLE ROW LEVEL SECURITY;' || chr(10) ||
    '-- Policy: ' || policyname || chr(10) ||
    'CREATE POLICY ' || policyname ||
    ' ON public.' || tablename ||
    CASE WHEN permissive = 'PERMISSIVE' THEN ' AS PERMISSIVE' ELSE ' AS RESTRICTIVE' END ||
    ' FOR ' || cmd ||
    ' TO ' || array_to_string(roles, ', ') ||
    CASE WHEN qual IS NOT NULL THEN chr(10) || ' USING (' || qual || ')' ELSE '' END ||
    CASE WHEN with_check IS NOT NULL THEN chr(10) || ' WITH CHECK (' || with_check || ')' ELSE '' END ||
    ';' AS policy_statement
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================
-- PART 7: 関数とトリガーのバックアップ
-- ============================================

-- 関数の完全な定義を取得
SELECT
    pg_get_functiondef(p.oid) || ';'
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- トリガーの定義を取得
SELECT
    'CREATE TRIGGER ' || trigger_name || chr(10) ||
    action_timing || ' ' || event_manipulation || chr(10) ||
    'ON ' || event_object_schema || '.' || event_object_table || chr(10) ||
    'FOR EACH ' || action_orientation || chr(10) ||
    action_statement || ';'
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;