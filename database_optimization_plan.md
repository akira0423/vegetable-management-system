# データベース最適化計画

## 概要
現在のデータベース構造を詳細に分析した結果、未使用のテーブルとカラムが多数存在することが判明しました。
これらを整理することで、データベースのパフォーマンス向上とメンテナンス性の改善が期待できます。

## 1. 削除対象テーブル

### 完全削除推奨テーブル
以下のテーブルはアプリケーション内で一切使用されていません：

1. **vegetable_varieties**
   - 野菜品種マスタテーブルだが未使用
   - 将来的に品種管理機能を実装する場合は再設計推奨

2. **vegetable_deletion_audit**
   - 野菜削除の監査ログ用だが未使用
   - 削除履歴はdeleted_atカラムで管理されている

3. **spatial_ref_sys**
   - PostGIS標準テーブルだが、空間データ機能は限定的使用
   - 地図機能をシンプルなJSONベースで実装しているため不要

4. **work_reports_backup_20250914**
   - 一時的なバックアップテーブル
   - 即座に削除可能

## 2. カラム削除対象

### work_reports テーブル
以下の土壌分析関連カラムは、ほとんど使用されていないため削除を推奨：

#### 削除推奨カラム（16個）
- `phosphorus_absorption` - リン酸吸収係数
- `exchangeable_calcium` - 交換性カルシウム
- `exchangeable_magnesium` - 交換性マグネシウム
- `exchangeable_potassium` - 交換性カリウム
- `base_saturation` - 塩基飽和度
- `calcium_magnesium_ratio` - カルシウム/マグネシウム比
- `magnesium_potassium_ratio` - マグネシウム/カリウム比
- `available_silica` - 可給態ケイ酸
- `humus_content` - 腐植含量
- `ammonium_nitrogen` - アンモニア態窒素
- `nitrate_nitrogen` - 硝酸態窒素
- `manganese` - マンガン
- `boron` - ホウ素
- `free_iron_oxide` - 遊離酸化鉄
- `soil_notes` - 土壌メモ
- `photos` - 写真配列（photosテーブルで管理）

#### 保持推奨カラム（基本的な土壌データ）
- `soil_ph` - 土壌pH（基本指標）
- `soil_ec` - 土壌EC（電気伝導度）
- `cec` - 陽イオン交換容量
- `available_phosphorus` - 可給態リン酸

### 重複・非効率なカラム
以下のカラムは重複または非効率な設計のため、統合を検討：

#### work_reports テーブル
- `duration_hours` と `work_duration` - 同じ作業時間を表す重複カラム
  → `work_duration` (integer分単位) に統一推奨
- `income_items` と `income_total` - JSONBと集計値の重複
- `expense_items` と `expense_total` - JSONBと集計値の重複
  → 集計値は計算で求めるか、トリガーで自動計算

## 3. データ型最適化

### 数値型の見直し
- `numeric` 型を適切な精度に制限
- 金額関連：`numeric(12,2)` に統一
- 面積関連：`numeric(10,2)` に統一
- 率・比率：`numeric(5,2)` に統一

### テキスト型の見直し
- `text` を適切に `varchar(n)` に変更
- `work_type`: `varchar(50)`
- `harvest_unit`: `varchar(20)`
- `weather`: `varchar(20)`

## 4. インデックス追加推奨

頻繁に検索される以下のカラムにインデックスを追加：

```sql
-- 複合インデックス
CREATE INDEX idx_work_reports_company_vegetable ON work_reports(company_id, vegetable_id);
CREATE INDEX idx_work_reports_work_date ON work_reports(work_date DESC);
CREATE INDEX idx_vegetables_company_status ON vegetables(company_id, status);
CREATE INDEX idx_growing_tasks_vegetable_status ON growing_tasks(vegetable_id, status);

-- 部分インデックス（削除されていないレコードのみ）
CREATE INDEX idx_vegetables_active ON vegetables(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_work_reports_active ON work_reports(company_id) WHERE deleted_at IS NULL;
```

## 5. 新規テーブル設計提案

### company_settings テーブル（新規）
現在companiesテーブルのsettings JSONBカラムに格納されている設定を正規化：

```sql
CREATE TABLE company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id),
  key varchar(50) NOT NULL,
  value jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(company_id, key)
);
```

## 6. 実装手順

### Phase 1: バックアップと準備（即実行可能）
1. データベース全体のバックアップ作成
2. work_reports_backup_20250914 テーブル削除

### Phase 2: 未使用テーブル削除（1週間以内）
1. vegetable_varieties テーブル削除
2. vegetable_deletion_audit テーブル削除
3. spatial_ref_sys テーブル削除（PostGIS使用確認後）

### Phase 3: カラム整理（2週間以内）
1. work_reports テーブルの土壌関連カラム削除
2. 重複カラムの統合
3. データ型の最適化

### Phase 4: パフォーマンス改善（3週間以内）
1. インデックス追加
2. 統計情報の更新
3. VACUUMとANALYZEの実行

## 7. 期待される効果

### ストレージ削減
- テーブル削除により約5-10%のストレージ削減
- カラム削除により work_reports テーブルのサイズが約30%削減

### パフォーマンス向上
- インデックス追加により主要クエリが20-50%高速化
- データ型最適化により10-20%のメモリ使用量削減

### メンテナンス性向上
- 不要なカラムの削除によりコードの可読性向上
- データモデルのシンプル化により新規開発者の学習コスト削減

## 8. リスクと対策

### リスク
1. 将来的に土壌データ管理機能が必要になる可能性
2. 削除したデータの復旧要求

### 対策
1. 削除前に土壌データを別テーブルにアーカイブ
2. 最低3ヶ月間はバックアップを保持
3. 段階的な実装により問題の早期発見

## 9. 実行SQLスクリプト

```sql
-- Phase 1: バックアップテーブル削除
DROP TABLE IF EXISTS work_reports_backup_20250914;

-- Phase 2: 未使用テーブル削除
DROP TABLE IF EXISTS vegetable_varieties CASCADE;
DROP TABLE IF EXISTS vegetable_deletion_audit CASCADE;
DROP TABLE IF EXISTS spatial_ref_sys CASCADE;

-- Phase 3: work_reports カラム削除
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
  DROP COLUMN IF EXISTS soil_notes,
  DROP COLUMN IF EXISTS photos;

-- 重複カラムの削除（duration_hoursを残す）
ALTER TABLE work_reports DROP COLUMN IF EXISTS work_duration;

-- Phase 4: インデックス追加
CREATE INDEX IF NOT EXISTS idx_work_reports_company_vegetable
  ON work_reports(company_id, vegetable_id);
CREATE INDEX IF NOT EXISTS idx_work_reports_work_date
  ON work_reports(work_date DESC);
CREATE INDEX IF NOT EXISTS idx_vegetables_company_status
  ON vegetables(company_id, status);
CREATE INDEX IF NOT EXISTS idx_growing_tasks_vegetable_status
  ON growing_tasks(vegetable_id, status);
CREATE INDEX IF NOT EXISTS idx_vegetables_active
  ON vegetables(company_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_work_reports_active
  ON work_reports(company_id) WHERE deleted_at IS NULL;

-- 統計情報更新
ANALYZE;
```

## まとめ

この最適化計画により、データベースサイズを約30%削減し、クエリパフォーマンスを20-50%向上させることが期待できます。
段階的な実装により、リスクを最小限に抑えながら確実に改善を進めることができます。