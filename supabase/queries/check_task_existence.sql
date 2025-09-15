-- ====================================================================
-- タスクの存在確認と状態チェック
-- ====================================================================

-- 1. 特定のタスクIDの詳細を確認
SELECT
  id,
  company_id,
  vegetable_id,
  name,
  status,
  progress,
  priority,
  assigned_to,
  start_date,
  end_date,
  deleted_at,
  created_at,
  updated_at
FROM growing_tasks
WHERE id = '1ed9bf67-1597-4cf8-8745-a72ba2b5f466';

-- 2. もしタスクが存在しない場合、似たようなタスクを探す
SELECT
  id,
  name,
  status,
  progress,
  company_id
FROM growing_tasks
WHERE company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
  AND name LIKE '%トマト%'  -- 必要に応じて変更
ORDER BY created_at DESC
LIMIT 5;

-- 3. テストタスクを作成（もし必要なら）
-- 以下のコメントを外して実行
/*
INSERT INTO growing_tasks (
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
  '4cb3e254-9d73-4d67-b9ae-433bf249fe38',
  (SELECT id FROM vegetables WHERE company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38' LIMIT 1),
  'テスト用タスク - 進捗率確認',
  'pending',
  'medium',
  0,
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '7 days',
  'other',
  NOW(),
  NOW()
) RETURNING id;
*/

-- 4. deleted_atカラムの存在確認
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'growing_tasks'
  AND column_name = 'deleted_at';

-- 5. progressカラムの型と制約を確認
SELECT
  column_name,
  data_type,
  numeric_precision,
  numeric_scale,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'growing_tasks'
  AND column_name IN ('progress', 'status', 'priority');

-- 6. 手動でタスクの進捗率を更新するテスト
-- 以下のコメントを外して実行
/*
UPDATE growing_tasks
SET
  progress = 50,
  updated_at = NOW()
WHERE id = '1ed9bf67-1597-4cf8-8745-a72ba2b5f466'
RETURNING id, progress, status;
*/