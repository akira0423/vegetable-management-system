# Supabase Direct PostgreSQL Backup Script
# Supabase CLIのDockerエラーを回避するための直接バックアップ

# 必要な情報を環境変数から取得
$SUPABASE_DB_URL = $env:DATABASE_URL
if (-not $SUPABASE_DB_URL) {
    Write-Host "❌ DATABASE_URL環境変数が設定されていません" -ForegroundColor Red
    Write-Host "以下の形式で設定してください:" -ForegroundColor Yellow
    Write-Host 'postgres://postgres:[YOUR-PASSWORD]@db.rsofuafiacwygmfkcrrk.supabase.co:5432/postgres' -ForegroundColor Cyan
    exit 1
}

# 日付フォーマット
$date = Get-Date -Format "yyyyMMdd_HHmmss"
$backupPath = ".\supabase\backups\schema\schema_$date.sql"

Write-Host "🔄 Supabaseスキーマバックアップ開始..." -ForegroundColor Green
Write-Host "📁 保存先: $backupPath" -ForegroundColor Cyan

# pg_dumpを使用してバックアップ（スキーマのみ）
# 注意: pg_dumpがインストールされている必要があります
$pgDumpCommand = "pg_dump"
$arguments = @(
    $SUPABASE_DB_URL,
    "--schema-only",
    "--no-owner",
    "--no-privileges",
    "--schema=public",
    "--schema=auth",
    "--schema=storage",
    "-f", $backupPath
)

try {
    & $pgDumpCommand $arguments

    if ($?) {
        $fileSize = (Get-Item $backupPath).Length / 1KB
        Write-Host "✅ バックアップ完了！(サイズ: $([math]::Round($fileSize, 2)) KB)" -ForegroundColor Green

        # 最新版として複製
        Copy-Item $backupPath ".\supabase\backups\schema\latest.sql" -Force
        Write-Host "📌 latest.sqlも更新しました" -ForegroundColor Yellow
    } else {
        Write-Host "❌ バックアップ失敗" -ForegroundColor Red
    }
} catch {
    Write-Host "⚠️ pg_dumpが見つかりません。PostgreSQLクライアントをインストールしてください。" -ForegroundColor Yellow
    Write-Host "インストール方法:" -ForegroundColor Cyan
    Write-Host "1. https://www.postgresql.org/download/windows/ からダウンロード" -ForegroundColor White
    Write-Host "2. またはpsqlツールのみ: choco install postgresql --params '/Password:postgres'" -ForegroundColor White
}