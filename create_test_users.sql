-- テスト用ユーザーデータの作成
-- このファイルはSupabase SQLエディタで実行してください

-- まず、テスト用の企業を作成（存在しない場合）
-- NOT NULL制約のあるカラムも含める
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

-- 一時的にRLS（Row Level Security）を無効化してテストデータを挿入
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- テスト用ユーザーを作成
-- usersテーブルがauth.usersに依存している場合のためのワークアラウンド
DO $$
DECLARE
  test_company_id uuid := 'a1111111-1111-1111-1111-111111111111'::uuid;
  user_id1 uuid := gen_random_uuid();
  user_id2 uuid := gen_random_uuid();
  user_id3 uuid := gen_random_uuid();
  user_id4 uuid := gen_random_uuid();
  user_id5 uuid := gen_random_uuid();
BEGIN
  -- auth.usersテーブルに仮のエントリを作成（必要に応じて）
  BEGIN
    INSERT INTO auth.users (id, email) VALUES 
      (user_id1, 'admin@test.com'),
      (user_id2, 'manager@test.com'),
      (user_id3, 'operator1@test.com'),
      (user_id4, 'operator2@test.com'),
      (user_id5, 'newuser@test.com')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION
    WHEN others THEN
      -- auth.usersに直接挿入できない場合は無視
      NULL;
  END;

  -- usersテーブルに挿入（実際に存在するカラムのみ使用）
  INSERT INTO users (
    id,
    company_id,
    email,
    full_name,
    role,
    is_active,
    phone,
    last_login_at
  ) VALUES 
    (
      user_id1,
      test_company_id,
      'admin@test.com',
      '田中 太郎',
      'admin',
      true,
      '090-1234-5678',
      now() - interval '1 hour'
    ),
    (
      user_id2,
      test_company_id,
      'manager@test.com',
      '佐藤 花子',
      'manager',
      true,
      '090-2345-6789',
      now() - interval '2 hours'
    ),
    (
      user_id3,
      test_company_id,
      'operator1@test.com',
      '山田 次郎',
      'operator',
      true,
      '090-3456-7890',
      now() - interval '1 day'
    ),
    (
      user_id4,
      test_company_id,
      'operator2@test.com',
      '鈴木 美咲',
      'operator',
      false,
      '090-4567-8901',
      now() - interval '1 week'
    ),
    (
      user_id5,
      test_company_id,
      'newuser@test.com',
      '高橋 健一',
      'operator',
      true,
      '090-5678-9012',
      null
    )
  ON CONFLICT (id) DO NOTHING;

END $$;

-- ユーザー活動統計データも作成
INSERT INTO user_activity_stats (user_id, total_logins, reports_created, photos_uploaded, last_activity_at)
SELECT 
  u.id,
  (random() * 100)::integer,
  (random() * 50)::integer,
  (random() * 200)::integer,
  u.last_login_at
FROM users u
WHERE u.company_id = 'a1111111-1111-1111-1111-111111111111'::uuid
ON CONFLICT (user_id) DO NOTHING;

-- RLSを再度有効化
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 成功メッセージ
SELECT '✅ テストユーザーが正常に作成されました' as message;
SELECT COUNT(*) as user_count FROM users WHERE company_id = 'a1111111-1111-1111-1111-111111111111'::uuid;