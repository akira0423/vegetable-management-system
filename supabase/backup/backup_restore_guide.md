# データベースバックアップ・復元ガイド

## 作成日: 2025年9月15日

## 現在のGitコミット情報
- コミットハッシュ: 0607ad2
- メッセージ: バックアップコミット: 2025年9月15日

## 1. コードの復元方法

### 1.1 現在の状態に戻す場合
```bash
# 特定のコミットに戻す
git checkout 0607ad2

# または、ブランチを作成して作業
git checkout -b backup-20250915 0607ad2
```

### 1.2 変更を破棄して完全に戻す場合
```bash
# 現在の変更を破棄して特定のコミットに戻す
git reset --hard 0607ad2
```

## 2. Supabaseデータベース構造のバックアップ

### 2.1 Supabase Dashboardからバックアップ（推奨）

1. [Supabase Dashboard](https://app.supabase.com) にログイン
2. プロジェクトを選択
3. 左メニューから「Database」→「Backups」を選択
4. 「Create backup」をクリック
5. バックアップ名を「backup_20250915」として作成

### 2.2 SQL Editorを使用したエクスポート

Supabase SQL Editorで以下のクエリを実行して、各テーブルの構造を確認・保存：

```sql
-- テーブル構造の確認
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- 外部キー制約の確認
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public';
```

### 2.3 重要なテーブル一覧

以下のテーブルがシステムで使用されています：

- `companies` - 企業情報
- `vegetables` - 野菜マスタ
- `work_reports` - 作業記録
- `work_report_accounting` - 作業記録の会計情報
- `accounting_items` - 会計項目マスタ
- `soil_analyses` - 土壌分析データ
- `user_company_memberships` - ユーザー企業所属情報

## 3. マイグレーションファイルによる復元

### 3.1 現在適用されているマイグレーション

最新のマイグレーション:
- `044_drop_estimated_cost_column.sql` - estimated_costカラムの削除
- `045_migrate_duration_to_work_duration.sql` - duration_hoursからwork_durationへの移行

### 3.2 マイグレーションの実行
```bash
# ローカル環境でマイグレーションを実行
npx supabase migration up

# 本番環境にマイグレーションを適用
npx supabase db push
```

## 4. データ復元手順

### 4.1 Supabase Dashboardから復元

1. Supabase Dashboardにログイン
2. 「Database」→「Backups」を選択
3. 復元したいバックアップを選択
4. 「Restore」をクリック

### 4.2 SQLによる手動復元

重要なデータを個別に復元する場合：

```sql
-- 例: work_reportsテーブルの特定期間のデータを復元
-- バックアップから必要なINSERT文を実行
```

## 5. 環境変数の確認

`.env.local`ファイルに以下の環境変数が設定されていることを確認：

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## 6. 復元後の確認事項

1. **データベース接続の確認**
   ```bash
   npx supabase status
   ```

2. **アプリケーションの動作確認**
   ```bash
   npm run dev
   ```

3. **主要機能のテスト**
   - ログイン機能
   - データ表示（作業記録、ガントチャート、分析ページ）
   - データ登録・編集・削除

## 7. トラブルシューティング

### データベース接続エラーの場合
```bash
# Supabaseプロジェクトのリンクを再設定
npx supabase link --project-ref your_project_ref
```

### マイグレーションエラーの場合
```bash
# マイグレーション履歴を確認
npx supabase migration list

# 特定のマイグレーションまでロールバック
npx supabase migration repair --version 043
```

## 8. 連絡先

問題が発生した場合は、Gitリポジトリのissueで報告してください。

---

このドキュメントは定期的に更新してください。