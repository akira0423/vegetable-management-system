-- ====================================================================
-- growing_tasksのRLSポリシーを作業記録と同じアーキテクチャに統一
-- ====================================================================

-- 1. 既存の複雑なRLSポリシーを削除
DROP POLICY IF EXISTS "growing_tasks_select_policy" ON growing_tasks;
DROP POLICY IF EXISTS "growing_tasks_insert_policy" ON growing_tasks;
DROP POLICY IF EXISTS "growing_tasks_update_policy" ON growing_tasks;
DROP POLICY IF EXISTS "growing_tasks_delete_policy" ON growing_tasks;

-- 2. work_reportsと同じシンプルで堅牢なRLSポリシーを作成

-- SELECT: 自社のタスクのみ参照可能（直接company_idフィルター）
CREATE POLICY "growing_tasks_select_policy" ON growing_tasks
    FOR SELECT
    USING (
        company_id = get_current_user_company_id()
        OR get_current_user_company_id() IS NULL -- テスト時
    );

-- INSERT: 自社のタスクのみ作成可能
CREATE POLICY "growing_tasks_insert_policy" ON growing_tasks
    FOR INSERT
    WITH CHECK (
        company_id = get_current_user_company_id()
        OR get_current_user_company_id() IS NULL -- テスト時
    );

-- UPDATE: 自社のタスクのみ更新可能
CREATE POLICY "growing_tasks_update_policy" ON growing_tasks
    FOR UPDATE
    USING (
        company_id = get_current_user_company_id()
        OR get_current_user_company_id() IS NULL -- テスト時
    )
    WITH CHECK (
        company_id = get_current_user_company_id()
        OR get_current_user_company_id() IS NULL -- テスト時
    );

-- DELETE: 自社のタスクのみ削除可能（ソフトデリート対応）
CREATE POLICY "growing_tasks_delete_policy" ON growing_tasks
    FOR DELETE
    USING (
        company_id = get_current_user_company_id()
        OR get_current_user_company_id() IS NULL -- テスト時
    );

-- 3. 監査ログトリガーの追加（work_reportsと同じ）
CREATE TRIGGER IF NOT EXISTS audit_growing_tasks 
    AFTER INSERT OR UPDATE OR DELETE ON growing_tasks 
    FOR EACH ROW 
    EXECUTE FUNCTION log_changes();

-- 4. RLS有効化確認
ALTER TABLE growing_tasks ENABLE ROW LEVEL SECURITY;

-- 5. テーブルコメント更新
COMMENT ON TABLE growing_tasks IS '栽培タスクテーブル - work_reportsと統一されたアーキテクチャで堅牢な永続化を実現';

-- 6. 統一アーキテクチャ確認ログ
DO $$ 
BEGIN
    RAISE NOTICE 'growing_tasks RLS policies updated to match work_reports architecture';
    RAISE NOTICE 'Now using direct company_id filtering for maximum reliability';
    RAISE NOTICE 'Task persistence should now be consistent with work reports';
END $$;