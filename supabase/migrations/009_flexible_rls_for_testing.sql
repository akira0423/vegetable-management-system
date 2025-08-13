-- ====================================================================
-- テスト・開発環境用の柔軟なRLSポリシー
-- ====================================================================
--
-- 本ファイルは開発・テスト環境でのRLS制限を緩和し、
-- Service Role Keyでのアクセスを可能にします。
-- 本番環境では適用しないでください。
--

-- ====================================================================
-- 1. サービスロール検知用の関数
-- ====================================================================
CREATE OR REPLACE FUNCTION auth.is_service_role()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
    -- Service Role Keyが使用されている場合はtrueを返す
    -- Service Roleの場合、auth.uid()はNULLになる
    SELECT auth.role() = 'service_role';
$$;

-- テスト環境検知用の関数
CREATE OR REPLACE FUNCTION auth.is_test_environment()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
    -- 環境変数やフラグに基づいてテスト環境かを判定
    -- ここでは簡単にService Roleでアクセスされた場合をテスト環境とする
    SELECT auth.is_service_role();
$$;

-- ====================================================================
-- 2. operation_logs テーブル用の柔軟なポリシー
-- ====================================================================

-- 既存のポリシーを削除して新しいものに置き換え
DROP POLICY IF EXISTS "operation_logs_insert_policy" ON operation_logs;
DROP POLICY IF EXISTS "operation_logs_select_policy" ON operation_logs;
DROP POLICY IF EXISTS "operation_logs_update_policy" ON operation_logs;

-- 柔軟なINSERTポリシー
CREATE POLICY "operation_logs_insert_policy_flexible" ON operation_logs
    FOR INSERT
    WITH CHECK (
        -- Service Role（テスト環境）の場合は制限なし
        auth.is_service_role()
        OR
        -- 通常の認証ユーザーの場合は従来のロジック
        (
            auth.uid() IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM vegetables 
                WHERE vegetables.id = operation_logs.vegetable_id 
                AND vegetables.company_id = auth.current_user_company_id()
            )
            AND auth.current_user_role() IN ('admin', 'manager', 'operator')
        )
    );

-- 柔軟なSELECTポリシー
CREATE POLICY "operation_logs_select_policy_flexible" ON operation_logs
    FOR SELECT
    USING (
        -- Service Role（テスト環境）の場合は制限なし
        auth.is_service_role()
        OR
        -- 通常の認証ユーザーの場合は従来のロジック
        (
            auth.uid() IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM vegetables 
                WHERE vegetables.id = operation_logs.vegetable_id 
                AND vegetables.company_id = auth.current_user_company_id()
            )
        )
    );

-- 柔軟なUPDATEポリシー
CREATE POLICY "operation_logs_update_policy_flexible" ON operation_logs
    FOR UPDATE
    USING (
        -- Service Role（テスト環境）の場合は制限なし
        auth.is_service_role()
        OR
        -- 通常の認証ユーザーの場合は従来のロジック
        (
            auth.uid() IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM vegetables 
                WHERE vegetables.id = operation_logs.vegetable_id 
                AND vegetables.company_id = auth.current_user_company_id()
            )
            AND (
                auth.current_user_role() IN ('admin', 'manager')
                OR
                (auth.current_user_role() = 'operator' AND created_by = auth.uid())
            )
        )
    );

-- ====================================================================
-- 3. photos テーブル用の柔軟なポリシー
-- ====================================================================

-- 既存のポリシーを削除して新しいものに置き換え
DROP POLICY IF EXISTS "photos_insert_policy" ON photos;
DROP POLICY IF EXISTS "photos_select_policy" ON photos;
DROP POLICY IF EXISTS "photos_update_policy" ON photos;

-- 柔軟なINSERTポリシー
CREATE POLICY "photos_insert_policy_flexible" ON photos
    FOR INSERT
    WITH CHECK (
        -- Service Role（テスト環境）の場合は制限なし
        auth.is_service_role()
        OR
        -- 通常の認証ユーザーの場合は従来のロジック
        (
            auth.uid() IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM vegetables 
                WHERE vegetables.id = photos.vegetable_id 
                AND vegetables.company_id = auth.current_user_company_id()
            )
            AND auth.current_user_role() IN ('admin', 'manager', 'operator')
        )
    );

-- 柔軟なSELECTポリシー
CREATE POLICY "photos_select_policy_flexible" ON photos
    FOR SELECT
    USING (
        -- Service Role（テスト環境）の場合は制限なし
        auth.is_service_role()
        OR
        -- 通常の認証ユーザーの場合は従来のロジック
        (
            auth.uid() IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM vegetables 
                WHERE vegetables.id = photos.vegetable_id 
                AND vegetables.company_id = auth.current_user_company_id()
            )
        )
    );

-- 柔軟なUPDATEポリシー
CREATE POLICY "photos_update_policy_flexible" ON photos
    FOR UPDATE
    USING (
        -- Service Role（テスト環境）の場合は制限なし
        auth.is_service_role()
        OR
        -- 通常の認証ユーザーの場合は従来のロジック
        (
            auth.uid() IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM vegetables 
                WHERE vegetables.id = photos.vegetable_id 
                AND vegetables.company_id = auth.current_user_company_id()
            )
            AND (
                auth.current_user_role() IN ('admin', 'manager')
                OR
                (auth.current_user_role() = 'operator' AND created_by = auth.uid())
            )
        )
    );

-- ====================================================================
-- 4. RLSを再有効化（007で無効化されていた場合）
-- ====================================================================

-- operation_logsとphotosのRLSを有効化
ALTER TABLE operation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- 5. デバッグ用のヘルパー関数
-- ====================================================================

-- 現在のauth状態をデバッグするための関数
CREATE OR REPLACE FUNCTION debug_auth_status()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT json_build_object(
        'auth_uid', auth.uid(),
        'auth_role', auth.role(),
        'is_service_role', auth.is_service_role(),
        'current_user_company_id', auth.current_user_company_id(),
        'current_user_role', auth.current_user_role(),
        'timestamp', NOW()
    );
$$;

-- ====================================================================
-- 6. コメント・ドキュメント
-- ====================================================================

COMMENT ON FUNCTION auth.is_service_role() IS 'Service Role Keyでアクセスされているかを判定';
COMMENT ON FUNCTION auth.is_test_environment() IS 'テスト環境かを判定';
COMMENT ON FUNCTION debug_auth_status() IS 'デバッグ用：現在の認証状態を返す';

COMMENT ON POLICY "operation_logs_insert_policy_flexible" ON operation_logs IS 'テスト対応：Service Role または認証済みユーザーによる作業記録追加';
COMMENT ON POLICY "operation_logs_select_policy_flexible" ON operation_logs IS 'テスト対応：Service Role または自社データの作業記録参照';
COMMENT ON POLICY "operation_logs_update_policy_flexible" ON operation_logs IS 'テスト対応：Service Role または権限を持つユーザーによる作業記録更新';

COMMENT ON POLICY "photos_insert_policy_flexible" ON photos IS 'テスト対応：Service Role または認証済みユーザーによる写真追加';
COMMENT ON POLICY "photos_select_policy_flexible" ON photos IS 'テスト対応：Service Role または自社データの写真参照';
COMMENT ON POLICY "photos_update_policy_flexible" ON photos IS 'テスト対応：Service Role または権限を持つユーザーによる写真更新';