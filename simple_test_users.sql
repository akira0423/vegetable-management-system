-- シンプルなテストデータ作成
-- まず存在するテーブルを確認

-- 存在するテーブル一覧を表示
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- companiesテーブルが存在するかチェック
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'companies'
) as companies_exists;

-- usersテーブルが存在するかチェック
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'users'
) as users_exists;