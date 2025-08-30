-- データベースの包括的な調査
-- 現在のデータ状況とcompany_id問題を特定

-- ====================================================================
-- 1. 全テーブルのデータ数を確認
-- ====================================================================

SELECT 'companies' as table_name, COUNT(*) as count FROM companies
UNION ALL
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'growing_tasks' as table_name, COUNT(*) as count FROM growing_tasks
UNION ALL
SELECT 'reports' as table_name, COUNT(*) as count FROM reports
UNION ALL
SELECT 'vegetables' as table_name, COUNT(*) as count FROM vegetables
UNION ALL
SELECT 'auth.users' as table_name, COUNT(*) as count FROM auth.users;

-- ====================================================================
-- 2. companiesテーブルの詳細確認
-- ====================================================================

SELECT 
  'companiesテーブルの詳細:' as info,
  id,
  name,
  contact_email,
  is_active,
  created_at
FROM companies 
ORDER BY created_at DESC;

-- ====================================================================
-- 3. usersテーブルの詳細確認
-- ====================================================================

SELECT 
  'usersテーブルの詳細:' as info,
  id,
  email,
  full_name,
  company_id,
  is_active,
  settings,
  created_at
FROM users 
ORDER BY created_at DESC;

-- ====================================================================
-- 4. auth.usersの詳細確認
-- ====================================================================

SELECT 
  'auth.usersの詳細:' as info,
  id,
  email,
  created_at,
  last_sign_in_at,
  email_confirmed_at
FROM auth.users 
ORDER BY created_at DESC;

-- ====================================================================
-- 5. 特定のcompany_id 'a1111111-1111-1111-1111-111111111111' のデータ確認
-- ====================================================================

-- このcompany_idが実在するか確認
SELECT 'デフォルトcompany_idの存在確認:' as info, COUNT(*) as count
FROM companies 
WHERE id = 'a1111111-1111-1111-1111-111111111111';

-- このcompany_idに関連するユーザー
SELECT 'デフォルトcompany_idのユーザー:' as info, COUNT(*) as count
FROM users 
WHERE company_id = 'a1111111-1111-1111-1111-111111111111';

-- このcompany_idに関連するgrowing_tasks
SELECT 'デフォルトcompany_idのgrowing_tasks:' as info, COUNT(*) as count
FROM growing_tasks 
WHERE company_id = 'a1111111-1111-1111-1111-111111111111';

-- このcompany_idに関連するreports  
SELECT 'デフォルトcompany_idのreports:' as info, COUNT(*) as count
FROM reports 
WHERE company_id = 'a1111111-1111-1111-1111-111111111111';

-- このcompany_idに関連するvegetables
SELECT 'デフォルトcompany_idのvegetables:' as info, COUNT(*) as count
FROM vegetables 
WHERE company_id = 'a1111111-1111-1111-1111-111111111111';

-- ====================================================================
-- 6. 実際にデータが存在するcompany_idを特定
-- ====================================================================

-- データが存在するcompany_idを全て列挙
SELECT DISTINCT 
  'データが存在するcompany_id:' as info,
  company_id,
  (SELECT name FROM companies WHERE id = company_id) as company_name
FROM (
  SELECT company_id FROM users WHERE company_id IS NOT NULL
  UNION
  SELECT company_id FROM growing_tasks WHERE company_id IS NOT NULL
  UNION  
  SELECT company_id FROM reports WHERE company_id IS NOT NULL
  UNION
  SELECT company_id FROM vegetables WHERE company_id IS NOT NULL
) as all_company_ids
ORDER BY company_id;

-- ====================================================================
-- 7. 各company_idごとのデータ分布
-- ====================================================================

SELECT 
  u.company_id,
  c.name as company_name,
  COUNT(DISTINCT u.id) as user_count,
  COUNT(DISTINCT gt.id) as task_count,
  COUNT(DISTINCT r.id) as report_count,
  COUNT(DISTINCT v.id) as vegetable_count
FROM users u
LEFT JOIN companies c ON u.company_id = c.id
LEFT JOIN growing_tasks gt ON u.company_id = gt.company_id
LEFT JOIN reports r ON u.company_id = r.company_id
LEFT JOIN vegetables v ON u.company_id = v.company_id
GROUP BY u.company_id, c.name
ORDER BY user_count DESC;