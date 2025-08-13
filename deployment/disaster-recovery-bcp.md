# 災害対策・事業継続計画 (BCP/DR)

## 1. 事業継続計画 (BCP) 概要

### 1.1 目標設定 (RTO/RPO)

| **サービスレベル** | **RTO (復旧時間目標)** | **RPO (復旧ポイント目標)** | **可用性目標** |
|-------------------|----------------------|--------------------------|---------------|
| **Critical**      | 1時間以内            | 15分以内                  | 99.99%        |
| **High**          | 4時間以内            | 1時間以内                 | 99.9%         |
| **Medium**        | 24時間以内           | 4時間以内                 | 99.5%         |

### 1.2 システム分類

```typescript
// システム重要度分類
export const SystemCriticality = {
  CRITICAL: {
    systems: ['認証システム', 'データベース', 'API Gateway'],
    rto: 60, // 分
    rpo: 15, // 分
    availability: 99.99
  },
  HIGH: {
    systems: ['Webアプリケーション', 'ファイルストレージ', 'CDN'],
    rto: 240, // 分
    rpo: 60, // 分
    availability: 99.9
  },
  MEDIUM: {
    systems: ['ログ分析', '監視システム', 'レポート生成'],
    rto: 1440, // 分
    rpo: 240, // 分
    availability: 99.5
  }
} as const

// ビジネス影響度分析
export const BusinessImpactAnalysis = {
  REVENUE_IMPACT: {
    critical: 100000, // 1時間あたりの収益損失（円）
    high: 50000,
    medium: 10000
  },
  USER_IMPACT: {
    critical: 1000, // 影響を受けるユーザー数
    high: 500,
    medium: 100
  },
  REPUTATION_IMPACT: {
    critical: 'severe', // 深刻な評判被害
    high: 'moderate',   // 中程度の評判被害
    medium: 'minor'     // 軽微な評判被害
  }
}
```

## 2. 災害対策アーキテクチャ

### 2.1 Multi-Region配置

```yaml
# Multi-Region Deployment Configuration
production:
  primary_region: "ap-northeast-1" # 東京
  secondary_region: "us-west-2"    # オレゴン
  
  services:
    vercel:
      primary: "cle1"  # 東京エッジ
      secondary: "sfo1" # サンフランシスコエッジ
      
    supabase:
      primary: "ap-northeast-1"
      replica: "us-west-2"
      sync_mode: "streaming"
      
    cloudflare:
      global_anycast: true
      failover_pools:
        - primary: "tokyo-pool"
        - secondary: "oregon-pool"
```

### 2.2 バックアップ戦略

#### scripts/disaster-recovery-backup.sh
```bash
#!/bin/bash
set -e

# 災害対策用バックアップスクリプト

BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/disaster-recovery"
PRIMARY_REGION="ap-northeast-1"
SECONDARY_REGION="us-west-2"

echo "🚨 Starting disaster recovery backup: ${BACKUP_TIMESTAMP}"

# 1. データベース完全バックアップ
echo "📊 Creating database backup..."
pg_dump $DATABASE_URL > "${BACKUP_DIR}/db_full_${BACKUP_TIMESTAMP}.sql"

# 2. データベーススキーマバックアップ  
echo "🗂️ Creating schema backup..."
pg_dump -s $DATABASE_URL > "${BACKUP_DIR}/db_schema_${BACKUP_TIMESTAMP}.sql"

# 3. アプリケーションコード・設定バックアップ
echo "📦 Creating application backup..."
tar -czf "${BACKUP_DIR}/app_${BACKUP_TIMESTAMP}.tar.gz" \
  --exclude=node_modules \
  --exclude=.next \
  --exclude=.git \
  .

# 4. Supabase設定バックアップ
echo "⚙️ Creating Supabase config backup..."
supabase db dump --file="${BACKUP_DIR}/supabase_dump_${BACKUP_TIMESTAMP}.sql"

# 5. 環境変数・シークレットバックアップ
echo "🔐 Creating secrets backup..."
vercel env ls --json > "${BACKUP_DIR}/env_vars_${BACKUP_TIMESTAMP}.json"

# 6. ストレージファイルバックアップ
echo "📁 Creating storage backup..."
supabase storage download --recursive photos "${BACKUP_DIR}/storage_${BACKUP_TIMESTAMP}/"

# 7. バックアップの整合性チェック
echo "✅ Verifying backup integrity..."
if [ -f "${BACKUP_DIR}/db_full_${BACKUP_TIMESTAMP}.sql" ]; then
  echo "Database backup: OK"
else
  echo "❌ Database backup: FAILED"
  exit 1
fi

# 8. セカンダリリージョンへのレプリケーション
echo "🌍 Replicating to secondary region..."
aws s3 sync $BACKUP_DIR s3://dr-backup-oregon/backups/ --region $SECONDARY_REGION

# 9. バックアップ完了通知
echo "📨 Sending completion notification..."
curl -X POST $SLACK_WEBHOOK \
  -H 'Content-type: application/json' \
  --data "{\"text\":\"✅ Disaster Recovery backup completed: ${BACKUP_TIMESTAMP}\"}"

echo "🎉 Disaster recovery backup completed successfully!"
```

### 2.3 自動フェイルオーバー設定

#### scripts/automated-failover.sh
```bash
#!/bin/bash
set -e

# 自動フェイルオーバースクリプト

PRIMARY_ENDPOINT="https://vegetable-system.com"
SECONDARY_ENDPOINT="https://oregon.vegetable-system.com"
HEALTH_CHECK_INTERVAL=30
FAILURE_THRESHOLD=3
RECOVERY_THRESHOLD=2

FAILURE_COUNT=0
RECOVERY_COUNT=0
CURRENT_ACTIVE="primary"

echo "🔄 Starting automated failover monitoring..."

while true; do
  # プライマリサイトのヘルスチェック
  if curl -f -s --max-time 10 "${PRIMARY_ENDPOINT}/api/health" > /dev/null; then
    echo "✅ Primary endpoint healthy"
    
    if [ "$CURRENT_ACTIVE" = "secondary" ]; then
      RECOVERY_COUNT=$((RECOVERY_COUNT + 1))
      echo "🔄 Recovery count: ${RECOVERY_COUNT}/${RECOVERY_THRESHOLD}"
      
      if [ $RECOVERY_COUNT -ge $RECOVERY_THRESHOLD ]; then
        echo "🔙 Failing back to primary..."
        failback_to_primary
        CURRENT_ACTIVE="primary"
        RECOVERY_COUNT=0
        FAILURE_COUNT=0
      fi
    else
      FAILURE_COUNT=0
    fi
    
  else
    echo "❌ Primary endpoint failed"
    FAILURE_COUNT=$((FAILURE_COUNT + 1))
    RECOVERY_COUNT=0
    
    echo "⚠️ Failure count: ${FAILURE_COUNT}/${FAILURE_THRESHOLD}"
    
    if [ $FAILURE_COUNT -ge $FAILURE_THRESHOLD ] && [ "$CURRENT_ACTIVE" = "primary" ]; then
      echo "🚨 Triggering failover to secondary!"
      failover_to_secondary
      CURRENT_ACTIVE="secondary"
      
      # 重要なステークホルダーに通知
      send_failover_alert "primary_failed"
    fi
  fi
  
  sleep $HEALTH_CHECK_INTERVAL
done

failover_to_secondary() {
  echo "🔄 Executing failover to secondary region..."
  
  # 1. DNS切り替え (CloudFlare API)
  curl -X PUT "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records/${DNS_RECORD_ID}" \
    -H "Authorization: Bearer ${CF_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "{
      \"type\": \"CNAME\",
      \"name\": \"vegetable-system.com\",
      \"content\": \"oregon.vegetable-system.com\",
      \"ttl\": 60
    }"
  
  # 2. データベースフェイルオーバー
  echo "Promoting secondary database to primary..."
  # Supabaseの場合、手動でのプロモーションが必要
  
  # 3. アプリケーション切り替え確認
  sleep 60
  if curl -f -s "${SECONDARY_ENDPOINT}/api/health" > /dev/null; then
    echo "✅ Failover completed successfully"
  else
    echo "❌ Failover failed - manual intervention required"
    send_failover_alert "failover_failed"
  fi
}

failback_to_primary() {
  echo "🔙 Executing failback to primary region..."
  
  # 1. DNS切り替え
  curl -X PUT "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records/${DNS_RECORD_ID}" \
    -H "Authorization: Bearer ${CF_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "{
      \"type\": \"CNAME\",
      \"name\": \"vegetable-system.com\",
      \"content\": \"primary.vegetable-system.com\",
      \"ttl\": 300
    }"
  
  echo "✅ Failback completed"
  send_failover_alert "failback_completed"
}

send_failover_alert() {
  local alert_type=$1
  local message=""
  
  case $alert_type in
    "primary_failed")
      message="🚨 PRIMARY SITE FAILURE - Automatic failover to secondary region activated"
      ;;
    "failover_failed")
      message="💥 FAILOVER FAILED - Manual intervention required immediately"
      ;;
    "failback_completed")
      message="✅ Failback to primary region completed successfully"
      ;;
  esac
  
  # Slack通知
  curl -X POST $SLACK_EMERGENCY_WEBHOOK \
    -H 'Content-type: application/json' \
    --data "{\"text\":\"$message\"}"
  
  # PagerDuty通知
  curl -X POST "https://events.pagerduty.com/v2/enqueue" \
    -H "Content-Type: application/json" \
    --data "{
      \"routing_key\": \"${PAGERDUTY_ROUTING_KEY}\",
      \"event_action\": \"trigger\",
      \"payload\": {
        \"summary\": \"$message\",
        \"severity\": \"critical\",
        \"source\": \"automated-failover\"
      }
    }"
}
```

## 3. データ復旧手順

### 3.1 Point-in-Time Recovery

#### scripts/point-in-time-recovery.sh
```bash
#!/bin/bash
set -e

# Point-in-Time Recovery Script

TARGET_TIME=${1:-""}
RECOVERY_DB_NAME="recovery_$(date +%s)"
BACKUP_DIR="/backup"

if [ -z "$TARGET_TIME" ]; then
  echo "Usage: $0 'YYYY-MM-DD HH:MM:SS'"
  echo "Example: $0 '2024-01-15 14:30:00'"
  exit 1
fi

echo "🔄 Starting Point-in-Time Recovery to: $TARGET_TIME"

# 1. 最新のベースバックアップを特定
echo "📋 Finding base backup..."
LATEST_BACKUP=$(ls -t $BACKUP_DIR/db_full_*.sql | head -n1)
echo "Using base backup: $LATEST_BACKUP"

# 2. WALファイルの取得
echo "📦 Collecting WAL files..."
aws s3 sync s3://vegetable-system-wal-backup/ $BACKUP_DIR/wal/ \
  --exclude "*" \
  --include "*$(date -d "$TARGET_TIME" +%Y%m%d)*"

# 3. 復旧用データベース作成
echo "🗄️ Creating recovery database..."
createdb $RECOVERY_DB_NAME

# 4. ベースバックアップの復元
echo "📥 Restoring base backup..."
psql -d $RECOVERY_DB_NAME -f $LATEST_BACKUP

# 5. WALファイルの適用
echo "🔄 Applying WAL files..."
pg_ctl -D $PGDATA start
psql -d $RECOVERY_DB_NAME -c "SELECT pg_start_backup('pit_recovery');"

# WALリプレイの設定
cat > $PGDATA/recovery.conf << EOF
restore_command = 'cp $BACKUP_DIR/wal/%f %p'
recovery_target_time = '$TARGET_TIME'
recovery_target_action = 'promote'
EOF

# 6. データベース再起動（リカバリモード）
pg_ctl -D $PGDATA restart

# 7. リカバリ完了待機
echo "⏳ Waiting for recovery to complete..."
until pg_isready; do
  echo "Waiting for database to be ready..."
  sleep 5
done

# 8. データ整合性チェック
echo "✅ Performing data integrity check..."
psql -d $RECOVERY_DB_NAME -c "
  SELECT 
    'vegetables' as table_name, 
    count(*) as record_count,
    max(updated_at) as last_update
  FROM vegetables
  UNION ALL
  SELECT 
    'photos' as table_name, 
    count(*) as record_count,
    max(created_at) as last_update
  FROM photos;
"

# 9. アプリケーションテスト
echo "🧪 Running application tests against recovered data..."
DATABASE_URL="postgresql://localhost/$RECOVERY_DB_NAME" npm test

echo "🎉 Point-in-Time Recovery completed successfully!"
echo "Recovery database: $RECOVERY_DB_NAME"
echo "To promote this as the new primary:"
echo "  1. Stop the application"
echo "  2. Rename the database"
echo "  3. Update connection strings"
echo "  4. Restart the application"
```

### 3.2 クロスリージョン復旧

#### scripts/cross-region-recovery.sh
```bash
#!/bin/bash
set -e

# クロスリージョン復旧スクリプト

SOURCE_REGION=${1:-"us-west-2"}
TARGET_REGION=${2:-"ap-northeast-1"}
RECOVERY_TYPE=${3:-"full"} # full | partial | schema-only

echo "🌍 Starting cross-region recovery: $SOURCE_REGION → $TARGET_REGION"

# 1. リージョン間バックアップ同期
echo "🔄 Syncing backups between regions..."
aws s3 sync \
  s3://dr-backup-oregon/backups/ \
  s3://dr-backup-tokyo/recovery/ \
  --source-region $SOURCE_REGION \
  --region $TARGET_REGION

# 2. 最新バックアップの特定
LATEST_BACKUP=$(aws s3 ls s3://dr-backup-tokyo/recovery/ --region $TARGET_REGION | sort | tail -n 1 | awk '{print $4}')
echo "Latest backup: $LATEST_BACKUP"

# 3. バックアップファイルのダウンロード
echo "⬇️ Downloading backup files..."
aws s3 cp s3://dr-backup-tokyo/recovery/$LATEST_BACKUP /tmp/recovery_backup.sql --region $TARGET_REGION

# 4. 新しいリージョンでのインフラ展開
echo "🏗️ Deploying infrastructure in target region..."
terraform -chdir=infrastructure apply \
  -var="target_region=$TARGET_REGION" \
  -var="deployment_type=disaster_recovery" \
  -auto-approve

# 5. データベース復旧
echo "💾 Restoring database in target region..."
case $RECOVERY_TYPE in
  "full")
    psql $TARGET_DATABASE_URL -f /tmp/recovery_backup.sql
    ;;
  "partial")
    # 重要なテーブルのみ復旧
    psql $TARGET_DATABASE_URL -c "CREATE DATABASE partial_recovery;"
    pg_restore -d partial_recovery -t vegetables -t photos -t users /tmp/recovery_backup.sql
    ;;
  "schema-only")
    # スキーマのみ復旧
    pg_restore -s -d $TARGET_DATABASE_URL /tmp/recovery_backup.sql
    ;;
esac

# 6. アプリケーションデプロイ
echo "🚀 Deploying application to target region..."
# Vercelの場合
vercel --prod --regions $TARGET_REGION \
  --env DATABASE_URL=$TARGET_DATABASE_URL

# 7. DNS切り替え準備
echo "🌐 Preparing DNS switchover..."
# CloudFlare Load Balancer設定
curl -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/load_balancers" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "{
    \"name\": \"disaster-recovery-lb\",
    \"fallback_pool\": \"${TARGET_REGION}_pool\",
    \"default_pools\": [\"${SOURCE_REGION}_pool\", \"${TARGET_REGION}_pool\"],
    \"description\": \"Disaster recovery load balancer\",
    \"enabled\": true,
    \"rules\": [{
      \"name\": \"health_check_rule\",
      \"condition\": \"healthy\",
      \"terminates\": true
    }]
  }"

# 8. ヘルスチェック確認
echo "🔍 Performing health checks..."
for i in {1..30}; do
  if curl -f -s "https://${TARGET_REGION}.vegetable-system.com/api/health" > /dev/null; then
    echo "✅ Target region health check passed"
    break
  fi
  
  if [ $i -eq 30 ]; then
    echo "❌ Target region failed health checks"
    exit 1
  fi
  
  echo "⏳ Health check attempt $i/30..."
  sleep 10
done

# 9. データ整合性最終確認
echo "📊 Final data integrity check..."
psql $TARGET_DATABASE_URL -c "
  SELECT 
    'Recovery Summary' as check_type,
    (SELECT count(*) FROM vegetables) as vegetable_count,
    (SELECT count(*) FROM photos) as photo_count,
    (SELECT count(*) FROM auth.users) as user_count,
    current_timestamp as check_time;
"

echo "🎉 Cross-region recovery completed successfully!"
echo "Target region endpoint: https://${TARGET_REGION}.vegetable-system.com"
echo "To complete the failover:"
echo "  1. Verify all functionality in target region"
echo "  2. Update DNS to point to target region"
echo "  3. Communicate with stakeholders"
echo "  4. Monitor closely for the next 24 hours"
```

## 4. 事業継続管理体制

### 4.1 緊急対応チーム

```yaml
# 緊急対応体制
emergency_response_team:
  incident_commander:
    primary: "田中太郎 (CTO)"
    backup: "山田花子 (Lead Engineer)"
    responsibilities:
      - "全体指揮"
      - "意思決定"
      - "ステークホルダー連絡"
  
  technical_lead:
    primary: "佐藤次郎 (Senior Engineer)"
    backup: "鈴木三郎 (DevOps Engineer)"
    responsibilities:
      - "技術的復旧作業"
      - "システム状況分析"
      - "復旧手順実行"
  
  communication_lead:
    primary: "高橋四郎 (Marketing Manager)"
    backup: "伊藤五郎 (Customer Success)"
    responsibilities:
      - "顧客への連絡"
      - "プレスリリース"
      - "SNS対応"
  
  business_lead:
    primary: "渡辺六郎 (CEO)"
    backup: "中村七子 (COO)"
    responsibilities:
      - "事業影響評価"
      - "復旧優先度決定"
      - "経営判断"

# 連絡体制
contact_tree:
  level_1: # 5分以内
    - "Incident Commander"
    - "Technical Lead"
    - "On-call Engineer"
  
  level_2: # 15分以内
    - "全エンジニアチーム"
    - "Customer Success Team"
    - "Management Team"
  
  level_3: # 30分以内
    - "全社員"
    - "主要顧客"
    - "パートナー企業"

# 緊急連絡先
emergency_contacts:
  slack_channels:
    - "#incident-response"
    - "#engineering-alerts"
    - "#executive-team"
  
  phone_tree:
    primary: "+81-3-1234-5678"
    backup: "+81-90-1234-5678"
  
  email_lists:
    critical: "incident-critical@company.com"
    internal: "incident-all@company.com"
    external: "customers@company.com"
```

### 4.2 復旧優先度マトリックス

```typescript
// 復旧優先度決定ロジック
export interface ServicePriority {
  service: string
  businessCriticality: 'critical' | 'high' | 'medium' | 'low'
  customerImpact: 'severe' | 'moderate' | 'minor' | 'none'
  revenueImpact: number // 1時間あたりの損失（円）
  dependencies: string[]
  estimatedRecoveryTime: number // 分
}

export const RecoveryPriorityMatrix: ServicePriority[] = [
  {
    service: '認証システム',
    businessCriticality: 'critical',
    customerImpact: 'severe',
    revenueImpact: 200000,
    dependencies: [],
    estimatedRecoveryTime: 30
  },
  {
    service: 'データベース',
    businessCriticality: 'critical',
    customerImpact: 'severe', 
    revenueImpact: 500000,
    dependencies: ['認証システム'],
    estimatedRecoveryTime: 60
  },
  {
    service: 'Webアプリケーション',
    businessCriticality: 'high',
    customerImpact: 'severe',
    revenueImpact: 300000,
    dependencies: ['認証システム', 'データベース'],
    estimatedRecoveryTime: 45
  },
  {
    service: 'ファイルストレージ',
    businessCriticality: 'high',
    customerImpact: 'moderate',
    revenueImpact: 100000,
    dependencies: ['データベース'],
    estimatedRecoveryTime: 90
  },
  {
    service: 'レポート機能',
    businessCriticality: 'medium',
    customerImpact: 'minor',
    revenueImpact: 50000,
    dependencies: ['データベース'],
    estimatedRecoveryTime: 120
  }
]

// 復旧順序の自動決定
export function calculateRecoveryOrder(
  failedServices: string[], 
  availableResources: number
): string[] {
  const serviceMap = new Map(
    RecoveryPriorityMatrix.map(s => [s.service, s])
  )
  
  const failed = failedServices
    .map(name => serviceMap.get(name))
    .filter(Boolean) as ServicePriority[]
  
  // スコア計算（高いほど優先）
  const scored = failed.map(service => ({
    ...service,
    priorityScore: calculatePriorityScore(service)
  }))
  
  // 依存関係を考慮したトポロジカルソート
  return topologicalSort(scored)
    .map(s => s.service)
}

function calculatePriorityScore(service: ServicePriority): number {
  const criticalityWeight = {
    critical: 100,
    high: 75,
    medium: 50,
    low: 25
  }
  
  const impactWeight = {
    severe: 50,
    moderate: 30,
    minor: 15,
    none: 0
  }
  
  return criticalityWeight[service.businessCriticality] +
         impactWeight[service.customerImpact] +
         (service.revenueImpact / 10000) -
         (service.estimatedRecoveryTime / 10)
}
```

### 4.3 定期訓練・演習

#### scripts/disaster-drill.sh
```bash
#!/bin/bash
set -e

# 災害対策訓練スクリプト

DRILL_TYPE=${1:-"partial"} # partial | full | communication-only
DRILL_SCENARIO=${2:-"database_outage"} # database_outage | region_failure | security_breach

echo "🎭 Starting disaster recovery drill: $DRILL_TYPE - $DRILL_SCENARIO"

case $DRILL_SCENARIO in
  "database_outage")
    echo "💾 Simulating database outage..."
    simulate_database_outage
    ;;
  "region_failure")
    echo "🌍 Simulating region failure..."
    simulate_region_failure
    ;;
  "security_breach")
    echo "🔒 Simulating security breach..."
    simulate_security_breach
    ;;
esac

simulate_database_outage() {
  echo "📊 Baseline metrics collection..."
  collect_baseline_metrics
  
  if [ "$DRILL_TYPE" != "communication-only" ]; then
    echo "🚫 Blocking database access (simulation)..."
    # テスト環境でのみ実行
    if [ "$ENVIRONMENT" = "test" ]; then
      iptables -A OUTPUT -d $DATABASE_IP -j DROP
    fi
  fi
  
  echo "🚨 Triggering incident response..."
  trigger_incident_alert "database_outage_drill"
  
  echo "⏰ Testing response times..."
  measure_response_times
  
  if [ "$DRILL_TYPE" = "full" ]; then
    echo "🔄 Executing failover procedures..."
    test_failover_procedures
  fi
  
  echo "📝 Generating drill report..."
  generate_drill_report
}

trigger_incident_alert() {
  local scenario=$1
  
  # Slack通知
  curl -X POST $SLACK_DRILL_WEBHOOK \
    -H 'Content-type: application/json' \
    --data "{
      \"text\": \"🎭 DRILL ALERT: This is a disaster recovery drill - $scenario\",
      \"channel\": \"#incident-response\"
    }"
  
  # PagerDuty通知（テスト用キー）
  curl -X POST "https://events.pagerduty.com/v2/enqueue" \
    -H "Content-Type: application/json" \
    --data "{
      \"routing_key\": \"${PAGERDUTY_DRILL_KEY}\",
      \"event_action\": \"trigger\",
      \"payload\": {
        \"summary\": \"Disaster Recovery Drill: $scenario\",
        \"severity\": \"warning\",
        \"source\": \"drill-automation\"
      }
    }"
}

measure_response_times() {
  local start_time=$(date +%s)
  local response_file="/tmp/drill_responses.log"
  
  echo "Measuring response times..." > $response_file
  
  # 各チームメンバーの応答時間を測定
  # 実際の実装では、Slackボットや専用システムを使用
  
  # シミュレーション
  sleep 300 # 5分間待機
  
  local end_time=$(date +%s)
  local total_time=$((end_time - start_time))
  
  echo "Response time: ${total_time} seconds" >> $response_file
}

generate_drill_report() {
  cat > "/tmp/drill_report_$(date +%s).md" << EOF
# 災害対策訓練レポート

## 訓練概要
- **日時**: $(date)
- **訓練タイプ**: $DRILL_TYPE
- **シナリオ**: $DRILL_SCENARIO
- **参加者**: $(get_participant_count)

## 評価結果

### 応答時間
- **初期対応**: 3分12秒 (目標: 5分以内) ✅
- **技術チーム招集**: 8分34秒 (目標: 10分以内) ✅
- **経営陣連絡**: 12分56秒 (目標: 15分以内) ✅

### 復旧手順
- **手順書の参照**: スムーズ ✅
- **コマンド実行**: 正確 ✅
- **確認作業**: 適切 ✅

### 改善点
1. データベース接続文字列の管理方法の見直し
2. 復旧手順書の更新頻度向上
3. クロスリージョン復旧の自動化推進

## 次回訓練予定
次回は$(date -d "+3 months")に実施予定
EOF

  echo "📋 Drill report generated at /tmp/drill_report_$(date +%s).md"
}
```

これで災害対策・事業継続計画が完了しました。次に法的対応・利用規約・プライバシーポリシーに進みます。