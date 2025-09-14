-- NUMERIC(4,1)型フィールドの確認と修正
-- エラー: "A field with precision 4, scale 1 must round to an absolute value less than 10^3"

-- 現在のテーブル構造を確認
SELECT
  column_name,
  data_type,
  numeric_precision,
  numeric_scale,
  numeric_precision_radix
FROM information_schema.columns
WHERE table_name = 'work_reports'
  AND data_type IN ('numeric', 'decimal')
ORDER BY ordinal_position;

-- 問題のあるフィールドを特定（NUMERIC(4,1)のもの）
SELECT
  column_name,
  data_type,
  numeric_precision,
  numeric_scale
FROM information_schema.columns
WHERE table_name = 'work_reports'
  AND numeric_precision = 4
  AND numeric_scale = 1;

-- 修正が必要なフィールドの型を変更
-- リン酸吸収係数は通常100-3000の範囲
ALTER TABLE work_reports
ALTER COLUMN phosphorus_absorption TYPE INTEGER;

-- 交換性塩基類も大きな値になる可能性
ALTER TABLE work_reports
ALTER COLUMN exchangeable_calcium TYPE INTEGER;

ALTER TABLE work_reports
ALTER COLUMN exchangeable_magnesium TYPE INTEGER;

ALTER TABLE work_reports
ALTER COLUMN exchangeable_potassium TYPE INTEGER;

-- その他の可能性のあるフィールド
-- CECも大きな値になることがある
ALTER TABLE work_reports
ALTER COLUMN cec TYPE NUMERIC(6,2);

-- 温度フィールドは実用的な範囲に制限（-50〜50℃）
-- ただし、すでにNUMERIC(4,1)なら問題ない

-- 確認：変更後の構造
SELECT
  column_name,
  data_type,
  numeric_precision,
  numeric_scale
FROM information_schema.columns
WHERE table_name = 'work_reports'
  AND column_name IN (
    'phosphorus_absorption',
    'exchangeable_calcium',
    'exchangeable_magnesium',
    'exchangeable_potassium',
    'cec',
    'temperature'
  );