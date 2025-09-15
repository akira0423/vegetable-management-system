-- ============================================
-- Supabase スキーマエクスポート用SQL
-- 実行日: 2025-09-15
-- ============================================
-- このSQLをSupabase SQL Editorで実行して結果をコピー保存してください

-- 1. すべてのテーブル定義を取得
SELECT
    'CREATE TABLE IF NOT EXISTS ' || schemaname || '.' || tablename || ' (' || chr(10) ||
    string_agg(
        '    ' || column_name || ' ' || data_type ||
        CASE
            WHEN character_maximum_length IS NOT NULL
            THEN '(' || character_maximum_length || ')'
            ELSE ''
        END ||
        CASE
            WHEN is_nullable = 'NO'
            THEN ' NOT NULL'
            ELSE ''
        END ||
        CASE
            WHEN column_default IS NOT NULL
            THEN ' DEFAULT ' || column_default
            ELSE ''
        END,
        ',' || chr(10)
    ) || chr(10) || ');' as create_statement
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- 2. すべてのインデックスを取得
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 3. すべての外部キー制約を取得
SELECT
    tc.table_schema,
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    'ALTER TABLE ' || tc.table_schema || '.' || tc.table_name ||
    ' ADD CONSTRAINT ' || tc.constraint_name ||
    ' FOREIGN KEY (' || kcu.column_name || ')' ||
    ' REFERENCES ' || ccu.table_schema || '.' || ccu.table_name ||
    '(' || ccu.column_name || ');' as add_constraint_sql
FROM
    information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public';

-- 4. すべてのRLSポリシーを取得
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check,
    'CREATE POLICY ' || policyname || ' ON ' || schemaname || '.' || tablename ||
    ' AS ' || permissive ||
    ' FOR ' || cmd ||
    ' TO ' || array_to_string(roles, ', ') ||
    CASE WHEN qual IS NOT NULL THEN ' USING (' || qual || ')' ELSE '' END ||
    CASE WHEN with_check IS NOT NULL THEN ' WITH CHECK (' || with_check || ')' ELSE '' END ||
    ';' as create_policy_sql
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 5. RLSが有効になっているテーブルを確認
SELECT
    schemaname,
    tablename,
    'ALTER TABLE ' || schemaname || '.' || tablename || ' ENABLE ROW LEVEL SECURITY;' as enable_rls_sql
FROM pg_tables
WHERE schemaname = 'public'
    AND rowsecurity = true
ORDER BY tablename;

-- 6. すべての関数・トリガーを取得
SELECT
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY function_name;

-- 7. すべてのトリガーを取得
SELECT
    trigger_schema,
    trigger_name,
    event_manipulation,
    event_object_schema,
    event_object_table,
    action_statement,
    action_orientation,
    action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 8. すべてのビューを取得
SELECT
    schemaname,
    viewname,
    definition
FROM pg_views
WHERE schemaname = 'public'
ORDER BY viewname;

-- 9. シーケンスを取得
SELECT
    sequence_schema,
    sequence_name,
    data_type,
    start_value,
    minimum_value,
    maximum_value,
    increment,
    cycle_option
FROM information_schema.sequences
WHERE sequence_schema = 'public'
ORDER BY sequence_name;

-- 10. 権限設定を取得
SELECT
    grantor,
    grantee,
    table_schema,
    table_name,
    privilege_type,
    is_grantable,
    with_hierarchy
FROM information_schema.table_privileges
WHERE table_schema = 'public'
ORDER BY table_name, grantee, privilege_type;