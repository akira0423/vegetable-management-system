-- ====================================================================
-- 実データベース会計分析機能の実装
-- このSQLをSupabase SQL Editorで実行してください
-- ====================================================================

-- 1. accounting_itemsテーブルにcost_typeカラムを追加（既に存在する場合はスキップ）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'accounting_items' 
        AND column_name = 'cost_type'
    ) THEN
        ALTER TABLE accounting_items ADD COLUMN cost_type text;
    END IF;
END $$;

-- 2. 既存の会計項目を分類（NULL のみ分類を付与）
UPDATE accounting_items SET cost_type = CASE
    -- 収入項目（コード①～③）
    WHEN code IN ('①','②','③') THEN 'income'

    -- 固定費項目（コード④,⑨,⑫,⑬,⑭,⑮,⑯,⑲,⑳,㉑,㉓）
    WHEN code IN ('④','⑨','⑫','⑬','⑭','⑮','⑯','⑲','⑳','㉑','㉓') THEN 'fixed_cost'

    -- 変動費項目（コード⑤,⑥,⑦,⑧,⑩,⑪,⑰,⑱,㉒）
    WHEN code IN ('⑤','⑥','⑦','⑧','⑩','⑪','⑰','⑱','㉒') THEN 'variable_cost'
    
    ELSE NULL
END
WHERE cost_type IS NULL;

-- 3. 制約を追加（既に存在する場合はスキップ）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'chk_cost_type'
    ) THEN
        ALTER TABLE accounting_items
        ADD CONSTRAINT chk_cost_type CHECK (cost_type IN ('income', 'fixed_cost', 'variable_cost'));
    END IF;
END $$;

-- 4. パフォーマンス用インデックスを追加（既に存在する場合はスキップ）
CREATE INDEX IF NOT EXISTS idx_accounting_items_cost_type 
ON accounting_items(cost_type);

-- 5. 確認メッセージ
DO $$ 
BEGIN
    RAISE NOTICE '=== 実データベース会計分析機能実装完了 ===';
    RAISE NOTICE '✅ cost_typeカラム追加完了';
    RAISE NOTICE '✅ 会計項目の分類完了';
    RAISE NOTICE '✅ パフォーマンスインデックス追加完了';
    RAISE NOTICE '====================================';
END $$;

-- 6. 結果確認
SELECT 
    cost_type,
    COUNT(*) as item_count,
    STRING_AGG(name, ', ' ORDER BY code) as items
FROM accounting_items
WHERE cost_type IS NOT NULL
GROUP BY cost_type
ORDER BY cost_type;