# Supabase 完全バックアップスクリプト（スキーマ＋データ）
# 実行: .\backup_full.ps1
# 警告: 大量のデータがある場合、時間がかかることがあります

$date = Get-Date -Format "yyyyMMdd_HHmmss"
$fullBackupPath = ".\supabase\backups\full\full_$date.sql"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Supabase 完全バックアップ（データ含む）" -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# 警告表示
Write-Host "⚠️  注意事項:" -ForegroundColor Yellow
Write-Host "  - このバックアップはデータも含みます" -ForegroundColor White
Write-Host "  - ファイルサイズが大きくなる可能性があります" -ForegroundColor White
Write-Host "  - 機密情報が含まれる場合は適切に管理してください" -ForegroundColor White
Write-Host ""

$confirm = Read-Host "続行しますか？ (y/n)"
if ($confirm -ne 'y') {
    Write-Host "バックアップをキャンセルしました" -ForegroundColor Gray
    exit
}

Write-Host ""
Write-Host "🔄 完全バックアップを開始します..." -ForegroundColor Yellow
Write-Host "📁 保存先: $fullBackupPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  パスワードを求められたら、Supabaseダッシュボードから" -ForegroundColor Yellow
Write-Host "   データベースパスワードを入力してください" -ForegroundColor Yellow
Write-Host ""

# 開始時刻を記録
$startTime = Get-Date

# 完全ダンプ実行（全スキーマ、データ含む）
supabase db dump -f $fullBackupPath --linked

if ($?) {
    # ファイルが作成されたか確認
    if (Test-Path $fullBackupPath) {
        $endTime = Get-Date
        $duration = $endTime - $startTime

        $fileSize = (Get-Item $fullBackupPath).Length
        $fileSizeKB = $fileSize / 1KB
        $fileSizeMB = $fileSize / 1MB

        Write-Host ""
        Write-Host "✅ 完全バックアップ完了！" -ForegroundColor Green

        # ファイルサイズに応じて表示を変更
        if ($fileSizeMB -gt 1) {
            Write-Host "📊 ファイルサイズ: $([math]::Round($fileSizeMB, 2)) MB" -ForegroundColor Cyan
        } else {
            Write-Host "📊 ファイルサイズ: $([math]::Round($fileSizeKB, 2)) KB" -ForegroundColor Cyan
        }

        Write-Host "⏱️  所要時間: $($duration.TotalSeconds) 秒" -ForegroundColor Gray

        # 最新版として複製（オプション）
        $copyLatest = Read-Host "latest_full.sqlとしても保存しますか？ (y/n)"
        if ($copyLatest -eq 'y') {
            Copy-Item $fullBackupPath ".\supabase\backups\full\latest_full.sql" -Force
            Write-Host "📌 latest_full.sqlも更新しました" -ForegroundColor Yellow
        }

        # バックアップ内容の統計
        Write-Host ""
        Write-Host "📈 バックアップ統計:" -ForegroundColor Cyan
        $lineCount = (Get-Content $fullBackupPath | Measure-Object -Line).Lines
        Write-Host "  総行数: $lineCount 行" -ForegroundColor Gray

        $tableCount = (Select-String -Path $fullBackupPath -Pattern "CREATE TABLE" -AllMatches).Matches.Count
        Write-Host "  テーブル数: $tableCount" -ForegroundColor Gray

        $insertCount = (Select-String -Path $fullBackupPath -Pattern "INSERT INTO" -AllMatches).Matches.Count
        Write-Host "  INSERTステートメント数: $insertCount" -ForegroundColor Gray

        Write-Host ""
        Write-Host "================================================" -ForegroundColor Cyan
        Write-Host "  完全バックアップ成功" -ForegroundColor Green
        Write-Host "================================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "💡 ヒント: このファイルは.gitignoreに追加することを推奨します" -ForegroundColor Yellow
    } else {
        Write-Host "❌ バックアップファイルが作成されませんでした" -ForegroundColor Red
    }
} else {
    Write-Host ""
    Write-Host "❌ バックアップに失敗しました" -ForegroundColor Red
    Write-Host ""
    Write-Host "トラブルシューティング:" -ForegroundColor Yellow
    Write-Host "1. Docker Desktopが起動していることを確認" -ForegroundColor White
    Write-Host "2. supabase link --project-ref rsofuafiacwygmfkcrrk を再実行" -ForegroundColor White
    Write-Host "3. データベースパスワードが正しいことを確認" -ForegroundColor White
    Write-Host "4. ディスク容量が十分にあることを確認" -ForegroundColor White
}