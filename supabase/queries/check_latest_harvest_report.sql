-- ====================================================================
-- 最新の収穫レポート確認クエリ
-- データ分析ページに反映されない原因調査
-- ====================================================================

-- 1. 最新の作業レポート（全種類）
SELECT
  '=== 最新の作業レポート（上位10件） ===' as section;

SELECT
  wr.id,
  wr.work_date,
  wr.work_type,
  v.name as vegetable_name,
  wr.harvest_amount,
  wr.harvest_unit,
  wr.created_at,
  wr.deleted_at,
  wr.work_duration,
  wr.duration_hours,
  wr.worker_count
FROM work_reports wr
LEFT JOIN vegetables v ON wr.vegetable_id = v.id
WHERE wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
ORDER BY wr.created_at DESC
LIMIT 10;

-- 2. 今日作成された収穫レポート
SELECT
  '=== 今日作成された収穫レポート ===' as section;

SELECT
  wr.id,
  wr.work_date,
  wr.work_type,
  v.name as vegetable_name,
  wr.harvest_amount,
  wr.harvest_unit,
  wr.expected_price,
  wr.expected_revenue,
  wr.created_at,
  wr.deleted_at
FROM work_reports wr
LEFT JOIN vegetables v ON wr.vegetable_id = v.id
WHERE wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
  AND wr.work_type = 'harvesting'
  AND DATE(wr.created_at) = CURRENT_DATE
ORDER BY wr.created_at DESC;

-- 3. 直近12ヶ月の期間チェック
SELECT
  '=== 直近12ヶ月の期間 ===' as section;

SELECT
  CURRENT_DATE - INTERVAL '12 months' as "開始日",
  CURRENT_DATE as "終了日";

-- 4. 直近12ヶ月の収穫レポート数
SELECT
  '=== 直近12ヶ月の収穫レポート ===' as section;

SELECT
  COUNT(*) as "総収穫レポート数",
  COUNT(CASE WHEN wr.deleted_at IS NULL THEN 1 END) as "アクティブな収穫レポート",
  COUNT(CASE WHEN wr.deleted_at IS NOT NULL THEN 1 END) as "削除済み収穫レポート",
  SUM(wr.harvest_amount) as "総収穫量",
  MIN(wr.work_date) as "最古の収穫日",
  MAX(wr.work_date) as "最新の収穫日"
FROM work_reports wr
WHERE wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
  AND wr.work_type = 'harvesting'
  AND wr.work_date >= CURRENT_DATE - INTERVAL '12 months'
  AND wr.work_date <= CURRENT_DATE;

-- 5. 野菜別の収穫レポート
SELECT
  '=== 野菜別の収穫レポート ===' as section;

SELECT
  v.name as vegetable_name,
  COUNT(wr.id) as report_count,
  SUM(wr.harvest_amount) as total_harvest,
  MAX(wr.work_date) as latest_harvest_date
FROM vegetables v
LEFT JOIN work_reports wr ON v.id = wr.vegetable_id
  AND wr.work_type = 'harvesting'
  AND wr.work_date >= CURRENT_DATE - INTERVAL '12 months'
  AND wr.deleted_at IS NULL
WHERE v.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
  AND v.deleted_at IS NULL
GROUP BY v.id, v.name
ORDER BY v.name;

-- 6. 会計データの有無確認
SELECT
  '=== 最新レポートの会計データ ===' as section;

SELECT
  wr.id,
  wr.work_date,
  wr.work_type,
  v.name as vegetable_name,
  COUNT(wra.id) as accounting_entries,
  SUM(CASE WHEN ai.type = 'income' THEN wra.amount ELSE 0 END) as income_total,
  SUM(CASE WHEN ai.type = 'expense' THEN wra.amount ELSE 0 END) as expense_total
FROM work_reports wr
LEFT JOIN vegetables v ON wr.vegetable_id = v.id
LEFT JOIN work_report_accounting wra ON wr.id = wra.work_report_id
LEFT JOIN accounting_items ai ON wra.accounting_item_id = ai.id
WHERE wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
  AND DATE(wr.created_at) = CURRENT_DATE
GROUP BY wr.id, wr.work_date, wr.work_type, v.name
ORDER BY wr.created_at DESC;

-- 7. APIが返すデータの確認（/api/reports相当）
SELECT
  '=== APIレスポンス相当のデータ ===' as section;

SELECT
  wr.id,
  wr.work_date,
  wr.work_type,
  v.name as vegetable_name,
  wr.harvest_amount,
  wr.expected_revenue,
  wr.work_duration,
  wr.worker_count,
  wr.deleted_at,
  v.deleted_at as vegetable_deleted_at
FROM work_reports wr
LEFT JOIN vegetables v ON wr.vegetable_id = v.id
WHERE wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
  AND wr.work_date >= CURRENT_DATE - INTERVAL '12 months'
  AND wr.work_date <= CURRENT_DATE
  AND wr.deleted_at IS NULL
ORDER BY wr.created_at DESC
LIMIT 5;