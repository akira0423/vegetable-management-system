-- ====================================================
-- Phase 0-2: 関数の最適化（依存関係を保持）
-- 実行方法: Supabase SQL Editorで実行
-- 注意: DROP FUNCTIONを使わずCREATE OR REPLACEで更新
-- ====================================================

BEGIN;

-- ====================================================
-- 1. get_current_company_id()関数の最適化
-- DROP せずに CREATE OR REPLACE で更新
-- ====================================================

-- 最適化された関数（STABLEに変更でキャッシュ有効化）
CREATE OR REPLACE FUNCTION get_current_company_id()
RETURNS uuid
LANGUAGE sql
STABLE  -- VOLATILEから変更（最重要！）
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

-- 既存の場合は置き換え
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
        'user'  -- roleカラムがない場合のデフォルト値
    );
$$;

COMMENT ON FUNCTION get_current_user_role() IS
'現在のユーザーのロールを取得（roleカラムがない場合はuserを返す）';

-- ====================================================
-- 4. 必須インデックスの作成（関数の高速化）
-- ====================================================

-- users(id, company_id)のインデックス作成を試みる
DO $$
BEGIN
    -- インデックスが存在しない場合のみ作成
    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'users'
        AND indexname = 'idx_users_id_company'
    ) THEN
        -- トランザクション内なのでCONCURRENTLYは使えない
        CREATE INDEX idx_users_id_company ON users(id, company_id);
        RAISE NOTICE 'インデックス idx_users_id_company を作成しました';
    ELSE
        RAISE NOTICE 'インデックス idx_users_id_company は既に存在します';
    END IF;
END $$;

-- ====================================================
-- 5. 関数の最適化状態を確認
-- ====================================================

DO $$
DECLARE
    func_record RECORD;
    optimization_count INTEGER := 0;
BEGIN
    RAISE NOTICE '====================================';
    RAISE NOTICE '関数の最適化状態:';

    FOR func_record IN
        SELECT
            proname as function_name,
            provolatile as volatility,
            CASE provolatile
                WHEN 'i' THEN 'IMMUTABLE (最速)'
                WHEN 's' THEN 'STABLE (キャッシュ有効) ✅'
                WHEN 'v' THEN 'VOLATILE (キャッシュ無効) ❌'
            END as status
        FROM pg_proc
        WHERE proname IN ('get_current_company_id', 'is_service_role', 'get_current_user_role')
        AND pronamespace = 'public'::regnamespace
    LOOP
        RAISE NOTICE '  - %: %', func_record.function_name, func_record.status;

        IF func_record.volatility = 's' OR func_record.volatility = 'i' THEN
            optimization_count := optimization_count + 1;
        END IF;
    END LOOP;

    RAISE NOTICE '====================================';

    IF optimization_count >= 2 THEN
        RAISE NOTICE '✅ 関数の最適化が完了しました！';
    ELSE
        RAISE WARNING '⚠️ 一部の関数が最適化されていません';
    END IF;
END $$;

COMMIT;

-- ====================================================
-- 実行後の確認クエリ（別途実行）
-- ====================================================

-- 関数の詳細確認
SELECT
    proname AS function_name,
    CASE provolatile
        WHEN 'i' THEN 'IMMUTABLE ⚡'
        WHEN 's' THEN 'STABLE ✅'
        WHEN 'v' THEN 'VOLATILE ❌'
    END AS volatility,
    prosecdef AS security_definer,
    obj_description(oid, 'pg_proc') AS comment
FROM pg_proc
WHERE proname IN ('get_current_company_id', 'is_service_role', 'get_current_user_role')
AND pronamespace = 'public'::regnamespace
ORDER BY proname;

-- 依存関係の確認
SELECT
    d.classid::regclass AS dependent_type,
    d.objid::regprocedure AS dependent_object,
    r.ev_class::regclass AS referenced_table
FROM pg_depend d
JOIN pg_rewrite r ON r.oid = d.objid
WHERE d.refobjid = 'get_current_company_id'::regproc
LIMIT 10;