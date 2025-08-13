-- ====================================================================
-- テスト・開発環境用：created_by制約を一時的に緩和
-- ====================================================================
--
-- 注意: 本番環境では適用前に十分検討してください
-- このマイグレーションは、認証システム実装前のテスト用です
--

-- operation_logsテーブルのcreated_by制約を一時的にnull許可に変更
ALTER TABLE operation_logs 
ALTER COLUMN created_by DROP NOT NULL;

-- コメントを追加してテスト用であることを明記
COMMENT ON COLUMN operation_logs.created_by IS 'ユーザーID（テスト用にnull許可、本番では認証必須）';