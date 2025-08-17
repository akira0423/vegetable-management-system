# フェーズ5: 段階的移行とモニタリング

## 5.1 移行戦略

### 5.1.1 段階的適用

**Step 1: 開発環境（1日）**
- フェーズ1-4の全変更適用
- 開発チームでの動作確認
- 問題発見・修正

**Step 2: ステージング環境（2日）**
- 本番データのサブセットでテスト
- ユーザー受け入れテスト
- パフォーマンス検証

**Step 3: 本番環境（3日）**
- メンテナンス時間での適用
- 段階的な機能有効化
- リアルタイムモニタリング

**Step 4: 監視・調整（1日）**
- 運用監視
- 問題対応
- 最適化

## 5.2 リスク軽減策

### 5.2.1 ロールバック計画

```sql
-- 緊急時ロールバック手順
-- 1. RLS無効化（緊急時）
ALTER TABLE growing_tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE work_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE vegetables DISABLE ROW LEVEL SECURITY;

-- 2. 旧認証方式復元（準備済み）
-- backup_auth_functions.sql を実行

-- 3. API認証方式復元
-- createClient() に戻す
```

### 5.2.2 データバックアップ

```bash
# 移行前バックアップ
pg_dump -h $SUPABASE_HOST -U postgres -d postgres \
  --schema=public \
  --data-only \
  --table=users \
  --table=companies \
  --table=growing_tasks \
  --table=work_reports \
  --table=vegetables \
  > pre_migration_backup.sql
```

## 5.3 モニタリング

### 5.3.1 パフォーマンス監視

```sql
-- クエリパフォーマンス監視
CREATE VIEW performance_monitor AS
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements
WHERE query LIKE '%growing_tasks%'
   OR query LIKE '%work_reports%'
   OR query LIKE '%vegetables%'
ORDER BY total_time DESC;

-- 定期実行（5分間隔）
SELECT * FROM performance_monitor;
```

### 5.3.2 エラー監視

```javascript
// クライアントサイドエラー監視
window.addEventListener('error', (event) => {
    if (event.message.includes('API') || event.message.includes('削除')) {
        console.error('Migration Error:', {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            timestamp: new Date().toISOString()
        });
        
        // エラー報告API（オプション）
        fetch('/api/error-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'migration_error',
                message: event.message,
                context: 'auth_simplification'
            })
        });
    }
});
```

### 5.3.3 使用状況監視

```sql
-- 操作回数監視
CREATE TABLE operation_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_type text NOT NULL,
    table_name text NOT NULL,
    company_id uuid NOT NULL,
    success boolean NOT NULL,
    response_time_ms integer,
    created_at timestamptz DEFAULT now()
);

-- 削除操作の成功率監視
SELECT 
    DATE_TRUNC('hour', created_at) as hour,
    table_name,
    COUNT(*) as total_operations,
    SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
    ROUND(AVG(response_time_ms), 2) as avg_response_ms
FROM operation_metrics
WHERE operation_type = 'DELETE'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at), table_name
ORDER BY hour DESC;
```

## 5.4 ユーザー教育

### 5.4.1 変更点説明

**管理者向けドキュメント:**

```markdown
# 認証システム変更のお知らせ

## 変更点
- **1企業1アカウント制**: 複数人で同じアカウントを共有
- **権限簡素化**: admin/manager権限廃止
- **操作権限**: ログインした会社のデータのみ操作可能

## 利用方法
1. 従来通りメールアドレス・パスワードでログイン
2. 全機能が利用可能（権限制限なし）
3. 自社のデータのみ表示・編集

## 注意事項
- アカウント情報の管理を厳重に
- 操作ログは会社単位で記録
- 問題発生時は即座に連絡
```

### 5.4.2 サポート体制

**問い合わせ窓口:**
- 技術問題: tech-support@company.com
- 運用問題: operations@company.com
- 緊急時: emergency-hotline

**FAQ準備:**
- ログインできない
- データが見えない
- 削除できない
- パフォーマンスが遅い

## 5.5 成功指標

### 5.5.1 KPI設定

| 指標 | 移行前 | 目標値 | 測定方法 |
|------|--------|--------|----------|
| **削除成功率** | 85% | 98%+ | API成功/失敗レート |
| **API応答時間** | 2.5s | 1.0s以下 | モニタリングツール |
| **エラー発生率** | 15% | 5%以下 | エラーログ集計 |
| **ユーザー満足度** | - | 4.0/5.0 | ユーザーアンケート |

### 5.5.2 移行完了基準

- [ ] 全機能の動作確認完了
- [ ] 性能基準達成
- [ ] エラー率目標達成
- [ ] ユーザー教育完了
- [ ] 運用手順書完成
- [ ] 監視体制確立

## 5.6 長期運用

### 5.6.1 定期メンテナンス

```sql
-- 月次パフォーマンスレビュー
-- 1. インデックス最適化
REINDEX TABLE growing_tasks;
REINDEX TABLE work_reports;
REINDEX TABLE vegetables;

-- 2. 統計情報更新
ANALYZE growing_tasks;
ANALYZE work_reports;
ANALYZE vegetables;

-- 3. 不要データクリーンアップ
DELETE FROM operation_metrics 
WHERE created_at < NOW() - INTERVAL '6 months';
```

### 5.6.2 将来の拡張性

**シンプル認証モデルからの発展経路:**
1. **部分的権限復活**: 必要に応じてロール制御追加
2. **多拠点対応**: 拠点別データ分離
3. **API統合**: 外部システム連携
4. **高度な監査**: 個人レベルの操作追跡