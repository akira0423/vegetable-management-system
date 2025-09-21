-- ====================================================
-- RLSポリシー削除前のバックアップ
-- 作成日: 2024-01-21
-- 目的: ロールバック用のポリシー再作成スクリプト
-- ====================================================

-- ====================================================
-- 削除したポリシーの再作成（ロールバック用）
-- 注意: これらは問題のあるポリシーです。緊急時のみ使用
-- ====================================================

-- usersテーブルの削除したポリシー
CREATE POLICY "simple_user_access" ON users
  FOR ALL USING (true);

CREATE POLICY "Allow service role user creation" ON users
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own company users" ON users
  FOR SELECT USING (
    company_id = (SELECT users_1.company_id FROM users users_1 WHERE users_1.id = auth.uid())
  );

-- companiesテーブルの削除したポリシー
CREATE POLICY "Allow service role company creation" ON companies
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own company" ON companies
  FOR SELECT USING (
    id = (SELECT users.company_id FROM users WHERE users.id = auth.uid())
  );

-- vegetablesテーブルの削除したポリシー
CREATE POLICY "Users can view own company vegetables" ON vegetables
  FOR SELECT USING (
    company_id = (SELECT users.company_id FROM users WHERE users.id = auth.uid())
  );

CREATE POLICY "Users can insert own company vegetables" ON vegetables
  FOR INSERT WITH CHECK (
    company_id = (SELECT users.company_id FROM users WHERE users.id = auth.uid())
  );

-- growing_tasksテーブルの削除したポリシー
CREATE POLICY "Users can view own company tasks" ON growing_tasks
  FOR SELECT USING (
    vegetable_id IN (
      SELECT vegetables.id FROM vegetables
      WHERE vegetables.company_id = (
        SELECT users.company_id FROM users WHERE users.id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage own company tasks" ON growing_tasks
  FOR ALL USING (
    vegetable_id IN (
      SELECT vegetables.id FROM vegetables
      WHERE vegetables.company_id = (
        SELECT users.company_id FROM users WHERE users.id = auth.uid()
      )
    )
  );

-- work_reportsテーブルの削除したポリシー
CREATE POLICY "Users can view own company work reports" ON work_reports
  FOR SELECT USING (
    vegetable_id IN (
      SELECT vegetables.id FROM vegetables
      WHERE vegetables.company_id = (
        SELECT users.company_id FROM users WHERE users.id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert own company work reports" ON work_reports
  FOR INSERT WITH CHECK (
    vegetable_id IN (
      SELECT vegetables.id FROM vegetables
      WHERE vegetables.company_id = (
        SELECT users.company_id FROM users WHERE users.id = auth.uid()
      )
    )
  );

-- ====================================================
-- 現在のポリシー状態（修正後）
-- ====================================================

-- 各テーブルに残っているポリシー：
-- vegetables: vegetables_access
-- growing_tasks: growing_tasks_access
-- work_reports: work_reports_access
-- companies: companies_access
-- users: (削除後に残るポリシーを確認)
-- photos: photos_select_policy
-- work_report_accounting: 4つのCRUDポリシー
-- accounting_items: 2つのポリシー

-- ====================================================
-- 完全な状態復元用コマンド
-- ====================================================

-- 修正を完全に元に戻す場合：
-- 1. 作成した関数を削除
-- DROP FUNCTION IF EXISTS is_service_role();
-- DROP FUNCTION IF EXISTS get_current_company_id();
-- DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- 2. インデックスを削除
-- DROP INDEX IF EXISTS idx_users_auth_lookup;
-- DROP INDEX IF EXISTS idx_users_company;
-- DROP INDEX IF EXISTS idx_vegetables_company_active;
-- DROP INDEX IF EXISTS idx_growing_tasks_company;
-- DROP INDEX IF EXISTS idx_work_reports_company_active;

-- 3. 上記の削除したポリシーを再作成

-- ====================================================
-- メモ
-- ====================================================
-- 削除したポリシーの問題点：
-- 1. simple_user_access: 全ユーザーが全データにアクセス可能（重大なセキュリティホール）
-- 2. 重複ポリシー: 同じ目的のポリシーが複数存在し、競合の原因
-- 3. Service role依存: 本来不要な権限昇格を要求
--
-- これらのポリシーは問題があるため、
-- 再作成は推奨されません。