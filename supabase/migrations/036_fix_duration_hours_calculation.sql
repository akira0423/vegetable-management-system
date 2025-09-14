-- ====================================================================
-- duration_hours計算の修正 - work_durationとduration_hoursの一貫性確保
-- ====================================================================

-- トリガー関数：収穫データと作業時間の自動計算（修正版）
CREATE OR REPLACE FUNCTION calculate_harvest_revenue()
RETURNS TRIGGER AS $$
BEGIN
    -- 収穫量と想定単価から想定売上高を自動計算
    IF NEW.harvest_amount IS NOT NULL AND NEW.expected_price IS NOT NULL THEN
        NEW.expected_revenue = NEW.harvest_amount * NEW.expected_price;
    END IF;

    -- 作業時間の自動計算
    -- 1. start_time と end_time から duration_hours を計算（優先）
    IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN
        NEW.duration_hours = EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 3600.0;
        -- duration_hours から work_duration も計算（分単位）
        NEW.work_duration = ROUND(NEW.duration_hours * 60);
    -- 2. work_duration から duration_hours を計算
    ELSIF NEW.work_duration IS NOT NULL THEN
        NEW.duration_hours = NEW.work_duration / 60.0;
    -- 3. duration_hours から work_duration を計算
    ELSIF NEW.duration_hours IS NOT NULL THEN
        NEW.work_duration = ROUND(NEW.duration_hours * 60);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 既存の不整合データを修正
UPDATE work_reports
SET duration_hours = work_duration / 60.0
WHERE work_duration IS NOT NULL
  AND (duration_hours IS NULL OR duration_hours != work_duration / 60.0);

-- マイグレーション完了ログ
DO $$
BEGIN
    RAISE NOTICE 'duration_hours calculation fixed successfully';
    RAISE NOTICE 'Updated existing inconsistent data';
    RAISE NOTICE 'Trigger now handles work_duration <-> duration_hours conversion';
END $$;