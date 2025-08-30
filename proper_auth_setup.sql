-- 認証連携システムの正しい設定
-- 既存の問題を修正し、本質的な認証システムを構築

-- ====================================================================
-- 1. 既存のポリシーを削除して再設定
-- ====================================================================

-- 既存のRLSポリシーを削除
DROP POLICY IF EXISTS "Admins can view all users in their company" ON users;
DROP POLICY IF EXISTS "Users can update their own record" ON users;
DROP POLICY IF EXISTS "Admins can update users in their company" ON users;

-- usersテーブルのRLSを有効化
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- 2. 適切なRLSポリシーの設定
-- ====================================================================

-- 認証されたユーザーは同じ会社のユーザーを閲覧可能
CREATE POLICY "Users can view users in their company" ON users
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND 
    company_id IN (
      SELECT company_id FROM users 
      WHERE id = auth.uid()
    )
  );

-- ユーザーは自分の情報を更新可能
CREATE POLICY "Users can update their own record" ON users
  FOR UPDATE USING (auth.uid() = id);

-- 管理者は同じ会社のユーザーを更新可能
CREATE POLICY "Admins can update users in their company" ON users
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND
    company_id IN (
      SELECT company_id FROM users 
      WHERE id = auth.uid() 
      AND (settings->>'role' = 'admin' OR settings->>'role' = 'manager')
    )
  );

-- 認証されたユーザーは自分のレコードを挿入可能（初回ログイン時）
CREATE POLICY "Users can insert their own record" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ====================================================================
-- 3. トリガー関数の修正
-- ====================================================================

-- より堅牢なユーザー作成トリガー
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY definer SET search_path = public
AS $$
DECLARE
  default_company_id uuid := 'a1111111-1111-1111-1111-111111111111'::uuid;
BEGIN
  -- 新しいauth.userが作成されたときに、usersテーブルにもレコードを作成
  -- ただし、既に存在する場合は何もしない
  INSERT INTO public.users (id, company_id, email, full_name, is_active, settings)
  VALUES (
    new.id,
    default_company_id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    true,
    jsonb_build_object('role', 'operator')
  )
  ON CONFLICT (id) DO NOTHING; -- 既に存在する場合は何もしない
  
  RETURN new;
END;
$$;

-- トリガーを再作成
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- ====================================================================
-- 4. テスト用管理者ユーザーの確認・作成
-- ====================================================================

-- 既存のテストユーザーがあれば管理者権限を付与
UPDATE users 
SET settings = jsonb_build_object('role', 'admin')
WHERE email IN ('admin@test.com', 'test@example.com', 'admin@example.com')
AND company_id = 'a1111111-1111-1111-1111-111111111111'::uuid;

-- 成功メッセージ
SELECT '✅ 認証システムが正しく設定されました' as message;
SELECT '🔐 RLSポリシーが適切に設定されました' as rls_status;
SELECT '🚀 ログイン問題が解決されるはずです' as login_status;