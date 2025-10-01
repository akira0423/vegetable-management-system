Q&A プラットフォーム API 仕様書

【更新履歴】
- 2025-09-28: 回答本文分離対応（qa_answer_contents）
- 2025-09-28: 検索API拡張（高度なクエリ解析）
- 2025-09-23: 初版作成

【実装状況】
✅ 質問CRUD: 実装完了
✅ 回答CRUD: 実装完了（本文分離対応済み）
✅ 検索機能: 実装完了（完全一致/除外/タグ）
🔄 PPV機能: 未実装
🔄 ウォレット: 未実装

1. API 概要
   ベース URL

開発環境: http://localhost:3000/api/questions
本番環境: https://your-domain.com/api/questions

注意: 2025-09-29より、全APIエンドポイントは /api/questions/* に統一されました

認証方式

Bearer Token (Supabase JWT)
ヘッダー: Authorization: Bearer {token}

共通必須ヘッダー（決済系は冪等必須）【修正】

X-Request-Id: {UUID} // 全 API 推奨（ログ相関）

X-Client-Version: 1.0.0

Idempotency-Key: {UUID} // 決済/ベスト確定/全文開封/PPV 等の「課金・状態確定」系は必須

レスポンス形式

Content-Type: application/json

文字コード: UTF-8

共通エラーレスポンス
{
"error": {
"code": "ERROR_CODE",
"message": "エラーメッセージ",
"details": {}
}
}

2. 認証・ユーザー管理
   2.1 ユーザープロフィール取得

GET /qa/profile

レスポンス例:

{
"id": "uuid",
"email": "user@example.com",
"displayName": "田中太郎",
"bio": "有機栽培専門農家",
"expertiseAreas": ["有機栽培", "病害虫対策"],
"reputation": {
"score": 450,
"tier": "GOLD",
"totalQuestions": 23,
"totalAnswers": 156,
"bestAnswers": 89,
"bestRate": 57.05
},
"wallet": {
"balanceAvailable": 45230,
"balancePending": 2500
},
"stripeAccountStatus": "active"
}

注: 開発環境では qa_user_profiles テーブルとの JOINは使用せず、
qa_questions テーブルの asker_display_name カラムを直接使用

2.2 プロフィール更新

PATCH /qa/profile

リクエスト:

{
"displayName": "田中太郎",
"bio": "有機栽培専門農家、20 年の経験",
"expertiseAreas": ["有機栽培", "病害虫対策", "土壌改良"],
"taxInfo": {
"isTaxable": true,
"invoiceRegistrationNo": "T1234567890123"
}
}

3. 質問管理
   与信/公開ポリシー【修正】

質問投稿は DRAFT 作成 → エスクロー与信 の 2 段階。

与信成功（PaymentIntent capture_method='manual'） で status='ANSWERING' へ遷移。

キャプチャ（本課金） は以下のみ：

ベスト選定時（パターン A）

質問者が全文開封した瞬間（パターン C）

与信期限ガードで自動キャプチャ（回答 ≥1 かつ 与信切れ間近）（パターン E）

回答 0 件で締切 → 自動キャンセル・課金なし（パターン B）。

3.1 質問下書き作成【修正】

POST /qa/questions
認証: 必須（Bearer Token）

リクエスト:

{
"title": "トマトのうどんこ病、有機栽培での緊急対策",
"body": "有機 JAS 認証農園でトマト 200 株中 30 株に発生...",
"crop": "トマト",
"disease": "うどんこ病",
"region": "千葉県",
"tags": ["有機栽培", "緊急", "病害対策"],
"bountyAmount": 500,
"deadlineHours": 24,
"requirements": {
  "minAnswerChars": 200,  // 最小文字数（0なら無指定）
  "requirePhoto": true,    // 写真必須
  "requirePhotoMin": 1,    // 写真枚数（省略時 1）
  "requireVideo": false,   // 動画必須
  "requireVideoMin": 0     // 動画本数
},
"attachments": [
{ "type": "image", "url": "https://storage.example.com/image1.jpg" }
]
}

レスポンス（下書き）:

{
"questionId": "q_uuid",
"status": "DRAFT"
}

3.2 質問のエスクロー与信（公開開始）【新規/置換】

POST /qa/payments/escrow

説明: questionId に対し manual capture の PaymentIntent を作成。clientSecret を返し、フロントで確認完了後 Webhook にて ANSWERING へ。

リクエスト:

{
"questionId": "q_uuid",
"amount": 500,
"paymentMethodId": "pm_xxx"
}

レスポンス:

{
"paymentIntentId": "pi_xxx",
"clientSecret": "pi_xxx_secret_xxx",
"status": "requires_confirmation"
}

Webhook 反映（成功時）【修正】

payment_intent.succeeded（与信成功） → qa_questions.status='ANSWERING', stripe_payment_intent_id 保存。

3.3 質問詳細取得

GET /qa/questions/{id}

レスポンス（アクセス権あり＝ ASKER/RESPONDER/PPV/ADMIN）:

{
"id": "q_uuid",
"title": "トマトのうどんこ病、有機栽培での緊急対策",
"body": "詳細な質問内容...(未認証でも全文返却）",
"requirements": {
  "minAnswerChars": 200,
  "requirePhoto": true,
  "requirePhotoMin": 1,
  "requireVideo": false,
  "requireVideoMin": 0,
  "lockedAt": "2025-09-22T10:33:00Z"  // 要件ロック日時
},
"asker": { "id": "u_uuid", "displayName": "田中太郎", "reputation": 450 },
"bountyAmount": 500,
"status": "ANSWERING",
"deadline": "2025-09-23T18:00:00Z",
"createdAt": "2025-09-22T09:00:00Z",
"stats": { "answerCount": 3, "viewCount": 45, "ppvCount": 23 },
"answers": [
{
"id": "a_uuid",
"body": "回答内容...",
"responder": { "id": "u_uuid", "displayName": "鈴木農園", "reputation": 680 },
"isBest": false,
"createdAt": "2025-09-22T10:30:00Z"
}
],
"hasAccess": true,
"accessReason": "ASKER"
}

レスポンス（アクセス権なし）:

{
"id": "q_uuid",
"title": "トマトのうどんこ病、有機栽培での緊急対策",
"body": "全質問内容...（本文は全公開のため未認証でも返却）",
"requirements": {
  "minAnswerChars": 200,
  "requirePhoto": true,
  "requirePhotoMin": 1,
  "requireVideo": false,
  "requireVideoMin": 0
},
"bountyAmount": 500,
"status": "ANSWERING",
"stats": { "answerCount": 3, "ppvCount": 23 },
"hasAccess": false,
"ppvPrice": 500
}

3.4 質問一覧取得

GET /qa/questions

クエリ:

status（FUNDED, ANSWERING, CLOSED）【補足】FUNDED≒ANSWERING 運用可

crop, disease, region, tag

sort（latest, bounty_high, popular）

page, limit（デフォルト 20）

レスポンス:

{
"questions": [
{
"id": "q_uuid",
"title": "質問タイトル",
"bodyTeaser": "質問の冒頭...",
"bountyAmount": 500,
"status": "ANSWERING",
"deadline": "2025-09-23T18:00:00Z",
"stats": { "answerCount": 3, "viewCount": 45 },
"tags": ["有機栽培", "病害対策"]
}
],
"pagination": { "total": 234, "page": 1, "limit": 20, "hasNext": true }
}

3.5 質問者の全文開封（＝キャプチャ確定課金）【新規/重要】

POST /qa/questions/{id}/open-full

説明: 質問者が初回で回答の全文を閲覧する直前に実行。PI をキャプチャし、以後は全文制限なし。

レスポンス:

{
"success": true,
"captured": true,
"paymentIntentId": "pi_xxx",
"status": "ANSWERING",
"note": "全文開封のため決済確定しました"
}

4. 回答管理
   4.1 回答投稿

POST /qa/answers

リクエスト:

{
"questionId": "q_uuid",
"body": "有機栽培でのうどんこ病対策として...(要件を満たす必要あり)",
"attachments": [
{ "type": "image", "url": "https://storage.example.com/solution.jpg" },
{ "type": "pdf", "url": "https://storage.example.com/guide.pdf", "name": "対策マニュアル.pdf" }
]
}

補足（2025-09-28追加）:
- bodyはqa_answer_contentsテーブルに格納
- body_preview（200文字）はqa_answersテーブルに格納
- RLSにより回答本文の可視性を厳格に制御

422 エラーレスポンス例:

{
  "error": {
    "code": "ANSWER_TOO_SHORT",
    "message": "required 200 chars, got 137"
  }
}

その他エラーコード: PHOTO_REQUIRED, VIDEO_REQUIRED

4.2 ベスト回答選定【修正：手数料・分配】

POST /qa/answers/{id}/select-best

リクエスト:

{
"reason": "実践的で即座に実行可能な内容だったため"
}

処理【修正】:

サーバ側で 未キャプチャなら先にキャプチャ。

エスクロー手数料＝運営 20%、回答者受取＝懸賞金の 80% をウォレット入金（qa_transactions: ESCROW COMPLETED）。

併せて PPV 保留分（ベスト 24%）の一括清算 を内部で実行（詳細は 5.4）。

レスポンス（例：懸賞金 ¥500）【修正】:

{
"success": true,
"settlement": {
"answererAmount": 400,
"platformFee": 100,
"transactionId": "tx_uuid"
}
}

4.3 いいね

POST /qa/answers/{id}/like

4.4 投げ銭（TIP）

POST /qa/answers/{id}/tip

リクエスト:

{
"amount": 100,
"message": "とても参考になりました！"
}

5. 決済管理
   5.1 エスクロー与信（再掲）

POST /qa/payments/escrow（3.2 参照）

5.2 PPV 購入（第三者の全文解錠）【仕様明確化/修正】

POST /qa/payments/ppv

説明【修正】: 第三者が懸賞金と同額を支払って全文解錠。即時課金（自動キャプチャ）。
分配（確定時点）【修正】:

運営 20%

残 80% → 質問者 40%（即時計上） / ベスト 24% / その他 16%（均等割プール）

ベスト未決定時：ベスト 24%は保留（プール held_for_best へ）。

その他 16%はプールに累積、配分は均等割（ブロック除外）。

リクエスト:

{
"questionId": "q_uuid",
"paymentMethodId": "pm_xxx"
}

レスポンス（例：価格 ¥500）【修正】:

{
"paymentIntentId": "pi_xxx",
"clientSecret": "pi_secret_xxx",
"amount": 500,
"breakdown": {
"platformFee": 100,
"toAsker": 200,
"toBest": 120, // ベスト未確定時は 0 と表示し internal held=120
"toOthersPool": 80
}
}

内部処理（関数）【修正】

purchase_ppv_access()：

split_to_platform=20%、split_to_asker=40% 即時計上。

ベスト 24%：確定済なら即時入金／未確定なら held_for_best に積立。

その他 16%：total_amount に加算、プールメンバー＝ブロック除外の回答者を登録。

5.3 決済確認（汎用）【補足】

POST /qa/payments/confirm

リクエスト:

{
"paymentIntentId": "pi_xxx"
}

レスポンス:

{ "ok": true }

5.4 PPV 保留分/プールの清算（ベスト確定時）【新規/重要/修正】

POST /qa/payments/ppv/reconcile-on-best

説明【修正】: ベスト確定時に、

ベスト 24%の保留累積（held_for_best）を一括清算してベスト回答者に入金。

その他 16%プールは、運用ポリシーにより 自動実行 もしくは管理ジョブ/手動で finalize-others エンドポイントを実行。

リクエスト:

{
"questionId": "q_uuid",
"bestAnswerId": "a_uuid"
}

レスポンス（例）:

{
"success": true,
"settlement": {
"ppvBackpayToBest": 2760, // ベスト未確定期間の PPV 24% 合計
"transactionsCreated": ["tx1","tx2"]
}
}

5.5 PPV その他プールの均等清算【新規】

POST /qa/payments/ppv/finalize-others

説明: 該当質問のその他 16%プールを、生存回答者（ブロック除外）で均等割して入金。冪等キーで再実行安全。

リクエスト:

{
"questionId": "q_uuid"
}

レスポンス（例）:

{
"success": true,
"distribution": {
"members": 2,
"perMember": 920,
"distributedTotal": 1840,
"poolRemainder": 0
}
}

5.6 与信期限リフレッシュ/代替決済【新規・パターン E 対策】

POST /qa/payments/reauthorize

リクエスト:

{
"questionId": "q_uuid"
}

レスポンス:

{
"paymentIntentId": "pi_new",
"clientSecret": "pi_new_secret",
"status": "requires_confirmation",
"expiresAt": "2025-09-23T08:00:00Z"
}

6. ウォレット・出金
   6.1 ウォレット残高取得

GET /qa/wallet

レスポンス:

{
"balanceAvailable": 45230,
"balancePending": 2500,
"totalEarned": 156780,
"totalWithdrawn": 109050,
"transactions": [
{
"id": "tx_uuid",
"type": "CREDIT",
"amount": 400,
"description": "ベスト回答報酬（エスクロー 80%）",
"referenceType": "BEST_ANSWER",
"createdAt": "2025-09-22T18:30:00Z"
}
]
}

6.2 出金申請

POST /qa/payouts/request

リクエスト:

{
"amount": 10000
}

レスポンス:

{
"payoutId": "po_uuid",
"amount": 10000,
"fees": { "fixed": 250, "rate": 25 },
"netAmount": 9725,
"estimatedArrival": "2025-09-25",
"status": "REQUESTED"
}

6.3 出金履歴

GET /qa/payouts

7. 請求書管理
   7.1 請求書一覧

GET /qa/invoices

7.2 請求書 PDF

GET /qa/invoices/{id}/pdf
Content-Type: application/pdf（適格請求書）

8. 統計・分析
   8.1 ユーザー統計

GET /qa/stats/user

レスポンス:

{
"period": "2025-09",
"earnings": { "bestAnswers": 12000, "ppvRevenue": 8500, "tips": 2300, "total": 22800 },
"activity": { "questionsAsked": 5, "answersGiven": 45, "bestSelected": 8 },
"performance": { "bestRate": 17.78, "avgResponseTime": 2.5, "satisfactionRate": 94.5 }
}

8.2 質問統計

GET /qa/stats/question/{id}

レスポンス:

{
"views": { "total": 234, "unique": 189, "ppvPurchases": 23 },
"revenue": { "ppv": 11500, "tips": 500, "total": 12000 },
"engagement": { "avgReadTime": 145, "shares": 12, "bookmarks": 34 }
}

9. 通知
   9.1 通知一覧

GET /qa/notifications

9.2 既読マーク

PATCH /qa/notifications/{id}/read

10. Webhook（Stripe）【修正】
    エンドポイント

POST /webhooks/stripe

購読イベント（主要）【修正】

payment_intent.succeeded（与信成功 / 自動キャプチャ成功）

payment_intent.payment_failed

payment_intent.canceled（未使用与信のキャンセル）

charge.refunded（返金反映）

payout.paid（出金着金）

処理原則

すべて Idempotency-Key で直列化・多重防止

成功時：qa_transactions 反映、qa_questions 状態更新（ANSWERING/CANCELLED など）、通知発行

11. エラーコード【拡充/修正】
    | コード | 説明 | HTTP |
    | ----------------------------- | ------------- | ---- |
    | AUTH_REQUIRED | 認証が必要 | 401 |
    | ACCESS_DENIED | アクセス権限なし | 403 |
    | NOT_FOUND | リソースが見つからない | 404 |
    | INSUFFICIENT_BALANCE | 残高不足 | 400 |
    | INVALID_AMOUNT | 金額が不正 | 400 |
    | DEADLINE_PASSED | 締切を過ぎている | 400 |
    | ALREADY_ANSWERED | すでに回答済み | 409 |
    | PAYMENT_FAILED | 決済失敗 | 402 |
    | RATE_LIMIT | レート制限 | 429 |
    | PAYMENT_REQUIRES_ACTION【新規】 | 追加認証が必要（3DS 等） | 402 |
    | PAYMENT_AUTH_EXPIRED【新規】 | オーソリ期限切れ | 402 |
    | CAPTURE_FAILED【新規】 | キャプチャに失敗 | 402 |
    | DUPLICATE_REQUEST【新規】 | 冪等キー重複/二重実行 | 409 |
    | BEST_ALREADY_SELECTED【新規】 | ベストはすでに確定済み | 409 |

12. レート制限（参考）

認証済み: 600 req/分

未認証: 60 req/分

決済系: 10 req/分（PI 作成/キャプチャ/PPV/ベスト確定/全文開封）

13. セキュリティヘッダー（CORS 含む）

必須/推奨ヘッダー（再掲）【修正】

Authorization: Bearer {token}
X-Request-Id: {UUID}
X-Client-Version: 1.0.0
Idempotency-Key: {UUID} // 決済・確定系で必須

CORS 設定:

Access-Control-Allow-Origin: https://your-domain.com
Access-Control-Allow-Methods: GET, POST, PATCH, DELETE
Access-Control-Allow-Headers: Authorization, Content-Type, X-Request-Id, Idempotency-Key

14. 実装ノート（ハンドラ準拠）【新規/重要】

アクセス制御：回答本文フルは has_question_access() で保護（ASKER/RESPONDER/PPV/ADMIN）。

PI 作成方針：エスクロー=manual capture。PPV/TIP は automatic。

15. 開発環境での動作【2025-09-23追加】

開発環境（NODE_ENV !== 'production'）では以下の動作となります：

**認証とユーザー管理:**
- サービスロールクライアント使用（RLSバイパス）
- 質問投稿: 「開発テストユーザー」を自動使用
- 回答投稿: 「開発テスト回答者」を自動作成・使用（質問者と異なるユーザーID）
- これにより質問者自身による回答を防ぐ制約を満たす

**決済処理:**
- Stripe決済はスキップ（シミュレーション）
- 質問作成時: ステータス直接「FUNDED」に設定
- PPV購入: 決済なしでアクセス権限付与

**ステータス管理:**
- 質問ステータス: FUNDED または ANSWERING で回答受付可能
- deadline_at: null許容（開発環境での簡易テスト用）

全文開封：POST /qa/questions/{id}/open-full で初回のみキャプチャ → 以後は冪等。

ベスト確定：キャプチャ未済なら先にキャプチャ。select-best 内で ppv/reconcile-on-best を内部呼び出し。

PPV（ベスト未決定）：held_for_best に 24% を積み立て、16% は others プール累積。

others 配分：ppv/finalize-others で均等割（ブロック除外）。運用で自動/手動選択。

与信期限ガード：reauthorize を提示しつつ、期限直前ジョブで 自動キャプチャ or 自動キャンセル（回答数で分岐）。

監査：公開/ベスト/PPV/全文開封/自動処理は qa_audit_logs に記録。

冪等：フロントが Idempotency-Key を毎回発行。サーバは決済・状態遷移を必ず冪等に。

16. プロフィール管理【2025-09-29追加】

16.1 公開プロフィール取得

GET /questions/users/{id}

レスポンス例:
```json
{
  "user_id": "uuid",
  "display_name": "農家太郎",
  "avatar_url": "https://...",
  "bio": "有機栽培歴20年",
  "expertise_areas": ["有機栽培", "病害虫対策"],
  "tier": "GOLD",
  "reputation_score": 850,
  "total_answers": 234,
  "total_best_answers": 156,
  "best_answer_rate": 66.7,
  "stats": {
    "total_questions": 45,
    "total_earned": 580000,
    "last_answer_at": "2025-09-29T10:00:00Z"
  },
  "recent_answers": [...],
  "recent_questions": [...]
}
```

16.2 マイプロフィール取得/更新

GET /questions/profile
PATCH /questions/profile

リクエスト例（PATCH）:
```json
{
  "display_name": "農家太郎",
  "bio": "有機栽培歴20年、トマト栽培専門",
  "expertise_areas": ["有機栽培", "トマト", "土壌改良"],
  "invoice_registration_no": "T1234567890123",
  "company_name": "田中農園",
  "billing_address": "〒123-4567 東京都..."
}
```

17. 請求書管理【2025-09-29追加】

17.1 請求書一覧取得

GET /questions/invoices?year=2025&month=9

レスポンス例:
```json
[
  {
    "id": "uuid",
    "invoice_number": "INV-202509-001",
    "period_start": "2025-09-01",
    "period_end": "2025-09-30",
    "subtotal": 35000,
    "tax_rate": 10,
    "tax_amount": 3500,
    "total_amount": 38500,
    "status": "ISSUED",
    "line_items": [...]
  }
]
```

17.2 請求書PDF取得

GET /questions/invoices/{id}/pdf

レスポンス:
- Content-Type: application/pdf
- 適格請求書形式のPDFファイル

18. ウォレット管理【2025-09-29追加】

18.1 ウォレット情報取得

GET /questions/wallets/me

レスポンス例:
```json
{
  "balance_available": 125000,
  "balance_pending": 35000,
  "total_earned": 580000,
  "total_withdrawn": 420000,
  "pending_ppv_shares": 12000,
  "transactions": [...],
  "auto_payout_enabled": false,
  "auto_payout_threshold": 100000
}
```

19. PPV購入【2025-09-29追加】

19.1 PPV購入（同額解錠）

POST /questions/{id}/ppv

レスポンス例:
```json
{
  "success": true,
  "transaction_id": "uuid",
  "access_granted": true
}
```

API Version: 1.2.1【修正】
Last Updated: 2025-10-01【修正】

主要な修正点サマリ

2025-10-01: 質問投稿API（POST /qa/questions）に認証必須を明記

エスクロー：手数料 20%／回答者 80% に全記述を統一（4.2 レスポンス例含む）。

PPV 分配：運営 20%／質問者 40%／ベスト 24%／その他 16% に全記述を統一（5.2 の breakdown 例、内部処理）。

保留 → 清算：ベスト未決定の 24% は reconcile-on-best で一括清算、16% は finalize-others で均等割。

エンドポイント追加：POST /qa/payments/ppv/finalize-others（others16%配分）【新規】。

用語・フロー：全文開封＝キャプチャ確定課金、与信期限ガード、冪等ヘッダー必須を明記。
