-- ====================================================================
-- フロントエンド vs バックエンド ロジック比較クエリ
-- 作業種類別統合レポートとSQLクエリの差異を特定
-- ====================================================================

-- 1. フロントエンドのロジックを完全再現
-- accounting-analytics-processor.ts の getCostDataWithSource メソッドを再現
SELECT
  '=== フロントエンドロジック完全再現 ===' as section;

SELECT
  v.name as "野菜名",
  COUNT(DISTINCT wr.id) as "レポート数",

  -- type = 'expense' のみ（フロントエンドの条件）
  SUM(
    CASE WHEN ai.type = 'expense' THEN wra.amount ELSE 0 END
  ) as "支出額（type=expense）",

  -- cost_type での判定も含む（バックエンドの条件）
  SUM(
    CASE
      WHEN ai.type = 'expense'
        OR ai.cost_type IN ('variable_cost', 'fixed_cost')
        OR (ai.code IS NOT NULL AND NOT (ai.code LIKE '①%' OR ai.code LIKE '②%' OR ai.code LIKE '③%'))
      THEN wra.amount
      ELSE 0
    END
  ) as "支出額（全条件）",

  -- 差額
  SUM(
    CASE
      WHEN ai.type = 'expense'
        OR ai.cost_type IN ('variable_cost', 'fixed_cost')
        OR (ai.code IS NOT NULL AND NOT (ai.code LIKE '①%' OR ai.code LIKE '②%' OR ai.code LIKE '③%'))
      THEN wra.amount
      ELSE 0
    END
  ) - SUM(
    CASE WHEN ai.type = 'expense' THEN wra.amount ELSE 0 END
  ) as "差額"

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

-- 2. 野菜IDがNULLのレポートチェック
SELECT
  '=== 野菜未設定レポートチェック ===' as section;

SELECT
  wr.id as "レポートID",
  wr.work_date as "作業日",
  wr.vegetable_id as "野菜ID",
  ai.name as "項目名",
  wra.amount as "金額"
FROM work_reports wr
INNER JOIN work_report_accounting wra ON wr.id = wra.work_report_id
INNER JOIN accounting_items ai ON wra.accounting_item_id = ai.id
WHERE
  wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
  AND wr.work_date >= CURRENT_DATE - INTERVAL '12 months'
  AND wr.deleted_at IS NULL
  AND wr.vegetable_id IS NULL
  AND ai.type = 'expense';

-- 3. 作業種類別レポートのフロントエンドロジック再現
-- work-type-analysis-report.tsx の処理を再現
SELECT
  '=== 作業種類別レポート計算ロジック ===' as section;

WITH report_costs AS (
  SELECT
    wr.id,
    wr.vegetable_id,
    wr.work_type,
    wr.work_date,
    -- フロントエンドの accountingAnalyticsProcessor.getCostDataWithSource 相当
    COALESCE(SUM(
      CASE WHEN ai.type = 'expense' THEN wra.amount ELSE 0 END
    ), 0) as cost_amount
  FROM work_reports wr
  LEFT JOIN work_report_accounting wra ON wr.id = wra.work_report_id
  LEFT JOIN accounting_items ai ON wra.accounting_item_id = ai.id
  WHERE
    wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
    AND wr.work_date >= CURRENT_DATE - INTERVAL '12 months'
    AND wr.deleted_at IS NULL
  GROUP BY wr.id, wr.vegetable_id, wr.work_type, wr.work_date
)
SELECT
  v.name as "野菜名",
  wt.work_type as "作業種類",
  COUNT(rc.id) as "作業回数",
  SUM(rc.cost_amount) as "コスト合計"
FROM vegetables v
INNER JOIN (SELECT DISTINCT work_type FROM work_reports) wt ON true
LEFT JOIN report_costs rc ON v.id = rc.vegetable_id AND wt.work_type = rc.work_type
WHERE v.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
  AND v.deleted_at IS NULL
GROUP BY v.id, v.name, wt.work_type
ORDER BY v.name, wt.work_type;

-- 4. 日付フィルタの確認
SELECT
  '=== 日付範囲の差異確認 ===' as section;

SELECT
  'SQLクエリ日付範囲' as source,
  CURRENT_DATE - INTERVAL '12 months' as start_date,
  CURRENT_DATE as end_date
UNION ALL
SELECT
  '作業種類別レポート想定範囲' as source,
  DATE_TRUNC('month', CURRENT_DATE - INTERVAL '12 months') as start_date,
  DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day' as end_date;

-- 5. 総計の比較（最終確認）
SELECT
  '=== 総計比較 ===' as section;

WITH totals AS (
  SELECT
    'type=expenseのみ（フロントエンド想定）' as method,
    SUM(
      CASE WHEN ai.type = 'expense' THEN wra.amount ELSE 0 END
    ) as total
  FROM work_reports wr
  LEFT JOIN work_report_accounting wra ON wr.id = wra.work_report_id
  LEFT JOIN accounting_items ai ON wra.accounting_item_id = ai.id
  WHERE
    wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
    AND wr.work_date >= CURRENT_DATE - INTERVAL '12 months'
    AND wr.deleted_at IS NULL

  UNION ALL

  SELECT
    '全条件（SQLクエリ）' as method,
    SUM(
      CASE
        WHEN ai.type = 'expense'
          OR ai.cost_type IN ('variable_cost', 'fixed_cost')
          OR (ai.code IS NOT NULL AND NOT (ai.code LIKE '①%' OR ai.code LIKE '②%' OR ai.code LIKE '③%'))
        THEN wra.amount
        ELSE 0
      END
    ) as total
  FROM work_reports wr
  LEFT JOIN work_report_accounting wra ON wr.id = wra.work_report_id
  LEFT JOIN accounting_items ai ON wra.accounting_item_id = ai.id
  WHERE
    wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
    AND wr.work_date >= CURRENT_DATE - INTERVAL '12 months'
    AND wr.deleted_at IS NULL
)
SELECT
  method,
  TO_CHAR(total, '999,999,999,999') || '円' as "合計",
  TO_CHAR(total - LAG(total) OVER (ORDER BY method), '999,999,999,999') || '円' as "差額"
FROM totals
ORDER BY method;