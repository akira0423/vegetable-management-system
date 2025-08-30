-- 認証連携型ユーザー管理システム - データベース同期設定
-- Supabase SQLエディタで実行してください

-- ====================================================================
-- 1. auth.users と users テーブルの同期トリガー設定
-- ====================================================================

-- ユーザー作成時に自動でusersテーブルにレコード作成
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY definer SET search_path = public
AS $$
DECLARE
  default_company_id uuid := 'a1111111-1111-1111-1111-111111111111'::uuid;
BEGIN
  -- 新しいauth.userが作成されたときに、usersテーブルにもレコードを作成
  INSERT INTO public.users (id, company_id, email, full_name, is_active)
  VALUES (
    new.id,
    default_company_id, -- デフォルト企業ID（後で変更可能）
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, users.full_name),
    updated_at = now();
  
  RETURN new;
END;
$$;

-- トリガーを作成（auth.usersテーブルのINSERT時に実行）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- ====================================================================
-- 2. ユーザー更新時の同期トリガー
-- ====================================================================

-- auth.usersのメタデータ更新時にusersテーブルも更新
CREATE OR REPLACE FUNCTION handle_user_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY definer SET search_path = public
AS $$
BEGIN
  -- auth.usersが更新されたときに、usersテーブルも更新
  UPDATE public.users
  SET
    email = new.email,
    full_name = COALESCE(new.raw_user_meta_data->>'full_name', users.full_name),
    last_login_at = COALESCE(new.last_sign_in_at, users.last_login_at),
    updated_at = now()
  WHERE id = new.id;
  
  RETURN new;
END;
$$;

-- トリガーを作成（auth.usersテーブルのUPDATE時に実行）
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_user_update();

-- ====================================================================
-- 3. RLS (Row Level Security) ポリシーの設定
-- ====================================================================

-- usersテーブルのRLSを有効化
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 管理者は全てのユーザーを閲覧可能
CREATE POLICY "Admins can view all users in their company" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users admin_user
      WHERE admin_user.id = auth.uid()
      AND admin_user.company_id = users.company_id
      AND admin_user.settings->>'role' = 'admin'
    )
  );

-- ユーザーは自分の情報のみ更新可能
CREATE POLICY "Users can update their own record" ON users
  FOR UPDATE USING (auth.uid() = id);

-- 管理者は同じ会社のユーザーを更新可能
CREATE POLICY "Admins can update users in their company" ON users
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users admin_user
      WHERE admin_user.id = auth.uid()
      AND admin_user.company_id = users.company_id
      AND admin_user.settings->>'role' = 'admin'
    )
  );

-- ====================================================================
-- 4. 管理者ユーザーの作成（テスト用）
-- ====================================================================

-- 既存のテスト用管理者を設定
UPDATE users 
SET settings = jsonb_build_object('role', 'admin')
WHERE email = 'admin@test.com'
AND company_id = 'a1111111-1111-1111-1111-111111111111'::uuid;

-- 成功メッセージ
SELECT '✅ 認証連携システムが正常に設定されました' as message;
SELECT 'トリガー関数とRLSポリシーが作成されました' as details;