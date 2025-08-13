-- ====================================================================
-- プロフェッショナル外部キー制約修正 - 実用性とデータ整合性の両立
-- ====================================================================

-- 1. 既存の外部キー制約を削除（安全に削除）
ALTER TABLE vegetables DROP CONSTRAINT IF EXISTS vegetables_created_by_fkey;
ALTER TABLE farm_areas DROP CONSTRAINT IF EXISTS farm_areas_created_by_fkey;  
ALTER TABLE farm_plots DROP CONSTRAINT IF EXISTS farm_plots_created_by_fkey;

-- 2. created_byカラムをNULL許可に変更（まだの場合）
ALTER TABLE vegetables ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE farm_areas ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE farm_plots ALTER COLUMN created_by DROP NOT NULL;

-- 3. 柔軟な外部キー制約を再作成（開発環境用）
-- NULL値を許可し、参照先が削除された場合はNULLに設定
ALTER TABLE vegetables 
ADD CONSTRAINT vegetables_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES users(id) 
ON DELETE SET NULL;

ALTER TABLE farm_areas 
ADD CONSTRAINT farm_areas_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES users(id) 
ON DELETE SET NULL;

ALTER TABLE farm_plots 
ADD CONSTRAINT farm_plots_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES users(id) 
ON DELETE SET NULL;

-- 4. テスト用基本データの確実な作成
INSERT INTO companies (id, name, email, phone, address, prefecture, industry, description, created_at, updated_at)
VALUES (
  'a1111111-1111-1111-1111-111111111111',
  '株式会社グリーンファーム',
  'info@greenfarm.example.com',
  '03-1234-5678',
  '東京都港区虎ノ門1-1-1',
  '東京都',
  'agriculture',
  'テスト用農業会社 - システム開発検証用',
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = now();

INSERT INTO users (id, company_id, email, full_name, role, created_at, updated_at)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'a1111111-1111-1111-1111-111111111111',
  'test-admin@greenfarm.example.com',
  'テスト管理者',
  'admin',
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  updated_at = now();

-- 5. データ整合性チェック関数の作成
CREATE OR REPLACE FUNCTION check_data_integrity()
RETURNS TABLE(
  table_name text,
  total_records bigint,
  records_with_valid_created_by bigint,
  records_with_null_created_by bigint,
  test_data_records bigint
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'vegetables'::text,
    (SELECT COUNT(*) FROM vegetables),
    (SELECT COUNT(*) FROM vegetables WHERE created_by IS NOT NULL AND EXISTS (SELECT 1 FROM users WHERE users.id = vegetables.created_by)),
    (SELECT COUNT(*) FROM vegetables WHERE created_by IS NULL),
    (SELECT COUNT(*) FROM vegetables WHERE created_by = '11111111-1111-1111-1111-111111111111')
  UNION ALL
  SELECT 
    'farm_areas'::text,
    (SELECT COUNT(*) FROM farm_areas),
    (SELECT COUNT(*) FROM farm_areas WHERE created_by IS NOT NULL AND EXISTS (SELECT 1 FROM users WHERE users.id = farm_areas.created_by)),
    (SELECT COUNT(*) FROM farm_areas WHERE created_by IS NULL),
    (SELECT COUNT(*) FROM farm_areas WHERE created_by = '11111111-1111-1111-1111-111111111111')
  UNION ALL
  SELECT 
    'users'::text,
    (SELECT COUNT(*) FROM users),
    (SELECT COUNT(*) FROM users WHERE id = '11111111-1111-1111-1111-111111111111'),
    0::bigint,
    (SELECT COUNT(*) FROM users WHERE id = '11111111-1111-1111-1111-111111111111');
END;
$$;

-- 6. 実行と確認
SELECT * FROM check_data_integrity();

-- 7. 実用的なコメント追加
COMMENT ON CONSTRAINT vegetables_created_by_fkey ON vegetables IS 'ユーザー参照（NULL許可、開発環境対応）';
COMMENT ON FUNCTION check_data_integrity() IS 'データ整合性チェック関数（開発・デバッグ用）';

-- 8. 成功メッセージ
DO $$
BEGIN
  RAISE NOTICE '✅ 外部キー制約修正が完了しました - 実用性とデータ整合性を両立';
  RAISE NOTICE '📝 テスト会社ID: a1111111-1111-1111-1111-111111111111';
  RAISE NOTICE '👤 テストユーザーID: 11111111-1111-1111-1111-111111111111';
END $$;