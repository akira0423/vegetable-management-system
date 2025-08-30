-- 実際のテーブル構造に基づくテストデータ作成
-- Supabase SQLエディタで実行してください

-- テスト企業を作成（実際の構造に基づく）
INSERT INTO companies (id, name, contact_email, is_active)
VALUES (
  'a1111111-1111-1111-1111-111111111111'::uuid,
  'テスト企業',
  'contact@test-company.com',
  true
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  contact_email = EXCLUDED.contact_email,
  updated_at = now();

-- usersテーブルの構造を確認（念のため再度確認）
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'users' 
ORDER BY ordinal_position;

-- 上記の結果に基づいて、実際に存在するカラムのみでテストユーザーを作成
-- （この部分は上記の確認結果を見てから最終調整が必要）

-- 成功メッセージ
SELECT '✅ 企業テストデータが作成されました' as message;
SELECT COUNT(*) as company_count FROM companies WHERE id = 'a1111111-1111-1111-1111-111111111111'::uuid;