-- ====================================================
-- Phase 0-1: RLSポリシーの整理と統合
-- 実行方法: Supabase SQL Editorで実行
-- 注意: トランザクション内で実行可能
-- ====================================================

BEGIN;

-- ====================================================
-- 1. accounting_itemsテーブルの重複ポリシー削除と統合
-- ====================================================

-- 既存の重複ポリシーをすべて削除
DROP POLICY IF EXISTS "All authenticated users can view accounting items" ON accounting_items;
DROP POLICY IF EXISTS "Only admins can manage accounting items" ON accounting_items;
DROP POLICY IF EXISTS "accounting_items_select_all" ON accounting_items;
DROP POLICY IF EXISTS "Users can view accounting items" ON accounting_items;
DROP POLICY IF EXISTS "accounting_items_select_policy" ON accounting_items;
DROP POLICY IF EXISTS "accounting_items_insert_policy" ON accounting_items;

-- 統合された読み取りポリシー（マスタデータなので全員読み取り可能）
CREATE POLICY "accounting_items_read_all" ON accounting_items
    FOR SELECT
    USING (true);

-- 管理者のみ編集可能
CREATE POLICY "accounting_items_admin_insert" ON accounting_items
    FOR INSERT
    WITH CHECK (
        auth.jwt()->>'role' = 'service_role' OR
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

CREATE POLICY "accounting_items_admin_update" ON accounting_items
    FOR UPDATE
    USING (
        auth.jwt()->>'role' = 'service_role' OR
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

CREATE POLICY "accounting_items_admin_delete" ON accounting_items
    FOR DELETE
    USING (
        auth.jwt()->>'role' = 'service_role' OR
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

-- ====================================================
-- 2. work_report_accountingテーブルの重複ポリシー削除と統合
-- ====================================================

-- 既存の重複ポリシーをすべて削除
DROP POLICY IF EXISTS "Users can delete their company work report accounting" ON work_report_accounting;
DROP POLICY IF EXISTS "Users can insert their company work report accounting" ON work_report_accounting;
DROP POLICY IF EXISTS "Users can update their company work report accounting" ON work_report_accounting;
DROP POLICY IF EXISTS "Users can view their company work report accounting" ON work_report_accounting;
DROP POLICY IF EXISTS "work_report_accounting_company_access" ON work_report_accounting;
DROP POLICY IF EXISTS "work_report_accounting_select_policy" ON work_report_accounting;
DROP POLICY IF EXISTS "work_report_accounting_insert_policy" ON work_report_accounting;
DROP POLICY IF EXISTS "work_report_accounting_update_policy" ON work_report_accounting;
DROP POLICY IF EXISTS "work_report_accounting_delete_policy" ON work_report_accounting;

-- 統合された単一ポリシー（パフォーマンス最適化済み）
CREATE POLICY "work_report_accounting_unified" ON work_report_accounting
    FOR ALL
    USING (
        auth.jwt()->>'role' = 'service_role' OR
        EXISTS (
            SELECT 1 FROM work_reports wr
            WHERE wr.id = work_report_accounting.work_report_id
            AND wr.company_id = get_current_company_id()
            AND wr.deleted_at IS NULL
        )
    )
    WITH CHECK (
        auth.jwt()->>'role' = 'service_role' OR
        EXISTS (
            SELECT 1 FROM work_reports wr
            WHERE wr.id = work_report_accounting.work_report_id
            AND wr.company_id = get_current_company_id()
        )
    );

-- ====================================================
-- 3. accounting_recommendationsテーブルの重複ポリシー削除と統合
-- ====================================================

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "accounting_recommendations_company_access" ON accounting_recommendations;
DROP POLICY IF EXISTS "accounting_recommendations_select" ON accounting_recommendations;
DROP POLICY IF EXISTS "accounting_recommendations_insert" ON accounting_recommendations;
DROP POLICY IF EXISTS "accounting_recommendations_update" ON accounting_recommendations;

-- 統合されたポリシー
CREATE POLICY "accounting_recommendations_unified" ON accounting_recommendations
    FOR ALL
    USING (
        auth.jwt()->>'role' = 'service_role' OR
        company_id = get_current_company_id()
    )
    WITH CHECK (
        auth.jwt()->>'role' = 'service_role' OR
        company_id = get_current_company_id()
    );

-- ====================================================
-- 4. 確認クエリ
-- ====================================================

-- ポリシー数の確認（重複がないことを確認）
DO $$
DECLARE
    policy_count INTEGER;
    table_record RECORD;
BEGIN
    FOR table_record IN
        SELECT tablename, COUNT(*) as count
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename IN ('accounting_items', 'work_report_accounting', 'accounting_recommendations')
        GROUP BY tablename
        HAVING COUNT(*) > 5
    LOOP
        RAISE WARNING 'Table % has % policies - possible duplication', table_record.tablename, table_record.count;
    END LOOP;

    RAISE NOTICE 'RLS policies cleanup completed successfully';
END $$;

COMMIT;

-- ====================================================
-- 実行後の確認用クエリ（別途実行）
-- ====================================================
/*
-- ポリシーの確認
SELECT
    tablename,
    COUNT(*) as policy_count,
    STRING_AGG(policyname, ', ') as policies
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN ('accounting_items', 'work_report_accounting', 'accounting_recommendations')
GROUP BY tablename
ORDER BY tablename;

-- RLS有効状態の確認
SELECT
    tablename,
    rowsecurity,
    CASE rowsecurity
        WHEN true THEN '✅ ENABLED'
        ELSE '❌ DISABLED'
    END AS status
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('accounting_items', 'work_report_accounting', 'accounting_recommendations')
ORDER BY tablename;
*/