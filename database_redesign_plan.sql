-- ========================================
-- work_reportsテーブル再設計実行SQL
-- ========================================
-- 実行前に必ずバックアップを取ってください！

-- 1. バックアップテーブルの作成
CREATE TABLE work_reports_backup_20250914 AS
SELECT * FROM work_reports;

-- 2. 型変更の実施（エラーを避けるため段階的に実行）

-- ===== 作業時間・人数関連 =====
ALTER TABLE work_reports
ALTER COLUMN work_duration TYPE INTEGER;

ALTER TABLE work_reports
ALTER COLUMN worker_count TYPE INTEGER;

ALTER TABLE work_reports
ALTER COLUMN duration_hours TYPE NUMERIC(8,2);

-- ===== 気象データ =====
-- temperatureは現在のNUMERIC(4,1)では不十分な可能性
ALTER TABLE work_reports
ALTER COLUMN temperature TYPE NUMERIC(5,1);

ALTER TABLE work_reports
ALTER COLUMN humidity TYPE INTEGER;

-- ===== 土壌基本データ =====
ALTER TABLE work_reports
ALTER COLUMN soil_ph TYPE NUMERIC(3,1);

ALTER TABLE work_reports
ALTER COLUMN soil_ec TYPE NUMERIC(6,2);

-- ===== リン酸・CEC =====
ALTER TABLE work_reports
ALTER COLUMN phosphorus_absorption TYPE INTEGER;

ALTER TABLE work_reports
ALTER COLUMN cec TYPE NUMERIC(6,2);

-- ===== 交換性塩基類 =====
ALTER TABLE work_reports
ALTER COLUMN exchangeable_calcium TYPE INTEGER;

ALTER TABLE work_reports
ALTER COLUMN exchangeable_magnesium TYPE INTEGER;

ALTER TABLE work_reports
ALTER COLUMN exchangeable_potassium TYPE INTEGER;

ALTER TABLE work_reports
ALTER COLUMN base_saturation TYPE NUMERIC(5,2);

-- ===== 塩基バランス =====
ALTER TABLE work_reports
ALTER COLUMN calcium_magnesium_ratio TYPE NUMERIC(6,2);

ALTER TABLE work_reports
ALTER COLUMN magnesium_potassium_ratio TYPE NUMERIC(6,2);

-- ===== 養分・有機物 =====
ALTER TABLE work_reports
ALTER COLUMN available_phosphorus TYPE NUMERIC(8,2);

ALTER TABLE work_reports
ALTER COLUMN available_silica TYPE NUMERIC(8,2);

ALTER TABLE work_reports
ALTER COLUMN humus_content TYPE NUMERIC(5,2);

-- ===== 窒素形態 =====
ALTER TABLE work_reports
ALTER COLUMN ammonium_nitrogen TYPE NUMERIC(8,2);

ALTER TABLE work_reports
ALTER COLUMN nitrate_nitrogen TYPE NUMERIC(8,2);

-- ===== 微量要素 =====
ALTER TABLE work_reports
ALTER COLUMN manganese TYPE NUMERIC(8,2);

ALTER TABLE work_reports
ALTER COLUMN boron TYPE NUMERIC(8,2);

ALTER TABLE work_reports
ALTER COLUMN free_iron_oxide TYPE NUMERIC(8,2);

-- ===== 収穫・価格データ =====
-- 収穫量: 100億まで対応（10,000,000,000.99）
ALTER TABLE work_reports
ALTER COLUMN harvest_amount TYPE NUMERIC(13,2);

-- 価格: 1兆円まで対応（1,000,000,000,000.99）
ALTER TABLE work_reports
ALTER COLUMN expected_price TYPE NUMERIC(15,2);

-- 売上: 10兆円まで対応（収穫量×価格の最大値を考慮）
ALTER TABLE work_reports
ALTER COLUMN expected_revenue TYPE NUMERIC(16,2);

-- ===== 肥料データ =====
ALTER TABLE work_reports
ALTER COLUMN fertilizer_amount TYPE NUMERIC(10,2);

-- ===== 収支データ =====
-- 総収入: 10兆円まで対応
ALTER TABLE work_reports
ALTER COLUMN income_total TYPE NUMERIC(16,2);

-- 総支出: 10兆円まで対応
ALTER TABLE work_reports
ALTER COLUMN expense_total TYPE NUMERIC(16,2);

-- 純利益: ±10兆円まで対応
ALTER TABLE work_reports
ALTER COLUMN net_income TYPE NUMERIC(16,2);

ALTER TABLE work_reports
ALTER COLUMN work_amount TYPE NUMERIC(10,2);

-- 3. CHECK制約の更新（必要に応じて）

-- 湿度の制約
ALTER TABLE work_reports
DROP CONSTRAINT IF EXISTS work_reports_humidity_check;

ALTER TABLE work_reports
ADD CONSTRAINT work_reports_humidity_check
CHECK (humidity >= 0 AND humidity <= 100);

-- pH値の制約
ALTER TABLE work_reports
DROP CONSTRAINT IF EXISTS work_reports_soil_ph_check;

ALTER TABLE work_reports
ADD CONSTRAINT work_reports_soil_ph_check
CHECK (soil_ph >= 0.0 AND soil_ph <= 14.0);

-- 塩基飽和度の制約
ALTER TABLE work_reports
DROP CONSTRAINT IF EXISTS work_reports_base_saturation_check;

ALTER TABLE work_reports
ADD CONSTRAINT work_reports_base_saturation_check
CHECK (base_saturation >= 0 AND base_saturation <= 100);

-- 4. 変更後の確認
SELECT
  column_name,
  data_type,
  numeric_precision,
  numeric_scale,
  CASE
    WHEN data_type IN ('numeric', 'decimal') THEN
      CONCAT('NUMERIC(', numeric_precision, ',', numeric_scale, ')')
    WHEN data_type = 'integer' THEN
      'INTEGER'
    ELSE data_type
  END AS new_type
FROM information_schema.columns
WHERE table_name = 'work_reports'
  AND column_name IN (
    'work_duration', 'worker_count', 'temperature', 'humidity',
    'soil_ph', 'soil_ec', 'phosphorus_absorption', 'cec',
    'exchangeable_calcium', 'exchangeable_magnesium', 'exchangeable_potassium',
    'harvest_amount', 'expected_price'
  )
ORDER BY column_name;

-- 5. 成功メッセージ
SELECT '✅ データベース再設計が完了しました' AS status;