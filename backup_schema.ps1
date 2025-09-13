# Supabase スキーマバックアップスクリプト
# 実行: .\backup_schema.ps1
# パスワード入力を求められたらSupabaseのデータベースパスワードを入力

$date = Get-Date -Format "yyyyMMdd_HHmmss"
$schemaBackupPath = ".\supabase\backups\schema\schema_$date.sql"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Supabase スキーマバックアップ" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Supabase CLIを使用してバックアップ
Write-Host "🔄 スキーマバックアップを開始します..." -ForegroundColor Yellow
Write-Host "📁 保存先: $schemaBackupPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  パスワードを求められたら、Supabaseダッシュボードから" -ForegroundColor Yellow
Write-Host "   データベースパスワードを入力してください" -ForegroundColor Yellow
Write-Host "   (Settings > Database > Database Password)" -ForegroundColor Gray
Write-Host ""

# スキーマダンプ実行（publicスキーマのみ、データなし）
supabase db dump -s public -f $schemaBackupPath --linked

if ($?) {
    # ファイルが作成されたか確認
    if (Test-Path $schemaBackupPath) {
        $fileSize = (Get-Item $schemaBackupPath).Length / 1KB
        Write-Host ""
        Write-Host "✅ バックアップ完了！" -ForegroundColor Green
        Write-Host "📊 ファイルサイズ: $([math]::Round($fileSize, 2)) KB" -ForegroundColor Cyan

        # 最新版として複製
        Copy-Item $schemaBackupPath ".\supabase\backups\schema\latest.sql" -Force
        Write-Host "📌 latest.sqlも更新しました" -ForegroundColor Yellow

        # バックアップファイルの内容を簡単に確認
        $lineCount = (Get-Content $schemaBackupPath | Measure-Object -Line).Lines
        Write-Host "📝 総行数: $lineCount 行" -ForegroundColor Gray

        # テーブル数をカウント
        $tableCount = (Select-String -Path $schemaBackupPath -Pattern "CREATE TABLE" -AllMatches).Matches.Count
        Write-Host "📋 テーブル数: $tableCount" -ForegroundColor Gray

        Write-Host ""
        Write-Host "================================================" -ForegroundColor Cyan
        Write-Host "  バックアップ成功" -ForegroundColor Green
        Write-Host "================================================" -ForegroundColor Cyan
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
}