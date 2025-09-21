-- ====================================================
-- Phase 0-2: 関数の最適化
-- 実行方法: Supabase SQL Editorで実行
-- 注意: トランザクション内で実行可能
-- ====================================================

BEGIN;

-- ====================================================
-- 1. get_current_company_id()関数の最適化
-- ====================================================

-- 既存の関数を削除
DROP FUNCTION IF EXISTS get_current_company_id();

-- 最適化された関数を作成（STABLE = 同一トランザクション内でキャッシュ）
CREATE OR REPLACE FUNCTION get_current_company_id()
RETURNS uuid
LANGUAGE sql
STABLE  -- VOLATILEから変更（重要！）
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT company_id
    FROM public.users
    WHERE id = auth.uid()
    LIMIT 1;
$$;

-- 関数にコメントを追加
COMMENT ON FUNCTION get_current_company_id() IS
'現在のユーザーの会社IDを取得する最適化された関数。STABLEによりトランザクション内でキャッシュされる。';

-- ====================================================
-- 2. is_service_role()ヘルパー関数の追加
-- ====================================================

-- Service Role判定用の高速関数
CREATE OR REPLACE FUNCTION is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE  -- JWTは同一リクエスト内で変わらない
SECURITY DEFINER
AS $$
    SELECT coalesce(
        current_setting('request.jwt.claim.role', true) = 'service_role',
        false
    );
$$;

-- 関数にコメントを追加
COMMENT ON FUNCTION is_service_role() IS
'現在のセッションがService Roleかどうかを判定する高速関数';

-- ====================================================
-- 3. get_current_user_role()関数の追加（オプション）
-- ====================================================

CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT COALESCE(
        (SELECT role FROM public.users WHERE id = auth.uid()),
        'guest'
    );
$$;

COMMENT ON FUNCTION get_current_user_role() IS
'現在のユーザーのロールを取得（admin, user, guest等）';

-- ====================================================
-- 4. 確認と検証
-- ====================================================

-- 関数の設定確認
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN
        SELECT
            proname as function_name,
            provolatile as volatility
        FROM pg_proc
        WHERE proname IN ('get_current_company_id', 'is_service_role', 'get_current_user_role')
        AND pronamespace = 'public'::regnamespace
    LOOP
        RAISE NOTICE 'Function % volatility: % (i=immutable, s=stable, v=volatile)',
            func_record.function_name,
            func_record.volatility;
    END LOOP;

    RAISE NOTICE 'Function optimization completed successfully';
END $$;

COMMIT;

-- ====================================================
-- 実行後の確認用クエリ（別途実行）
-- ====================================================
/*
-- 関数の詳細確認
SELECT
    proname AS function_name,
    CASE provolatile
        WHEN 'i' THEN 'IMMUTABLE'
        WHEN 's' THEN 'STABLE ✅'
        WHEN 'v' THEN 'VOLATILE ❌'
    END AS volatility,
    prosecdef AS security_definer,
    obj_description(oid, 'pg_proc') AS comment
FROM pg_proc
WHERE proname IN ('get_current_company_id', 'is_service_role', 'get_current_user_role')
AND pronamespace = 'public'::regnamespace
ORDER BY proname;

-- 関数の実行テスト（現在のユーザーで確認）
SELECT
    get_current_company_id() AS company_id,
    is_service_role() AS is_service,
    get_current_user_role() AS user_role;
*/