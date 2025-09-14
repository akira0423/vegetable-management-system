-- ========================================
-- 残っているオーバーフロー問題の修正
-- ========================================

-- 1. work_reportsテーブルの残りのフィールドを確認
SELECT
  column_name AS "フィールド名",
  CONCAT('NUMERIC(', numeric_precision, ',', numeric_scale, ')') AS "現在の型",
  CONCAT('最大値: ', POWER(10, numeric_precision - numeric_scale) - 1) AS "制限"
FROM information_schema.columns
WHERE table_name = 'work_reports'
  AND data_type IN ('numeric', 'decimal')
  AND numeric_precision <= 4
ORDER BY numeric_precision;

-- 2. work_report_accountingテーブルの型を確認
SELECT
  column_name AS "フィールド名",
  data_type AS "データ型",
  CASE
    WHEN data_type IN ('numeric', 'decimal') THEN
      CONCAT('NUMERIC(', numeric_precision, ',', numeric_scale, ')')
    ELSE data_type
  END AS "型の詳細",
  CASE
    WHEN numeric_precision = 12 AND numeric_scale = 2 THEN
      '最大: 9,999,999,999.99（約100億）'
    WHEN numeric_precision = 4 AND numeric_scale = 1 THEN
      '最大: 999.9'
    ELSE '-'
  END AS "現在の制限"
FROM information_schema.columns
WHERE table_name = 'work_report_accounting'
ORDER BY ordinal_position;

-- ========================================
-- 修正SQL
-- ========================================

-- 1. work_reportsテーブルの残りのNUMERIC(4,1)フィールドを修正
-- 温度関連
ALTER TABLE work_reports
ALTER COLUMN temperature TYPE NUMERIC(5,1);  -- -9999.9 ～ 9999.9℃

-- 作業時間（もし残っていれば）
ALTER TABLE work_reports
ALTER COLUMN work_duration TYPE INTEGER;  -- 制限なし（整数）

-- 作業人数（もし残っていれば）
ALTER TABLE work_reports
ALTER COLUMN worker_count TYPE INTEGER;  -- 制限なし（整数）

-- その他のNUMERIC(4,1)フィールドがあれば修正
-- （土壌データなど）
ALTER TABLE work_reports
ALTER COLUMN soil_ph TYPE NUMERIC(3,1);  -- 0.0 ～ 14.0

ALTER TABLE work_reports
ALTER COLUMN soil_ec TYPE NUMERIC(6,2);

ALTER TABLE work_reports
ALTER COLUMN phosphorus_absorption TYPE INTEGER;

ALTER TABLE work_reports
ALTER COLUMN cec TYPE NUMERIC(6,2);

-- 2. work_report_accountingテーブルのamountフィールドを拡張
-- 現在: NUMERIC(12,2) = 最大100億
-- 変更後: NUMERIC(16,2) = 最大10兆
ALTER TABLE work_report_accounting
ALTER COLUMN amount TYPE NUMERIC(16,2);

-- 3. accounting_itemsテーブルも確認（必要に応じて）
SELECT
  column_name,
  data_type,
  numeric_precision,
  numeric_scale
FROM information_schema.columns
WHERE table_name = 'accounting_items'
  AND data_type IN ('numeric', 'decimal');

-- 4. 変更後の確認
-- work_reportsテーブル
SELECT
  'work_reports' AS table_name,
  column_name,
  CONCAT('NUMERIC(', numeric_precision, ',', numeric_scale, ')') AS new_type,
  CASE
    WHEN numeric_precision >= 5 OR data_type = 'integer' THEN '✅ OK'
    ELSE '⚠️ 要確認'
  END AS status
FROM information_schema.columns
WHERE table_name = 'work_reports'
  AND (data_type IN ('numeric', 'decimal') OR column_name IN ('work_duration', 'worker_count'))
  AND column_name IN ('temperature', 'work_duration', 'worker_count',
                      'soil_ph', 'phosphorus_absorption')

UNION ALL

-- work_report_accountingテーブル
SELECT
  'work_report_accounting',
  column_name,
  CONCAT('NUMERIC(', numeric_precision, ',', numeric_scale, ')',
  CASE
    WHEN numeric_precision >= 16 THEN '✅ OK (10兆まで対応)'
    ELSE '⚠️ 要確認'
  END
FROM information_schema.columns
WHERE table_name = 'work_report_accounting'
  AND column_name = 'amount';

-- 5. 全体の確認（問題のあるフィールドのみ表示）
SELECT
  table_name AS "テーブル",
  column_name AS "フィールド",
  CONCAT('NUMERIC(', numeric_precision, ',', numeric_scale, ')') AS "型",
  '⚠️ 制限あり' AS "状態"
FROM information_schema.columns
WHERE table_schema = 'public'
  AND data_type IN ('numeric', 'decimal')
  AND numeric_precision <= 4
  AND table_name IN ('work_reports', 'work_report_accounting')
ORDER BY table_name, column_name;