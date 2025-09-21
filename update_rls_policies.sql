-- ====================================================
-- RLSポリシーの修正と最適化
-- 作成日: 2025-01-21
-- 目的: 重複および競合するRLSポリシーの整理と最適化
-- ====================================================

-- ====================================================
-- 0. 現在のポリシー状態を保存（バックアップ）
-- ====================================================

-- 現在のポリシー情報を一時テーブルに保存
CREATE TEMP TABLE IF NOT EXISTS backup_policies AS
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename IN ('accounting_items', 'work_report_accounting', 'accounting_recommendations', 'work_reports');

-- ====================================================
-- 1. accounting_itemsテーブルのポリシー整理
-- ====================================================

-- 既存のすべてのポリシーを削除
DROP POLICY IF EXISTS "All authenticated users can view accounting items" ON accounting_items;
DROP POLICY IF EXISTS "Only admins can manage accounting items" ON accounting_items;
DROP POLICY IF EXISTS "accounting_items_select_all" ON accounting_items;
DROP POLICY IF EXISTS "Users can view accounting items" ON accounting_items;
DROP POLICY IF EXISTS "accounting_items_select_policy" ON accounting_items;
DROP POLICY IF EXISTS "accounting_items_insert_policy" ON accounting_items;

-- 新しい統一されたポリシーを作成
-- 読み取り: 全認証ユーザー（マスタデータとして）
CREATE POLICY "accounting_items_read_all" ON accounting_items
    FOR SELECT
    USING (true);

-- 挿入: Service Roleまたは管理者のみ
CREATE POLICY "accounting_items_insert_admin" ON accounting_items
    FOR INSERT
    WITH CHECK (
        auth.jwt()->>'role' = 'service_role' OR
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

-- 更新: Service Roleまたは管理者のみ
CREATE POLICY "accounting_items_update_admin" ON accounting_items
    FOR UPDATE
    USING (
        auth.jwt()->>'role' = 'service_role' OR
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

-- 削除: Service Roleまたは管理者のみ
CREATE POLICY "accounting_items_delete_admin" ON accounting_items
    FOR DELETE
    USING (
        auth.jwt()->>'role' = 'service_role' OR
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

-- ====================================================
-- 2. work_report_accountingテーブルのポリシー整理
-- ====================================================

-- 既存のすべてのポリシーを削除
DROP POLICY IF EXISTS "Users can delete their company work report accounting" ON work_report_accounting;
DROP POLICY IF EXISTS "Users can insert their company work report accounting" ON work_report_accounting;
DROP POLICY IF EXISTS "Users can update their company work report accounting" ON work_report_accounting;
DROP POLICY IF EXISTS "Users can view their company work report accounting" ON work_report_accounting;
DROP POLICY IF EXISTS "work_report_accounting_company_access" ON work_report_accounting;
DROP POLICY IF EXISTS "work_report_accounting_select_policy" ON work_report_accounting;
DROP POLICY IF EXISTS "work_report_accounting_insert_policy" ON work_report_accounting;
DROP POLICY IF EXISTS "work_report_accounting_update_policy" ON work_report_accounting;
DROP POLICY IF EXISTS "work_report_accounting_delete_policy" ON work_report_accounting;

-- 新しい統一されたポリシーを作成（1つのポリシーですべての操作をカバー）
CREATE POLICY "work_report_accounting_company_access_all" ON work_report_accounting
    FOR ALL
    USING (
        auth.jwt()->>'role' = 'service_role' OR
        EXISTS (
            SELECT 1 FROM work_reports wr
            WHERE wr.id = work_report_accounting.work_report_id
            AND wr.company_id = get_current_company_id()
            AND (wr.deleted_at IS NULL OR auth.jwt()->>'role' = 'service_role')
        )
    )
    WITH CHECK (
        auth.jwt()->>'role' = 'service_role' OR
        EXISTS (
            SELECT 1 FROM work_reports wr
            WHERE wr.id = work_report_accounting.work_report_id
            AND wr.company_id = get_current_company_id()
        )
    );

-- ====================================================
-- 3. accounting_recommendationsテーブルのポリシー整理
-- ====================================================

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "accounting_recommendations_company_access" ON accounting_recommendations;
DROP POLICY IF EXISTS "accounting_recommendations_select" ON accounting_recommendations;
DROP POLICY IF EXISTS "accounting_recommendations_insert" ON accounting_recommendations;
DROP POLICY IF EXISTS "accounting_recommendations_update" ON accounting_recommendations;

-- 新しい統一されたポリシーを作成
CREATE POLICY "accounting_recommendations_company_all" ON accounting_recommendations
    FOR ALL
    USING (
        auth.jwt()->>'role' = 'service_role' OR
        company_id = get_current_company_id()
    )
    WITH CHECK (
        auth.jwt()->>'role' = 'service_role' OR
        company_id = get_current_company_id()
    );

-- ====================================================
-- 4. work_reportsテーブルのポリシー確認と最適化
-- ====================================================

-- 既存のポリシーを確認（必要に応じて最適化）
DROP POLICY IF EXISTS "work_reports_access" ON work_reports;

-- 読み取り: 自社のデータのみ（削除済みを除く）
CREATE POLICY "work_reports_select_company" ON work_reports
    FOR SELECT
    USING (
        auth.jwt()->>'role' = 'service_role' OR
        (company_id = get_current_company_id() AND deleted_at IS NULL)
    );

-- 挿入: 自社のデータのみ
CREATE POLICY "work_reports_insert_company" ON work_reports
    FOR INSERT
    WITH CHECK (
        auth.jwt()->>'role' = 'service_role' OR
        company_id = get_current_company_id()
    );

-- 更新: 自社のデータのみ
CREATE POLICY "work_reports_update_company" ON work_reports
    FOR UPDATE
    USING (
        auth.jwt()->>'role' = 'service_role' OR
        company_id = get_current_company_id()
    )
    WITH CHECK (
        auth.jwt()->>'role' = 'service_role' OR
        company_id = get_current_company_id()
    );

-- 削除: 自社のデータのみ（論理削除の場合は更新で処理）
CREATE POLICY "work_reports_delete_company" ON work_reports
    FOR DELETE
    USING (
        auth.jwt()->>'role' = 'service_role' OR
        company_id = get_current_company_id()
    );

-- ====================================================
-- 5. ヘルパー関数の最適化
-- ====================================================

-- get_current_company_id関数の最適化（キャッシュ効果を高める）
CREATE OR REPLACE FUNCTION get_current_company_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE  -- 同一トランザクション内では結果が変わらない
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    company_id uuid;
BEGIN
    -- auth.uid()の結果をキャッシュ
    SELECT u.company_id INTO company_id
    FROM public.users u
    WHERE u.id = auth.uid()
    LIMIT 1;  -- 明示的にLIMIT 1を追加

    RETURN company_id;
END;
$$;

-- インデックスを作成して関数のパフォーマンスを向上
CREATE INDEX IF NOT EXISTS idx_users_id_company ON users(id, company_id);

-- ====================================================
-- 6. Service Role判定関数の追加
-- ====================================================

CREATE OR REPLACE FUNCTION is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT auth.jwt()->>'role' = 'service_role';
$$;

-- ====================================================
-- 7. RLS有効化の確認
-- ====================================================

-- すべてのテーブルでRLSが有効になっていることを確認
ALTER TABLE accounting_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_report_accounting ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE vegetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ====================================================
-- 8. 検証クエリ
-- ====================================================

-- 8.1 新しいポリシーの確認
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd,
    CASE
        WHEN LENGTH(qual) > 50 THEN LEFT(qual, 50) || '...'
        ELSE qual
    END AS qual_summary,
    CASE
        WHEN LENGTH(with_check) > 50 THEN LEFT(with_check, 50) || '...'
        ELSE with_check
    END AS with_check_summary
FROM pg_policies
WHERE tablename IN ('accounting_items', 'work_report_accounting', 'accounting_recommendations', 'work_reports')
ORDER BY tablename, policyname;

-- 8.2 RLSステータスの確認
SELECT
    schemaname,
    tablename,
    tableowner,
    rowsecurity,
    CASE rowsecurity
        WHEN true THEN 'ENABLED'
        ELSE 'DISABLED'
    END AS rls_status
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('accounting_items', 'work_report_accounting', 'accounting_recommendations', 'work_reports', 'vegetables', 'companies', 'users')
ORDER BY tablename;

-- 8.3 ポリシー数の確認（重複がないことを確認）
SELECT
    tablename,
    COUNT(*) AS policy_count,
    STRING_AGG(policyname, ', ') AS policies
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN ('accounting_items', 'work_report_accounting', 'accounting_recommendations', 'work_reports')
GROUP BY tablename
ORDER BY tablename;

-- ====================================================
-- 9. ロールバック用クエリ（必要に応じて）
-- ====================================================

/*
-- ポリシーをバックアップから復元する場合は以下を使用
-- 注意: 実行前に現在のポリシーを削除する必要があります

-- バックアップされたポリシー情報を表示
SELECT * FROM backup_policies;

-- 個別にポリシーを再作成する必要があります
-- 例:
-- CREATE POLICY "policy_name" ON table_name
--     FOR command_type
--     USING (qual_condition)
--     WITH CHECK (with_check_condition);
*/

-- ====================================================
-- メモ
-- ====================================================
-- このスクリプトで解決される問題：
-- 1. accounting_itemsテーブルの重複ポリシーを整理
-- 2. work_report_accountingテーブルの複数ポリシーを1つに統合
-- 3. Service Roleのサポートを追加してAPI操作を改善
-- 4. パフォーマンスを考慮した関数とインデックスの最適化
--
-- 実行前の確認事項：
-- - 現在のポリシー設定のバックアップを取得
-- - 開発環境でテスト実行
-- - アプリケーションの動作確認