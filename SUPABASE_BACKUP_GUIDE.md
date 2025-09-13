# Supabase バックアップ・復元完全ガイド

## 📋 目次
1. [概要](#概要)
2. [クイックスタート](#クイックスタート)
3. [バックアップ方法](#バックアップ方法)
4. [復元方法](#復元方法)
5. [自動化設定](#自動化設定)
6. [トラブルシューティング](#トラブルシューティング)
7. [ベストプラクティス](#ベストプラクティス)

---

## 概要

このシステムは、Supabaseデータベースの完全なバックアップと復元を実現します。

### 🎯 主な機能
- ✅ **スキーマバックアップ** - テーブル構造、制約、インデックス、RLSポリシー
- ✅ **完全バックアップ** - スキーマ＋データ
- ✅ **自動バックアップ** - GitHub Actions連携
- ✅ **バージョン管理** - Git統合
- ✅ **簡単復元** - ワンクリック復元

### 📊 データベース構成（17テーブル）
- accounting_items（会計項目）
- accounting_recommendations（会計推奨）
- address_geocoding_cache（住所ジオコーディングキャッシュ）
- companies（企業情報）
- geography_columns（地理カラム - PostGIS）
- geometry_columns（ジオメトリカラム - PostGIS）
- growing_tasks（栽培タスク - 18カラム）
- photos（写真データ - 13カラム）
- plot_cells（区画セル - 16カラム）
- spatial_ref_sys（空間参照系 - PostGIS）
- users（ユーザー情報）
- vegetable_deletion_audit（野菜削除監査）
- vegetable_deletion_log（野菜削除ログ）
- vegetable_varieties（野菜品種 - 17カラム）
- vegetables（野菜データ - 23カラム）
- work_report_accounting（作業報告会計）
- work_reports（作業報告 - 55カラム）

---

## クイックスタート

### 🚀 初回セットアップ

```powershell
# 1. Supabase CLIの確認
supabase --version

# 2. プロジェクト接続
supabase link --project-ref rsofuafiacwygmfkcrrk

# 3. 初回バックアップ実行
.\backup_schema.ps1
```

### 📁 ディレクトリ構造

```
my-app/
├── backup_schema.ps1        # スキーマバックアップ
├── backup_full.ps1          # 完全バックアップ
├── restore_backup.ps1       # 復元スクリプト
├── supabase/
│   └── backups/
│       ├── schema/         # スキーマバックアップ保存先
│       ├── full/           # 完全バックアップ保存先
│       └── versions/       # バージョン管理
└── .github/
    └── workflows/
        └── supabase_backup.yml  # 自動バックアップ設定
```

---

## バックアップ方法

### 📝 スキーマのみバックアップ（推奨）

```powershell
# 実行
.\backup_schema.ps1

# パスワード入力プロンプトが表示されたら
# Supabaseダッシュボードのデータベースパスワードを入力
```

**特徴：**
- ファイルサイズが小さい（数百KB）
- Git管理に適している
- 高速実行
- テーブル構造、インデックス、RLSポリシーを保存

### 💾 完全バックアップ（データ含む）

```powershell
# 実行
.\backup_full.ps1

# 確認プロンプトで 'y' を入力
# パスワード入力
```

**特徴：**
- すべてのデータを含む
- ファイルサイズが大きい
- 完全復元が可能
- 機密データの取り扱いに注意

### 🔧 Supabase ダッシュボードからのバックアップ

1. Supabaseダッシュボードにログイン
2. 左側メニューから「**Database**」→「**Backups**」
3. 「**Create a new backup**」をクリック
4. バックアップ名を入力（例：`manual_backup_20250914`）
5. 「**Create backup**」をクリック
6. 完了後「**Download**」でダウンロード

---

## 復元方法

### 🔄 復元スクリプト使用

```powershell
# 実行
.\restore_backup.ps1

# 手順：
# 1. バックアップファイル一覧から選択
# 2. 復元方法を選択（1-3）
# 3. 'yes' と入力して確認
```

### 復元オプション

1. **Supabase CLI使用（推奨）**
   - 最も安全で確実
   - 自動でデータベースリセット

2. **psql直接使用**
   - PostgreSQLクライアント必要
   - 高速処理

3. **SQLファイル表示**
   - Supabaseダッシュボードで手動実行
   - 部分的な復元に適している

### ⚠️ 復元前の注意事項

- **必ず現在のデータをバックアップ**
- **開発環境でテスト**してから本番環境へ
- **ユーザーへの事前通知**を行う

### SQL Editorでの手動復元

1. Supabaseダッシュボード → SQL Editor
2. バックアップファイルの内容をコピー
3. SQL Editorに貼り付けて実行

---

## 自動化設定

### 🤖 GitHub Actions設定

#### 1. シークレット設定

GitHubリポジトリで以下を設定：

```
Settings > Secrets and variables > Actions > New repository secret

必要なシークレット：
- SUPABASE_ACCESS_TOKEN
- SUPABASE_DB_PASSWORD
```

#### 2. アクセストークン取得

```bash
# Supabaseダッシュボード
Account > Access Tokens > Generate new token
```

#### 3. 自動実行スケジュール

`.github/workflows/supabase_backup.yml`で設定済み：
- **毎日午前2時UTC（日本時間午前11時）**に自動実行
- **mainブランチへのプッシュ時**にスキーマ変更検出
- **手動実行**も可能（Actions タブから）

### 📅 Windows タスクスケジューラ設定

```powershell
# タスク作成（毎日午前3時に実行）
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
    -Argument "-File C:\work\my-app\backup_schema.ps1"

$trigger = New-ScheduledTaskTrigger -Daily -At 3:00AM

Register-ScheduledTask -TaskName "SupabaseBackup" `
    -Action $action -Trigger $trigger `
    -Description "Daily Supabase schema backup"
```

---

## トラブルシューティング

### ❌ よくあるエラーと解決方法

#### 1. Docker Desktop エラー

```
エラー: "failed to inspect docker image"
```

**解決方法：**
- Docker Desktopを起動
- または `--local` フラグを使用しない

#### 2. パスワードエラー

```
エラー: "authentication failed"
```

**解決方法：**
```powershell
# 再リンク
supabase link --project-ref rsofuafiacwygmfkcrrk

# パスワードリセット
# Supabaseダッシュボード > Settings > Database > Reset Password
```

#### 3. 権限エラー

```
エラー: "permission denied"
```

**解決方法：**
```powershell
# PowerShellを管理者として実行
# または実行ポリシー変更
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

#### 4. Supabase CLI未インストール

```
エラー: "supabase: command not found"
```

**解決方法：**
```powershell
# npm経由でインストール
npm install -g supabase

# またはScoopを使用（Windows）
scoop install supabase
```

---

## ベストプラクティス

### ✅ 推奨事項

1. **定期バックアップ**
   - スキーマ: 毎日
   - 完全: 週1回

2. **バージョン管理**
   - スキーマバックアップをGitで管理
   - 完全バックアップは`.gitignore`に追加

3. **セキュリティ**
   - バックアップファイルを暗号化
   - アクセス権限を制限
   - 機密データの取り扱い注意

4. **テスト**
   - 定期的に復元テスト実施
   - 開発環境で検証

5. **ドキュメント化**
   - スキーマ変更をCHANGELOG.mdに記録
   - 重要な変更は関係者に通知

### 📝 バックアップ戦略例

```powershell
# 日次（スキーマのみ）
.\backup_schema.ps1

# 週次（完全）
.\backup_full.ps1

# 月次（アーカイブ）
Compress-Archive -Path ".\supabase\backups\*" `
    -DestinationPath ".\archives\backup_$(Get-Date -Format 'yyyy-MM').zip"
```

### 🔐 セキュリティ設定

`.gitignore`に追加：
```
# Supabaseバックアップ
supabase/backups/full/*.sql
supabase/backups/**/*_full_*.sql
*.env
.env.local

# スキーマは含める
!supabase/backups/schema/
```

---

## 緊急時の対応

### 🚨 データ損失時の復旧手順

1. **状況確認**
   ```powershell
   # 最新バックアップ確認
   Get-ChildItem ".\supabase\backups\*" -Recurse |
     Sort-Object LastWriteTime -Descending |
     Select-Object -First 10
   ```

2. **復元実行**
   ```powershell
   # 復元スクリプト実行
   .\restore_backup.ps1
   ```

3. **検証**
   - データ整合性確認
   - アプリケーション動作テスト
   - ユーザー通知

### 📞 サポート

- **Supabaseダッシュボード**: https://supabase.com/dashboard/project/rsofuafiacwygmfkcrrk
- **ドキュメント**: https://supabase.com/docs
- **コミュニティ**: https://github.com/supabase/supabase/discussions

---

## 更新履歴

- **2024-09-14**: 初版作成
  - 17テーブル対応
  - PostGIS対応
  - GitHub Actions統合
  - PowerShellスクリプト作成

---

## ライセンス

このバックアップシステムは内部使用を目的としています。
機密データの取り扱いには十分注意してください。