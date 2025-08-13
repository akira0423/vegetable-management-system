# ドメイン・SSL・CDN設定ガイド

## 1. ドメイン設定・DNS管理

### 1.1 CloudFlare DNS設定

#### DNS レコード構成
```bash
# メインドメイン
vegetable-system.com     A     192.0.2.1     # CDN endpoint
www.vegetable-system.com CNAME vegetable-system.com

# サブドメイン
api.vegetable-system.com     CNAME cname.vercel-dns.com
staging.vegetable-system.com CNAME staging-cname.vercel-dns.com
admin.vegetable-system.com   CNAME admin-cname.vercel-dns.com

# セキュリティ・検証用
vegetable-system.com TXT "v=spf1 include:_spf.google.com ~all"
_dmarc.vegetable-system.com TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@vegetable-system.com"

# SSL証明書検証
_acme-challenge.vegetable-system.com TXT "challenge-token-here"
```

#### Terraform DNS設定
```hcl
# dns-config.tf
terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

resource "cloudflare_zone" "main" {
  zone = "vegetable-system.com"
  plan = "pro"
}

# メインドメイン
resource "cloudflare_record" "root" {
  zone_id = cloudflare_zone.main.id
  name    = "@"
  value   = "cname.vercel-dns.com"
  type    = "CNAME"
  proxied = true
}

resource "cloudflare_record" "www" {
  zone_id = cloudflare_zone.main.id
  name    = "www"
  value   = "vegetable-system.com"
  type    = "CNAME"
  proxied = true
}

# API サブドメイン
resource "cloudflare_record" "api" {
  zone_id = cloudflare_zone.main.id
  name    = "api"
  value   = "cname.vercel-dns.com"
  type    = "CNAME"
  proxied = true
}

# ステージング環境
resource "cloudflare_record" "staging" {
  zone_id = cloudflare_zone.main.id
  name    = "staging"
  value   = "staging-cname.vercel-dns.com"
  type    = "CNAME"
  proxied = true
}

# セキュリティレコード
resource "cloudflare_record" "spf" {
  zone_id = cloudflare_zone.main.id
  name    = "@"
  value   = "v=spf1 include:_spf.google.com ~all"
  type    = "TXT"
}

resource "cloudflare_record" "dmarc" {
  zone_id = cloudflare_zone.main.id
  name    = "_dmarc"
  value   = "v=DMARC1; p=quarantine; rua=mailto:dmarc@vegetable-system.com; ruf=mailto:dmarc@vegetable-system.com"
  type    = "TXT"
}
```

### 1.2 ドメイン検証・設定スクリプト

#### scripts/domain-setup.sh
```bash
#!/bin/bash
set -e

DOMAIN=${1:-vegetable-system.com}
CLOUDFLARE_ZONE_ID=${2:-$CF_ZONE_ID}

echo "🌐 Setting up domain: ${DOMAIN}"

# DNS レコードの検証
echo "📋 Verifying DNS records..."

check_dns_record() {
    local record_type=$1
    local record_name=$2
    local expected_value=$3
    
    echo "Checking ${record_type} record for ${record_name}..."
    actual_value=$(dig +short ${record_type} ${record_name} @1.1.1.1)
    
    if [[ "$actual_value" == *"$expected_value"* ]]; then
        echo "✅ ${record_name} ${record_type} record is correct"
    else
        echo "❌ ${record_name} ${record_type} record mismatch"
        echo "   Expected: ${expected_value}"
        echo "   Actual: ${actual_value}"
        return 1
    fi
}

# 主要DNSレコードの確認
check_dns_record "A" "${DOMAIN}" "192.0.2"
check_dns_record "CNAME" "www.${DOMAIN}" "${DOMAIN}"
check_dns_record "CNAME" "api.${DOMAIN}" "vercel"

# SSL証明書の検証
echo "🔒 Verifying SSL certificate..."
ssl_expiry=$(echo | openssl s_client -servername ${DOMAIN} -connect ${DOMAIN}:443 2>/dev/null | openssl x509 -noout -enddate | cut -d'=' -f2)
ssl_expiry_epoch=$(date -d "${ssl_expiry}" +%s)
current_epoch=$(date +%s)
days_until_expiry=$(( (ssl_expiry_epoch - current_epoch) / 86400 ))

echo "SSL certificate expires: ${ssl_expiry}"
echo "Days until expiry: ${days_until_expiry}"

if [ ${days_until_expiry} -lt 30 ]; then
    echo "⚠️ SSL certificate expires in less than 30 days"
    exit 1
else
    echo "✅ SSL certificate is valid"
fi

# CloudFlare設定の検証
echo "☁️ Verifying CloudFlare configuration..."
cf_status=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" | jq -r '.result.status')

if [ "$cf_status" = "active" ]; then
    echo "✅ CloudFlare zone is active"
else
    echo "❌ CloudFlare zone status: ${cf_status}"
    exit 1
fi

echo "🎉 Domain setup verification completed successfully!"
```

## 2. SSL/TLS設定

### 2.1 CloudFlare SSL設定

#### CloudFlare SSL Config
```javascript
// cloudflare-ssl-config.js
const CLOUDFLARE_SSL_CONFIG = {
  // SSL/TLS モード: Full (strict)
  ssl_mode: 'full',
  
  // TLS バージョン設定
  min_tls_version: '1.2',
  tls_1_3: 'on',
  
  // HTTP Strict Transport Security
  hsts: {
    enabled: true,
    max_age: 31536000,
    include_subdomains: true,
    preload: true,
    no_sniff: true
  },
  
  // SSL証明書設定
  certificate: {
    type: 'universal',
    hosts: [
      'vegetable-system.com',
      '*.vegetable-system.com'
    ]
  },
  
  // エッジ証明書
  edge_certificates: {
    enabled: true,
    certificate_authority: 'lets_encrypt'
  }
}

// CloudFlare API経由での設定適用
async function applySSLConfig(zoneId, config) {
  const baseURL = 'https://api.cloudflare.com/client/v4'
  const headers = {
    'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
    'Content-Type': 'application/json'
  }

  // SSL設定の適用
  await fetch(`${baseURL}/zones/${zoneId}/settings/ssl`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ value: config.ssl_mode })
  })

  // TLS設定の適用
  await fetch(`${baseURL}/zones/${zoneId}/settings/min_tls_version`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ value: config.min_tls_version })
  })

  // HSTS設定の適用
  await fetch(`${baseURL}/zones/${zoneId}/settings/security_header`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      value: {
        strict_transport_security: config.hsts
      }
    })
  })

  console.log('✅ SSL configuration applied successfully')
}
```

### 2.2 証明書監視・自動更新

#### scripts/ssl-monitoring.sh
```bash
#!/bin/bash

DOMAINS=("vegetable-system.com" "api.vegetable-system.com" "staging.vegetable-system.com")
SLACK_WEBHOOK=${SLACK_WEBHOOK:-""}
ALERT_DAYS=${ALERT_DAYS:-30}

echo "🔒 SSL Certificate Monitoring Started"

for domain in "${DOMAINS[@]}"; do
    echo "Checking SSL certificate for: ${domain}"
    
    # 証明書情報取得
    cert_info=$(echo | openssl s_client -servername ${domain} -connect ${domain}:443 2>/dev/null | openssl x509 -noout -dates -subject -issuer)
    
    if [ $? -ne 0 ]; then
        echo "❌ Failed to retrieve certificate for ${domain}"
        continue
    fi
    
    # 有効期限取得
    not_after=$(echo "$cert_info" | grep 'notAfter' | cut -d'=' -f2)
    expiry_epoch=$(date -d "$not_after" +%s)
    current_epoch=$(date +%s)
    days_remaining=$(( (expiry_epoch - current_epoch) / 86400 ))
    
    echo "Certificate expires: $not_after"
    echo "Days remaining: $days_remaining"
    
    # アラート判定
    if [ $days_remaining -lt $ALERT_DAYS ]; then
        message="🚨 SSL Certificate Alert: ${domain} expires in ${days_remaining} days"
        echo "$message"
        
        # Slack通知
        if [ ! -z "$SLACK_WEBHOOK" ]; then
            curl -X POST -H 'Content-type: application/json' \
                --data "{\"text\":\"$message\"}" \
                "$SLACK_WEBHOOK"
        fi
        
        # 自動更新トリガー（Let's Encrypt）
        if [ $days_remaining -lt 7 ]; then
            echo "🔄 Triggering certificate renewal..."
            # CloudFlare Universal SSL は自動更新
            # カスタム証明書の場合は certbot 等を実行
        fi
    else
        echo "✅ Certificate for ${domain} is valid"
    fi
    
    echo "---"
done

echo "🏁 SSL monitoring completed"
```

## 3. CDN最適化設定

### 3.1 CloudFlare CDN設定

#### CloudFlare Rules設定
```javascript
// cloudflare-rules.js
const CLOUDFLARE_RULES = {
  // キャッシュルール
  cache_rules: [
    {
      name: "Cache Static Assets",
      expression: "(http.request.uri.path matches \"\\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$\")",
      action: "cache",
      cache_ttl: 31536000, // 1年
      edge_cache_ttl: 86400 // 1日
    },
    {
      name: "Cache API Responses",
      expression: "(http.request.uri.path matches \"^/api/vegetables\")",
      action: "cache",
      cache_ttl: 300, // 5分
      cache_by_device: false
    },
    {
      name: "No Cache Admin",
      expression: "(http.request.uri.path matches \"^/admin\" or http.request.uri.path matches \"^/dashboard\")",
      action: "bypass_cache"
    }
  ],

  // 圧縮設定
  compression: {
    gzip: true,
    brotli: true,
    minimum_file_size: 1024
  },

  // Minification
  minification: {
    css: true,
    html: true,
    js: true
  },

  // Image Optimization
  image_optimization: {
    enabled: true,
    formats: ['webp', 'avif'],
    quality: 85,
    metadata: 'strip'
  },

  // Rocket Loader (JavaScript最適化)
  rocket_loader: 'off', // Next.jsと競合するため無効

  // Mirage (画像最適化)
  mirage: true,
  
  // Auto Minify
  auto_minify: {
    css: true,
    html: true,
    js: false // Next.jsで既に最適化済み
  }
}

// 設定適用関数
async function applyCDNRules(zoneId) {
  const baseURL = 'https://api.cloudflare.com/client/v4'
  const headers = {
    'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
    'Content-Type': 'application/json'
  }

  // Page Rules作成
  for (const rule of CLOUDFLARE_RULES.cache_rules) {
    await fetch(`${baseURL}/zones/${zoneId}/pagerules`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        targets: [{ target: 'url', constraint: { operator: 'matches', value: rule.expression }}],
        actions: [
          { id: 'cache_level', value: rule.action },
          { id: 'edge_cache_ttl', value: rule.edge_cache_ttl },
          { id: 'browser_cache_ttl', value: rule.cache_ttl }
        ],
        status: 'active'
      })
    })
  }

  console.log('✅ CDN rules applied successfully')
}
```

### 3.2 パフォーマンス最適化設定

#### next.config.js CDN設定
```javascript
// next.config.js - CDN最適化
const nextConfig = {
  // CDN設定
  assetPrefix: process.env.NODE_ENV === 'production' 
    ? 'https://cdn.vegetable-system.com' 
    : '',

  // 画像最適化（CloudFlare連携）
  images: {
    domains: [
      'cdn.vegetable-system.com',
      'vegetable-system.com',
      'api.supabase.co'
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 86400, // 24時間
    
    // CloudFlare Image Resizing
    loader: process.env.NODE_ENV === 'production' 
      ? 'custom' 
      : 'default',
    loaderFile: './lib/cloudflare-image-loader.js'
  },

  // 静的エクスポート設定
  trailingSlash: false,
  
  // ヘッダー設定（CDN連携）
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          }
        ]
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, s-maxage=300'
          }
        ]
      }
    ]
  }
}
```

#### lib/cloudflare-image-loader.js
```javascript
// CloudFlare Image Resizing Loader
export default function cloudflareLoader({ src, width, quality }) {
  const params = [`width=${width}`]
  
  if (quality) {
    params.push(`quality=${quality}`)
  }
  
  // CloudFlare Image Resizing
  const baseUrl = 'https://vegetable-system.com/cdn-cgi/image'
  return `${baseUrl}/${params.join(',')}/${src}`
}
```

## 4. パフォーマンス監視

### 4.1 Real User Monitoring (RUM)

#### lib/performance-monitoring.js
```javascript
// Real User Monitoring設定
class PerformanceMonitoring {
  constructor() {
    this.metricsBuffer = []
    this.endpoint = '/api/metrics'
  }

  // Core Web Vitals監視
  observeCoreWebVitals() {
    // Largest Contentful Paint
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'largest-contentful-paint') {
          this.recordMetric('LCP', entry.value, {
            element: entry.element?.tagName
          })
        }
      }
    }).observe({ entryTypes: ['largest-contentful-paint'] })

    // First Input Delay
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.recordMetric('FID', entry.processingStart - entry.startTime)
      }
    }).observe({ entryTypes: ['first-input'] })

    // Cumulative Layout Shift
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          this.recordMetric('CLS', entry.value)
        }
      }
    }).observe({ entryTypes: ['layout-shift'] })
  }

  // CDNパフォーマンス監視
  monitorCDNPerformance() {
    // Resource Timing監視
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name.includes('cdn.vegetable-system.com')) {
          this.recordMetric('CDN_Response_Time', entry.responseEnd - entry.requestStart, {
            resource: entry.name,
            cached: entry.transferSize === 0
          })
        }
      }
    }).observe({ entryTypes: ['resource'] })
  }

  recordMetric(name, value, metadata = {}) {
    const metric = {
      name,
      value,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      connection: navigator.connection?.effectiveType,
      ...metadata
    }

    this.metricsBuffer.push(metric)

    // バッファが満杯または重要メトリクスの場合は即座に送信
    if (this.metricsBuffer.length >= 10 || ['LCP', 'FID', 'CLS'].includes(name)) {
      this.sendMetrics()
    }
  }

  async sendMetrics() {
    if (this.metricsBuffer.length === 0) return

    const metrics = [...this.metricsBuffer]
    this.metricsBuffer = []

    try {
      await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ metrics }),
        keepalive: true
      })
    } catch (error) {
      console.error('Failed to send metrics:', error)
      // 送信失敗時はバッファに戻す（簡易実装）
      this.metricsBuffer.unshift(...metrics)
    }
  }
}

// 自動初期化
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  const monitor = new PerformanceMonitoring()
  monitor.observeCoreWebVitals()
  monitor.monitorCDNPerformance()

  // ページ離脱時にメトリクス送信
  window.addEventListener('beforeunload', () => {
    monitor.sendMetrics()
  })
}
```

### 4.2 CDN分析ダッシュボード

#### api/analytics/cdn.ts
```typescript
// CDN Analytics API
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const timeframe = searchParams.get('timeframe') || '24h'
  
  try {
    // CloudFlare Analytics API
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}/analytics/dashboard`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        next: { revalidate: 300 } // 5分キャッシュ
      }
    )

    const data = await response.json()

    const analytics = {
      // 基本メトリクス
      requests: data.result.totals.requests.all,
      bandwidth: data.result.totals.bandwidth.all,
      cached_requests: data.result.totals.requests.cached,
      cache_hit_ratio: (data.result.totals.requests.cached / data.result.totals.requests.all * 100).toFixed(2),

      // パフォーマンスメトリクス
      avg_response_time: data.result.timeseries.reduce((acc, item) => 
        acc + item.avg_response_time, 0) / data.result.timeseries.length,

      // 地理的分布
      top_countries: data.result.totals.countries.slice(0, 10),

      // コンテンツタイプ別統計
      content_types: {
        html: data.result.totals.content_type.html || 0,
        css: data.result.totals.content_type.css || 0,
        javascript: data.result.totals.content_type.javascript || 0,
        images: data.result.totals.content_type.images || 0,
        api: data.result.totals.content_type.json || 0
      },

      // エラー統計
      errors: {
        '4xx': data.result.totals.requests.http_status_4xx,
        '5xx': data.result.totals.requests.http_status_5xx
      }
    }

    return NextResponse.json({
      success: true,
      timeframe,
      data: analytics
    })

  } catch (error) {
    console.error('CDN Analytics Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch CDN analytics' },
      { status: 500 }
    )
  }
}
```

これでドメイン・SSL・CDN設定が完了しました。次に監視・ロギング・アラート設定に進みます。