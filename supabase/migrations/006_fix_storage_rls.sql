-- ====================================================================
-- Storage RLS問題修正
-- ====================================================================

-- 既存のStorage RLSポリシーを削除
DROP POLICY IF EXISTS "vegetable_photos_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "vegetable_photos_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "vegetable_photos_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "vegetable_photos_delete_policy" ON storage.objects;

-- テスト用：すべて許可するポリシーを作成
CREATE POLICY "allow_all_vegetable_photos" 
ON storage.objects FOR ALL 
USING (bucket_id = 'vegetable-photos');

-- または、より具体的なポリシー
-- 参照：全て許可
CREATE POLICY "public_vegetable_photos_select" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'vegetable-photos');

-- アップロード：認証不要で許可
CREATE POLICY "public_vegetable_photos_insert" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'vegetable-photos');

-- 更新：認証不要で許可
CREATE POLICY "public_vegetable_photos_update" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'vegetable-photos');

-- 削除：認証不要で許可
CREATE POLICY "public_vegetable_photos_delete" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'vegetable-photos');