-- ====================================================================
-- 本番環境用RLS - フェーズ2：高度なセキュリティ（将来適用）
-- ====================================================================

-- このマイグレーションは準備済み。必要に応じて適用
-- 適用前に必ずバックアップを取得してください

/*
-- 1. 削除保護強化：重要データの誤削除防止
DROP POLICY IF EXISTS "prod_growing_tasks_delete" ON growing_tasks;

CREATE POLICY "prod_growing_tasks_delete_protected" ON growing_tasks
    FOR DELETE
    USING (
        auth.is_service_role()
        OR (
            company_id = get_current_user_company_id()
            AND get_current_user_role() = 'admin'
            AND status NOT IN ('in_progress', 'completed')  -- 進行中・完了は削除不可
            AND NOT EXISTS (
                SELECT 1 FROM work_reports 
                WHERE work_reports.growing_task_id = growing_tasks.id
            )  -- 作業記録があるタスクは削除不可
        )
    );

-- 2. 時間ベース制限：深夜の操作制限
CREATE OR REPLACE FUNCTION is_business_hours() RETURNS boolean AS $$
BEGIN
    RETURN EXTRACT(hour FROM now() AT TIME ZONE 'Asia/Tokyo') BETWEEN 6 AND 22;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "prod_growing_tasks_business_hours_delete" ON growing_tasks
    FOR DELETE
    USING (
        auth.is_service_role()
        OR (
            company_id = get_current_user_company_id()
            AND get_current_user_role() = 'admin'
            AND is_business_hours()  -- 営業時間内のみ削除可能
        )
    );

-- 3. 監査ログ強化
CREATE OR REPLACE FUNCTION log_critical_operations()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (
            company_id, user_id, table_name, record_id, action, old_data
        ) VALUES (
            OLD.company_id,
            auth.uid(),
            'growing_tasks',
            OLD.id,
            'DELETE',
            to_jsonb(OLD)
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_growing_tasks_delete
    BEFORE DELETE ON growing_tasks
    FOR EACH ROW EXECUTE FUNCTION log_critical_operations();
*/

-- 確認ログ
DO $$ 
BEGIN
    RAISE NOTICE 'RLS Phase2（高度セキュリティ）準備完了';
    RAISE NOTICE '適用時期：システム安定後、セキュリティ要件強化時';
    RAISE NOTICE '機能：削除保護、時間制限、監査ログ強化';
END $$;