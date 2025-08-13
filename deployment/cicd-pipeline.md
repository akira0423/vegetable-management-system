# CI/CD パイプライン構築ガイド

## 1. GitHub Actions設定

### 1.1 基本ワークフロー設定

#### .github/workflows/ci.yml
```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20.x'

jobs:
  # ================================
  # 1. テスト・品質チェック
  # ================================
  test:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run tests
      run: npm run test:ci

    - name: Run lint
      run: npm run lint

    - name: Run type check
      run: npm run type-check

    - name: Upload test coverage
      uses: codecov/codecov-action@v3
      with:
        token: ${{ secrets.CODECOV_TOKEN }}
        file: ./coverage/lcov.info

  # ================================
  # 2. セキュリティスキャン
  # ================================
  security:
    runs-on: ubuntu-latest
    needs: test
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Run Snyk vulnerability scan
      uses: snyk/actions/node@master
      env:
        SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
      with:
        args: --severity-threshold=high

    - name: Run CodeQL security analysis
      uses: github/codeql-action/init@v2
      with:
        languages: javascript

    - name: CodeQL analysis
      uses: github/codeql-action/analyze@v2

  # ================================
  # 3. ビルド・デプロイ（本番）
  # ================================
  deploy-production:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    needs: [test, security]
    environment: production
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Build application
      run: npm run build
      env:
        NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}

    - name: Deploy to Vercel
      uses: amondnet/vercel-action@v25
      with:
        vercel-token: ${{ secrets.VERCEL_TOKEN }}
        github-token: ${{ secrets.GITHUB_TOKEN }}
        vercel-args: '--prod'
        vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
        vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}

    - name: Run smoke tests
      run: npm run test:smoke
      env:
        TEST_URL: ${{ steps.deploy.outputs.preview-url }}

    - name: Notify deployment status
      uses: 8398a7/action-slack@v3
      with:
        status: ${{ job.status }}
        channel: '#deployments'
        webhook_url: ${{ secrets.SLACK_WEBHOOK }}

  # ================================
  # 4. ステージング環境デプロイ
  # ================================
  deploy-staging:
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    needs: [test, security]
    environment: staging
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Deploy to Vercel (Preview)
      uses: amondnet/vercel-action@v25
      with:
        vercel-token: ${{ secrets.VERCEL_TOKEN }}
        github-token: ${{ secrets.GITHUB_TOKEN }}
        vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
        vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}

    - name: Run E2E tests
      run: npm run test:e2e
      env:
        TEST_URL: ${{ steps.deploy.outputs.preview-url }}
        PLAYWRIGHT_BROWSERS_PATH: 0

    - name: Performance audit with Lighthouse
      uses: treosh/lighthouse-ci-action@v9
      with:
        urls: ${{ steps.deploy.outputs.preview-url }}
        configPath: './lighthouserc.json'
        uploadArtifacts: true
```

### 1.2 データベースマイグレーション

#### .github/workflows/database-migration.yml
```yaml
name: Database Migration

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy to'
        required: true
        default: 'staging'
        type: choice
        options:
        - staging
        - production

jobs:
  migrate:
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment }}
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20.x'

    - name: Install Supabase CLI
      run: |
        curl -sSfL https://supabase.com/install.sh | sh
        echo "$HOME/.local/bin" >> $GITHUB_PATH

    - name: Run database migrations
      run: |
        supabase db push \
          --db-url ${{ secrets.DATABASE_URL }} \
          --password ${{ secrets.DB_PASSWORD }}
      env:
        SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

    - name: Verify migration success
      run: |
        supabase db diff \
          --db-url ${{ secrets.DATABASE_URL }} \
          --password ${{ secrets.DB_PASSWORD }}

    - name: Slack notification
      if: always()
      uses: 8398a7/action-slack@v3
      with:
        status: ${{ job.status }}
        text: "Database migration to ${{ github.event.inputs.environment }}: ${{ job.status }}"
        webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

## 2. 品質ゲート設定

### 2.1 コード品質チェック

#### .github/workflows/quality-gate.yml
```yaml
name: Quality Gate

on:
  pull_request:
    branches: [main, develop]

jobs:
  quality-check:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      with:
        fetch-depth: 0  # SonarCloud用

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20.x'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    # テストカバレッジ要件チェック
    - name: Test with coverage
      run: npm run test:coverage
      
    - name: Check coverage threshold
      run: |
        COVERAGE=$(npm run test:coverage -- --passWithNoTests --silent | grep -o 'All files.*[0-9]*\.[0-9]*' | grep -o '[0-9]*\.[0-9]*')
        echo "Coverage: ${COVERAGE}%"
        if (( $(echo "${COVERAGE} < 80" | bc -l) )); then
          echo "❌ Coverage ${COVERAGE}% is below 80% threshold"
          exit 1
        else
          echo "✅ Coverage ${COVERAGE}% meets 80% threshold"
        fi

    # コード複雑度チェック
    - name: Complexity analysis
      run: npx plato -r -d complexity-report src/

    - name: Check complexity threshold
      run: |
        COMPLEXITY=$(cat complexity-report/report.json | jq '.summary.average.complexity')
        echo "Average complexity: ${COMPLEXITY}"
        if (( $(echo "${COMPLEXITY} > 10" | bc -l) )); then
          echo "❌ Complexity ${COMPLEXITY} exceeds threshold of 10"
          exit 1
        fi

    # SonarCloud 分析
    - name: SonarCloud Scan
      uses: SonarSource/sonarcloud-github-action@master
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

    # 依存関係脆弱性チェック
    - name: Audit dependencies
      run: npm audit --audit-level moderate

    # Bundle size チェック
    - name: Bundle size analysis
      run: npm run analyze
      
    - name: Check bundle size
      run: |
        SIZE=$(ls -la .next/static/chunks/pages/_app-*.js | awk '{print $5}')
        echo "Bundle size: ${SIZE} bytes"
        if [ ${SIZE} -gt 1048576 ]; then  # 1MB
          echo "❌ Bundle size exceeds 1MB limit"
          exit 1
        fi
```

### 2.2 自動化テスト設定

#### package.json テストスクリプト
```json
{
  "scripts": {
    "test": "jest",
    "test:ci": "jest --ci --coverage --watchAll=false",
    "test:coverage": "jest --coverage --watchAll=false",
    "test:smoke": "playwright test --config=playwright-smoke.config.ts",
    "test:e2e": "playwright test",
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "type-check": "tsc --noEmit",
    "analyze": "cross-env ANALYZE=true next build",
    "build": "next build"
  }
}
```

## 3. 環境別設定管理

### 3.1 環境変数管理

#### env/production.yml
```yaml
# 本番環境設定
NEXT_PUBLIC_APP_ENV: production
NEXT_PUBLIC_API_URL: https://api.vegetable-system.com

# セキュリティ設定
SECURITY_HEADERS: strict
RATE_LIMIT_REQUESTS: 1000
RATE_LIMIT_WINDOW: 3600

# 監視・ロギング
LOG_LEVEL: warn
SENTRY_ENVIRONMENT: production
ANALYTICS_ENABLED: true

# パフォーマンス設定
CACHE_TTL: 3600
IMAGE_OPTIMIZATION: true
```

#### env/staging.yml
```yaml
# ステージング環境設定
NEXT_PUBLIC_APP_ENV: staging
NEXT_PUBLIC_API_URL: https://staging-api.vegetable-system.com

# デバッグ設定
LOG_LEVEL: debug
DEBUG_MODE: true

# テスト設定
E2E_TEST_ENABLED: true
LOAD_TEST_ENABLED: true
```

### 3.2 シークレット管理

#### GitHub Secrets設定
```bash
# Vercel設定
VERCEL_TOKEN=****
VERCEL_ORG_ID=****
VERCEL_PROJECT_ID=****

# Supabase設定
NEXT_PUBLIC_SUPABASE_URL=****
NEXT_PUBLIC_SUPABASE_ANON_KEY=****
SUPABASE_SERVICE_ROLE_KEY=****
SUPABASE_ACCESS_TOKEN=****

# 外部サービス
OPENAI_API_KEY=****
SLACK_WEBHOOK=****
SENTRY_DSN=****

# セキュリティ
ENCRYPTION_KEY=****
JWT_SECRET=****

# 監視・分析
CODECOV_TOKEN=****
SNYK_TOKEN=****
SONAR_TOKEN=****
```

## 4. 自動デプロイ戦略

### 4.1 Blue-Green デプロイメント

#### scripts/deploy-blue-green.sh
```bash
#!/bin/bash
set -e

ENVIRONMENT=${1:-production}
HEALTH_CHECK_URL=${2:-/api/health}
ROLLBACK_ON_FAILURE=${3:-true}

echo "🚀 Starting Blue-Green deployment to ${ENVIRONMENT}"

# 現在のデプロイメント情報取得
CURRENT_URL=$(vercel ls --scope=$VERCEL_ORG_ID | grep "✅" | awk '{print $2}')
echo "Current production URL: ${CURRENT_URL}"

# 新しいデプロイメント実行
echo "📦 Building and deploying new version..."
NEW_URL=$(vercel --prod --confirm | grep "https://" | tail -1)
echo "New deployment URL: ${NEW_URL}"

# ヘルスチェック実行
echo "🔍 Running health checks..."
for i in {1..30}; do
    if curl -f -s "${NEW_URL}${HEALTH_CHECK_URL}" > /dev/null; then
        echo "✅ Health check passed"
        break
    fi
    
    if [ $i -eq 30 ]; then
        echo "❌ Health check failed after 30 attempts"
        
        if [ "$ROLLBACK_ON_FAILURE" = "true" ]; then
            echo "🔄 Rolling back to previous version..."
            vercel alias set $CURRENT_URL vegetable-system.com
            exit 1
        fi
    fi
    
    echo "⏳ Waiting for health check... (${i}/30)"
    sleep 10
done

# スモークテスト実行
echo "🧪 Running smoke tests..."
TEST_URL=$NEW_URL npm run test:smoke

# エイリアス更新（本番切り替え）
echo "🔄 Switching production traffic to new deployment..."
vercel alias set $NEW_URL vegetable-system.com

echo "✅ Blue-Green deployment completed successfully!"
```

### 4.2 カナリアデプロイメント

#### scripts/canary-deploy.sh
```bash
#!/bin/bash
set -e

CANARY_PERCENTAGE=${1:-10}
MONITORING_DURATION=${2:-300}  # 5分間監視

echo "🕊️ Starting Canary deployment (${CANARY_PERCENTAGE}% traffic)"

# カナリア版デプロイ
CANARY_URL=$(vercel --confirm | grep "https://" | tail -1)
echo "Canary deployment: ${CANARY_URL}"

# トラフィック分割設定（CloudFlareまたはVercel Edge Config）
curl -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/load_balancers/${LB_ID}/pools" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"canary-pool\",
    \"origins\": [{
      \"name\": \"canary\",
      \"address\": \"${CANARY_URL}\",
      \"weight\": ${CANARY_PERCENTAGE}
    }]
  }"

echo "⏳ Monitoring canary deployment for ${MONITORING_DURATION} seconds..."

# メトリクス監視
for ((i=0; i<$MONITORING_DURATION; i+=30)); do
    # エラー率チェック
    ERROR_RATE=$(curl -s "${MONITORING_API}/error-rate?source=canary")
    RESPONSE_TIME=$(curl -s "${MONITORING_API}/response-time?source=canary")
    
    echo "📊 Canary metrics - Error Rate: ${ERROR_RATE}%, Response Time: ${RESPONSE_TIME}ms"
    
    # 閾値チェック
    if (( $(echo "${ERROR_RATE} > 1.0" | bc -l) )); then
        echo "❌ Error rate too high, rolling back canary"
        ./scripts/rollback-canary.sh
        exit 1
    fi
    
    if (( $(echo "${RESPONSE_TIME} > 1000" | bc -l) )); then
        echo "❌ Response time too high, rolling back canary"
        ./scripts/rollback-canary.sh
        exit 1
    fi
    
    sleep 30
done

echo "✅ Canary deployment successful, promoting to full production"
# 本番切り替え実行
./scripts/promote-canary.sh
```

## 5. モニタリング・アラート統合

### 5.1 デプロイメントメトリクス

#### .github/workflows/deployment-metrics.yml
```yaml
name: Deployment Metrics

on:
  deployment_status:

jobs:
  track-deployment:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    
    steps:
    - name: Track deployment metrics
      run: |
        curl -X POST "${{ secrets.METRICS_ENDPOINT }}" \
          -H "Authorization: Bearer ${{ secrets.METRICS_TOKEN }}" \
          -H "Content-Type: application/json" \
          -d '{
            "event": "deployment_success",
            "environment": "${{ github.event.deployment.environment }}",
            "sha": "${{ github.sha }}",
            "ref": "${{ github.ref }}",
            "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"
          }'

    - name: Calculate deployment frequency
      run: |
        # DORA metrics - Deployment Frequency
        DEPLOYMENTS_THIS_WEEK=$(curl -s "${{ secrets.METRICS_ENDPOINT }}/deployments?week=current" | jq '.count')
        echo "Deployments this week: ${DEPLOYMENTS_THIS_WEEK}"

    - name: Measure lead time
      run: |
        # DORA metrics - Lead Time for Changes
        FIRST_COMMIT=$(git log --reverse --format="%ct" --since="1 week ago" | head -1)
        CURRENT_TIME=$(date +%s)
        LEAD_TIME=$(( (CURRENT_TIME - FIRST_COMMIT) / 3600 ))
        echo "Lead time: ${LEAD_TIME} hours"
```

### 5.2 障害検知・自動回復

#### .github/workflows/incident-response.yml
```yaml
name: Incident Response

on:
  workflow_dispatch:
    inputs:
      incident_type:
        description: 'Type of incident'
        required: true
        type: choice
        options:
        - high_error_rate
        - performance_degradation
        - service_outage

jobs:
  incident-response:
    runs-on: ubuntu-latest
    
    steps:
    - name: Assess incident severity
      id: assessment
      run: |
        case "${{ github.event.inputs.incident_type }}" in
          "service_outage")
            echo "severity=critical" >> $GITHUB_OUTPUT
            ;;
          "high_error_rate")
            echo "severity=high" >> $GITHUB_OUTPUT
            ;;
          "performance_degradation")
            echo "severity=medium" >> $GITHUB_OUTPUT
            ;;
        esac

    - name: Execute automatic rollback
      if: steps.assessment.outputs.severity == 'critical'
      run: |
        # 前回の安定版に自動ロールバック
        LAST_STABLE=$(vercel ls --scope=${{ secrets.VERCEL_ORG_ID }} | grep "✅" | head -2 | tail -1 | awk '{print $2}')
        vercel alias set $LAST_STABLE vegetable-system.com
        echo "🔄 Rolled back to: $LAST_STABLE"

    - name: Create incident ticket
      uses: actions/github-script@v6
      with:
        script: |
          const { data: issue } = await github.rest.issues.create({
            owner: context.repo.owner,
            repo: context.repo.repo,
            title: `🚨 Incident: ${{ github.event.inputs.incident_type }}`,
            body: `
            **Incident Type**: ${{ github.event.inputs.incident_type }}
            **Severity**: ${{ steps.assessment.outputs.severity }}
            **Detection Time**: ${new Date().toISOString()}
            **Status**: Investigating
            
            ## Next Steps
            - [ ] Investigate root cause
            - [ ] Implement fix
            - [ ] Monitor recovery
            - [ ] Post-mortem analysis
            `,
            labels: ['incident', 'priority-${{ steps.assessment.outputs.severity }}']
          });

    - name: Alert incident response team
      run: |
        curl -X POST "${{ secrets.PAGERDUTY_WEBHOOK }}" \
          -H "Content-Type: application/json" \
          -d '{
            "routing_key": "${{ secrets.PAGERDUTY_ROUTING_KEY }}",
            "event_action": "trigger",
            "payload": {
              "summary": "Production incident: ${{ github.event.inputs.incident_type }}",
              "severity": "${{ steps.assessment.outputs.severity }}",
              "source": "GitHub Actions",
              "component": "vegetable-management-system",
              "group": "production"
            }
          }'
```

## 6. パフォーマンス最適化パイプライン

### 6.1 Lighthouse CI設定

#### lighthouserc.json
```json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:3000"],
      "startServerCommand": "npm start",
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", {"minScore": 0.9}],
        "categories:accessibility": ["error", {"minScore": 0.9}],
        "categories:best-practices": ["error", {"minScore": 0.9}],
        "categories:seo": ["error", {"minScore": 0.9}],
        "first-contentful-paint": ["error", {"maxNumericValue": 2000}],
        "largest-contentful-paint": ["error", {"maxNumericValue": 2500}],
        "cumulative-layout-shift": ["error", {"maxNumericValue": 0.1}]
      }
    },
    "upload": {
      "target": "lhci",
      "serverBaseUrl": "https://lhci.vegetable-system.com"
    }
  }
}
```

これでCI/CDパイプラインの構築が完了しました。次にドメイン・SSL・CDN設定に進みます。