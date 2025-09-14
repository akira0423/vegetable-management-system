-- ========================================
-- 035_fix_numeric_field_overflow.sql
-- 全NUMERIC(4,1)フィールドのオーバーフロー問題を修正
-- ========================================

-- 1. work_reportsテーブルの修正

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

-- 2. growing_tasksテーブルの修正
ALTER TABLE growing_tasks
ALTER COLUMN estimated_hours TYPE NUMERIC(8,2);

ALTER TABLE growing_tasks
ALTER COLUMN actual_hours TYPE NUMERIC(8,2);

-- 3. work_report_accountingテーブルの修正（会計データ1000億対応）
ALTER TABLE work_report_accounting
ALTER COLUMN amount TYPE NUMERIC(16,2);

-- 4. 修正完了の確認
DO $$
DECLARE
    problem_count INTEGER;
BEGIN
    -- NUMERIC(4,1)以下の問題フィールドをカウント
    SELECT COUNT(*) INTO problem_count
    FROM information_schema.columns
    WHERE table_name IN ('work_reports', 'work_report_accounting', 'growing_tasks')
      AND numeric_precision <= 4
      AND numeric_scale = 1
      AND NOT (column_name = 'soil_ph' AND numeric_precision = 3);  -- soil_phは3,1でOK

    IF problem_count = 0 THEN
        RAISE NOTICE '✅ 全ての数値フィールドの修正が完了しました！';
        RAISE NOTICE '対応可能な最大値:';
        RAISE NOTICE '  - 作業時間: 999,999.99時間';
        RAISE NOTICE '  - 会計金額: 10,000,000,000,000.99円（10兆円）';
        RAISE NOTICE '  - 塩基飽和度: 999.99%%';
        RAISE NOTICE '  - バランス比率: 9,999.99';
    ELSE
        RAISE WARNING '⚠️ まだ % 個のフィールドに問題があります', problem_count;
    END IF;
END $$;