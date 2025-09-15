# assigned_toカラムの追加手順

## Supabase Dashboardから手動実行

1. [Supabase Dashboard](https://app.supabase.com) にログイン
2. プロジェクトを選択
3. 左メニューから「SQL Editor」を選択
4. 新しいクエリタブを開く
5. 以下のSQLを実行

```sql
-- ====================================================================
-- assigned_toカラムの復活
-- growing_tasksテーブルに担当者管理用のカラムを追加
-- ====================================================================

-- 1. assigned_toカラムの追加（存在しない場合のみ）
ALTER TABLE growing_tasks
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;

-- 2. インデックスの追加（パフォーマンス向上のため）
CREATE INDEX IF NOT EXISTS idx_growing_tasks_assigned_to
ON growing_tasks(assigned_to);

-- 3. 複合インデックスの追加（担当者とステータスでの検索最適化）
CREATE INDEX IF NOT EXISTS idx_growing_tasks_assigned_status
ON growing_tasks(assigned_to, status);

-- 4. コメントの追加
COMMENT ON COLUMN growing_tasks.assigned_to IS 'タスクに割り当てられたユーザーID';
```

## 実行後の確認

以下のクエリを実行して、カラムが正しく追加されたことを確認：

```sql
-- カラムの存在確認
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'growing_tasks'
    AND column_name = 'assigned_to';

-- インデックスの確認
SELECT
    indexname,
    tablename,
    indexdef
FROM pg_indexes
WHERE tablename = 'growing_tasks'
    AND indexname LIKE '%assigned%';
```

## トラブルシューティング

### エラー: "column "assigned_to" already exists"
カラムが既に存在しています。問題ありません。

### エラー: "relation "users" does not exist"
usersテーブルが存在しない場合は、以下のSQLを実行：

```sql
-- usersテーブルが存在しない場合のみ
ALTER TABLE growing_tasks
ADD COLUMN IF NOT EXISTS assigned_to UUID;
```

## 動作確認

1. ガントチャートページにアクセス
2. タスクの詳細モーダルを開く
3. 担当者を変更してみる
4. エラーが発生しないことを確認

## ロールバック手順

問題が発生した場合は以下のSQLを実行：

```sql
-- カラムの削除
ALTER TABLE growing_tasks DROP COLUMN IF EXISTS assigned_to;

-- インデックスの削除
DROP INDEX IF EXISTS idx_growing_tasks_assigned_to;
DROP INDEX IF EXISTS idx_growing_tasks_assigned_status;
```