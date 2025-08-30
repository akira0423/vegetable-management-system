-- 実際のテーブル構造に基づくテストユーザー作成
-- usersテーブル構造: id, company_id, email, full_name, is_active, last_login_at, settings, created_at, updated_at

-- テストユーザーを作成
INSERT INTO users (
  id,
  company_id,
  email,
  full_name,
  is_active,
  last_login_at
) VALUES 
  (
    gen_random_uuid(),
    'a1111111-1111-1111-1111-111111111111'::uuid,
    'admin@test.com',
    '田中 太郎',
    true,
    now() - interval '1 hour'
  ),
  (
    gen_random_uuid(),
    'a1111111-1111-1111-1111-111111111111'::uuid,
    'manager@test.com',
    '佐藤 花子',
    true,
    now() - interval '2 hours'
  ),
  (
    gen_random_uuid(),
    'a1111111-1111-1111-1111-111111111111'::uuid,
    'operator1@test.com',
    '山田 次郎',
    true,
    now() - interval '1 day'
  ),
  (
    gen_random_uuid(),
    'a1111111-1111-1111-1111-111111111111'::uuid,
    'operator2@test.com',
    '鈴木 美咲',
    false,
    now() - interval '1 week'
  ),
  (
    gen_random_uuid(),
    'a1111111-1111-1111-1111-111111111111'::uuid,
    'newuser@test.com',
    '高橋 健一',
    true,
    null
  )
ON CONFLICT (email) DO NOTHING;

-- 成功メッセージ
SELECT '✅ テストユーザーが正常に作成されました' as message;
SELECT COUNT(*) as user_count FROM users WHERE company_id = 'a1111111-1111-1111-1111-111111111111'::uuid;