-- ====================================================
-- Phase 0-1 代替案: 様々なユーザー管理パターンに対応
-- roleカラムがない場合の複数の解決策
-- ====================================================

-- まず、usersテーブルの実際の構造を確認
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
AND column_name IN ('role', 'is_admin', 'is_super_admin', 'user_type')
ORDER BY column_name;

-- ====================================================
-- 解決策A: 認証済みユーザー全員が編集可能（開発環境向け）
-- ====================================================
/*
BEGIN;

DROP POLICY IF EXISTS "accounting_items_admin_insert" ON accounting_items;
DROP POLICY IF EXISTS "accounting_items_admin_update" ON accounting_items;
DROP POLICY IF EXISTS "accounting_items_admin_delete" ON accounting_items;

-- 認証済みユーザーは全員編集可能
CREATE POLICY "accounting_items_authenticated_insert"
ON accounting_items
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "accounting_items_authenticated_update"
ON accounting_items
FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "accounting_items_authenticated_delete"
ON accounting_items
FOR DELETE
USING (auth.uid() IS NOT NULL);

COMMIT;
*/

-- ====================================================
-- 解決策B: 自社のユーザーのみ編集可能（推奨）
-- ====================================================

BEGIN;

DROP POLICY IF EXISTS "accounting_items_admin_insert" ON accounting_items;
DROP POLICY IF EXISTS "accounting_items_admin_update" ON accounting_items;
DROP POLICY IF EXISTS "accounting_items_admin_delete" ON accounting_items;
DROP POLICY IF EXISTS "accounting_items_service_insert" ON accounting_items;
DROP POLICY IF EXISTS "accounting_items_service_update" ON accounting_items;
DROP POLICY IF EXISTS "accounting_items_service_delete" ON accounting_items;

-- 自社のユーザーのみ編集可能（company_idベース）
CREATE POLICY "accounting_items_company_insert"
ON accounting_items
FOR INSERT
WITH CHECK (
    auth.jwt()->>'role' = 'service_role'
    OR EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND company_id IS NOT NULL
    )
);

CREATE POLICY "accounting_items_company_update"
ON accounting_items
FOR UPDATE
USING (
    auth.jwt()->>'role' = 'service_role'
    OR EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND company_id IS NOT NULL
    )
);

CREATE POLICY "accounting_items_company_delete"
ON accounting_items
FOR DELETE
USING (
    auth.jwt()->>'role' = 'service_role'
    OR EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND company_id IS NOT NULL
    )
);

COMMIT;

-- ====================================================
-- 解決策C: is_super_adminカラムがある場合
-- ====================================================
/*
BEGIN;

DROP POLICY IF EXISTS "accounting_items_admin_insert" ON accounting_items;
DROP POLICY IF EXISTS "accounting_items_admin_update" ON accounting_items;
DROP POLICY IF EXISTS "accounting_items_admin_delete" ON accounting_items;

-- super_adminのみ編集可能
CREATE POLICY "accounting_items_superadmin_insert"
ON accounting_items
FOR INSERT
WITH CHECK (
    auth.jwt()->>'role' = 'service_role'
    OR EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND is_super_admin = true
    )
);

CREATE POLICY "accounting_items_superadmin_update"
ON accounting_items
FOR UPDATE
USING (
    auth.jwt()->>'role' = 'service_role'
    OR EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND is_super_admin = true
    )
);

CREATE POLICY "accounting_items_superadmin_delete"
ON accounting_items
FOR DELETE
USING (
    auth.jwt()->>'role' = 'service_role'
    OR EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND is_super_admin = true
    )
);

COMMIT;
*/

-- ====================================================
-- 確認と検証
-- ====================================================

-- 作成されたポリシーの確認
SELECT
    tablename,
    policyname,
    cmd,
    CASE
        WHEN qual LIKE '%service_role%' THEN 'Service Role + 条件'
        WHEN qual LIKE '%company_id%' THEN '会社所属ユーザー'
        WHEN qual LIKE '%auth.uid()%' THEN '認証ユーザー'
        ELSE LEFT(qual, 30)
    END as policy_type
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename = 'accounting_items'
ORDER BY cmd;

-- テスト: 現在のユーザーで操作可能か確認
SELECT
    'SELECT' as operation,
    CASE WHEN EXISTS (
        SELECT 1 FROM accounting_items LIMIT 1
    ) THEN '✅ 可能' ELSE '❌ 不可' END as result
UNION ALL
SELECT
    'INSERT' as operation,
    '要テスト（実際にINSERTを試す必要あり）' as result;