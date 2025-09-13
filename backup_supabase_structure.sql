-- Supabaseデータベース構造バックアップスクリプト
-- 実行日: 2025-09-14
--
-- このスクリプトを使用して現在のテーブル構造とデータをバックアップします。
-- Supabaseのダッシュボード > SQL Editor で以下のコマンドを実行してください。

-- ============================================
-- 1. 現在のテーブル構造をエクスポート
-- ============================================

-- テーブル定義を取得
SELECT
    'CREATE TABLE IF NOT EXISTS ' || schemaname || '.' || tablename || ' AS TABLE ' || schemaname || '.' || tablename || ' WITH NO DATA;' AS ddl
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================
-- 2. すべてのテーブルのカラム情報を取得
-- ============================================

SELECT
    t.table_name,
    array_to_json(array_agg(
        json_build_object(
            'column_name', c.column_name,
            'data_type', c.data_type,
            'is_nullable', c.is_nullable,
            'column_default', c.column_default,
            'character_maximum_length', c.character_maximum_length
        ) ORDER BY c.ordinal_position
    )) AS columns
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
GROUP BY t.table_name
ORDER BY t.table_name;

-- ============================================
-- 3. インデックス情報を取得
-- ============================================

SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- ============================================
-- 4. 外部キー制約を取得
-- ============================================

SELECT
    tc.table_schema,
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM
    information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- ============================================
-- 5. RLSポリシーを取得
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
-- 6. 関数とトリガーを取得
-- ============================================

-- 関数の取得
SELECT
    n.nspname AS schema_name,
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- トリガーの取得
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

-- ============================================
-- 7. 現在のデータカウントを取得
-- ============================================

DO $$
DECLARE
    r RECORD;
    query TEXT;
BEGIN
    FOR r IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
    LOOP
        query := format('SELECT ''%s'' AS table_name, COUNT(*) AS row_count FROM public.%I', r.tablename, r.tablename);
        RAISE NOTICE '%', query;
        EXECUTE query;
    END LOOP;
END $$;

-- ============================================
-- 8. 完全なスキーマダンプを生成
-- ============================================

-- これはSupabaseダッシュボードから実行
-- Database > Backups > Create a new backup
-- または以下のpg_dumpコマンドを使用：

/*
pg_dump \
  --host=your-project.supabase.co \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  --schema=public \
  --no-owner \
  --no-privileges \
  --no-tablespaces \
  --no-security-labels \
  --no-comments \
  --file=supabase_backup_$(date +%Y%m%d_%H%M%S).sql
*/

-- ============================================
-- 9. データのバックアップ（重要テーブル）
-- ============================================

-- CSVエクスポート用のCOPYコマンド例
-- Supabase SQL Editorで実行

-- companies テーブル
COPY (SELECT * FROM public.companies) TO '/tmp/companies_backup.csv' WITH CSV HEADER;

-- users テーブル
COPY (SELECT * FROM public.users) TO '/tmp/users_backup.csv' WITH CSV HEADER;

-- vegetables テーブル
COPY (SELECT * FROM public.vegetables WHERE deleted_at IS NULL) TO '/tmp/vegetables_backup.csv' WITH CSV HEADER;

-- growing_tasks テーブル
COPY (SELECT * FROM public.growing_tasks) TO '/tmp/growing_tasks_backup.csv' WITH CSV HEADER;

-- work_reports テーブル
COPY (SELECT * FROM public.work_reports) TO '/tmp/work_reports_backup.csv' WITH CSV HEADER;

-- farm_areas テーブル
COPY (SELECT * FROM public.farm_areas) TO '/tmp/farm_areas_backup.csv' WITH CSV HEADER;

-- pesticide_applications テーブル
COPY (SELECT * FROM public.pesticide_applications) TO '/tmp/pesticide_applications_backup.csv' WITH CSV HEADER;

-- ============================================
-- 10. JSONフォーマットでのデータエクスポート
-- ============================================

-- 各テーブルのデータをJSON形式で取得
SELECT json_agg(row_to_json(t)) FROM (SELECT * FROM public.companies) t;
SELECT json_agg(row_to_json(t)) FROM (SELECT * FROM public.users) t;
SELECT json_agg(row_to_json(t)) FROM (SELECT * FROM public.vegetables WHERE deleted_at IS NULL) t;
SELECT json_agg(row_to_json(t)) FROM (SELECT * FROM public.growing_tasks) t;
SELECT json_agg(row_to_json(t)) FROM (SELECT * FROM public.work_reports) t;
SELECT json_agg(row_to_json(t)) FROM (SELECT * FROM public.farm_areas) t;
SELECT json_agg(row_to_json(t)) FROM (SELECT * FROM public.pesticide_applications) t;

-- ============================================
-- 復元手順
-- ============================================

/*
復元する場合：

1. Supabaseで新しいプロジェクトを作成するか、既存のデータベースをクリア

2. スキーマを復元：
   - バックアップしたSQLファイルを実行
   - または上記のCREATE TABLE文を実行

3. データを復元：
   - CSVファイルからインポート
   - またはJSONデータをINSERT文に変換して実行

4. インデックスと制約を再作成

5. RLSポリシーを再適用

6. 関数とトリガーを再作成

重要：復元前に必ず現在のデータベースのバックアップを取ってください。
*/