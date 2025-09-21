-- ====================================================
-- RLSポリシー検証スクリプト
-- 実行: Supabase SQL Editorで実行
-- ====================================================

-- 1. 現在のポリシー数と内容の確認
SELECT
    '📊 現在のポリシー状態' AS "チェック項目";

SELECT
    tablename AS "テーブル名",
    COUNT(*) AS "ポリシー数",
    STRING_AGG(policyname || ' (' || cmd || ')', ', ' ORDER BY cmd) AS "ポリシー詳細"
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN ('accounting_items', 'work_report_accounting', 'accounting_recommendations')
GROUP BY tablename
ORDER BY tablename;

-- 2. 各テーブルの操作カバレッジ確認
SELECT
    '✅ 操作カバレッジ' AS "チェック項目";

WITH policy_coverage AS (
    SELECT
        tablename,
        SUM(CASE WHEN cmd = 'SELECT' OR cmd = 'ALL' THEN 1 ELSE 0 END) > 0 AS has_select,
        SUM(CASE WHEN cmd = 'INSERT' OR cmd = 'ALL' THEN 1 ELSE 0 END) > 0 AS has_insert,
        SUM(CASE WHEN cmd = 'UPDATE' OR cmd = 'ALL' THEN 1 ELSE 0 END) > 0 AS has_update,
        SUM(CASE WHEN cmd = 'DELETE' OR cmd = 'ALL' THEN 1 ELSE 0 END) > 0 AS has_delete
    FROM pg_policies
    WHERE schemaname = 'public'
        AND tablename IN ('accounting_items', 'work_report_accounting', 'accounting_recommendations')
    GROUP BY tablename
)
SELECT
    tablename AS "テーブル名",
    CASE WHEN has_select THEN '✅ SELECT' ELSE '❌ SELECT' END AS "読取",
    CASE WHEN has_insert THEN '✅ INSERT' ELSE '❌ INSERT' END AS "挿入",
    CASE WHEN has_update THEN '✅ UPDATE' ELSE '❌ UPDATE' END AS "更新",
    CASE WHEN has_delete THEN '✅ DELETE' ELSE '❌ DELETE' END AS "削除"
FROM policy_coverage
ORDER BY tablename;

-- 3. 問題の診断
SELECT
    '🔍 診断結果' AS "チェック項目";

WITH diagnosis AS (
    SELECT
        tablename,
        COUNT(*) AS policy_count,
        SUM(CASE WHEN cmd = 'ALL' THEN 4
                 WHEN cmd IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE') THEN 1
                 ELSE 0 END) AS effective_coverage
    FROM pg_policies
    WHERE schemaname = 'public'
        AND tablename IN ('accounting_items', 'work_report_accounting', 'accounting_recommendations')
    GROUP BY tablename
)
SELECT
    tablename AS "テーブル名",
    CASE
        WHEN tablename = 'accounting_items' AND effective_coverage < 4 THEN
            '⚠️ 管理ポリシー不足: INSERT/UPDATE/DELETEポリシーを追加してください'
        WHEN tablename IN ('work_report_accounting', 'accounting_recommendations') AND policy_count = 1 THEN
            '✅ 正常: FOR ALLポリシーですべての操作をカバー'
        WHEN effective_coverage >= 4 THEN
            '✅ 正常: すべての操作がカバーされています'
        ELSE
            '❓ 確認が必要です'
    END AS "診断結果"
FROM diagnosis
ORDER BY tablename;

-- 4. 推奨アクション
SELECT
    '💡 推奨アクション' AS "チェック項目";

WITH current_state AS (
    SELECT
        'accounting_items' AS tablename,
        COUNT(*) AS policy_count
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'accounting_items'
)
SELECT
    CASE
        WHEN policy_count = 1 THEN
            '1. phase0_fix_missing_policies.sqlを実行して管理ポリシーを追加してください'
        WHEN policy_count = 4 THEN
            '✅ アクション不要: accounting_itemsは適切に設定されています'
        ELSE
            '確認が必要: 予期しない状態です'
    END AS "アクション"
FROM current_state;

-- 5. RLS有効状態の確認
SELECT
    '🔐 RLS有効状態' AS "チェック項目";

SELECT
    tablename AS "テーブル名",
    CASE rowsecurity
        WHEN true THEN '✅ 有効'
        ELSE '❌ 無効 - ALTER TABLE ' || tablename || ' ENABLE ROW LEVEL SECURITY; を実行してください'
    END AS "RLS状態"
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('accounting_items', 'work_report_accounting', 'accounting_recommendations', 'work_reports', 'vegetables', 'companies', 'users')
ORDER BY tablename;

-- 6. 詳細ポリシー内容
SELECT
    '📋 ポリシー詳細' AS "チェック項目";

SELECT
    tablename AS "テーブル",
    policyname AS "ポリシー名",
    cmd AS "操作",
    CASE permissive
        WHEN true THEN 'PERMISSIVE'
        ELSE 'RESTRICTIVE'
    END AS "タイプ",
    CASE
        WHEN qual IS NULL OR qual = 'true' THEN '制限なし'
        WHEN qual LIKE '%service_role%' THEN 'Service Role + 条件'
        WHEN qual LIKE '%get_current_company_id%' THEN '会社IDベース'
        WHEN qual LIKE '%auth.uid%' THEN 'ユーザーIDベース'
        ELSE LEFT(qual, 30) || '...'
    END AS "条件"
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN ('accounting_items', 'work_report_accounting', 'accounting_recommendations')
ORDER BY tablename, cmd;