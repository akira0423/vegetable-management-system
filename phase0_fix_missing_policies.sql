-- ====================================================
-- Phase 0-1 修正版: 不足しているRLSポリシーの追加
-- 問題: accounting_itemsに読み取りポリシーしかない
-- ====================================================

BEGIN;

-- ====================================================
-- 1. 現在の状態を確認
-- ====================================================
DO $$
BEGIN
    RAISE NOTICE '現在のポリシー状態を確認中...';

    -- accounting_itemsのポリシー数を確認
    IF (SELECT COUNT(*) FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'accounting_items') = 1 THEN
        RAISE NOTICE 'accounting_itemsに読み取りポリシーのみ検出。管理ポリシーを追加します。';
    END IF;
END $$;

-- ====================================================
-- 2. accounting_itemsの不足ポリシーを追加
-- ====================================================

-- 既存のポリシーを確認（読み取りは既に存在）
-- DROP POLICY IF EXISTS "accounting_items_read_all" ON accounting_items;

-- 管理者のみ挿入可能
CREATE POLICY IF NOT EXISTS "accounting_items_admin_insert" ON accounting_items
    FOR INSERT
    WITH CHECK (
        auth.jwt()->>'role' = 'service_role' OR
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

-- 管理者のみ更新可能
CREATE POLICY IF NOT EXISTS "accounting_items_admin_update" ON accounting_items
    FOR UPDATE
    USING (
        auth.jwt()->>'role' = 'service_role' OR
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

-- 管理者のみ削除可能
CREATE POLICY IF NOT EXISTS "accounting_items_admin_delete" ON accounting_items
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
-- 3. 他のテーブルの確認と修正
-- ====================================================

-- work_report_accountingとaccounting_recommendationsは
-- FOR ALLポリシーなので、SELECT/INSERT/UPDATE/DELETEすべてカバー済み

-- ====================================================
-- 4. 最終確認
-- ====================================================
DO $$
DECLARE
    item_policies INTEGER;
    rec_policies INTEGER;
    wra_policies INTEGER;
BEGIN
    SELECT COUNT(*) INTO item_policies
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'accounting_items';

    SELECT COUNT(*) INTO rec_policies
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'accounting_recommendations';

    SELECT COUNT(*) INTO wra_policies
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'work_report_accounting';

    RAISE NOTICE '========================================';
    RAISE NOTICE 'ポリシー数の最終確認:';
    RAISE NOTICE 'accounting_items: % ポリシー (期待値: 4)', item_policies;
    RAISE NOTICE 'accounting_recommendations: % ポリシー (期待値: 1)', rec_policies;
    RAISE NOTICE 'work_report_accounting: % ポリシー (期待値: 1)', wra_policies;
    RAISE NOTICE '========================================';

    IF item_policies = 4 AND rec_policies = 1 AND wra_policies = 1 THEN
        RAISE NOTICE '✅ すべてのポリシーが正常に設定されました！';
    ELSE
        RAISE WARNING '⚠️ ポリシー数が期待値と異なります。確認が必要です。';
    END IF;
END $$;

COMMIT;

-- ====================================================
-- 実行後の詳細確認クエリ（別途実行）
-- ====================================================
/*
-- ポリシーの詳細を確認
SELECT
    tablename,
    policyname,
    cmd,
    permissive,
    CASE
        WHEN qual IS NULL THEN 'NO RESTRICTION'
        WHEN LENGTH(qual) > 50 THEN LEFT(qual, 50) || '...'
        ELSE qual
    END AS using_clause,
    CASE
        WHEN with_check IS NULL THEN 'NO CHECK'
        WHEN LENGTH(with_check) > 50 THEN LEFT(with_check, 50) || '...'
        ELSE with_check
    END AS with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN ('accounting_items', 'work_report_accounting', 'accounting_recommendations')
ORDER BY tablename, cmd;

-- 各操作が許可されているか確認
WITH policy_coverage AS (
    SELECT
        tablename,
        SUM(CASE WHEN cmd = 'SELECT' OR cmd = 'ALL' THEN 1 ELSE 0 END) > 0 AS has_select,
        SUM(CASE WHEN cmd = 'INSERT' OR cmd = 'ALL' THEN 1 ELSE 0 END) > 0 AS has_insert,
        SUM(CASE WHEN cmd = 'UPDATE' OR cmd = 'ALL' THEN 1 ELSE 0 END) > 0 AS has_update,
        SUM(CASE WHEN cmd = 'DELETE' OR cmd = 'ALL' THEN 1 ELSE 0 END) > 0 AS has_delete
    FROM pg_policies
    WHERE schemaname = 'public'
        AND tablename IN ('accounting_items', 'work_report_accounting', 'accounting_recommendations')
    GROUP BY tablename
)
SELECT
    tablename,
    CASE WHEN has_select THEN '✅' ELSE '❌' END AS "SELECT",
    CASE WHEN has_insert THEN '✅' ELSE '❌' END AS "INSERT",
    CASE WHEN has_update THEN '✅' ELSE '❌' END AS "UPDATE",
    CASE WHEN has_delete THEN '✅' ELSE '❌' END AS "DELETE"
FROM policy_coverage
ORDER BY tablename;
*/