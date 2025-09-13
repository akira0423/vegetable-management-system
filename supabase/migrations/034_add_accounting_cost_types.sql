-- ====================================================================
-- 会計項目にコストタイプを追加し、実データベース分析を可能にする
-- ====================================================================

-- 1. accounting_itemsテーブルにcost_typeカラムを追加
ALTER TABLE accounting_items 
ADD COLUMN IF NOT EXISTS cost_type text;

-- 制約を追加
ALTER TABLE accounting_items
ADD CONSTRAINT chk_cost_type CHECK (cost_type IN ('income', 'fixed_cost', 'variable_cost'));

-- 2. 既存の会計項目を分類
UPDATE accounting_items SET cost_type = CASE
    -- 収入項目
    WHEN code IN ('①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨') THEN 'income'
    
    -- 固定費項目
    WHEN code IN ('⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰') THEN 'fixed_cost'
    
    -- 変動費項目  
    WHEN code IN ('⑱', '⑲', '⑳', '㉑', '㉒', '㉓') THEN 'variable_cost'
    
    ELSE NULL
END;

-- 3. cost_typeをNOT NULLに設定
ALTER TABLE accounting_items
ALTER COLUMN cost_type SET NOT NULL;

-- 4. パフォーマンス用インデックスを追加
CREATE INDEX IF NOT EXISTS idx_accounting_items_cost_type 
ON accounting_items(cost_type);

-- 5. 集計用のビューを作成（オプション）
CREATE OR REPLACE VIEW v_accounting_summary AS
SELECT 
    wr.id as report_id,
    wr.work_date,
    wr.vegetable_id,
    ai.cost_type,
    SUM(wra.amount) as total_amount
FROM work_reports wr
LEFT JOIN work_report_accounting wra ON wr.id = wra.work_report_id
LEFT JOIN accounting_items ai ON wra.accounting_item_id = ai.id
WHERE wr.deleted_at IS NULL
GROUP BY wr.id, wr.work_date, wr.vegetable_id, ai.cost_type;

-- 6. 月次集計用のマテリアライズドビュー（パフォーマンス向上）
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_monthly_accounting_summary AS
SELECT 
    DATE_TRUNC('month', wr.work_date) as month,
    wr.company_id,
    wr.vegetable_id,
    ai.cost_type,
    SUM(wra.amount) as total_amount,
    COUNT(DISTINCT wr.id) as report_count
FROM work_reports wr
LEFT JOIN work_report_accounting wra ON wr.id = wra.work_report_id  
LEFT JOIN accounting_items ai ON wra.accounting_item_id = ai.id
WHERE wr.deleted_at IS NULL
GROUP BY DATE_TRUNC('month', wr.work_date), wr.company_id, wr.vegetable_id, ai.cost_type;

-- インデックスを追加
CREATE INDEX IF NOT EXISTS idx_mv_monthly_accounting_month 
ON mv_monthly_accounting_summary(month);

CREATE INDEX IF NOT EXISTS idx_mv_monthly_accounting_company 
ON mv_monthly_accounting_summary(company_id);

-- 7. マテリアライズドビューのリフレッシュ関数
CREATE OR REPLACE FUNCTION refresh_monthly_accounting_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_accounting_summary;
END;
$$ LANGUAGE plpgsql;

-- 8. 確認ログ
DO $$ 
BEGIN
    RAISE NOTICE '=== 実データベース分析機能実装完了 ===';
    RAISE NOTICE '✅ cost_typeカラム追加完了';
    RAISE NOTICE '✅ 会計項目の分類完了';
    RAISE NOTICE '✅ 集計ビュー作成完了';
    RAISE NOTICE '✅ パフォーマンスインデックス追加完了';
    RAISE NOTICE '====================================';
END $$;