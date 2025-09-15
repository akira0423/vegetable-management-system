-- ====================================================================
-- assigned_toカラムの復活
-- growing_tasksテーブルに担当者管理用のカラムを追加
-- ====================================================================

-- 1. assigned_toカラムの追加（存在しない場合のみ）
ALTER TABLE growing_tasks
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;

-- 2. インデックスの追加（パフォーマンス向上のため）
CREATE INDEX IF NOT EXISTS idx_growing_tasks_assigned_to
ON growing_tasks(assigned_to);

-- 3. 複合インデックスの追加（担当者とステータスでの検索最適化）
CREATE INDEX IF NOT EXISTS idx_growing_tasks_assigned_status
ON growing_tasks(assigned_to, status);

-- 4. コメントの追加
COMMENT ON COLUMN growing_tasks.assigned_to IS 'タスクに割り当てられたユーザーID';

-- 5. RLSポリシーの更新（必要に応じて）
-- 担当者が自分のタスクを参照できるようにする
DROP POLICY IF EXISTS "growing_tasks_assigned_user_select" ON growing_tasks;
CREATE POLICY "growing_tasks_assigned_user_select" ON growing_tasks
    FOR SELECT
    USING (
        -- 企業メンバーまたは担当者本人
        company_id IN (
            SELECT company_id FROM user_company_memberships
            WHERE user_id = auth.uid()
        )
        OR assigned_to = auth.uid()
    );

-- 6. 既存のRLSポリシーも更新（UPDATE用）
DROP POLICY IF EXISTS "growing_tasks_assigned_user_update" ON growing_tasks;
CREATE POLICY "growing_tasks_assigned_user_update" ON growing_tasks
    FOR UPDATE
    USING (
        -- 企業メンバーであれば更新可能
        company_id IN (
            SELECT company_id FROM user_company_memberships
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        -- 企業メンバーであれば更新可能
        company_id IN (
            SELECT company_id FROM user_company_memberships
            WHERE user_id = auth.uid()
        )
    );

-- ====================================================================
-- マイグレーション実行後の確認クエリ
-- ====================================================================
-- 以下のクエリをSupabase SQL Editorで実行して確認：
--
-- SELECT
--     column_name,
--     data_type,
--     is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'growing_tasks'
--     AND column_name = 'assigned_to';
-- ====================================================================