-- ====================================================================
-- 本番環境用RLS - フェーズ1：安全なベースライン
-- ====================================================================

-- 1. 既存ポリシーを全削除
DROP POLICY IF EXISTS "growing_tasks_select_policy" ON growing_tasks;
DROP POLICY IF EXISTS "growing_tasks_insert_policy" ON growing_tasks;
DROP POLICY IF EXISTS "growing_tasks_update_policy" ON growing_tasks;
DROP POLICY IF EXISTS "growing_tasks_delete_policy" ON growing_tasks;
DROP POLICY IF EXISTS "growing_tasks_soft_delete_policy" ON growing_tasks;
DROP POLICY IF EXISTS "growing_tasks_general_update_policy" ON growing_tasks;

-- 2. RLSを再有効化
ALTER TABLE growing_tasks ENABLE ROW LEVEL SECURITY;

-- 3. 本番用シンプル・安全ポリシー

-- SELECT: 自社データのみ参照可能
CREATE POLICY "prod_growing_tasks_select" ON growing_tasks
    FOR SELECT
    USING (
        auth.is_service_role()  -- Service Roleは制限なし
        OR company_id = get_current_user_company_id()
    );

-- INSERT: 自社データのみ作成可能
CREATE POLICY "prod_growing_tasks_insert" ON growing_tasks
    FOR INSERT
    WITH CHECK (
        auth.is_service_role()
        OR (
            company_id = get_current_user_company_id()
            AND get_current_user_role() IN ('admin', 'manager', 'operator')
        )
    );

-- UPDATE: 自社データのみ更新可能
CREATE POLICY "prod_growing_tasks_update" ON growing_tasks
    FOR UPDATE
    USING (
        auth.is_service_role()
        OR company_id = get_current_user_company_id()
    )
    WITH CHECK (
        auth.is_service_role()
        OR company_id = get_current_user_company_id()
    );

-- DELETE: 管理者のみ削除可能（安全重視）
CREATE POLICY "prod_growing_tasks_delete" ON growing_tasks
    FOR DELETE
    USING (
        auth.is_service_role()
        OR (
            company_id = get_current_user_company_id()
            AND get_current_user_role() IN ('admin', 'manager')
        )
    );

-- 4. パフォーマンス最適化用インデックス
CREATE INDEX IF NOT EXISTS idx_growing_tasks_company_security 
    ON growing_tasks(company_id, created_by);

-- 5. 確認ログ
DO $$ 
BEGIN
    RAISE NOTICE '本番環境用RLS Phase1 適用完了';
    RAISE NOTICE 'Service Role: 制限なしアクセス';
    RAISE NOTICE 'ユーザー: 会社別分離 + ロール権限';
    RAISE NOTICE '削除: admin/manager のみ';
END $$;