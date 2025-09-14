-- ========================================
-- 即座に実行すべき修正SQL
-- ========================================

-- エラー1: work_report_accounting.amount
-- 現在: NUMERIC(12,2) = 最大100億
-- 1000億を入力しようとしてエラー
ALTER TABLE work_report_accounting
ALTER COLUMN amount TYPE NUMERIC(16,2);

-- エラー2: work_reports内のNUMERIC(4,1)フィールド
-- 最大999.9の制限があるフィールドを特定して修正

-- まず問題のフィールドを確認
SELECT column_name, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_name = 'work_reports'
  AND numeric_precision = 4
  AND numeric_scale = 1;

-- 温度フィールドの修正（よくある問題）
ALTER TABLE work_reports
ALTER COLUMN temperature TYPE NUMERIC(5,1);

-- もし他にNUMERIC(4,1)のフィールドがあれば全て修正
-- 例：土壌温度、朝の気温、午後の気温など
DO $$
DECLARE
    col_name TEXT;
BEGIN
    FOR col_name IN
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'work_reports'
          AND numeric_precision = 4
          AND numeric_scale = 1
    LOOP
        EXECUTE format('ALTER TABLE work_reports ALTER COLUMN %I TYPE NUMERIC(6,1)', col_name);
        RAISE NOTICE 'Fixed column: %', col_name;
    END LOOP;
END $$;

-- 確認
SELECT
  '修正完了' AS status,
  COUNT(*) AS "修正されたフィールド数"
FROM information_schema.columns
WHERE table_name = 'work_reports'
  AND numeric_precision = 4
  AND numeric_scale = 1;