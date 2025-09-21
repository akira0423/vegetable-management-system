-- ====================================================
-- 会計テーブルのRLSポリシー修正
-- 作成日: 2025-01-21
-- 目的: accounting_itemsとwork_report_accountingテーブルにRLSポリシーを追加
-- ====================================================

-- ====================================================
-- 1. RLSを有効化
-- ====================================================
ALTER TABLE accounting_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_report_accounting ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_recommendations ENABLE ROW LEVEL SECURITY;

-- ====================================================
-- 2. accounting_items テーブルのポリシー
-- ====================================================

-- 既存のポリシーを削除（存在する場合）
DROP POLICY IF EXISTS "Users can view accounting items" ON accounting_items;
DROP POLICY IF EXISTS "accounting_items_select_policy" ON accounting_items;
DROP POLICY IF EXISTS "accounting_items_insert_policy" ON accounting_items;

-- 全ユーザーが勘定科目マスタを参照可能（マスタデータなので）
CREATE POLICY "accounting_items_select_all" ON accounting_items
  FOR SELECT
  USING (true);

-- ====================================================
-- 3. work_report_accounting テーブルのポリシー
-- ====================================================

-- 既存のポリシーを削除（存在する場合）
DROP POLICY IF EXISTS "work_report_accounting_select_policy" ON work_report_accounting;
DROP POLICY IF EXISTS "work_report_accounting_insert_policy" ON work_report_accounting;
DROP POLICY IF EXISTS "work_report_accounting_update_policy" ON work_report_accounting;
DROP POLICY IF EXISTS "work_report_accounting_delete_policy" ON work_report_accounting;

-- 自社のwork_reportに関連する会計データのみアクセス可能
CREATE POLICY "work_report_accounting_company_access" ON work_report_accounting
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM work_reports wr
      WHERE wr.id = work_report_accounting.work_report_id
      AND wr.company_id = get_current_company_id()
    )
  );

-- ====================================================
-- 4. accounting_recommendations テーブルのポリシー
-- ====================================================

-- 既存のポリシーを削除（存在する場合）
DROP POLICY IF EXISTS "accounting_recommendations_select" ON accounting_recommendations;
DROP POLICY IF EXISTS "accounting_recommendations_insert" ON accounting_recommendations;
DROP POLICY IF EXISTS "accounting_recommendations_update" ON accounting_recommendations;

-- 自社の推奨データのみアクセス可能
CREATE POLICY "accounting_recommendations_company_access" ON accounting_recommendations
  FOR ALL
  USING (company_id = get_current_company_id());

-- ====================================================
-- 5. データ確認クエリ
-- ====================================================

-- RLSポリシーの確認
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('accounting_items', 'work_report_accounting', 'accounting_recommendations')
ORDER BY tablename, policyname;

-- RLSが有効になっているか確認
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('accounting_items', 'work_report_accounting', 'accounting_recommendations')
ORDER BY tablename;

-================================================
-- メモ
-- ====================================================
-- このスクリプトを実行することで：
-- 1. accounting_items: 全ユーザーが参照可能（マスタデータ）
-- 2. work_report_accounting: 自社のwork_reportに紐づくデータのみアクセス可能
-- 3. accounting_recommendations: 自社のデータのみアクセス可能
--
-- 注意: get_current_company_id() 関数が既に存在している前提- ====