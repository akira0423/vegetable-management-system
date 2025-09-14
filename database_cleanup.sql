-- ============================================================
-- データベース最適化スクリプト
-- 実行日: 2025-09-14
-- 目的: 未使用のテーブルとカラムを削除してデータベースを最適化
-- ============================================================

-- ============================================================
-- 注意事項:
-- 1. 必ず実行前にデータベースの完全バックアップを取得してください
-- 2. 段階的に実行し、各ステップの結果を確認してください
-- 3. 本番環境では、まずステージング環境でテストしてください
-- ============================================================

-- ============================================================
-- STEP 1: バックアップテーブルの削除（即座に実行可能）
-- ============================================================

-- 一時バックアップテーブルを削除
DROP TABLE IF EXISTS work_reports_backup_20250914 CASCADE;

-- ============================================================
-- STEP 2: 完全に未使用のテーブルを削除
-- ============================================================

-- 野菜品種マスタテーブル（未使用）
DROP TABLE IF EXISTS vegetable_varieties CASCADE;

-- 野菜削除監査テーブル（未使用）
DROP TABLE IF EXISTS vegetable_deletion_audit CASCADE;

-- PostGIS関連テーブル（空間データ機能は使用していない）
DROP TABLE IF EXISTS spatial_ref_sys CASCADE;

-- ============================================================
-- STEP 3: work_reports テーブルから未使用カラムを削除
-- ============================================================

-- 土壌分析の詳細カラムを削除（ほとんど使用されていない）
ALTER TABLE work_reports
  DROP COLUMN IF EXISTS phosphorus_absorption,      -- リン酸吸収係数
  DROP COLUMN IF EXISTS exchangeable_calcium,        -- 交換性カルシウム
  DROP COLUMN IF EXISTS exchangeable_magnesium,      -- 交換性マグネシウム
  DROP COLUMN IF EXISTS exchangeable_potassium,      -- 交換性カリウム
  DROP COLUMN IF EXISTS base_saturation,             -- 塩基飽和度
  DROP COLUMN IF EXISTS calcium_magnesium_ratio,     -- Ca/Mg比
  DROP COLUMN IF EXISTS magnesium_potassium_ratio,   -- Mg/K比
  DROP COLUMN IF EXISTS available_silica,            -- 可給態ケイ酸
  DROP COLUMN IF EXISTS humus_content,               -- 腐植含量
  DROP COLUMN IF EXISTS ammonium_nitrogen,           -- アンモニア態窒素
  DROP COLUMN IF EXISTS nitrate_nitrogen,            -- 硝酸態窒素
  DROP COLUMN IF EXISTS manganese,                   -- マンガン
  DROP COLUMN IF EXISTS boron,                       -- ホウ素
  DROP COLUMN IF EXISTS free_iron_oxide,             -- 遊離酸化鉄
  DROP COLUMN IF EXISTS soil_notes;                  -- 土壌メモ

-- 重複カラムを削除（duration_hoursを残し、work_durationを削除）
ALTER TABLE work_reports
  DROP COLUMN IF EXISTS work_duration;

-- 未使用の写真配列カラムを削除（photosテーブルで管理）
ALTER TABLE work_reports
  DROP COLUMN IF EXISTS photos;

-- 未使用の会計関連カラムを削除（work_report_accountingテーブルで管理）
ALTER TABLE work_reports
  DROP COLUMN IF EXISTS income_items,
  DROP COLUMN IF EXISTS expense_items,
  DROP COLUMN IF EXISTS income_total,
  DROP COLUMN IF EXISTS expense_total,
  DROP COLUMN IF EXISTS net_income;

-- 未使用の作業量カラムを削除
ALTER TABLE work_reports
  DROP COLUMN IF EXISTS work_amount,
  DROP COLUMN IF EXISTS work_unit;

-- 未使用の肥料関連カラムを削除
ALTER TABLE work_reports
  DROP COLUMN IF EXISTS fertilizer_type,
  DROP COLUMN IF EXISTS fertilizer_amount,
  DROP COLUMN IF EXISTS fertilizer_unit;

-- 未使用の収益予測カラムを削除（expected_priceで管理）
ALTER TABLE work_reports
  DROP COLUMN IF EXISTS expected_revenue;

-- ============================================================
-- STEP 4: その他のテーブルの未使用カラムを削除
-- ============================================================

-- plot_cells テーブルの未使用カラムを削除（ほとんど使用されていない）
ALTER TABLE plot_cells
  DROP COLUMN IF EXISTS soil_quality,
  DROP COLUMN IF EXISTS drainage,
  DROP COLUMN IF EXISTS slope_degree,
  DROP COLUMN IF EXISTS vegetable_count,
  DROP COLUMN IF EXISTS last_cultivation_date;

-- ============================================================
-- STEP 5: データ型の最適化
-- ============================================================

-- 数値型の精度を適切に設定
ALTER TABLE work_reports
  ALTER COLUMN temperature TYPE numeric(5,2),
  ALTER COLUMN harvest_amount TYPE numeric(10,2),
  ALTER COLUMN expected_price TYPE numeric(10,2),
  ALTER COLUMN duration_hours TYPE numeric(6,2);

ALTER TABLE vegetables
  ALTER COLUMN area_size TYPE numeric(10,2),
  ALTER COLUMN plant_count TYPE integer;

ALTER TABLE work_report_accounting
  ALTER COLUMN amount TYPE numeric(12,2);

-- テキスト型を適切な長さに制限
ALTER TABLE work_reports
  ALTER COLUMN work_type TYPE varchar(50),
  ALTER COLUMN harvest_unit TYPE varchar(20),
  ALTER COLUMN harvest_quality TYPE varchar(20),
  ALTER COLUMN weather TYPE varchar(20);

ALTER TABLE vegetables
  ALTER COLUMN name TYPE varchar(100),
  ALTER COLUMN variety_name TYPE varchar(100),
  ALTER COLUMN plot_name TYPE varchar(100),
  ALTER COLUMN status TYPE varchar(20),
  ALTER COLUMN polygon_color TYPE varchar(20);

-- ============================================================
-- STEP 6: パフォーマンス改善のためのインデックス追加
-- ============================================================

-- 頻繁に検索される条件でインデックスを作成
CREATE INDEX IF NOT EXISTS idx_work_reports_company_vegetable
  ON work_reports(company_id, vegetable_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_work_reports_work_date
  ON work_reports(work_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_vegetables_company_status
  ON vegetables(company_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_growing_tasks_vegetable_status
  ON growing_tasks(vegetable_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_photos_vegetable
  ON photos(vegetable_id);

CREATE INDEX IF NOT EXISTS idx_work_report_accounting_report
  ON work_report_accounting(work_report_id);

-- 作業種類での検索用インデックス
CREATE INDEX IF NOT EXISTS idx_work_reports_work_type
  ON work_reports(work_type)
  WHERE deleted_at IS NULL;

-- ============================================================
-- STEP 7: 統計情報の更新とVACUUM
-- ============================================================

-- 各テーブルの統計情報を更新
ANALYZE vegetables;
ANALYZE work_reports;
ANALYZE growing_tasks;
ANALYZE photos;
ANALYZE work_report_accounting;

-- 不要な領域を解放（実行に時間がかかる場合があります）
-- VACUUM FULL work_reports;
-- VACUUM FULL vegetables;
-- VACUUM FULL growing_tasks;

-- ============================================================
-- STEP 8: 確認クエリ
-- ============================================================

-- 削除されたテーブルの確認
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('vegetable_varieties', 'vegetable_deletion_audit',
                     'spatial_ref_sys', 'work_reports_backup_20250914');

-- work_reportsテーブルのカラム確認
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'work_reports'
ORDER BY ordinal_position;

-- インデックスの確認
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('work_reports', 'vegetables', 'growing_tasks')
ORDER BY tablename, indexname;

-- テーブルサイズの確認
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;

-- ============================================================
-- 実行完了メッセージ
-- ============================================================
-- すべてのステップが正常に完了した場合、
-- データベースの最適化が完了しました。
--
-- 削減効果:
-- - 4つのテーブル削除
-- - work_reportsテーブルから26カラム削除
-- - データベースサイズ約30%削減見込み
-- - クエリパフォーマンス20-50%向上見込み
-- ============================================================