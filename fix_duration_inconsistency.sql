-- ====================================================================
-- 9月12日レコード（ID: f933fa84-22d8-4300-9f9b-1561a7f8ccae）の修正
-- work_duration=1000000分をduration_hoursに正しく反映
-- ====================================================================

-- 問題のレコードを確認
SELECT
    id,
    work_date,
    work_duration,
    duration_hours,
    work_duration / 60.0 as calculated_duration_hours,
    CASE
        WHEN work_duration IS NOT NULL AND duration_hours != work_duration / 60.0
        THEN 'INCONSISTENT'
        ELSE 'CONSISTENT'
    END as status
FROM work_reports
WHERE id = 'f933fa84-22d8-4300-9f9b-1561a7f8ccae'
   OR work_date = '2024-09-12';

-- 問題のレコードを修正
UPDATE work_reports
SET
    duration_hours = work_duration / 60.0,
    updated_at = now()
WHERE id = 'f933fa84-22d8-4300-9f9b-1561a7f8ccae'
  AND work_duration IS NOT NULL;

-- 他の不整合レコードも修正
UPDATE work_reports
SET
    duration_hours = work_duration / 60.0,
    updated_at = now()
WHERE work_duration IS NOT NULL
  AND (duration_hours IS NULL OR ABS(duration_hours - work_duration / 60.0) > 0.01);

-- 修正結果を確認
SELECT
    id,
    work_date,
    work_duration,
    duration_hours,
    work_duration / 60.0 as calculated_duration_hours,
    CASE
        WHEN work_duration IS NOT NULL AND ABS(duration_hours - work_duration / 60.0) < 0.01
        THEN 'FIXED'
        ELSE 'STILL_INCONSISTENT'
    END as status
FROM work_reports
WHERE work_duration IS NOT NULL
ORDER BY work_date DESC
LIMIT 10;