-- ====================================================================
-- work_reportsテーブル拡張 - 完全なプロフェッショナル農業データ管理対応
-- ====================================================================

-- 既存フィールドの数値制限修正
ALTER TABLE work_reports 
  ALTER COLUMN duration_hours TYPE decimal(6,2);

-- 収穫データフィールド追加
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS harvest_amount decimal(8,2);
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS harvest_unit varchar(20);
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS harvest_quality varchar(20);
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS expected_price decimal(8,2);
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS expected_revenue decimal(12,2);

-- 作業データフィールド追加
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS work_amount decimal(8,2);
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS work_unit varchar(20);
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS work_duration integer; -- 作業時間（分）
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS worker_count integer DEFAULT 1;

-- 肥料データフィールド追加
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS fertilizer_type varchar(100);
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS fertilizer_amount decimal(8,2);
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS fertilizer_unit varchar(20);

-- 環境・土壌データフィールド追加
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS soil_ph decimal(3,1);
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS soil_moisture decimal(5,2);
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS soil_temperature decimal(4,1);
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS temperature_morning decimal(4,1);
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS temperature_afternoon decimal(4,1);
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS humidity decimal(5,2);

-- コスト管理フィールド追加
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS estimated_cost decimal(10,2);

-- 削除管理フィールド追加（ソフトデリート対応）
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS deletion_reason text;

-- 分析・統計用インデックス追加
CREATE INDEX IF NOT EXISTS idx_work_reports_harvest_data ON work_reports(company_id, harvest_amount, expected_revenue, work_date) WHERE harvest_amount IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_work_reports_cost_analysis ON work_reports(company_id, estimated_cost, work_type, work_date) WHERE estimated_cost IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_work_reports_work_efficiency ON work_reports(company_id, work_duration, worker_count, work_date) WHERE work_duration IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_work_reports_environmental ON work_reports(company_id, temperature_morning, humidity, work_date) WHERE temperature_morning IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_work_reports_active ON work_reports(company_id, work_date DESC) WHERE deleted_at IS NULL;

-- 分析クエリ用複合インデックス
CREATE INDEX IF NOT EXISTS idx_work_reports_analytics ON work_reports(company_id, work_type, work_date DESC, harvest_amount, expected_revenue, estimated_cost) WHERE deleted_at IS NULL;

-- CHECK制約追加（データ整合性保証）
ALTER TABLE work_reports ADD CONSTRAINT chk_harvest_amount_positive CHECK (harvest_amount IS NULL OR harvest_amount >= 0);
ALTER TABLE work_reports ADD CONSTRAINT chk_expected_price_positive CHECK (expected_price IS NULL OR expected_price >= 0);
ALTER TABLE work_reports ADD CONSTRAINT chk_expected_revenue_positive CHECK (expected_revenue IS NULL OR expected_revenue >= 0);
ALTER TABLE work_reports ADD CONSTRAINT chk_estimated_cost_positive CHECK (estimated_cost IS NULL OR estimated_cost >= 0);
ALTER TABLE work_reports ADD CONSTRAINT chk_work_amount_positive CHECK (work_amount IS NULL OR work_amount >= 0);
ALTER TABLE work_reports ADD CONSTRAINT chk_worker_count_positive CHECK (worker_count IS NULL OR worker_count > 0);
ALTER TABLE work_reports ADD CONSTRAINT chk_work_duration_positive CHECK (work_duration IS NULL OR work_duration > 0);
ALTER TABLE work_reports ADD CONSTRAINT chk_soil_ph_range CHECK (soil_ph IS NULL OR (soil_ph >= 0 AND soil_ph <= 14));
ALTER TABLE work_reports ADD CONSTRAINT chk_humidity_range CHECK (humidity IS NULL OR (humidity >= 0 AND humidity <= 100));

-- 列コメント追加
COMMENT ON COLUMN work_reports.harvest_amount IS '収穫量（kg、個数など）';
COMMENT ON COLUMN work_reports.harvest_unit IS '収穫単位（kg、g、個、束など）';
COMMENT ON COLUMN work_reports.harvest_quality IS '収穫品質評価（excellent、good、average、poor）';
COMMENT ON COLUMN work_reports.expected_price IS '想定単価（円/単位）';
COMMENT ON COLUMN work_reports.expected_revenue IS '想定売上高（円）';
COMMENT ON COLUMN work_reports.work_amount IS '作業量（播種量、灌水量など）';
COMMENT ON COLUMN work_reports.work_unit IS '作業単位（kg、L、m2など）';
COMMENT ON COLUMN work_reports.work_duration IS '作業時間（分）';
COMMENT ON COLUMN work_reports.worker_count IS '作業人数';
COMMENT ON COLUMN work_reports.fertilizer_type IS '肥料種類・銘柄';
COMMENT ON COLUMN work_reports.fertilizer_amount IS '肥料投入量';
COMMENT ON COLUMN work_reports.fertilizer_unit IS '肥料単位（kg、L、mlなど）';
COMMENT ON COLUMN work_reports.soil_ph IS '土壌pH値（0-14）';
COMMENT ON COLUMN work_reports.soil_moisture IS '土壌水分（％）';
COMMENT ON COLUMN work_reports.soil_temperature IS '土壌温度（℃）';
COMMENT ON COLUMN work_reports.temperature_morning IS '朝の気温（℃）';
COMMENT ON COLUMN work_reports.temperature_afternoon IS '午後の気温（℃）';
COMMENT ON COLUMN work_reports.humidity IS '湿度（％）';
COMMENT ON COLUMN work_reports.estimated_cost IS '想定コスト（円）';
COMMENT ON COLUMN work_reports.deleted_at IS 'ソフトデリート日時';
COMMENT ON COLUMN work_reports.deleted_by IS 'ソフトデリート実行者';
COMMENT ON COLUMN work_reports.deletion_reason IS 'ソフトデリート理由';

-- 分析用ビュー作成
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
    estimated_cost,
    created_by,
    created_at,
    updated_at
FROM work_reports 
WHERE deleted_at IS NULL;

-- 分析用集計ビュー作成
CREATE OR REPLACE VIEW work_reports_analytics AS
SELECT 
    company_id,
    work_type,
    DATE_TRUNC('month', work_date) as month,
    COUNT(*) as work_count,
    SUM(harvest_amount) as total_harvest,
    SUM(expected_revenue) as total_revenue,
    SUM(estimated_cost) as total_cost,
    AVG(work_duration) as avg_duration,
    AVG(worker_count) as avg_workers,
    AVG(temperature_morning) as avg_temp_morning,
    COUNT(CASE WHEN harvest_quality = 'excellent' THEN 1 END) as excellent_count,
    COUNT(CASE WHEN harvest_quality = 'good' THEN 1 END) as good_count,
    COUNT(CASE WHEN harvest_quality = 'average' THEN 1 END) as average_count,
    COUNT(CASE WHEN harvest_quality = 'poor' THEN 1 END) as poor_count
FROM work_reports_active
GROUP BY company_id, work_type, DATE_TRUNC('month', work_date);

-- RLS権限をビューに適用
ALTER VIEW work_reports_active OWNER TO postgres;
ALTER VIEW work_reports_analytics OWNER TO postgres;

-- ビューへのアクセス権限設定
GRANT SELECT ON work_reports_active TO authenticated;
GRANT SELECT ON work_reports_analytics TO authenticated;

-- トリガー関数：収穫データ自動計算
CREATE OR REPLACE FUNCTION calculate_harvest_revenue()
RETURNS TRIGGER AS $$
BEGIN
    -- 収穫量と想定単価から想定売上高を自動計算
    IF NEW.harvest_amount IS NOT NULL AND NEW.expected_price IS NOT NULL THEN
        NEW.expected_revenue = NEW.harvest_amount * NEW.expected_price;
    END IF;
    
    -- 作業時間の自動計算（開始時刻と終了時刻から）
    IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN
        NEW.duration_hours = EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 3600.0;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガー適用
DROP TRIGGER IF EXISTS trigger_calculate_harvest_revenue ON work_reports;
CREATE TRIGGER trigger_calculate_harvest_revenue
    BEFORE INSERT OR UPDATE ON work_reports
    FOR EACH ROW
    EXECUTE FUNCTION calculate_harvest_revenue();

-- テーブル統計更新
ANALYZE work_reports;

-- マイグレーション完了ログ
DO $$ 
BEGIN
    RAISE NOTICE 'work_reports table extension completed successfully';
    RAISE NOTICE 'Added fields: harvest data, work metrics, environmental data, cost management';
    RAISE NOTICE 'Added indexes for analytics and performance optimization';
    RAISE NOTICE 'Added views: work_reports_active, work_reports_analytics';
    RAISE NOTICE 'Added triggers for automatic calculation';
END $$;