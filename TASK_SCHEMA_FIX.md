# 🔥 緊急修正: growing_tasksテーブルスキーマ不整合

## 問題の詳細

### 現在のテーブル構造
```sql
CREATE TABLE growing_tasks (
    id uuid PRIMARY KEY,
    vegetable_id uuid NOT NULL REFERENCES vegetables(id),
    name text NOT NULL,                    -- ✅ "name" (not "task_name")
    -- company_id は存在しない ❌
    task_type text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    start_date date NOT NULL,
    end_date date NOT NULL,
    created_by uuid NOT NULL REFERENCES users(id),
    -- 他のフィールド...
)
```

### フロントエンドが期待する構造
```typescript
{
  task_name: string,    // ❌ 実際は "name"
  company_id: string,   // ❌ 存在しない
  // 他のフィールド...
}
```

## 🔧 修正方法

### オプション1: company_idを追加（推奨）
```sql
-- 1. company_idフィールドを追加
ALTER TABLE growing_tasks ADD COLUMN company_id uuid REFERENCES companies(id);

-- 2. 既存レコードにcompany_idを設定（野菜テーブルから取得）
UPDATE growing_tasks 
SET company_id = (
    SELECT v.company_id 
    FROM vegetables v 
    WHERE v.id = growing_tasks.vegetable_id
);

-- 3. NOT NULL制約を追加
ALTER TABLE growing_tasks ALTER COLUMN company_id SET NOT NULL;
```

### オプション2: フロントエンドコードを修正
- すべての `task_name` を `name` に変更
- `company_id` フィルターを `vegetables.company_id` に変更

## 🚀 即座の対応手順

1. **Supabase Dashboard** → **SQL Editor**
2. 以下のSQLを実行:

```sql
-- company_idフィールドを追加
ALTER TABLE growing_tasks ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);

-- 既存データにcompany_idを設定
UPDATE growing_tasks 
SET company_id = (
    SELECT v.company_id 
    FROM vegetables v 
    WHERE v.id = growing_tasks.vegetable_id
)
WHERE company_id IS NULL;

-- デフォルト値を設定（今後の挿入用）
ALTER TABLE growing_tasks ALTER COLUMN company_id SET DEFAULT 'a1111111-1111-1111-1111-111111111111';
```

3. **フロントエンドコードを修正**:
   - `task_name` → `name` に変更
   - API calls を調整

## 📊 修正後の動作確認

```javascript
// テスト用スクリプト
const { data, error } = await supabase
  .from('growing_tasks')
  .select('id, name, company_id, start_date, end_date, status')
  .eq('company_id', 'a1111111-1111-1111-1111-111111111111')
  .order('start_date', { ascending: true })

console.log('修正後のタスク:', data)
```

修正完了後、ガントチャートでタスクが正常に表示されるはずです。