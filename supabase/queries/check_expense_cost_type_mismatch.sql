-- ====================================================================
-- type=expense だが cost_type が設定されていない項目の確認
-- フロントエンドとバックエンドの不一致原因調査
-- ====================================================================

-- 1. 会計項目の type と cost_type の組み合わせ確認
SELECT
  '=== type と cost_type の組み合わせ ===' as section;

SELECT
  ai.code,
  ai.name,
  ai.type,
  ai.cost_type,
  CASE
    WHEN ai.type = 'expense' AND ai.cost_type IS NULL THEN '❌ 不一致: type=expenseだがcost_typeなし'
    WHEN ai.type = 'expense' AND ai.cost_type NOT IN ('variable_cost', 'fixed_cost') THEN '❌ 不一致: type=expenseだがcost_typeが異なる'
    WHEN ai.type = 'expense' AND ai.cost_type IN ('variable_cost', 'fixed_cost') THEN '✅ 一致'
    ELSE '📝 その他'
  END as status
FROM accounting_items ai
WHERE EXISTS (
  SELECT 1
  FROM work_report_accounting wra
  INNER JOIN work_reports wr ON wra.work_report_id = wr.id
  WHERE wra.accounting_item_id = ai.id
    AND wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
    AND wr.work_date >= CURRENT_DATE - INTERVAL '12 months'
)
ORDER BY ai.code;

-- 2. 実際の作業レポートでの不一致項目
SELECT
  '=== 実際の不一致データ ===' as section;

SELECT
  wr.work_date,
  v.name as vegetable_name,
  ai.code,
  ai.name as item_name,
  ai.type,
  ai.cost_type,
  wra.amount,
  CASE
    WHEN ai.type = 'expense' THEN '✅ SQLで含まれる'
    ELSE '❌ SQLで含まれない'
  END as sql_included,
  CASE
    WHEN ai.cost_type IN ('variable_cost', 'fixed_cost') THEN '✅ フロントで含まれる'
    ELSE '❌ フロントで含まれない'
  END as frontend_included
FROM work_reports wr
INNER JOIN vegetables v ON wr.vegetable_id = v.id
INNER JOIN work_report_accounting wra ON wr.id = wra.work_report_id
INNER JOIN accounting_items ai ON wra.accounting_item_id = ai.id
WHERE
  wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
  AND wr.work_date >= CURRENT_DATE - INTERVAL '12 months'
  AND wr.deleted_at IS NULL
  AND (
    -- SQLでは含まれるがフロントエンドでは含まれないケース
    (ai.type = 'expense' AND (ai.cost_type IS NULL OR ai.cost_type NOT IN ('variable_cost', 'fixed_cost')))
    OR
    -- フロントエンドでは含まれるがSQLでは含まれないケース
    (ai.type != 'expense' AND ai.cost_type IN ('variable_cost', 'fixed_cost'))
  )
ORDER BY wr.work_date DESC;

-- 3. 金額の差異計算
SELECT
  '=== 金額差異の詳細 ===' as section;

WITH comparison AS (
  SELECT
    'SQLクエリ（type=expense）' as method,
    SUM(CASE WHEN ai.type = 'expense' THEN wra.amount ELSE 0 END) as total
  FROM work_reports wr
  INNER JOIN work_report_accounting wra ON wr.id = wra.work_report_id
  INNER JOIN accounting_items ai ON wra.accounting_item_id = ai.id
  WHERE
    wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
    AND wr.work_date >= CURRENT_DATE - INTERVAL '12 months'
    AND wr.deleted_at IS NULL

  UNION ALL

  SELECT
    'フロントエンド（cost_type）' as method,
    SUM(CASE WHEN ai.cost_type IN ('variable_cost', 'fixed_cost') THEN wra.amount ELSE 0 END) as total
  FROM work_reports wr
  INNER JOIN work_report_accounting wra ON wr.id = wra.work_report_id
  INNER JOIN accounting_items ai ON wra.accounting_item_id = ai.id
  WHERE
    wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
    AND wr.work_date >= CURRENT_DATE - INTERVAL '12 months'
    AND wr.deleted_at IS NULL
)
SELECT
  method,
  TO_CHAR(total, '999,999,999,999') || '円' as amount,
  CASE
    WHEN LAG(total) OVER (ORDER BY method) IS NULL THEN ''
    ELSE TO_CHAR(total - LAG(total) OVER (ORDER BY method), '999,999,999,999') || '円'
  END as difference
FROM comparison;

-- 4. accounting_items テーブルの全項目確認
SELECT
  '=== 会計項目マスタ確認 ===' as section;

SELECT
  code,
  name,
  type,
  cost_type,
  category
FROM accounting_items
WHERE type = 'expense' OR cost_type IN ('variable_cost', 'fixed_cost')
ORDER BY code;