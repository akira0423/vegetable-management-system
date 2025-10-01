# Q&Aプラットフォーム自動削除スクリプト (Windows PowerShell)
# 実行方法: PowerShellを管理者として実行し、.\remove-qa-platform.ps1

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Q&Aプラットフォーム切り離しツール" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 安全確認
$confirmation = Read-Host "Q&Aプラットフォームを完全に削除しますか？ (yes/no)"
if ($confirmation -ne 'yes') {
    Write-Host "処理を中止しました。" -ForegroundColor Yellow
    exit
}

Write-Host ""
Write-Host "[Step 1/5] 環境変数の無効化..." -ForegroundColor Yellow

# .env.local のバックアップ
Copy-Item ".env.local" ".env.local.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')" -ErrorAction SilentlyContinue

# 環境変数の更新
if (Test-Path ".env.local") {
    $content = Get-Content ".env.local"
    $newContent = @()
    foreach ($line in $content) {
        if ($line -match "^QA_ENABLE_PLATFORM=") {
            $newContent += "QA_ENABLE_PLATFORM=false"
        } elseif ($line -match "^QA_") {
            $newContent += "# $line"
        } else {
            $newContent += $line
        }
    }
    Set-Content ".env.local" $newContent
    Write-Host "✓ 環境変数を無効化しました" -ForegroundColor Green
}

Write-Host ""
Write-Host "[Step 2/5] コードのバックアップ..." -ForegroundColor Yellow

# バックアップディレクトリ作成
$backupDir = "qa_platform_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

# コードのバックアップ
$dirsToBackup = @(
    "src\app\qa",
    "src\components\qa",
    "src\lib\qa",
    "src\hooks\qa",
    "src\app\api\qa",
    "docs\qa-platform"
)

foreach ($dir in $dirsToBackup) {
    if (Test-Path $dir) {
        Copy-Item $dir -Destination "$backupDir\" -Recurse -ErrorAction SilentlyContinue
        Write-Host "✓ $dir をバックアップしました" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "[Step 3/5] Q&A関連コードの削除..." -ForegroundColor Yellow

# ディレクトリの削除
foreach ($dir in $dirsToBackup) {
    if (Test-Path $dir) {
        Remove-Item -Path $dir -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "✓ $dir を削除しました" -ForegroundColor Green
    }
}

# マイグレーションファイルの削除
Get-ChildItem -Path "supabase\migrations" -Filter "*qa*" -ErrorAction SilentlyContinue | ForEach-Object {
    Copy-Item $_.FullName -Destination "$backupDir\" -ErrorAction SilentlyContinue
    Remove-Item $_.FullName -Force
    Write-Host "✓ $($_.Name) を削除しました" -ForegroundColor Green
}

Write-Host ""
Write-Host "[Step 4/5] データベーススクリプトの生成..." -ForegroundColor Yellow

# データベース削除スクリプトの生成
$dbScript = @"
-- Q&Aプラットフォーム データベース削除スクリプト
-- 生成日時: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

-- 1. バックアップスキーマの作成
CREATE SCHEMA IF NOT EXISTS qa_backup_$(Get-Date -Format 'yyyyMMdd');

-- 2. データのバックアップ
CREATE TABLE qa_backup_$(Get-Date -Format 'yyyyMMdd').qa_questions AS SELECT * FROM qa_questions;
CREATE TABLE qa_backup_$(Get-Date -Format 'yyyyMMdd').qa_answers AS SELECT * FROM qa_answers;
CREATE TABLE qa_backup_$(Get-Date -Format 'yyyyMMdd').qa_user_profiles AS SELECT * FROM qa_user_profiles;
CREATE TABLE qa_backup_$(Get-Date -Format 'yyyyMMdd').qa_purchases AS SELECT * FROM qa_purchases;
CREATE TABLE qa_backup_$(Get-Date -Format 'yyyyMMdd').qa_wallets AS SELECT * FROM qa_wallets;
CREATE TABLE qa_backup_$(Get-Date -Format 'yyyyMMdd').qa_wallet_transactions AS SELECT * FROM qa_wallet_transactions;
CREATE TABLE qa_backup_$(Get-Date -Format 'yyyyMMdd').qa_access_grants AS SELECT * FROM qa_access_grants;
CREATE TABLE qa_backup_$(Get-Date -Format 'yyyyMMdd').qa_payouts AS SELECT * FROM qa_payouts;
CREATE TABLE qa_backup_$(Get-Date -Format 'yyyyMMdd').qa_invoices AS SELECT * FROM qa_invoices;
CREATE TABLE qa_backup_$(Get-Date -Format 'yyyyMMdd').qa_notifications AS SELECT * FROM qa_notifications;
CREATE TABLE qa_backup_$(Get-Date -Format 'yyyyMMdd').qa_reputation AS SELECT * FROM qa_reputation;
CREATE TABLE qa_backup_$(Get-Date -Format 'yyyyMMdd').qa_audit_logs AS SELECT * FROM qa_audit_logs;

-- 3. トリガーの削除
DROP TRIGGER IF EXISTS update_qa_user_profiles_updated_at ON qa_user_profiles;
DROP TRIGGER IF EXISTS update_qa_questions_updated_at ON qa_questions;
DROP TRIGGER IF EXISTS update_qa_answers_updated_at ON qa_answers;
DROP TRIGGER IF EXISTS update_qa_wallets_updated_at ON qa_wallets;

-- 4. 関数の削除
DROP FUNCTION IF EXISTS generate_invoice_no();
DROP FUNCTION IF EXISTS check_question_access(UUID, UUID);
DROP FUNCTION IF EXISTS update_wallet_balance(UUID, DECIMAL, VARCHAR, VARCHAR, UUID, TEXT);

-- 5. ビューの削除
DROP VIEW IF EXISTS qa_questions_summary;
DROP VIEW IF EXISTS qa_user_stats;

-- 6. テーブルの削除
DROP TABLE IF EXISTS qa_audit_logs CASCADE;
DROP TABLE IF EXISTS qa_reputation CASCADE;
DROP TABLE IF EXISTS qa_notifications CASCADE;
DROP TABLE IF EXISTS qa_invoices CASCADE;
DROP TABLE IF EXISTS qa_payouts CASCADE;
DROP TABLE IF EXISTS qa_access_grants CASCADE;
DROP TABLE IF EXISTS qa_wallet_transactions CASCADE;
DROP TABLE IF EXISTS qa_wallets CASCADE;
DROP TABLE IF EXISTS qa_purchases CASCADE;
DROP TABLE IF EXISTS qa_answers CASCADE;
DROP TABLE IF EXISTS qa_questions CASCADE;
DROP TABLE IF EXISTS qa_user_profiles CASCADE;

-- 7. 列挙型の削除
DROP TYPE IF EXISTS qa_question_status CASCADE;
DROP TYPE IF EXISTS qa_answer_status CASCADE;
DROP TYPE IF EXISTS qa_payment_type CASCADE;
DROP TYPE IF EXISTS qa_payout_status CASCADE;
DROP TYPE IF EXISTS qa_access_reason CASCADE;

-- 8. 確認
SELECT 'Q&Aプラットフォームのデータベース削除完了: ' || NOW() as status;
"@

Set-Content "$backupDir\remove_qa_database.sql" $dbScript
Write-Host "✓ データベース削除スクリプトを生成しました" -ForegroundColor Green
Write-Host "  場所: $backupDir\remove_qa_database.sql" -ForegroundColor Gray

Write-Host ""
Write-Host "[Step 5/5] クリーンアップ..." -ForegroundColor Yellow

# .nextキャッシュのクリア
if (Test-Path ".next") {
    Remove-Item -Path ".next" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "✓ .nextキャッシュをクリアしました" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " 削除完了！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "バックアップ場所: $backupDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "次のステップ:" -ForegroundColor Yellow
Write-Host "1. Supabaseダッシュボードでデータベーススクリプトを実行" -ForegroundColor White
Write-Host "   $backupDir\remove_qa_database.sql" -ForegroundColor Gray
Write-Host ""
Write-Host "2. アプリケーションを再起動" -ForegroundColor White
Write-Host "   npm run build" -ForegroundColor Gray
Write-Host "   npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "復元が必要な場合:" -ForegroundColor Yellow
Write-Host "  バックアップフォルダ内のファイルを元の場所に戻してください" -ForegroundColor Gray
Write-Host ""

# ログファイルの作成
$logContent = @"
Q&Aプラットフォーム削除ログ
実行日時: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
実行者: $env:USERNAME
バックアップ場所: $backupDir
削除されたディレクトリ:
$(foreach ($dir in $dirsToBackup) { if (Test-Path $dir) { "  - $dir" } })
"@

Set-Content "$backupDir\removal_log.txt" $logContent

Write-Host "処理が完了しました。" -ForegroundColor Green