-- ====================================================================
-- growing_tasksテーブルアーキテクチャ統一 - work_reportsと同じ堅牢性を実現
-- ====================================================================

-- 1. company_idカラムを追加
ALTER TABLE growing_tasks ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;

-- 2. 既存データのcompany_idをバックフィル（vegetables経由で取得）
UPDATE growing_tasks 
SET company_id = (
    SELECT v.company_id 
    FROM vegetables v 
    WHERE v.id = growing_tasks.vegetable_id
)
WHERE company_id IS NULL;

-- 3. company_idをNOT NULL制約に設定（データ整合性確保）
ALTER TABLE growing_tasks ALTER COLUMN company_id SET NOT NULL;

-- 4. デフォルト値設定（将来の挿入エラー防止）
ALTER TABLE growing_tasks ALTER COLUMN company_id SET DEFAULT 'a1111111-1111-1111-1111-111111111111';

-- 5. パフォーマンス最適化インデックス追加
CREATE INDEX IF NOT EXISTS idx_growing_tasks_company_status ON growing_tasks(company_id, status, start_date);
CREATE INDEX IF NOT EXISTS idx_growing_tasks_company_dates ON growing_tasks(company_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_growing_tasks_company_vegetable ON growing_tasks(company_id, vegetable_id);

-- 6. 分析クエリ用複合インデックス
CREATE INDEX IF NOT EXISTS idx_growing_tasks_analytics ON growing_tasks(company_id, task_type, status, start_date) WHERE deleted_at IS NULL;

-- 7. 削除管理フィールド追加（work_reportsと同じソフトデリート対応）
ALTER TABLE growing_tasks ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;
ALTER TABLE growing_tasks ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE growing_tasks ADD COLUMN IF NOT EXISTS deletion_reason text;

-- 8. CHECK制約追加（データ整合性保証）
ALTER TABLE growing_tasks ADD CONSTRAINT IF NOT EXISTS chk_growing_tasks_progress_range 
    CHECK (progress >= 0 AND progress <= 100);
ALTER TABLE growing_tasks ADD CONSTRAINT IF NOT EXISTS chk_growing_tasks_date_order 
    CHECK (start_date <= end_date);
ALTER TABLE growing_tasks ADD CONSTRAINT IF NOT EXISTS chk_growing_tasks_status_valid 
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'overdue'));
ALTER TABLE growing_tasks ADD CONSTRAINT IF NOT EXISTS chk_growing_tasks_priority_valid 
    CHECK (priority IN ('low', 'medium', 'high'));

-- 9. カラムコメント追加
COMMENT ON COLUMN growing_tasks.company_id IS '会社ID（直接フィルタリング用）- work_reportsと同じアーキテクチャ';
COMMENT ON COLUMN growing_tasks.deleted_at IS 'ソフトデリート日時';
COMMENT ON COLUMN growing_tasks.deleted_by IS 'ソフトデリート実行者';
COMMENT ON COLUMN growing_tasks.deletion_reason IS 'ソフトデリート理由';

-- 10. アクティブタスク用ビュー作成（work_reportsと同じパターン）
CREATE OR REPLACE VIEW growing_tasks_active AS
SELECT 
    id,
    company_id,
    vegetable_id,
    name,
    description,
    task_type,
    priority,
    status,
    start_date,
    end_date,
    estimated_hours,
    actual_hours,
    progress,
    assigned_to,
    dependencies,
    required_materials,
    weather_dependency,
    notes,
    created_by,
    created_at,
    updated_at
FROM growing_tasks 
WHERE deleted_at IS NULL;

-- 11. 分析用集計ビュー作成
CREATE OR REPLACE VIEW growing_tasks_analytics AS
SELECT 
    company_id,
    task_type,
    status,
    DATE_TRUNC('month', start_date) as month,
    COUNT(*) as task_count,
    AVG(progress) as avg_progress,
    SUM(estimated_hours) as total_estimated_hours,
    SUM(actual_hours) as total_actual_hours,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
    COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_count
FROM growing_tasks_active
GROUP BY company_id, task_type, status, DATE_TRUNC('month', start_date);

-- 12. ビューの権限設定
ALTER VIEW growing_tasks_active OWNER TO postgres;
ALTER VIEW growing_tasks_analytics OWNER TO postgres;
GRANT SELECT ON growing_tasks_active TO authenticated;
GRANT SELECT ON growing_tasks_analytics TO authenticated;

-- 13. トリガー関数：タスク状態自動更新
CREATE OR REPLACE FUNCTION update_task_status()
RETURNS TRIGGER AS $$
BEGIN
    -- 進捗100%の場合、自動的にcompletedに変更
    IF NEW.progress = 100 AND NEW.status != 'completed' THEN
        NEW.status = 'completed';
    END IF;
    
    -- 終了日が過ぎて未完了の場合、overdueに変更
    IF NEW.end_date < CURRENT_DATE AND NEW.status IN ('pending', 'in_progress') THEN
        NEW.status = 'overdue';
    END IF;
    
    -- updated_atの更新
    NEW.updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 14. トリガー適用
DROP TRIGGER IF EXISTS trigger_update_task_status ON growing_tasks;
CREATE TRIGGER trigger_update_task_status
    BEFORE UPDATE ON growing_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_task_status();

-- 15. 統計情報更新
ANALYZE growing_tasks;

-- 16. マイグレーション完了ログ
DO $$ 
BEGIN
    RAISE NOTICE 'growing_tasks table architecture unified with work_reports';
    RAISE NOTICE 'Added company_id column with NOT NULL constraint';
    RAISE NOTICE 'Backfilled existing data from vegetables table';
    RAISE NOTICE 'Added performance indexes and analytics views';
    RAISE NOTICE 'Added soft delete support and data integrity checks';
    RAISE NOTICE 'Architecture now consistent with work_reports for reliable persistence';
END $$;