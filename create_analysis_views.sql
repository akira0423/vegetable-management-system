-- ====================================================
-- 分析用ビューの作成
-- 作成日: 2025-01-21
-- 目的: 頻繁に使用される分析クエリをビューとして定義
-- ====================================================

-- ====================================================
-- 1. 作業レポート統合ビュー
-- ====================================================

-- 1.1 作業レポートと会計情報の統合ビュー
CREATE OR REPLACE VIEW v_work_reports_with_accounting AS
SELECT
    wr.id,
    wr.company_id,
    wr.vegetable_id,
    v.name AS vegetable_name,
    v.variety_name AS vegetable_variety,
    v.plot_name AS plot_name,
    wr.work_type,
    wr.description,
    wr.work_date,
    wr.start_time,
    wr.end_time,
    wr.duration_hours,
    wr.worker_count,
    wr.weather,
    wr.temperature,
    wr.humidity,
    wr.harvest_amount,
    wr.harvest_unit,
    wr.harvest_quality,
    wr.expected_price,
    wr.notes,
    wr.created_by,
    wr.created_at,
    wr.updated_at,
    -- 会計サマリー
    COALESCE(acc.total_income, 0) AS total_income,
    COALESCE(acc.total_fixed_cost, 0) AS total_fixed_cost,
    COALESCE(acc.total_variable_cost, 0) AS total_variable_cost,
    COALESCE(acc.total_expense, 0) AS total_expense,
    COALESCE(acc.total_income, 0) - COALESCE(acc.total_expense, 0) AS net_income,
    acc.accounting_items_json
FROM work_reports wr
LEFT JOIN vegetables v ON wr.vegetable_id = v.id
LEFT JOIN LATERAL (
    SELECT
        wr.id AS work_report_id,
        SUM(CASE WHEN ai.cost_type = 'income' THEN wra.amount ELSE 0 END) AS total_income,
        SUM(CASE WHEN ai.cost_type = 'fixed_cost' THEN wra.amount ELSE 0 END) AS total_fixed_cost,
        SUM(CASE WHEN ai.cost_type = 'variable_cost' THEN wra.amount ELSE 0 END) AS total_variable_cost,
        SUM(CASE WHEN ai.cost_type IN ('fixed_cost', 'variable_cost') THEN wra.amount ELSE 0 END) AS total_expense,
        json_agg(
            json_build_object(
                'item_id', ai.id,
                'item_code', ai.code,
                'item_name', ai.name,
                'cost_type', ai.cost_type,
                'amount', wra.amount,
                'custom_name', wra.custom_item_name,
                'notes', wra.notes,
                'is_ai_recommended', wra.is_ai_recommended
            ) ORDER BY ai.sort_order, ai.code
        ) FILTER (WHERE wra.id IS NOT NULL) AS accounting_items_json
    FROM work_report_accounting wra
    LEFT JOIN accounting_items ai ON wra.accounting_item_id = ai.id
    WHERE wra.work_report_id = wr.id
    GROUP BY wr.id
) acc ON true
WHERE wr.deleted_at IS NULL;

-- 1.2 月別作業サマリービュー
CREATE OR REPLACE VIEW v_monthly_work_summary AS
SELECT
    DATE_TRUNC('month', wr.work_date) AS month,
    wr.company_id,
    wr.vegetable_id,
    v.name AS vegetable_name,
    COUNT(DISTINCT wr.id) AS report_count,
    SUM(wr.duration_hours) AS total_hours,
    AVG(wr.duration_hours) AS avg_hours_per_work,
    SUM(wr.worker_count) AS total_worker_days,
    COUNT(DISTINCT wr.work_type) AS work_type_variety,
    -- 収穫情報
    SUM(wr.harvest_amount) FILTER (WHERE wr.harvest_amount IS NOT NULL) AS total_harvest,
    AVG(wr.harvest_amount) FILTER (WHERE wr.harvest_amount IS NOT NULL) AS avg_harvest,
    COUNT(*) FILTER (WHERE wr.harvest_amount IS NOT NULL) AS harvest_count,
    -- 天候情報
    COUNT(*) FILTER (WHERE wr.weather = '晴れ') AS sunny_days,
    COUNT(*) FILTER (WHERE wr.weather = '曇り') AS cloudy_days,
    COUNT(*) FILTER (WHERE wr.weather = '雨') AS rainy_days,
    AVG(wr.temperature) AS avg_temperature,
    AVG(wr.humidity) AS avg_humidity
FROM work_reports wr
LEFT JOIN vegetables v ON wr.vegetable_id = v.id
WHERE wr.deleted_at IS NULL
GROUP BY DATE_TRUNC('month', wr.work_date), wr.company_id, wr.vegetable_id, v.name;

-- ====================================================
-- 2. 会計分析ビュー
-- ====================================================

-- 2.1 勘定科目別月次集計ビュー
CREATE OR REPLACE VIEW v_monthly_accounting_summary AS
SELECT
    DATE_TRUNC('month', wr.work_date) AS month,
    wr.company_id,
    ai.id AS accounting_item_id,
    ai.code AS item_code,
    ai.name AS item_name,
    ai.cost_type,
    COUNT(DISTINCT wra.id) AS transaction_count,
    SUM(wra.amount) AS total_amount,
    AVG(wra.amount) AS avg_amount,
    MIN(wra.amount) AS min_amount,
    MAX(wra.amount) AS max_amount,
    STDDEV(wra.amount) AS amount_stddev
FROM work_report_accounting wra
INNER JOIN work_reports wr ON wra.work_report_id = wr.id
INNER JOIN accounting_items ai ON wra.accounting_item_id = ai.id
WHERE wr.deleted_at IS NULL
GROUP BY DATE_TRUNC('month', wr.work_date), wr.company_id, ai.id, ai.code, ai.name, ai.cost_type;

-- 2.2 収支サマリービュー
CREATE OR REPLACE VIEW v_income_expense_summary AS
SELECT
    DATE_TRUNC('month', wr.work_date) AS month,
    wr.company_id,
    -- 収入
    SUM(CASE WHEN ai.cost_type = 'income' THEN wra.amount ELSE 0 END) AS total_income,
    COUNT(DISTINCT wra.id) FILTER (WHERE ai.cost_type = 'income') AS income_transactions,
    -- 固定費
    SUM(CASE WHEN ai.cost_type = 'fixed_cost' THEN wra.amount ELSE 0 END) AS total_fixed_cost,
    COUNT(DISTINCT wra.id) FILTER (WHERE ai.cost_type = 'fixed_cost') AS fixed_cost_transactions,
    -- 変動費
    SUM(CASE WHEN ai.cost_type = 'variable_cost' THEN wra.amount ELSE 0 END) AS total_variable_cost,
    COUNT(DISTINCT wra.id) FILTER (WHERE ai.cost_type = 'variable_cost') AS variable_cost_transactions,
    -- 合計
    SUM(CASE WHEN ai.cost_type IN ('fixed_cost', 'variable_cost') THEN wra.amount ELSE 0 END) AS total_expense,
    SUM(CASE WHEN ai.cost_type = 'income' THEN wra.amount ELSE -wra.amount END) AS net_income,
    -- 利益率
    CASE
        WHEN SUM(CASE WHEN ai.cost_type = 'income' THEN wra.amount ELSE 0 END) > 0 THEN
            ROUND(
                (SUM(CASE WHEN ai.cost_type = 'income' THEN wra.amount ELSE -wra.amount END) * 100.0) /
                NULLIF(SUM(CASE WHEN ai.cost_type = 'income' THEN wra.amount ELSE 0 END), 0),
                2
            )
        ELSE NULL
    END AS profit_margin_percent
FROM work_report_accounting wra
INNER JOIN work_reports wr ON wra.work_report_id = wr.id
LEFT JOIN accounting_items ai ON wra.accounting_item_id = ai.id
WHERE wr.deleted_at IS NULL
GROUP BY DATE_TRUNC('month', wr.work_date), wr.company_id;

-- ====================================================
-- 3. 野菜別分析ビュー
-- ====================================================

-- 3.1 野菜別収益性ビュー
CREATE OR REPLACE VIEW v_vegetable_profitability AS
SELECT
    v.id AS vegetable_id,
    v.company_id,
    v.name AS vegetable_name,
    v.variety_name,
    v.plot_name,
    v.area_size,
    v.plant_count,
    v.planting_date,
    v.expected_harvest_start,
    v.expected_harvest_end,
    v.actual_harvest_start,
    v.actual_harvest_end,
    v.status,
    -- 作業統計
    COUNT(DISTINCT wr.id) AS total_work_reports,
    SUM(wr.duration_hours) AS total_work_hours,
    SUM(wr.worker_count) AS total_worker_days,
    -- 収穫統計
    SUM(wr.harvest_amount) AS total_harvest_amount,
    AVG(wr.harvest_amount) FILTER (WHERE wr.harvest_amount > 0) AS avg_harvest_per_report,
    -- 会計統計
    COALESCE(SUM(CASE WHEN ai.cost_type = 'income' THEN wra.amount ELSE 0 END), 0) AS total_income,
    COALESCE(SUM(CASE WHEN ai.cost_type = 'fixed_cost' THEN wra.amount ELSE 0 END), 0) AS total_fixed_cost,
    COALESCE(SUM(CASE WHEN ai.cost_type = 'variable_cost' THEN wra.amount ELSE 0 END), 0) AS total_variable_cost,
    COALESCE(SUM(CASE WHEN ai.cost_type IN ('fixed_cost', 'variable_cost') THEN wra.amount ELSE 0 END), 0) AS total_expense,
    COALESCE(SUM(CASE WHEN ai.cost_type = 'income' THEN wra.amount ELSE -wra.amount END), 0) AS net_income,
    -- 効率指標
    CASE
        WHEN v.area_size > 0 THEN
            ROUND(COALESCE(SUM(CASE WHEN ai.cost_type = 'income' THEN wra.amount ELSE -wra.amount END), 0) / v.area_size, 2)
        ELSE NULL
    END AS income_per_area,
    CASE
        WHEN SUM(wr.duration_hours) > 0 THEN
            ROUND(COALESCE(SUM(CASE WHEN ai.cost_type = 'income' THEN wra.amount ELSE -wra.amount END), 0) / SUM(wr.duration_hours), 2)
        ELSE NULL
    END AS income_per_hour
FROM vegetables v
LEFT JOIN work_reports wr ON v.id = wr.vegetable_id AND wr.deleted_at IS NULL
LEFT JOIN work_report_accounting wra ON wr.id = wra.work_report_id
LEFT JOIN accounting_items ai ON wra.accounting_item_id = ai.id
WHERE v.deleted_at IS NULL
GROUP BY v.id, v.company_id, v.name, v.variety_name, v.plot_name, v.area_size,
         v.plant_count, v.planting_date, v.expected_harvest_start, v.expected_harvest_end,
         v.actual_harvest_start, v.actual_harvest_end, v.status;

-- ====================================================
-- 4. 推奨分析ビュー
-- ====================================================

-- 4.1 会計推奨の効果測定ビュー
CREATE OR REPLACE VIEW v_recommendation_effectiveness AS
SELECT
    ar.id AS recommendation_id,
    ar.company_id,
    ar.work_type,
    ai.code AS item_code,
    ai.name AS item_name,
    ai.cost_type,
    ar.confidence_score,
    ar.usage_count,
    ar.avg_amount AS recommended_avg_amount,
    ar.last_used_at,
    -- 実際の使用統計
    actual_usage.actual_count,
    actual_usage.actual_avg_amount,
    actual_usage.actual_total_amount,
    -- 効果指標
    CASE
        WHEN ar.avg_amount IS NOT NULL AND actual_usage.actual_avg_amount IS NOT NULL THEN
            ABS(ar.avg_amount - actual_usage.actual_avg_amount) / NULLIF(ar.avg_amount, 0) * 100
        ELSE NULL
    END AS amount_deviation_percent,
    CASE
        WHEN actual_usage.actual_count > 0 THEN 'USED'
        ELSE 'NOT_USED'
    END AS usage_status
FROM accounting_recommendations ar
LEFT JOIN accounting_items ai ON ar.accounting_item_id = ai.id
LEFT JOIN LATERAL (
    SELECT
        COUNT(DISTINCT wra.id) AS actual_count,
        AVG(wra.amount) AS actual_avg_amount,
        SUM(wra.amount) AS actual_total_amount
    FROM work_reports wr
    INNER JOIN work_report_accounting wra ON wr.id = wra.work_report_id
    WHERE wr.work_type = ar.work_type
        AND wra.accounting_item_id = ar.accounting_item_id
        AND wr.company_id = ar.company_id
        AND wr.deleted_at IS NULL
) actual_usage ON true;

-- ====================================================
-- 5. ダッシュボード用サマリービュー
-- ====================================================

-- 5.1 会社別ダッシュボードサマリー
CREATE OR REPLACE VIEW v_company_dashboard_summary AS
WITH latest_month AS (
    SELECT MAX(DATE_TRUNC('month', work_date)) AS month
    FROM work_reports
    WHERE deleted_at IS NULL
)
SELECT
    c.id AS company_id,
    c.name AS company_name,
    -- 全体統計
    COUNT(DISTINCT v.id) AS total_vegetables,
    COUNT(DISTINCT v.id) FILTER (WHERE v.status = 'active') AS active_vegetables,
    COUNT(DISTINCT wr.id) AS total_work_reports,
    COUNT(DISTINCT wr.id) FILTER (WHERE wr.work_date >= (SELECT month FROM latest_month)) AS current_month_reports,
    -- 今月の統計
    SUM(CASE WHEN wr.work_date >= (SELECT month FROM latest_month) THEN wr.duration_hours ELSE 0 END) AS current_month_hours,
    SUM(CASE WHEN wr.work_date >= (SELECT month FROM latest_month) THEN wr.harvest_amount ELSE 0 END) AS current_month_harvest,
    -- 今月の会計
    SUM(CASE
        WHEN wr.work_date >= (SELECT month FROM latest_month) AND ai.cost_type = 'income'
        THEN wra.amount ELSE 0
    END) AS current_month_income,
    SUM(CASE
        WHEN wr.work_date >= (SELECT month FROM latest_month) AND ai.cost_type IN ('fixed_cost', 'variable_cost')
        THEN wra.amount ELSE 0
    END) AS current_month_expense,
    SUM(CASE
        WHEN wr.work_date >= (SELECT month FROM latest_month)
        THEN CASE WHEN ai.cost_type = 'income' THEN wra.amount ELSE -wra.amount END
        ELSE 0
    END) AS current_month_net_income,
    -- 年間累計
    SUM(CASE WHEN ai.cost_type = 'income' THEN wra.amount ELSE 0 END) AS ytd_income,
    SUM(CASE WHEN ai.cost_type IN ('fixed_cost', 'variable_cost') THEN wra.amount ELSE 0 END) AS ytd_expense,
    SUM(CASE WHEN ai.cost_type = 'income' THEN wra.amount ELSE -wra.amount END) AS ytd_net_income
FROM companies c
LEFT JOIN vegetables v ON c.id = v.company_id AND v.deleted_at IS NULL
LEFT JOIN work_reports wr ON v.id = wr.vegetable_id AND wr.deleted_at IS NULL
LEFT JOIN work_report_accounting wra ON wr.id = wra.work_report_id
LEFT JOIN accounting_items ai ON wra.accounting_item_id = ai.id
WHERE c.is_active = true
GROUP BY c.id, c.name;

-- ====================================================
-- 6. パフォーマンス監視ビュー
-- ====================================================

-- 6.1 テーブル使用統計ビュー
CREATE OR REPLACE VIEW v_table_usage_stats AS
SELECT
    schemaname,
    tablename,
    n_live_tup AS live_rows,
    n_dead_tup AS dead_rows,
    ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_row_percent,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    ROUND(100.0 * idx_scan / NULLIF(seq_scan + idx_scan, 0), 2) AS index_usage_percent,
    n_tup_ins AS rows_inserted,
    n_tup_upd AS rows_updated,
    n_tup_del AS rows_deleted,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

-- ====================================================
-- 7. インデックス作成（ビューのパフォーマンス向上）
-- ====================================================

-- ビューで使用される結合条件にインデックスを作成
CREATE INDEX IF NOT EXISTS idx_work_reports_date_company
    ON work_reports(work_date DESC, company_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_work_reports_vegetable_date
    ON work_reports(vegetable_id, work_date DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_work_report_accounting_report_amount
    ON work_report_accounting(work_report_id, amount);

CREATE INDEX IF NOT EXISTS idx_vegetables_company_status
    ON vegetables(company_id, status)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_accounting_recommendations_company_work
    ON accounting_recommendations(company_id, work_type, confidence_score DESC);

-- ====================================================
-- 8. 権限設定
-- ====================================================

-- ビューに対する権限を設定（必要に応じて調整）
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON v_work_reports_with_accounting TO authenticated;
GRANT SELECT ON v_monthly_work_summary TO authenticated;
GRANT SELECT ON v_monthly_accounting_summary TO authenticated;
GRANT SELECT ON v_income_expense_summary TO authenticated;
GRANT SELECT ON v_vegetable_profitability TO authenticated;
GRANT SELECT ON v_recommendation_effectiveness TO authenticated;
GRANT SELECT ON v_company_dashboard_summary TO authenticated;
GRANT SELECT ON v_table_usage_stats TO authenticated;

-- ====================================================
-- メモ
-- ====================================================
-- このスクリプトで作成されるビュー：
-- 1. v_work_reports_with_accounting - 作業レポートと会計の統合ビュー
-- 2. v_monthly_work_summary - 月別作業サマリー
-- 3. v_monthly_accounting_summary - 勘定科目別月次集計
-- 4. v_income_expense_summary - 収支サマリー
-- 5. v_vegetable_profitability - 野菜別収益性分析
-- 6. v_recommendation_effectiveness - 推奨の効果測定
-- 7. v_company_dashboard_summary - ダッシュボード用サマリー
-- 8. v_table_usage_stats - テーブル使用統計
--
-- 使用例：
-- SELECT * FROM v_company_dashboard_summary WHERE company_id = '...';
-- SELECT * FROM v_vegetable_profitability WHERE company_id = '...' ORDER BY net_income DESC;
-- SELECT * FROM v_monthly_accounting_summary WHERE month >= '2024-01-01' ORDER BY month, total_amount DESC;