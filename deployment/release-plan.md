# リリース計画・ロールバック準備

## 1. 本番リリース戦略

### 1.1 リリース計画概要

```yaml
# リリース戦略
release_strategy:
  type: "Blue-Green Deployment with Canary"
  phases:
    phase_1: "Canary Release (1% traffic)"
    phase_2: "Gradual rollout (10% → 50%)"
    phase_3: "Full deployment (100%)"
  
  rollback_criteria:
    error_rate_threshold: 1.0    # 1%以上でロールバック
    response_time_threshold: 3.0  # 3秒以上でロールバック
    business_metric_drop: 20.0    # 主要KPI20%低下でロールバック

# リリース日程
release_schedule:
  preparation_phase: "T-7日〜T-1日"
  release_window: "平日 10:00-16:00 JST"
  monitoring_period: "リリース後72時間"
  
# ステークホルダー
stakeholders:
  release_manager: "CTO"
  technical_lead: "Lead Engineer"  
  qa_lead: "QA Manager"
  business_owner: "Product Manager"
  communications: "Customer Success"
```

### 1.2 Go/No-Go 判定基準

#### release-planning/go-no-go-checklist.md
```markdown
# Go/No-Go 判定チェックリスト

## 📋 リリース前 72時間チェックリスト

### 技術的準備
- [ ] **テスト完了**: 全自動テストがパス (100%)
- [ ] **セキュリティ**: 脆弱性スキャンで重大な問題なし
- [ ] **パフォーマンス**: 負荷テストが基準値内
- [ ] **データベース**: マイグレーション準備完了
- [ ] **インフラ**: リソース容量確認済み
- [ ] **監視**: アラート・ダッシュボード設定済み
- [ ] **ロールバック**: 手順確認・テスト済み

### ビジネス準備
- [ ] **機能検証**: UAT (User Acceptance Test) 完了
- [ ] **ドキュメント**: ユーザー向け資料準備完了
- [ ] **サポート**: カスタマーサクセス体制整備
- [ ] **法務**: 利用規約・プライバシーポリシー承認
- [ ] **マーケティング**: 告知計画確定

### 運用準備
- [ ] **チーム体制**: オンコール・サポート要員確保
- [ ] **緊急連絡**: エスカレーション手順確認
- [ ] **外部連携**: パートナー企業への事前通知
- [ ] **バックアップ**: データベース・設定ファイル
- [ ] **容量計画**: トラフィック増加への対応

## 🚦 Go/No-Go 判定会議

### 開催タイミング
- **本会議**: リリース24時間前
- **最終確認**: リリース2時間前

### 参加者・判定権限
| 役割 | 担当者 | 拒否権 |
|------|--------|--------|
| **Release Manager** | CTO | ✅ |
| **Technical Lead** | Lead Engineer | ✅ |
| **QA Lead** | QA Manager | ✅ |
| **Business Owner** | Product Manager | ✅ |
| **Support Lead** | Customer Success | ⚠️ |

### 判定基準
- **GO**: 全チェック項目クリア + 全拒否権者の同意
- **NO-GO**: 重要項目1つでも未完了 OR 拒否権者1名でも反対

## ⚠️ No-Go 事例
- P1/P2 インシデント発生中
- 重要な依存サービスに問題
- 祝日・大型連休前後
- 主要顧客の重要イベント期間
- チームメンバーの大部分が不在
```

### 1.3 カナリアリリース実装

#### scripts/canary-release.sh
```bash
#!/bin/bash
set -e

# カナリアリリース自動化スクリプト

CANARY_PERCENTAGE=${1:-1}   # 開始時のトラフィック割合
TARGET_PERCENTAGE=${2:-100} # 最終目標割合
STEP_DURATION=${3:-600}     # 各段階の維持時間（秒）
MAX_ERROR_RATE=${4:-1.0}    # 最大許容エラー率（%）

echo "🕊️ Starting Canary Release"
echo "Initial: ${CANARY_PERCENTAGE}% → Target: ${TARGET_PERCENTAGE}%"

# リリース情報記録
RELEASE_ID="REL-$(date +%Y%m%d-%H%M%S)"
RELEASE_LOG="./release-logs/${RELEASE_ID}"
mkdir -p "$(dirname "$RELEASE_LOG")"

exec > >(tee -a "${RELEASE_LOG}.log")
exec 2>&1

echo "Release ID: $RELEASE_ID"
echo "Started by: $(whoami)"
echo "Timestamp: $(date)"

# 新バージョンデプロイ（カナリア環境）
deploy_canary_version() {
  echo "📦 Deploying canary version..."
  
  # Vercel プレビューデプロイ
  CANARY_URL=$(vercel --confirm | tail -1)
  echo "Canary URL: $CANARY_URL"
  
  # ヘルスチェック
  if ! curl -f -s --max-time 30 "${CANARY_URL}/api/health" > /dev/null; then
    echo "❌ Canary health check failed"
    exit 1
  fi
  
  echo "✅ Canary version deployed successfully"
  return 0
}

# トラフィック分割設定
configure_traffic_split() {
  local canary_percent=$1
  local production_percent=$((100 - canary_percent))
  
  echo "🔄 Configuring traffic split: ${canary_percent}% canary, ${production_percent}% production"
  
  # CloudFlare Load Balancer設定
  curl -X PUT "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/load_balancers/${LB_ID}" \
    -H "Authorization: Bearer ${CF_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "{
      \"name\": \"vegetable-system-lb\",
      \"default_pools\": [\"production-pool\", \"canary-pool\"],
      \"region_pools\": {
        \"WNAM\": [
          {\"pool_id\": \"production-pool\", \"weight\": ${production_percent}},
          {\"pool_id\": \"canary-pool\", \"weight\": ${canary_percent}}
        ]
      }
    }"
    
  # 設定確認待機
  sleep 30
  echo "✅ Traffic split configured"
}

# メトリクス監視
monitor_metrics() {
  local duration=$1
  local start_time=$(date +%s)
  local end_time=$((start_time + duration))
  
  echo "📊 Monitoring metrics for ${duration} seconds..."
  
  while [ $(date +%s) -lt $end_time ]; do
    # エラー率取得
    ERROR_RATE=$(curl -s "${MONITORING_API}/error-rate?source=canary&window=5m" || echo "0")
    
    # レスポンス時間取得  
    RESPONSE_TIME=$(curl -s "${MONITORING_API}/response-time?source=canary&window=5m" || echo "0")
    
    # ビジネスメトリクス取得
    CONVERSION_RATE=$(curl -s "${MONITORING_API}/conversion-rate?source=canary&window=5m" || echo "0")
    
    echo "$(date): Error Rate: ${ERROR_RATE}%, Response Time: ${RESPONSE_TIME}ms, Conversion: ${CONVERSION_RATE}%"
    
    # 閾値チェック
    if (( $(echo "${ERROR_RATE} > ${MAX_ERROR_RATE}" | bc -l) )); then
      echo "🚨 Error rate ${ERROR_RATE}% exceeds threshold ${MAX_ERROR_RATE}%"
      return 1
    fi
    
    if (( $(echo "${RESPONSE_TIME} > 3000" | bc -l) )); then
      echo "🚨 Response time ${RESPONSE_TIME}ms exceeds 3000ms threshold"
      return 1
    fi
    
    sleep 30
  done
  
  echo "✅ Metrics monitoring passed"
  return 0
}

# 段階的ロールアウト
gradual_rollout() {
  local current_percentage=$CANARY_PERCENTAGE
  
  # ロールアウト段階定義
  local stages=(1 5 10 25 50 100)
  
  for stage in "${stages[@]}"; do
    if [ $stage -gt $TARGET_PERCENTAGE ]; then
      stage=$TARGET_PERCENTAGE
    fi
    
    if [ $stage -le $current_percentage ]; then
      continue
    fi
    
    echo "📈 Rolling out to ${stage}%..."
    
    # トラフィック分割更新
    configure_traffic_split $stage
    
    # メトリクス監視
    if ! monitor_metrics $STEP_DURATION; then
      echo "❌ Metrics check failed at ${stage}%"
      rollback_release "Metrics threshold exceeded at ${stage}%"
      return 1
    fi
    
    current_percentage=$stage
    
    # 目標達成確認
    if [ $stage -eq $TARGET_PERCENTAGE ]; then
      echo "🎯 Target percentage ${TARGET_PERCENTAGE}% reached"
      break
    fi
    
    # 次の段階へ進む前の待機
    echo "⏳ Waiting before next stage..."
    sleep 60
  done
  
  return 0
}

# ロールバック実行
rollback_release() {
  local reason=$1
  
  echo "🔄 ROLLING BACK RELEASE"
  echo "Reason: $reason"
  
  # トラフィックを100%本番環境に戻す
  configure_traffic_split 0
  
  # カナリア環境停止
  # vercel remove $CANARY_URL --yes
  
  # インシデント通知
  curl -X POST $SLACK_INCIDENT_WEBHOOK \
    -H 'Content-type: application/json' \
    --data "{
      \"text\": \"🚨 CANARY RELEASE ROLLBACK\",
      \"attachments\": [{
        \"color\": \"danger\",
        \"fields\": [
          {\"title\": \"Release ID\", \"value\": \"$RELEASE_ID\", \"short\": true},
          {\"title\": \"Reason\", \"value\": \"$reason\", \"short\": false}
        ]
      }]
    }"
    
  echo "✅ Rollback completed"
  exit 1
}

# 完全デプロイ（カナリア成功時）
complete_deployment() {
  echo "🚀 Completing full deployment..."
  
  # プロダクションエイリアス更新
  vercel alias set $CANARY_URL vegetable-system.com
  
  # 旧バージョン停止（段階的）
  echo "♻️ Gracefully stopping old version..."
  sleep 300  # 5分間の猶予
  
  # 成功通知
  curl -X POST $SLACK_DEPLOYMENT_WEBHOOK \
    -H 'Content-type: application/json' \
    --data "{
      \"text\": \"✅ CANARY RELEASE SUCCESSFUL\",
      \"attachments\": [{
        \"color\": \"good\",
        \"fields\": [
          {\"title\": \"Release ID\", \"value\": \"$RELEASE_ID\", \"short\": true},
          {\"title\": \"Final Traffic\", \"value\": \"${TARGET_PERCENTAGE}%\", \"short\": true}
        ]
      }]
    }"
    
  echo "🎉 Canary release completed successfully!"
}

# メイン処理フロー
main() {
  # 事前チェック
  if ! curl -f -s --max-time 10 "https://vegetable-system.com/api/health" > /dev/null; then
    echo "❌ Production system is not healthy"
    exit 1
  fi
  
  # カナリア開始通知
  curl -X POST $SLACK_DEPLOYMENT_WEBHOOK \
    -H 'Content-type: application/json' \
    --data "{\"text\": \"🕊️ Canary release started: $RELEASE_ID\"}"
  
  # トラップ設定（緊急時のロールバック）
  trap 'rollback_release "Script interrupted"' INT TERM
  
  # 実行フロー
  deploy_canary_version
  
  if gradual_rollout; then
    if [ $TARGET_PERCENTAGE -eq 100 ]; then
      complete_deployment
    else
      echo "✅ Canary release completed at ${TARGET_PERCENTAGE}%"
    fi
  else
    echo "❌ Canary release failed"
    exit 1
  fi
}

# 実行
main "$@"
```

## 2. ロールバック準備・実行計画

### 2.1 ロールバック戦略

#### rollback/rollback-strategy.md
```markdown
# ロールバック戦略・実行計画

## 🔄 ロールバック種別

### Level 1: Traffic Rollback （トラフィック切り戻し）
- **実行時間**: 30秒
- **影響**: なし
- **対象**: CDN・ロードバランサー設定
- **適用場面**: パフォーマンス問題、軽微なバグ

### Level 2: Application Rollback （アプリケーション巻き戻し）
- **実行時間**: 5分
- **影響**: 30秒程度の短時間ダウンタイム可能性
- **対象**: アプリケーションコード
- **適用場面**: 機能バグ、UI問題

### Level 3: Database Rollback （データベース巻き戻し）
- **実行時間**: 30分〜2時間
- **影響**: サービス停止
- **対象**: データベーススキーマ・データ
- **適用場面**: データ破損、重大なマイグレーション問題

### Level 4: Full System Rollback （完全システム巻き戻し）
- **実行時間**: 1〜4時間
- **影響**: 完全サービス停止
- **対象**: 全システムコンポーネント
- **適用場面**: 重大なシステム障害

## 🚨 自動ロールバック条件

### 技術的トリガー
```yaml
auto_rollback_conditions:
  error_rate:
    threshold: 5.0          # 5%
    window: "10m"           # 10分間の平均
    
  response_time:
    threshold: 5000         # 5秒
    percentile: 95          # 95パーセンタイル
    window: "5m"
    
  availability:
    threshold: 99.0         # 99%
    window: "15m"
    
  business_metrics:
    conversion_drop: 30.0   # 30%低下
    user_drop: 50.0         # 50%低下
    window: "30m"
```

### 手動ロールバック判定基準
- セキュリティインシデント発生
- データ整合性問題発見
- 重要顧客からの重大苦情
- 法的・コンプライアンス問題
- 経営判断による中止
```

### 2.2 自動ロールバックシステム

#### scripts/auto-rollback-system.js
```javascript
// 自動ロールバック監視システム
import { MetricsCollector } from './metrics-collector.js'
import { RollbackExecutor } from './rollback-executor.js'

class AutoRollbackSystem {
  constructor(config) {
    this.config = {
      checkInterval: 60000, // 1分間隔
      thresholds: {
        errorRate: 5.0,          // 5%
        responseTime: 5000,      // 5秒
        availability: 99.0,      // 99%
        conversionDrop: 30.0     // 30%
      },
      windows: {
        errorRate: 10 * 60 * 1000,     // 10分
        responseTime: 5 * 60 * 1000,   // 5分
        availability: 15 * 60 * 1000,  // 15分
        conversion: 30 * 60 * 1000     // 30分
      },
      ...config
    }
    
    this.metrics = new MetricsCollector()
    this.rollback = new RollbackExecutor()
    this.isMonitoring = false
    this.currentRelease = null
  }

  startMonitoring(releaseId) {
    if (this.isMonitoring) {
      console.warn('Auto-rollback monitoring already active')
      return
    }

    this.currentRelease = releaseId
    this.isMonitoring = true
    
    console.log(`🔍 Starting auto-rollback monitoring for release: ${releaseId}`)
    
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkMetrics()
      } catch (error) {
        console.error('Auto-rollback check failed:', error)
      }
    }, this.config.checkInterval)
    
    // 4時間後に自動停止（通常のリリース監視期間）
    this.stopTimeout = setTimeout(() => {
      this.stopMonitoring()
      console.log('✅ Auto-rollback monitoring completed (4 hours elapsed)')
    }, 4 * 60 * 60 * 1000)
  }

  stopMonitoring() {
    if (!this.isMonitoring) return
    
    this.isMonitoring = false
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
    }
    
    if (this.stopTimeout) {
      clearTimeout(this.stopTimeout)
    }
    
    console.log('🛑 Auto-rollback monitoring stopped')
  }

  async checkMetrics() {
    if (!this.isMonitoring) return

    const checks = await Promise.all([
      this.checkErrorRate(),
      this.checkResponseTime(), 
      this.checkAvailability(),
      this.checkBusinessMetrics()
    ])

    const failedChecks = checks.filter(check => !check.passed)
    
    if (failedChecks.length > 0) {
      console.warn('⚠️ Rollback conditions detected:', failedChecks)
      
      // 複数の条件で失敗した場合は即座にロールバック
      if (failedChecks.length >= 2 || failedChecks.some(c => c.severity === 'critical')) {
        await this.executeAutoRollback(failedChecks)
      }
    } else {
      console.log('✅ All metrics within acceptable range')
    }
  }

  async checkErrorRate() {
    const errorRate = await this.metrics.getErrorRate(this.config.windows.errorRate)
    const threshold = this.config.thresholds.errorRate
    
    const passed = errorRate <= threshold
    
    return {
      name: 'error_rate',
      passed,
      value: errorRate,
      threshold,
      severity: passed ? 'normal' : (errorRate > threshold * 2 ? 'critical' : 'warning'),
      message: `Error rate: ${errorRate.toFixed(2)}% (threshold: ${threshold}%)`
    }
  }

  async checkResponseTime() {
    const responseTime = await this.metrics.getResponseTime95th(this.config.windows.responseTime)
    const threshold = this.config.thresholds.responseTime
    
    const passed = responseTime <= threshold
    
    return {
      name: 'response_time',
      passed,
      value: responseTime,
      threshold,
      severity: passed ? 'normal' : 'warning',
      message: `95th percentile response time: ${responseTime}ms (threshold: ${threshold}ms)`
    }
  }

  async checkAvailability() {
    const availability = await this.metrics.getAvailability(this.config.windows.availability)
    const threshold = this.config.thresholds.availability
    
    const passed = availability >= threshold
    
    return {
      name: 'availability',
      passed,
      value: availability,
      threshold,
      severity: passed ? 'normal' : 'critical',
      message: `Availability: ${availability.toFixed(2)}% (threshold: ${threshold}%)`
    }
  }

  async checkBusinessMetrics() {
    const conversionRate = await this.metrics.getConversionRate(this.config.windows.conversion)
    const baselineConversion = await this.metrics.getBaselineConversionRate()
    
    const dropPercentage = ((baselineConversion - conversionRate) / baselineConversion) * 100
    const threshold = this.config.thresholds.conversionDrop
    
    const passed = dropPercentage <= threshold
    
    return {
      name: 'business_metrics',
      passed,
      value: dropPercentage,
      threshold,
      severity: passed ? 'normal' : 'critical',
      message: `Conversion drop: ${dropPercentage.toFixed(1)}% (threshold: ${threshold}%)`
    }
  }

  async executeAutoRollback(failedChecks) {
    console.log('🚨 EXECUTING AUTO-ROLLBACK')
    
    this.stopMonitoring() // 監視停止
    
    const rollbackReason = `Auto-rollback triggered: ${failedChecks.map(c => c.message).join(', ')}`
    
    try {
      // 緊急通知送信
      await this.sendEmergencyAlert(rollbackReason, failedChecks)
      
      // ロールバック実行
      const rollbackResult = await this.rollback.executeEmergencyRollback({
        releaseId: this.currentRelease,
        reason: rollbackReason,
        triggeredBy: 'auto-rollback-system',
        failedChecks: failedChecks
      })
      
      if (rollbackResult.success) {
        console.log('✅ Auto-rollback completed successfully')
        await this.sendRollbackSuccessNotification(rollbackResult)
      } else {
        console.error('❌ Auto-rollback failed')
        await this.sendRollbackFailureAlert(rollbackResult.error)
      }
      
    } catch (error) {
      console.error('❌ Auto-rollback system error:', error)
      await this.sendRollbackFailureAlert(error.message)
    }
  }

  async sendEmergencyAlert(reason, failedChecks) {
    const message = {
      text: `🚨 EMERGENCY AUTO-ROLLBACK INITIATED`,
      channel: '#incidents',
      attachments: [{
        color: 'danger',
        fields: [
          {
            title: 'Release ID',
            value: this.currentRelease,
            short: true
          },
          {
            title: 'Trigger Reason',
            value: reason,
            short: false
          },
          {
            title: 'Failed Checks',
            value: failedChecks.map(c => `• ${c.message}`).join('\n'),
            short: false
          },
          {
            title: 'Timestamp',
            value: new Date().toISOString(),
            short: true
          }
        ]
      }]
    }

    // Slack通知
    if (process.env.SLACK_EMERGENCY_WEBHOOK) {
      await fetch(process.env.SLACK_EMERGENCY_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      })
    }

    // PagerDuty通知
    if (process.env.PAGERDUTY_ROUTING_KEY) {
      await fetch('https://events.pagerduty.com/v2/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routing_key: process.env.PAGERDUTY_ROUTING_KEY,
          event_action: 'trigger',
          payload: {
            summary: `Auto-rollback initiated for release ${this.currentRelease}`,
            severity: 'critical',
            source: 'auto-rollback-system',
            custom_details: {
              release_id: this.currentRelease,
              failed_checks: failedChecks
            }
          }
        })
      })
    }
  }

  async sendRollbackSuccessNotification(result) {
    const message = {
      text: `✅ Auto-rollback completed successfully`,
      channel: '#deployments',
      attachments: [{
        color: 'good',
        fields: [
          {
            title: 'Release ID',
            value: this.currentRelease,
            short: true
          },
          {
            title: 'Rollback Duration',
            value: result.duration,
            short: true
          },
          {
            title: 'Recovery Status',
            value: 'System monitoring resumed',
            short: false
          }
        ]
      }]
    }

    await fetch(process.env.SLACK_DEPLOYMENT_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    })
  }

  async sendRollbackFailureAlert(error) {
    const message = {
      text: `❌ CRITICAL: Auto-rollback FAILED`,
      channel: '#incidents',
      attachments: [{
        color: 'danger',
        fields: [
          {
            title: 'Release ID',
            value: this.currentRelease,
            short: true
          },
          {
            title: 'Error',
            value: error,
            short: false
          },
          {
            title: 'Action Required',
            value: 'IMMEDIATE MANUAL INTERVENTION REQUIRED',
            short: false
          }
        ]
      }]
    }

    // 複数チャンネルに緊急通知
    const webhooks = [
      process.env.SLACK_EMERGENCY_WEBHOOK,
      process.env.SLACK_INCIDENT_WEBHOOK
    ]

    for (const webhook of webhooks) {
      if (webhook) {
        await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message)
        })
      }
    }
  }
}

export { AutoRollbackSystem }

// 使用例
if (process.env.NODE_ENV === 'production') {
  const autoRollback = new AutoRollbackSystem({
    thresholds: {
      errorRate: 3.0,      // 本番環境では3%で自動ロールバック
      responseTime: 3000,   // 3秒
      availability: 99.5,   // 99.5%
      conversionDrop: 25.0  // 25%
    }
  })

  // リリース監視開始の例
  // autoRollback.startMonitoring('REL-20241215-143022')
}
```

## 3. リリース後監視・検証

### 3.1 リリース検証チェックリスト

#### release-planning/post-release-verification.md
```markdown
# リリース後検証チェックリスト

## 🔍 即座確認（リリース後15分以内）

### 基本動作確認
- [ ] **トップページ**: 正常表示・レスポンス時間
- [ ] **ログイン機能**: 認証フロー正常動作
- [ ] **主要API**: vegetables, dashboard, photos API
- [ ] **データベース**: 接続・クエリ実行
- [ ] **ファイルアップロード**: 写真アップロード機能

### システム指標確認
- [ ] **エラー率**: < 1%
- [ ] **レスポンス時間**: P95 < 2秒
- [ ] **CPU使用率**: < 70%
- [ ] **メモリ使用率**: < 80%
- [ ] **データベース接続数**: 正常範囲内

## 📊 短期監視（リリース後2時間以内）

### パフォーマンス指標
- [ ] **スループット**: 基準値との比較
- [ ] **Core Web Vitals**: LCP, FID, CLS測定
- [ ] **CDNキャッシュ率**: > 80%
- [ ] **データベースクエリ時間**: P95 < 100ms

### ビジネス指標
- [ ] **アクティブユーザー数**: 前日同時間比較
- [ ] **新規登録数**: 正常レベル
- [ ] **野菜登録数**: 正常レベル  
- [ ] **写真アップロード数**: 正常レベル

### エラー監視
- [ ] **JavaScriptエラー**: 新規エラー確認
- [ ] **APIエラー**: 4xx/5xx エラー率
- [ ] **データベースエラー**: 接続・クエリエラー
- [ ] **外部サービスエラー**: Supabase, OpenAI連携

## 🧪 機能検証（リリース後24時間以内）

### エンドツーエンドテスト
```bash
# 自動E2Eテスト実行
npm run test:e2e:production

# 主要ユーザーフロー確認
./scripts/verify-user-flows.sh
```

### ユーザーフィードバック収集
- [ ] **カスタマーサポート**: 問い合わせ状況確認
- [ ] **ユーザーアンケート**: NPS, 満足度調査
- [ ] **行動分析**: ユーザー行動パターン変化
- [ ] **A/Bテスト**: 新機能の効果測定

## 📈 長期監視（リリース後72時間）

### 安定性確認
- [ ] **システム稼働率**: 99.9%以上維持
- [ ] **パフォーマンス一貫性**: 指標の安定性
- [ ] **リソース使用量**: 増加傾向の確認
- [ ] **バックアップ**: 正常実行確認

### ビジネス影響分析
- [ ] **収益指標**: 売上・利用料収入
- [ ] **ユーザー維持率**: チャーン率の変化
- [ ] **機能利用率**: 新機能の採用状況
- [ ] **カスタマーサポート負荷**: 問い合わせ増減

## 🎯 成功基準

### 技術的成功基準
| 指標 | 目標値 | 測定期間 |
|------|--------|----------|
| システム稼働率 | > 99.9% | 72時間 |
| エラー率 | < 0.5% | 72時間 |
| レスポンス時間 P95 | < 2秒 | 72時間 |
| ユーザー苦情 | < 5件 | 72時間 |

### ビジネス成功基準
| 指標 | 目標値 | 測定期間 |
|------|--------|----------|
| アクティブユーザー減少 | < 5% | 7日間 |
| 新規登録減少 | < 10% | 7日間 |
| NPS スコア低下 | < 10ポイント | 30日間 |
| カスタマーサポート負荷 | < 20%増 | 7日間 |

## 🚨 アラート・エスカレーション

### 即座対応（Critical）
- システム稼働率 < 95%
- エラー率 > 5%
- 主要機能停止
- セキュリティインシデント

### 短期対応（High）  
- パフォーマンス劣化 > 50%
- ユーザー苦情 > 10件/日
- ビジネス指標低下 > 20%

### 中期対応（Medium）
- 軽微なバグ報告
- UI/UX改善要望
- パフォーマンス最適化要望
```

### 3.2 リリース後レポート自動生成

#### scripts/post-release-report.js
```javascript
// リリース後レポート自動生成
import { MetricsCollector } from './metrics-collector.js'
import { ReportGenerator } from './report-generator.js'

class PostReleaseReportGenerator {
  constructor(releaseId) {
    this.releaseId = releaseId
    this.metrics = new MetricsCollector()
    this.reportData = {}
  }

  async generateComprehensiveReport(hours = 72) {
    console.log(`📊 Generating ${hours}h post-release report for ${this.releaseId}`)
    
    const endTime = new Date()
    const startTime = new Date(endTime.getTime() - (hours * 60 * 60 * 1000))

    // データ収集
    await this.collectSystemMetrics(startTime, endTime)
    await this.collectBusinessMetrics(startTime, endTime)
    await this.collectUserFeedback(startTime, endTime)
    await this.collectIncidentData(startTime, endTime)

    // レポート生成
    const report = this.compileReport()
    
    // 保存
    const reportPath = `./release-reports/${this.releaseId}_${hours}h_report.json`
    await this.saveReport(report, reportPath)
    
    // HTML版生成
    const htmlReport = await this.generateHTMLReport(report)
    await this.saveHTMLReport(htmlReport, reportPath.replace('.json', '.html'))
    
    // 通知送信
    await this.sendReportNotification(report)
    
    return report
  }

  async collectSystemMetrics(startTime, endTime) {
    this.reportData.system = {
      availability: await this.metrics.getAvailability(startTime, endTime),
      errorRate: await this.metrics.getErrorRate(startTime, endTime),
      responseTime: {
        p50: await this.metrics.getResponseTimePercentile(50, startTime, endTime),
        p95: await this.metrics.getResponseTimePercentile(95, startTime, endTime),
        p99: await this.metrics.getResponseTimePercentile(99, startTime, endTime)
      },
      throughput: await this.metrics.getThroughput(startTime, endTime),
      resourceUsage: {
        cpu: await this.metrics.getCPUUsage(startTime, endTime),
        memory: await this.metrics.getMemoryUsage(startTime, endTime),
        database: await this.metrics.getDatabaseMetrics(startTime, endTime)
      }
    }
  }

  async collectBusinessMetrics(startTime, endTime) {
    this.reportData.business = {
      activeUsers: await this.metrics.getActiveUsers(startTime, endTime),
      newRegistrations: await this.metrics.getNewRegistrations(startTime, endTime),
      vegetableCreations: await this.metrics.getVegetableCreations(startTime, endTime),
      photoUploads: await this.metrics.getPhotoUploads(startTime, endTime),
      conversionRate: await this.metrics.getConversionRate(startTime, endTime),
      retention: await this.metrics.getUserRetention(startTime, endTime)
    }
  }

  async collectUserFeedback(startTime, endTime) {
    this.reportData.feedback = {
      supportTickets: await this.getSupport TicketsCount(startTime, endTime),
      userComplaints: await this.getUserComplaints(startTime, endTime),
      npsScore: await this.getNPSScore(startTime, endTime),
      featureUsage: await this.getFeatureUsageStats(startTime, endTime)
    }
  }

  async collectIncidentData(startTime, endTime) {
    this.reportData.incidents = {
      count: await this.getIncidentCount(startTime, endTime),
      severity: await this.getIncidentsBySeverity(startTime, endTime),
      mttr: await this.getMeanTimeToRecovery(startTime, endTime),
      details: await this.getIncidentDetails(startTime, endTime)
    }
  }

  compileReport() {
    const report = {
      releaseId: this.releaseId,
      generatedAt: new Date().toISOString(),
      period: {
        start: new Date(Date.now() - (72 * 60 * 60 * 1000)).toISOString(),
        end: new Date().toISOString()
      },
      
      // 総合評価
      overallAssessment: this.calculateOverallAssessment(),
      
      // 詳細データ
      ...this.reportData,
      
      // 推奨事項
      recommendations: this.generateRecommendations(),
      
      // 次回リリースへの改善点
      improvements: this.generateImprovements()
    }

    return report
  }

  calculateOverallAssessment() {
    const { system, business, feedback, incidents } = this.reportData
    
    // 各カテゴリのスコア計算（0-100）
    const systemScore = this.calculateSystemScore(system)
    const businessScore = this.calculateBusinessScore(business)
    const feedbackScore = this.calculateFeedbackScore(feedback)
    const stabilityScore = this.calculateStabilityScore(incidents)
    
    // 重み付き平均
    const overallScore = (
      systemScore * 0.3 +
      businessScore * 0.3 +
      feedbackScore * 0.2 +
      stabilityScore * 0.2
    )
    
    return {
      score: Math.round(overallScore),
      grade: this.getGrade(overallScore),
      breakdown: {
        system: systemScore,
        business: businessScore,
        feedback: feedbackScore,
        stability: stabilityScore
      }
    }
  }

  calculateSystemScore(system) {
    let score = 100
    
    // 可用性
    if (system.availability < 99.9) score -= 20
    else if (system.availability < 99.95) score -= 10
    
    // エラー率
    if (system.errorRate > 1.0) score -= 25
    else if (system.errorRate > 0.5) score -= 10
    
    // レスポンス時間
    if (system.responseTime.p95 > 3000) score -= 20
    else if (system.responseTime.p95 > 2000) score -= 10
    
    return Math.max(0, score)
  }

  calculateBusinessScore(business) {
    let score = 100
    
    // ユーザー数の変化（前週同期比）
    const userChangePercent = business.activeUsers.changePercent || 0
    if (userChangePercent < -10) score -= 30
    else if (userChangePercent < -5) score -= 15
    else if (userChangePercent > 10) score += 10 // ボーナス
    
    // コンバージョン率の変化
    const conversionChange = business.conversionRate.changePercent || 0
    if (conversionChange < -15) score -= 25
    else if (conversionChange < -5) score -= 10
    
    return Math.max(0, Math.min(100, score))
  }

  getGrade(score) {
    if (score >= 90) return 'A'
    if (score >= 80) return 'B'
    if (score >= 70) return 'C'
    if (score >= 60) return 'D'
    return 'F'
  }

  generateRecommendations() {
    const recommendations = []
    const { system, business, incidents } = this.reportData
    
    // システム関連推奨事項
    if (system.errorRate > 0.5) {
      recommendations.push({
        category: 'System',
        priority: 'High',
        issue: 'High error rate detected',
        recommendation: 'Investigate and fix the root causes of errors. Consider implementing additional error handling and monitoring.'
      })
    }
    
    if (system.responseTime.p95 > 2000) {
      recommendations.push({
        category: 'Performance',
        priority: 'Medium',
        issue: 'Response time degradation',
        recommendation: 'Optimize database queries, implement caching strategies, and consider scaling infrastructure.'
      })
    }
    
    // ビジネス関連推奨事項
    if (business.conversionRate.changePercent < -10) {
      recommendations.push({
        category: 'Business',
        priority: 'High',
        issue: 'Conversion rate drop',
        recommendation: 'Analyze user behavior changes and A/B test alternative UI/UX approaches.'
      })
    }
    
    // インシデント関連推奨事項
    if (incidents.count > 2) {
      recommendations.push({
        category: 'Stability',
        priority: 'High',
        issue: 'Multiple incidents occurred',
        recommendation: 'Conduct root cause analysis for all incidents and implement preventive measures.'
      })
    }
    
    return recommendations
  }

  async generateHTMLReport(report) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Post-Release Report - ${report.releaseId}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .header { background: #f8f9fa; padding: 20px; border-radius: 8px; }
            .score { font-size: 48px; font-weight: bold; color: ${this.getScoreColor(report.overallAssessment.score)}; }
            .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
            .metric-card { background: white; border: 1px solid #ddd; border-radius: 8px; padding: 15px; }
            .recommendation { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 10px 0; }
            .success { color: #28a745; }
            .warning { color: #ffc107; }
            .danger { color: #dc3545; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Post-Release Report</h1>
            <h2>Release ID: ${report.releaseId}</h2>
            <div class="score">${report.overallAssessment.score}/100 (${report.overallAssessment.grade})</div>
            <p>Generated: ${new Date(report.generatedAt).toLocaleString()}</p>
        </div>

        <h2>System Metrics</h2>
        <div class="metric-grid">
            <div class="metric-card">
                <h3>Availability</h3>
                <div class="score ${report.system.availability >= 99.9 ? 'success' : 'danger'}">
                    ${report.system.availability.toFixed(3)}%
                </div>
            </div>
            <div class="metric-card">
                <h3>Error Rate</h3>
                <div class="score ${report.system.errorRate <= 0.5 ? 'success' : 'danger'}">
                    ${report.system.errorRate.toFixed(2)}%
                </div>
            </div>
            <div class="metric-card">
                <h3>Response Time (P95)</h3>
                <div class="score ${report.system.responseTime.p95 <= 2000 ? 'success' : 'warning'}">
                    ${report.system.responseTime.p95}ms
                </div>
            </div>
        </div>

        <h2>Recommendations</h2>
        ${report.recommendations.map(rec => `
            <div class="recommendation">
                <strong>${rec.category} - ${rec.priority}:</strong> ${rec.issue}<br>
                <em>${rec.recommendation}</em>
            </div>
        `).join('')}
    </body>
    </html>
    `
  }

  getScoreColor(score) {
    if (score >= 90) return '#28a745'
    if (score >= 70) return '#ffc107' 
    return '#dc3545'
  }

  async sendReportNotification(report) {
    const message = {
      text: `📊 Post-Release Report Available`,
      channel: '#deployments',
      attachments: [{
        color: report.overallAssessment.score >= 80 ? 'good' : 
               report.overallAssessment.score >= 60 ? 'warning' : 'danger',
        fields: [
          {
            title: 'Release ID',
            value: report.releaseId,
            short: true
          },
          {
            title: 'Overall Score',
            value: `${report.overallAssessment.score}/100 (${report.overallAssessment.grade})`,
            short: true
          },
          {
            title: 'System Health',
            value: `${report.system.availability.toFixed(2)}% uptime, ${report.system.errorRate.toFixed(2)}% errors`,
            short: false
          },
          {
            title: 'Recommendations',
            value: `${report.recommendations.length} items identified`,
            short: true
          }
        ]
      }]
    }

    if (process.env.SLACK_DEPLOYMENT_WEBHOOK) {
      await fetch(process.env.SLACK_DEPLOYMENT_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      })
    }
  }
}

export { PostReleaseReportGenerator }
```

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"content": "\u672c\u756a\u74b0\u5883\u69cb\u7bc9\u30fb\u30a4\u30f3\u30d5\u30e9\u8a2d\u8a08", "status": "completed", "id": "1"}, {"content": "\u30bb\u30ad\u30e5\u30ea\u30c6\u30a3\u5f37\u5316\u30fb\u8106\u5f31\u6027\u5bfe\u7b56", "status": "completed", "id": "2"}, {"content": "\u30d1\u30d5\u30a9\u30fc\u30de\u30f3\u30b9\u6700\u9069\u5316\u30fb\u76e3\u8996\u8a2d\u5b9a", "status": "completed", "id": "3"}, {"content": "\u30c7\u30fc\u30bf\u30d9\u30fc\u30b9\u672c\u756a\u8a2d\u5b9a\u30fb\u30d0\u30c3\u30af\u30a2\u30c3\u30d7", "status": "completed", "id": "4"}, {"content": "CI/CD \u30d1\u30a4\u30d7\u30e9\u30a4\u30f3\u69cb\u7bc9", "status": "completed", "id": "5"}, {"content": "\u30c9\u30e1\u30a4\u30f3\u30fbSSL\u30fbCDN\u8a2d\u5b9a", "status": "completed", "id": "6"}, {"content": "\u76e3\u8996\u30fb\u30ed\u30ae\u30f3\u30b0\u30fb\u30a2\u30e9\u30fc\u30c8\u8a2d\u5b9a", "status": "completed", "id": "7"}, {"content": "\u707d\u5bb3\u5bfe\u7b56\u30fb\u4e8b\u696d\u7d99\u7d9a\u8a08\u753b", "status": "completed", "id": "8"}, {"content": "\u6cd5\u7684\u5bfe\u5fdc\u30fb\u5229\u7528\u898f\u7d04\u30fb\u30d7\u30e9\u30a4\u30d0\u30b7\u30fc", "status": "completed", "id": "9"}, {"content": "\u8ca0\u8377\u30c6\u30b9\u30c8\u30fb\u30bb\u30ad\u30e5\u30ea\u30c6\u30a3\u30c6\u30b9\u30c8", "status": "completed", "id": "10"}, {"content": "\u30c9\u30ad\u30e5\u30e1\u30f3\u30c8\u6574\u5099\u30fb\u904b\u7528\u624b\u9806", "status": "completed", "id": "11"}, {"content": "\u30ea\u30ea\u30fc\u30b9\u8a08\u753b\u30fb\u30ed\u30fc\u30eb\u30d0\u30c3\u30af\u6e96\u5099", "status": "completed", "id": "12"}]