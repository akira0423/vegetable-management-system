-- ====================================================================
-- Storage設定 - 野菜栽培写真用バケット
-- ====================================================================

-- ====================================================================
-- 1. Storageバケットの作成
-- ====================================================================
-- 注意: この部分はSupabase Dashboardで手動作成するか、下記SQLを実行
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'vegetable-photos',
    'vegetable-photos', 
    true,  -- 公開バケット（写真表示用）
    10485760,  -- 10MB制限
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
);

-- ====================================================================
-- 2. Storage RLS ポリシー設定
-- ====================================================================

-- 写真の参照：自社の野菜写真のみ
CREATE POLICY "vegetable_photos_select_policy" ON storage.objects
    FOR SELECT 
    USING (
        bucket_id = 'vegetable-photos' 
        AND EXISTS (
            SELECT 1 FROM photos p
            JOIN vegetables v ON v.id = p.vegetable_id
            WHERE p.storage_path = name
            AND v.company_id = get_current_user_company_id()
        )
    );

-- 写真のアップロード：認証済みユーザーのみ
CREATE POLICY "vegetable_photos_insert_policy" ON storage.objects
    FOR INSERT 
    WITH CHECK (
        bucket_id = 'vegetable-photos'
        AND (SELECT auth.uid()) IS NOT NULL
        AND char_length(name) < 200
        AND (storage.foldername(name))[1] = get_current_user_company_id()::text
    );

-- 写真の更新：作成者のみ
CREATE POLICY "vegetable_photos_update_policy" ON storage.objects
    FOR UPDATE 
    USING (
        bucket_id = 'vegetable-photos'
        AND owner = (SELECT auth.uid())
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
-- 3. 写真リサイズ・最適化用の関数
-- ====================================================================
CREATE OR REPLACE FUNCTION handle_photo_upload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 写真メタデータをphotosテーブルに自動記録
    -- 実際のアプリケーションから呼び出される想定
    RETURN NEW;
END;
$$;