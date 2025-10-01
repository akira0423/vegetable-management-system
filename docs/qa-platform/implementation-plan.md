プロジェクト概要
1.1 ビジョン

農業従事者向けの専門知識共有プラットフォームとして、質問者が懸賞金を設定し、最適な回答を得られる仕組みを提供します。第三者も同額支払いで全回答を閲覧可能とし、知識の価値を適切に評価・流通させます。

【実装状況 2025-09-28】
✅ 基本機能実装完了（進捗率: 95%）
✅ 検索・フィルタリング機能実装
✅ 回答本文分離（RLS制御）実装
🔄 残タスク: ルーティング調整、PPV機能、ウォレット機能

1.2 主要機能

懸賞金付き質問投稿 (最低 ¥10)

エスクロー決済（与信 → 全文閲覧直前キャプチャ）【修正】

PPV 同額解錠（運営 20%→ 残 80%を A40/Best24/Others16、ベスト未確定時は回答者分をプール保留・ブロック回答者は配分除外）【修正】

適格請求書発行（チャネル別：Web/IAP/Play）【修正】

月次精算・出金管理（¥250/回固定手数料）

1.3 技術スタック

フロントエンド: Next.js 15.x, React 19, TypeScript 5

バックエンド: Supabase (PostgreSQL, RLS), Supabase Edge Functions

決済: Stripe Connect (Web)、StoreKit / Play Billing（アプリ、developer_net 基準）【修正】

UI: TailwindCSS 4, shadcn/ui

認証: Supabase Auth

1.4 パターン別処理フロー

=====パターン A：通常ケース（回答も来て、全文を見て、ベスト決定までスムーズ）=====
ユーザー体験（質問者 A／回答者 B）

A が質問を作成し、懸賞金（例：¥5,000）を設定して公開。

決済は先に与信確保される（カードのオーソリ）。A は質問ページを閲覧できる（自分の質問なので本文は常時フル表示）。

B が回答を投稿。A は回答を読み比べる。

A がベスト回答を決定 → 即時で B に報酬（懸賞金 × 80%）が加算（エスクロー手数料 20%控除）【修正】。

取引完了。A・B 双方へ通知。

※仕様ポイント（整合）：

質問作成時は Stripe PaymentIntent(capture_method='manual')で与信のみ取得。

ベスト確定時点で自動キャプチャし、別途 transfers で B へ分配（Connect）。

「全文閲覧＝確定課金」はパターン C のとき適用（ベスト確定前に A が先に全文を開封したいケース）。

裏側フロー（API/DB/Stripe）
質問公開（与信確保）

POST /api/qa/questions

新規行：qa_questions（status='ANSWERING'、stripe_payment_intent_id 保存、deadline_at セット、escrow_status='AUTHORIZED'）【修正】。

スキーマ：grant_asker_access_on_question トリガで A に ASKER アクセス付与。

Stripe:

PaymentIntent.create（amount=bounty, capture_method='manual', transfer_group=qid）

payment_intent.succeeded webhook で qa_questions.stripe_payment_intent_id を確定保存（冪等）。

回答投稿

POST /api/qa/answers

qa_answers 追加、grant_responder_access_on_answer で B に RESPONDER アクセス付与＋ qa_questions.answer_count++。

ベスト選定（キャプチャ＆分配）

POST /api/qa/answers/:id/best

PI capture: paymentIntents.capture(pi_id, amount_to_capture=bounty)

分配: プラットフォーム手数料 20% → プラットフォーム、残り 80% → B のウォレットへ（Separate charges & transfers）【修正】。

DB: 関数 select_best_answer(question_id, answer_id) 呼び出し

qa_transactions (type=ESCROW, status='COMPLETED', amount=bounty, platform_fee=20%, net_amount=80%)【修正】

qa_wallets(B) 残高加算（update_wallet_balance(..., 'CREDIT','BEST_ANSWER',...)）

qa_answers.is_best=true／qa_questions.status='CLOSED'、best_answer_id、best_selected_at/closed_at

qa_notifications（B へ「BEST_SELECTED」）

代表的エラーと対処

PI が capture 不可（オーソリ失効等）

まず A に「支払い更新」ダイアログ、再オーソリ → 成功で続行。失敗が続けば status='DISPUTED'へエスカレーション。

同時ベスト選定（二重クリック）

API は冪等鍵＋ DB 側で qa_answers.best_answer_timestamp 制約・トランザクション境界で 1 件に限定。

状態遷移／会計／通知

状態：ANSWERING → CLOSED

会計：A 支払い確定（キャプチャ）、Platform 20%／B 80%【修正】

通知：

B：BEST_SELECTED

A：決済完了（PAYMENT_RECEIVED）とクローズ通知

=====パターン B：回答ゼロでクローズ（未成立）→ 自動キャンセル（無料）=====
ユーザー体験（A）

A が質問を公開し待つが、期限まで回答 0 件。

締切時に自動キャンセル。A の支払いは発生しない（無料）。

画面には「未成立につきキャンセル」表示、再投稿導線を提示。

裏側フロー

スケジューラ（cron／Edge Job）：締切到達の qa_questions を走査

answer_count=0 かつ status='ANSWERING' → status='CANCELLED'

Stripe：

与信のみでキャプチャ未実行 → paymentIntents.cancel(pi_id)

誤ってキャプチャ済みなら Refund 全額 → qa_transactions に type='REFUND' を補記

アクセス：qa_access_grants は履歴として維持

状態遷移／会計／通知

状態：ANSWERING → CANCELLED

会計：0 円（キャプチャ前提）／誤キャプチャ時は全額返金

通知：A へ SYSTEM「未成立キャンセル」

=====パターン C：全文は見たいが、まだベストは決めない（全文閲覧＝確定課金）=====

A は他者回答の「全文」初回表示の瞬間に、与信 → キャプチャが走る（確認ダイアログで同意）。

以降は全文閲覧可能、ベストは後日で OK。

裏側フロー

GET /api/qa/answers?question_id=...&full=1

サーバが未キャプチャを検出 → paymentIntents.capture(pi_id)（冪等鍵）

成功後、本文返却。この段階では分配は未実施（ベスト確定時に ESCROW 精算）。

状態：ANSWERING のまま

通知：A へ PAYMENT_RECEIVED（「全文開封のため決済確定」）

=====パターン D：PPV（第三者閲覧）で売れ続ける=====

価格＝懸賞金と同額。

分配：運営 20%／残 80%→ 質問者 40%（即時）／ベスト 24%（ベスト確定時清算）／その他 16%（均等、ベスト確定時清算）【修正】

ベスト未確定期間の回答者分はプールで累積。ベスト確定後に一括清算。その他回答者が 0 人なら 16%は全額ベストへ繰り上げ。【修正】

=====パターン E：ベスト未決定のまま与信が切れそう（与信期限ガード）=====

与信期限接近で A に選択肢を提示：（1）今すぐ全文開封（キャプチャ）／（2）ベスト決定／（3）キャンセル。

自動処理：回答 1 件以上なら自動キャプチャ、0 件なら自動キャンセル。

裏側フロー（監視ジョブ）

対象：status='ANSWERING' かつ captured=false

期限判定で分岐：

回答 0 件 → cancel(pi) → CANCELLED

回答 1 件以上 → capture(pi) → 支払い確定、状態は ANSWERING 維持

共通：API & 実装チェックリスト（抜粋）

冪等性：決済系はすべて Idempotency-Key 必須。

RLS：本文のフル返却は has_question_access()（ASKER/RESPONDER/PPV）のみ。

Webhook：payment_intent.\*／charge.refunded をキューで直列化。

集計：PPV のベスト未決定分は metadata.pending_for_best=true で管理、ベスト確定 API で確定配分。

監査：重要アクションは qa_audit_logs に記録。

マテビュー：qa_stats_realtime／qa_stats_ppv_daily を定期更新。

画面への反映（UX ガイド）

質問ページ（A 用）：ベスト決定ボタン、全文開封モーダル、与信期限バナー。

質問ページ（E 用）：PPV 購入 CTA（**「運営 20%・質問 40%・ベスト 24%・その他 16%」**と明記）【修正】。

ヘッダ通知：ベスト選定・PPV 売上・自動処理結果。

実装順序のおすすめ

A/B/E の基盤（与信 → ベスト → キャプチャ／自動キャンセル／自動キャプチャ）

C の全文開封時キャプチャ

D の PPV（恒久アクセス、プール保留 → ベスト時清算）

メトリクス（定期リフレッシュ、SLO 監視）

実装スケジュール
Phase 1: 基盤構築 (2-3 週間)

Week 1: データベース・認証基盤

Supabase スキーマ（qa スキーマ）マイグレーション作成

追加：qa_ppv_pools, qa_ppv_pool_members, qa_answer_blocks【修正】
注意事項：
- GENERATED ALWAYS AS句はトリガーで実装（PostgreSQL制約対応）
- パーティションテーブルのPRIMARY KEYにはパーティションキーを含める
- 部分インデックス（WHERE句付き）は避ける（IMMUTABLE関数制約）

変更：qa_transactions に channel / developer_net 追加【修正】

変更：qa_questions に escrow_pi_id / escrow_status 追加【修正】

RLS ポリシー実装（質問本文全公開、回答はASKER/RESPONDER/PPV/ADMIN、プール・ブロックは厳格、書込は Edge のみ）【修正】

認証フロー拡張（税務情報／Stripe Connect Onboarding）

ベース CRUD API（質問・回答・閲覧権限付与）

✅ 回答品質要件システム (2025-09-23 完了)
- qa_questionsテーブルに要件カラム追加（min_answer_chars, require_photo, require_video等）
- DBトリガーによる強制バリデーション
- 初回答後の要件ロック機能

Week 2: Stripe Connect 統合

Connect Express アカウント（OAuth/KYC）

Webhook 実装（決済・返金・トランスファ・ペイアウト）

エスクロー与信 API（PaymentIntent: manual capture）【修正】

全文閲覧直前キャプチャ API（成功後に AccessGrant 確認）【修正】

Week 3: コア API 開発

質問投稿・回答 API
  - 回答品質要件の受け取り・検証実装

アクセス制御 API（AccessGrants）

PPV 同額解錠 API（分配=運営 20%→ 残 80%を A40 即時 / Best プール 24 / Others プール 16）【修正】

エラーハンドリング／冪等性（Idempotency-Key）

Phase 2: 主要機能実装 (2 週間)

Week 4: フロントエンド開発

質問投稿フォーム（与信導線付き）【修正】
  - 回答品質要件入力UI（最小文字数、写真/動画必須設定）

回答投稿・閲覧画面（質問本文全公開、回答は権限者のみ RLS で取得）【修正】
  - 回答品質要件バッジ表示
  - リアルタイム文字数カウンタ・要件検証

決済フロー UI（PPV・キャプチャ・分配式を「20%/40%/24%/16%」で明記）【修正】

ウォレット管理画面

Week 5: 決済・精算機能

ベスト選定 →Best プール一括反映（24% グロス基準）【修正】

ブロック後 →Others プール（16%）は生存回答者で等分【修正】

適格請求書 PDF 生成（チャネル別内訳）

出金リクエスト（¥250/回固定）

Phase 3: 運用機能強化 (2 週間)

Week 6: セキュリティ・監査

透かし（購入者名＋日時＋ QA-ID）

監査ログ（精算・ブロック・返金・出金）

レート制限（Edge+Redis）

セキュリティテスト（RLS 検証）

Week 7: 管理・分析機能

管理者ダッシュボード（プール台帳、未精算監視）【修正】

モデレーター（ブロック／返金補助）【修正】

分析レポート（チャネル別売上／運営 20% 集計）

本番環境デプロイ準備

アーキテクチャ設計
3.1 システム構成図

Frontend (Next.js)

- Q&A UI / Payment / Admin Panel
  │ API Routes
  Backend (Supabase)
- Postgres / Edge Functions / Storage
  │
  External
- Stripe Connect / IAP / Play

3.2 データフロー

質問投稿フロー（エスクロー）

A が質問フォーム入力 → Edge: 与信 API で PaymentIntent (manual capture) を作成【修正】

与信成功 → qa_questions 作成（escrow_status='AUTHORIZED'）【修正】

A が「全文閲覧」押下で Edge: キャプチャ API 実行【修正】

キャプチャ成功 → escrow_status='CAPTURED'、ASKER の AccessGrant 確認【修正】

ベスト選定フロー（エスクロー清算）

A がベスト回答を選択

Edge → DB 関数 select_best_answer 実行

B へ懸賞金の 80%入金（Platform 20%）【修正】

質問状態更新／通知送信

PPV 解錠フロー（第三者 E）

E が同額購入（Web: Stripe / アプリ: IAP/Play）

チャネル別分配基準：Web=総額、IAP/Play=developer_net（ストア手数料控除後）【修正】

分配計算：運営 20% → 残 80% を A=40%（即時）, Best プール=24%, Others プール=16% に計上【修正】

AccessGrant（PPV）付与、請求書・監査記録

主要コンポーネント設計
4.1 データベーステーブル（主要）

質問/回答
qa_questions — メタ＋ escrow_status＋回答品質要件【修正】
  - min_answer_chars, require_photo/video, requirements_locked_at
qa_question_contents — 本文（全公開、添付のみ署名URL制御）【修正】
qa_answers — 回答（is_best, selected_best_at）

アクセス権
qa_access_grants — ASKER/RESPONDER/PPV の付与履歴

決済/分配
qa_transactions — 取引（type/amount/platform_fee/channel/developer_net）【修正】
qa_pools — PPV の Best/Others プール台帳（question_id 単位で累積）【修正】
qa_blocks — 配分除外の回答者管理（モデレーションや不正対策）【修正】
qa_pool_distributions — プール清算の監査レコード（誰にいくら配布したか）【修正】

ウォレット/出金/会計
qa_wallets, qa_wallet_transactions, qa_payouts, qa_invoices

監査/通知
qa_audit_logs, qa_notifications

旧 qa_purchases は使用しません。【修正】

4.2 API エンドポイント（契約）

質問関連
POST /api/qa/questions // 作成（与信直後に作成）
GET /api/qa/questions/:id // 詳細（メタ＋権限あれば本文）
PATCH /api/qa/questions/:id // 更新（下書き中のみ）

回答関連
POST /api/qa/answers // 回答投稿
POST /api/qa/answers/:id/best // ベスト選定 → select_best_answer（ESCROW80/20 反映）【修正】
POST /api/qa/blocks // ブロック登録（質問者/管理）【修正】

決済関連（Edge Functions）
POST /api/qa/payments/escrow-authorize // エスクロー与信【修正】
POST /api/qa/payments/capture-fullview // 全文閲覧直前キャプチャ【修正】
POST /api/qa/payments/ppv // PPV 決済（channel, developer_net 対応）【修正】

精算関連（Edge Functions）
POST /api/qa/settlements/select-best // ベスト確定 →Best プール（24%）一括清算【修正】
POST /api/qa/settlements/finalize-others // Others プール（16%）等分清算（ブロック除外）【修正】

出金/請求
POST /api/qa/payouts/request
GET /api/qa/invoices/:id

冪等性：決済/精算系は Idempotency-Key 必須。
整合性：精算系は質問 ID で pg_advisory_xact_lock を取得して重複清算を防止。

4.3 フロント主要コンポーネント

<QuestionForm /> — 懸賞金・締切・与信開始【修正】

<AnswerList /> — 回答一覧（権限別表示）

<PaymentDialog /> — PPV 購入（20/40/24/16 の分配明記）【修正】

<WalletBalance /> — 残高/出金

<PoolLedger /> — プール台帳 & 精算操作（管理/質問者向け）【修正】

セキュリティ設計
5.1 アクセス制御（RLS）

qa_questions：本文は全員SELECT可（公開後はstatus NOT IN ('DRAFT','PENDING_PAYMENT')）【修正】
qa_answers：AccessGrant 保有者（ASKER/RESPONDER/PPV/ADMIN）のみ SELECT 可【修正】

qa_pools / qa_blocks / qa_pool_distributions：参照は最小限、書込は Edge（service role）のみ【修正】

qa_wallets / qa_transactions：本人のみ SELECT、書込は関数経由

5.2 決済セキュリティ

Stripe Webhook 署名検証／IAP/Play レシート検証

Idempotency-Key、再試行安全設計

エスクローは manual capture、キャプチャ成功後にアクセス解放【修正】

5.3 データ保護

署名 URL ＋透かし（購入者名・日時・QA-ID）

監査ログ（返金/精算/出金/ブロック/ベスト）

税務対応
6.1 適格請求書要件

登録番号、税率区分（10%）、税額、取引日時、発行者・受領者情報

チャネル別（WEB/IOS/ANDROID）内訳・運営 20%を明示【修正】

6.2 税務処理フロー

取引時に税額（必要箇所）自動計算

月次で請求書一括生成（運営手数料・チャネル別）

PDF ダウンロード、保存義務対応

テスト計画（受入基準に直結）
7.1 単体テスト

分配ロジック：運営 20% → 残 80% を A40/Best24/Others16（IAP/Play は developer_net 基準）【修正】

RLS（本文未権限取得不可、プール等の読取制限）【修正】

エスクロー状態遷移（AUTHORIZED→CAPTURED/CANCELLED）【修正】

7.2 統合テスト / E2E

PPV（¥500, Web）：運営 ¥100 / A¥200 即時 / best_pool¥120 / others_pool¥80【修正】

ベスト確定：best_pool 全額がベスト回答者へ

ブロックあり：others_pool は生存回答者のみで等分

IAP（developer_net=¥350 想定）：運営 ¥70 / A¥140 / best_pool¥84 / others_pool¥56【修正】

エスクロー：与信 → 全文閲覧押下で capture→AccessGrant 付与

7.3 負荷テスト

同時接続 1000、読み p95 < 150ms、書き p95 < 600ms（CDN/Edge 活用）

運用計画
8.1 監視

エラー率、決済成功率、Webhook 遅延、API p95/p99

プール残高・未精算件数、与信期限アラート

8.2 バックアップ

DB PITR、日次バックアップ

請求書/監査ログの長期保管

8.3 サポート

返金方針：カードは原則残高返戻優先、最終手段でカード返金（手数料は戻らない旨を表示）【修正】

IAP/Play 返金：ストア規約に準拠、ヘルプセンター誘導【修正】

リスク管理
9.1 技術的リスクと対策

二重配分：Idempotency ＋ pg_advisory_xact_lock ＋監査差分再計算【修正】

本文漏えい：本文分離/RLS テスト（自動化）【修正】

IAP 整合不一致：developer_net 必須化、検証ログ保存【修正】

与信失効：期限アラート、再オーソリ導線【修正】

9.2 ビジネスリスクと対策

返金多発：プレビュー強化、返品特約明示、CSR 標準オペ

流動性：最低出金額/出金手数料/出金頻度制御

不適切回答：ブロック＆通報、配分除外ロジック【修正】

成功指標（KPI）
10.1 初期目標（3 ヶ月）

月間アクティブユーザー: 1,000

月間質問数: 500

ベスト選定率: 80%+

PPV 購入 1 件あたり平均配分遅延 < 10 分（best_pool/others_pool 除く即時計上分）【修正】

10.2 中期目標（1 年）

MAU: 10,000

月間質問数: 5,000

月間取扱高: 500 万円

NPS: 50+

精算事故（重複/欠損）: 0 件【修正】

次のステップ（実務向け ToDo）

今すぐ着手

Supabase マイグレーション追加＆適用：

20250922_qa_patch_pools_blocks_net.sql（新テーブル/列/RLS）【修正】

20250922_qa_functions_patch.sql（purchase_ppv_access/select_best_answer/finalize_others_pool/capture_on_fullview）【修正】

本文移行 SQL：qa_questions.body → qa_question_contents.body【修正】

Edge Functions デプロイ：

payments-escrow-authorize / payments-capture-fullview / payments-ppv-purchase【修正】

settlements-select-best / settlements-finalize-others【修正】

フロント：

質問詳細の全文閲覧でキャプチャ API→ 権限反映

PPV ダイアログに 20/40/24/16 と IAP/Play の返金窓口を明記

着手準備

利用規約・プライバシーポリシー（分配式/返金方針/IAP 窓口を明記）【修正】

税理士レビュー（チャネル別計上）

CSR オペマニュアル（ブロック/精算/返金）

付録
12.1 参考資料

Stripe Connect（Separate charges & transfers / manual capture）

Supabase RLS ガイド

Apple/Google IAP レシート検証（developer_net 基準）

12.2 用語集

エスクロー（manual capture）： オーソリのみ → 後日キャプチャ【修正】

PPV（Pay Per View）： 同額解錠。運営 20%→ 残 80%を A40/Best24/Others16【修正】

プール台帳： PPV の Best/Others の累積を保持、後から清算【修正】

ブロック： Others 配分対象から回答者を除外【修正】

developer_net： IAP/Play のストア手数料控除後の開発者受取額【修正】

最終更新: 2025-09-22
バージョン: 1.1.0（20%/40%/24%/16% 仕様整合版)
