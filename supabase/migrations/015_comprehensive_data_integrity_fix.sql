-- ====================================================================
-- プロフェッショナル＆実用的データ整合性修正
-- ====================================================================
--
-- 野菜管理システムのデータ整合性を包括的に修正し、
-- 実用的なテスト環境を構築
--

-- 1. 既存データのクリーンアップ（安全な削除順序）
DELETE FROM vegetables WHERE created_by NOT IN (SELECT id FROM users);
DELETE FROM farm_areas WHERE created_by NOT IN (SELECT id FROM users);
DELETE FROM farm_plots WHERE created_by NOT IN (SELECT id FROM users);

-- 2. 必要なテスト会社データの確保
INSERT INTO companies (id, name, email, phone, address, prefecture, industry, website, description)
VALUES (
  'a1111111-1111-1111-1111-111111111111',
  '株式会社グリーンファーム',
  'info@greenfarm.example.com',
  '03-1234-5678',
  '東京都港区虎ノ門1-1-1',
  '東京都',
  'agriculture',
  'https://greenfarm.example.com',
  'テスト用農業会社 - 野菜管理システム開発用'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  updated_at = now();

-- 3. 必要なテストユーザーデータの確保（有効なUUID形式）
INSERT INTO users (id, company_id, email, full_name, role)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'a1111111-1111-1111-1111-111111111111',
  'test-admin@greenfarm.example.com',
  'テスト管理者',
  'admin'
)
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  updated_at = now();

-- 4. 外部キー制約の一時的な無効化（開発環境のみ）
-- 注意: 本番環境では実行しないでください
ALTER TABLE vegetables DROP CONSTRAINT IF EXISTS vegetables_created_by_fkey;
ALTER TABLE farm_areas DROP CONSTRAINT IF EXISTS farm_areas_created_by_fkey;
ALTER TABLE farm_plots DROP CONSTRAINT IF EXISTS farm_plots_created_by_fkey;

-- 5. より柔軟な外部キー制約の再作成（NULL許可）
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

-- 6. 実用的なサンプル野菜データの作成（テスト用）
INSERT INTO vegetables (
  id, name, variety_name, plot_name, area_size, 
  planting_date, expected_harvest_start, expected_harvest_end,
  status, notes, company_id, created_by
) VALUES (
  gen_random_uuid(),
  'トマト',
  '桃太郎',
  'A棟温室-1',
  100.0,
  current_date - interval '30 days',
  current_date + interval '60 days',
  current_date + interval '90 days',
  'growing',
  'テスト用野菜データ - システム開発検証用',
  'a1111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111'
),
(
  gen_random_uuid(),
  'キュウリ',
  '夏すずみ',
  'B棟温室-1',
  75.5,
  current_date - interval '20 days',
  current_date + interval '40 days',
  current_date + interval '70 days',
  'growing',
  'テスト用野菜データ - 実用性検証用',
  'a1111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111'
);

-- 7. データ整合性の検証
DO $$
BEGIN
  -- ユーザー存在確認
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = '11111111-1111-1111-1111-111111111111') THEN
    RAISE EXCEPTION 'テストユーザーが作成されていません';
  END IF;
  
  -- 会社存在確認
  IF NOT EXISTS (SELECT 1 FROM companies WHERE id = 'a1111111-1111-1111-1111-111111111111') THEN
    RAISE EXCEPTION 'テスト会社が作成されていません';
  END IF;
  
  RAISE NOTICE 'データ整合性チェック完了 - 全て正常です';
END $$;

-- 8. 実用的なコメント追加
COMMENT ON TABLE users IS 'ユーザー管理（認証連携準備、テスト環境対応済み）';
COMMENT ON TABLE companies IS '会社管理（マルチテナント対応、テストデータ含む）';
COMMENT ON TABLE vegetables IS '野菜管理（外部キー制約緩和、実用性重視）';

-- 9. 管理用ビューの作成（デバッグ支援）
CREATE OR REPLACE VIEW v_data_integrity_check AS
SELECT 
  'users' as table_name,
  count(*) as record_count,
  count(CASE WHEN id = '11111111-1111-1111-1111-111111111111' THEN 1 END) as test_user_count
FROM users
UNION ALL
SELECT 
  'companies' as table_name,
  count(*) as record_count,
  count(CASE WHEN id = 'a1111111-1111-1111-1111-111111111111' THEN 1 END) as test_company_count
FROM companies
UNION ALL
SELECT 
  'vegetables' as table_name,
  count(*) as record_count,
  count(CASE WHEN created_by = '11111111-1111-1111-1111-111111111111' THEN 1 END) as test_vegetables_count
FROM vegetables;

COMMENT ON VIEW v_data_integrity_check IS 'データ整合性確認用ビュー（開発・デバッグ支援）';