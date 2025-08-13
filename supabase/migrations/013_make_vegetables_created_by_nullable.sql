-- ====================================================================
-- テスト・開発環境用：vegetablesテーブルのcreated_by制約を一時的に緩和
-- ====================================================================
--
-- 注意: 本番環境では適用前に十分検討してください
-- このマイグレーションは、認証システム実装前のテスト用です
--

-- vegetablesテーブルのcreated_by制約をnull許可に変更
ALTER TABLE vegetables 
ALTER COLUMN created_by DROP NOT NULL;

-- コメントを追加してテスト用であることを明記
COMMENT ON COLUMN vegetables.created_by IS 'ユーザーID（テスト用にnull許可、本番では認証必須）';

-- farm_areasテーブルのcreated_by制約もnull許可に変更（実用性向上）
ALTER TABLE farm_areas 
ALTER COLUMN created_by DROP NOT NULL;

COMMENT ON COLUMN farm_areas.created_by IS 'ユーザーID（テスト用にnull許可、本番では認証必須）';

-- farm_plotsテーブルのcreated_by制約もnull許可に変更（一貫性保持）
ALTER TABLE farm_plots 
ALTER COLUMN created_by DROP NOT NULL;

COMMENT ON COLUMN farm_plots.created_by IS 'ユーザーID（テスト用にnull許可、本番では認証必須）';