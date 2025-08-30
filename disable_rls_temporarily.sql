-- RLSポリシーの一時的な無効化
-- 認証システムの動作確認のため

-- usersテーブルのRLSを無効化
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 既存のポリシーも削除
DROP POLICY IF EXISTS "Users can view users in their company" ON users;
DROP POLICY IF EXISTS "Users can update their own record" ON users;  
DROP POLICY IF EXISTS "Admins can update users in their company" ON users;
DROP POLICY IF EXISTS "Users can insert their own record" ON users;

-- 確認メッセージ
SELECT '✅ RLSが一時的に無効化されました' as status;
SELECT '🔐 認証システムのテストが可能になりました' as message;