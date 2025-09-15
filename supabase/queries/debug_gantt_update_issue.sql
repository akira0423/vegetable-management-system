-- ====================================================================
-- ガントチャート更新エラーのデバッグクエリ
-- エラー: Cannot coerce the result to a single JSON object
-- タスクID: 1ed9bf67-1597-4cf8-8745-a72ba2b5f466
-- ====================================================================

-- 1. growing_tasksテーブルの構造確認
SELECT
  '=== growing_tasksテーブルの構造 ===' as section;

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'growing_tasks'
ORDER BY ordinal_position;

-- 2. 特定のタスクIDが存在するか確認
SELECT
  '=== タスクID: 1ed9bf67-1597-4cf8-8745-a72ba2b5f466 の存在確認 ===' as section;

SELECT
  id,
  company_id,
  name,
  status,
  progress,
  priority,
  assigned_to,
  deleted_at,
  created_at,
  updated_at
FROM growing_tasks
WHERE id = '1ed9bf67-1597-4cf8-8745-a72ba2b5f466';

-- 3. 企業ID: 4cb3e254-9d73-4d67-b9ae-433bf249fe38 のタスク一覧
SELECT
  '=== 企業のタスク一覧（最新10件） ===' as section;

SELECT
  id,
  name,
  status,
  progress,
  priority,
  assigned_to,
  start_date,
  end_date,
  deleted_at
FROM growing_tasks
WHERE company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
ORDER BY created_at DESC
LIMIT 10;

-- 4. deleted_atカラムの存在確認
SELECT
  '=== deleted_atカラムの状態 ===' as section;

SELECT
  COUNT(*) as total_tasks,
  COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as active_tasks,
  COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as deleted_tasks
FROM growing_tasks
WHERE company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38';

-- 5. 更新対象のタスクが削除されていないか確認
SELECT
  '=== タスクの削除状態確認 ===' as section;

SELECT
  id,
  name,
  deleted_at,
  CASE
    WHEN deleted_at IS NULL THEN 'アクティブ'
    ELSE 'ソフト削除済み'
  END as status
FROM growing_tasks
WHERE id = '1ed9bf67-1597-4cf8-8745-a72ba2b5f466';

-- 6. RLSポリシーの確認
SELECT
  '=== growing_tasksテーブルのRLSポリシー ===' as section;

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'growing_tasks';

-- 7. インデックスの確認
SELECT
  '=== growing_tasksテーブルのインデックス ===' as section;

SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'growing_tasks';

-- ====================================================================
-- 修正案の確認
-- ====================================================================

-- もしタスクが存在しない場合は、以下のクエリで作成
/*
INSERT INTO growing_tasks (
  id,
  company_id,
  vegetable_id,
  name,
  status,
  priority,
  progress,
  start_date,
  end_date,
  task_type,
  created_at,
  updated_at
) VALUES (
  '1ed9bf67-1597-4cf8-8745-a72ba2b5f466',
  '4cb3e254-9d73-4d67-b9ae-433bf249fe38',
  'YOUR_VEGETABLE_ID',
  'テストタスク',
  'pending',
  'medium',
  0,
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '7 days',
  'other',
  NOW(),
  NOW()
);
*/

-- もしdeleted_atで削除されている場合は復活
/*
UPDATE growing_tasks
SET deleted_at = NULL
WHERE id = '1ed9bf67-1597-4cf8-8745-a72ba2b5f466';
*/