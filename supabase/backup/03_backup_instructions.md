# Supabaseデータベース バックアップ手順

## 実行日: 2025-09-15

このドキュメントは、Supabase無料プランでデータベースの完全バックアップを取る手順を説明します。

## 📋 バックアップ手順

### ステップ1: スキーマのバックアップ

1. Supabaseダッシュボードにログイン
2. 左メニューから「SQL Editor」を選択
3. `01_export_schema.sql`の内容を1つずつ実行
4. 各クエリの結果を以下のファイル名で保存：
   - `schema_tables.json`
   - `schema_indexes.json`
   - `schema_foreign_keys.json`
   - `schema_policies.json`
   - `schema_rls_enabled.json`
   - `schema_functions.json`
   - `schema_triggers.json`
   - `schema_views.json`
   - `schema_sequences.json`
   - `schema_permissions.json`

### ステップ2: データのバックアップ

1. SQL Editorで`02_export_data.sql`の内容を実行
2. 各テーブルのJSON結果を以下のファイル名で保存：
   - `data_companies.json`
   - `data_users.json`
   - `data_vegetables.json`
   - `data_plots.json`
   - `data_tasks.json`
   - `data_work_reports.json`
   - `data_work_accounting.json`
   - `data_work_accounting_items.json`
   - `data_work_report_comments.json`
   - `data_work_report_images.json`
   - `data_notifications.json`

### ステップ3: Storage（画像）のバックアップ

1. Supabaseダッシュボードの「Storage」セクションへ移動
2. 各バケット（work-report-images等）を開く
3. フォルダごとにダウンロード
4. ローカルの`supabase/backup/storage/`フォルダに保存

### ステップ4: 環境変数のバックアップ

`.env.local`ファイルをコピーして安全な場所に保管
（GitHubにはアップロードしないこと）

## 🔄 リストア手順

### データベースの復元

1. 新しいSupabaseプロジェクトを作成
2. SQL Editorで以下の順番で実行：
   - テーブル作成SQL
   - インデックス作成SQL
   - 外部キー制約SQL
   - RLS有効化SQL
   - ポリシー作成SQL
   - 関数・トリガー作成SQL

### データの復元

```sql
-- JSONデータからテーブルへの挿入例
INSERT INTO companies
SELECT * FROM json_populate_recordset(null::companies,
  '[保存したJSONデータをここに貼り付け]'
);
```

### Storageの復元

1. Supabaseダッシュボードでバケットを作成
2. 保存した画像ファイルをアップロード

## 🔐 セキュリティ注意事項

- バックアップファイルには機密情報が含まれます
- 暗号化されたストレージに保存してください
- 定期的にバックアップを取ることを推奨（週1回以上）
- `.env.local`ファイルは絶対にGitHubにアップロードしないでください

## 📝 バックアップチェックリスト

- [ ] スキーマ定義のエクスポート完了
- [ ] 全テーブルデータのエクスポート完了
- [ ] Storage画像のダウンロード完了
- [ ] 環境変数のバックアップ完了
- [ ] バックアップファイルを安全な場所に保存
- [ ] バックアップ日時を記録

## 🚀 自動化スクリプト（オプション）

Node.jsスクリプトを使用した自動バックアップも可能です。
`supabase/backup/auto_backup.js`を参照してください。