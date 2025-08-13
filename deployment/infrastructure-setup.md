# 本番環境インフラ設計書

## 1. アーキテクチャ概要

### 1.1 推奨構成（AWS/Vercel）
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CloudFlare    │────│   Vercel CDN    │────│  Next.js App    │
│   (DNS/WAF)     │    │   (Static/Edge) │    │  (Server/API)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                       ┌─────────────────┐             │
                       │   Supabase      │─────────────┘
                       │   (DB/Storage)  │
                       └─────────────────┘
```

### 1.2 本番環境要件
- **高可用性**: 99.9% uptime
- **スケーラビリティ**: 自動スケーリング対応
- **セキュリティ**: エンタープライズレベル
- **パフォーマンス**: Core Web Vitals 全項目グリーン

## 2. インフラストラクチャ設定

### 2.1 Vercel本番デプロイ設定

#### vercel.json
```json
{
  "version": 2,
  "build": {
    "env": {
      "NODE_ENV": "production"
    }
  },
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 30
    }
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
        }
      ]
    }
  ],
  "redirects": [
    {
      "source": "/admin",
      "destination": "/dashboard",
      "permanent": true
    }
  ]
}
```

#### 環境変数設定
```bash
# Vercel CLI でのセットアップ
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add OPENAI_API_KEY
vercel env add NODE_ENV production
```

### 2.2 Supabase本番設定

#### データベース設定
```sql
-- 本番環境用の最適化設定
ALTER DATABASE postgres SET shared_preload_libraries = 'pg_stat_statements';
ALTER DATABASE postgres SET log_statement = 'all';
ALTER DATABASE postgres SET log_duration = on;

-- 接続プール設定
ALTER DATABASE postgres SET max_connections = 100;
ALTER DATABASE postgres SET shared_buffers = '256MB';
```

#### Row Level Security (RLS) 強化
```sql
-- 厳格なRLS設定
ALTER TABLE vegetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_logs ENABLE ROW LEVEL SECURITY;

-- 本番用セキュリティポリシー
CREATE POLICY "Users can only access their company data" ON vegetables
  FOR ALL USING (company_id = auth.jwt() ->> 'company_id');
```

## 3. パフォーマンス最適化

### 3.1 Next.js設定最適化

#### next.config.js 本番設定
```javascript
const nextConfig = {
  // 本番最適化
  compress: true,
  poweredByHeader: false,
  generateEtags: false,
  
  // 画像最適化
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  
  // バンドル最適化
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-*'],
    serverComponentsExternalPackages: ['@supabase/supabase-js'],
  },
  
  // セキュリティヘッダー
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload'
          }
        ]
      }
    ]
  }
}
```

### 3.2 データベース最適化
```sql
-- インデックス最適化
CREATE INDEX CONCURRENTLY idx_vegetables_company_status 
  ON vegetables(company_id, status);
CREATE INDEX CONCURRENTLY idx_photos_vegetable_created 
  ON photos(vegetable_id, created_at DESC);

-- 統計情報更新の自動化
SELECT cron.schedule('update-stats', '0 2 * * *', 'ANALYZE;');
```

## 4. 監視・ロギング設定

### 4.1 アプリケーション監視
```typescript
// lib/monitoring.ts
export const analytics = {
  track: (event: string, properties?: Record<string, any>) => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      // Google Analytics 4
      gtag('event', event, properties)
      
      // カスタム分析（Vercel Analytics）
      va.track(event, properties)
    }
  }
}

// パフォーマンス監視
export const reportWebVitals = (metric: NextWebVitalsMetric) => {
  switch (metric.name) {
    case 'CLS':
    case 'FID':
    case 'FCP':
    case 'LCP':
    case 'TTFB':
      analytics.track('web-vitals', {
        metric: metric.name,
        value: metric.value,
        rating: metric.rating
      })
      break
  }
}
```

## 5. セキュリティ強化

### 5.1 WAF設定（CloudFlare）
```javascript
// CloudFlare Workers - セキュリティルール
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Rate limiting
  const rateLimitKey = `rate_limit_${getClientIP(request)}`
  const count = await KV.get(rateLimitKey)
  
  if (count && parseInt(count) > 100) {
    return new Response('Rate limit exceeded', { status: 429 })
  }
  
  // SQL Injection防止
  if (request.method === 'POST') {
    const body = await request.text()
    if (containsSqlInjection(body)) {
      return new Response('Forbidden', { status: 403 })
    }
  }
  
  return fetch(request)
}
```

### 5.2 認証・認可強化
```typescript
// middleware.ts - 本番環境用認証
export async function middleware(request: NextRequest) {
  const token = request.cookies.get('supabase-auth-token')?.value
  
  // セキュリティヘッダー追加
  const response = NextResponse.next()
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  
  // 認証が必要なパスの保護
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    
    // トークン検証
    const { error } = await supabase.auth.getUser(token)
    if (error) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }
  
  return response
}
```

## 6. 災害対策・バックアップ

### 6.1 データバックアップ戦略
```sql
-- 自動バックアップ設定
SELECT cron.schedule(
  'daily-backup',
  '0 3 * * *',  -- 毎日3時実行
  $$
  SELECT pg_dump('postgresql://user:pass@host/db') 
  INTO 'backup_' || to_char(now(), 'YYYY_MM_DD') || '.sql'
  $$
);

-- Point-in-Time Recovery設定
ALTER DATABASE postgres SET wal_level = 'replica';
ALTER DATABASE postgres SET max_wal_senders = 3;
```

### 6.2 障害対応手順書
```markdown
## 緊急時対応フロー

### レベル1: サービス停止
1. ヘルスチェック確認: /api/health
2. Vercel ダッシュボード確認
3. Supabase ステータス確認
4. 緊急連絡先への通知

### レベル2: データベース障害
1. Supabase レプリカへの切り替え
2. バックアップからの復旧準備
3. データ整合性チェック

### レベル3: 重大セキュリティ事故
1. 即座にサービス停止
2. セキュリティチームへの連絡
3. ログ保全・フォレンジック準備
```