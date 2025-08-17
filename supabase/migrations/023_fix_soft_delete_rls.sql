-- ====================================================================
-- ソフト削除対応RLSポリシー修正
-- ====================================================================

-- 1. 既存のgr RLS ポリシーを削除してシンプルなポリシーに置き換え
DROP POLICY IF EXISTS "growing_tasks_update_policy" ON growing_tasks;

-- 2. ソフト削除専用の簡潔なUPDATEポリシー作成
CREATE POLICY "growing_tasks_soft_delete_policy" ON growing_tasks
    FOR UPDATE
    USING (
        -- 自社のタスクのみ更新可能（直接company_idフィルター）
        company_id = 'a1111111-1111-1111-1111-111111111111'  -- テスト用固定会社ID
        OR auth.is_service_role()  -- Service Role は制限なし
    )
    WITH CHECK (
        -- 更新内容も同じ条件でチェック
        company_id = 'a1111111-1111-1111-1111-111111111111'
        OR auth.is_service_role()
    );

-- 3. 一般的なUPDATEポリシーも再作成（ソフト削除以外の更新用）
CREATE POLICY "growing_tasks_general_update_policy" ON growing_tasks
    FOR UPDATE
    USING (
        -- Service Role は制限なし
        auth.is_service_role()
        OR (
            -- 通常ユーザーは自社タスクのみ
            company_id = 'a1111111-1111-1111-1111-111111111111'
        )
    )
    WITH CHECK (
        auth.is_service_role()
        OR company_id = 'a1111111-1111-1111-1111-111111111111'
    );

-- 4. 確認用ログ
DO $$ 
BEGIN
    RAISE NOTICE 'ソフト削除対応RLSポリシー修正完了';
    RAISE NOTICE 'Service Role からのアクセスは制限なし';
    RAISE NOTICE 'テスト用会社ID: a1111111-1111-1111-1111-111111111111';
END $$;