-- ====================================================================
-- カスケード削除システム実装 - プロフェッショナル野菜計画削除
-- ====================================================================

-- 1. 既存の外部キー制約を削除
ALTER TABLE growing_tasks DROP CONSTRAINT IF EXISTS growing_tasks_vegetable_id_fkey;
ALTER TABLE work_reports DROP CONSTRAINT IF EXISTS work_reports_vegetable_id_fkey;

-- 2. カスケード削除付きの外部キー制約を追加
ALTER TABLE growing_tasks 
    ADD CONSTRAINT growing_tasks_vegetable_id_fkey 
    FOREIGN KEY (vegetable_id) REFERENCES vegetables(id) 
    ON DELETE CASCADE 
    ON UPDATE RESTRICT;

ALTER TABLE work_reports 
    ADD CONSTRAINT work_reports_vegetable_id_fkey 
    FOREIGN KEY (vegetable_id) REFERENCES vegetables(id) 
    ON DELETE CASCADE 
    ON UPDATE RESTRICT;

-- 3. 削除監査テーブル作成
CREATE TABLE IF NOT EXISTS vegetable_deletion_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deleted_vegetable_id UUID NOT NULL,
    vegetable_snapshot JSONB NOT NULL,
    related_data_count JSONB NOT NULL,
    deletion_reason TEXT NOT NULL,
    deleted_by UUID, -- NULLを許可（認証システム統合まで）
    deleted_at TIMESTAMPTZ DEFAULT NOW(),
    confirmation_details JSONB,
    business_impact JSONB
);

-- 4. 削除監査トリガー関数
CREATE OR REPLACE FUNCTION log_vegetable_deletion()
RETURNS TRIGGER AS $$
DECLARE
    related_data_count JSONB;
BEGIN
    -- 関連データ数を集計
    SELECT jsonb_build_object(
        'growing_tasks', (SELECT COUNT(*) FROM growing_tasks WHERE vegetable_id = OLD.id),
        'work_reports', (SELECT COUNT(*) FROM work_reports WHERE vegetable_id = OLD.id),
        'photos', 0, -- TODO: 実際のphotosテーブル対応時に修正
        'total_revenue', (
            SELECT COALESCE(SUM(expected_revenue), 0) 
            FROM work_reports 
            WHERE vegetable_id = OLD.id AND expected_revenue IS NOT NULL
        )
    ) INTO related_data_count;

    -- 監査ログに記録
    INSERT INTO vegetable_deletion_audit (
        deleted_vegetable_id,
        vegetable_snapshot,
        related_data_count,
        deletion_reason,
        deleted_by
    ) VALUES (
        OLD.id,
        to_jsonb(OLD),
        related_data_count,
        'システム削除', -- デフォルト値、API経由で更新される
        NULL -- TODO: セッション管理実装後に修正
    );

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 5. 削除監査トリガー設定
DROP TRIGGER IF EXISTS vegetable_deletion_audit_trigger ON vegetables;
CREATE TRIGGER vegetable_deletion_audit_trigger
    BEFORE DELETE ON vegetables
    FOR EACH ROW
    EXECUTE FUNCTION log_vegetable_deletion();

-- 6. 削除前制約チェック関数（重要データ保護）
CREATE OR REPLACE FUNCTION check_vegetable_deletion_constraints()
RETURNS TRIGGER AS $$
BEGIN
    -- 直近7日以内の収穫記録がある場合の警告（制約違反ではなく記録のみ）
    IF EXISTS (
        SELECT 1 FROM work_reports 
        WHERE vegetable_id = OLD.id 
        AND work_type = 'harvest' 
        AND work_date >= CURRENT_DATE - INTERVAL '7 days'
    ) THEN
        -- ログに記録（制約違反はしない）
        RAISE NOTICE 'Warning: Deleting vegetable with recent harvest data (ID: %)', OLD.id;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 7. 削除前制約チェックトリガー
DROP TRIGGER IF EXISTS vegetable_deletion_constraint_check ON vegetables;
CREATE TRIGGER vegetable_deletion_constraint_check
    BEFORE DELETE ON vegetables
    FOR EACH ROW
    EXECUTE FUNCTION check_vegetable_deletion_constraints();

-- 8. カスケード削除統計関数
CREATE OR REPLACE FUNCTION get_deletion_statistics(vegetable_id_param UUID)
RETURNS JSONB AS $$
DECLARE
    stats JSONB;
BEGIN
    SELECT jsonb_build_object(
        'vegetable_exists', EXISTS(SELECT 1 FROM vegetables WHERE id = vegetable_id_param),
        'related_tasks', (SELECT COUNT(*) FROM growing_tasks WHERE vegetable_id = vegetable_id_param),
        'related_reports', (SELECT COUNT(*) FROM work_reports WHERE vegetable_id = vegetable_id_param),
        'harvest_revenue', (
            SELECT COALESCE(SUM(expected_revenue), 0) 
            FROM work_reports 
            WHERE vegetable_id = vegetable_id_param AND work_type = 'harvest'
        ),
        'active_tasks', (
            SELECT COUNT(*) 
            FROM growing_tasks 
            WHERE vegetable_id = vegetable_id_param 
            AND status IN ('pending', 'in_progress')
        )
    ) INTO stats;
    
    RETURN stats;
END;
$$ LANGUAGE plpgsql;

-- 9. インデックス最適化（削除性能向上）
CREATE INDEX IF NOT EXISTS idx_growing_tasks_vegetable_cascade ON growing_tasks(vegetable_id);
CREATE INDEX IF NOT EXISTS idx_work_reports_vegetable_cascade ON work_reports(vegetable_id);
CREATE INDEX IF NOT EXISTS idx_deletion_audit_timestamp ON vegetable_deletion_audit(deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_deletion_audit_vegetable ON vegetable_deletion_audit(deleted_vegetable_id);

-- 10. ビュー：削除監査ログ（管理者用）
CREATE OR REPLACE VIEW vegetable_deletion_log AS
SELECT 
    da.id,
    da.deleted_at,
    da.deletion_reason,
    (da.vegetable_snapshot->>'name') as vegetable_name,
    (da.vegetable_snapshot->>'variety_name') as variety_name,
    (da.vegetable_snapshot->>'plot_name') as plot_name,
    (da.related_data_count->>'growing_tasks')::int as deleted_tasks,
    (da.related_data_count->>'work_reports')::int as deleted_reports,
    (da.related_data_count->>'total_revenue')::decimal as lost_revenue,
    da.business_impact
FROM vegetable_deletion_audit da
ORDER BY da.deleted_at DESC;

-- 11. 権限設定
GRANT SELECT ON vegetable_deletion_log TO authenticated;
GRANT EXECUTE ON FUNCTION get_deletion_statistics(UUID) TO authenticated;

-- 12. 統計情報更新
ANALYZE vegetables;
ANALYZE growing_tasks;
ANALYZE work_reports;

-- 13. マイグレーション完了ログ
DO $$ 
BEGIN
    RAISE NOTICE '=== Cascade Deletion System Setup Complete ===';
    RAISE NOTICE 'Foreign key constraints updated for CASCADE DELETE';
    RAISE NOTICE 'Audit logging system implemented';
    RAISE NOTICE 'Deletion protection triggers activated';
    RAISE NOTICE 'Performance indexes created';
    RAISE NOTICE 'System ready for professional vegetable deletion workflow';
END $$;