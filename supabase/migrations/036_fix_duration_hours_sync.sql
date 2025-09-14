-- =====================================================
-- Migration: work_durationとduration_hours の同期修正
-- =====================================================
-- 問題: 編集時にwork_durationだけ更新されてduration_hoursが古い値のまま残るバグの修正
-- 原因: 2025-08-26〜2025-09-14の間、APIがduration_hoursを更新していなかった

-- 1. 既存の不整合データを修正
UPDATE work_reports
SET duration_hours = work_duration / 60.0
WHERE work_duration IS NOT NULL
AND (
    duration_hours IS NULL
    OR duration_hours = 0
    OR ABS(duration_hours - (work_duration / 60.0)) > 0.1  -- 0.1時間（6分）以上の差がある
);

-- 2. トリガー関数の作成/更新：work_durationとduration_hoursを常に同期
CREATE OR REPLACE FUNCTION sync_work_duration_hours()
RETURNS TRIGGER AS $$
BEGIN
    -- work_durationが更新された場合、duration_hoursを自動計算
    IF NEW.work_duration IS NOT NULL AND NEW.work_duration != COALESCE(OLD.work_duration, 0) THEN
        NEW.duration_hours = NEW.work_duration / 60.0;
        RAISE NOTICE 'work_duration(%)からduration_hours(%)を自動計算', NEW.work_duration, NEW.duration_hours;

    -- duration_hoursが直接更新された場合、work_durationを逆算
    ELSIF NEW.duration_hours IS NOT NULL AND NEW.duration_hours != COALESCE(OLD.duration_hours, 0)
          AND (NEW.work_duration IS NULL OR NEW.work_duration = OLD.work_duration) THEN
        NEW.work_duration = ROUND(NEW.duration_hours * 60);
        RAISE NOTICE 'duration_hours(%)からwork_duration(%)を逆算', NEW.duration_hours, NEW.work_duration;
    END IF;

    -- start_time/end_timeから計算する既存ロジック
    IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN
        -- 既存のロジックを維持
        NEW.duration_hours = EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 3600.0;
        NEW.work_duration = ROUND(EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. トリガーの作成（既存のものがあれば置き換え）
DROP TRIGGER IF EXISTS sync_work_duration_hours_trigger ON work_reports;

CREATE TRIGGER sync_work_duration_hours_trigger
BEFORE INSERT OR UPDATE ON work_reports
FOR EACH ROW
EXECUTE FUNCTION sync_work_duration_hours();

-- 4. 修正結果の確認
DO $$
DECLARE
    fixed_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO fixed_count
    FROM work_reports
    WHERE work_duration IS NOT NULL
    AND duration_hours IS NOT NULL
    AND ABS(duration_hours - (work_duration / 60.0)) < 0.01;

    RAISE NOTICE '修正完了: %件のレコードが正しく同期されています', fixed_count;
END $$;

-- 5. 今後のデータ整合性を保証するための制約（オプション）
-- COMMENT: 厳密な整合性を求める場合はコメントアウトを解除
-- ALTER TABLE work_reports ADD CONSTRAINT check_duration_consistency
-- CHECK (
--     (work_duration IS NULL AND duration_hours IS NULL) OR
--     (work_duration IS NOT NULL AND duration_hours IS NOT NULL AND
--      ABS(duration_hours - (work_duration / 60.0)) < 0.01)
-- );