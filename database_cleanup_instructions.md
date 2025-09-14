# データベース最適化 実行手順書

## 📋 概要
このドキュメントは、未使用のテーブルとカラムを削除してデータベースを最適化するための手順書です。

## ⚠️ 重要な注意事項

### 実行前チェックリスト
- [ ] **データベースの完全バックアップを取得**
- [ ] **ステージング環境でテスト実行**
- [ ] **アプリケーションを一時停止またはメンテナンスモードに設定**
- [ ] **実行時間を考慮（ユーザーが少ない時間帯を選択）**

## 🗑️ 削除対象一覧

### 削除するテーブル（4個）
1. `work_reports_backup_20250914` - 一時バックアップ
2. `vegetable_varieties` - 未使用の品種マスタ
3. `vegetable_deletion_audit` - 未使用の監査ログ
4. `spatial_ref_sys` - PostGIS標準テーブル（未使用）

### 削除するカラム（work_reportsテーブルから26個）
- **土壌分析詳細**（15個）: phosphorus_absorption, exchangeable_calcium など
- **重複カラム**（1個）: work_duration
- **未使用カラム**（10個）: photos, income_items, expense_items など

## 📝 実行手順

### Step 1: Supabaseダッシュボードにログイン
1. [Supabase Dashboard](https://app.supabase.com)にアクセス
2. 対象プロジェクトを選択
3. 左メニューから「SQL Editor」を選択

### Step 2: バックアップの作成
```sql
-- Supabase SQL Editorで実行
-- データベース全体のバックアップ（Supabaseの管理画面から実行）
-- Settings > Database > Backups から手動バックアップを作成
```

### Step 3: 段階的なSQL実行

#### Phase 1: バックアップテーブル削除（リスク: 低）
```sql
-- 一時バックアップテーブルを削除
DROP TABLE IF EXISTS work_reports_backup_20250914 CASCADE;
```
✅ 実行後、エラーがないことを確認

#### Phase 2: 未使用テーブル削除（リスク: 低）
```sql
-- 未使用テーブルを削除
DROP TABLE IF EXISTS vegetable_varieties CASCADE;
DROP TABLE IF EXISTS vegetable_deletion_audit CASCADE;
DROP TABLE IF EXISTS spatial_ref_sys CASCADE;
```
✅ 実行後、アプリケーションが正常動作することを確認

#### Phase 3: work_reportsカラム削除（リスク: 中）
```sql
-- 土壌分析の詳細カラムを削除
ALTER TABLE work_reports
  DROP COLUMN IF EXISTS phosphorus_absorption,
  DROP COLUMN IF EXISTS exchangeable_calcium,
  DROP COLUMN IF EXISTS exchangeable_magnesium,
  DROP COLUMN IF EXISTS exchangeable_potassium,
  DROP COLUMN IF EXISTS base_saturation,
  DROP COLUMN IF EXISTS calcium_magnesium_ratio,
  DROP COLUMN IF EXISTS magnesium_potassium_ratio,
  DROP COLUMN IF EXISTS available_silica,
  DROP COLUMN IF EXISTS humus_content,
  DROP COLUMN IF EXISTS ammonium_nitrogen,
  DROP COLUMN IF EXISTS nitrate_nitrogen,
  DROP COLUMN IF EXISTS manganese,
  DROP COLUMN IF EXISTS boron,
  DROP COLUMN IF EXISTS free_iron_oxide,
  DROP COLUMN IF EXISTS soil_notes;
```

```sql
-- 重複・未使用カラムを削除
ALTER TABLE work_reports
  DROP COLUMN IF EXISTS work_duration,
  DROP COLUMN IF EXISTS photos,
  DROP COLUMN IF EXISTS income_items,
  DROP COLUMN IF EXISTS expense_items,
  DROP COLUMN IF EXISTS income_total,
  DROP COLUMN IF EXISTS expense_total,
  DROP COLUMN IF EXISTS net_income,
  DROP COLUMN IF EXISTS work_amount,
  DROP COLUMN IF EXISTS work_unit,
  DROP COLUMN IF EXISTS fertilizer_type,
  DROP COLUMN IF EXISTS fertilizer_amount,
  DROP COLUMN IF EXISTS fertilizer_unit,
  DROP COLUMN IF EXISTS expected_revenue;
```
✅ 作業記録の登録・編集機能をテスト

#### Phase 4: データ型最適化（リスク: 低）
```sql
-- 数値型の精度を適切に設定
ALTER TABLE work_reports
  ALTER COLUMN temperature TYPE numeric(5,2),
  ALTER COLUMN harvest_amount TYPE numeric(10,2),
  ALTER COLUMN expected_price TYPE numeric(10,2),
  ALTER COLUMN duration_hours TYPE numeric(6,2);

ALTER TABLE vegetables
  ALTER COLUMN area_size TYPE numeric(10,2);

ALTER TABLE work_report_accounting
  ALTER COLUMN amount TYPE numeric(12,2);
```

#### Phase 5: インデックス追加（リスク: 低）
```sql
-- パフォーマンス改善用インデックス
CREATE INDEX IF NOT EXISTS idx_work_reports_company_vegetable
  ON work_reports(company_id, vegetable_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_work_reports_work_date
  ON work_reports(work_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_vegetables_company_status
  ON vegetables(company_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_growing_tasks_vegetable_status
  ON growing_tasks(vegetable_id, status)
  WHERE deleted_at IS NULL;
```

#### Phase 6: 統計情報更新
```sql
-- 統計情報を更新
ANALYZE vegetables;
ANALYZE work_reports;
ANALYZE growing_tasks;
ANALYZE photos;
ANALYZE work_report_accounting;
```

### Step 4: 動作確認

#### 確認クエリ実行
```sql
-- テーブルが削除されたことを確認
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('vegetable_varieties', 'vegetable_deletion_audit',
                     'spatial_ref_sys', 'work_reports_backup_20250914');
-- 期待値: 0

-- work_reportsのカラム数を確認
SELECT COUNT(*) FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'work_reports';
-- 期待値: 削除前より26個少ない

-- インデックスの確認
SELECT COUNT(*) FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('work_reports', 'vegetables', 'growing_tasks');
-- 期待値: 新規インデックスが追加されている
```

#### アプリケーション動作テスト
1. ✅ ログイン機能
2. ✅ 野菜一覧表示
3. ✅ 野菜新規登録
4. ✅ 作業記録登録
5. ✅ 作業記録編集
6. ✅ ガントチャート表示
7. ✅ 分析画面表示
8. ✅ 写真アップロード

### Step 5: 最終確認

```sql
-- データベースサイズの確認
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;
```

## 🚨 トラブルシューティング

### エラーが発生した場合

#### 1. 外部キー制約エラー
```sql
-- 制約を確認
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint
WHERE contype = 'f' AND confrelid::regclass::text LIKE '%削除対象テーブル名%';
```

#### 2. アプリケーションエラー
- エラーログを確認
- 削除したカラムを参照しているコードがないか確認
- 必要に応じてアプリケーションコードを修正

#### 3. ロールバック手順
バックアップから復元：
1. Supabase Dashboard > Settings > Database > Backups
2. 実行前に作成したバックアップを選択
3. 「Restore」をクリック

## 📊 期待される効果

### パフォーマンス改善
- **ストレージ**: 約30%削減
- **クエリ速度**: 20-50%向上
- **メンテナンス性**: 大幅改善

### 削減内容
- **テーブル**: 4個削除
- **カラム**: 26個削除（work_reports）
- **データ型**: 最適化により10-20%メモリ削減

## ✅ 完了チェックリスト

- [ ] すべてのSQLが正常に実行された
- [ ] アプリケーションの全機能が正常動作
- [ ] パフォーマンスが改善された
- [ ] エラーログにエラーがない
- [ ] ユーザーからの問題報告がない

## 📞 サポート

問題が発生した場合：
1. エラーログを保存
2. 実行したSQLを記録
3. バックアップから復元を検討

---

実行日時: _______________
実行者: _______________
確認者: _______________