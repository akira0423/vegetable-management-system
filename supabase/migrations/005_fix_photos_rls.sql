-- ====================================================================
-- 写真テーブルのRLS問題修正
-- ====================================================================

-- 既存の写真テーブルのRLSポリシーを一時的に削除
DROP POLICY IF EXISTS "photos_select_policy" ON photos;
DROP POLICY IF EXISTS "photos_insert_policy" ON photos;
DROP POLICY IF EXISTS "photos_update_policy" ON photos;
DROP POLICY IF EXISTS "photos_delete_policy" ON photos;

-- 写真テーブルのRLSを一時的に無効化（テスト用）
ALTER TABLE photos DISABLE ROW LEVEL SECURITY;

-- または、より緩いRLSポリシーを設定
-- ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- 緩いポリシー（認証不要でテスト可能）
-- CREATE POLICY "photos_select_all" ON photos FOR SELECT USING (true);
-- CREATE POLICY "photos_insert_all" ON photos FOR INSERT WITH CHECK (true);
-- CREATE POLICY "photos_update_all" ON photos FOR UPDATE USING (true);
-- CREATE POLICY "photos_delete_all" ON photos FOR DELETE USING (true);

-- テスト用：写真テーブルのcreated_byをNULL許可に変更
ALTER TABLE photos ALTER COLUMN created_by DROP NOT NULL;