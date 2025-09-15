-- ====================================================================
-- 総支出（直近12カ月）の詳細分析クエリ
-- 説明: アナリティクスページで表示される総支出を構成する全項目を確認
-- ====================================================================

-- 変数設定（実行時に適切な値に置き換えてください）
-- SET @company_id = 'YOUR_COMPANY_ID';
-- SET @end_date = CURRENT_DATE;
-- SET @start_date = CURRENT_DATE - INTERVAL '12 months';

-- 1. 会計項目別の支出集計
WITH expense_summary AS (
  SELECT
    ai.code as item_code,
    ai.name as item_name,
    ai.type as item_type,
    ai.category as item_category,
    ai.cost_type,
    COUNT(DISTINCT wr.id) as report_count,
    COUNT(wra.id) as entry_count,
    SUM(wra.amount) as total_amount,
    MIN(wr.work_date) as first_date,
    MAX(wr.work_date) as last_date
  FROM work_reports wr
  INNER JOIN work_report_accounting wra ON wr.id = wra.work_report_id
  INNER JOIN accounting_items ai ON wra.accounting_item_id = ai.id
  WHERE
    wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'  -- 実際のcompany_idに置き換え
    AND wr.work_date >= CURRENT_DATE - INTERVAL '12 months'
    AND wr.work_date <= CURRENT_DATE
    AND wr.deleted_at IS NULL
    AND (
      ai.type = 'expense'  -- 支出タイプ
      OR ai.cost_type IN ('variable_cost', 'fixed_cost')  -- コストタイプ
      OR (
        -- コード判定（収入コード以外）
        ai.code IS NOT NULL
        AND NOT (ai.code LIKE '①%' OR ai.code LIKE '②%' OR ai.code LIKE '③%')
      )
    )
  GROUP BY ai.code, ai.name, ai.type, ai.category, ai.cost_type
),

-- 2. 作業種別での支出集計
work_type_summary AS (
  SELECT
    wr.work_type,
    COUNT(DISTINCT wr.id) as work_count,
    SUM(wra.amount) as total_expense
  FROM work_reports wr
  INNER JOIN work_report_accounting wra ON wr.id = wra.work_report_id
  INNER JOIN accounting_items ai ON wra.accounting_item_id = ai.id
  WHERE
    wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'  -- 実際のcompany_idに置き換え
    AND wr.work_date >= CURRENT_DATE - INTERVAL '12 months'
    AND wr.work_date <= CURRENT_DATE
    AND wr.deleted_at IS NULL
    AND (
      ai.type = 'expense'
      OR ai.cost_type IN ('variable_cost', 'fixed_cost')
      OR (ai.code IS NOT NULL AND NOT (ai.code LIKE '①%' OR ai.code LIKE '②%' OR ai.code LIKE '③%'))
    )
  GROUP BY wr.work_type
),

-- 3. 月別の支出推移
monthly_expenses AS (
  SELECT
    DATE_TRUNC('month', wr.work_date) as month,
    SUM(wra.amount) as monthly_expense
  FROM work_reports wr
  INNER JOIN work_report_accounting wra ON wr.id = wra.work_report_id
  INNER JOIN accounting_items ai ON wra.accounting_item_id = ai.id
  WHERE
    wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'  -- 実際のcompany_idに置き換え
    AND wr.work_date >= CURRENT_DATE - INTERVAL '12 months'
    AND wr.work_date <= CURRENT_DATE
    AND wr.deleted_at IS NULL
    AND (
      ai.type = 'expense'
      OR ai.cost_type IN ('variable_cost', 'fixed_cost')
      OR (ai.code IS NOT NULL AND NOT (ai.code LIKE '①%' OR ai.code LIKE '②%' OR ai.code LIKE '③%'))
    )
  GROUP BY DATE_TRUNC('month', wr.work_date)
  ORDER BY month
)

-- メイン出力
SELECT '=== 総支出サマリー（直近12カ月）===' as section;

SELECT
  '総支出額' as metric,
  TO_CHAR(SUM(total_amount), '999,999,999') || '円' as value
FROM expense_summary;

SELECT '';
SELECT '=== 会計項目別内訳 ===' as section;

SELECT
  item_code as "コード",
  item_name as "項目名",
  item_category as "カテゴリ",
  cost_type as "コストタイプ",
  entry_count as "記録数",
  TO_CHAR(total_amount, '999,999,999') || '円' as "金額",
  ROUND(total_amount * 100.0 / SUM(total_amount) OVER(), 1) || '%' as "構成比"
FROM expense_summary
ORDER BY total_amount DESC;

SELECT '';
SELECT '=== 作業種別内訳 ===' as section;

SELECT
  CASE work_type
    WHEN 'seeding' THEN '播種'
    WHEN 'planting' THEN '定植'
    WHEN 'fertilizing' THEN '施肥'
    WHEN 'watering' THEN '灌水'
    WHEN 'weeding' THEN '除草'
    WHEN 'pruning' THEN '整枝'
    WHEN 'harvesting' THEN '収穫'
    ELSE 'その他'
  END as "作業種別",
  work_count as "作業回数",
  TO_CHAR(total_expense, '999,999,999') || '円' as "支出額",
  ROUND(total_expense * 100.0 / SUM(total_expense) OVER(), 1) || '%' as "構成比"
FROM work_type_summary
ORDER BY total_expense DESC;

SELECT '';
SELECT '=== 月別推移 ===' as section;

SELECT
  TO_CHAR(month, 'YYYY年MM月') as "月",
  TO_CHAR(monthly_expense, '999,999,999') || '円' as "月間支出",
  TO_CHAR(SUM(monthly_expense) OVER (ORDER BY month), '999,999,999') || '円' as "累積支出"
FROM monthly_expenses
ORDER BY month;

SELECT '';
SELECT '=== データ品質チェック ===' as section;

-- 会計データが登録されていない作業レポートの確認
SELECT
  COUNT(DISTINCT wr.id) as "会計データなしレポート数"
FROM work_reports wr
LEFT JOIN work_report_accounting wra ON wr.id = wra.work_report_id
WHERE
  wr.company_id = 'YOUR_COMPANY_ID'  -- 実際のcompany_idに置き換え
  AND wr.work_date >= CURRENT_DATE - INTERVAL '12 months'
  AND wr.work_date <= CURRENT_DATE
  AND wr.deleted_at IS NULL
  AND wra.id IS NULL;

-- AIレコメンド利用率
SELECT
  COUNT(CASE WHEN wra.is_ai_recommended = true THEN 1 END) as "AI推奨項目数",
  COUNT(*) as "全項目数",
  ROUND(COUNT(CASE WHEN wra.is_ai_recommended = true THEN 1 END) * 100.0 / COUNT(*), 1) || '%' as "AI利用率"
FROM work_reports wr
INNER JOIN work_report_accounting wra ON wr.id = wra.work_report_id
INNER JOIN accounting_items ai ON wra.accounting_item_id = ai.id
WHERE
  wr.company_id = 'YOUR_COMPANY_ID'  -- 実際のcompany_idに置き換え
  AND wr.work_date >= CURRENT_DATE - INTERVAL '12 months'
  AND wr.work_date <= CURRENT_DATE
  AND wr.deleted_at IS NULL
  AND (
    ai.type = 'expense'
    OR ai.cost_type IN ('variable_cost', 'fixed_cost')
    OR (ai.code IS NOT NULL AND NOT (ai.code LIKE '①%' OR ai.code LIKE '②%' OR ai.code LIKE '③%'))
  );

-- ====================================================================
-- 実行方法:
-- 1. 'YOUR_COMPANY_ID' を実際の company_id に置き換える
-- 2. Supabase SQL Editor で実行
-- 3. 結果を確認して、総支出の内訳を分析
-- ====================================================================