-- ============================================================
-- データベース復元スクリプト
-- 削除したテーブルとカラムを元に戻します
-- ============================================================

-- ============================================================
-- STEP 1: 削除したテーブルを再作成
-- ============================================================

-- 1. vegetable_varieties テーブルを再作成
CREATE TABLE IF NOT EXISTS public.vegetable_varieties (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  variety text,
  category text NOT NULL,
  standard_growth_days integer,
  standard_tasks jsonb DEFAULT '[]'::jsonb,
  planting_season text,
  harvest_season text,
  optimal_temperature_min integer,
  optimal_temperature_max integer,
  water_requirement text,
  sunlight_requirement text,
  soil_ph_min numeric,
  soil_ph_max numeric,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT vegetable_varieties_pkey PRIMARY KEY (id)
);

-- 2. vegetable_deletion_audit テーブルを再作成
CREATE TABLE IF NOT EXISTS public.vegetable_deletion_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  deleted_vegetable_id uuid NOT NULL,
  vegetable_snapshot jsonb NOT NULL,
  related_data_count jsonb NOT NULL,
  deletion_reason text NOT NULL,
  deleted_by uuid,
  deleted_at timestamp with time zone DEFAULT now(),
  confirmation_details jsonb,
  business_impact jsonb,
  CONSTRAINT vegetable_deletion_audit_pkey PRIMARY KEY (id)
);

-- 3. work_reports_backup_20250914 テーブルを再作成（必要な場合）
CREATE TABLE IF NOT EXISTS public.work_reports_backup_20250914 (
  id uuid,
  company_id uuid,
  vegetable_id uuid,
  growing_task_id uuid,
  work_type text,
  description text,
  work_date date,
  start_time time without time zone,
  end_time time without time zone,
  duration_hours numeric,
  weather text,
  temperature numeric,
  harvest_amount numeric,
  harvest_unit text,
  harvest_quality text,
  worker_count integer,
  notes text,
  deleted_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  expected_price numeric,
  humidity integer,
  soil_ph numeric,
  soil_ec numeric,
  phosphorus_absorption integer,
  cec numeric,
  exchangeable_calcium integer,
  exchangeable_magnesium integer,
  exchangeable_potassium integer,
  base_saturation numeric,
  calcium_magnesium_ratio numeric,
  magnesium_potassium_ratio numeric,
  available_phosphorus numeric,
  available_silica numeric,
  humus_content numeric,
  ammonium_nitrogen numeric,
  nitrate_nitrogen numeric,
  manganese numeric,
  boron numeric,
  free_iron_oxide numeric,
  soil_notes text,
  photos text[],  -- 修正: ARRAYではなくtext[]
  income_items jsonb,
  expense_items jsonb,
  income_total numeric,
  expense_total numeric,
  net_income numeric,
  work_amount numeric,
  work_unit text,
  fertilizer_type text,
  fertilizer_amount numeric,
  fertilizer_unit text,
  expected_revenue numeric,
  work_duration integer
);

-- ============================================================
-- STEP 2: work_reports テーブルに削除したカラムを追加
-- （土壌分析以外のカラム）
-- ============================================================

-- 重複カラムを追加
ALTER TABLE work_reports
  ADD COLUMN IF NOT EXISTS work_duration integer;

-- 写真配列カラムを追加
ALTER TABLE work_reports
  ADD COLUMN IF NOT EXISTS photos text[];

-- 会計関連カラムを追加
ALTER TABLE work_reports
  ADD COLUMN IF NOT EXISTS income_items jsonb,
  ADD COLUMN IF NOT EXISTS expense_items jsonb,
  ADD COLUMN IF NOT EXISTS income_total numeric,
  ADD COLUMN IF NOT EXISTS expense_total numeric,
  ADD COLUMN IF NOT EXISTS net_income numeric;

-- 作業量カラムを追加
ALTER TABLE work_reports
  ADD COLUMN IF NOT EXISTS work_amount numeric,
  ADD COLUMN IF NOT EXISTS work_unit text;

-- 肥料関連カラムを追加
ALTER TABLE work_reports
  ADD COLUMN IF NOT EXISTS fertilizer_type text,
  ADD COLUMN IF NOT EXISTS fertilizer_amount numeric,
  ADD COLUMN IF NOT EXISTS fertilizer_unit text;

-- 収益予測カラムを追加
ALTER TABLE work_reports
  ADD COLUMN IF NOT EXISTS expected_revenue numeric;

-- ============================================================
-- STEP 3: 削除したインデックスを確認して削除（もし追加されていた場合）
-- ============================================================

-- 追加したインデックスを削除（元に戻すため）
DROP INDEX IF EXISTS idx_work_reports_company_vegetable;
DROP INDEX IF EXISTS idx_work_reports_work_date;
DROP INDEX IF EXISTS idx_vegetables_company_status;
DROP INDEX IF EXISTS idx_growing_tasks_vegetable_status;
DROP INDEX IF EXISTS idx_photos_vegetable;
DROP INDEX IF EXISTS idx_work_report_accounting_report;
DROP INDEX IF EXISTS idx_work_reports_work_type;

-- ============================================================
-- STEP 4: 確認クエリ
-- ============================================================

-- テーブルが復元されたことを確認
SELECT
  'テーブル復元確認' as 確認項目,
  COUNT(*)::text || ' テーブル' as 結果
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('vegetable_varieties', 'vegetable_deletion_audit', 'work_reports_backup_20250914')
UNION ALL
-- work_reportsのカラム数を確認
SELECT
  'work_reportsカラム数' as 確認項目,
  COUNT(*)::text || ' カラム' as 結果
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'work_reports'
UNION ALL
-- インデックスの状態を確認
SELECT
  'インデックス数' as 確認項目,
  COUNT(*)::text || ' インデックス' as 結果
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'work_reports';

-- ============================================================
-- 実行完了メッセージ
-- ============================================================
-- このスクリプトを実行後、アプリケーションが正常に動作することを確認してください。
--
-- 復元された内容:
-- - vegetable_varieties テーブル
-- - vegetable_deletion_audit テーブル
-- - work_reports_backup_20250914 テーブル
-- - work_reports の削除したカラム（土壌分析以外）
-- - 追加したインデックスの削除
-- ============================================================