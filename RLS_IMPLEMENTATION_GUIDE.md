# RLS実装ガイドライン

## 即座に適用すべき設定（フェーズ1）

### 1. 基本セキュリティ適用
```bash
# マイグレーション適用
npx supabase migration up --file 025_production_rls_phase1.sql
```

### 2. 削除権限の確認
- **admin/manager**: 削除可能
- **operator**: 削除不可
- **Service Role**: 制限なし

### 3. テスト手順
```sql
-- 権限テスト
SELECT auth.role(), get_current_user_company_id(), get_current_user_role();

-- 削除テスト（admin権限で）
DELETE FROM growing_tasks WHERE id = 'test-task-id';
```

## パフォーマンス監視ポイント

### 1. クエリ実行時間
```sql
-- スロークエリ確認
SELECT query, total_time, calls 
FROM pg_stat_statements 
WHERE query LIKE '%growing_tasks%'
ORDER BY total_time DESC;
```

### 2. インデックス使用状況
```sql
-- インデックス効率確認
SELECT indexname, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE relname = 'growing_tasks';
```

## 緊急時の対応

### RLS無効化（緊急時のみ）
```sql
-- 緊急時：一時的にRLS無効化
ALTER TABLE growing_tasks DISABLE ROW LEVEL SECURITY;
-- 作業完了後：必ず再有効化
ALTER TABLE growing_tasks ENABLE ROW LEVEL SECURITY;
```

### Service Role権限確認
```typescript
// API で Service Role 使用確認
const supabase = createServiceClient();
console.log('Service Role使用中:', supabase.auth.getUser());
```

## 段階的強化スケジュール

### Phase 1（即座）: 基本セキュリティ
- ✅ 会社分離
- ✅ ロール権限
- ✅ Service Role バイパス

### Phase 2（1ヶ月後）: 削除保護
- 進行中タスクの削除禁止
- 作業記録連携チェック
- 営業時間制限

### Phase 3（3ヶ月後）: 監査強化
- 全操作ログ記録
- 異常検知アラート
- 権限変更追跡

## トラブルシューティング

### よくある問題

1. **削除できない**
   ```sql
   -- 権限確認
   SELECT get_current_user_role();
   ```

2. **パフォーマンス低下**
   ```sql
   -- インデックス追加
   CREATE INDEX idx_custom ON growing_tasks(company_id, status);
   ```

3. **Service Role認証失敗**
   ```typescript
   // 環境変数確認
   console.log(process.env.SUPABASE_SERVICE_ROLE_KEY);
   ```