-- ========================================
-- work_reportsテーブルの完全な型分析
-- ========================================

-- 1. 現在の全フィールドの型と制限を確認
SELECT
  ordinal_position AS "順番",
  column_name AS "フィールド名",
  data_type AS "データ型",
  CASE
    WHEN data_type IN ('numeric', 'decimal') THEN
      CONCAT('NUMERIC(', numeric_precision, ',', numeric_scale, ')')
    WHEN data_type = 'character varying' THEN
      CONCAT('VARCHAR(', character_maximum_length, ')')
    WHEN data_type = 'integer' THEN
      'INTEGER'
    WHEN data_type = 'text' THEN
      'TEXT'
    WHEN data_type = 'timestamp with time zone' THEN
      'TIMESTAMPTZ'
    WHEN data_type = 'date' THEN
      'DATE'
    WHEN data_type = 'time without time zone' THEN
      'TIME'
    WHEN data_type = 'jsonb' THEN
      'JSONB'
    WHEN data_type = 'uuid' THEN
      'UUID'
    WHEN data_type = 'ARRAY' THEN
      'ARRAY'
    ELSE data_type
  END AS "型の詳細",
  CASE
    WHEN data_type IN ('numeric', 'decimal') THEN
      CASE
        WHEN numeric_precision = 4 AND numeric_scale = 1 THEN
          '-999.9 〜 999.9'
        WHEN numeric_precision = 5 AND numeric_scale = 1 THEN
          '-9999.9 〜 9999.9'
        WHEN numeric_precision = 6 AND numeric_scale = 2 THEN
          '-9999.99 〜 9999.99'
        ELSE
          CONCAT('±', POWER(10, numeric_precision - numeric_scale) - 1, '.', REPEAT('9', numeric_scale::int))
      END
    WHEN data_type = 'integer' THEN
      '-2,147,483,648 〜 2,147,483,647'
    WHEN data_type = 'text' THEN
      '制限なし'
    WHEN character_maximum_length IS NOT NULL THEN
      CONCAT('最大', character_maximum_length, '文字')
    ELSE
      '—'
  END AS "値の範囲",
  is_nullable AS "NULL許可",
  column_default AS "デフォルト値"
FROM information_schema.columns
WHERE table_name = 'work_reports'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. 問題のある可能性が高いフィールドを特定
SELECT
  '⚠️ 要確認' AS "状態",
  column_name AS "フィールド名",
  CONCAT('NUMERIC(', numeric_precision, ',', numeric_scale, ')') AS "現在の型",
  CONCAT('最大値: ', POWER(10, numeric_precision - numeric_scale) - 1) AS "制限",
  CASE
    WHEN column_name LIKE '%temperature%' THEN '気温データ'
    WHEN column_name LIKE '%duration%' THEN '作業時間'
    WHEN column_name LIKE '%amount%' THEN '数量データ'
    WHEN column_name LIKE '%price%' THEN '価格データ'
    WHEN column_name LIKE '%phosphorus%' THEN 'リン酸データ'
    WHEN column_name LIKE '%exchangeable%' THEN '交換性塩基'
    WHEN column_name LIKE '%nitrogen%' THEN '窒素データ'
    ELSE 'その他'
  END AS "用途"
FROM information_schema.columns
WHERE table_name = 'work_reports'
  AND data_type IN ('numeric', 'decimal')
  AND numeric_precision <= 4
ORDER BY numeric_precision, column_name;

-- 3. CHECK制約の確認
SELECT
  tc.constraint_name AS "制約名",
  cc.column_name AS "フィールド名",
  pgc.consrc AS "制約条件"
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage cc
  ON tc.constraint_name = cc.constraint_name
JOIN pg_constraint pgc
  ON pgc.conname = tc.constraint_name
WHERE tc.table_name = 'work_reports'
  AND tc.constraint_type = 'CHECK';

-- 4. 実際のデータの使用範囲を確認（各数値フィールドの最大値・最小値）
SELECT
  'temperature' AS field_name,
  MIN(temperature) AS min_value,
  MAX(temperature) AS max_value,
  AVG(temperature) AS avg_value,
  COUNT(*) AS total_records,
  COUNT(temperature) AS non_null_records
FROM work_reports
WHERE temperature IS NOT NULL

UNION ALL

SELECT
  'work_duration',
  MIN(work_duration),
  MAX(work_duration),
  AVG(work_duration),
  COUNT(*),
  COUNT(work_duration)
FROM work_reports
WHERE work_duration IS NOT NULL

UNION ALL

SELECT
  'worker_count',
  MIN(worker_count),
  MAX(worker_count),
  AVG(worker_count),
  COUNT(*),
  COUNT(worker_count)
FROM work_reports
WHERE worker_count IS NOT NULL

UNION ALL

SELECT
  'harvest_amount',
  MIN(harvest_amount),
  MAX(harvest_amount),
  AVG(harvest_amount),
  COUNT(*),
  COUNT(harvest_amount)
FROM work_reports
WHERE harvest_amount IS NOT NULL

UNION ALL

SELECT
  'expected_price',
  MIN(expected_price),
  MAX(expected_price),
  AVG(expected_price),
  COUNT(*),
  COUNT(expected_price)
FROM work_reports
WHERE expected_price IS NOT NULL;

-- 5. 推奨される型変更案
-- 以下のコメントを参考に必要な変更を実施してください

/*
=== 推奨される型変更 ===

1. 作業時間関連
   - work_duration: INTEGER（分単位、最大21億分まで対応）
   - duration_hours: NUMERIC(8,2)（最大999999.99時間）

2. 人数関連
   - worker_count: INTEGER（最大21億人まで対応）

3. 気象データ
   - temperature: NUMERIC(5,1)（-9999.9℃〜9999.9℃）
   - humidity: INTEGER（0〜100%）

4. 土壌データ
   - soil_ph: NUMERIC(3,1)（0.0〜14.0）
   - soil_ec: NUMERIC(6,2)（電気伝導度）
   - phosphorus_absorption: INTEGER（リン酸吸収係数、通常100〜3000）
   - cec: NUMERIC(6,2)（陽イオン交換容量）
   - exchangeable_calcium: INTEGER
   - exchangeable_magnesium: INTEGER
   - exchangeable_potassium: INTEGER
   - base_saturation: NUMERIC(5,2)（0.00〜100.00%）

5. 収穫・価格データ
   - harvest_amount: NUMERIC(13,2)（最大10,000,000,000.99 = 100億）
   - expected_price: NUMERIC(15,2)（最大1,000,000,000,000.99円 = 1兆円）
   - expected_revenue: NUMERIC(16,2)（最大10,000,000,000,000.99円 = 10兆円）

6. 肥料データ
   - fertilizer_amount: NUMERIC(10,2)
*/