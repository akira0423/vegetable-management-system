# 運用ドキュメント・操作手順書

## 1. システム運用概要

### 1.1 運用体制

```yaml
# 運用体制図
operation_structure:
  primary_operations:
    team: "インフラ・DevOpsチーム"
    members: 3
    responsibilities:
      - "システム監視・保守"
      - "デプロイメント管理"
      - "インシデント対応"
    
  secondary_support:
    team: "開発チーム"
    members: 5
    responsibilities:
      - "アプリケーション不具合修正"
      - "機能追加・改修"
      - "技術的サポート"

  business_support:
    team: "カスタマーサクセス"
    members: 2
    responsibilities:
      - "ユーザーサポート"
      - "利用状況分析"
      - "フィードバック収集"

# オンコール体制
on_call_schedule:
  primary: "24時間365日対応"
  rotation: "週次ローテーション"
  escalation_levels:
    level1: "オンコールエンジニア（応答時間：15分）"
    level2: "チームリード（応答時間：30分）"
    level3: "技術責任者（応答時間：1時間）"
```

### 1.2 運用フロー

#### operations/daily-operations.md
```markdown
# 日常運用フロー

## 📅 毎日のタスク

### 朝の運用チェック（9:00 AM）
- [ ] システム全体の健康状態確認
- [ ] 夜間のアラート・インシデント確認
- [ ] バックアップ実行状況確認
- [ ] パフォーマンス指標レビュー
- [ ] セキュリティログ確認

### 定期監視（毎時）
- [ ] ダッシュボード確認
- [ ] エラー率・レスポンス時間チェック
- [ ] リソース使用率確認
- [ ] アクティブユーザー数確認

### 夕方の運用レビュー（6:00 PM）
- [ ] 当日の運用サマリー作成
- [ ] 翌日のメンテナンス・デプロイ準備
- [ ] インシデント対応レビュー
- [ ] オンコール引き継ぎ
```

## 2. デプロイメント手順書

### 2.1 標準デプロイメント手順

#### operations/deployment-procedures.md
```markdown
# デプロイメント手順書

## 🚀 本番デプロイメント手順

### Phase 1: 事前準備（T-24時間）
1. **デプロイ計画確認**
   ```bash
   # デプロイ内容の最終確認
   git log --oneline main..develop
   npm run test:all
   npm run build
   ```

2. **ステークホルダー通知**
   ```bash
   # Slack通知送信
   curl -X POST $SLACK_DEPLOYMENT_WEBHOOK \
     -H 'Content-type: application/json' \
     --data '{"text":"📢 明日 XX:XX に本番デプロイを実施します"}'
   ```

3. **バックアップ実行**
   ```bash
   # データベースバックアップ
   ./scripts/backup-database.sh production
   
   # アプリケーション設定バックアップ  
   vercel env ls > backup-env-$(date +%Y%m%d).json
   ```

### Phase 2: デプロイ実行（T-0）
1. **最終確認**
   - [ ] ステージング環境での動作確認完了
   - [ ] データベースマイグレーション（必要な場合）の準備
   - [ ] ロールバック手順の確認

2. **デプロイ実行**
   ```bash
   # 本番デプロイ
   git checkout main
   git pull origin main
   vercel --prod --confirm
   
   # デプロイ完了確認
   curl -f https://vegetable-system.com/api/health
   ```

3. **動作確認**
   ```bash
   # 主要機能テスト実行
   npm run test:smoke-production
   
   # パフォーマンスチェック
   npx lighthouse https://vegetable-system.com --output=json
   ```

### Phase 3: 事後確認（T+30分）
1. **監視状況確認**
   - [ ] エラー率が正常範囲内
   - [ ] レスポンス時間が基準値以内
   - [ ] アクティブユーザーに異常なし

2. **完了報告**
   ```bash
   # デプロイ完了通知
   curl -X POST $SLACK_DEPLOYMENT_WEBHOOK \
     -H 'Content-type: application/json' \
     --data '{"text":"✅ 本番デプロイが正常に完了しました"}'
   ```

## 🔄 緊急デプロイ手順

### 緊急度判定基準
| 緊急度 | 条件 | 承認者 | 実行時間 |
|--------|------|--------|----------|
| **Critical** | システム停止・セキュリティ | CTO | 即座 |
| **High** | 重大な機能障害 | Tech Lead | 1時間以内 |
| **Medium** | 軽微な不具合 | チームリード | 24時間以内 |

### 緊急デプロイ実行
```bash
#!/bin/bash
# emergency-deploy.sh

SEVERITY=${1:-"high"}
DESCRIPTION=${2:-"Emergency fix"}

echo "🚨 Emergency deployment initiated"
echo "Severity: $SEVERITY"
echo "Description: $DESCRIPTION"

# 即座にバックアップ
./scripts/emergency-backup.sh

# 緊急デプロイ実行
vercel --prod --confirm --force

# 監視開始
./scripts/monitor-emergency-deploy.sh &

echo "⚠️ Emergency deployment completed - monitoring initiated"
```
```

### 2.2 ロールバック手順

#### scripts/rollback-procedures.sh
```bash
#!/bin/bash
set -e

# ロールバック手順スクリプト

ROLLBACK_TYPE=${1:-"application"} # application, database, full
TARGET_VERSION=${2:-"previous"}
REASON=${3:-"Issues detected"}

echo "🔄 Starting rollback procedure"
echo "Type: $ROLLBACK_TYPE"
echo "Target: $TARGET_VERSION"
echo "Reason: $REASON"

case $ROLLBACK_TYPE in
  "application")
    rollback_application
    ;;
  "database") 
    rollback_database
    ;;
  "full")
    rollback_full_system
    ;;
  *)
    echo "❌ Unknown rollback type: $ROLLBACK_TYPE"
    exit 1
    ;;
esac

rollback_application() {
  echo "📦 Rolling back application..."
  
  # 以前のデプロイメントを特定
  if [ "$TARGET_VERSION" = "previous" ]; then
    PREVIOUS_DEPLOYMENT=$(vercel ls --scope=$VERCEL_ORG_ID | grep "✅" | head -2 | tail -1 | awk '{print $2}')
  else
    PREVIOUS_DEPLOYMENT=$TARGET_VERSION
  fi
  
  echo "Target deployment: $PREVIOUS_DEPLOYMENT"
  
  # Vercel alias切り替え
  vercel alias set $PREVIOUS_DEPLOYMENT vegetable-system.com
  
  # 確認
  sleep 30
  if curl -f -s https://vegetable-system.com/api/health > /dev/null; then
    echo "✅ Application rollback completed successfully"
    send_rollback_notification "success" "application"
  else
    echo "❌ Application rollback failed"
    send_rollback_notification "failed" "application"
    exit 1
  fi
}

rollback_database() {
  echo "💾 Rolling back database..."
  
  # 最新のバックアップを特定
  LATEST_BACKUP=$(ls -t /backup/db_*.sql | head -n1)
  echo "Using backup: $LATEST_BACKUP"
  
  # 確認プロンプト
  read -p "⚠️ Database rollback will overwrite current data. Continue? (yes/no): " confirm
  if [ "$confirm" != "yes" ]; then
    echo "Database rollback cancelled"
    return 1
  fi
  
  # ダウンタイム通知
  send_maintenance_notification "start"
  
  # データベース復旧
  psql $DATABASE_URL -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid();"
  psql $DATABASE_URL < $LATEST_BACKUP
  
  # 確認
  if psql $DATABASE_URL -c "SELECT 1" > /dev/null; then
    echo "✅ Database rollback completed successfully"
    send_maintenance_notification "end"
    send_rollback_notification "success" "database"
  else
    echo "❌ Database rollback failed"
    send_rollback_notification "failed" "database"
    exit 1
  fi
}

rollback_full_system() {
  echo "🏗️ Full system rollback..."
  
  # 段階的ロールバック
  rollback_application
  rollback_database
  
  # 関連サービス再起動
  echo "♻️ Restarting related services..."
  # 必要に応じて外部サービスの設定も戻す
  
  echo "✅ Full system rollback completed"
  send_rollback_notification "success" "full"
}

send_rollback_notification() {
  local status=$1
  local type=$2
  local emoji=""
  local color=""
  
  case $status in
    "success")
      emoji="✅"
      color="good"
      ;;
    "failed")
      emoji="❌"  
      color="danger"
      ;;
  esac
  
  local message="$emoji Rollback $status: $type
  
Target Version: $TARGET_VERSION
Reason: $REASON
Timestamp: $(date)
  "
  
  curl -X POST $SLACK_INCIDENT_WEBHOOK \
    -H 'Content-type: application/json' \
    --data "{
      \"text\": \"$message\",
      \"color\": \"$color\",
      \"channel\": \"#incidents\"
    }"
}

send_maintenance_notification() {
  local action=$1
  
  case $action in
    "start")
      message="🔧 メンテナンス開始: データベースロールバック実行中"
      ;;
    "end")
      message="✅ メンテナンス完了: サービス通常運用再開"
      ;;
  esac
  
  curl -X POST $SLACK_MAINTENANCE_WEBHOOK \
    -H 'Content-type: application/json' \
    --data "{\"text\": \"$message\"}"
}

# 実行
if [ $# -eq 0 ]; then
  echo "Usage: $0 <application|database|full> [target_version] [reason]"
  echo "Example: $0 application previous 'Critical bug detected'"
  exit 1
fi

# 実行確認
echo "⚠️ This will perform a $ROLLBACK_TYPE rollback."
read -p "Continue? (yes/no): " final_confirm
if [ "$final_confirm" != "yes" ]; then
  echo "Rollback cancelled"
  exit 0
fi

# ログ記録開始
exec > >(tee -a /var/log/rollback-$(date +%Y%m%d_%H%M%S).log)
exec 2>&1

echo "Rollback initiated by: $(whoami)"
echo "Timestamp: $(date)"
```

## 3. インシデント対応手順

### 3.1 インシデント分類・対応フロー

#### operations/incident-response.md
```markdown
# インシデント対応手順書

## 🚨 インシデント分類

| **レベル** | **影響度** | **例** | **対応時間** |
|------------|-----------|--------|-------------|
| **P1 - Critical** | システム全停止 | 全サービス停止 | 15分以内 |
| **P2 - High** | 重要機能停止 | ログイン不可、データ保存不可 | 1時間以内 |
| **P3 - Medium** | 一部機能停止 | 特定機能のエラー | 4時間以内 |
| **P4 - Low** | 軽微な問題 | UI表示の不具合 | 24時間以内 |

## 📋 対応フローチャート

```
インシデント検知
       ↓
[5分] 初期トリアージ
       ↓
   レベル判定
    ↓    ↓
   P1-P2   P3-P4
    ↓      ↓
  即座対応  計画対応
    ↓      ↓
  解決確認 ← ←
    ↓
 事後分析
    ↓
再発防止策
```

## 🔧 P1-P2インシデント対応手順

### Step 1: 初期対応（5分以内）
1. **インシデント宣言**
   ```bash
   # インシデント宣言スクリプト
   ./scripts/declare-incident.sh \
     --severity "P1" \
     --title "システム全体停止" \
     --description "全APIがタイムアウト"
   ```

2. **チーム招集**
   - Slack #incident-response チャンネル作成
   - オンコールエンジニア・Tech Lead・CTO通知
   - 外部ベンダー（必要時）連絡

### Step 2: 問題調査（15分以内）
1. **症状確認**
   ```bash
   # システム状況確認
   curl -f https://vegetable-system.com/api/health
   
   # 監視ダッシュボード確認
   echo "Check Grafana: https://monitoring.vegetable-system.com"
   
   # エラーログ確認
   tail -f /var/log/application.log
   ```

2. **影響範囲特定**
   - 影響を受けるユーザー数
   - 停止している機能・サービス
   - データ損失の有無

### Step 3: 緊急措置（30分以内）
1. **応急対応**
   ```bash
   # 可能な限りの応急対応
   # 例：負荷分散、キャッシュクリア、サーバー再起動
   
   # Vercel functions再起動
   vercel dev --prod
   
   # データベース接続プール リセット
   psql $DATABASE_URL -c "SELECT pg_reload_conf();"
   ```

2. **通信対応**
   - ステータスページ更新
   - 主要顧客への直接連絡
   - 社内関係者への状況共有

### Step 4: 根本修正（1時間以内）
1. **原因特定・修正**
   - 根本原因の特定
   - 修正パッチの作成・テスト
   - 緊急デプロイ実行

2. **修正確認**
   ```bash
   # 修正後の動作確認
   npm run test:smoke-production
   
   # パフォーマンス確認
   ./scripts/performance-check.sh
   ```

### Step 5: 事後対応（24時間以内）
1. **完全復旧確認**
   - 全機能の正常動作確認
   - パフォーマンス指標の正常化
   - ユーザーへの復旧通知

2. **ポストモーテム作成**
   - 詳細な事後分析レポート
   - 再発防止策の策定
   - プロセス改善提案
```

### 3.2 インシデント対応ツール

#### scripts/incident-toolkit.sh
```bash
#!/bin/bash

# インシデント対応ツールキット

INCIDENT_ID=""
SEVERITY=""
INCIDENT_DIR="./incidents"

declare_incident() {
  local severity=$1
  local title=$2
  local description=$3
  
  INCIDENT_ID="INC-$(date +%Y%m%d-%H%M%S)"
  SEVERITY=$severity
  
  # インシデントディレクトリ作成
  mkdir -p "$INCIDENT_DIR/$INCIDENT_ID"
  
  # インシデントログ開始
  exec > >(tee -a "$INCIDENT_DIR/$INCIDENT_ID/incident.log")
  exec 2>&1
  
  echo "🚨 INCIDENT DECLARED: $INCIDENT_ID"
  echo "Severity: $SEVERITY"
  echo "Title: $title"
  echo "Description: $description"
  echo "Timestamp: $(date)"
  echo "Responder: $(whoami)"
  
  # Slack通知
  send_incident_alert "$title" "$description" "$SEVERITY"
  
  # ステータスページ更新
  update_status_page "investigating" "$title"
  
  # PagerDuty連携
  if [ "$SEVERITY" = "P1" ] || [ "$SEVERITY" = "P2" ]; then
    trigger_pagerduty "$INCIDENT_ID" "$title"
  fi
}

system_health_check() {
  echo "🔍 SYSTEM HEALTH CHECK"
  echo "======================"
  
  # API健康確認
  echo "API Health Check:"
  if curl -f -s --max-time 10 "https://vegetable-system.com/api/health"; then
    echo "✅ API: Healthy"
  else
    echo "❌ API: Failed"
  fi
  
  # データベース確認
  echo "Database Check:"
  if psql $DATABASE_URL -c "SELECT 1" >/dev/null 2>&1; then
    echo "✅ Database: Healthy"
  else
    echo "❌ Database: Failed"
  fi
  
  # CDN確認
  echo "CDN Check:"
  cdn_response=$(curl -s -o /dev/null -w "%{http_code}" https://vegetable-system.com)
  if [ "$cdn_response" = "200" ]; then
    echo "✅ CDN: Healthy"
  else
    echo "❌ CDN: Failed ($cdn_response)"
  fi
  
  # パフォーマンス確認
  echo "Performance Check:"
  response_time=$(curl -o /dev/null -s -w "%{time_total}" https://vegetable-system.com)
  echo "Response time: ${response_time}s"
  
  if (( $(echo "$response_time < 2.0" | bc -l) )); then
    echo "✅ Performance: Good"
  else
    echo "⚠️ Performance: Degraded"
  fi
}

collect_diagnostics() {
  echo "📊 COLLECTING DIAGNOSTICS"
  echo "========================"
  
  local diag_dir="$INCIDENT_DIR/$INCIDENT_ID/diagnostics"
  mkdir -p "$diag_dir"
  
  # システム情報
  echo "Collecting system information..."
  {
    echo "=== SYSTEM INFO ==="
    date
    uname -a
    
    echo "=== RECENT DEPLOYMENTS ==="
    vercel ls --scope=$VERCEL_ORG_ID | head -10
    
    echo "=== RECENT ERRORS ==="
    journalctl --since "1 hour ago" --priority=err --no-pager
    
  } > "$diag_dir/system_info.log"
  
  # アプリケーションログ
  echo "Collecting application logs..."
  if [ -f "/var/log/application.log" ]; then
    tail -n 1000 /var/log/application.log > "$diag_dir/app_logs.log"
  fi
  
  # データベース状態
  echo "Collecting database diagnostics..."
  {
    echo "=== DATABASE CONNECTIONS ==="
    psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"
    
    echo "=== LONG RUNNING QUERIES ==="
    psql $DATABASE_URL -c "
      SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
      FROM pg_stat_activity 
      WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';"
    
    echo "=== DATABASE SIZE ==="
    psql $DATABASE_URL -c "
      SELECT pg_database.datname, 
             pg_size_pretty(pg_database_size(pg_database.datname)) AS size
      FROM pg_database;"
      
  } > "$diag_dir/database_info.log" 2>&1
  
  echo "📁 Diagnostics saved to: $diag_dir"
}

update_incident_status() {
  local status=$1  # investigating, identified, monitoring, resolved
  local message=$2
  
  echo "📢 STATUS UPDATE: $status"
  echo "Message: $message"
  echo "Timestamp: $(date)"
  
  # ステータスページ更新
  update_status_page "$status" "$message"
  
  # Slack更新
  curl -X POST $SLACK_INCIDENT_WEBHOOK \
    -H 'Content-type: application/json' \
    --data "{
      \"text\": \"🔄 Incident Update: $INCIDENT_ID\",
      \"attachments\": [{
        \"color\": \"warning\",
        \"fields\": [
          {\"title\": \"Status\", \"value\": \"$status\", \"short\": true},
          {\"title\": \"Update\", \"value\": \"$message\", \"short\": false}
        ]
      }]
    }"
}

resolve_incident() {
  local resolution_summary=$1
  
  echo "✅ INCIDENT RESOLVED: $INCIDENT_ID"
  echo "Resolution: $resolution_summary"
  echo "Resolved at: $(date)"
  
  # 最終ステータス更新
  update_status_page "resolved" "Issue has been resolved. All systems are operational."
  
  # Slack解決通知
  curl -X POST $SLACK_INCIDENT_WEBHOOK \
    -H 'Content-type: application/json' \
    --data "{
      \"text\": \"✅ INCIDENT RESOLVED: $INCIDENT_ID\",
      \"attachments\": [{
        \"color\": \"good\",
        \"fields\": [
          {\"title\": \"Resolution\", \"value\": \"$resolution_summary\", \"short\": false},
          {\"title\": \"Resolved At\", \"value\": \"$(date)\", \"short\": true}
        ]
      }]
    }"
    
  # ポストモーテム作成のリマインダー
  schedule_postmortem_reminder
}

# ユーティリティ関数
send_incident_alert() {
  local title=$1
  local description=$2
  local severity=$3
  
  local color="danger"
  case $severity in
    "P3"|"P4") color="warning" ;;
  esac
  
  curl -X POST $SLACK_INCIDENT_WEBHOOK \
    -H 'Content-type: application/json' \
    --data "{
      \"text\": \"🚨 NEW INCIDENT: $INCIDENT_ID\",
      \"attachments\": [{
        \"color\": \"$color\",
        \"fields\": [
          {\"title\": \"Severity\", \"value\": \"$severity\", \"short\": true},
          {\"title\": \"Title\", \"value\": \"$title\", \"short\": false},
          {\"title\": \"Description\", \"value\": \"$description\", \"short\": false}
        ]
      }]
    }"
}

update_status_page() {
  local status=$1
  local message=$2
  
  # ステータスページAPI呼び出し（StatusPage.io等）
  if [ ! -z "$STATUS_PAGE_API_KEY" ]; then
    curl -X POST "https://api.statuspage.io/v1/pages/$STATUS_PAGE_ID/incidents" \
      -H "Authorization: OAuth $STATUS_PAGE_API_KEY" \
      -H "Content-Type: application/json" \
      -d "{
        \"incident\": {
          \"name\": \"$message\",
          \"status\": \"$status\",
          \"impact_override\": \"major\"
        }
      }"
  fi
}

trigger_pagerduty() {
  local incident_id=$1
  local title=$2
  
  curl -X POST "https://events.pagerduty.com/v2/enqueue" \
    -H "Content-Type: application/json" \
    -d "{
      \"routing_key\": \"$PAGERDUTY_ROUTING_KEY\",
      \"event_action\": \"trigger\",
      \"dedup_key\": \"$incident_id\",
      \"payload\": {
        \"summary\": \"$title\",
        \"severity\": \"critical\",
        \"source\": \"vegetable-management-system\",
        \"component\": \"web-application\"
      }
    }"
}

# コマンドライン処理
case "${1:-help}" in
  "declare")
    declare_incident "$2" "$3" "$4"
    ;;
  "health")
    system_health_check
    ;;
  "diagnostics")
    collect_diagnostics
    ;;
  "update")
    update_incident_status "$2" "$3"
    ;;
  "resolve")
    resolve_incident "$2"
    ;;
  *)
    echo "Incident Response Toolkit"
    echo "Usage:"
    echo "  $0 declare <severity> <title> <description>"
    echo "  $0 health"
    echo "  $0 diagnostics"
    echo "  $0 update <status> <message>"
    echo "  $0 resolve <resolution_summary>"
    ;;
esac
```

## 4. 定期メンテナンス手順

### 4.1 定期メンテナンス計画

#### operations/maintenance-schedule.md
```markdown
# 定期メンテナンス計画

## 📅 メンテナンススケジュール

### 日次メンテナンス（自動）
- **時間**: 毎日 AM 3:00-4:00 (JST)
- **内容**:
  - データベースバックアップ
  - ログローテーション  
  - 一時ファイル削除
  - システムリソース監視レポート

### 週次メンテナンス（半自動）
- **時間**: 毎週日曜日 AM 2:00-5:00 (JST)
- **内容**:
  - データベース統計情報更新
  - SSL証明書期限チェック
  - セキュリティパッチ適用
  - パフォーマンス分析

### 月次メンテナンス（手動）
- **時間**: 毎月第1日曜日 AM 1:00-6:00 (JST)
- **内容**:
  - フルシステム健康診断
  - データベース最適化
  - 古いデータのアーカイブ
  - 災害対策テスト

### 四半期メンテナンス（計画的）
- **時間**: 四半期末の日曜日（事前通知）
- **内容**:
  - 主要コンポーネントアップデート
  - セキュリティ監査
  - パフォーマンス最適化
  - 災害復旧訓練
```

### 4.2 メンテナンス実行スクリプト

#### scripts/maintenance-tasks.sh
```bash
#!/bin/bash
set -e

# メンテナンス実行スクリプト

MAINTENANCE_TYPE=${1:-"daily"} # daily, weekly, monthly, quarterly
LOG_DIR="./maintenance-logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "🔧 Starting $MAINTENANCE_TYPE maintenance"

# ログディレクトリ作成
mkdir -p $LOG_DIR

# ログ記録開始
exec > >(tee -a "$LOG_DIR/maintenance_${MAINTENANCE_TYPE}_${TIMESTAMP}.log")
exec 2>&1

case $MAINTENANCE_TYPE in
  "daily")
    run_daily_maintenance
    ;;
  "weekly")
    run_weekly_maintenance
    ;;
  "monthly")
    run_monthly_maintenance
    ;;
  "quarterly")
    run_quarterly_maintenance
    ;;
  *)
    echo "❌ Unknown maintenance type: $MAINTENANCE_TYPE"
    exit 1
    ;;
esac

run_daily_maintenance() {
  echo "📅 DAILY MAINTENANCE TASKS"
  echo "========================="
  
  # 1. データベースバックアップ
  echo "💾 Creating database backup..."
  ./scripts/backup-database.sh
  
  # 2. ログクリーンアップ
  echo "🧹 Cleaning up logs..."
  find /var/log -name "*.log" -type f -mtime +7 -delete
  find /tmp -name "temp_*" -type f -mtime +1 -delete
  
  # 3. システムリソースチェック
  echo "📊 Checking system resources..."
  {
    echo "=== DISK USAGE ==="
    df -h
    echo ""
    echo "=== MEMORY USAGE ==="
    free -h
    echo ""
    echo "=== TOP PROCESSES ==="
    ps aux --sort=-%cpu | head -10
  } > "$LOG_DIR/system_resources_${TIMESTAMP}.txt"
  
  # 4. データベース接続数確認
  echo "🔌 Checking database connections..."
  CONNECTION_COUNT=$(psql $DATABASE_URL -t -c "SELECT count(*) FROM pg_stat_activity;")
  echo "Current DB connections: $CONNECTION_COUNT"
  
  if [ "$CONNECTION_COUNT" -gt 80 ]; then
    echo "⚠️ Warning: High connection count detected"
    send_alert "High DB connection count: $CONNECTION_COUNT"
  fi
  
  echo "✅ Daily maintenance completed"
}

run_weekly_maintenance() {
  echo "📅 WEEKLY MAINTENANCE TASKS"  
  echo "==========================="
  
  # 日次タスクも実行
  run_daily_maintenance
  
  # 5. データベース統計更新
  echo "📈 Updating database statistics..."
  psql $DATABASE_URL -c "ANALYZE;"
  
  # 6. SSL証明書チェック
  echo "🔒 Checking SSL certificates..."
  ./scripts/ssl-monitoring.sh
  
  # 7. セキュリティアップデート
  echo "🛡️ Checking security updates..."
  npm audit --audit-level moderate
  
  # 8. パフォーマンス分析
  echo "⚡ Performance analysis..."
  {
    echo "=== SLOW QUERIES ==="
    psql $DATABASE_URL -c "
      SELECT query, calls, total_time, mean_time 
      FROM pg_stat_statements 
      WHERE mean_time > 100 
      ORDER BY mean_time DESC 
      LIMIT 10;"
    
    echo ""
    echo "=== TABLE SIZES ==="
    psql $DATABASE_URL -c "
      SELECT schemaname,tablename,
             pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
      FROM pg_tables
      WHERE schemaname='public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
      
  } > "$LOG_DIR/performance_analysis_${TIMESTAMP}.txt"
  
  echo "✅ Weekly maintenance completed"
}

run_monthly_maintenance() {
  echo "📅 MONTHLY MAINTENANCE TASKS"
  echo "============================"
  
  # 週次タスクも実行
  run_weekly_maintenance
  
  # 9. データベース最適化
  echo "⚙️ Database optimization..."
  psql $DATABASE_URL -c "VACUUM ANALYZE;"
  psql $DATABASE_URL -c "REINDEX DATABASE $(echo $DATABASE_URL | sed 's/.*\/\([^?]*\).*/\1/');"
  
  # 10. 古いデータのアーカイブ
  echo "📦 Archiving old data..."
  
  # 90日以上前の操作ログをアーカイブ
  ARCHIVE_DATE=$(date -d "90 days ago" +%Y-%m-%d)
  psql $DATABASE_URL -c "
    CREATE TABLE IF NOT EXISTS operation_logs_archive (LIKE operation_logs);
    INSERT INTO operation_logs_archive SELECT * FROM operation_logs WHERE created_at < '$ARCHIVE_DATE';
    DELETE FROM operation_logs WHERE created_at < '$ARCHIVE_DATE';
  "
  
  # 1年以上前の監査ログをアーカイブ
  AUDIT_ARCHIVE_DATE=$(date -d "1 year ago" +%Y-%m-%d)
  psql $DATABASE_URL -c "
    CREATE TABLE IF NOT EXISTS audit_log_archive (LIKE audit_log);
    INSERT INTO audit_log_archive SELECT * FROM audit_log WHERE timestamp < '$AUDIT_ARCHIVE_DATE';
    DELETE FROM audit_log WHERE timestamp < '$AUDIT_ARCHIVE_DATE';
  "
  
  # 11. 容量使用量レポート
  echo "📊 Generating capacity report..."
  {
    echo "=== DATABASE SIZE ANALYSIS ==="
    psql $DATABASE_URL -c "
      SELECT 
        pg_database.datname as database_name,
        pg_size_pretty(pg_database_size(pg_database.datname)) as size
      FROM pg_database
      WHERE pg_database.datname = current_database();"
    
    echo ""
    echo "=== STORAGE USAGE ==="
    du -sh /var/lib/postgresql/data
    
    echo ""
    echo "=== BACKUP STORAGE ==="
    du -sh /backup/*
    
  } > "$LOG_DIR/capacity_report_${TIMESTAMP}.txt"
  
  # 12. 災害対策テスト
  echo "🚨 Running disaster recovery test..."
  ./scripts/disaster-drill.sh communication-only
  
  echo "✅ Monthly maintenance completed"
}

run_quarterly_maintenance() {
  echo "📅 QUARTERLY MAINTENANCE TASKS"
  echo "=============================="
  
  # 月次タスクも実行
  run_monthly_maintenance
  
  # 13. 依存関係大規模アップデート
  echo "📦 Major dependency updates..."
  npm audit fix
  npm update
  
  # 14. セキュリティ監査
  echo "🛡️ Security audit..."
  npm run test:security
  
  # 15. パフォーマンス最適化
  echo "⚡ Performance optimization..."
  
  # インデックス使用状況分析
  psql $DATABASE_URL -c "
    SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
    FROM pg_stat_user_indexes
    WHERE idx_scan < 10
    ORDER BY idx_scan;"
  
  # 16. フル災害復旧訓練
  echo "🎭 Full disaster recovery drill..."
  ./scripts/disaster-drill.sh full test_scenario
  
  # 17. 年間レポート（4四半期目の場合）
  QUARTER=$(date +%q)
  if [ "$QUARTER" = "4" ]; then
    echo "📋 Generating annual report..."
    generate_annual_report
  fi
  
  echo "✅ Quarterly maintenance completed"
}

generate_annual_report() {
  local report_file="$LOG_DIR/annual_report_$(date +%Y).md"
  
  cat > $report_file << EOF
# 年間システム運用レポート $(date +%Y)

## システム稼働率
- 目標: 99.9%
- 実績: $(calculate_uptime_percentage)%

## インシデント統計
$(generate_incident_stats)

## パフォーマンス推移
$(generate_performance_trends)

## 容量使用量推移  
$(generate_capacity_trends)

## セキュリティ対策実施状況
$(generate_security_summary)

## 来年度の改善計画
- システム容量拡張計画
- セキュリティ強化施策
- パフォーマンス最適化計画
- 監視システム改善

生成日: $(date)
EOF

  echo "📄 Annual report generated: $report_file"
}

# メンテナンス通知
send_maintenance_notification() {
  local status=$1  # start, complete, error
  local type=$2
  
  case $status in
    "start")
      message="🔧 $type メンテナンスを開始しました"
      ;;
    "complete")
      message="✅ $type メンテナンスが正常に完了しました"
      ;;
    "error")
      message="❌ $type メンテナンスでエラーが発生しました"
      ;;
  esac
  
  curl -X POST $SLACK_MAINTENANCE_WEBHOOK \
    -H 'Content-type: application/json' \
    --data "{\"text\": \"$message\"}"
}

# トラップ設定
trap 'send_maintenance_notification error $MAINTENANCE_TYPE' ERR

# メンテナンス開始通知
send_maintenance_notification start $MAINTENANCE_TYPE

echo "🏁 Maintenance completed at $(date)"

# メンテナンス完了通知
send_maintenance_notification complete $MAINTENANCE_TYPE
```

これでドキュメント整備・運用手順が完了しました。最終フェーズのリリース計画・ロールバック準備に進みます。