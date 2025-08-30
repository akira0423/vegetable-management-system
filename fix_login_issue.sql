-- ログイン問題の緊急修正
-- Supabase SQLエディタで実行してください

-- ====================================================================
-- 1. 一時的にRLSポリシーを無効化
-- ====================================================================

-- usersテーブルのRLSを一時的に無効化
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- ====================================================================
-- 2. トリガーを一時的に無効化（必要に応じて）
-- ====================================================================

-- 問題が続く場合は、以下を実行してトリガーを無効化
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

-- ====================================================================
-- 3. ログイン確認用クエリ
-- ====================================================================

-- 現在のauth.usersの状況を確認
SELECT 
  id, 
  email, 
  created_at,
  last_sign_in_at,
  email_confirmed_at
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 5;

-- usersテーブルの状況を確認
SELECT 
  id, 
  email, 
  full_name,
  company_id,
  is_active,
  settings
FROM users 
ORDER BY created_at DESC 
LIMIT 5;

SELECT '✅ ログイン修正用クエリが完了しました' as message;