-- ====================================================================
-- 総支出（直近12カ月）の簡易確認クエリ
-- ====================================================================

-- 1. 総支出額の確認
SELECT
  '総支出額（直近12カ月）' as metric,
  TO_CHAR(SUM(wra.amount), '999,999,999') || '円' as value,
  COUNT(DISTINCT wr.id) as "レポート数",
  COUNT(wra.id) as "会計項目数"
FROM work_reports wr
INNER JOIN work_report_accounting wra ON wr.id = wra.work_report_id
INNER JOIN accounting_items ai ON wra.accounting_item_id = ai.id
WHERE
  wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
  AND wr.work_date >= CURRENT_DATE - INTERVAL '12 months'
  AND wr.work_date <= CURRENT_DATE
  AND wr.deleted_at IS NULL
  AND (
    ai.type = 'expense'
    OR ai.cost_type IN ('variable_cost', 'fixed_cost')
    OR (ai.code IS NOT NULL AND NOT (ai.code LIKE '①%' OR ai.code LIKE '②%' OR ai.code LIKE '③%'))
  );

-- 2. 会計項目別の内訳
SELECT
  ai.code as "コード",
  ai.name as "項目名",
  ai.type as "タイプ",
  ai.category as "カテゴリ",
  ai.cost_type as "コストタイプ",
  COUNT(wra.id) as "使用回数",
  TO_CHAR(SUM(wra.amount), '999,999,999') || '円' as "合計金額"
FROM work_reports wr
INNER JOIN work_report_accounting wra ON wr.id = wra.work_report_id
INNER JOIN accounting_items ai ON wra.accounting_item_id = ai.id
WHERE
  wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
  AND wr.work_date >= CURRENT_DATE - INTERVAL '12 months'
  AND wr.work_date <= CURRENT_DATE
  AND wr.deleted_at IS NULL
  AND (
    ai.type = 'expense'
    OR ai.cost_type IN ('variable_cost', 'fixed_cost')
    OR (ai.code IS NOT NULL AND NOT (ai.code LIKE '①%' OR ai.code LIKE '②%' OR ai.code LIKE '③%'))
  )
GROUP BY ai.code, ai.name, ai.type, ai.category, ai.cost_type
ORDER BY SUM(wra.amount) DESC;

-- 3. 作業種別の内訳
SELECT
  wr.work_type as "作業種別",
  COUNT(DISTINCT wr.id) as "作業回数",
  TO_CHAR(SUM(wra.amount), '999,999,999') || '円' as "支出額"
FROM work_reports wr
INNER JOIN work_report_accounting wra ON wr.id = wra.work_report_id
INNER JOIN accounting_items ai ON wra.accounting_item_id = ai.id
WHERE
  wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
  AND wr.work_date >= CURRENT_DATE - INTERVAL '12 months'
  AND wr.work_date <= CURRENT_DATE
  AND wr.deleted_at IS NULL
  AND (
    ai.type = 'expense'
    OR ai.cost_type IN ('variable_cost', 'fixed_cost')
    OR (ai.code IS NOT NULL AND NOT (ai.code LIKE '①%' OR ai.code LIKE '②%' OR ai.code LIKE '③%'))
  )
GROUP BY wr.work_type
ORDER BY SUM(wra.amount) DESC;

-- 4. 月別の支出推移
SELECT
  TO_CHAR(DATE_TRUNC('month', wr.work_date), 'YYYY年MM月') as "月",
  TO_CHAR(SUM(wra.amount), '999,999,999') || '円' as "月間支出"
FROM work_reports wr
INNER JOIN work_report_accounting wra ON wr.id = wra.work_report_id
INNER JOIN accounting_items ai ON wra.accounting_item_id = ai.id
WHERE
  wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
  AND wr.work_date >= CURRENT_DATE - INTERVAL '12 months'
  AND wr.work_date <= CURRENT_DATE
  AND wr.deleted_at IS NULL
  AND (
    ai.type = 'expense'
    OR ai.cost_type IN ('variable_cost', 'fixed_cost')
    OR (ai.code IS NOT NULL AND NOT (ai.code LIKE '①%' OR ai.code LIKE '②%' OR ai.code LIKE '③%'))
  )
GROUP BY DATE_TRUNC('month', wr.work_date)
ORDER BY DATE_TRUNC('month', wr.work_date);

-- 5. 支出判定の詳細確認（デバッグ用）
SELECT DISTINCT
  ai.code as "コード",
  ai.name as "項目名",
  ai.type as "タイプ",
  ai.cost_type as "コストタイプ",
  CASE
    WHEN ai.type = 'expense' THEN '✓ type=expense'
    WHEN ai.cost_type IN ('variable_cost', 'fixed_cost') THEN '✓ cost_type'
    WHEN (ai.code IS NOT NULL AND NOT (ai.code LIKE '①%' OR ai.code LIKE '②%' OR ai.code LIKE '③%')) THEN '✓ code判定'
    ELSE '✗ 対象外'
  END as "支出判定理由"
FROM accounting_items ai
WHERE EXISTS (
  SELECT 1
  FROM work_reports wr
  INNER JOIN work_report_accounting wra ON wr.id = wra.work_report_id
  WHERE
    wra.accounting_item_id = ai.id
    AND wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
    AND wr.work_date >= CURRENT_DATE - INTERVAL '12 months'
)
ORDER BY ai.code;