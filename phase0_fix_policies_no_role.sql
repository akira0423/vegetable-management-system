-- ====================================================
-- Phase 0-1 最終修正版: roleカラムなしでのポリシー作成
-- usersテーブルにroleカラムがない場合の対応
-- ====================================================

BEGIN;

-- ====================================================
-- Step 1: 既存ポリシーをクリーンアップ
-- ====================================================
DROP POLICY IF EXISTS "accounting_items_admin_insert" ON accounting_items;
DROP POLICY IF EXISTS "accounting_items_admin_update" ON accounting_items;
DROP POLICY IF EXISTS "accounting_items_admin_delete" ON accounting_items;

-- ====================================================
-- Step 2: シンプルなポリシーを作成（3つのオプション）
-- ====================================================

-- オプション1: Service Roleのみ編集可能（最もシンプル）
CREATE POLICY "accounting_items_service_insert"
ON accounting_items
FOR INSERT
WITH CHECK (
    auth.jwt()->>'role' = 'service_role'
);

CREATE POLICY "accounting_items_service_update"
ON accounting_items
FOR UPDATE
USING (
    auth.jwt()->>'role' = 'service_role'
);

CREATE POLICY "accounting_items_service_delete"
ON accounting_items
FOR DELETE
USING (
    auth.jwt()->>'role' = 'service_role'
);

COMMIT;

-- ====================================================
-- 確認クエリ
-- ====================================================

-- ポリシー数の確認
SELECT
    tablename,
    COUNT(*) as policy_count,
    STRING_AGG(policyname, ', ') as policy_names
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename = 'accounting_items'
GROUP BY tablename;