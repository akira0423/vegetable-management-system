-- ========================================
-- 月次キャッシュフローのデータ問題を調査
-- ========================================

-- 1. 12月の作業レポートと会計データを確認
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
WHERE wr.work_date >= '2024-12-01'
  AND wr.work_date < '2025-01-01'
  AND wr.deleted_at IS NULL
ORDER BY wr.work_date, wra.amount DESC;

-- 2. 1000億円のデータがどこにあるか特定
SELECT
  'work_report_accounting' AS "テーブル",
  wra.work_report_id AS "作業レポートID",
  wra.amount AS "金額",
  ai.name AS "勘定項目",
  ai.cost_type AS "コストタイプ",
  wr.work_date AS "作業日",
  wr.work_type AS "作業種別"
FROM work_report_accounting wra
LEFT JOIN accounting_items ai ON wra.accounting_item_id = ai.id
LEFT JOIN work_reports wr ON wra.work_report_id = wr.id
WHERE wra.amount >= 100000000000 -- 1000億以上
   OR wra.amount <= -100000000000;

-- 3. 12月の作業種別ごとの集計（月次キャッシュフローの計算方法を再現）
WITH december_data AS (
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
  WHERE wr.work_date >= '2024-12-01'
    AND wr.work_date < '2025-01-01'
    AND wr.deleted_at IS NULL
)
SELECT
  work_type AS "作業種別",
  SUM(income) AS "収入合計",
  SUM(expense) AS "支出合計",
  SUM(income) - SUM(expense) AS "純損益"
FROM december_data
GROUP BY work_type
ORDER BY work_type;

-- 4. 作業種別がNULLまたは想定外の値のレコードを確認
SELECT
  wr.id,
  wr.work_date,
  wr.work_type,
  wr.description,
  COUNT(wra.id) AS "会計項目数",
  SUM(wra.amount) AS "合計金額"
FROM work_reports wr
LEFT JOIN work_report_accounting wra ON wr.id = wra.work_report_id
WHERE wr.work_date >= '2024-12-01'
  AND wr.work_date < '2025-01-01'
  AND wr.deleted_at IS NULL
  AND (
    wr.work_type IS NULL
    OR wr.work_type NOT IN ('seeding', 'planting', 'fertilizing', 'watering', 'weeding', 'pruning', 'harvesting', 'other')
  )
GROUP BY wr.id, wr.work_date, wr.work_type, wr.description;

-- 5. 月次キャッシュフローが認識する作業種別の確認
SELECT DISTINCT
  work_type AS "登録されている作業種別",
  COUNT(*) AS "レコード数"
FROM work_reports
WHERE work_date >= '2024-12-01'
  AND work_date < '2025-01-01'
  AND deleted_at IS NULL
GROUP BY work_type
ORDER BY work_type;

-- 6. 収支構造分析と同じ方法でデータを取得（比較用）
SELECT
  DATE_TRUNC('month', wr.work_date) AS "月",
  ai.cost_type AS "コストタイプ",
  ai.name AS "勘定項目",
  SUM(wra.amount) AS "合計金額"
FROM work_report_accounting wra
INNER JOIN work_reports wr ON wra.work_report_id = wr.id
INNER JOIN accounting_items ai ON wra.accounting_item_id = ai.id
WHERE wr.work_date >= '2024-12-01'
  AND wr.work_date < '2025-01-01'
  AND wr.deleted_at IS NULL
GROUP BY DATE_TRUNC('month', wr.work_date), ai.cost_type, ai.name
ORDER BY "合計金額" DESC;