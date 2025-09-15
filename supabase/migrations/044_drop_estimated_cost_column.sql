-- ====================================================================
-- estimated_cost フィールドの削除
-- 説明: 使用されていない estimated_cost フィールドを削除
--       実際の支出は work_report_accounting テーブルで管理
-- ====================================================================

-- インデックスの削除
DROP INDEX IF EXISTS idx_work_reports_cost_analysis;
DROP INDEX IF EXISTS idx_work_reports_analytics;

-- CHECK制約の削除
ALTER TABLE work_reports DROP CONSTRAINT IF EXISTS chk_estimated_cost_positive;

-- カラムの削除
ALTER TABLE work_reports DROP COLUMN IF EXISTS estimated_cost;

-- 分析用ビューの再作成（estimated_costを除外）
CREATE OR REPLACE VIEW work_reports_active AS
SELECT
    id,
    company_id,
    vegetable_id,
    work_type,
    description,
    work_date,
    start_time,
    end_time,
    duration_hours,
    photos,
    weather,
    temperature,
    notes,
    harvest_amount,
    harvest_unit,
    harvest_quality,
    expected_price,
    expected_revenue,
    work_amount,
    work_unit,
    work_duration,
    worker_count,
    fertilizer_type,
    fertilizer_amount,
    fertilizer_unit,
    soil_ph,
    soil_moisture,
    soil_temperature,
    temperature_morning,
    temperature_afternoon,
    humidity,
    created_by,
    created_at,
    updated_at
FROM work_reports
WHERE deleted_at IS NULL;

-- 分析用集計ビューの再作成（estimated_costを除外）
CREATE OR REPLACE VIEW work_reports_analytics AS
SELECT
    company_id,
    work_type,
    DATE_TRUNC('month', work_date) as month,
    COUNT(*) as work_count,
    SUM(harvest_amount) as total_harvest,
    SUM(expected_revenue) as total_revenue,
    AVG(work_duration) as avg_duration,
    AVG(worker_count) as avg_workers,
    AVG(temperature_morning) as avg_temp_morning,
    COUNT(CASE WHEN harvest_quality = 'excellent' THEN 1 END) as excellent_count,
    COUNT(CASE WHEN harvest_quality = 'good' THEN 1 END) as good_count,
    COUNT(CASE WHEN harvest_quality = 'average' THEN 1 END) as average_count,
    COUNT(CASE WHEN harvest_quality = 'poor' THEN 1 END) as poor_count
FROM work_reports_active
GROUP BY company_id, work_type, DATE_TRUNC('month', work_date);

-- 新しいインデックスの作成（estimated_costを除外）
CREATE INDEX IF NOT EXISTS idx_work_reports_analytics_v2
ON work_reports(company_id, work_type, work_date DESC, harvest_amount, expected_revenue)
WHERE deleted_at IS NULL;

-- RLS権限の再設定
ALTER VIEW work_reports_active OWNER TO postgres;
ALTER VIEW work_reports_analytics OWNER TO postgres;

-- アクセス権限の再設定
GRANT SELECT ON work_reports_active TO authenticated;
GRANT SELECT ON work_reports_analytics TO authenticated;

-- テーブル統計の更新
ANALYZE work_reports;

-- マイグレーション完了ログ
DO $$
BEGIN
    RAISE NOTICE 'Migration 044: estimated_cost column removed successfully';
    RAISE NOTICE 'All expense data is now managed through work_report_accounting table';
    RAISE NOTICE 'Views and indexes have been updated';
END $$;