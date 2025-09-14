-- ========================================
-- work_reportsテーブルの全NUMERIC(4,1)フィールドを修正
-- ========================================

-- 1. 現在の問題のあるフィールドを確認
SELECT
  table_name AS "テーブル",
  column_name AS "フィールド",
  CONCAT('NUMERIC(', numeric_precision, ',', numeric_scale, ')') AS "現在の型",
  CASE
    WHEN column_name LIKE '%hours%' THEN '作業時間'
    WHEN column_name LIKE '%ph%' THEN 'pH値'
    WHEN column_name LIKE '%saturation%' THEN '飽和度'
    WHEN column_name LIKE '%ratio%' THEN '比率'
    WHEN column_name LIKE '%humus%' THEN '腐植'
    WHEN column_name LIKE '%iron%' THEN '鉄分'
    ELSE 'その他'
  END AS "用途"
FROM information_schema.columns
WHERE table_name = 'work_reports'
  AND numeric_precision <= 4
  AND numeric_scale = 1
ORDER BY column_name;

-- 2. work_reportsテーブルの修正

-- 作業時間（時間単位）- 最大999999.99時間まで対応
ALTER TABLE work_reports
ALTER COLUMN duration_hours TYPE NUMERIC(8,2);

-- 塩基飽和度 - 0〜100%なのでNUMERIC(5,2)で十分
ALTER TABLE work_reports
ALTER COLUMN base_saturation TYPE NUMERIC(5,2);

-- 塩基バランス比率 - 通常0.1〜20程度なのでNUMERIC(6,2)
ALTER TABLE work_reports
ALTER COLUMN calcium_magnesium_ratio TYPE NUMERIC(6,2);

ALTER TABLE work_reports
ALTER COLUMN magnesium_potassium_ratio TYPE NUMERIC(6,2);

-- 腐植含量 - 通常0〜20%程度なのでNUMERIC(5,2)
ALTER TABLE work_reports
ALTER COLUMN humus_content TYPE NUMERIC(5,2);

-- 遊離酸化鉄 - 大きな値も考慮してNUMERIC(8,2)
ALTER TABLE work_reports
ALTER COLUMN free_iron_oxide TYPE NUMERIC(8,2);

-- soil_phは既にNUMERIC(3,1)なので、そのままでOK（0.0〜14.0の範囲）

-- 3. growing_tasksテーブルの修正（ついでに）
ALTER TABLE growing_tasks
ALTER COLUMN estimated_hours TYPE NUMERIC(8,2);

ALTER TABLE growing_tasks
ALTER COLUMN actual_hours TYPE NUMERIC(8,2);

-- 4. work_report_accountingテーブルの修正（会計データ1000億対応）
ALTER TABLE work_report_accounting
ALTER COLUMN amount TYPE NUMERIC(16,2);

-- 5. 修正後の確認
SELECT
  'work_reports' AS "テーブル",
  column_name AS "フィールド",
  CONCAT('NUMERIC(', numeric_precision, ',', numeric_scale, ')') AS "新しい型",
  CASE
    WHEN numeric_precision >= 5 THEN '✅ 修正完了'
    WHEN column_name = 'soil_ph' AND numeric_precision = 3 THEN '✅ pH値はOK'
    ELSE '⚠️ 要確認'
  END AS "状態"
FROM information_schema.columns
WHERE table_name = 'work_reports'
  AND column_name IN (
    'duration_hours', 'base_saturation',
    'calcium_magnesium_ratio', 'magnesium_potassium_ratio',
    'humus_content', 'free_iron_oxide', 'soil_ph'
  )

UNION ALL

SELECT
  'growing_tasks',
  column_name,
  CONCAT('NUMERIC(', numeric_precision, ',', numeric_scale, ')'),
  CASE
    WHEN numeric_precision >= 5 THEN '✅ 修正完了'
    ELSE '⚠️ 要確認'
  END
FROM information_schema.columns
WHERE table_name = 'growing_tasks'
  AND column_name IN ('estimated_hours', 'actual_hours')

UNION ALL

SELECT
  'work_report_accounting',
  column_name,
  CONCAT('NUMERIC(', numeric_precision, ',', numeric_scale, ')'),
  CASE
    WHEN numeric_precision >= 16 THEN '✅ 1000億対応'
    ELSE '⚠️ 要確認'
  END
FROM information_schema.columns
WHERE table_name = 'work_report_accounting'
  AND column_name = 'amount'

ORDER BY "テーブル", "フィールド";

-- 6. 最終確認 - まだNUMERIC(4,1)以下のフィールドが残っていないか
SELECT
  COUNT(*) AS "残っている問題フィールド数"
FROM information_schema.columns
WHERE table_name IN ('work_reports', 'work_report_accounting', 'growing_tasks')
  AND numeric_precision <= 4
  AND numeric_scale = 1
  AND NOT (column_name = 'soil_ph' AND numeric_precision = 3);  -- soil_phは3,1でOK

-- 7. 成功メッセージ
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✅ 全ての修正が完了しました！'
    ELSE CONCAT('⚠️ まだ', COUNT(*), '個のフィールドに問題があります')
  END AS "結果"
FROM information_schema.columns
WHERE table_name IN ('work_reports', 'work_report_accounting', 'growing_tasks')
  AND numeric_precision <= 4
  AND numeric_scale = 1
  AND NOT (column_name = 'soil_ph' AND numeric_precision = 3);