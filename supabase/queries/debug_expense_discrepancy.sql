-- ====================================================================
-- 支出金額の不一致調査用クエリ
-- 作業種類別統合レポートとの差異を特定
-- ====================================================================

-- 1. 基本情報の確認（データ範囲と件数）
SELECT
  '=== データ範囲確認 ===' as section,
  MIN(wr.work_date) as "最古日付",
  MAX(wr.work_date) as "最新日付",
  COUNT(DISTINCT wr.id) as "作業レポート数",
  COUNT(DISTINCT wr.vegetable_id) as "野菜数",
  COUNT(wra.id) as "会計エントリ数"
FROM work_reports wr
LEFT JOIN work_report_accounting wra ON wr.id = wra.work_report_id
WHERE
  wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
  AND wr.work_date >= CURRENT_DATE - INTERVAL '12 months'
  AND wr.deleted_at IS NULL;

-- 2. 野菜別の支出集計（作業種類別レポートとの比較用）
SELECT
  '=== 野菜別支出集計 ===' as section;

SELECT
  v.id as "野菜ID",
  v.name as "野菜名",
  COUNT(DISTINCT wr.id) as "レポート数",
  COUNT(wra.id) as "会計項目数",
  TO_CHAR(COALESCE(SUM(
    CASE
      WHEN ai.type = 'expense'
        OR ai.cost_type IN ('variable_cost', 'fixed_cost')
        OR (ai.code IS NOT NULL AND NOT (ai.code LIKE '①%' OR ai.code LIKE '②%' OR ai.code LIKE '③%'))
      THEN wra.amount
      ELSE 0
    END
  ), 0), '999,999,999') || '円' as "支出額"
FROM vegetables v
LEFT JOIN work_reports wr ON v.id = wr.vegetable_id
  AND wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
  AND wr.work_date >= CURRENT_DATE - INTERVAL '12 months'
  AND wr.deleted_at IS NULL
LEFT JOIN work_report_accounting wra ON wr.id = wra.work_report_id
LEFT JOIN accounting_items ai ON wra.accounting_item_id = ai.id
WHERE v.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
  AND v.deleted_at IS NULL
GROUP BY v.id, v.name
ORDER BY v.name;

-- 3. 野菜別・会計項目別の詳細
SELECT
  '=== 野菜別・会計項目別詳細 ===' as section;

SELECT
  v.name as "野菜名",
  ai.code as "コード",
  ai.name as "項目名",
  ai.type as "タイプ",
  ai.cost_type as "コストタイプ",
  COUNT(wra.id) as "件数",
  TO_CHAR(SUM(wra.amount), '999,999,999') || '円' as "金額"
FROM work_reports wr
INNER JOIN vegetables v ON wr.vegetable_id = v.id
INNER JOIN work_report_accounting wra ON wr.id = wra.work_report_id
INNER JOIN accounting_items ai ON wra.accounting_item_id = ai.id
WHERE
  wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
  AND wr.work_date >= CURRENT_DATE - INTERVAL '12 months'
  AND wr.deleted_at IS NULL
  AND (
    ai.type = 'expense'
    OR ai.cost_type IN ('variable_cost', 'fixed_cost')
    OR (ai.code IS NOT NULL AND NOT (ai.code LIKE '①%' OR ai.code LIKE '②%' OR ai.code LIKE '③%'))
  )
GROUP BY v.name, ai.code, ai.name, ai.type, ai.cost_type
ORDER BY v.name, SUM(wra.amount) DESC;

-- 4. 重複チェック（同じレポートに複数の会計エントリ）
SELECT
  '=== 重複エントリチェック ===' as section;

SELECT
  wr.id as "レポートID",
  wr.work_date as "作業日",
  v.name as "野菜名",
  COUNT(wra.id) as "会計エントリ数",
  STRING_AGG(ai.name || '(' || TO_CHAR(wra.amount, '999,999,999') || '円)', ', ') as "内訳"
FROM work_reports wr
INNER JOIN vegetables v ON wr.vegetable_id = v.id
INNER JOIN work_report_accounting wra ON wr.id = wra.work_report_id
INNER JOIN accounting_items ai ON wra.accounting_item_id = ai.id
WHERE
  wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
  AND wr.work_date >= CURRENT_DATE - INTERVAL '12 months'
  AND wr.deleted_at IS NULL
  AND (
    ai.type = 'expense'
    OR ai.cost_type IN ('variable_cost', 'fixed_cost')
    OR (ai.code IS NOT NULL AND NOT (ai.code LIKE '①%' OR ai.code LIKE '②%' OR ai.code LIKE '③%'))
  )
GROUP BY wr.id, wr.work_date, v.name
HAVING COUNT(wra.id) > 1
ORDER BY COUNT(wra.id) DESC, wr.work_date DESC
LIMIT 20;

-- 5. 異常値チェック（特に大きな金額）
SELECT
  '=== 異常値チェック（上位10件） ===' as section;

SELECT
  wr.id as "レポートID",
  wr.work_date as "作業日",
  v.name as "野菜名",
  ai.code as "コード",
  ai.name as "項目名",
  TO_CHAR(wra.amount, '999,999,999,999') || '円' as "金額",
  wra.notes as "備考"
FROM work_reports wr
INNER JOIN vegetables v ON wr.vegetable_id = v.id
INNER JOIN work_report_accounting wra ON wr.id = wra.work_report_id
INNER JOIN accounting_items ai ON wra.accounting_item_id = ai.id
WHERE
  wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
  AND wr.work_date >= CURRENT_DATE - INTERVAL '12 months'
  AND wr.deleted_at IS NULL
  AND (
    ai.type = 'expense'
    OR ai.cost_type IN ('variable_cost', 'fixed_cost')
    OR (ai.code IS NOT NULL AND NOT (ai.code LIKE '①%' OR ai.code LIKE '②%' OR ai.code LIKE '③%'))
  )
ORDER BY wra.amount DESC
LIMIT 10;

-- 6. 作業種類別レポートのAPI相当クエリ（比較用）
SELECT
  '=== 作業種類別レポートAPI相当の集計 ===' as section;

-- accountingAnalyticsProcessor.getCostDataWithSource 相当の処理
SELECT
  v.name as "野菜名",
  SUM(
    CASE
      WHEN ai.type = 'expense' THEN wra.amount
      ELSE 0
    END
  ) as "会計支出額（type=expense）",
  COUNT(DISTINCT wr.id) as "レポート数"
FROM vegetables v
LEFT JOIN work_reports wr ON v.id = wr.vegetable_id
  AND wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
  AND wr.work_date >= CURRENT_DATE - INTERVAL '12 months'
  AND wr.deleted_at IS NULL
LEFT JOIN work_report_accounting wra ON wr.id = wra.work_report_id
LEFT JOIN accounting_items ai ON wra.accounting_item_id = ai.id
  AND ai.type = 'expense'  -- フロントエンドのフィルタ条件
WHERE v.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
  AND v.deleted_at IS NULL
GROUP BY v.id, v.name
ORDER BY v.name;

-- 7. 日付範囲の詳細確認
SELECT
  '=== 月別データ存在確認 ===' as section;

SELECT
  TO_CHAR(DATE_TRUNC('month', wr.work_date), 'YYYY-MM') as "年月",
  COUNT(DISTINCT wr.id) as "レポート数",
  COUNT(wra.id) as "会計エントリ数",
  TO_CHAR(SUM(
    CASE
      WHEN ai.type = 'expense'
        OR ai.cost_type IN ('variable_cost', 'fixed_cost')
        OR (ai.code IS NOT NULL AND NOT (ai.code LIKE '①%' OR ai.code LIKE '②%' OR ai.code LIKE '③%'))
      THEN wra.amount
      ELSE 0
    END
  ), '999,999,999') || '円' as "支出額"
FROM work_reports wr
LEFT JOIN work_report_accounting wra ON wr.id = wra.work_report_id
LEFT JOIN accounting_items ai ON wra.accounting_item_id = ai.id
WHERE
  wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
  AND wr.work_date >= CURRENT_DATE - INTERVAL '12 months'
  AND wr.deleted_at IS NULL
GROUP BY DATE_TRUNC('month', wr.work_date)
ORDER BY DATE_TRUNC('month', wr.work_date);

-- 8. 総計の確認（複数の方法で）
SELECT
  '=== 総計確認（複数方法） ===' as section;

-- 方法1: 標準的な集計
SELECT
  '方法1: 標準集計' as method,
  TO_CHAR(SUM(wra.amount), '999,999,999,999') || '円' as total
FROM work_reports wr
INNER JOIN work_report_accounting wra ON wr.id = wra.work_report_id
INNER JOIN accounting_items ai ON wra.accounting_item_id = ai.id
WHERE
  wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
  AND wr.work_date >= CURRENT_DATE - INTERVAL '12 months'
  AND wr.deleted_at IS NULL
  AND (
    ai.type = 'expense'
    OR ai.cost_type IN ('variable_cost', 'fixed_cost')
    OR (ai.code IS NOT NULL AND NOT (ai.code LIKE '①%' OR ai.code LIKE '②%' OR ai.code LIKE '③%'))
  )

UNION ALL

-- 方法2: type=expenseのみ
SELECT
  '方法2: type=expenseのみ' as method,
  TO_CHAR(SUM(wra.amount), '999,999,999,999') || '円' as total
FROM work_reports wr
INNER JOIN work_report_accounting wra ON wr.id = wra.work_report_id
INNER JOIN accounting_items ai ON wra.accounting_item_id = ai.id
WHERE
  wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
  AND wr.work_date >= CURRENT_DATE - INTERVAL '12 months'
  AND wr.deleted_at IS NULL
  AND ai.type = 'expense'

UNION ALL

-- 方法3: 野菜別集計の合計
SELECT
  '方法3: 野菜別集計の合計' as method,
  TO_CHAR(SUM(vegetable_total), '999,999,999,999') || '円' as total
FROM (
  SELECT
    v.id,
    SUM(
      CASE
        WHEN ai.type = 'expense' THEN wra.amount
        ELSE 0
      END
    ) as vegetable_total
  FROM vegetables v
  LEFT JOIN work_reports wr ON v.id = wr.vegetable_id
    AND wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
    AND wr.work_date >= CURRENT_DATE - INTERVAL '12 months'
    AND wr.deleted_at IS NULL
  LEFT JOIN work_report_accounting wra ON wr.id = wra.work_report_id
  LEFT JOIN accounting_items ai ON wra.accounting_item_id = ai.id
  WHERE v.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
    AND v.deleted_at IS NULL
  GROUP BY v.id
) as vegetable_sums;