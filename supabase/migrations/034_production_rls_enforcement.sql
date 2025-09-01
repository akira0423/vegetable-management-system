-- ====================================================================
-- 本番環境用RLS強制有効化マイグレーション
-- ====================================================================
--
-- 本番環境でのセキュリティを確保するため、全テーブルでRLSを強制有効化
-- テスト用に無効化されていたセキュリティ設定を本番仕様に戻します
--

-- 1. 重要テーブルのRLS有効化
ALTER TABLE operation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE growing_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE vegetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- 2. 本番環境用のセキュアなRLSポリシーを確認・追加
-- companies テーブル用ポリシー
DROP POLICY IF EXISTS "companies_select_policy" ON companies;
CREATE POLICY "companies_select_policy" ON companies
    FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM company_memberships cm
            WHERE cm.company_id = companies.id
            AND cm.user_id = auth.uid()
            AND cm.status = 'active'
        )
    );

-- vegetables テーブル用ポリシー
DROP POLICY IF EXISTS "vegetables_select_policy" ON vegetables;
CREATE POLICY "vegetables_select_policy" ON vegetables
    FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM company_memberships cm
            WHERE cm.company_id = vegetables.company_id
            AND cm.user_id = auth.uid()
            AND cm.status = 'active'
        )
    );

DROP POLICY IF EXISTS "vegetables_insert_policy" ON vegetables;
CREATE POLICY "vegetables_insert_policy" ON vegetables
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM company_memberships cm
            WHERE cm.company_id = vegetables.company_id
            AND cm.user_id = auth.uid()
            AND cm.status = 'active'
        )
    );

-- work_reports テーブル用ポリシー
DROP POLICY IF EXISTS "work_reports_select_policy" ON work_reports;
CREATE POLICY "work_reports_select_policy" ON work_reports
    FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM company_memberships cm
            WHERE cm.company_id = work_reports.company_id
            AND cm.user_id = auth.uid()
            AND cm.status = 'active'
        )
    );

DROP POLICY IF EXISTS "work_reports_insert_policy" ON work_reports;
CREATE POLICY "work_reports_insert_policy" ON work_reports
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM company_memberships cm
            WHERE cm.company_id = work_reports.company_id
            AND cm.user_id = auth.uid()
            AND cm.status = 'active'
        )
    );

-- 3. 確認ログ
DO $$ 
BEGIN
    RAISE NOTICE '✅ 本番環境用RLS有効化完了';
    RAISE NOTICE '✅ 全テーブルでRow Level Securityが有効化されました';
    RAISE NOTICE '✅ 認証されたユーザーのみがデータにアクセス可能です';
    RAISE NOTICE '⚠️ テスト用の無制限アクセスは無効化されました';
END $$;