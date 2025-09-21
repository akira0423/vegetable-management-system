# 📋 Phase 0 実行ガイド

## 🚨 エラー解決と正しい実行手順

### エラーの原因
`CREATE INDEX CONCURRENTLY cannot run inside a transaction block`

このエラーは、`CREATE INDEX CONCURRENTLY`がトランザクション内で実行できないために発生しました。

---

## ✅ 正しい実行手順

### 📝 準備
1. Supabase Dashboardにログイン
2. SQL Editorを開く
3. 実行前に**必ずデータベースのバックアップを取得**

```sql
-- バックアップ確認用（現在のポリシー数を記録）
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
```

---

## 🔧 Step 1: RLSポリシーの整理（5分）

### 実行ファイル: `phase0_fix_rls_policies.sql`

```bash
# Supabase SQL Editorで実行
# このファイルは全体を一度に実行可能（BEGIN...COMMIT）
```

**実行後の確認:**
```sql
-- ポリシー数が適切か確認（各テーブル5個以下になるはず）
SELECT
    tablename,
    COUNT(*) as policy_count,
    STRING_AGG(policyname, ', ') as policies
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN ('accounting_items', 'work_report_accounting', 'accounting_recommendations')
GROUP BY tablename
ORDER BY tablename;
```

期待される結果:
- accounting_items: 4ポリシー
- work_report_accounting: 1ポリシー
- accounting_recommendations: 1ポリシー

---

## 🔧 Step 2: 関数の最適化（3分）

### 実行ファイル: `phase0_optimize_functions.sql`

```bash
# Supabase SQL Editorで実行
# このファイルも全体を一度に実行可能（BEGIN...COMMIT）
```

**実行後の確認:**
```sql
-- 関数がSTABLEになっているか確認
SELECT
    proname AS function_name,
    CASE provolatile
        WHEN 'i' THEN 'IMMUTABLE'
        WHEN 's' THEN 'STABLE ✅'
        WHEN 'v' THEN 'VOLATILE ❌'
    END AS volatility
FROM pg_proc
WHERE proname IN ('get_current_company_id', 'is_service_role')
AND pronamespace = 'public'::regnamespace;
```

期待される結果:
- get_current_company_id: STABLE ✅
- is_service_role: STABLE ✅

---

## 🔧 Step 3: インデックスの作成（10分）

### 実行ファイル: `phase0_create_indexes.sql`

⚠️ **重要: 以下のコマンドを一つずつ個別に実行**

```sql
-- 1. 最重要インデックス（これだけでも効果大）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_id_company
    ON users(id, company_id);

-- 実行完了を待つ（約10-30秒）
```

```sql
-- 2. work_reports用インデックス
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_reports_composite
    ON work_reports(company_id, work_date DESC, created_at DESC)
    WHERE deleted_at IS NULL;

-- 実行完了を待つ
```

```sql
-- 3. work_reports野菜別インデックス
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_reports_vegetable_date
    ON work_reports(vegetable_id, work_date DESC)
    WHERE deleted_at IS NULL;

-- 実行完了を待つ
```

```sql
-- 4. work_report_accounting用インデックス
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_report_accounting_composite
    ON work_report_accounting(work_report_id, accounting_item_id)
    INCLUDE (amount);

-- 実行完了を待つ
```

```sql
-- 5. その他のインデックス（オプション、後で実行可）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_report_accounting_item_amount
    ON work_report_accounting(accounting_item_id, amount);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounting_items_cost_type
    ON accounting_items(cost_type, id)
    INCLUDE (name, code);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounting_recommendations_company_work
    ON accounting_recommendations(company_id, work_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vegetables_company_status
    ON vegetables(company_id, status)
    WHERE deleted_at IS NULL;
```

```sql
-- 6. 最後に統計情報を更新（まとめて実行可）
ANALYZE users;
ANALYZE work_reports;
ANALYZE work_report_accounting;
ANALYZE accounting_items;
ANALYZE vegetables;
```

**実行後の確認:**
```sql
-- インデックスが作成されたか確認
SELECT
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid::regclass)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND idx_scan IS NOT NULL
ORDER BY tablename, indexname;
```

---

## 📊 パフォーマンス測定

### 実行前後で比較

```sql
-- テストクエリを実行して時間を測定
EXPLAIN (ANALYZE, BUFFERS)
SELECT
    wr.*,
    wra.*,
    ai.*
FROM work_reports wr
JOIN work_report_accounting wra ON wr.id = wra.work_report_id
JOIN accounting_items ai ON wra.accounting_item_id = ai.id
WHERE wr.company_id = get_current_company_id()
    AND wr.work_date >= '2024-01-01'
    AND wr.work_date <= '2024-12-31'
LIMIT 100;
```

期待される改善:
- 実行前: 1500-3000ms
- 実行後: 200-500ms（50-80%改善）

---

## 🎯 トラブルシューティング

### インデックス作成でエラーが出た場合

```sql
-- エラーが出たインデックスを確認
SELECT * FROM pg_stat_progress_create_index;

-- 既存のインデックスを確認
SELECT indexname FROM pg_indexes
WHERE tablename = 'テーブル名'
AND schemaname = 'public';

-- 必要に応じて削除してリトライ
DROP INDEX IF EXISTS インデックス名;
```

### RLSポリシーで問題が発生した場合

```sql
-- ロールバック用：元のポリシーを復元
-- fix_accounting_rls_policies.sqlの内容を実行
```

---

## ✅ 完了チェックリスト

- [ ] Step 1: RLSポリシー整理完了
- [ ] Step 2: 関数最適化完了
- [ ] Step 3: 重要インデックス作成完了
- [ ] パフォーマンス測定で改善確認
- [ ] アプリケーションの動作確認

---

## 📈 期待される成果

### 即座の改善
- API応答時間: **50-70%改善**
- インデックス使用率: **30%→70%**
- RLSチェック時間: **60%改善**

### 次のステップ
Phase 0完了後、以下を確認してからPhase 1へ進む:
1. グラフが正常に表示される
2. エラーログが減少
3. ユーザー体験が改善

---

## 📝 実行ログテンプレート

```text
実行日時: 2025-01-21 XX:XX
実行者: [名前]

Step 1 (RLSポリシー):
- 開始: XX:XX
- 完了: XX:XX
- 結果: [OK/NG]
- メモ:

Step 2 (関数最適化):
- 開始: XX:XX
- 完了: XX:XX
- 結果: [OK/NG]
- メモ:

Step 3 (インデックス):
- 開始: XX:XX
- 完了: XX:XX
- 作成数: X個
- メモ:

パフォーマンス測定:
- 改善前: XXXXms
- 改善後: XXXms
- 改善率: XX%
```