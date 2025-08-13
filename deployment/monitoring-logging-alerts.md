# 監視・ロギング・アラート設定ガイド

## 1. アプリケーション監視システム

### 1.1 OpenTelemetry設定

#### lib/instrumentation.ts
```typescript
// OpenTelemetry Instrumentation
import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-http'
import { OTLPMetricExporter } from '@opentelemetry/exporter-otlp-http'

const sdk = new NodeSDK({
  // 自動計装設定
  instrumentations: [getNodeAutoInstrumentations({
    '@opentelemetry/instrumentation-next': {
      enabled: true
    },
    '@opentelemetry/instrumentation-http': {
      enabled: true,
      ignoreIncomingRequestHook: (req) => {
        // ヘルスチェックは除外
        return req.url?.includes('/api/health') || false
      }
    }
  })],

  // トレースエクスポーター
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
    headers: {
      'Authorization': `Bearer ${process.env.OTEL_AUTH_TOKEN}`
    }
  }),

  // メトリクスエクスポーター
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT,
      headers: {
        'Authorization': `Bearer ${process.env.OTEL_AUTH_TOKEN}`
      }
    }),
    exportIntervalMillis: 30000 // 30秒間隔
  })
})

// 本番環境でのみ有効化
if (process.env.NODE_ENV === 'production') {
  sdk.start()
  console.log('OpenTelemetry started successfully')
}

export default sdk
```

#### lib/custom-metrics.ts
```typescript
// カスタムメトリクス定義
import { metrics } from '@opentelemetry/api'
import { MeterProvider } from '@opentelemetry/sdk-metrics'

const meter = metrics.getMeter('vegetable-management-system', '1.0.0')

// ビジネスメトリクス
export const businessMetrics = {
  // 野菜登録数カウンター
  vegetablesCreated: meter.createCounter('vegetables_created_total', {
    description: 'Total number of vegetables created'
  }),

  // 写真アップロード数カウンター
  photosUploaded: meter.createCounter('photos_uploaded_total', {
    description: 'Total number of photos uploaded'
  }),

  // アクティブユーザー数ゲージ
  activeUsers: meter.createUpDownCounter('active_users', {
    description: 'Current number of active users'
  }),

  // APIレスポンス時間ヒストグラム
  apiResponseTime: meter.createHistogram('api_response_duration_ms', {
    description: 'API response time in milliseconds',
    unit: 'ms',
    boundaries: [10, 50, 100, 200, 500, 1000, 2000, 5000]
  }),

  // データベースクエリ実行時間
  dbQueryDuration: meter.createHistogram('db_query_duration_ms', {
    description: 'Database query execution time',
    unit: 'ms'
  }),

  // エラー率カウンター
  errors: meter.createCounter('errors_total', {
    description: 'Total number of errors'
  })
}

// メトリクス記録用ヘルパー関数
export class MetricsCollector {
  static recordVegetableCreation(companyId: string, varietyName: string) {
    businessMetrics.vegetablesCreated.add(1, {
      company_id: companyId,
      variety: varietyName
    })
  }

  static recordPhotoUpload(companyId: string, fileSize: number) {
    businessMetrics.photosUploaded.add(1, {
      company_id: companyId,
      size_category: this.getSizeCategory(fileSize)
    })
  }

  static recordApiCall(endpoint: string, method: string, duration: number, status: number) {
    businessMetrics.apiResponseTime.record(duration, {
      endpoint,
      method,
      status: status.toString()
    })

    if (status >= 400) {
      businessMetrics.errors.add(1, {
        endpoint,
        status: status.toString()
      })
    }
  }

  static recordDbQuery(operation: string, table: string, duration: number) {
    businessMetrics.dbQueryDuration.record(duration, {
      operation,
      table
    })
  }

  private static getSizeCategory(bytes: number): string {
    if (bytes < 1024 * 1024) return 'small'
    if (bytes < 5 * 1024 * 1024) return 'medium'
    return 'large'
  }
}
```

### 1.2 ログ集約システム

#### lib/logger.ts
```typescript
// 構造化ログ設定
import winston from 'winston'
import { ElasticsearchTransport } from 'winston-elasticsearch'

// ログレベル設定
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
}

// ログフォーマット
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
      '@timestamp': timestamp,
      level,
      message,
      service: 'vegetable-management-system',
      environment: process.env.NODE_ENV,
      version: process.env.APP_VERSION,
      traceId: meta.traceId,
      spanId: meta.spanId,
      ...meta
    })
  })
)

// トランスポート設定
const transports: winston.transport[] = [
  // コンソール出力
  new winston.transports.Console({
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.NODE_ENV === 'development' 
      ? winston.format.simple() 
      : logFormat
  })
]

// 本番環境では外部ログサービスに送信
if (process.env.NODE_ENV === 'production') {
  // Elasticsearch Transport
  if (process.env.ELASTICSEARCH_URL) {
    transports.push(new ElasticsearchTransport({
      level: 'info',
      clientOpts: {
        node: process.env.ELASTICSEARCH_URL,
        auth: {
          username: process.env.ELASTICSEARCH_USERNAME!,
          password: process.env.ELASTICSEARCH_PASSWORD!
        }
      },
      index: 'vegetable-system-logs',
      indexTemplate: {
        name: 'vegetable-system-template',
        patterns: ['vegetable-system-logs-*'],
        settings: {
          number_of_shards: 1,
          number_of_replicas: 1
        }
      }
    }))
  }

  // DataDog Logs
  if (process.env.DATADOG_API_KEY) {
    transports.push(new winston.transports.Http({
      host: 'http-intake.logs.datadoghq.com',
      path: `/v1/input/${process.env.DATADOG_API_KEY}`,
      ssl: true,
      format: winston.format.json()
    }))
  }
}

// ロガーインスタンス作成
export const logger = winston.createLogger({
  levels: logLevels,
  format: logFormat,
  transports,
  exitOnError: false
})

// 構造化ログヘルパー
export class StructuredLogger {
  static info(message: string, metadata?: object) {
    logger.info(message, metadata)
  }

  static warn(message: string, metadata?: object) {
    logger.warn(message, metadata)
  }

  static error(message: string, error?: Error, metadata?: object) {
    logger.error(message, {
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined,
      ...metadata
    })
  }

  static audit(action: string, userId: string, resource: string, metadata?: object) {
    logger.info('Audit Log', {
      type: 'audit',
      action,
      userId,
      resource,
      timestamp: new Date().toISOString(),
      ...metadata
    })
  }

  static security(event: string, severity: string, metadata?: object) {
    logger.warn('Security Event', {
      type: 'security',
      event,
      severity,
      timestamp: new Date().toISOString(),
      ...metadata
    })
  }

  static performance(operation: string, duration: number, metadata?: object) {
    logger.info('Performance Log', {
      type: 'performance',
      operation,
      duration,
      timestamp: new Date().toISOString(),
      ...metadata
    })
  }
}
```

### 1.3 エラー追跡システム

#### lib/error-tracking.ts
```typescript
// Sentry Error Tracking設定
import * as Sentry from '@sentry/nextjs'
import { StructuredLogger } from './logger'

// Sentry初期化
export function initializeSentry() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    
    // サンプリング率設定
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // パフォーマンス監視
    profilesSampleRate: 0.1,
    
    // セッションリプレイ
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    
    // フィルタリング
    beforeSend(event) {
      // 開発環境やテスト環境では送信しない
      if (process.env.NODE_ENV !== 'production') {
        return null
      }
      
      // センシティブ情報の除去
      if (event.request?.data) {
        event.request.data = sanitizeData(event.request.data)
      }
      
      return event
    },
    
    integrations: [
      new Sentry.Integrations.Http(),
      new Sentry.Integrations.OnUncaughtException(),
      new Sentry.Integrations.OnUnhandledRejection(),
    ]
  })
}

// エラーハンドリングクラス
export class ErrorHandler {
  static captureException(error: Error, context?: any) {
    // 構造化ログ記録
    StructuredLogger.error('Exception captured', error, context)
    
    // Sentryに送信
    Sentry.captureException(error, {
      tags: {
        component: context?.component,
        operation: context?.operation
      },
      extra: context
    })
  }

  static captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: any) {
    StructuredLogger.info(message, context)
    
    Sentry.captureMessage(message, level)
  }

  static setUser(user: { id: string; email?: string; company?: string }) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      company: user.company
    })
  }

  static addBreadcrumb(message: string, category: string, data?: any) {
    Sentry.addBreadcrumb({
      message,
      category,
      data,
      timestamp: Date.now()
    })
  }
}

// データサニタイズ関数
function sanitizeData(data: any): any {
  const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth']
  
  if (typeof data === 'object' && data !== null) {
    const sanitized = { ...data }
    
    for (const key in sanitized) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        sanitized[key] = '[REDACTED]'
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = sanitizeData(sanitized[key])
      }
    }
    
    return sanitized
  }
  
  return data
}
```

## 2. インフラストラクチャ監視

### 2.1 Prometheus + Grafana設定

#### monitoring/prometheus.yml
```yaml
# Prometheus設定
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alerts.yml"

scrape_configs:
  # Next.js アプリケーションメトリクス
  - job_name: 'vegetable-system'
    static_configs:
      - targets: ['vegetable-system.com:443']
    metrics_path: '/api/metrics'
    scheme: https
    scrape_interval: 30s

  # Supabase メトリクス
  - job_name: 'supabase'
    static_configs:
      - targets: ['api.supabase.co']
    metrics_path: '/metrics'
    scheme: https
    
  # CloudFlare メトリクス
  - job_name: 'cloudflare'
    static_configs:
      - targets: ['api.cloudflare.com']
    oauth2:
      client_id: 'prometheus-client'
      token_url: 'https://api.cloudflare.com/client/v4/user/tokens/verify'

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

#### monitoring/alerts.yml
```yaml
# Prometheus アラートルール
groups:
  - name: application.rules
    rules:
      # 高エラー率アラート
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m])) by (instance) /
          sum(rate(http_requests_total[5m])) by (instance) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }} for instance {{ $labels.instance }}"

      # レスポンス時間アラート
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
          description: "95th percentile response time is {{ $value }}s"

      # データベース接続アラート
      - alert: DatabaseConnectionHigh
        expr: pg_stat_activity_count > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High database connection count"
          description: "Database connections: {{ $value }}"

      # ディスク使用量アラート
      - alert: HighDiskUsage
        expr: (node_filesystem_size_bytes - node_filesystem_free_bytes) / node_filesystem_size_bytes > 0.85
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "High disk usage"
          description: "Disk usage is {{ $value | humanizePercentage }}"

  - name: business.rules
    rules:
      # 野菜登録数異常減少
      - alert: VegetableCreationDropped
        expr: increase(vegetables_created_total[1h]) < 5
        for: 2h
        labels:
          severity: warning
        annotations:
          summary: "Vegetable creation rate dropped"
          description: "Only {{ $value }} vegetables created in the last hour"

      # アクティブユーザー数急減
      - alert: ActiveUsersDropped
        expr: active_users < 10
        for: 30m
        labels:
          severity: critical
        annotations:
          summary: "Active users dropped significantly"
          description: "Active users: {{ $value }}"
```

### 2.2 Grafana ダッシュボード

#### monitoring/grafana-dashboard.json
```json
{
  "dashboard": {
    "id": null,
    "title": "野菜管理システム 監視ダッシュボード",
    "tags": ["vegetable-system", "production"],
    "timezone": "Asia/Tokyo",
    "panels": [
      {
        "id": 1,
        "title": "APIリクエスト数",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total[5m])) by (endpoint)",
            "legendFormat": "{{ endpoint }}"
          }
        ],
        "yAxes": [
          {
            "label": "リクエスト/秒",
            "min": 0
          }
        ]
      },
      {
        "id": 2,
        "title": "エラー率",
        "type": "stat",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{status=~\"5..\"}[5m])) / sum(rate(http_requests_total[5m])) * 100",
            "legendFormat": "エラー率 %"
          }
        ],
        "fieldConfig": {
          "thresholds": {
            "steps": [
              {"color": "green", "value": null},
              {"color": "yellow", "value": 1},
              {"color": "red", "value": 5}
            ]
          }
        }
      },
      {
        "id": 3,
        "title": "レスポンス時間分布",
        "type": "heatmap",
        "targets": [
          {
            "expr": "sum(rate(http_request_duration_seconds_bucket[5m])) by (le)",
            "format": "heatmap",
            "legendFormat": "{{ le }}"
          }
        ]
      },
      {
        "id": 4,
        "title": "ビジネスメトリクス",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(vegetables_created_total)",
            "legendFormat": "野菜登録数"
          },
          {
            "expr": "sum(photos_uploaded_total)",
            "legendFormat": "写真アップロード数"
          },
          {
            "expr": "active_users",
            "legendFormat": "アクティブユーザー"
          }
        ]
      },
      {
        "id": 5,
        "title": "データベースパフォーマンス",
        "type": "graph",
        "targets": [
          {
            "expr": "pg_stat_activity_count",
            "legendFormat": "DB接続数"
          },
          {
            "expr": "avg(db_query_duration_ms)",
            "legendFormat": "平均クエリ時間"
          }
        ]
      },
      {
        "id": 6,
        "title": "CDNパフォーマンス",
        "type": "graph",
        "targets": [
          {
            "expr": "cloudflare_zone_requests_total",
            "legendFormat": "CDNリクエスト"
          },
          {
            "expr": "cloudflare_zone_bandwidth_bytes",
            "legendFormat": "帯域幅"
          }
        ]
      }
    ]
  }
}
```

## 3. アラート通知システム

### 3.1 Slack通知設定

#### lib/alert-manager.ts
```typescript
// アラート管理システム
import { StructuredLogger } from './logger'

export interface Alert {
  id: string
  severity: 'info' | 'warning' | 'error' | 'critical'
  title: string
  message: string
  component: string
  timestamp: string
  metadata?: Record<string, any>
}

export class AlertManager {
  private static readonly SLACK_WEBHOOKS = {
    critical: process.env.SLACK_CRITICAL_WEBHOOK!,
    warning: process.env.SLACK_WARNING_WEBHOOK!,
    info: process.env.SLACK_INFO_WEBHOOK!
  }

  private static readonly PAGERDUTY_ROUTING_KEY = process.env.PAGERDUTY_ROUTING_KEY!

  static async sendAlert(alert: Alert) {
    // ログ記録
    StructuredLogger.info('Alert triggered', alert)

    try {
      // Slack通知
      await this.sendSlackAlert(alert)

      // 重大度に応じてPagerDuty通知
      if (alert.severity === 'critical') {
        await this.sendPagerDutyAlert(alert)
      }

      // メール通知（重要アラート）
      if (['critical', 'error'].includes(alert.severity)) {
        await this.sendEmailAlert(alert)
      }

    } catch (error) {
      StructuredLogger.error('Failed to send alert', error as Error, { alert })
    }
  }

  private static async sendSlackAlert(alert: Alert) {
    const webhookUrl = this.SLACK_WEBHOOKS[alert.severity === 'critical' ? 'critical' : 'warning']
    
    const color = {
      info: '#36a64f',
      warning: '#ff9500',
      error: '#ff0000',
      critical: '#8b0000'
    }[alert.severity]

    const emoji = {
      info: ':information_source:',
      warning: ':warning:',
      error: ':x:',
      critical: ':rotating_light:'
    }[alert.severity]

    const payload = {
      channel: '#alerts',
      username: 'Alert Bot',
      icon_emoji: emoji,
      text: `${emoji} ${alert.title}`,
      attachments: [
        {
          color,
          fields: [
            {
              title: 'Severity',
              value: alert.severity.toUpperCase(),
              short: true
            },
            {
              title: 'Component',
              value: alert.component,
              short: true
            },
            {
              title: 'Time',
              value: new Date(alert.timestamp).toLocaleString('ja-JP'),
              short: true
            },
            {
              title: 'Message',
              value: alert.message,
              short: false
            }
          ],
          footer: 'Vegetable Management System',
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    }

    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
  }

  private static async sendPagerDutyAlert(alert: Alert) {
    const payload = {
      routing_key: this.PAGERDUTY_ROUTING_KEY,
      event_action: 'trigger',
      dedup_key: alert.id,
      payload: {
        summary: alert.title,
        severity: alert.severity,
        source: alert.component,
        timestamp: alert.timestamp,
        custom_details: alert.metadata
      }
    }

    await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
  }

  private static async sendEmailAlert(alert: Alert) {
    // SendGrid等のメールサービス経由で通知
    const emailPayload = {
      personalizations: [{
        to: [{ email: 'alerts@vegetable-system.com' }],
        subject: `${alert.severity.toUpperCase()}: ${alert.title}`
      }],
      from: { email: 'noreply@vegetable-system.com' },
      content: [{
        type: 'text/html',
        value: this.generateEmailTemplate(alert)
      }]
    }

    await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailPayload)
    })
  }

  private static generateEmailTemplate(alert: Alert): string {
    return `
      <html>
        <body>
          <h2 style="color: ${alert.severity === 'critical' ? 'red' : 'orange'}">
            Alert: ${alert.title}
          </h2>
          <p><strong>Severity:</strong> ${alert.severity.toUpperCase()}</p>
          <p><strong>Component:</strong> ${alert.component}</p>
          <p><strong>Time:</strong> ${alert.timestamp}</p>
          <p><strong>Message:</strong> ${alert.message}</p>
          ${alert.metadata ? `
            <h3>Additional Details:</h3>
            <pre>${JSON.stringify(alert.metadata, null, 2)}</pre>
          ` : ''}
        </body>
      </html>
    `
  }
}
```

### 3.2 アラート集約・エスカレーション

#### lib/alert-escalation.ts
```typescript
// アラートエスカレーション管理
export interface EscalationRule {
  condition: (alert: Alert) => boolean
  actions: EscalationAction[]
  delays: number[] // 分単位
}

export interface EscalationAction {
  type: 'slack' | 'email' | 'pagerduty' | 'webhook'
  target: string
  template?: string
}

export class AlertEscalationManager {
  private static readonly ESCALATION_RULES: EscalationRule[] = [
    // データベース関連の重大アラート
    {
      condition: (alert) => 
        alert.component === 'database' && 
        alert.severity === 'critical',
      actions: [
        { type: 'slack', target: '#db-team' },
        { type: 'pagerduty', target: 'db-team-key' },
        { type: 'email', target: 'db-admin@company.com' }
      ],
      delays: [0, 5, 15] // 即座、5分後、15分後
    },
    
    // セキュリティ関連アラート
    {
      condition: (alert) => 
        alert.component === 'security' && 
        ['error', 'critical'].includes(alert.severity),
      actions: [
        { type: 'slack', target: '#security' },
        { type: 'email', target: 'security@company.com' }
      ],
      delays: [0, 2] // 即座、2分後
    },

    // 一般的なエラー
    {
      condition: (alert) => alert.severity === 'error',
      actions: [
        { type: 'slack', target: '#alerts' }
      ],
      delays: [0, 10] // 即座、10分後
    }
  ]

  private static alertHistory = new Map<string, Date>()

  static async processAlert(alert: Alert) {
    // アラート重複除去
    if (this.isDuplicate(alert)) {
      return
    }

    // 適用可能なエスカレーションルールを検索
    const applicableRules = this.ESCALATION_RULES.filter(rule => 
      rule.condition(alert)
    )

    // エスカレーション実行
    for (const rule of applicableRules) {
      await this.executeEscalation(alert, rule)
    }

    // アラート履歴に追加
    this.alertHistory.set(alert.id, new Date())
  }

  private static isDuplicate(alert: Alert): boolean {
    const lastSent = this.alertHistory.get(alert.id)
    if (!lastSent) return false

    // 同じアラートが10分以内に送信されている場合は重複とする
    const timeDiff = Date.now() - lastSent.getTime()
    return timeDiff < 10 * 60 * 1000
  }

  private static async executeEscalation(alert: Alert, rule: EscalationRule) {
    for (let i = 0; i < rule.actions.length; i++) {
      const action = rule.actions[i]
      const delay = rule.delays[i] || 0

      if (delay > 0) {
        setTimeout(() => {
          this.executeAction(alert, action)
        }, delay * 60 * 1000)
      } else {
        await this.executeAction(alert, action)
      }
    }
  }

  private static async executeAction(alert: Alert, action: EscalationAction) {
    switch (action.type) {
      case 'slack':
        await this.sendSlackAlert(alert, action.target)
        break
      case 'email':
        await this.sendEmailAlert(alert, action.target)
        break
      case 'pagerduty':
        await AlertManager.sendAlert(alert) // PagerDuty通知
        break
      case 'webhook':
        await this.sendWebhookAlert(alert, action.target)
        break
    }
  }

  private static async sendWebhookAlert(alert: Alert, url: string) {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(alert)
    })
  }
}
```

## 4. ヘルスチェック・SLA監視

### 4.1 包括的ヘルスチェック

#### api/health/route.ts
```typescript
// 包括的ヘルスチェックAPI
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { AlertManager } from '@/lib/alert-manager'

interface HealthCheck {
  name: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  responseTime: number
  lastCheck: string
  details?: any
}

export async function GET() {
  const startTime = Date.now()
  const healthChecks: HealthCheck[] = []

  // データベースヘルスチェック
  const dbHealth = await checkDatabaseHealth()
  healthChecks.push(dbHealth)

  // 外部API依存関係チェック
  const externalApiHealth = await checkExternalApis()
  healthChecks.push(...externalApiHealth)

  // ストレージヘルスチェック
  const storageHealth = await checkStorageHealth()
  healthChecks.push(storageHealth)

  // メモリ・CPU使用率チェック
  const resourceHealth = await checkResourceUsage()
  healthChecks.push(resourceHealth)

  // 全体的なステータス判定
  const overallStatus = determineOverallStatus(healthChecks)
  const totalResponseTime = Date.now() - startTime

  const healthReport = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    responseTime: totalResponseTime,
    checks: healthChecks,
    version: process.env.APP_VERSION,
    uptime: process.uptime()
  }

  // 異常検知時のアラート
  if (overallStatus !== 'healthy') {
    await AlertManager.sendAlert({
      id: `health-check-${Date.now()}`,
      severity: overallStatus === 'unhealthy' ? 'critical' : 'warning',
      title: 'Health Check Failed',
      message: `System health status: ${overallStatus}`,
      component: 'health-check',
      timestamp: new Date().toISOString(),
      metadata: healthReport
    })
  }

  const statusCode = overallStatus === 'healthy' ? 200 : 
                    overallStatus === 'degraded' ? 200 : 503

  return NextResponse.json(healthReport, { status: statusCode })
}

async function checkDatabaseHealth(): Promise<HealthCheck> {
  const startTime = Date.now()
  
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 簡単なクエリ実行
    const { data, error } = await supabase
      .from('vegetables')
      .select('id')
      .limit(1)

    const responseTime = Date.now() - startTime

    if (error) {
      return {
        name: 'database',
        status: 'unhealthy',
        responseTime,
        lastCheck: new Date().toISOString(),
        details: { error: error.message }
      }
    }

    const status = responseTime > 1000 ? 'degraded' : 'healthy'

    return {
      name: 'database',
      status,
      responseTime,
      lastCheck: new Date().toISOString(),
      details: { recordCount: data?.length || 0 }
    }

  } catch (error) {
    return {
      name: 'database',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      lastCheck: new Date().toISOString(),
      details: { error: (error as Error).message }
    }
  }
}

async function checkExternalApis(): Promise<HealthCheck[]> {
  const apis = [
    { name: 'openai', url: 'https://api.openai.com/v1/models' },
  ]

  const checks = await Promise.all(
    apis.map(async (api) => {
      const startTime = Date.now()
      
      try {
        const response = await fetch(api.url, {
          method: 'GET',
          timeout: 5000
        })

        const responseTime = Date.now() - startTime
        const status = response.ok ? 
          (responseTime > 2000 ? 'degraded' : 'healthy') : 
          'unhealthy'

        return {
          name: api.name,
          status,
          responseTime,
          lastCheck: new Date().toISOString(),
          details: { httpStatus: response.status }
        }

      } catch (error) {
        return {
          name: api.name,
          status: 'unhealthy' as const,
          responseTime: Date.now() - startTime,
          lastCheck: new Date().toISOString(),
          details: { error: (error as Error).message }
        }
      }
    })
  )

  return checks
}

async function checkStorageHealth(): Promise<HealthCheck> {
  const startTime = Date.now()
  
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // ストレージバケットの一覧取得
    const { data, error } = await supabase.storage.listBuckets()

    const responseTime = Date.now() - startTime

    if (error) {
      return {
        name: 'storage',
        status: 'unhealthy',
        responseTime,
        lastCheck: new Date().toISOString(),
        details: { error: error.message }
      }
    }

    return {
      name: 'storage',
      status: 'healthy',
      responseTime,
      lastCheck: new Date().toISOString(),
      details: { buckets: data?.length || 0 }
    }

  } catch (error) {
    return {
      name: 'storage',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      lastCheck: new Date().toISOString(),
      details: { error: (error as Error).message }
    }
  }
}

async function checkResourceUsage(): Promise<HealthCheck> {
  const startTime = Date.now()
  
  try {
    const memoryUsage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()

    // メモリ使用率の計算（大まかな推定）
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    
    if (memoryUsagePercent > 90) {
      status = 'unhealthy'
    } else if (memoryUsagePercent > 75) {
      status = 'degraded'
    }

    return {
      name: 'resources',
      status,
      responseTime: Date.now() - startTime,
      lastCheck: new Date().toISOString(),
      details: {
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          percentage: Math.round(memoryUsagePercent)
        },
        uptime: process.uptime()
      }
    }

  } catch (error) {
    return {
      name: 'resources',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      lastCheck: new Date().toISOString(),
      details: { error: (error as Error).message }
    }
  }
}

function determineOverallStatus(checks: HealthCheck[]): 'healthy' | 'degraded' | 'unhealthy' {
  const unhealthyCount = checks.filter(c => c.status === 'unhealthy').length
  const degradedCount = checks.filter(c => c.status === 'degraded').length

  if (unhealthyCount > 0) return 'unhealthy'
  if (degradedCount > 0) return 'degraded'
  return 'healthy'
}
```

これで監視・ロギング・アラート設定が完了しました。次に災害対策・事業継続計画に進みます。