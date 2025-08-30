-- ====================================================================
-- 写真テーブルの確実な作成（存在しない場合のみ）
-- ====================================================================

-- 写真テーブル
CREATE TABLE IF NOT EXISTS photos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_log_id uuid REFERENCES operation_logs(id) ON DELETE CASCADE,
    vegetable_id uuid NOT NULL REFERENCES vegetables(id) ON DELETE CASCADE,
    storage_path text NOT NULL,      -- Supabase Storage パス
    original_filename text NOT NULL,
    file_size integer,      -- bytes (nullable for backward compatibility)
    mime_type text NOT NULL,
    width integer,
    height integer,
    taken_at timestamptz NOT NULL DEFAULT now(),
    location_lat decimal(10,6),      -- 撮影場所GPS
    location_lng decimal(10,6),
    description text,
    tags text[] DEFAULT '{}',                     -- 検索用タグ
    is_primary boolean DEFAULT false, -- メイン写真フラグ
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- インデックス（存在しない場合のみ作成）
CREATE INDEX IF NOT EXISTS idx_photos_vegetable ON photos(vegetable_id);
CREATE INDEX IF NOT EXISTS idx_photos_operation_log ON photos(operation_log_id);  
CREATE INDEX IF NOT EXISTS idx_photos_taken_at ON photos(taken_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_primary ON photos(is_primary) WHERE is_primary = true;
CREATE INDEX IF NOT EXISTS idx_photos_tags ON photos USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_photos_created_at ON photos(created_at DESC);

-- RLS有効化
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- RLSポリシー（存在しない場合のみ作成）
DO $$
BEGIN
    -- 読み取りポリシー
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'photos' AND policyname = 'photos_select_policy'
    ) THEN
        CREATE POLICY photos_select_policy ON photos 
            FOR SELECT 
            USING (
                vegetable_id IN (
                    SELECT id FROM vegetables 
                    WHERE company_id IN (
                        SELECT company_id FROM users 
                        WHERE id = auth.uid()
                    )
                )
            );
    END IF;

    -- 挿入ポリシー
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'photos' AND policyname = 'photos_insert_policy'
    ) THEN
        CREATE POLICY photos_insert_policy ON photos 
            FOR INSERT 
            WITH CHECK (
                vegetable_id IN (
                    SELECT id FROM vegetables 
                    WHERE company_id IN (
                        SELECT company_id FROM users 
                        WHERE id = auth.uid()
                    )
                )
            );
    END IF;

    -- 更新ポリシー
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'photos' AND policyname = 'photos_update_policy'
    ) THEN
        CREATE POLICY photos_update_policy ON photos 
            FOR UPDATE 
            USING (
                vegetable_id IN (
                    SELECT id FROM vegetables 
                    WHERE company_id IN (
                        SELECT company_id FROM users 
                        WHERE id = auth.uid()
                    )
                )
            );
    END IF;

    -- 削除ポリシー
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'photos' AND policyname = 'photos_delete_policy'
    ) THEN
        CREATE POLICY photos_delete_policy ON photos 
            FOR DELETE 
            USING (
                vegetable_id IN (
                    SELECT id FROM vegetables 
                    WHERE company_id IN (
                        SELECT company_id FROM users 
                        WHERE id = auth.uid()
                    )
                )
            );
    END IF;
END
$$;

-- Updated atトリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- updated_atトリガーを作成（存在しない場合のみ）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_photos_updated_at'
    ) THEN
        CREATE TRIGGER update_photos_updated_at 
            BEFORE UPDATE ON photos 
            FOR EACH ROW 
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END
$$;

-- Supabase Storageバケット設定（存在しない場合のみ作成）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 
    'vegetable-photos',
    'vegetable-photos',
    true,
    52428800, -- 50MB
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
WHERE NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'vegetable-photos'
);

-- Storage RLS ポリシー（存在しない場合のみ作成）
DO $$
BEGIN
    -- 読み取りポリシー
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'vegetable_photos_select_policy'
    ) THEN
        CREATE POLICY vegetable_photos_select_policy ON storage.objects 
            FOR SELECT 
            USING (bucket_id = 'vegetable-photos');
    END IF;

    -- 挿入ポリシー
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'vegetable_photos_insert_policy'
    ) THEN
        CREATE POLICY vegetable_photos_insert_policy ON storage.objects 
            FOR INSERT 
            WITH CHECK (
                bucket_id = 'vegetable-photos' AND 
                auth.uid() IS NOT NULL
            );
    END IF;

    -- 更新ポリシー
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'vegetable_photos_update_policy'
    ) THEN
        CREATE POLICY vegetable_photos_update_policy ON storage.objects 
            FOR UPDATE 
            USING (
                bucket_id = 'vegetable-photos' AND 
                auth.uid() IS NOT NULL
            );
    END IF;

    -- 削除ポリシー
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'vegetable_photos_delete_policy'
    ) THEN
        CREATE POLICY vegetable_photos_delete_policy ON storage.objects 
            FOR DELETE 
            USING (
                bucket_id = 'vegetable-photos' AND 
                auth.uid() IS NOT NULL
            );
    END IF;
END
$$;