-- ====================================================
-- Phase 0-1 シンプル版: accounting_itemsの不足ポリシー追加
-- エラー対策: IF NOT EXISTSを使わない安全な実装
-- ====================================================

-- トランザクション開始
BEGIN;

-- ====================================================
-- Step 1: 既存の管理ポリシーを削除（存在しない場合もエラーにならない）
-- ====================================================
DROP POLICY IF EXISTS "accounting_items_admin_insert" ON accounting_items;
DROP POLICY IF EXISTS "accounting_items_admin_update" ON accounting_items;
DROP POLICY IF EXISTS "accounting_items_admin_delete" ON accounting_items;

-- ====================================================
-- Step 2: 新しい管理ポリシーを作成
-- ====================================================

-- INSERT: 管理者またはService Roleのみ
CREATE POLICY "accounting_items_admin_insert"
ON accounting_items
FOR INSERT
WITH CHECK (
    auth.jwt()->>'role' = 'service_role'
    OR EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND role = 'admin'
    )
);

-- UPDATE: 管理者またはService Roleのみ
CREATE POLICY "accounting_items_admin_update"
ON accounting_items
FOR UPDATE
USING (
    auth.jwt()->>'role' = 'service_role'
    OR EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND role = 'admin'
    )
);

-- DELETE: 管理者またはService Roleのみ
CREATE POLICY "accounting_items_admin_delete"
ON accounting_items
FOR DELETE
USING (
    auth.jwt()->>'role' = 'service_role'
    OR EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND role = 'admin'
    )
);

-- トランザクション終了
COMMIT;

-- ====================================================
-- 確認クエリ（実行後に別途実行）
-- ====================================================

-- ポリシー数と詳細を確認
SELECT
    tablename,
    COUNT(*) as policy_count,
    STRING_AGG(policyname || ' (' || cmd || ')', ', ' ORDER BY cmd) as policies
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename = 'accounting_items'
GROUP BY tablename;

-- 期待される結果:
-- accounting_items | 4 | accounting_items_read_all (SELECT), accounting_items_admin_insert (INSERT),
--                       accounting_items_admin_update (UPDATE), accounting_items_admin_delete (DELETE)