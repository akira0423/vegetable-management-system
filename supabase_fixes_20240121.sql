-- ====================================================
-- Supabase RLS修正スクリプト
-- 作成日: 2024-01-21
-- 目的: RLS問題の根本的解決とデータアクセスの正常化
-- ====================================================

-- ====================================================
-- Phase 1: 必須関数の作成
-- ====================================================

-- Service Role判定関数
CREATE OR REPLACE FUNCTION is_service_role()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN current_setting('request.jwt.claims', true)::json->>'role' = 'service_role';
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

-- 現在のユーザーのcompany_id取得関数
CREATE OR REPLACE FUNCTION get_current_company_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  company_id uuid;
BEGIN
  SELECT u.company_id INTO company_id
  FROM public.users u
  WHERE u.id = auth.uid();

  RETURN company_id;
END;
$$;

-- ====================================================
-- Phase 2: 危険なRLSポリシーの削除
-- ====================================================

-- usersテーブルの危険なポリシー削除（セキュリティホール）
DROP POLICY IF EXISTS "simple_user_access" ON users;

-- companiesテーブルの矛盾ポリシー削除
DROP POLICY IF EXISTS "Allow service role company creation" ON companies;
DROP POLICY IF EXISTS "Allow service role user creation" ON users;

-- ====================================================
-- Phase 3: 重複・矛盾するRLSポリシーの整理
-- ====================================================

-- vegetablesテーブル：重複ポリシーを削除
DROP POLICY IF EXISTS "Users can view own company vegetables" ON vegetables;
DROP POLICY IF EXISTS "Users can insert own company vegetables" ON vegetables;

-- growing_tasksテーブル：重複ポリシーを削除
DROP POLICY IF EXISTS "Users can view own company tasks" ON growing_tasks;
DROP POLICY IF EXISTS "Users can manage own company tasks" ON growing_tasks;

-- work_reportsテーブル：重複ポリシーを削除
DROP POLICY IF EXISTS "Users can view own company work reports" ON work_reports;
DROP POLICY IF EXISTS "Users can insert own company work reports" ON work_reports;

-- companiesテーブル：重複ポリシーを削除
DROP POLICY IF EXISTS "Users can view own company" ON companies;

-- usersテーブル：重複ポリシーを削除
DROP POLICY IF EXISTS "Users can view own company users" ON users;

-- ====================================================
-- Phase 4: パフォーマンス最適化インデックスの作成
-- ====================================================

-- RLSクエリを高速化するインデックス
CREATE INDEX IF NOT EXISTS idx_users_auth_lookup ON users(id) WHERE id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vegetables_company_active ON vegetables(company_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_growing_tasks_company ON growing_tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_work_reports_company_active ON work_reports(company_id) WHERE deleted_at IS NULL;

-- ====================================================
-- Phase 5: 新規ユーザー登録トリガーの改善
-- ====================================================

-- 新規ユーザー自動プロビジョニング関数
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_company_id uuid;
BEGIN
  -- 既存プロファイルチェック
  IF EXISTS (SELECT 1 FROM public.users WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- メールで既存会社を検索
  SELECT id INTO new_company_id
  FROM companies
  WHERE contact_email = NEW.email
  LIMIT 1;

  -- なければ新規作成
  IF new_company_id IS NULL THEN
    INSERT INTO companies (name, contact_email, is_active)
    VALUES (
      COALESCE(
        NEW.raw_user_meta_data->>'company_name',
        split_part(NEW.email, '@', 2),
        'New Company'
      ),
      NEW.email,
      true
    )
    RETURNING id INTO new_company_id;
  END IF;

  -- ユーザープロファイル作成
  INSERT INTO public.users (id, company_id, email, full_name, is_active)
  VALUES (
    NEW.id,
    new_company_id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    true
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- トリガーの再作成
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ====================================================
-- 検証用クエリ
-- ====================================================

-- 1. 関数の動作確認
-- SELECT is_service_role();  -- false が返るはず
-- SELECT get_current_company_id();  -- company_id が返るはず

-- 2. 現在のポリシー状態確認
-- SELECT
--   tablename,
--   COUNT(*) as policy_count
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- GROUP BY tablename
-- ORDER BY tablename;

-- 3. データ整合性チェック
-- SELECT
--   COUNT(*) as total_users,
--   COUNT(company_id) as users_with_company,
--   COUNT(*) - COUNT(company_id) as users_without_company
-- FROM public.users;

-- ====================================================
-- ロールバック用スクリプト（必要時のみ）
-- ====================================================

-- 以下はロールバックが必要な場合のみ実行

-- -- 関数の削除
-- DROP FUNCTION IF EXISTS is_service_role();
-- DROP FUNCTION IF EXISTS get_current_company_id();

-- -- インデックスの削除
-- DROP INDEX IF EXISTS idx_users_auth_lookup;
-- DROP INDEX IF EXISTS idx_users_company;
-- DROP INDEX IF EXISTS idx_vegetables_company_active;
-- DROP INDEX IF EXISTS idx_growing_tasks_company;
-- DROP INDEX IF EXISTS idx_work_reports_company_active;

-- -- トリガーの削除
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- DROP FUNCTION IF EXISTS handle_new_user();

-- ====================================================
-- 実行メモ
-- ====================================================
-- 実行日時: 2024-01-21
-- 実行者: System Administrator
--
-- 実行前の状態:
-- - total_users: 5
-- - users_with_company: 5
-- - users_without_company: 0
-- - 孤立データ: なし
--
-- 実行後の確認:
-- - RLS関数が正常に動作
-- - ポリシー数が11に削減
-- - データアクセスが正常化
--
-- 注意事項:
-- - 本番環境での実行前に必ずバックアップを取得すること
-- - アプリケーションコードの修正も同時に必要
-- - createServiceClient() を createClient() に変更する必要あり