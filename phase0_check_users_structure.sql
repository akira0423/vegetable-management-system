-- ====================================================
-- usersテーブルの構造確認
-- ====================================================

-- 1. usersテーブルのカラム一覧を確認
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'users'
ORDER BY ordinal_position;

-- 2. roleに関連しそうなカラムを検索
SELECT
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'users'
    AND (
        column_name LIKE '%role%' OR
        column_name LIKE '%admin%' OR
        column_name LIKE '%type%' OR
        column_name = 'is_admin' OR
        column_name = 'is_super_admin' OR
        column_name = 'user_type'
    )
ORDER BY column_name;

-- 3. auth.usersテーブルの構造も確認（Supabase認証）
SELECT
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'auth'
    AND table_name = 'users'
    AND column_name LIKE '%role%'
ORDER BY column_name;