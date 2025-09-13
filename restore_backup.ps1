# Supabase バックアップ復元スクリプト
# 実行: .\restore_backup.ps1
# 警告: 既存のデータベースを上書きします！

Write-Host "================================================" -ForegroundColor Red
Write-Host "  Supabase バックアップ復元ツール" -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Red
Write-Host ""
Write-Host "⚠️  警告: このスクリプトは既存のデータベースを上書きします！" -ForegroundColor Red
Write-Host ""

# バックアップファイルの一覧表示
Write-Host "📂 利用可能なバックアップファイル:" -ForegroundColor Cyan
Write-Host ""

Write-Host "[スキーマバックアップ]" -ForegroundColor Green
$schemaBackups = Get-ChildItem -Path ".\supabase\backups\schema\*.sql" | Sort-Object LastWriteTime -Descending
$i = 1
foreach ($backup in $schemaBackups) {
    $sizeKB = [math]::Round($backup.Length / 1KB, 2)
    Write-Host "$i. $($backup.Name) - $sizeKB KB - $($backup.LastWriteTime)" -ForegroundColor White
    $i++
}

Write-Host ""
Write-Host "[完全バックアップ]" -ForegroundColor Yellow
$fullBackups = Get-ChildItem -Path ".\supabase\backups\full\*.sql" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
if ($fullBackups) {
    foreach ($backup in $fullBackups) {
        $sizeMB = [math]::Round($backup.Length / 1MB, 2)
        Write-Host "$i. $($backup.Name) - $sizeMB MB - $($backup.LastWriteTime)" -ForegroundColor White
        $i++
    }
} else {
    Write-Host "  完全バックアップは見つかりませんでした" -ForegroundColor Gray
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan

# バックアップファイルの選択
$selection = Read-Host "復元するバックアップ番号を選択 (またはキャンセルは'c')"

if ($selection -eq 'c') {
    Write-Host "復元をキャンセルしました" -ForegroundColor Gray
    exit
}

# 選択されたファイルを特定
$allBackups = @()
$allBackups += $schemaBackups
$allBackups += $fullBackups

$selectedIndex = [int]$selection - 1
if ($selectedIndex -lt 0 -or $selectedIndex -ge $allBackups.Count) {
    Write-Host "❌ 無効な選択です" -ForegroundColor Red
    exit
}

$selectedBackup = $allBackups[$selectedIndex]
Write-Host ""
Write-Host "選択されたファイル: $($selectedBackup.Name)" -ForegroundColor Cyan

# 復元方法の選択
Write-Host ""
Write-Host "復元方法を選択してください:" -ForegroundColor Yellow
Write-Host "1. Supabase CLIを使用（推奨）" -ForegroundColor White
Write-Host "2. psqlを直接使用（要PostgreSQLクライアント）" -ForegroundColor White
Write-Host "3. SQLファイルの内容を表示（手動実行用）" -ForegroundColor White

$method = Read-Host "選択 (1-3)"

Write-Host ""
Write-Host "⚠️  最終確認:" -ForegroundColor Red
Write-Host "  復元ファイル: $($selectedBackup.Name)" -ForegroundColor White
Write-Host "  これにより既存のデータベースが上書きされます！" -ForegroundColor Red
Write-Host ""

$confirm = Read-Host "本当に続行しますか？ 'yes' と入力して確認"

if ($confirm -ne 'yes') {
    Write-Host "復元をキャンセルしました" -ForegroundColor Gray
    exit
}

Write-Host ""
Write-Host "🔄 復元を開始します..." -ForegroundColor Yellow

switch ($method) {
    "1" {
        # Supabase CLIを使用
        Write-Host "Supabase CLIを使用して復元します..." -ForegroundColor Cyan
        Write-Host "注意: データベースパスワードの入力が必要です" -ForegroundColor Yellow
        Write-Host ""

        # まずデータベースをリセット
        Write-Host "データベースをリセット中..." -ForegroundColor Gray
        supabase db reset --linked

        # SQLファイルを実行
        Write-Host "バックアップを適用中..." -ForegroundColor Gray
        Get-Content $selectedBackup.FullName | supabase db push --linked

        if ($?) {
            Write-Host "✅ 復元が完了しました！" -ForegroundColor Green
        } else {
            Write-Host "❌ 復元中にエラーが発生しました" -ForegroundColor Red
        }
    }
    "2" {
        # psqlを直接使用
        Write-Host "psqlを使用して復元します..." -ForegroundColor Cyan

        $dbUrl = Read-Host "DATABASE_URL接続文字列を入力"

        if ($dbUrl) {
            psql $dbUrl -f $selectedBackup.FullName

            if ($?) {
                Write-Host "✅ 復元が完了しました！" -ForegroundColor Green
            } else {
                Write-Host "❌ 復元中にエラーが発生しました" -ForegroundColor Red
                Write-Host "psqlがインストールされていることを確認してください" -ForegroundColor Yellow
            }
        } else {
            Write-Host "接続文字列が入力されませんでした" -ForegroundColor Red
        }
    }
    "3" {
        # SQLファイルの内容を表示
        Write-Host "以下のSQLをSupabaseダッシュボードのSQL Editorで実行してください:" -ForegroundColor Cyan
        Write-Host "================================================" -ForegroundColor Gray

        # ファイルの最初の100行を表示
        Get-Content $selectedBackup.FullName -First 100 | ForEach-Object { Write-Host $_ }

        Write-Host "================================================" -ForegroundColor Gray
        Write-Host "... (残りは $($selectedBackup.FullName) を参照)" -ForegroundColor Gray
        Write-Host ""
        Write-Host "📋 ファイルパス: $($selectedBackup.FullName)" -ForegroundColor Yellow
        Write-Host "Supabaseダッシュボード > SQL Editor で実行してください" -ForegroundColor Cyan
    }
    default {
        Write-Host "❌ 無効な選択です" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  復元プロセス完了" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan