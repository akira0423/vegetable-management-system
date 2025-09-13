-- ====================================================================
-- 会計項目の分類を正しく更新
-- このSQLをSupabase SQL Editorで実行してください
-- ====================================================================

-- 1. 現在の分類状況を確認（実行前）
SELECT 
    '更新前' as status,
    cost_type,
    COUNT(*) as item_count,
    STRING_AGG(code || ':' || name, ', ' ORDER BY code) as items
FROM accounting_items
WHERE cost_type IS NOT NULL
GROUP BY cost_type
ORDER BY cost_type;

-- 2. 既存の会計項目を分類（全件を正しい分類に上書き）
UPDATE accounting_items
SET cost_type = CASE
    -- 収入項目（コード①～③）
    WHEN code IN ('①','②','③') THEN 'income'

    -- 固定費項目（コード④,⑨,⑫,⑬,⑭,⑮,⑯,⑲,⑳,㉑,㉓）
    WHEN code IN ('④','⑨','⑫','⑬','⑭','⑮','⑯','⑲','⑳','㉑','㉓') THEN 'fixed_cost'

    -- 変動費項目（コード⑤,⑥,⑦,⑧,⑩,⑪,⑰,⑱,㉒,その他）
    WHEN code IN ('⑤','⑥','⑦','⑧','⑩','⑪','⑰','⑱','㉒','その他') THEN 'variable_cost'

    ELSE cost_type
END;

-- 3. 更新結果の確認
DO $$ 
BEGIN
    RAISE NOTICE '=== 会計項目分類更新完了 ===';
    RAISE NOTICE '✅ 収入項目: ①～③';
    RAISE NOTICE '✅ 固定費項目: ④,⑨,⑫,⑬,⑭,⑮,⑯,⑲,⑳,㉑,㉓';
    RAISE NOTICE '✅ 変動費項目: ⑤,⑥,⑦,⑧,⑩,⑪,⑰,⑱,㉒,その他';
    RAISE NOTICE '====================================';
END $$;

-- 4. 更新後の分類状況を確認
SELECT 
    '更新後' as status,
    cost_type,
    COUNT(*) as item_count,
    STRING_AGG(code || ':' || name, ', ' ORDER BY code) as items
FROM accounting_items
WHERE cost_type IS NOT NULL
GROUP BY cost_type
ORDER BY cost_type;

-- 5. 詳細確認（各項目の分類を表示）
SELECT 
    code,
    name,
    cost_type,
    CASE cost_type
        WHEN 'income' THEN '💰 収入'
        WHEN 'fixed_cost' THEN '🏢 固定費'
        WHEN 'variable_cost' THEN '📈 変動費'
        ELSE '❓ 未分類'
    END as category_label
FROM accounting_items
ORDER BY 
    CASE cost_type
        WHEN 'income' THEN 1
        WHEN 'fixed_cost' THEN 2
        WHEN 'variable_cost' THEN 3
        ELSE 4
    END,
    code;