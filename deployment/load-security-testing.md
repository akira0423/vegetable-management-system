# 負荷テスト・セキュリティテスト実行計画

## 1. 負荷テスト戦略

### 1.1 テスト計画概要

| **項目** | **目標値** | **測定指標** |
|----------|-----------|-------------|
| **同時接続数** | 1,000ユーザー | 応答時間 < 2秒 |
| **スループット** | 500 req/sec | エラー率 < 1% |
| **可用性** | 99.9% | 継続運用時間 |
| **データ処理** | 10,000レコード/日 | 処理成功率 > 99% |

### 1.2 負荷テストシナリオ

#### tests/load/k6-scenarios.js
```javascript
// K6負荷テストスクリプト
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

// カスタムメトリクス
export const errorRate = new Rate('errors')
export const customTrend = new Trend('custom_response_time')

// テスト設定
export const options = {
  scenarios: {
    // 段階的負荷増加テスト
    ramping_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },   // 2分で100ユーザーまで増加
        { duration: '5m', target: 100 },   // 5分間100ユーザー維持
        { duration: '2m', target: 300 },   // 2分で300ユーザーまで増加
        { duration: '5m', target: 300 },   // 5分間300ユーザー維持
        { duration: '2m', target: 600 },   // 2分で600ユーザーまで増加
        { duration: '10m', target: 600 },  // 10分間600ユーザー維持
        { duration: '3m', target: 0 }      // 3分でユーザー数を0に減少
      ]
    },

    // スパイクテスト（急激な負荷増加）
    spike_test: {
      executor: 'ramping-vus',
      startTime: '30m',
      stages: [
        { duration: '10s', target: 1000 }, // 10秒で1000ユーザー
        { duration: '1m', target: 1000 },  // 1分間維持
        { duration: '10s', target: 0 }     // 10秒で0に
      ]
    },

    // 持久力テスト（長時間テスト）
    endurance_test: {
      executor: 'constant-vus',
      vus: 200,
      duration: '2h',
      startTime: '45m'
    }
  },

  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<3000'], // 95%が2秒以内、99%が3秒以内
    http_req_failed: ['rate<0.01'],                   // エラー率1%未満
    'http_req_duration{name:api_vegetables}': ['p(95)<1000'], // 野菜API専用閾値
    errors: ['rate<0.01']                            // カスタムエラー率
  }
}

// テスト用データ
const BASE_URL = __ENV.BASE_URL || 'https://vegetable-system.com'
const API_KEY = __ENV.API_KEY || ''

// 認証トークンプール
let authTokens = []

export function setup() {
  console.log('🚀 Load test setup started')
  
  // テスト用認証トークンを事前生成
  for (let i = 0; i < 100; i++) {
    const loginRes = http.post(`${BASE_URL}/api/auth/login`, {
      email: `loadtest${i}@example.com`,
      password: 'LoadTest123!'
    })
    
    if (loginRes.status === 200) {
      authTokens.push(JSON.parse(loginRes.body).token)
    }
  }
  
  console.log(`Generated ${authTokens.length} auth tokens`)
  return { authTokens }
}

export default function(data) {
  const token = data.authTokens[Math.floor(Math.random() * data.authTokens.length)]
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }

  // シナリオ1: ダッシュボードアクセス
  dashboardScenario(headers)
  
  // シナリオ2: 野菜データ操作
  vegetableManagementScenario(headers)
  
  // シナリオ3: 写真アップロード
  photoUploadScenario(headers)
  
  sleep(Math.random() * 3 + 1) // 1-4秒のランダム待機
}

function dashboardScenario(headers) {
  const startTime = Date.now()
  
  // ダッシュボードデータ取得
  const dashboardRes = http.get(`${BASE_URL}/api/dashboard`, { headers })
  
  const responseTime = Date.now() - startTime
  customTrend.add(responseTime, { scenario: 'dashboard' })
  
  const success = check(dashboardRes, {
    'dashboard status is 200': (r) => r.status === 200,
    'dashboard response time < 2s': (r) => r.timings.duration < 2000,
    'dashboard has data': (r) => JSON.parse(r.body).data !== undefined
  })
  
  errorRate.add(!success, { scenario: 'dashboard' })
}

function vegetableManagementScenario(headers) {
  // 野菜一覧取得
  const listRes = http.get(`${BASE_URL}/api/vegetables?limit=20`, { headers })
  
  check(listRes, {
    'vegetables list status is 200': (r) => r.status === 200,
    'vegetables list response time < 1s': (r) => r.timings.duration < 1000
  })

  // 新しい野菜データ作成（10%の確率）
  if (Math.random() < 0.1) {
    const vegetableData = {
      name: `テスト野菜${Math.floor(Math.random() * 1000)}`,
      variety_name: 'テスト品種',
      plot_name: 'テスト圃場',
      plot_size: Math.floor(Math.random() * 100) + 10,
      planting_date: new Date().toISOString(),
      expected_harvest_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
    }

    const createRes = http.post(`${BASE_URL}/api/vegetables`, JSON.stringify(vegetableData), { headers })
    
    check(createRes, {
      'vegetable creation status is 201': (r) => r.status === 201,
      'vegetable creation response time < 3s': (r) => r.timings.duration < 3000
    })
  }
}

function photoUploadScenario(headers) {
  // 写真アップロード（5%の確率）
  if (Math.random() < 0.05) {
    // ダミー画像データ（Base64エンコード済みの小さな画像）
    const dummyImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
    
    const uploadData = {
      file: dummyImageData,
      vegetable_id: 'test-vegetable-id',
      description: 'Load test photo'
    }

    const uploadRes = http.post(`${BASE_URL}/api/photos`, JSON.stringify(uploadData), { headers })
    
    check(uploadRes, {
      'photo upload status is 201': (r) => r.status === 201 || r.status === 400, // 400は予想される（テストデータのため）
      'photo upload response time < 5s': (r) => r.timings.duration < 5000
    })
  }
}

export function teardown(data) {
  console.log('🏁 Load test teardown completed')
  
  // テスト後のクリーンアップ（必要に応じて）
  // テスト用データの削除等
}
```

### 1.3 負荷テスト実行スクリプト

#### scripts/run-load-tests.sh
```bash
#!/bin/bash
set -e

# 負荷テスト実行スクリプト

TEST_ENVIRONMENT=${1:-"staging"}
TEST_TYPE=${2:-"smoke"} # smoke, load, stress, spike, endurance
REPORT_DIR="./test-reports/load-tests"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "🚀 Starting load tests: $TEST_TYPE on $TEST_ENVIRONMENT"

# レポートディレクトリ作成
mkdir -p $REPORT_DIR

# 環境別設定
case $TEST_ENVIRONMENT in
  "staging")
    BASE_URL="https://staging.vegetable-system.com"
    MAX_VUS=100
    ;;
  "production")
    BASE_URL="https://vegetable-system.com"
    MAX_VUS=1000
    echo "⚠️  Production load testing - proceed with caution!"
    read -p "Continue? (y/N): " confirm
    [[ $confirm == [yY] ]] || exit 1
    ;;
  *)
    echo "❌ Unknown environment: $TEST_ENVIRONMENT"
    exit 1
    ;;
esac

# テストタイプ別設定
case $TEST_TYPE in
  "smoke")
    TEST_FILE="tests/load/smoke-test.js"
    DURATION="2m"
    VUS=10
    ;;
  "load")
    TEST_FILE="tests/load/k6-scenarios.js"
    DURATION="30m"
    VUS=$MAX_VUS
    ;;
  "stress")
    TEST_FILE="tests/load/stress-test.js"
    DURATION="10m"
    VUS=$((MAX_VUS * 2))
    ;;
  "spike")
    TEST_FILE="tests/load/spike-test.js"
    DURATION="5m"
    VUS=$((MAX_VUS * 3))
    ;;
  "endurance")
    TEST_FILE="tests/load/endurance-test.js"
    DURATION="2h"
    VUS=$((MAX_VUS / 2))
    ;;
esac

echo "📋 Test Configuration:"
echo "  Environment: $TEST_ENVIRONMENT"
echo "  Base URL: $BASE_URL"
echo "  Test Type: $TEST_TYPE"
echo "  Duration: $DURATION"
echo "  Max VUs: $VUS"

# システムリソース監視開始
echo "📊 Starting system monitoring..."
start_monitoring() {
  # CPU・メモリ監視
  top -b -d 5 > "$REPORT_DIR/system_resources_${TIMESTAMP}.log" &
  MONITORING_PID=$!
  
  # ネットワーク監視
  iftop -t -s 5 > "$REPORT_DIR/network_usage_${TIMESTAMP}.log" &
  NETWORK_PID=$!
  
  return 0
}

stop_monitoring() {
  if [ ! -z "$MONITORING_PID" ]; then
    kill $MONITORING_PID 2>/dev/null || true
  fi
  if [ ! -z "$NETWORK_PID" ]; then
    kill $NETWORK_PID 2>/dev/null || true
  fi
}

# トラップ設定（Ctrl+C対応）
trap stop_monitoring EXIT

# 事前チェック
echo "🔍 Pre-test health check..."
if ! curl -f -s --max-time 10 "$BASE_URL/api/health" > /dev/null; then
  echo "❌ Target system is not healthy!"
  exit 1
fi

# 負荷テスト実行
echo "🏃 Running load test..."
start_monitoring

k6 run \
  --env BASE_URL="$BASE_URL" \
  --env API_KEY="$API_KEY" \
  --vus "$VUS" \
  --duration "$DURATION" \
  --out json="$REPORT_DIR/results_${TEST_TYPE}_${TIMESTAMP}.json" \
  --out influxdb=http://localhost:8086/k6 \
  "$TEST_FILE" \
  2>&1 | tee "$REPORT_DIR/console_${TEST_TYPE}_${TIMESTAMP}.log"

TEST_EXIT_CODE=$?

# 監視停止
stop_monitoring

# 事後チェック
echo "🔍 Post-test health check..."
if ! curl -f -s --max-time 10 "$BASE_URL/api/health" > /dev/null; then
  echo "⚠️ Warning: Target system health check failed after test"
fi

# レポート生成
echo "📈 Generating test report..."
generate_load_test_report() {
  local results_file="$REPORT_DIR/results_${TEST_TYPE}_${TIMESTAMP}.json"
  local report_file="$REPORT_DIR/report_${TEST_TYPE}_${TIMESTAMP}.html"
  
  node scripts/generate-load-report.js \
    --input "$results_file" \
    --output "$report_file" \
    --test-type "$TEST_TYPE" \
    --environment "$TEST_ENVIRONMENT"
}

if [ -f "$REPORT_DIR/results_${TEST_TYPE}_${TIMESTAMP}.json" ]; then
  generate_load_test_report
fi

# Slack通知
send_test_notification() {
  local status=$1
  local message="Load Test Completed
  
📊 **Test Details**
- Type: $TEST_TYPE  
- Environment: $TEST_ENVIRONMENT
- Status: $status
- Duration: $DURATION
- Max VUs: $VUS

📈 **Results**
- Report: $REPORT_DIR/report_${TEST_TYPE}_${TIMESTAMP}.html
  "
  
  if [ ! -z "$SLACK_WEBHOOK" ]; then
    curl -X POST -H 'Content-type: application/json' \
      --data "{\"text\":\"$message\"}" \
      "$SLACK_WEBHOOK"
  fi
}

# 結果判定・通知
if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo "✅ Load test completed successfully!"
  send_test_notification "SUCCESS"
else
  echo "❌ Load test failed!"
  send_test_notification "FAILED"
fi

echo "📁 Test reports saved to: $REPORT_DIR"
exit $TEST_EXIT_CODE
```

## 2. セキュリティテスト戦略

### 2.1 セキュリティテスト計画

#### tests/security/security-test-plan.md
```markdown
# セキュリティテスト実行計画

## 🔒 テスト対象範囲

### Webアプリケーション
- フロントエンド（React/Next.js）
- APIエンドポイント
- 認証・認可システム
- ファイルアップロード機能

### インフラストラクチャ
- ネットワークセキュリティ
- データベースアクセス制御
- CDN・DNS設定
- SSL/TLS設定

## 🎯 セキュリティテスト項目

| **カテゴリ** | **テスト項目** | **優先度** | **自動化** |
|-------------|--------------|-----------|-----------|
| **認証・認可** | 不正アクセス防止 | 高 | ✅ |
| **入力検証** | SQLインジェクション | 高 | ✅ |
| **XSS対策** | クロスサイトスクリプティング | 高 | ✅ |
| **CSRF対策** | クロスサイトリクエストフォージェリ | 中 | ✅ |
| **ファイルアップロード** | 悪意あるファイル対策 | 高 | ⚠️部分 |
| **セッション管理** | セッションハイジャック | 中 | ⚠️部分 |
| **情報漏洩** | センシティブデータ保護 | 高 | ✅ |
| **DoS攻撃** | サービス拒否攻撃 | 中 | ⚠️部分 |
```

### 2.2 自動セキュリティテスト

#### tests/security/security-suite.js
```javascript
// OWASP ZAP統合セキュリティテストスイート
import { ZapClient } from 'zaproxy'
import { expect } from 'chai'

class SecurityTestSuite {
  constructor() {
    this.zap = new ZapClient({
      proxy: 'http://127.0.0.1:8080'
    })
    this.baseUrl = process.env.TEST_BASE_URL || 'https://staging.vegetable-system.com'
    this.testResults = []
  }

  async runFullSecurityScan() {
    console.log('🔒 Starting comprehensive security scan...')
    
    try {
      // 1. パッシブスキャン
      await this.runPassiveScan()
      
      // 2. スパイダーによるサイトマップ作成
      await this.runSpider()
      
      // 3. アクティブセキュリティスキャン
      await this.runActiveScan()
      
      // 4. 脆弱性レポート生成
      await this.generateSecurityReport()
      
      return this.testResults
      
    } catch (error) {
      console.error('Security scan failed:', error)
      throw error
    }
  }

  async runPassiveScan() {
    console.log('🕵️ Running passive security scan...')
    
    // 主要ページへのアクセス
    const pages = [
      '/',
      '/dashboard',
      '/vegetables',
      '/api/health'
    ]

    for (const page of pages) {
      await this.zap.spider.scan(`${this.baseUrl}${page}`)
    }

    // パッシブスキャン結果取得
    const alerts = await this.zap.core.alerts()
    
    this.testResults.push({
      type: 'passive_scan',
      timestamp: new Date().toISOString(),
      alerts: alerts,
      summary: this.categorizeAlerts(alerts)
    })
  }

  async runActiveScan() {
    console.log('🎯 Running active security scan...')
    
    // アクティブスキャン実行
    const scanId = await this.zap.ascan.scan(this.baseUrl, true, false)
    
    // スキャン完了まで待機
    let progress = 0
    while (progress < 100) {
      await new Promise(resolve => setTimeout(resolve, 10000)) // 10秒待機
      progress = await this.zap.ascan.status(scanId)
      console.log(`Active scan progress: ${progress}%`)
    }

    // アクティブスキャン結果取得
    const activeAlerts = await this.zap.core.alerts()
    
    this.testResults.push({
      type: 'active_scan',
      timestamp: new Date().toISOString(),
      alerts: activeAlerts,
      summary: this.categorizeAlerts(activeAlerts)
    })
  }

  async runCustomSecurityTests() {
    console.log('🧪 Running custom security tests...')
    
    const customTests = [
      this.testSQLInjection,
      this.testXSS,
      this.testCSRF,
      this.testAuthenticationBypass,
      this.testFileUploadSecurity,
      this.testAPISecurityHeaders
    ]

    for (const test of customTests) {
      try {
        const result = await test.call(this)
        this.testResults.push(result)
      } catch (error) {
        console.error(`Custom test failed:`, error)
        this.testResults.push({
          type: 'custom_test_error',
          test: test.name,
          error: error.message,
          timestamp: new Date().toISOString()
        })
      }
    }
  }

  async testSQLInjection() {
    const payloads = [
      "'; DROP TABLE users; --",
      "' OR '1'='1",
      "1' UNION SELECT * FROM users--",
      "'; WAITFOR DELAY '00:00:10'--"
    ]

    const vulnerabilities = []
    
    for (const payload of payloads) {
      // 検索APIでのSQLインジェクションテスト
      const response = await fetch(`${this.baseUrl}/api/vegetables?search=${encodeURIComponent(payload)}`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-token'
        }
      })

      // 異常な応答時間や内容をチェック
      if (response.status === 500 || response.headers.get('content-length') > 10000) {
        vulnerabilities.push({
          payload,
          response: response.status,
          potential_vulnerability: true
        })
      }
    }

    return {
      type: 'sql_injection_test',
      timestamp: new Date().toISOString(),
      vulnerabilities,
      passed: vulnerabilities.length === 0
    }
  }

  async testXSS() {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '"><img src=x onerror=alert("XSS")>',
      'javascript:alert("XSS")',
      '<svg onload=alert("XSS")>'
    ]

    const vulnerabilities = []

    for (const payload of xssPayloads) {
      // 野菜名入力でのXSSテスト
      const response = await fetch(`${this.baseUrl}/api/vegetables`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          name: payload,
          variety_name: 'テスト品種'
        })
      })

      if (response.status === 201) {
        // 作成されたデータを取得してXSSチェック
        const data = await response.json()
        const getResponse = await fetch(`${this.baseUrl}/api/vegetables/${data.id}`)
        const vegetableData = await getResponse.json()
        
        if (vegetableData.name.includes('<script>') || vegetableData.name.includes('javascript:')) {
          vulnerabilities.push({
            payload,
            stored: true,
            response: vegetableData
          })
        }
      }
    }

    return {
      type: 'xss_test',
      timestamp: new Date().toISOString(),
      vulnerabilities,
      passed: vulnerabilities.length === 0
    }
  }

  async testCSRF() {
    // CSRF保護のテスト
    const vulnerabilities = []

    // CSRFトークンなしでのPOSTリクエスト
    const response = await fetch(`${this.baseUrl}/api/vegetables`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        // Authorization ヘッダーを意図的に省略
      },
      body: JSON.stringify({
        name: 'CSRF テスト野菜',
        variety_name: 'テスト品種'
      })
    })

    if (response.status === 201) {
      vulnerabilities.push({
        issue: 'CSRF protection bypass',
        endpoint: '/api/vegetables',
        method: 'POST'
      })
    }

    return {
      type: 'csrf_test',
      timestamp: new Date().toISOString(),
      vulnerabilities,
      passed: vulnerabilities.length === 0
    }
  }

  async testAuthenticationBypass() {
    const vulnerabilities = []
    
    // 認証なしでの保護されたリソースアクセス
    const protectedEndpoints = [
      '/api/vegetables',
      '/api/dashboard',
      '/api/user/profile'
    ]

    for (const endpoint of protectedEndpoints) {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET'
        // Authorization ヘッダーなし
      })

      if (response.status === 200) {
        vulnerabilities.push({
          endpoint,
          issue: 'Authentication bypass',
          status: response.status
        })
      }
    }

    return {
      type: 'auth_bypass_test',
      timestamp: new Date().toISOString(),
      vulnerabilities,
      passed: vulnerabilities.length === 0
    }
  }

  async testFileUploadSecurity() {
    const vulnerabilities = []
    
    // 危険なファイル拡張子のテスト
    const maliciousFiles = [
      { name: 'test.php', content: '<?php system($_GET["cmd"]); ?>', type: 'text/plain' },
      { name: 'test.jsp', content: '<% Runtime.exec("cmd.exe"); %>', type: 'text/plain' },
      { name: 'test.exe', content: 'MZ...', type: 'application/octet-stream' }
    ]

    for (const file of maliciousFiles) {
      const formData = new FormData()
      formData.append('file', new Blob([file.content], { type: file.type }), file.name)
      formData.append('vegetable_id', 'test-id')

      const response = await fetch(`${this.baseUrl}/api/photos`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token'
        },
        body: formData
      })

      if (response.status === 201) {
        vulnerabilities.push({
          filename: file.name,
          issue: 'Dangerous file upload accepted',
          status: response.status
        })
      }
    }

    return {
      type: 'file_upload_test',
      timestamp: new Date().toISOString(),
      vulnerabilities,
      passed: vulnerabilities.length === 0
    }
  }

  async testAPISecurityHeaders() {
    const response = await fetch(`${this.baseUrl}/api/health`)
    const headers = response.headers
    
    const requiredHeaders = {
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'x-xss-protection': '1; mode=block',
      'strict-transport-security': /max-age=\d+/,
      'content-security-policy': /.+/
    }

    const missingHeaders = []

    for (const [header, expected] of Object.entries(requiredHeaders)) {
      const value = headers.get(header)
      
      if (!value) {
        missingHeaders.push(header)
      } else if (expected instanceof RegExp && !expected.test(value)) {
        missingHeaders.push(`${header} (incorrect value: ${value})`)
      } else if (typeof expected === 'string' && value !== expected) {
        missingHeaders.push(`${header} (expected: ${expected}, got: ${value})`)
      }
    }

    return {
      type: 'security_headers_test',
      timestamp: new Date().toISOString(),
      missing_headers: missingHeaders,
      passed: missingHeaders.length === 0
    }
  }

  categorizeAlerts(alerts) {
    const categories = {
      high: alerts.filter(a => a.risk === 'High'),
      medium: alerts.filter(a => a.risk === 'Medium'),  
      low: alerts.filter(a => a.risk === 'Low'),
      informational: alerts.filter(a => a.risk === 'Informational')
    }

    return {
      total: alerts.length,
      high: categories.high.length,
      medium: categories.medium.length,
      low: categories.low.length,
      informational: categories.informational.length
    }
  }

  async generateSecurityReport() {
    const reportPath = `./test-reports/security/security-report-${Date.now()}.json`
    
    const report = {
      test_date: new Date().toISOString(),
      target_url: this.baseUrl,
      results: this.testResults,
      summary: this.generateSummary(),
      recommendations: this.generateRecommendations()
    }

    // JSONレポート保存
    require('fs').writeFileSync(reportPath, JSON.stringify(report, null, 2))
    
    console.log(`📄 Security report saved: ${reportPath}`)
    return report
  }

  generateSummary() {
    const totalVulnerabilities = this.testResults.reduce((sum, result) => {
      if (result.vulnerabilities) {
        return sum + result.vulnerabilities.length
      }
      if (result.summary && result.summary.high) {
        return sum + result.summary.high + result.summary.medium
      }
      return sum
    }, 0)

    const passedTests = this.testResults.filter(r => r.passed).length
    const totalTests = this.testResults.filter(r => r.hasOwnProperty('passed')).length

    return {
      total_vulnerabilities: totalVulnerabilities,
      tests_passed: passedTests,
      tests_total: totalTests,
      security_score: totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0
    }
  }

  generateRecommendations() {
    const recommendations = []
    
    for (const result of this.testResults) {
      if (result.vulnerabilities && result.vulnerabilities.length > 0) {
        switch (result.type) {
          case 'sql_injection_test':
            recommendations.push({
              priority: 'HIGH',
              issue: 'SQLインジェクション脆弱性',
              recommendation: 'パラメータ化クエリ（プリペアドステートメント）の使用を徹底してください'
            })
            break
          case 'xss_test':
            recommendations.push({
              priority: 'HIGH',
              issue: 'XSS脆弱性',
              recommendation: 'ユーザー入力の適切なエスケープ処理とContent Security Policyの実装を行ってください'
            })
            break
          case 'csrf_test':
            recommendations.push({
              priority: 'MEDIUM',
              issue: 'CSRF脆弱性',
              recommendation: 'CSRFトークンの実装とSameSite Cookieの設定を行ってください'
            })
            break
          case 'file_upload_test':
            recommendations.push({
              priority: 'HIGH',
              issue: 'ファイルアップロード脆弱性',
              recommendation: 'ファイルタイプ検証、拡張子制限、アップロードディレクトリの実行権限無効化を実装してください'
            })
            break
        }
      }
      
      if (result.missing_headers && result.missing_headers.length > 0) {
        recommendations.push({
          priority: 'MEDIUM',
          issue: 'セキュリティヘッダー不備',
          recommendation: `以下のヘッダーを追加してください: ${result.missing_headers.join(', ')}`
        })
      }
    }

    return recommendations
  }
}

// テスト実行
async function runSecurityTests() {
  const suite = new SecurityTestSuite()
  
  try {
    console.log('🔒 Starting security test suite...')
    
    // カスタムテスト実行
    await suite.runCustomSecurityTests()
    
    // ZAPスキャン実行（ZAPが利用可能な場合）
    if (process.env.ZAP_ENABLED === 'true') {
      await suite.runFullSecurityScan()
    }
    
    // レポート生成
    const report = await suite.generateSecurityReport()
    
    console.log('✅ Security testing completed')
    console.log(`Security Score: ${report.summary.security_score}/100`)
    
    // 高危険度の脆弱性がある場合は失敗として扱う
    if (report.summary.total_vulnerabilities > 0) {
      console.error(`❌ Found ${report.summary.total_vulnerabilities} vulnerabilities`)
      process.exit(1)
    }
    
  } catch (error) {
    console.error('❌ Security testing failed:', error)
    process.exit(1)
  }
}

// 実行
if (require.main === module) {
  runSecurityTests()
}

export { SecurityTestSuite }
```

### 2.3 セキュリティテスト自動化

#### .github/workflows/security-tests.yml
```yaml
name: Security Testing

on:
  schedule:
    - cron: '0 2 * * *' # 毎日午前2時実行
  workflow_dispatch:
    inputs:
      test_environment:
        description: 'Environment to test'
        required: true
        default: 'staging'
        type: choice
        options:
        - staging
        - production

jobs:
  security-scan:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20.x'

    - name: Install dependencies
      run: |
        npm install
        npm install -g owasp-dependency-check

    # 依存関係脆弱性チェック
    - name: OWASP Dependency Check
      run: |
        dependency-check --project "Vegetable Management System" \
          --scan . \
          --format ALL \
          --out ./security-reports/dependency-check

    # Snyk脆弱性スキャン
    - name: Run Snyk to check vulnerabilities
      uses: snyk/actions/node@master
      env:
        SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
      with:
        args: --severity-threshold=high --json-file-output=security-reports/snyk-report.json

    # セキュリティコードスキャン
    - name: CodeQL Security Analysis
      uses: github/codeql-action/analyze@v2
      with:
        languages: javascript

    # OWASP ZAP動的スキャン
    - name: OWASP ZAP Full Scan
      uses: zaproxy/action-full-scan@v0.7.0
      with:
        target: ${{ github.event.inputs.test_environment == 'production' && 'https://vegetable-system.com' || 'https://staging.vegetable-system.com' }}
        rules_file_name: '.zap/rules.tsv'
        cmd_options: '-a'

    # カスタムセキュリティテスト実行
    - name: Custom Security Tests
      run: |
        export TEST_BASE_URL="${{ github.event.inputs.test_environment == 'production' && 'https://vegetable-system.com' || 'https://staging.vegetable-system.com' }}"
        npm run test:security
      env:
        ZAP_ENABLED: 'true'

    # セキュリティレポート統合
    - name: Merge Security Reports
      run: |
        node scripts/merge-security-reports.js \
          --dependency-check ./security-reports/dependency-check/dependency-check-report.json \
          --snyk ./security-reports/snyk-report.json \
          --zap ./security-reports/zap-report.json \
          --custom ./test-reports/security/ \
          --output ./security-reports/combined-security-report.json

    # レポートアップロード
    - name: Upload Security Reports
      uses: actions/upload-artifact@v3
      with:
        name: security-reports
        path: security-reports/

    # Slack通知（脆弱性発見時）
    - name: Notify Security Team
      if: failure()
      uses: 8398a7/action-slack@v3
      with:
        status: failure
        text: |
          🚨 Security vulnerabilities detected!
          Environment: ${{ github.event.inputs.test_environment || 'staging' }}
          Check the security reports for details.
        webhook_url: ${{ secrets.SLACK_SECURITY_WEBHOOK }}
```

## 3. パフォーマンス・負荷テスト継続監視

### 3.1 継続的パフォーマンス監視

#### scripts/continuous-performance-monitoring.js
```javascript
// 継続的パフォーマンス監視システム
import { performance } from 'perf_hooks'
import fetch from 'node-fetch'

class PerformanceMonitor {
  constructor(config) {
    this.config = {
      baseUrl: config.baseUrl,
      interval: config.interval || 300000, // 5分間隔
      thresholds: {
        responseTime: 2000, // 2秒
        availability: 99.9,  // 99.9%
        errorRate: 1.0       // 1%
      },
      ...config
    }
    
    this.metrics = {
      responseTime: [],
      availability: 0,
      errorRate: 0,
      throughput: 0
    }
  }

  async startMonitoring() {
    console.log('📊 Starting continuous performance monitoring...')
    
    setInterval(async () => {
      try {
        await this.collectMetrics()
        await this.analyzePerformance()
        await this.sendAlertsIfNeeded()
      } catch (error) {
        console.error('Monitoring error:', error)
      }
    }, this.config.interval)
  }

  async collectMetrics() {
    const endpoints = [
      { path: '/api/health', name: 'health_check' },
      { path: '/api/vegetables', name: 'vegetables_api' },
      { path: '/api/dashboard', name: 'dashboard_api' }
    ]

    for (const endpoint of endpoints) {
      const startTime = performance.now()
      
      try {
        const response = await fetch(`${this.config.baseUrl}${endpoint.path}`, {
          timeout: 10000
        })
        
        const endTime = performance.now()
        const responseTime = endTime - startTime

        this.metrics.responseTime.push({
          endpoint: endpoint.name,
          time: responseTime,
          timestamp: new Date(),
          success: response.ok
        })

        // メトリクス配列のサイズ制限
        if (this.metrics.responseTime.length > 1000) {
          this.metrics.responseTime = this.metrics.responseTime.slice(-500)
        }

      } catch (error) {
        this.metrics.responseTime.push({
          endpoint: endpoint.name,
          time: 10000, // タイムアウト値
          timestamp: new Date(),
          success: false,
          error: error.message
        })
      }
    }
  }

  async analyzePerformance() {
    const recentMetrics = this.metrics.responseTime.slice(-50) // 直近50回
    
    if (recentMetrics.length === 0) return

    // 平均レスポンス時間
    const avgResponseTime = recentMetrics.reduce((sum, m) => sum + m.time, 0) / recentMetrics.length
    
    // 可用性計算
    const successCount = recentMetrics.filter(m => m.success).length
    this.metrics.availability = (successCount / recentMetrics.length) * 100
    
    // エラー率計算
    this.metrics.errorRate = ((recentMetrics.length - successCount) / recentMetrics.length) * 100
    
    // スループット計算（仮想）
    const timeSpan = recentMetrics[recentMetrics.length - 1].timestamp - recentMetrics[0].timestamp
    this.metrics.throughput = recentMetrics.length / (timeSpan / 1000 / 60) // req/min

    console.log({
      avgResponseTime: Math.round(avgResponseTime),
      availability: this.metrics.availability.toFixed(2),
      errorRate: this.metrics.errorRate.toFixed(2),
      throughput: Math.round(this.metrics.throughput)
    })
  }

  async sendAlertsIfNeeded() {
    const alerts = []
    
    const recentMetrics = this.metrics.responseTime.slice(-10)
    const avgResponseTime = recentMetrics.reduce((sum, m) => sum + m.time, 0) / recentMetrics.length

    // レスポンス時間アラート
    if (avgResponseTime > this.config.thresholds.responseTime) {
      alerts.push({
        type: 'response_time',
        severity: 'warning',
        message: `Average response time: ${Math.round(avgResponseTime)}ms exceeds threshold ${this.config.thresholds.responseTime}ms`
      })
    }

    // 可用性アラート
    if (this.metrics.availability < this.config.thresholds.availability) {
      alerts.push({
        type: 'availability',
        severity: 'critical',
        message: `Availability: ${this.metrics.availability.toFixed(2)}% below threshold ${this.config.thresholds.availability}%`
      })
    }

    // エラー率アラート
    if (this.metrics.errorRate > this.config.thresholds.errorRate) {
      alerts.push({
        type: 'error_rate',
        severity: 'warning',
        message: `Error rate: ${this.metrics.errorRate.toFixed(2)}% exceeds threshold ${this.config.thresholds.errorRate}%`
      })
    }

    // アラート送信
    for (const alert of alerts) {
      await this.sendAlert(alert)
    }
  }

  async sendAlert(alert) {
    const webhookUrl = process.env.SLACK_PERFORMANCE_WEBHOOK
    
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 Performance Alert: ${alert.message}`,
          channel: '#performance-alerts'
        })
      })
    }

    console.warn(`ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`)
  }
}

// 実行
const monitor = new PerformanceMonitor({
  baseUrl: process.env.MONITOR_BASE_URL || 'https://vegetable-system.com',
  interval: 300000 // 5分
})

monitor.startMonitoring()
```

これで負荷テスト・セキュリティテストの包括的な実装が完了しました。次に最終フェーズのドキュメント整備・運用手順に進みます。