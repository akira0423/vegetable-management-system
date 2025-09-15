-- ====================================================================
-- 収穫レポートの日付修正
-- 未来日付を現在日付に修正
-- ====================================================================

-- 修正前の確認
SELECT
  id,
  work_date,
  work_type,
  harvest_amount,
  created_at
FROM work_reports
WHERE id = 'fe3a33bb-f72f-4844-ba16-bf56aa8f2b16';

-- 日付を今日に修正
UPDATE work_reports
SET work_date = '2025-09-14'
WHERE id = 'fe3a33bb-f72f-4844-ba16-bf56aa8f2b16';

-- 修正後の確認
SELECT
  id,
  work_date,
  work_type,
  harvest_amount,
  created_at
FROM work_reports
WHERE id = 'fe3a33bb-f72f-4844-ba16-bf56aa8f2b16';