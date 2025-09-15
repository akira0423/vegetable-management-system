-- ====================================================================
-- duration_hours から work_duration への移行
-- 説明: 古いデータの duration_hours を work_duration に変換
-- ====================================================================

-- 移行前の状態確認
DO $$
BEGIN
  RAISE NOTICE '=== 移行前の状態 ===';
  RAISE NOTICE 'work_duration NULL: %', (SELECT COUNT(*) FROM work_reports WHERE work_duration IS NULL);
  RAISE NOTICE 'duration_hours NOT NULL: %', (SELECT COUNT(*) FROM work_reports WHERE duration_hours IS NOT NULL);
END $$;

-- work_duration が NULL で duration_hours がある場合、分に変換して設定
UPDATE work_reports
SET work_duration = ROUND(duration_hours * 60)::integer
WHERE work_duration IS NULL
  AND duration_hours IS NOT NULL
  AND duration_hours <= 24;  -- 24時間以下の正常値のみ

-- 異常値の修正（16666.67時間など）
UPDATE work_reports
SET
  work_duration = 120,  -- デフォルト2時間
  duration_hours = 2
WHERE duration_hours > 24;

-- 移行後の状態確認
DO $$
BEGIN
  RAISE NOTICE '=== 移行後の状態 ===';
  RAISE NOTICE 'work_duration NULL: %', (SELECT COUNT(*) FROM work_reports WHERE work_duration IS NULL);
  RAISE NOTICE 'work_duration 設定済み: %', (SELECT COUNT(*) FROM work_reports WHERE work_duration IS NOT NULL);
  RAISE NOTICE '異常値修正数: %', (SELECT COUNT(*) FROM work_reports WHERE duration_hours = 2 AND work_duration = 120);
END $$;

-- 今後の整合性を保つためのトリガー（既存のものを更新）
CREATE OR REPLACE FUNCTION sync_work_duration_hours()
RETURNS TRIGGER AS $$
BEGIN
  -- work_duration が設定されている場合、duration_hours を自動計算
  IF NEW.work_duration IS NOT NULL THEN
    NEW.duration_hours = NEW.work_duration::numeric / 60;
  -- work_duration が NULL で duration_hours がある場合、work_duration を計算
  ELSIF NEW.duration_hours IS NOT NULL AND NEW.work_duration IS NULL THEN
    NEW.work_duration = ROUND(NEW.duration_hours * 60)::integer;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 既存のトリガーを削除して再作成
DROP TRIGGER IF EXISTS trigger_sync_work_duration ON work_reports;
CREATE TRIGGER trigger_sync_work_duration
  BEFORE INSERT OR UPDATE ON work_reports
  FOR EACH ROW
  EXECUTE FUNCTION sync_work_duration_hours();

-- マイグレーション完了ログ
DO $$
BEGIN
  RAISE NOTICE 'Migration 045: duration_hours to work_duration migration completed';
  RAISE NOTICE 'All work duration data has been normalized to work_duration field';
END $$;