-- ====================================================================
-- vegetablesテーブルのソフトデリート実装 - work_reports/growing_tasksと統一
-- ====================================================================

-- 1. ソフトデリート管理カラム追加
ALTER TABLE vegetables ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;
ALTER TABLE vegetables ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE vegetables ADD COLUMN IF NOT EXISTS deletion_reason text;

-- 2. 既存のis_archivedデータをdeleted_atに移行
UPDATE vegetables 
SET 
    deleted_at = updated_at, -- アーカイブ日時をupdated_atから推定
    deletion_reason = 'アーカイブからの移行'
WHERE custom_fields->>'is_archived' = 'true'
  AND deleted_at IS NULL;

-- 3. パフォーマンス最適化インデックス追加
CREATE INDEX IF NOT EXISTS idx_vegetables_active ON vegetables(company_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vegetables_deleted_at ON vegetables(deleted_at) WHERE deleted_at IS NOT NULL;

-- 4. データ整合性制約追加
ALTER TABLE vegetables ADD CONSTRAINT IF NOT EXISTS chk_vegetables_area_positive 
    CHECK (area_size IS NULL OR area_size > 0);
ALTER TABLE vegetables ADD CONSTRAINT IF NOT EXISTS chk_vegetables_plant_count_positive 
    CHECK (plant_count IS NULL OR plant_count > 0);

-- 5. カラムコメント追加
COMMENT ON COLUMN vegetables.deleted_at IS 'ソフトデリート日時（NULL=有効、値=削除済み）';
COMMENT ON COLUMN vegetables.deleted_by IS 'ソフトデリート実行者';
COMMENT ON COLUMN vegetables.deletion_reason IS 'ソフトデリート理由';

-- 6. アクティブ野菜用ビュー作成（work_reports/growing_tasksと同じパターン）
CREATE OR REPLACE VIEW vegetables_active AS
SELECT 
    id,
    company_id,
    variety_id,
    name,
    variety_name,
    plot_name,
    area_size,
    plant_count,
    planting_date,
    expected_harvest_start,
    expected_harvest_end,
    actual_harvest_start,
    actual_harvest_end,
    status,
    notes,
    custom_fields,
    created_by,
    created_at,
    updated_at
FROM vegetables 
WHERE deleted_at IS NULL;

-- 7. 分析用集計ビュー作成
CREATE OR REPLACE VIEW vegetables_analytics AS
SELECT 
    company_id,
    status,
    DATE_TRUNC('month', planting_date) as month,
    COUNT(*) as vegetable_count,
    SUM(area_size) as total_area,
    SUM(plant_count) as total_plants,
    AVG(area_size) as avg_area_per_plot
FROM vegetables_active
GROUP BY company_id, status, DATE_TRUNC('month', planting_date);

-- 8. ビューの権限設定
ALTER VIEW vegetables_active OWNER TO postgres;
ALTER VIEW vegetables_analytics OWNER TO postgres;
GRANT SELECT ON vegetables_active TO authenticated;
GRANT SELECT ON vegetables_analytics TO authenticated;

-- 9. 統計情報更新
ANALYZE vegetables;

-- 10. マイグレーション完了ログ
DO $$ 
BEGIN
    RAISE NOTICE 'vegetables table soft delete implementation completed';
    RAISE NOTICE 'Added deleted_at, deleted_by, deletion_reason columns';
    RAISE NOTICE 'Migrated existing is_archived data to deleted_at';
    RAISE NOTICE 'Added performance indexes and analytics views';
    RAISE NOTICE 'Soft delete architecture now unified across all tables';
END $$;