# セキュリティ強化チェックリスト

## 1. アプリケーションレベルセキュリティ

### 1.1 認証・認可の強化
```typescript
// lib/auth-security.ts
export class AuthSecurity {
  // パスワード強度チェック
  static validatePassword(password: string): boolean {
    const minLength = 12
    const hasUpperCase = /[A-Z]/.test(password)
    const hasLowerCase = /[a-z]/.test(password)
    const hasNumbers = /\d/.test(password)
    const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(password)
    
    return password.length >= minLength && 
           hasUpperCase && 
           hasLowerCase && 
           hasNumbers && 
           hasSpecialChars
  }

  // 2FA実装
  static async enableTwoFactor(userId: string): Promise<string> {
    const secret = authenticator.generateSecret()
    
    await supabase
      .from('user_security')
      .upsert({
        user_id: userId,
        totp_secret: secret,
        two_factor_enabled: true
      })
    
    return secret
  }

  // セッション管理強化
  static async validateSession(token: string): Promise<boolean> {
    const { data, error } = await supabase.auth.getUser(token)
    
    if (error || !data.user) return false
    
    // セッションタイムアウトチェック
    const lastActivity = await redis.get(`session:${data.user.id}`)
    const now = Date.now()
    const maxInactivity = 30 * 60 * 1000 // 30分
    
    if (now - parseInt(lastActivity) > maxInactivity) {
      await supabase.auth.signOut()
      return false
    }
    
    // アクティビティ更新
    await redis.set(`session:${data.user.id}`, now.toString())
    return true
  }
}
```

### 1.2 入力値検証・サニタイズ
```typescript
// lib/validation.ts
import { z } from 'zod'
import DOMPurify from 'isomorphic-dompurify'

// 厳格なバリデーション
export const VegetableSchema = z.object({
  name: z.string()
    .min(1, '名前は必須です')
    .max(100, '名前は100文字以下である必要があります')
    .regex(/^[a-zA-Z0-9\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+$/, '無効な文字が含まれています'),
  
  variety_name: z.string()
    .min(1, '品種名は必須です')
    .max(50, '品種名は50文字以下である必要があります'),
  
  plot_size: z.number()
    .positive('面積は正の数である必要があります')
    .max(10000, '面積は10000㎡以下である必要があります'),
  
  planting_date: z.string()
    .datetime('有効な日時形式である必要があります'),
  
  notes: z.string()
    .max(1000, '備考は1000文字以下である必要があります')
    .optional()
    .transform(val => val ? DOMPurify.sanitize(val) : val)
})

// SQLインジェクション防止
export function sanitizeQuery(query: string): string {
  return query
    .replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, (char) => {
      switch (char) {
        case "\0": return "\\0"
        case "\x08": return "\\b"
        case "\x09": return "\\t"
        case "\x1a": return "\\z"
        case "\n": return "\\n"
        case "\r": return "\\r"
        case "\"":
        case "'":
        case "\\":
        case "%": return "\\" + char
        default: return char
      }
    })
}
```

### 1.3 ファイルアップロードセキュリティ
```typescript
// lib/upload-security.ts
export class FileUploadSecurity {
  private static readonly ALLOWED_TYPES = [
    'image/jpeg',
    'image/png', 
    'image/webp',
    'image/gif'
  ]
  
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
  private static readonly VIRUS_SCAN_API = process.env.VIRUS_SCAN_API_URL

  static async validateFile(file: File): Promise<{valid: boolean, error?: string}> {
    // ファイルタイプ検証
    if (!this.ALLOWED_TYPES.includes(file.type)) {
      return { valid: false, error: '許可されていないファイル形式です' }
    }

    // ファイルサイズ検証
    if (file.size > this.MAX_FILE_SIZE) {
      return { valid: false, error: 'ファイルサイズが上限を超えています' }
    }

    // ファイル内容の検証（マジックナンバーチェック）
    const buffer = await file.arrayBuffer()
    const signature = new Uint8Array(buffer.slice(0, 4))
    
    if (!this.isValidImageSignature(signature)) {
      return { valid: false, error: 'ファイルの内容が不正です' }
    }

    // ウイルススキャン
    if (this.VIRUS_SCAN_API) {
      const isSafe = await this.scanForVirus(buffer)
      if (!isSafe) {
        return { valid: false, error: 'セキュリティ上の脅威が検出されました' }
      }
    }

    return { valid: true }
  }

  private static isValidImageSignature(signature: Uint8Array): boolean {
    const signatures = {
      jpeg: [0xFF, 0xD8, 0xFF],
      png: [0x89, 0x50, 0x4E, 0x47],
      webp: [0x52, 0x49, 0x46, 0x46],
      gif: [0x47, 0x49, 0x46]
    }

    return Object.values(signatures).some(sig => 
      sig.every((byte, index) => signature[index] === byte)
    )
  }

  private static async scanForVirus(buffer: ArrayBuffer): Promise<boolean> {
    try {
      const response = await fetch(this.VIRUS_SCAN_API!, {
        method: 'POST',
        body: buffer,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Authorization': `Bearer ${process.env.VIRUS_SCAN_API_KEY}`
        }
      })
      
      const result = await response.json()
      return result.clean === true
    } catch (error) {
      // スキャンに失敗した場合は安全側に倒してブロック
      console.error('Virus scan failed:', error)
      return false
    }
  }
}
```

## 2. インフラセキュリティ

### 2.1 WAF設定（CloudFlare）
```javascript
// CloudFlare Workers - 高度なセキュリティルール
const SECURITY_RULES = {
  // Rate Limiting（IP別）
  RATE_LIMIT_PER_IP: 100, // リクエスト/分
  RATE_LIMIT_WINDOW: 60 * 1000, // 1分
  
  // API別制限
  API_RATE_LIMITS: {
    '/api/auth/signup': 5, // 5回/時間
    '/api/vegetables': 60,  // 60回/分
    '/api/photos': 20       // 20回/分
  },
  
  // 地理的制限（必要に応じて）
  ALLOWED_COUNTRIES: ['JP', 'US'], // 日本・米国のみ許可
  
  // 脅威パターン
  THREAT_PATTERNS: [
    /union[\s\S]*select/i,     // SQLインジェクション
    /<script[^>]*>/i,          // XSS攻撃
    /\.\.\/|\.\.\\\/i,         // Directory Traversal
    /eval\s*\(/i,             // Code Injection
    /base64_decode|exec|system/i // Command Injection
  ]
}

addEventListener('fetch', event => {
  event.respondWith(handleSecureRequest(event.request))
})

async function handleSecureRequest(request) {
  const clientIP = request.headers.get('CF-Connecting-IP')
  const userAgent = request.headers.get('User-Agent')
  const url = new URL(request.url)
  
  // ボット検出
  if (isSuspiciousBot(userAgent)) {
    return new Response('Forbidden', { status: 403 })
  }
  
  // 地理的制限
  const country = request.cf.country
  if (!SECURITY_RULES.ALLOWED_COUNTRIES.includes(country)) {
    return new Response('Access denied from your location', { status: 403 })
  }
  
  // Rate Limiting
  const rateLimitKey = `rate_${clientIP}_${url.pathname}`
  const currentCount = await KV.get(rateLimitKey)
  
  if (currentCount && parseInt(currentCount) > getRateLimit(url.pathname)) {
    return new Response('Rate limit exceeded', { 
      status: 429,
      headers: {
        'Retry-After': '60'
      }
    })
  }
  
  // パターンマッチング脅威検出
  if (request.method === 'POST') {
    const body = await request.clone().text()
    for (const pattern of SECURITY_RULES.THREAT_PATTERNS) {
      if (pattern.test(body)) {
        await logSecurityEvent('threat_detected', {
          ip: clientIP,
          pattern: pattern.toString(),
          body: body.substring(0, 100)
        })
        return new Response('Security violation detected', { status: 403 })
      }
    }
  }
  
  // レート制限カウンター更新
  await KV.put(rateLimitKey, (parseInt(currentCount) || 0) + 1, {
    expirationTtl: SECURITY_RULES.RATE_LIMIT_WINDOW / 1000
  })
  
  return fetch(request)
}
```

### 2.2 SSL/TLS設定
```yaml
# ssl-config.yml - 最新のセキュリティ基準
ssl_protocols:
  - TLSv1.3
  - TLSv1.2

cipher_suites:
  - TLS_AES_256_GCM_SHA384
  - TLS_CHACHA20_POLY1305_SHA256
  - TLS_AES_128_GCM_SHA256

security_headers:
  strict_transport_security:
    max_age: 63072000
    include_subdomains: true
    preload: true
  
  content_security_policy:
    default_src: "'self'"
    script_src: "'self' 'unsafe-inline'"
    style_src: "'self' 'unsafe-inline'"
    img_src: "'self' data: https:"
    connect_src: "'self' https://api.supabase.co"
    
  x_frame_options: "DENY"
  x_content_type_options: "nosniff"
  referrer_policy: "strict-origin-when-cross-origin"
```

## 3. データ保護・プライバシー

### 3.1 個人情報暗号化
```typescript
// lib/encryption.ts
import crypto from 'crypto'

export class DataEncryption {
  private static readonly ALGORITHM = 'aes-256-gcm'
  private static readonly KEY = process.env.ENCRYPTION_KEY!
  
  static encrypt(data: string): string {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipher(this.ALGORITHM, this.KEY)
    cipher.setAAD(Buffer.from('additional-data'))
    
    let encrypted = cipher.update(data, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const authTag = cipher.getAuthTag()
    
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
  }
  
  static decrypt(encryptedData: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':')
    
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    const decipher = crypto.createDecipher(this.ALGORITHM, this.KEY)
    
    decipher.setAAD(Buffer.from('additional-data'))
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  }
}

// 個人情報フィールドの自動暗号化
export const encryptSensitiveFields = (data: any): any => {
  const sensitiveFields = ['email', 'phone', 'address', 'full_name']
  const encrypted = { ...data }
  
  for (const field of sensitiveFields) {
    if (encrypted[field]) {
      encrypted[field] = DataEncryption.encrypt(encrypted[field])
    }
  }
  
  return encrypted
}
```

### 3.2 GDPR・個人情報保護法対応
```typescript
// lib/privacy-compliance.ts
export class PrivacyCompliance {
  // データの仮名化
  static anonymizeUserData(userData: any): any {
    return {
      ...userData,
      email: this.hashField(userData.email),
      phone: this.maskField(userData.phone),
      full_name: this.pseudonymize(userData.full_name),
      created_at: userData.created_at,
      // 統計用データのみ保持
      age_group: this.getAgeGroup(userData.birth_date),
      prefecture: userData.prefecture
    }
  }
  
  // データ削除権（忘れられる権利）
  static async deleteUserData(userId: string): Promise<void> {
    const tables = [
      'users', 'vegetables', 'photos', 'operation_logs', 
      'gantt_tasks', 'notifications'
    ]
    
    for (const table of tables) {
      await supabase
        .from(table)
        .delete()
        .eq('created_by', userId)
    }
    
    // 削除ログの記録
    await supabase
      .from('data_deletion_log')
      .insert({
        user_id: userId,
        deleted_at: new Date().toISOString(),
        deletion_reason: 'user_request'
      })
  }
  
  // データポータビリティ（データエクスポート）
  static async exportUserData(userId: string): Promise<any> {
    const userData = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    
    const vegetables = await supabase
      .from('vegetables')
      .select('*')
      .eq('created_by', userId)
    
    const photos = await supabase
      .from('photos')
      .select('*')
      .eq('created_by', userId)
    
    return {
      user_profile: userData.data,
      vegetables: vegetables.data,
      photos: photos.data,
      export_date: new Date().toISOString(),
      format_version: '1.0'
    }
  }
}
```

## 4. セキュリティ監視・ログ

### 4.1 セキュリティイベント監視
```typescript
// lib/security-monitoring.ts
export class SecurityMonitoring {
  static async logSecurityEvent(
    eventType: string, 
    details: any, 
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<void> {
    const event = {
      timestamp: new Date().toISOString(),
      event_type: eventType,
      severity,
      details,
      source_ip: details.ip,
      user_agent: details.userAgent
    }
    
    // データベースログ
    await supabase
      .from('security_events')
      .insert(event)
    
    // 外部SIEM連携
    if (severity === 'critical') {
      await this.sendToSIEM(event)
    }
    
    // アラート送信
    if (severity === 'high' || severity === 'critical') {
      await this.sendSecurityAlert(event)
    }
  }
  
  private static async sendSecurityAlert(event: any): Promise<void> {
    // Slack通知
    await fetch(process.env.SLACK_SECURITY_WEBHOOK!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🚨 Security Alert: ${event.event_type}`,
        attachments: [{
          color: event.severity === 'critical' ? 'danger' : 'warning',
          fields: [
            { title: 'Severity', value: event.severity, short: true },
            { title: 'Source IP', value: event.source_ip, short: true },
            { title: 'Details', value: JSON.stringify(event.details, null, 2) }
          ]
        }]
      })
    })
  }
}
```