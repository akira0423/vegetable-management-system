# パフォーマンス最適化ガイド

## 1. フロントエンド最適化

### 1.1 Core Web Vitals最適化
```typescript
// lib/performance.ts
export class PerformanceOptimizer {
  // 画像最適化設定
  static readonly IMAGE_OPTIMIZATION = {
    formats: ['image/avif', 'image/webp', 'image/jpeg'] as const,
    sizes: [640, 750, 828, 1080, 1200, 1920] as const,
    quality: 85,
    placeholder: 'blur' as const
  }

  // Largest Contentful Paint (LCP) 改善
  static optimizeLCP() {
    // 重要リソースのプリロード
    const preloadLinks = [
      '<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>',
      '<link rel="preload" href="/api/vegetables" as="fetch" crossorigin>',
      '<link rel="preconnect" href="https://api.supabase.co">',
    ]
    
    // Critical CSS インライン化
    const criticalCSS = `
      .layout-header { display: flex; height: 64px; }
      .main-content { min-height: calc(100vh - 64px); }
      .loading-spinner { animation: spin 1s linear infinite; }
    `
    
    return { preloadLinks, criticalCSS }
  }

  // Cumulative Layout Shift (CLS) 改善
  static preventLayoutShift() {
    return {
      // 画像のアスペクト比予約
      imageWrapperStyle: {
        aspectRatio: '16/9',
        backgroundColor: '#f3f4f6'
      },
      
      // スケルトンローダー
      skeletonConfig: {
        height: '20px',
        borderRadius: '4px',
        backgroundColor: '#e5e7eb'
      }
    }
  }

  // First Input Delay (FID) 改善
  static optimizeFID() {
    // 非同期でのJavaScript分割実行
    return {
      // 重い処理の分割
      chunkProcessor: (items: any[], chunkSize = 100) => {
        return new Promise((resolve) => {
          let index = 0
          const process = () => {
            const chunk = items.slice(index, index + chunkSize)
            // 処理実行
            index += chunkSize
            
            if (index < items.length) {
              setTimeout(process, 0) // 次のフレームで続行
            } else {
              resolve(true)
            }
          }
          process()
        })
      }
    }
  }
}

// 自動パフォーマンス監視
export const performanceMonitor = {
  // Web Vitals測定
  measureWebVitals: () => {
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS(metric => analytics.track('web-vitals', { metric: 'CLS', value: metric.value }))
      getFID(metric => analytics.track('web-vitals', { metric: 'FID', value: metric.value }))
      getFCP(metric => analytics.track('web-vitals', { metric: 'FCP', value: metric.value }))
      getLCP(metric => analytics.track('web-vitals', { metric: 'LCP', value: metric.value }))
      getTTFB(metric => analytics.track('web-vitals', { metric: 'TTFB', value: metric.value }))
    })
  },

  // リソース使用量監視
  monitorResourceUsage: () => {
    if (typeof window !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory
      analytics.track('resource-usage', {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit
      })
    }
  }
}
```

### 1.2 バンドル最適化
```javascript
// next.config.js - 高度な最適化設定
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true'
})

const nextConfig = {
  // Tree shaking最適化
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      'date-fns'
    ],
    
    // サーバーコンポーネント最適化
    serverComponentsExternalPackages: [
      '@supabase/supabase-js',
      'sharp',
      'canvas'
    ]
  },

  // 画像最適化
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400, // 24時間
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    
    // 外部画像プロバイダー
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/**'
      }
    ]
  },

  // 圧縮設定
  compress: true,
  
  // Static Generation最適化
  generateStaticParams: async () => {
    // 人気の野菜ページを静的生成
    return [
      { category: 'tomato' },
      { category: 'cucumber' },
      { category: 'lettuce' }
    ]
  },

  // webpack最適化
  webpack: (config, { isServer, dev }) => {
    if (!dev && !isServer) {
      // プロダクション時の最適化
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all'
          },
          ui: {
            test: /[\\/]src[\\/]components[\\/]ui[\\/]/,
            name: 'ui-components',
            chunks: 'all'
          }
        }
      }
    }
    
    return config
  }
}

module.exports = withBundleAnalyzer(nextConfig)
```

### 1.3 キャッシュ戦略
```typescript
// lib/cache-strategy.ts
export class CacheStrategy {
  // Service Worker キャッシュ戦略
  static readonly CACHE_STRATEGIES = {
    // 静的アセット（長期キャッシュ）
    static: {
      strategy: 'CacheFirst',
      ttl: 365 * 24 * 60 * 60, // 1年
      patterns: ['/static/', '/_next/static/', '/images/']
    },
    
    // API レスポンス（短期キャッシュ + 再検証）
    api: {
      strategy: 'StaleWhileRevalidate',
      ttl: 5 * 60, // 5分
      patterns: ['/api/vegetables', '/api/analytics']
    },
    
    // 画像（中期キャッシュ）
    images: {
      strategy: 'CacheFirst',
      ttl: 7 * 24 * 60 * 60, // 1週間
      patterns: ['*.jpg', '*.png', '*.webp', '*.avif']
    }
  }

  // Redis キャッシュ実装
  static async getWithCache<T>(
    key: string, 
    fetcher: () => Promise<T>,
    ttl: number = 300 // 5分デフォルト
  ): Promise<T> {
    try {
      const cached = await redis.get(key)
      if (cached) {
        return JSON.parse(cached)
      }
    } catch (error) {
      console.warn('Cache read failed:', error)
    }

    const data = await fetcher()
    
    try {
      await redis.setex(key, ttl, JSON.stringify(data))
    } catch (error) {
      console.warn('Cache write failed:', error)
    }

    return data
  }

  // データベースクエリキャッシュ
  static async getCachedVegetables(companyId: string) {
    return this.getWithCache(
      `vegetables:${companyId}`,
      async () => {
        const { data } = await supabase
          .from('vegetables')
          .select('*')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
        
        return data
      },
      300 // 5分キャッシュ
    )
  }
}
```

## 2. バックエンド・データベース最適化

### 2.1 データベースクエリ最適化
```sql
-- インデックス最適化戦略
-- 1. 複合インデックス（最も使用頻度の高いクエリ用）
CREATE INDEX CONCURRENTLY idx_vegetables_company_status_created 
  ON vegetables(company_id, status, created_at DESC);

-- 2. 部分インデックス（条件付きクエリ用）
CREATE INDEX CONCURRENTLY idx_vegetables_active 
  ON vegetables(company_id, created_at DESC) 
  WHERE status IN ('growing', 'harvesting');

-- 3. カバーリングインデックス（JOIN回避用）
CREATE INDEX CONCURRENTLY idx_photos_vegetable_metadata 
  ON photos(vegetable_id, created_at DESC) 
  INCLUDE (storage_path, file_size, description);

-- クエリ実行計画の分析
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) 
SELECT v.*, COUNT(p.id) as photo_count
FROM vegetables v
LEFT JOIN photos p ON v.id = p.vegetable_id
WHERE v.company_id = $1 AND v.status = 'growing'
GROUP BY v.id
ORDER BY v.created_at DESC
LIMIT 20;

-- 統計情報自動更新
SELECT cron.schedule(
  'update-table-stats',
  '0 2 * * *',  -- 毎日午前2時
  $$
  ANALYZE vegetables;
  ANALYZE photos;
  ANALYZE operation_logs;
  ANALYZE gantt_tasks;
  $$
);
```

### 2.2 API パフォーマンス最適化
```typescript
// api/vegetables/route.ts - 最適化版
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('company_id')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
  
  // キャッシュキー生成
  const cacheKey = `vegetables:${companyId}:${page}:${limit}`
  
  try {
    // Redis からキャッシュ取得
    const cachedResult = await CacheStrategy.getWithCache(
      cacheKey,
      async () => {
        // 並列クエリ実行でレスポンス時間短縮
        const [vegetablesResult, totalCountResult] = await Promise.all([
          // メインクエリ
          supabase
            .from('vegetables')
            .select(`
              id, name, variety_name, plot_name, planting_date,
              expected_harvest_date, status, created_at,
              photos_count:photos(count)
            `)
            .eq('company_id', companyId)
            .order('created_at', { ascending: false })
            .range((page - 1) * limit, page * limit - 1),
          
          // カウントクエリ（概算値使用で高速化）
          supabase
            .rpc('get_vegetables_count_estimate', { company_id: companyId })
        ])

        const vegetables = vegetablesResult.data || []
        const totalCount = totalCountResult.data || 0

        return {
          data: vegetables,
          pagination: {
            page,
            limit,
            total: totalCount,
            hasMore: vegetables.length === limit
          }
        }
      },
      300 // 5分キャッシュ
    )

    return NextResponse.json({
      success: true,
      ...cachedResult
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// データベース関数（概算カウント高速化）
```

```sql
-- 概算カウント関数（高速化）
CREATE OR REPLACE FUNCTION get_vegetables_count_estimate(company_id UUID)
RETURNS INTEGER AS $$
DECLARE
  estimate INTEGER;
BEGIN
  -- 統計情報から概算値を取得（高速）
  SELECT (
    reltuples * (
      pg_stats.n_distinct / 
      (SELECT COUNT(DISTINCT company_id) FROM vegetables)
    )
  )::INTEGER
  INTO estimate
  FROM pg_class 
  JOIN pg_stats ON pg_class.relname = pg_stats.tablename
  WHERE pg_class.relname = 'vegetables' 
    AND pg_stats.attname = 'company_id';
    
  -- フォールバック（正確なカウント）
  IF estimate IS NULL THEN
    SELECT COUNT(*) INTO estimate 
    FROM vegetables 
    WHERE vegetables.company_id = $1;
  END IF;
  
  RETURN COALESCE(estimate, 0);
END;
$$ LANGUAGE plpgsql;
```

## 3. 監視・アラート設定

### 3.1 パフォーマンス監視ダッシュボード
```typescript
// lib/monitoring-dashboard.ts
export class MonitoringDashboard {
  // アプリケーションメトリクス
  static readonly METRICS = {
    // レスポンス時間
    response_time: {
      targets: {
        p50: 200,    // 50%のリクエストが200ms以下
        p95: 500,    // 95%のリクエストが500ms以下  
        p99: 1000    // 99%のリクエストが1000ms以下
      }
    },
    
    // スループット
    throughput: {
      target: 1000, // 1000 req/min
      alert_threshold: 1500 // アラート閾値
    },
    
    // エラー率
    error_rate: {
      target: 0.01,  // 1%以下
      alert_threshold: 0.05 // 5%でアラート
    },
    
    // データベース
    database: {
      connection_pool_usage: 0.8, // 80%でアラート
      query_time_p95: 100,        // 95%のクエリが100ms以下
      deadlocks_per_hour: 0       // デッドロックなし
    }
  }

  // リアルタイム監視
  static async collectMetrics(): Promise<any> {
    const metrics = await Promise.all([
      this.getResponseTimeMetrics(),
      this.getErrorRateMetrics(), 
      this.getDatabaseMetrics(),
      this.getResourceUsageMetrics()
    ])

    return {
      timestamp: new Date().toISOString(),
      response_time: metrics[0],
      error_rate: metrics[1],
      database: metrics[2],
      resources: metrics[3]
    }
  }

  private static async getResponseTimeMetrics() {
    // Vercel Analytics API から取得
    const response = await fetch('https://api.vercel.com/v1/analytics/metrics', {
      headers: {
        'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      }
    })
    
    const data = await response.json()
    return data.responseTime
  }

  private static async getDatabaseMetrics() {
    // Supabase メトリクス取得
    const { data } = await supabase
      .from('pg_stat_database')
      .select('*')
      .eq('datname', 'postgres')
      .single()

    return {
      connections: data.numbackends,
      transactions_per_sec: data.xact_commit + data.xact_rollback,
      cache_hit_ratio: data.blks_hit / (data.blks_hit + data.blks_read)
    }
  }
}

// アラート設定
export const alertManager = {
  checkAndAlert: async (metrics: any) => {
    const alerts = []

    // レスポンス時間アラート
    if (metrics.response_time.p95 > MonitoringDashboard.METRICS.response_time.targets.p95) {
      alerts.push({
        type: 'performance',
        severity: 'warning',
        message: `Response time P95: ${metrics.response_time.p95}ms exceeds target`
      })
    }

    // エラー率アラート
    if (metrics.error_rate > MonitoringDashboard.METRICS.error_rate.alert_threshold) {
      alerts.push({
        type: 'error_rate',
        severity: 'critical',
        message: `Error rate: ${metrics.error_rate} exceeds threshold`
      })
    }

    // アラート送信
    for (const alert of alerts) {
      await this.sendAlert(alert)
    }
  },

  sendAlert: async (alert: any) => {
    // Slack通知
    await fetch(process.env.SLACK_MONITORING_WEBHOOK!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🚨 ${alert.severity.toUpperCase()}: ${alert.message}`,
        channel: '#monitoring',
        username: 'Monitoring Bot'
      })
    })

    // PagerDuty連携（Critical alerts）
    if (alert.severity === 'critical') {
      await fetch('https://events.pagerduty.com/v2/enqueue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token token=${process.env.PAGERDUTY_TOKEN}`
        },
        body: JSON.stringify({
          routing_key: process.env.PAGERDUTY_ROUTING_KEY,
          event_action: 'trigger',
          payload: {
            summary: alert.message,
            severity: alert.severity,
            source: 'vegetable-management-system'
          }
        })
      })
    }
  }
}
```

### 3.2 自動スケーリング設定
```yaml
# docker-compose.yml - 自動スケーリング対応
version: '3.8'

services:
  app:
    image: vegetable-management-app
    deploy:
      replicas: 2
      update_config:
        parallelism: 1
        delay: 10s
        failure_action: rollback
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
        window: 120s
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
    
    # ヘルスチェック
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Redis キャッシュ
  redis:
    image: redis:7-alpine
    deploy:
      resources:
        limits:
          memory: 256M
        reservations:
          memory: 128M
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```