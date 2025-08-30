-- テーブル構造を確認するクエリ
-- Supabase SQLエディタでこれを実行して、実際のカラム名を確認してください

-- companiesテーブルの構造を確認
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'companies' 
ORDER BY ordinal_position;

-- usersテーブルの構造を確認
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- user_activity_statsテーブルの構造を確認
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'user_activity_stats' 
ORDER BY ordinal_position;