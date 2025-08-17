# work_reportsテーブル拡張マイグレーション手順

## 問題の根本原因

1. **数値制限エラー**: `duration_hours`が`DECIMAL(4,2)`（最大99.99）のため、長時間作業でオーバーフロー
2. **フィールド不足**: フォームが送信する多くのフィールド（harvest_amount, expected_revenue等）がテーブルに存在しない
3. **データ損失**: 貴重な農業データが保存されずに失われている

## 解決方法

### 手順1: Subase Dashboardでマイグレーション実行

1. [Supabase Dashboard](https://supabase.com/dashboard/projects/rsofuafiacwygmfkcrrk) にアクセス
2. SQL Editor を開く
3. 以下のSQLを実行:

```sql
-- 既存フィールドの数値制限修正
ALTER TABLE work_reports 
  ALTER COLUMN duration_hours TYPE decimal(6,2);

-- 収穫データフィールド追加
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS harvest_amount decimal(8,2);
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS harvest_unit varchar(20);
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS harvest_quality varchar(20);
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS expected_price decimal(8,2);
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS expected_revenue decimal(12,2);

-- 作業データフィールド追加
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS work_amount decimal(8,2);
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS work_unit varchar(20);
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS work_duration integer;
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS worker_count integer DEFAULT 1;

-- 肥料データフィールド追加
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS fertilizer_type varchar(100);
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS fertilizer_amount decimal(8,2);
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS fertilizer_unit varchar(20);

-- 環境・土壌データフィールド追加
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS soil_ph decimal(3,1);
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS soil_moisture decimal(5,2);
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS soil_temperature decimal(4,1);
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS temperature_morning decimal(4,1);
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS temperature_afternoon decimal(4,1);
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS humidity decimal(5,2);

-- コスト管理フィールド追加
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS estimated_cost decimal(10,2);

-- 削除管理フィールド追加（ソフトデリート対応）
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS deletion_reason text;
```

### 手順2: 動作確認

マイグレーション実行後、以下のテストを実行:

```bash
cd C:\work\my-app
node simple-migration-test.js
```

### 手順3: アプリケーションテスト

1. `npm run dev` でアプリケーション起動
2. ダッシュボード → ガントチャート → 「新規作業記録」
3. 収穫作業でテストデータ入力:
   - 収穫量: 15.5kg
   - 想定単価: 200円
   - 想定売上高: 3100円（自動計算）
   - 作業時間: 120分
4. 保存ボタンクリック
5. エラーなく保存されることを確認

## 数値フィールドの仕様

| フィールド | データ型 | 最大値 | 用途 |
|---|---|---|---|
| duration_hours | DECIMAL(6,2) | 9999.99時間 | 作業時間 |
| harvest_amount | DECIMAL(8,2) | 999,999.99kg | 収穫量 |
| expected_price | DECIMAL(8,2) | 999,999.99円 | 想定単価 |
| expected_revenue | DECIMAL(12,2) | 99億9999万円 | 想定売上高 |
| estimated_cost | DECIMAL(10,2) | 999,999万円 | 想定コスト |

## 分析機能への影響

マイグレーション完了後、以下の機能が正常に動作します:

1. 月別収穫量分析
2. 作業種別コスト分析
3. 野菜別収益性分析
4. ROI計算
5. 効率スコア算出

## トラブルシューティング

### 権限エラーの場合

```sql
-- テーブル所有者確認
SELECT tableowner FROM pg_tables WHERE tablename = 'work_reports';

-- 権限付与（必要に応じて）
GRANT ALL ON work_reports TO postgres;
GRANT ALL ON work_reports TO service_role;
```

### 制約エラーの場合

```sql
-- 制約確認
SELECT conname, contype, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'work_reports'::regclass;

-- CHECK制約追加
ALTER TABLE work_reports ADD CONSTRAINT chk_harvest_amount_positive 
  CHECK (harvest_amount IS NULL OR harvest_amount >= 0);
```

## 完了確認

以下の出力が表示されればマイグレーション成功:

```
✅ 拡張フィールドでのテストデータ挿入成功!
🎉 すべての拡張フィールドが正常に動作しています!
```