-- work_durationフィールドの制限を拡張
-- 現在: NUMERIC(4,1) → 最大999.9
-- 変更後: INTEGER → 制限なし（整数値）

-- work_reportsテーブルのwork_durationフィールドを整数型に変更
ALTER TABLE work_reports
ALTER COLUMN work_duration TYPE INTEGER;

-- もしくは、より大きな精度のNUMERIC型に変更
-- ALTER TABLE work_reports
-- ALTER COLUMN work_duration TYPE NUMERIC(10,0);  -- 最大9,999,999,999

-- worker_countも必要に応じて拡張
-- 現在の制限が小さい場合
ALTER TABLE work_reports
ALTER COLUMN worker_count TYPE INTEGER;

-- 確認用クエリ
SELECT
  column_name,
  data_type,
  numeric_precision,
  numeric_scale
FROM information_schema.columns
WHERE table_name = 'work_reports'
  AND column_name IN ('work_duration', 'worker_count', 'temperature');