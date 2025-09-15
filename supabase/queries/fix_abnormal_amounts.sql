-- ====================================================================
-- 異常金額の確認と修正クエリ
-- ====================================================================

-- 1. 修正前の確認（異常に大きな金額のリスト）
SELECT
  wra.id as "会計エントリID",
  wr.id as "レポートID",
  wr.work_date as "作業日",
  v.name as "野菜名",
  ai.name as "項目名",
  wra.amount as "現在の金額",
  CASE
    WHEN wra.amount = 100000000100 THEN '100円に修正予定'
    WHEN wra.amount = 1000000000 THEN '1,000円に修正予定'
    WHEN wra.amount = 1000000102 THEN '102円に修正予定'
    WHEN wra.amount = 100000000 THEN '100,000円に修正予定'
    WHEN wra.amount = 10000000 THEN '10,000円に修正予定'
    WHEN wra.amount = 3500000 THEN '3,500円に修正予定'
    WHEN wra.amount = 250000 THEN '250円に修正予定'
    WHEN wra.amount = 10000 THEN '10,000円（変更なし）'
    ELSE '確認が必要'
  END as "修正案"
FROM work_report_accounting wra
INNER JOIN work_reports wr ON wra.work_report_id = wr.id
INNER JOIN vegetables v ON wr.vegetable_id = v.id
INNER JOIN accounting_items ai ON wra.accounting_item_id = ai.id
WHERE
  wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
  AND wra.amount > 100000  -- 10万円以上
ORDER BY wra.amount DESC;

-- ====================================================================
-- 2. 修正クエリ（実行前に必ず上記で確認してください）
-- ====================================================================

-- トランザクション開始
BEGIN;

-- 100,000,000,100円 → 100円
UPDATE work_report_accounting
SET amount = 100
WHERE id IN (
  SELECT wra.id
  FROM work_report_accounting wra
  INNER JOIN work_reports wr ON wra.work_report_id = wr.id
  WHERE wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
    AND wra.amount = 100000000100
);

-- 1,000,000,000円 → 1,000円
UPDATE work_report_accounting
SET amount = 1000
WHERE id IN (
  SELECT wra.id
  FROM work_report_accounting wra
  INNER JOIN work_reports wr ON wra.work_report_id = wr.id
  WHERE wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
    AND wra.amount = 1000000000
);

-- 1,000,000,102円 → 102円（別パターン）
UPDATE work_report_accounting
SET amount = 102
WHERE id IN (
  SELECT wra.id
  FROM work_report_accounting wra
  INNER JOIN work_reports wr ON wra.work_report_id = wr.id
  WHERE wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
    AND wra.amount = 1000000102
);

-- 100,000,000円 → 100,000円
UPDATE work_report_accounting
SET amount = 100000
WHERE id IN (
  SELECT wra.id
  FROM work_report_accounting wra
  INNER JOIN work_reports wr ON wra.work_report_id = wr.id
  WHERE wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
    AND wra.amount = 100000000
);

-- 10,000,000円 → 10,000円
UPDATE work_report_accounting
SET amount = 10000
WHERE id IN (
  SELECT wra.id
  FROM work_report_accounting wra
  INNER JOIN work_reports wr ON wra.work_report_id = wr.id
  WHERE wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
    AND wra.amount = 10000000
);

-- 3,500,000円 → 3,500円
UPDATE work_report_accounting
SET amount = 3500
WHERE id IN (
  SELECT wra.id
  FROM work_report_accounting wra
  INNER JOIN work_reports wr ON wra.work_report_id = wr.id
  WHERE wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
    AND wra.amount = 3500000
);

-- 250,000円 → 250円
UPDATE work_report_accounting
SET amount = 250
WHERE id IN (
  SELECT wra.id
  FROM work_report_accounting wra
  INNER JOIN work_reports wr ON wra.work_report_id = wr.id
  WHERE wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
    AND wra.amount = 250000
);

-- 修正後の確認
SELECT
  '修正後の合計' as label,
  TO_CHAR(SUM(wra.amount), '999,999,999') || '円' as total
FROM work_report_accounting wra
INNER JOIN work_reports wr ON wra.work_report_id = wr.id
INNER JOIN accounting_items ai ON wra.accounting_item_id = ai.id
WHERE
  wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
  AND wr.work_date >= CURRENT_DATE - INTERVAL '12 months'
  AND wr.deleted_at IS NULL
  AND ai.type = 'expense';

-- コミットまたはロールバック
-- 結果を確認して問題なければ COMMIT、問題があれば ROLLBACK
-- COMMIT;
-- ROLLBACK;