# フェーズ4: 包括的テスト

## 4.1 機能テストマトリックス

| 機能 | テスト項目 | 期待結果 | 実行方法 |
|------|-----------|----------|----------|
| **計画タスク** | 作成 | ✅ 成功 | ガンチャートで新規作成 |
| | 更新 | ✅ 成功 | 進捗・日付変更 |
| | 削除 | ✅ 成功 | 削除ボタン→確認→削除 |
| | ページリロード後 | ✅ 削除タスク非表示 | F5でリロード |
| **実績記録** | 作成 | ✅ 成功 | 作業記録追加 |
| | 更新 | ✅ 成功 | 記録内容変更 |
| | 削除 | ✅ 成功 | 削除ボタン→削除 |
| | ページリロード後 | ✅ 削除記録非表示 | F5でリロード |
| **野菜管理** | 作成 | ✅ 成功 | 新規野菜追加 |
| | 更新 | ✅ 成功 | 野菜情報変更 |
| | 削除 | ✅ 成功 | 野菜削除 |

## 4.2 権限テスト

### 4.2.1 会社分離テスト

```sql
-- 他社データアクセステスト（失敗するべき）
-- テスト用他社データ作成
INSERT INTO companies (id, name) VALUES 
('b2222222-2222-2222-2222-222222222222', 'テスト他社');

INSERT INTO growing_tasks (
    id, company_id, vegetable_id, name, start_date, end_date,
    task_type, status, priority, created_by
) VALUES (
    'test-other-company-task',
    'b2222222-2222-2222-2222-222222222222',
    (SELECT id FROM vegetables LIMIT 1),
    '他社テストタスク',
    CURRENT_DATE,
    CURRENT_DATE + 7,
    'other',
    'pending',
    'medium',
    'd0efa1ac-7e7e-420b-b147-dabdf01454b7'
);

-- 自社からのアクセス確認（見えないはず）
SELECT COUNT(*) FROM growing_tasks 
WHERE company_id = 'b2222222-2222-2222-2222-222222222222';
-- 期待結果: 0（RLSにより他社データは見えない）
```

### 4.2.2 削除権限テスト

```javascript
// ブラウザコンソールで実行
// 1. 自社タスク削除（成功するはず）
fetch('/api/growing-tasks/自社タスクID', { method: 'DELETE' })
.then(r => r.json())
.then(result => {
    console.log('自社タスク削除:', result.success ? '成功' : '失敗');
});

// 2. 削除後の確認
setTimeout(() => {
    location.reload(); // ページリロード
}, 2000);
```

## 4.3 パフォーマンステスト

### 4.3.1 クエリパフォーマンス確認

```sql
-- 実行計画確認
EXPLAIN ANALYZE 
SELECT * FROM growing_tasks 
WHERE company_id = 'a1111111-1111-1111-1111-111111111111';

-- インデックス使用確認
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename IN ('growing_tasks', 'work_reports', 'vegetables')
ORDER BY idx_scan DESC;
```

### 4.3.2 大量データテスト

```sql
-- テスト用データ大量投入
INSERT INTO growing_tasks (
    company_id, vegetable_id, name, start_date, end_date,
    task_type, status, priority, created_by
)
SELECT 
    'a1111111-1111-1111-1111-111111111111',
    (SELECT id FROM vegetables LIMIT 1),
    'パフォーマンステスト' || generate_series,
    CURRENT_DATE + (generate_series % 365),
    CURRENT_DATE + (generate_series % 365) + 7,
    'other',
    'pending',
    'medium',
    'd0efa1ac-7e7e-420b-b147-dabdf01454b7'
FROM generate_series(1, 1000);

-- レスポンス時間測定
\timing on
SELECT COUNT(*) FROM growing_tasks;
\timing off
```

## 4.4 エラーハンドリングテスト

### 4.4.1 異常系テスト

```javascript
// 1. 存在しないID削除
fetch('/api/growing-tasks/non-existent-id', { method: 'DELETE' })
.then(r => r.json())
.then(result => {
    console.log('存在しないID削除:', result);
    // 期待: エラーメッセージ表示
});

// 2. 不正なデータ送信
fetch('/api/growing-tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invalid: 'data' })
})
.then(r => r.json())
.then(result => {
    console.log('不正データ送信:', result);
    // 期待: バリデーションエラー
});
```

## 4.5 テスト結果レポート

### 4.5.1 チェックリスト

- [ ] 計画タスク CRUD操作
- [ ] 実績記録 CRUD操作  
- [ ] 野菜管理 CRUD操作
- [ ] 会社データ分離
- [ ] 削除権限チェック
- [ ] パフォーマンス基準満足
- [ ] エラーハンドリング適切
- [ ] ページリロード後の状態確認

### 4.5.2 性能基準

- **API応答時間**: < 1秒
- **ページロード時間**: < 3秒
- **大量データ処理**: 1000件 < 5秒
- **同時アクセス**: 10ユーザー対応