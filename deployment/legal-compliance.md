# 法的対応・コンプライアンス体制

## 1. 利用規約 (Terms of Service)

### 1.1 利用規約テンプレート

#### public/legal/terms-of-service.md
```markdown
# 野菜管理システム 利用規約

**最終更新日**: 2024年8月9日  
**発効日**: 2024年8月9日

## 第1条（適用）
1. 本利用規約（以下「本規約」）は、[会社名]（以下「当社」）が提供する「野菜管理システム」（以下「本サービス」）の利用条件を定めるものです。
2. ユーザーは、本サービスを利用することにより、本規約に同意したものとみなします。

## 第2条（利用登録）
1. 利用登録は、利用希望者が本規約に同意の上、所定の方法で申込みを行い、当社がこれを承認することによって完了するものとします。
2. 当社は、以下の場合には利用登録の申込みを承認しないことがあります：
   - 申込みに虚偽の事項を記載した場合
   - 過去に本規約違反により利用停止処分を受けた場合
   - その他、当社が利用登録を適当でないと判断した場合

## 第3条（禁止事項）
ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません：

1. **技術的禁止事項**
   - システムに負荷をかける行為
   - 不正アクセスや攻撃的行為
   - リバースエンジニアリング

2. **コンテンツ関連禁止事項**
   - 虚偽情報の登録・公開
   - 第三者の権利を侵害するコンテンツの投稿
   - 公序良俗に反するコンテンツの投稿

3. **営業活動関連禁止事項**
   - 無断での商用利用
   - 第三者への再販・転売
   - 競合サービスでの情報利用

## 第4条（個人情報・データの取り扱い）
1. 個人情報の取り扱いについては、別途定める「プライバシーポリシー」に従います。
2. ユーザーが本サービスに入力・投稿したデータ（野菜情報、写真等）については、ユーザーに帰属します。
3. 当社は、サービス提供に必要な範囲で、ユーザーデータを利用することができます。

## 第5条（知的財産権）
1. 本サービスに関する知的財産権は、当社に帰属します。
2. ユーザーは、本サービスの利用により、当社の知的財産権について通常使用権を取得します。

## 第6条（免責・損害賠償）
1. **システム障害**: 当社は、システム障害による損害について責任を負いません。
2. **データ損失**: ユーザーは、重要なデータについて適切なバックアップを行うものとします。
3. **間接損害**: 当社は、間接損害、逸失利益について責任を負いません。

## 第7条（サービスの変更・終了）
1. 当社は、事前通知により、本サービスの全部または一部を変更・終了することができます。
2. サービス終了の場合、当社は30日前までに通知を行います。

## 第8条（準拠法・管轄裁判所）
1. 本規約は、日本法に準拠します。
2. 本サービスに関する紛争については、東京地方裁判所を第一審の専属的合意管轄裁判所とします。

---

**お問い合わせ**  
〒100-0001 東京都千代田区千代田1-1  
[会社名]  
メール: legal@vegetable-system.com  
電話: 03-1234-5678
```

### 1.2 利用規約管理システム

#### lib/legal/terms-manager.ts
```typescript
// 利用規約管理システム
export interface TermsVersion {
  version: string
  effectiveDate: string
  content: string
  changes: string[]
  requiresReaccept: boolean
}

export interface UserAcceptance {
  userId: string
  termsVersion: string
  acceptedAt: string
  ipAddress: string
  userAgent: string
}

export class TermsOfServiceManager {
  private static readonly CURRENT_VERSION = '1.0'
  
  // 利用規約バージョン管理
  static async getCurrentTerms(): Promise<TermsVersion> {
    const { data } = await supabase
      .from('terms_versions')
      .select('*')
      .eq('is_current', true)
      .single()
    
    return data
  }

  // ユーザーの同意状況確認
  static async checkUserAcceptance(userId: string): Promise<{
    accepted: boolean
    requiresNewAccept: boolean
    currentVersion: string
    userVersion?: string
  }> {
    const [currentTerms, userAcceptance] = await Promise.all([
      this.getCurrentTerms(),
      this.getUserAcceptance(userId)
    ])

    if (!userAcceptance) {
      return {
        accepted: false,
        requiresNewAccept: true,
        currentVersion: currentTerms.version
      }
    }

    const requiresNewAccept = currentTerms.version !== userAcceptance.termsVersion ||
                              currentTerms.requiresReaccept

    return {
      accepted: !requiresNewAccept,
      requiresNewAccept,
      currentVersion: currentTerms.version,
      userVersion: userAcceptance.termsVersion
    }
  }

  // 利用規約同意記録
  static async recordAcceptance(
    userId: string, 
    termsVersion: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    const acceptance: UserAcceptance = {
      userId,
      termsVersion,
      acceptedAt: new Date().toISOString(),
      ipAddress,
      userAgent
    }

    await supabase
      .from('user_term_acceptances')
      .insert(acceptance)

    // 法的要件のため、不変ログとして記録
    await this.recordLegalAuditLog('terms_accepted', userId, {
      termsVersion,
      timestamp: acceptance.acceptedAt,
      ipAddress,
      userAgent: userAgent.substring(0, 255) // 長さ制限
    })
  }

  // 新バージョン公開
  static async publishNewTerms(
    content: string, 
    changes: string[],
    requiresReaccept: boolean = true
  ): Promise<string> {
    const newVersion = this.generateNewVersion()
    const effectiveDate = new Date()
    effectiveDate.setDate(effectiveDate.getDate() + 30) // 30日後発効

    // 現在のバージョンを無効化
    await supabase
      .from('terms_versions')
      .update({ is_current: false })
      .eq('is_current', true)

    // 新バージョン作成
    const { data } = await supabase
      .from('terms_versions')
      .insert({
        version: newVersion,
        content,
        changes,
        requires_reaccept: requiresReaccept,
        effective_date: effectiveDate.toISOString(),
        is_current: true,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    // ユーザー通知のスケジューリング
    if (requiresReaccept) {
      await this.scheduleUserNotifications(newVersion, effectiveDate)
    }

    return newVersion
  }

  // 法的監査ログ記録
  private static async recordLegalAuditLog(
    action: string, 
    userId: string, 
    details: any
  ): Promise<void> {
    await supabase
      .from('legal_audit_logs')
      .insert({
        action,
        user_id: userId,
        details,
        timestamp: new Date().toISOString(),
        ip_address: details.ipAddress,
        user_agent: details.userAgent
      })
  }

  private static async getUserAcceptance(userId: string): Promise<UserAcceptance | null> {
    const { data } = await supabase
      .from('user_term_acceptances')
      .select('*')
      .eq('user_id', userId)
      .order('accepted_at', { ascending: false })
      .limit(1)
      .single()

    return data
  }

  private static generateNewVersion(): string {
    const current = this.CURRENT_VERSION
    const parts = current.split('.')
    const minor = parseInt(parts[1]) + 1
    return `${parts[0]}.${minor}`
  }

  private static async scheduleUserNotifications(
    version: string, 
    effectiveDate: Date
  ): Promise<void> {
    // 通知スケジュール: 30日前、7日前、1日前
    const notifications = [
      { days: 30, type: 'announcement' },
      { days: 7, type: 'reminder' },
      { days: 1, type: 'final_notice' }
    ]

    for (const notification of notifications) {
      const sendDate = new Date(effectiveDate)
      sendDate.setDate(sendDate.getDate() - notification.days)

      await supabase
        .from('scheduled_notifications')
        .insert({
          type: 'terms_update',
          subtype: notification.type,
          scheduled_for: sendDate.toISOString(),
          metadata: { termsVersion: version, effectiveDate: effectiveDate.toISOString() }
        })
    }
  }
}
```

## 2. プライバシーポリシー

### 2.1 プライバシーポリシー文書

#### public/legal/privacy-policy.md
```markdown
# プライバシーポリシー

**最終更新日**: 2024年8月9日  
**発効日**: 2024年8月9日

## 1. 基本方針
[会社名]（以下「当社」）は、野菜管理システム（以下「本サービス」）において、ユーザーの個人情報の適切な保護を重要な責務と考え、以下の方針に基づいて個人情報を取り扱います。

## 2. 取得する個人情報

### 2.1 直接取得する情報
| 情報カテゴリ | 具体的内容 | 取得目的 |
|-------------|-----------|----------|
| **基本情報** | 氏名、メールアドレス、電話番号 | アカウント管理、本人確認 |
| **企業情報** | 会社名、住所、業種 | サービス提供、請求処理 |
| **農業情報** | 作物データ、栽培記録、写真 | サービス機能提供 |

### 2.2 自動取得する情報
| 情報カテゴリ | 具体的内容 | 取得目的 |
|-------------|-----------|----------|
| **技術情報** | IPアドレス、Cookie、デバイス情報 | セキュリティ、サービス改善 |
| **利用情報** | アクセスログ、操作履歴 | サービス最適化、不正検知 |
| **位置情報** | GPS座標（任意） | 圃場管理、天候情報連携 |

## 3. 利用目的

### 3.1 主要な利用目的
1. **サービス提供**: 野菜管理機能の提供
2. **顧客管理**: アカウント管理、請求処理
3. **品質向上**: サービス改善、新機能開発
4. **安全管理**: セキュリティ維持、不正アクセス防止

### 3.2 マーケティング利用
- メール配信による情報提供（オプトイン）
- サービス利用統計の作成（匿名化）
- 市場調査・アンケートの実施（同意ベース）

## 4. 第三者提供

### 4.1 同意に基づく提供
以下の場合に限り、ユーザーの同意を得て第三者に情報を提供することがあります：

| 提供先カテゴリ | 提供する情報 | 提供目的 |
|---------------|-------------|----------|
| **連携サービス** | 必要最小限の情報 | 外部サービス連携 |
| **研究機関** | 匿名化データ | 農業技術研究 |
| **認定パートナー** | 企業情報 | 専門サービス紹介 |

### 4.2 法的義務による提供
- 法令に基づく開示請求
- 裁判所の命令
- 行政機関からの要請

## 5. データの国際移転
本サービスでは、以下の国・地域でデータ処理を行う場合があります：

### 5.1 移転先と保護措置
| 国・地域 | サービス | 保護措置 |
|---------|----------|----------|
| **米国** | クラウドインフラ | 標準契約条項、認定プロバイダー |
| **EU** | CDN・分析 | GDPR準拠、適切性決定 |

### 5.2 移転の法的根拠
- 十分性認定のある国・地域への移転
- 標準契約条項（SCC）に基づく移転
- ユーザーの明示的同意に基づく移転

## 6. データ保持期間

| データタイプ | 保持期間 | 保持理由 |
|-------------|----------|----------|
| **アカウント情報** | 利用終了から3年 | 法的義務、紛争対応 |
| **農業データ** | 利用終了から1年 | データ移行、バックアップ |
| **ログデータ** | 90日 | セキュリティ、運用監視 |
| **請求・決済情報** | 7年 | 法的義務（税法等） |

## 7. ユーザーの権利

### 7.1 GDPR対応権利（EU居住者）
| 権利 | 内容 | 行使方法 |
|------|------|----------|
| **アクセス権** | 個人データの開示請求 | オンライン申請 |
| **訂正権** | 個人データの修正請求 | ダッシュボードまたは申請 |
| **削除権** | 個人データの消去請求 | オンライン申請 |
| **制限権** | 処理の制限請求 | オンライン申請 |
| **ポータビリティ権** | データの移転請求 | データエクスポート機能 |
| **異議権** | 処理への異議申立て | オンライン申請 |

### 7.2 個人情報保護法対応権利（日本居住者）
- 個人情報の開示請求
- 個人情報の訂正・追加・削除請求
- 個人情報の利用停止・消去請求
- 第三者提供の停止請求

## 8. セキュリティ対策

### 8.1 技術的対策
- **暗号化**: データ転送時・保存時の暗号化
- **アクセス制御**: 最小権限の原則、多要素認証
- **監視**: 24時間体制のセキュリティ監視
- **バックアップ**: 定期的なデータバックアップ

### 8.2 組織的対策
- **従業員教育**: 定期的なプライバシー研修
- **アクセス管理**: 従業員の権限管理・定期見直し
- **インシデント対応**: セキュリティ事故対応体制
- **監査**: 第三者によるセキュリティ監査

## 9. データ侵害時の対応
個人データの侵害が発生した場合：

### 9.1 内部対応（72時間以内）
1. 侵害の検知・評価
2. 影響範囲の特定
3. 封じ込め・修復措置
4. 監督当局への報告

### 9.2 ユーザー通知（遅滞なく）
- 侵害の概要
- 影響を受けるデータの種類
- 予想される影響
- 対策・推奨措置

## 10. 問い合わせ・苦情処理

### 10.1 窓口情報
**個人情報保護責任者**  
〒100-0001 東京都千代田区千代田1-1  
[会社名] プライバシーオフィス  
メール: privacy@vegetable-system.com  
電話: 03-1234-5678（平日9:00-18:00）

### 10.2 外部相談窓口
- **個人情報保護委員会** (https://www.ppc.go.jp/)
- **国民生活センター** (https://www.kokusen.go.jp/)
- **EU: 各国監督当局** (https://edpb.europa.eu/)

---

## 改定履歴
| バージョン | 更新日 | 主な変更内容 |
|-----------|--------|-------------|
| 1.0 | 2024-08-09 | 初版公開 |

**最終確認日**: 2024年8月9日
```

### 2.2 プライバシー設定管理

#### lib/privacy/privacy-manager.ts
```typescript
// プライバシー設定管理システム
export interface PrivacyConsent {
  userId: string
  consentType: 'marketing' | 'analytics' | 'personalization' | 'third_party'
  granted: boolean
  timestamp: string
  ipAddress: string
  source: 'registration' | 'settings' | 'popup'
}

export interface DataSubjectRequest {
  id: string
  userId: string
  requestType: 'access' | 'rectification' | 'erasure' | 'portability' | 'restriction' | 'objection'
  status: 'pending' | 'in_progress' | 'completed' | 'rejected'
  requestDate: string
  completionDate?: string
  details: string
  responseData?: any
}

export class PrivacyManager {
  // 同意管理
  static async recordConsent(consent: Omit<PrivacyConsent, 'timestamp'>): Promise<void> {
    const consentRecord: PrivacyConsent = {
      ...consent,
      timestamp: new Date().toISOString()
    }

    await supabase
      .from('privacy_consents')
      .upsert(consentRecord, { onConflict: 'user_id,consent_type' })

    // 法的監査ログ
    await this.recordPrivacyAuditLog('consent_recorded', consent.userId, consentRecord)
  }

  // ユーザーの同意状況取得
  static async getUserConsents(userId: string): Promise<Record<string, boolean>> {
    const { data } = await supabase
      .from('privacy_consents')
      .select('consent_type, granted')
      .eq('user_id', userId)

    const consents: Record<string, boolean> = {}
    data?.forEach(item => {
      consents[item.consent_type] = item.granted
    })

    return consents
  }

  // データ主体の権利行使要請処理
  static async submitDataSubjectRequest(
    userId: string,
    requestType: DataSubjectRequest['requestType'],
    details: string
  ): Promise<string> {
    const requestId = `dsr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const request: Omit<DataSubjectRequest, 'id'> = {
      id: requestId,
      userId,
      requestType,
      status: 'pending',
      requestDate: new Date().toISOString(),
      details
    }

    await supabase
      .from('data_subject_requests')
      .insert(request)

    // 自動処理可能な要請の場合は即座に処理
    if (['access', 'portability'].includes(requestType)) {
      await this.processAutomaticRequest(requestId)
    }

    // 担当者に通知
    await this.notifyPrivacyOfficer(request)

    return requestId
  }

  // データアクセス要請の自動処理
  private static async processAutomaticRequest(requestId: string): Promise<void> {
    const { data: request } = await supabase
      .from('data_subject_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (!request) return

    try {
      let responseData: any

      switch (request.request_type) {
        case 'access':
          responseData = await this.generateUserDataReport(request.user_id)
          break
        case 'portability':
          responseData = await this.generatePortableDataExport(request.user_id)
          break
        default:
          return
      }

      await supabase
        .from('data_subject_requests')
        .update({
          status: 'completed',
          completion_date: new Date().toISOString(),
          response_data: responseData
        })
        .eq('id', requestId)

      // ユーザーに完了通知
      await this.notifyRequestCompletion(request.user_id, requestId, request.request_type)

    } catch (error) {
      await supabase
        .from('data_subject_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId)
    }
  }

  // ユーザーデータレポート生成
  private static async generateUserDataReport(userId: string): Promise<any> {
    const [userData, vegetableData, photoData, consentData] = await Promise.all([
      supabase.from('users').select('*').eq('id', userId).single(),
      supabase.from('vegetables').select('*').eq('created_by', userId),
      supabase.from('photos').select('*').eq('created_by', userId),
      supabase.from('privacy_consents').select('*').eq('user_id', userId)
    ])

    return {
      personal_information: userData.data,
      vegetable_records: vegetableData.data,
      photo_records: photoData.data?.map(photo => ({
        ...photo,
        storage_path: '[REDACTED]' // 実際のパスは含めない
      })),
      privacy_consents: consentData.data,
      export_date: new Date().toISOString(),
      retention_periods: {
        account_data: '3 years after service termination',
        vegetable_data: '1 year after service termination',
        log_data: '90 days'
      }
    }
  }

  // ポータブルデータエクスポート生成
  private static async generatePortableDataExport(userId: string): Promise<any> {
    // 構造化されたJSONフォーマットでデータを提供
    const data = await this.generateUserDataReport(userId)
    
    return {
      format: 'JSON',
      encoding: 'UTF-8',
      data,
      metadata: {
        export_type: 'data_portability',
        user_id: userId,
        export_date: new Date().toISOString(),
        data_controller: 'vegetable-system.com'
      }
    }
  }

  // Cookie同意バナー設定
  static getCookieConsentConfig() {
    return {
      necessary: {
        name: '必須Cookie',
        description: 'サービスの基本機能に必要なCookie',
        cookies: ['session_token', 'csrf_token', 'auth_state'],
        required: true
      },
      functional: {
        name: '機能性Cookie', 
        description: 'ユーザー設定の保存などに使用',
        cookies: ['user_preferences', 'ui_settings'],
        required: false
      },
      analytics: {
        name: '分析Cookie',
        description: 'サービス改善のためのアクセス解析',
        cookies: ['_ga', '_gat', 'analytics_session'],
        required: false
      },
      marketing: {
        name: 'マーケティングCookie',
        description: '関連性の高い広告配信のため',
        cookies: ['ad_targeting', 'campaign_tracking'],
        required: false
      }
    }
  }

  // プライバシー監査ログ
  private static async recordPrivacyAuditLog(
    action: string,
    userId: string,
    details: any
  ): Promise<void> {
    await supabase
      .from('privacy_audit_logs')
      .insert({
        action,
        user_id: userId,
        details,
        timestamp: new Date().toISOString(),
        ip_address: details.ipAddress || 'system'
      })
  }

  // プライバシー担当者への通知
  private static async notifyPrivacyOfficer(request: Omit<DataSubjectRequest, 'id'>): Promise<void> {
    const message = `
新しいデータ主体権利要請が受信されました:

- 要請ID: ${request.id}
- ユーザーID: ${request.userId}
- 要請タイプ: ${request.requestType}
- 詳細: ${request.details}
- 受信日時: ${request.requestDate}

要請は30日以内に処理する必要があります。
    `

    await fetch(process.env.SLACK_PRIVACY_WEBHOOK!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: message,
        channel: '#privacy-team'
      })
    })
  }

  // 要請完了通知
  private static async notifyRequestCompletion(
    userId: string,
    requestId: string,
    requestType: string
  ): Promise<void> {
    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single()

    if (!user?.email) return

    // メール送信（SendGrid等）
    await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: user.email }],
          subject: 'データ権利行使要請の処理完了'
        }],
        from: { email: 'privacy@vegetable-system.com' },
        content: [{
          type: 'text/html',
          value: `
            <p>お客様のデータ権利行使要請（${requestType}）が完了しました。</p>
            <p>要請ID: ${requestId}</p>
            <p>結果はログイン後、設定画面からご確認いただけます。</p>
          `
        }]
      })
    })
  }
}
```

## 3. GDPR・個人情報保護法対応

### 3.1 法的要件チェックリスト

#### compliance/gdpr-checklist.md
```markdown
# GDPR・個人情報保護法 コンプライアンスチェックリスト

## ✅ GDPR対応 (EU General Data Protection Regulation)

### Article 6 - 処理の適法性
- [ ] 同意（明確・具体的・自由意志）
- [x] 契約履行のため
- [x] 法的義務の遵守
- [x] 正当利益（バランステスト実施済み）

### Article 7 - 同意の条件
- [x] 同意撤回の権利を明示
- [x] 同意取得時の証明可能性
- [x] 子どもの同意（16歳未満は保護者同意）
- [x] 同意バンドル化の禁止

### Article 12-22 - データ主体の権利
| 権利 | 実装状況 | 実装方法 |
|------|----------|----------|
| **透明性・情報提供** | ✅完了 | プライバシーポリシー |
| **アクセス権** | ✅完了 | データエクスポート機能 |
| **訂正権** | ✅完了 | ダッシュボード編集機能 |
| **削除権** | ✅完了 | アカウント削除機能 |
| **処理制限権** | ⚠️部分対応 | 手動処理 |
| **ポータビリティ権** | ✅完了 | JSON/CSV出力 |
| **異議権** | ⚠️部分対応 | 問い合わせフォーム |

### Article 25 - プライバシー・バイ・デザイン
- [x] データ最小化の原則
- [x] デフォルトでのプライバシー保護
- [x] データ保護影響評価（DPIA）実施

### Article 28 - プロセッサー（処理業者）
| 業者 | サービス | DPA締結 | GDPR準拠 |
|------|----------|---------|----------|
| Supabase | データベース | ✅ | ✅ |
| Vercel | ホスティング | ✅ | ✅ |
| CloudFlare | CDN・DNS | ✅ | ✅ |
| OpenAI | AI API | ✅ | ✅ |

### Article 33-34 - 侵害通知
- [x] 内部検知手順（72時間以内）
- [x] 当局通知手順
- [x] 個人への通知手順（高リスク時）
- [x] 侵害記録管理

### Article 35 - データ保護影響評価
- [x] DPIA実施基準の策定
- [x] 高リスク処理の特定
- [x] 評価手順書の作成
- [x] 定期見直し手順

## ✅ 日本の個人情報保護法対応

### 取得・利用段階
- [x] 利用目的の明示・通知
- [x] 適正取得（偽り等の禁止）
- [x] 機微情報の取り扱い制限
- [x] 本人同意の適切な取得

### 保管・管理段階  
- [x] 安全管理措置（技術的）
- [x] 安全管理措置（組織的）
- [x] 従業者への監督
- [x] 委託先への監督

### 第三者提供段階
- [x] 本人同意の原則
- [x] オプトアウト手続き
- [x] 委託・共同利用の整理
- [x] 外国移転の同意・情報提供

### 個人の権利対応
| 権利 | 法的根拠 | 実装状況 |
|------|----------|----------|
| **開示請求** | 法28条 | ✅完了 |
| **訂正・追加・削除** | 法29条 | ✅完了 |
| **利用停止・消去** | 法30条 | ✅完了 |
| **第三者提供停止** | 法31条 | ✅完了 |

### 組織的対応
- [x] 個人情報保護方針の策定・公表
- [x] 苦情処理体制の整備
- [x] 個人情報保護委員会への報告体制
- [x] 定期的な見直し・改善

## 🎯 継続的改善計画

### 短期（3ヶ月以内）
1. **処理制限権の完全実装**
   - 自動処理停止機能
   - 制限状態の管理

2. **異議権対応の強化**
   - 異議申立てフォーム
   - 処理根拠の再評価

### 中期（6ヶ月以内）
1. **同意管理プラットフォーム導入**
   - 細分化された同意設定
   - 同意履歴の詳細管理

2. **自動化・効率化**
   - DSR処理の自動化拡張
   - コンプライアンス監査の自動化

### 長期（1年以内）
1. **国際展開対応**
   - 各国法制度への対応
   - 多言語プライバシーポリシー

2. **新技術・新法制への対応**
   - AI活用時のプライバシー配慮
   - 新しい規制への適応
```

これで法的対応・利用規約・プライバシーポリシーの設計が完了しました。次に負荷テスト・セキュリティテストに進みます。