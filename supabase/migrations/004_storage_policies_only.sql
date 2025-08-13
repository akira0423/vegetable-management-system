-- ====================================================================
-- Storage RLS ポリシー設定のみ
-- ====================================================================

-- ====================================================================
-- 1. Storage RLS ポリシー設定
-- ====================================================================

-- 既存のポリシーがある場合は削除
DROP POLICY IF EXISTS "vegetable_photos_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "vegetable_photos_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "vegetable_photos_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "vegetable_photos_delete_policy" ON storage.objects;

-- 写真の参照：自社の野菜写真のみ
CREATE POLICY "vegetable_photos_select_policy" ON storage.objects
    FOR SELECT 
    USING (
        bucket_id = 'vegetable-photos' 
        AND (
            -- 公開バケットなので全て参照可能、または
            -- 自社の野菜写真のみに制限する場合は下記コメントアウト解除
            /*
            EXISTS (
                SELECT 1 FROM photos p
                JOIN vegetables v ON v.id = p.vegetable_id
                WHERE p.storage_path = name
                AND v.company_id = get_current_user_company_id()
            )
            */
            true  -- 公開バケットのため全て参照可能
        )
    );

-- 写真のアップロード：認証済みユーザーのみ、会社フォルダ内
CREATE POLICY "vegetable_photos_insert_policy" ON storage.objects
    FOR INSERT 
    WITH CHECK (
        bucket_id = 'vegetable-photos'
        AND (SELECT auth.uid()) IS NOT NULL
        AND char_length(name) < 200
        -- パスの最初の部分が会社IDと一致するかチェック
        AND (
            get_current_user_company_id() IS NULL  -- 初期データ投入時
            OR 
            split_part(name, '/', 1) = get_current_user_company_id()::text
        )
    );

-- 写真の更新：作成者のみ
CREATE POLICY "vegetable_photos_update_policy" ON storage.objects
    FOR UPDATE 
    USING (
        bucket_id = 'vegetable-photos'
        AND (
            owner = (SELECT auth.uid())
            OR
            get_current_user_role() IN ('admin', 'manager')
        )
    );

-- 写真の削除：作成者または管理者
CREATE POLICY "vegetable_photos_delete_policy" ON storage.objects
    FOR DELETE 
    USING (
        bucket_id = 'vegetable-photos'
        AND (
            owner = (SELECT auth.uid())
            OR
            get_current_user_role() IN ('admin', 'manager')
        )
    );

-- ====================================================================
-- 2. 写真管理用のヘルパー関数
-- ====================================================================

-- 写真パス生成用関数
CREATE OR REPLACE FUNCTION generate_photo_path(
    company_id uuid,
    vegetable_id uuid,
    filename text
)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN company_id::text || '/' || vegetable_id::text || '/' || filename;
END;
$$;

-- 写真のサムネイル URL生成
CREATE OR REPLACE FUNCTION get_photo_thumbnail_url(storage_path text)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
    -- Supabase の transform API を使用したサムネイル URL
    RETURN 'transform/width=300,height=300,resize=cover/' || storage_path;
END;
$$;