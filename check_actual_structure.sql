-- 実際のテーブル構造を正確に確認

-- companiesテーブルが存在するかチェック
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'companies'
) as companies_exists;

-- usersテーブルの実際の構造を確認（publicスキーマのみ）
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'users' 
ORDER BY ordinal_position;

-- 存在する場合、companiesテーブルの構造も確認
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'companies' 
ORDER BY ordinal_position;