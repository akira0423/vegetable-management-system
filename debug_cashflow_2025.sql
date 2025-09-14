-- ========================================
-- 2025年12月のデータを正しく調査
-- ========================================

-- 1. 2025年12月の作業レポートと会計データを確認
SELECT
  wr.id AS "作業レポートID",
  wr.work_date AS "作業日",
  wr.work_type AS "作業種別",
  wr.description AS "作業内容",
  wra.amount AS "金額",
  ai.name AS "勘定項目名",
  ai.cost_type AS "コストタイプ",
  ai.code AS "コード"
FROM work_reports wr
LEFT JOIN work_report_accounting wra ON wr.id = wra.work_report_id
LEFT JOIN accounting_items ai ON wra.accounting_item_id = ai.id
WHERE wr.work_date >= '2025-12-01'
  AND wr.work_date < '2026-01-01'
  AND wr.deleted_at IS NULL
ORDER BY wr.work_date, wra.amount DESC;

-- 2. 2025年12月の作業種別ごとの集計
WITH december_2025_data AS (
  SELECT
    wr.work_type,
    CASE
      WHEN ai.cost_type = 'income' THEN wra.amount
      ELSE 0
    END AS income,
    CASE
      WHEN ai.cost_type IN ('variable_cost', 'fixed_cost') THEN wra.amount
      ELSE 0
    END AS expense
  FROM work_reports wr
  INNER JOIN work_report_accounting wra ON wr.id = wra.work_report_id
  INNER JOIN accounting_items ai ON wra.accounting_item_id = ai.id
  WHERE wr.work_date >= '2025-12-01'
    AND wr.work_date < '2026-01-01'
    AND wr.deleted_at IS NULL
)
SELECT
  work_type AS "作業種別",
  SUM(income) AS "収入合計",
  SUM(expense) AS "支出合計",
  SUM(income) - SUM(expense) AS "純損益"
FROM december_2025_data
GROUP BY work_type
ORDER BY "支出合計" DESC;

-- 3. wateringカテゴリの詳細内訳
SELECT
  wr.work_date AS "作業日",
  wr.description AS "作業内容",
  ai.name AS "勘定項目",
  ai.cost_type AS "コストタイプ",
  wra.amount AS "金額"
FROM work_reports wr
INNER JOIN work_report_accounting wra ON wr.id = wra.work_report_id
INNER JOIN accounting_items ai ON wra.accounting_item_id = ai.id
WHERE wr.work_type = 'watering'
  AND wr.work_date >= '2025-12-01'
  AND wr.work_date < '2026-01-01'
  AND wr.deleted_at IS NULL
ORDER BY wra.amount DESC;

-- 4. 月次キャッシュフローの表示期間を確認するためのデータ範囲取得
SELECT
  MIN(work_date) AS "最初の作業日",
  MAX(work_date) AS "最後の作業日",
  COUNT(DISTINCT DATE_TRUNC('month', work_date)) AS "月数"
FROM work_reports
WHERE deleted_at IS NULL;

-- 5. 2025年の月別集計（全作業種別）
SELECT
  TO_CHAR(wr.work_date, 'YYYY-MM') AS "年月",
  wr.work_type AS "作業種別",
  SUM(CASE WHEN ai.cost_type = 'income' THEN wra.amount ELSE 0 END) AS "収入",
  SUM(CASE WHEN ai.cost_type IN ('variable_cost', 'fixed_cost') THEN wra.amount ELSE 0 END) AS "支出"
FROM work_reports wr
LEFT JOIN work_report_accounting wra ON wr.id = wra.work_report_id
LEFT JOIN accounting_items ai ON wra.accounting_item_id = ai.id
WHERE wr.work_date >= '2025-01-01'
  AND wr.work_date < '2026-01-01'
  AND wr.deleted_at IS NULL
GROUP BY TO_CHAR(wr.work_date, 'YYYY-MM'), wr.work_type
HAVING SUM(wra.amount) != 0
ORDER BY "年月", "作業種別";