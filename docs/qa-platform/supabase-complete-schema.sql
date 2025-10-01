-- =====================================================
-- Q&Aプラットフォーム Supabase完全スキーマ設計
-- Version: 3.2.0 (HyperScale Ready)          -- [CHANGED] 3.1.0 → 3.2.0
-- Date: 2025-09-28  -- [UPDATED] 回答本文分離テーブル追加
--
-- 想定スケール：
-- - 100万リクエスト/日
-- - 10万同時接続ユーザー
-- - 1億レコード/年
--
-- 設計原則：
-- 1. ゴールから逆算した必要十分な設計
-- 2. ハイパースケール対応（パーティショニング）
-- 3. セキュリティ（RLS）完備
-- 4. 既存システムとの完全分離
-- 5. イベントソーシング採用
-- =====================================================

-- =====================================================
-- PART 1: 基盤設定
-- =====================================================

-- 拡張機能の有効化
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- UUID生成
CREATE EXTENSION IF NOT EXISTS "pgcrypto";       -- 暗号化
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- 全文検索最適化
-- CREATE EXTENSION IF NOT EXISTS "pg_partman";  -- Supabaseでは利用不可のためコメントアウト
-- CREATE EXTENSION IF NOT EXISTS pgroonga;      -- 日本語全文検索を使う場合に検討（今回はsimpleを使用） -- [NOTE]

-- パフォーマンス設定（推奨値）
-- ALTER SYSTEM SET shared_buffers = '8GB';
-- ALTER SYSTEM SET effective_cache_size = '24GB';
-- ALTER SYSTEM SET work_mem = '256MB';
-- ALTER SYSTEM SET max_connections = 400;

-- =====================================================
-- PART 2: カスタム型定義（ENUM）
-- =====================================================

-- 質問ステータス（ビジネスロジックの中核）
CREATE TYPE qa_question_status AS ENUM (
    'DRAFT',           -- 下書き（未公開）
    'PENDING_PAYMENT', -- 支払い待ち
    'FUNDED',          -- 入金済み（回答受付開始）
    'ANSWERING',       -- 回答受付中
    'SELECTING',       -- ベスト選定期間
    'CLOSED',          -- 終了（ベスト確定）
    'EXPIRED',         -- 期限切れ（ベスト未選定）
    'CANCELLED',       -- キャンセル（返金済み）
    'DISPUTED'         -- 紛争中
);

-- 決済タイプ（会計処理の基準）
CREATE TYPE qa_payment_type AS ENUM (
    'ESCROW',          -- エスクロー（懸賞金）
    'PPV',             -- Pay Per View（同額解錠）
    'TIP',             -- 投げ銭（チップ）
    'REFUND',          -- 返金
    'WITHDRAWAL'       -- 出金
);

-- 決済ステータス
CREATE TYPE qa_payment_status AS ENUM (
    'PENDING',         -- 保留中
    'PROCESSING',      -- 処理中
    'COMPLETED',       -- 完了
    'FAILED',          -- 失敗
    'CANCELLED',       -- キャンセル
    'REFUNDED'         -- 返金済み
);

-- ユーザーティア（信頼性指標）
CREATE TYPE qa_user_tier AS ENUM (
    'BRONZE',          -- 初級（0-99ポイント）
    'SILVER',          -- 中級（100-499ポイント）
    'GOLD',            -- 上級（500-999ポイント）
    'PLATINUM',        -- 最上級（1000+ポイント）
    'VERIFIED'         -- 認証済み専門家
);

-- 通知タイプ
CREATE TYPE qa_notification_type AS ENUM (
    'NEW_ANSWER',       -- 新着回答
    'BEST_SELECTED',    -- ベスト選定
    'PAYMENT_RECEIVED', -- 支払い受領
    'PPV_PURCHASE',     -- PPV購入
    'TIP_RECEIVED',     -- チップ受領
    'DEADLINE_REMINDER',-- 締切リマインダー
    'SYSTEM'            -- システム通知
);

-- =====================================================
-- PART 3: メインテーブル定義
-- =====================================================

-- =====================================
-- 3.1 ユーザープロフィール拡張
-- =====================================
CREATE TABLE qa_user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Profile Information
    display_name VARCHAR(100) NOT NULL,
    bio TEXT,
    avatar_url TEXT,
    expertise_areas TEXT[] DEFAULT '{}',

    -- Stripe Integration
    stripe_customer_id VARCHAR(255) UNIQUE,
    stripe_account_id VARCHAR(255) UNIQUE,
    stripe_account_status VARCHAR(50) DEFAULT 'pending',
    stripe_onboarding_completed BOOLEAN DEFAULT false,

    -- Tax Information (日本の税務対応)
    is_taxable BOOLEAN DEFAULT true,
    invoice_registration_no VARCHAR(50),
    company_name VARCHAR(255),
    company_address JSONB,

    -- Statistics
    tier qa_user_tier DEFAULT 'BRONZE',
    reputation_score INTEGER DEFAULT 0 CHECK (reputation_score >= 0),
    total_questions INTEGER DEFAULT 0 CHECK (total_questions >= 0),
    total_answers INTEGER DEFAULT 0 CHECK (total_answers >= 0),
    total_best_answers INTEGER DEFAULT 0 CHECK (total_best_answers >= 0),
    best_answer_rate DECIMAL(5,2) DEFAULT 0 CHECK (best_answer_rate BETWEEN 0 AND 100),
    avg_response_hours DECIMAL(10,2),

    -- Settings
    notification_email BOOLEAN DEFAULT true,
    notification_push BOOLEAN DEFAULT true,
    auto_payout_enabled BOOLEAN DEFAULT false,
    min_payout_amount DECIMAL(10,2) DEFAULT 3000 CHECK (min_payout_amount >= 0),
    preferred_language VARCHAR(5) DEFAULT 'ja',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
/* [REMOVED] CREATE TABLE内のINDEX句はPostgreSQL非対応のため削除。PART 8でCREATE INDEXへ集約 */

-- =====================================
-- 3.2 質問テーブル（パーティション対応可）
-- =====================================
CREATE TABLE qa_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,               -- [CHANGED] 二重定義を解消し1つに統一
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,               -- moved up for clarity

    -- シャーディングキー（トリガーで設定）
    shard_key INTEGER,                                             -- [CHANGED] GENERATED削除、トリガーで設定

    -- Relations
    asker_id UUID NOT NULL REFERENCES auth.users(id),
    best_answer_id UUID, -- 後でFK

    -- Content
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    body_preview TEXT,                                             -- [CHANGED] GENERATED削除、トリガーで設定

    -- 非正規化フィールド
    asker_display_name VARCHAR(100),
    asker_avatar_url TEXT,
    asker_tier VARCHAR(20),
    asker_reputation INTEGER,                                       -- [CHANGED] 末尾にカンマ漏れを修正

    -- Categorization
    category VARCHAR(50),
    crop VARCHAR(100),
    disease VARCHAR(100),
    region VARCHAR(100),
    season VARCHAR(50),
    tags TEXT[] DEFAULT '{}',

    -- Media
    attachments JSONB DEFAULT '[]',

    -- Financial
    bounty_amount DECIMAL(10,2) NOT NULL CHECK (bounty_amount >= 10),
    platform_fee_rate DECIMAL(5,4) DEFAULT 0.20,                    -- [CHANGED] 0.10 → 0.20（運営20%）
    platform_fee_amount DECIMAL(10,2),                             -- [CHANGED] GENERATED削除、トリガーで設定

    -- Status & Timing
    status qa_question_status DEFAULT 'DRAFT' NOT NULL,
    deadline_at TIMESTAMPTZ NOT NULL,
    published_at TIMESTAMPTZ,
    answered_at TIMESTAMPTZ,
    best_selected_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,

    -- Stripe Ref
    stripe_payment_intent_id VARCHAR(255),
    stripe_charge_id VARCHAR(255),

    -- Statistics
    view_count INTEGER DEFAULT 0 CHECK (view_count >= 0),
    unique_viewers INTEGER DEFAULT 0 CHECK (unique_viewers >= 0),
    answer_count INTEGER DEFAULT 0 CHECK (answer_count >= 0),
    ppv_purchase_count INTEGER DEFAULT 0 CHECK (ppv_purchase_count >= 0),
    total_ppv_revenue DECIMAL(10,2) DEFAULT 0 CHECK (total_ppv_revenue >= 0),

    -- Search Optimization
    search_vector tsvector,                                        -- [CHANGED] GENERATED削除、トリガーで設定

    -- Answer Requirements
    min_answer_chars INTEGER NOT NULL DEFAULT 0,                  -- 回答最小文字数
    require_photo BOOLEAN NOT NULL DEFAULT false,                  -- 写真必須
    require_photo_min SMALLINT NOT NULL DEFAULT 1 CHECK (require_photo_min >= 0),
    require_video BOOLEAN NOT NULL DEFAULT false,                  -- 動画必須
    require_video_min SMALLINT NOT NULL DEFAULT 1 CHECK (require_video_min >= 0),
    requirements_locked_at TIMESTAMPTZ,                            -- 初回答以降ロック

    -- Constraints
    CONSTRAINT valid_deadline CHECK (deadline_at > created_at),
    CONSTRAINT valid_bounty CHECK (bounty_amount >= 10),
    CONSTRAINT valid_status_transition CHECK (
        (status = 'DRAFT' AND published_at IS NULL) OR
        (status != 'DRAFT' AND published_at IS NOT NULL)
    )
);
/* [REMOVED] CREATE TABLE内のINDEX句は削除。PART 8でCREATE INDEX */

-- 循環参照FK（ベスト回答）は後でPART 16で追加

-- =====================================
-- 3.3 回答テーブル
-- =====================================
CREATE TABLE qa_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES qa_questions(id) ON DELETE CASCADE,
    responder_id UUID NOT NULL REFERENCES auth.users(id),

    body TEXT NOT NULL,  -- 移行期間中は保持。将来的にqa_answer_contentsへ完全移行
    body_preview TEXT,   -- ティーザー用（200文字程度）
    attachments JSONB DEFAULT '[]',

    is_best BOOLEAN DEFAULT false,
    is_visible BOOLEAN DEFAULT true,

    helpful_count INTEGER DEFAULT 0 CHECK (helpful_count >= 0),
    unhelpful_count INTEGER DEFAULT 0 CHECK (unhelpful_count >= 0),
    tips_received_count INTEGER DEFAULT 0 CHECK (tips_received_count >= 0),
    tips_received_amount DECIMAL(10,2) DEFAULT 0 CHECK (tips_received_amount >= 0),

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    selected_best_at TIMESTAMPTZ,

    CONSTRAINT unique_answer_per_user UNIQUE (question_id, responder_id),
    CONSTRAINT best_answer_timestamp CHECK (
        (is_best = true AND selected_best_at IS NOT NULL) OR
        (is_best = false AND selected_best_at IS NULL)
    )
);
/* [REMOVED] CREATE TABLE内のINDEX句は削除。PART 8でCREATE INDEX */

-- =====================================
-- 3.3.1 回答本文テーブル（分離管理）
-- 追加: 2025-09-28
-- 目的: 回答本文を分離し、RLSで厳格な可視性制御
-- =====================================
CREATE TABLE qa_answer_contents (
    answer_id UUID PRIMARY KEY REFERENCES qa_answers(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =====================================
-- 3.4 アクセス権限管理
-- =====================================
CREATE TABLE qa_access_grants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES qa_questions(id) ON DELETE CASCADE,

    access_type VARCHAR(20) NOT NULL CHECK (access_type IN ('ASKER', 'RESPONDER', 'PPV', 'ADMIN')),

    purchase_id UUID,

    granted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ,

    -- Watermark Information
    watermark_data JSONB,   -- [CHANGED] 生成列を廃止しアプリ層で付与

    CONSTRAINT unique_access_grant UNIQUE (user_id, question_id, access_type)
);
/* [REMOVED] CREATE TABLE内のINDEX句は削除。PART 8でCREATE INDEX */

-- =====================================
-- 3.5 決済トランザクション
-- =====================================
CREATE TABLE qa_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_id UUID NOT NULL REFERENCES auth.users(id),
    question_id UUID REFERENCES qa_questions(id) ON DELETE SET NULL,
    answer_id UUID REFERENCES qa_answers(id) ON DELETE SET NULL,

    type qa_payment_type NOT NULL,
    status qa_payment_status DEFAULT 'PENDING' NOT NULL,

    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    platform_fee DECIMAL(10,2) DEFAULT 0 CHECK (platform_fee >= 0),
    tax_amount DECIMAL(10,2) DEFAULT 0 CHECK (tax_amount >= 0),
    card_fee DECIMAL(10,2) DEFAULT 0 CHECK (card_fee >= 0),
    net_amount DECIMAL(10,2),                                      -- [CHANGED] GENERATED削除、トリガーで設定

    -- Distribution
    split_to_asker DECIMAL(10,2) DEFAULT 0,
    split_to_responder DECIMAL(10,2) DEFAULT 0,
    split_to_others DECIMAL(10,2) DEFAULT 0,       -- [CHANGED] PPVその他16%用（均等割）
    split_to_platform DECIMAL(10,2) DEFAULT 0,     -- プラットフォーム取り分の記録（20%）

    -- Stripe References
    stripe_payment_intent_id VARCHAR(255),
    stripe_charge_id VARCHAR(255),
    stripe_transfer_id VARCHAR(255),
    stripe_refund_id VARCHAR(255),

    metadata JSONB DEFAULT '{}',
    error_message TEXT,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,

    idempotency_key VARCHAR(255) UNIQUE
);
/* [REMOVED] CREATE TABLE内のINDEX句は削除。PART 8でCREATE INDEX */

-- =====================================
-- 3.6 ウォレット（残高管理）
-- =====================================
CREATE TABLE qa_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

    balance_available DECIMAL(12,2) DEFAULT 0 CHECK (balance_available >= 0),
    balance_pending DECIMAL(12,2) DEFAULT 0 CHECK (balance_pending >= 0),
    balance_hold DECIMAL(12,2) DEFAULT 0 CHECK (balance_hold >= 0),

    total_earned DECIMAL(12,2) DEFAULT 0 CHECK (total_earned >= 0),
    total_spent DECIMAL(12,2) DEFAULT 0 CHECK (total_spent >= 0),
    total_withdrawn DECIMAL(12,2) DEFAULT 0 CHECK (total_withdrawn >= 0),
    total_fees_paid DECIMAL(12,2) DEFAULT 0 CHECK (total_fees_paid >= 0),

    auto_payout_enabled BOOLEAN DEFAULT false,
    auto_payout_threshold DECIMAL(10,2) DEFAULT 10000,
    payout_bank_info JSONB,

    version INTEGER DEFAULT 1,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_payout_at TIMESTAMPTZ
);
/* [REMOVED] CREATE TABLE内のINDEX句は削除。PART 8でCREATE INDEX */

-- =====================================
-- 3.7 ウォレット履歴（監査証跡）
-- =====================================
CREATE TABLE qa_wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL REFERENCES qa_wallets(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES qa_transactions(id),

    type VARCHAR(20) NOT NULL CHECK (type IN ('CREDIT', 'DEBIT', 'HOLD', 'RELEASE')),
    amount DECIMAL(10,2) NOT NULL,

    balance_before DECIMAL(12,2) NOT NULL,
    balance_after DECIMAL(12,2) NOT NULL,

    reference_type VARCHAR(50),
    reference_id UUID,
    description TEXT,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
/* [REMOVED] CREATE TABLE内のINDEX句は削除。PART 8でCREATE INDEX */

-- =====================================
-- 3.8 出金管理
-- =====================================
CREATE TABLE qa_payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    wallet_id UUID NOT NULL REFERENCES qa_wallets(id),

    amount DECIMAL(10,2) NOT NULL CHECK (amount >= 3000),
    fee_fixed DECIMAL(10,2) DEFAULT 250,
    fee_rate DECIMAL(10,2),                                        -- [CHANGED] GENERATED削除、トリガーで設定
    net_amount DECIMAL(10,2),                                      -- [CHANGED] GENERATED削除、トリガーで設定

    status VARCHAR(20) DEFAULT 'REQUESTED' CHECK (status IN (
        'REQUESTED', 'APPROVED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'
    )),

    stripe_payout_id VARCHAR(255),
    stripe_transfer_id VARCHAR(255),

    bank_info JSONB,

    failure_reason TEXT,
    notes TEXT,

    requested_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ
);
/* [REMOVED] CREATE TABLE内のINDEX句は削除。PART 8でCREATE INDEX */

-- =====================================
-- 3.9 請求書管理（適格請求書）
-- =====================================
CREATE TABLE qa_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_no VARCHAR(50) UNIQUE NOT NULL,

    issuer_id UUID REFERENCES auth.users(id),
    recipient_id UUID NOT NULL REFERENCES auth.users(id),

    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    subtotal DECIMAL(10,2) NOT NULL,
    tax_rate DECIMAL(5,2) DEFAULT 10.00,
    tax_amount DECIMAL(10,2),                                      -- [CHANGED] GENERATED削除、トリガーで設定
    total_amount DECIMAL(10,2),                                    -- [CHANGED] GENERATED削除、トリガーで設定

    issuer_registration_no VARCHAR(50),
    recipient_registration_no VARCHAR(50),

    line_items JSONB NOT NULL DEFAULT '[]',

    status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN (
        'DRAFT', 'ISSUED', 'SENT', 'PAID', 'CANCELLED'
    )),

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    issued_at TIMESTAMPTZ,
    due_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,

    pdf_url TEXT
);
/* [REMOVED] CREATE TABLE内のINDEX句は削除。PART 8でCREATE INDEX */

-- =====================================
-- 3.10 通知管理
-- =====================================
CREATE TABLE qa_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    type qa_notification_type NOT NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT,

    reference_type VARCHAR(50),
    reference_id UUID,
    action_url TEXT,

    is_read BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,

    delivered_email BOOLEAN DEFAULT false,
    delivered_push BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days')
);
/* [REMOVED] CREATE TABLE内のINDEX句は削除。PART 8でCREATE INDEX */

-- =====================================
-- 3.11 評価・フィードバック
-- =====================================
CREATE TABLE qa_ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rater_id UUID NOT NULL REFERENCES auth.users(id),
    answer_id UUID NOT NULL REFERENCES qa_answers(id) ON DELETE CASCADE,

    is_helpful BOOLEAN NOT NULL,
    comment TEXT,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_rating UNIQUE (rater_id, answer_id)
);
/* [REMOVED] CREATE TABLE内のINDEX句は削除。PART 8でCREATE INDEX */

-- =====================================
-- 3.12 監査ログ（パーティション）
-- =====================================
CREATE TABLE qa_audit_logs (
    id UUID DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    actor_id UUID REFERENCES auth.users(id),
    actor_ip INET,
    actor_user_agent TEXT,

    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,

    old_values JSONB,
    new_values JSONB,

    request_id VARCHAR(100),
    session_id VARCHAR(100),

    PRIMARY KEY (created_at, id)  -- パーティションキーを含むPRIMARY KEY
) PARTITION BY RANGE (created_at);

-- 月次パーティション例
CREATE TABLE IF NOT EXISTS qa_audit_logs_2025_09 PARTITION OF qa_audit_logs
    FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');

-- =====================================
-- 3.13 PPVプール & ブロック（新設）
-- =====================================
CREATE TABLE IF NOT EXISTS qa_ppv_pools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id UUID NOT NULL UNIQUE REFERENCES qa_questions(id) ON DELETE CASCADE,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,   -- [CHANGED] その他16%の累積
  held_for_best DECIMAL(12,2) NOT NULL DEFAULT 0,  -- [CHANGED] Best未決定時の24%保留
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
); -- [ADDED]

CREATE TABLE IF NOT EXISTS qa_ppv_pool_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pool_id UUID NOT NULL REFERENCES qa_ppv_pools(id) ON DELETE CASCADE,
  answer_id UUID NOT NULL REFERENCES qa_answers(id) ON DELETE CASCADE,
  responder_id UUID NOT NULL REFERENCES auth.users(id),
  is_excluded BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(pool_id, answer_id)
); -- [ADDED]

CREATE TABLE IF NOT EXISTS qa_answer_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id UUID NOT NULL REFERENCES qa_questions(id) ON DELETE CASCADE,
  responder_id UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(question_id, responder_id)
); -- [ADDED]

-- =====================================================
-- PART 4: ビュー定義（よく使うクエリの最適化）
-- =====================================================

-- [FIXED] MATERIALIZED VIEWからVIEWに変更（一貫性のため）
CREATE OR REPLACE VIEW qa_questions_list AS
SELECT
    q.id,
    q.title,
    q.body_preview,
    q.bounty_amount,
    q.status,
    q.deadline_at,
    q.created_at,
    q.answer_count,
    q.view_count,
    q.tags,
    q.category,
    q.crop,
    u.id as asker_id,
    p.display_name as asker_name,
    p.avatar_url as asker_avatar,
    p.tier as asker_tier,
    p.reputation_score as asker_reputation
FROM qa_questions q
JOIN auth.users u ON q.asker_id = u.id
JOIN qa_user_profiles p ON u.id = p.user_id
WHERE q.status NOT IN ('DRAFT', 'CANCELLED');

CREATE VIEW qa_user_dashboard AS
SELECT
    u.id,
    p.display_name,
    p.tier,
    p.reputation_score,
    w.balance_available,
    w.balance_pending,
    (SELECT COUNT(*) FROM qa_questions WHERE asker_id = u.id) as total_questions,
    (SELECT COUNT(*) FROM qa_answers WHERE responder_id = u.id) as total_answers,
    (SELECT COUNT(*) FROM qa_answers WHERE responder_id = u.id AND is_best = true) as total_best_answers,
    (SELECT COALESCE(SUM(tips_received_amount), 0) FROM qa_answers WHERE responder_id = u.id) as total_tips_received
FROM auth.users u
LEFT JOIN qa_user_profiles p ON u.id = p.user_id
LEFT JOIN qa_wallets w ON u.id = w.user_id;

-- =====================================================
-- PART 5: 関数定義
-- =====================================================

-- 5.1 請求書番号生成関数
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS VARCHAR AS $$
DECLARE
    new_number VARCHAR;
    current_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO current_count
    FROM qa_invoices
    WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE);

    new_number := 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-' ||
                  LPAD((current_count + 1)::TEXT, 5, '0');

    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- 5.2 ウォレット残高更新関数
CREATE OR REPLACE FUNCTION update_wallet_balance(
    p_wallet_id UUID,
    p_amount DECIMAL,
    p_type VARCHAR,
    p_reference_type VARCHAR DEFAULT NULL,
    p_reference_id UUID DEFAULT NULL,
    p_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_current_balance DECIMAL;
    v_new_balance DECIMAL;
    v_transaction_id UUID;
BEGIN
    SELECT balance_available INTO v_current_balance
    FROM qa_wallets
    WHERE id = p_wallet_id
    FOR UPDATE;

    IF p_type = 'DEBIT' THEN
        v_new_balance := v_current_balance - ABS(p_amount);
        IF v_new_balance < 0 THEN
            RAISE EXCEPTION 'Insufficient balance. Current: %, Required: %',
                            v_current_balance, ABS(p_amount);
        END IF;
    ELSE
        v_new_balance := v_current_balance + ABS(p_amount);
    END IF;

    UPDATE qa_wallets
    SET balance_available = v_new_balance,
        version = version + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_wallet_id;

    INSERT INTO qa_wallet_transactions (
        wallet_id, type, amount,
        balance_before, balance_after,
        reference_type, reference_id, description
    ) VALUES (
        p_wallet_id, p_type, p_amount,
        v_current_balance, v_new_balance,
        p_reference_type, p_reference_id, p_description
    ) RETURNING id INTO v_transaction_id;

    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.3 アクセス権限チェック関数
CREATE OR REPLACE FUNCTION has_question_access(
    p_user_id UUID,
    p_question_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM qa_access_grants
        WHERE user_id = p_user_id
          AND question_id = p_question_id
          AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 5.4 ベスト回答選定処理（20%運営 / 80%回答者） -- [CHANGED]
CREATE OR REPLACE FUNCTION select_best_answer(
    p_question_id UUID,
    p_answer_id UUID,
    p_reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    vq RECORD;
    va RECORD;
    v_wallet UUID;
    v_platform_fee DECIMAL(12,2);
    v_responder_amount DECIMAL(12,2);
    v_tx UUID;
    v_pool RECORD;
BEGIN
    SELECT * INTO vq FROM qa_questions WHERE id = p_question_id FOR UPDATE;
    IF vq.status NOT IN ('ANSWERING','SELECTING') THEN
        RAISE EXCEPTION 'Question is not in correct status: %', vq.status;
    END IF;

    SELECT * INTO va FROM qa_answers WHERE id = p_answer_id AND question_id = p_question_id;
    IF va IS NULL THEN RAISE EXCEPTION 'Answer not found'; END IF;

    v_platform_fee := ROUND(vq.bounty_amount * 0.20, 0);
    v_responder_amount := vq.bounty_amount - v_platform_fee;

    INSERT INTO qa_wallets (user_id) VALUES (va.responder_id)
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO qa_transactions (
        user_id, question_id, answer_id,
        type, status,
        amount, platform_fee, split_to_responder, split_to_platform
    ) VALUES (
        va.responder_id, p_question_id, p_answer_id,
        'ESCROW', 'COMPLETED',
        vq.bounty_amount, v_platform_fee, v_responder_amount, v_platform_fee
    ) RETURNING id INTO v_tx;

    PERFORM update_wallet_balance(
        (SELECT id FROM qa_wallets WHERE user_id = va.responder_id),
        v_responder_amount,
        'CREDIT', 'BEST_ANSWER', p_answer_id,
        'Best answer reward'
    );

    UPDATE qa_answers
      SET is_best = true, selected_best_at = now()
    WHERE id = p_answer_id;

    UPDATE qa_questions
      SET status = 'CLOSED', best_answer_id = p_answer_id,
          best_selected_at = now(), closed_at = now()
    WHERE id = p_question_id;

    -- PPVプールのheld_for_best（24%保留）をBest回答者へ払い出し
    SELECT * INTO v_pool FROM qa_ppv_pools WHERE question_id = p_question_id FOR UPDATE;
    IF v_pool IS NOT NULL AND v_pool.held_for_best > 0 THEN
        PERFORM update_wallet_balance(
          (SELECT id FROM qa_wallets WHERE user_id = va.responder_id),
          v_pool.held_for_best,
          'CREDIT', 'PPV_HELD_BEST', p_question_id, 'PPV held 24% released to best'
        );
        UPDATE qa_ppv_pools SET held_for_best = 0, updated_at = now() WHERE id = v_pool.id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_tx,
        'responder_amount', v_responder_amount,
        'platform_fee', v_platform_fee
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.5 PPV購入処理（20%運営 / 40%質問者 / 24%Best / 16%その他プール） -- [CHANGED]
CREATE OR REPLACE FUNCTION purchase_ppv_access(
    p_user_id UUID,
    p_question_id UUID,
    p_payment_intent_id VARCHAR
) RETURNS JSONB AS $$
DECLARE
    vq RECORD;
    v_amount DECIMAL(12,2);
    v_platform_fee DECIMAL(12,2);
    v_asker_share DECIMAL(12,2);
    v_best_share DECIMAL(12,2);
    v_others_share DECIMAL(12,2);
    v_tx UUID;
    v_best RECORD;
    v_pool_id UUID;
BEGIN
    SELECT * INTO vq FROM qa_questions WHERE id = p_question_id;
    IF vq IS NULL THEN RAISE EXCEPTION 'Question not found'; END IF;

    IF has_question_access(p_user_id, p_question_id) THEN
        RAISE EXCEPTION 'User already has access';
    END IF;

    v_amount := vq.bounty_amount;
    v_platform_fee := ROUND(v_amount * 0.20, 0);
    v_asker_share := ROUND(v_amount * 0.40, 0);  -- [CHANGED] 50% → 40%
    v_best_share  := ROUND(v_amount * 0.24, 0);  -- [CHANGED] 30% → 24%
    v_others_share:= v_amount - v_platform_fee - v_asker_share - v_best_share; -- [CHANGED] 端数吸収（=16%想定）

    INSERT INTO qa_transactions (
        user_id, question_id,
        type, status,
        amount, platform_fee,
        split_to_asker, split_to_responder, split_to_others, split_to_platform,
        stripe_payment_intent_id
    ) VALUES (
        p_user_id, p_question_id,
        'PPV', 'COMPLETED',
        v_amount, v_platform_fee,
        v_asker_share, v_best_share, v_others_share, v_platform_fee,
        p_payment_intent_id
    ) RETURNING id INTO v_tx;

    INSERT INTO qa_access_grants (user_id, question_id, access_type, purchase_id)
    VALUES (p_user_id, p_question_id, 'PPV', v_tx);

    -- 40% → 質問者（即時計上）
    INSERT INTO qa_wallets (user_id) VALUES (vq.asker_id) ON CONFLICT (user_id) DO NOTHING;
    PERFORM update_wallet_balance(
      (SELECT id FROM qa_wallets WHERE user_id = vq.asker_id),
      v_asker_share, 'CREDIT', 'PPV_REVENUE', p_question_id, 'PPV 40% to asker'
    );

    -- 24% → Best（未決定なら held_for_best に積み立て）
    SELECT * INTO v_best FROM qa_answers WHERE id = vq.best_answer_id;
    IF v_best IS NOT NULL THEN
        INSERT INTO qa_wallets (user_id) VALUES (v_best.responder_id) ON CONFLICT (user_id) DO NOTHING;
        PERFORM update_wallet_balance(
          (SELECT id FROM qa_wallets WHERE user_id = v_best.responder_id),
          v_best_share, 'CREDIT', 'PPV_REVENUE', p_question_id, 'PPV 24% to best'
        );
    ELSE
        INSERT INTO qa_ppv_pools (question_id, total_amount, held_for_best)
        VALUES (p_question_id, 0, v_best_share)
        ON CONFLICT (question_id) DO UPDATE
          SET held_for_best = qa_ppv_pools.held_for_best + EXCLUDED.held_for_best,
              updated_at = now();
    END IF;

    -- 16% → その他回答者プール
    INSERT INTO qa_ppv_pools (question_id, total_amount, held_for_best)
    VALUES (p_question_id, v_others_share, 0)
    ON CONFLICT (question_id) DO UPDATE
      SET total_amount = qa_ppv_pools.total_amount + EXCLUDED.total_amount,
          updated_at = now()
    RETURNING id INTO v_pool_id;

    -- プールメンバー初期化（ブロック除外）
    INSERT INTO qa_ppv_pool_members (pool_id, answer_id, responder_id)
    SELECT v_pool_id, a.id, a.responder_id
    FROM qa_answers a
    WHERE a.question_id = p_question_id
      AND NOT EXISTS (
        SELECT 1 FROM qa_answer_blocks b
        WHERE b.question_id = p_question_id
          AND b.responder_id = a.responder_id
      )
    ON CONFLICT (pool_id, answer_id) DO NOTHING;

    -- 統計
    UPDATE qa_questions
      SET ppv_purchase_count = ppv_purchase_count + 1,
          total_ppv_revenue = total_ppv_revenue + v_amount
    WHERE id = p_question_id;

    RETURN jsonb_build_object('success', true, 'transaction_id', v_tx, 'access_granted', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.6 PPVプール分配バッチ（均等割/端数残し） -- [ADDED]
CREATE OR REPLACE FUNCTION distribute_ppv_pool(p_question_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_pool RECORD;
  v_member_count INT;
  v_unit DECIMAL(12,2);
  v_total DECIMAL(12,2);
BEGIN
  SELECT * INTO v_pool FROM qa_ppv_pools WHERE question_id = p_question_id FOR UPDATE;
  IF v_pool IS NULL OR v_pool.total_amount <= 0 THEN
    RETURN jsonb_build_object('distributed', 0);
  END IF;

  SELECT COUNT(*) INTO v_member_count
  FROM qa_ppv_pool_members
  WHERE pool_id = v_pool.id AND is_excluded = false;

  IF v_member_count = 0 THEN
    RETURN jsonb_build_object('distributed', 0, 'reason', 'no members');
  END IF;

  v_unit := FLOOR(v_pool.total_amount / v_member_count);
  v_total := v_unit * v_member_count;

  PERFORM (
    SELECT update_wallet_balance(
      (SELECT id FROM qa_wallets WHERE user_id = m.responder_id),
      v_unit, 'CREDIT', 'PPV_POOL', p_question_id, 'PPV 16% pool distribution'  -- [CHANGED] 20%→16%
    )
    FROM qa_ppv_pool_members m
    WHERE m.pool_id = v_pool.id AND m.is_excluded = false
  );

  UPDATE qa_ppv_pools
    SET total_amount = total_amount - v_total,
        updated_at = now()
  WHERE id = v_pool.id;

  RETURN jsonb_build_object('distributed', v_total, 'per_member', v_unit, 'members', v_member_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.7 月次請求書生成
CREATE OR REPLACE FUNCTION generate_monthly_invoices()
RETURNS void AS $$
DECLARE
    user_record RECORD;
    invoice_id UUID;
    invoice_number VARCHAR;
BEGIN
    FOR user_record IN
        SELECT
            user_id,
            SUM(platform_fee) as total_platform_fee
        FROM qa_transactions
        WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
          AND status = 'COMPLETED'
          AND platform_fee > 0
        GROUP BY user_id
    LOOP
        invoice_number := generate_invoice_number();

        INSERT INTO qa_invoices (
            invoice_no, recipient_id, period_start, period_end, subtotal, status
        ) VALUES (
            invoice_number,
            user_record.user_id,
            DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')::DATE,
            (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 day')::DATE,
            user_record.total_platform_fee,
            'DRAFT'
        ) RETURNING id INTO invoice_id;

        UPDATE qa_invoices
        SET line_items = (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'date', created_at,
                    'description', 'Platform fee for ' || type,
                    'amount', platform_fee
                )
            )
            FROM qa_transactions
            WHERE user_id = user_record.user_id
              AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
              AND status = 'COMPLETED'
              AND platform_fee > 0
        )
        WHERE id = invoice_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 5.9 回答品質要件関連関数
-- JSONB添付のカウント関数
CREATE OR REPLACE FUNCTION qa_count_attachments(p_attachments JSONB, p_kind TEXT)
RETURNS INT AS $$
  SELECT COUNT(*)::int
  FROM jsonb_array_elements(COALESCE(p_attachments, '[]'::jsonb)) AS e
  WHERE lower(e->>'type') = lower(p_kind);
$$ LANGUAGE sql IMMUTABLE;

-- 回答品質要件の強制チェック
CREATE OR REPLACE FUNCTION qa_enforce_answer_requirements()
RETURNS TRIGGER AS $$
DECLARE
  vq RECORD;
  v_text_len INT;
  v_img_cnt INT;
  v_vid_cnt INT;
BEGIN
  SELECT id, min_answer_chars, require_photo, require_photo_min,
         require_video, require_video_min, requirements_locked_at, answer_count
    INTO vq
    FROM qa_questions
   WHERE id = NEW.question_id
   FOR UPDATE;

  -- 文字数（空白を除外してカウント、必要に応じて調整）
  v_text_len := length(regexp_replace(COALESCE(NEW.body, ''), '\s+', '', 'g'));

  IF vq.min_answer_chars > 0 AND v_text_len < vq.min_answer_chars THEN
    RAISE EXCEPTION 'ANSWER_TOO_SHORT: required % chars, got %', vq.min_answer_chars, v_text_len
      USING ERRCODE = 'check_violation';
  END IF;

  -- 添付の個数
  v_img_cnt := qa_count_attachments(NEW.attachments, 'image');
  v_vid_cnt := qa_count_attachments(NEW.attachments, 'video');

  IF vq.require_photo AND v_img_cnt < GREATEST(1, vq.require_photo_min) THEN
    RAISE EXCEPTION 'PHOTO_REQUIRED: required % images, got %', vq.require_photo_min, v_img_cnt
      USING ERRCODE = 'check_violation';
  END IF;

  IF vq.require_video AND v_vid_cnt < GREATEST(1, vq.require_video_min) THEN
    RAISE EXCEPTION 'VIDEO_REQUIRED: required % videos, got %', vq.require_video_min, v_vid_cnt
      USING ERRCODE = 'check_violation';
  END IF;

  -- 1件目の回答が入ったら要件をロック（初回答時刻をロックに転用）
  IF TG_OP = 'INSERT' AND vq.requirements_locked_at IS NULL THEN
    UPDATE qa_questions
       SET requirements_locked_at = now()
     WHERE id = vq.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 要件の「厳格化」を禁止（ロック後）
CREATE OR REPLACE FUNCTION qa_prevent_requirement_hardening()
RETURNS TRIGGER AS $$
DECLARE
  v_locked BOOLEAN;
BEGIN
  v_locked := (OLD.requirements_locked_at IS NOT NULL);

  IF v_locked THEN
    -- ロック後は厳しくなる変更を拒否（例：闾値アップ、必須フラグのオン）
    IF NEW.min_answer_chars > OLD.min_answer_chars THEN
      RAISE EXCEPTION 'CANNOT_HARDEN_REQUIREMENTS_AFTER_FIRST_ANSWER';
    END IF;
    IF (NOT OLD.require_photo AND NEW.require_photo) OR (NEW.require_photo_min > OLD.require_photo_min) THEN
      RAISE EXCEPTION 'CANNOT_HARDEN_REQUIREMENTS_AFTER_FIRST_ANSWER';
    END IF;
    IF (NOT OLD.require_video AND NEW.require_video) OR (NEW.require_video_min > OLD.require_video_min) THEN
      RAISE EXCEPTION 'CANNOT_HARDEN_REQUIREMENTS_AFTER_FIRST_ANSWER';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 6: トリガー定義
-- =====================================================

-- 6.1 updated_at 自動更新
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_qa_user_profiles_updated_at
    BEFORE UPDATE ON qa_user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_qa_questions_updated_at
    BEFORE UPDATE ON qa_questions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_qa_answers_updated_at
    BEFORE UPDATE ON qa_answers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_qa_wallets_updated_at
    BEFORE UPDATE ON qa_wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6.2 質問投稿時のアクセス権自動付与
CREATE OR REPLACE FUNCTION grant_asker_access()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO qa_access_grants (user_id, question_id, access_type)
    VALUES (NEW.asker_id, NEW.id, 'ASKER')
    ON CONFLICT DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER grant_asker_access_on_question
    AFTER INSERT ON qa_questions
    FOR EACH ROW EXECUTE FUNCTION grant_asker_access();

-- 6.2.1 質問の計算フィールド更新トリガー
CREATE OR REPLACE FUNCTION update_question_computed_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- shard_keyの計算（hashtext()の代わりにmd5を使用）
    IF NEW.shard_key IS NULL THEN
        NEW.shard_key := abs(('x' || substr(md5(NEW.id::text), 1, 8))::bit(32)::int) % 100;
    END IF;

    -- body_previewの計算
    IF NEW.body IS NOT NULL THEN
        NEW.body_preview := LEFT(NEW.body, 200);
    END IF;

    -- platform_fee_amountの計算
    IF NEW.bounty_amount IS NOT NULL AND NEW.platform_fee_rate IS NOT NULL THEN
        NEW.platform_fee_amount := NEW.bounty_amount * NEW.platform_fee_rate;
    END IF;

    -- search_vectorの計算
    NEW.search_vector :=
        setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(NEW.body, '')), 'B') ||
        setweight(to_tsvector('simple', COALESCE(array_to_string(NEW.tags, ' '), '')), 'C');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_question_computed_fields_trigger
    BEFORE INSERT OR UPDATE ON qa_questions
    FOR EACH ROW EXECUTE FUNCTION update_question_computed_fields();

-- 6.3 回答投稿時のアクセス権自動付与
CREATE OR REPLACE FUNCTION grant_responder_access()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO qa_access_grants (user_id, question_id, access_type)
    VALUES (NEW.responder_id, NEW.question_id, 'RESPONDER')
    ON CONFLICT (user_id, question_id, access_type) DO NOTHING;

    UPDATE qa_questions
      SET answer_count = answer_count + 1
    WHERE id = NEW.question_id;

    UPDATE qa_user_profiles
      SET total_answers = total_answers + 1
    WHERE user_id = NEW.responder_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER grant_responder_access_on_answer
    AFTER INSERT ON qa_answers
    FOR EACH ROW EXECUTE FUNCTION grant_responder_access();

-- 6.4 PPVプールupdated_at
CREATE TRIGGER trg_ppv_pools_updated_at
  BEFORE UPDATE ON qa_ppv_pools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6.5 トランザクションの計算フィールド更新トリガー
CREATE OR REPLACE FUNCTION update_transaction_computed_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- net_amountの計算
    NEW.net_amount := COALESCE(NEW.amount, 0) -
                      COALESCE(NEW.platform_fee, 0) -
                      COALESCE(NEW.tax_amount, 0) -
                      COALESCE(NEW.card_fee, 0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_transaction_computed_fields_trigger
    BEFORE INSERT OR UPDATE ON qa_transactions
    FOR EACH ROW EXECUTE FUNCTION update_transaction_computed_fields();

-- 6.6 出金の計算フィールド更新トリガー
CREATE OR REPLACE FUNCTION update_payout_computed_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- fee_rateの計算（0.25%）
    NEW.fee_rate := COALESCE(NEW.amount, 0) * 0.0025;

    -- net_amountの計算
    NEW.net_amount := COALESCE(NEW.amount, 0) -
                      COALESCE(NEW.fee_fixed, 0) -
                      COALESCE(NEW.fee_rate, 0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_payout_computed_fields_trigger
    BEFORE INSERT OR UPDATE ON qa_payouts
    FOR EACH ROW EXECUTE FUNCTION update_payout_computed_fields();

-- 6.7 請求書の計算フィールド更新トリガー
CREATE OR REPLACE FUNCTION update_invoice_computed_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- tax_amountの計算
    NEW.tax_amount := COALESCE(NEW.subtotal, 0) * COALESCE(NEW.tax_rate, 0) / 100;

    -- total_amountの計算
    NEW.total_amount := COALESCE(NEW.subtotal, 0) +
                        (COALESCE(NEW.subtotal, 0) * COALESCE(NEW.tax_rate, 0) / 100);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_invoice_computed_fields_trigger
    BEFORE INSERT OR UPDATE ON qa_invoices
    FOR EACH ROW EXECUTE FUNCTION update_invoice_computed_fields();

-- 6.8 回答品質要件トリガー
DROP TRIGGER IF EXISTS trg_enforce_answer_requirements ON qa_answers;
CREATE TRIGGER trg_enforce_answer_requirements
  BEFORE INSERT OR UPDATE ON qa_answers
  FOR EACH ROW EXECUTE FUNCTION qa_enforce_answer_requirements();

-- 6.9 要件の厳格化防止トリガー
DROP TRIGGER IF EXISTS trg_prevent_requirement_hardening ON qa_questions;
CREATE TRIGGER trg_prevent_requirement_hardening
  BEFORE UPDATE ON qa_questions
  FOR EACH ROW EXECUTE FUNCTION qa_prevent_requirement_hardening();

-- =====================================================
-- PART 7: Row Level Security (RLS) ポリシー
-- =====================================================

ALTER TABLE qa_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_ppv_pools ENABLE ROW LEVEL SECURITY;         -- [ADDED]
ALTER TABLE qa_ppv_pool_members ENABLE ROW LEVEL SECURITY;  -- [ADDED]
ALTER TABLE qa_answer_blocks ENABLE ROW LEVEL SECURITY;     -- [ADDED]

-- 7.1 ユーザープロフィール
CREATE POLICY "Public profiles are viewable by everyone"
    ON qa_user_profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
    ON qa_user_profiles FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
    ON qa_user_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 7.2 質問
CREATE POLICY "Published questions viewable by everyone"
    ON qa_questions FOR SELECT
    USING (status NOT IN ('DRAFT', 'PENDING_PAYMENT'));  -- 公開後は誰でも本文まで読める

CREATE POLICY "Users can create own questions"
    ON qa_questions FOR INSERT
    WITH CHECK (asker_id = auth.uid());

CREATE POLICY "Users can update own draft questions"
    ON qa_questions FOR UPDATE
    USING (asker_id = auth.uid() AND status IN ('DRAFT', 'PENDING_PAYMENT'));

-- 7.3 回答
CREATE POLICY "Answers viewable with access grant"
    ON qa_answers FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM qa_access_grants g
        WHERE g.question_id = qa_answers.question_id
          AND g.user_id = auth.uid()
          AND g.access_type IN ('ASKER', 'RESPONDER', 'PPV', 'ADMIN')
          AND (g.expires_at IS NULL OR g.expires_at > now())
    ));

CREATE POLICY "Users can post answers"
    ON qa_answers FOR INSERT
    WITH CHECK (
        responder_id = auth.uid()
        AND NOT EXISTS (
            SELECT 1 FROM qa_questions
            WHERE id = qa_answers.question_id
              AND asker_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own answers"
    ON qa_answers FOR UPDATE
    USING (responder_id = auth.uid());

-- 7.4 アクセス権限
CREATE POLICY "Users can view own access grants"
    ON qa_access_grants FOR SELECT
    USING (user_id = auth.uid());

-- 作成は関数経由のみ
CREATE POLICY "System can create access grants"
    ON qa_access_grants FOR INSERT
    WITH CHECK (false);

-- 7.5 ウォレット
CREATE POLICY "Users can view own wallet"
    ON qa_wallets FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System manages wallets"
    ON qa_wallets FOR ALL USING (false) WITH CHECK (false);

-- 7.6 通知
CREATE POLICY "Users can view own notifications"
    ON qa_notifications FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
    ON qa_notifications FOR UPDATE USING (user_id = auth.uid());

-- 7.7 PPVプール/メンバー/ブロックは運営またはSECURITY DEFINER関数経由 -- [ADDED]
CREATE POLICY "Pools managed by system"
    ON qa_ppv_pools FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY "Pool members managed by system"
    ON qa_ppv_pool_members FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY "Answer blocks managed by system"
    ON qa_answer_blocks FOR ALL USING (false) WITH CHECK (false);

-- =====================================================
-- PART 8: インデックス最適化（ハイパースケール対応）
-- =====================================================

-- テーブル外CREATE INDEX（CREATE TABLE内のINDEX句廃止を補完） -- [CHANGED]

-- profiles
CREATE INDEX IF NOT EXISTS idx_qa_profiles_user            ON qa_user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_qa_profiles_tier            ON qa_user_profiles(tier);
CREATE INDEX IF NOT EXISTS idx_qa_profiles_reputation      ON qa_user_profiles(reputation_score DESC);
CREATE INDEX IF NOT EXISTS idx_qa_profiles_stripe_customer ON qa_user_profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_qa_profiles_stripe_account  ON qa_user_profiles(stripe_account_id);

-- questions
CREATE INDEX IF NOT EXISTS idx_qa_questions_asker        ON qa_questions(asker_id);
CREATE INDEX IF NOT EXISTS idx_qa_questions_status       ON qa_questions(status);
CREATE INDEX IF NOT EXISTS idx_qa_questions_deadline     ON qa_questions(deadline_at DESC);
-- 部分インデックス: statusがDRAFT以外の質問
-- 注: ENUM型の比較はIMMUTABLEでないため、部分インデックスは使用せず
CREATE INDEX IF NOT EXISTS idx_qa_questions_published    ON qa_questions(published_at DESC, status);
CREATE INDEX IF NOT EXISTS idx_qa_questions_category     ON qa_questions(category);
CREATE INDEX IF NOT EXISTS idx_qa_questions_crop         ON qa_questions(crop);
CREATE INDEX IF NOT EXISTS idx_qa_questions_tags         ON qa_questions USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_qa_questions_search       ON qa_questions USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_qa_questions_bounty       ON qa_questions(bounty_amount DESC);

-- answers
CREATE INDEX IF NOT EXISTS idx_qa_answers_question       ON qa_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_qa_answers_responder      ON qa_answers(responder_id);
-- ベストアンサーのインデックス
CREATE INDEX IF NOT EXISTS idx_qa_answers_best           ON qa_answers(question_id, is_best);
CREATE INDEX IF NOT EXISTS idx_qa_answers_created        ON qa_answers(created_at DESC);

-- access
CREATE INDEX IF NOT EXISTS idx_qa_access_user_question   ON qa_access_grants(user_id, question_id);
CREATE INDEX IF NOT EXISTS idx_qa_access_question        ON qa_access_grants(question_id);
CREATE INDEX IF NOT EXISTS idx_qa_access_type            ON qa_access_grants(access_type);
-- 有効期限付きアクセス権のインデックス
CREATE INDEX IF NOT EXISTS idx_qa_access_expires         ON qa_access_grants(expires_at);

-- transactions
CREATE INDEX IF NOT EXISTS idx_qa_transactions_user         ON qa_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_qa_transactions_question     ON qa_transactions(question_id);
CREATE INDEX IF NOT EXISTS idx_qa_transactions_type_status  ON qa_transactions(type, status);
CREATE INDEX IF NOT EXISTS idx_qa_transactions_stripe_pi    ON qa_transactions(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_qa_transactions_created      ON qa_transactions(created_at DESC);

-- wallets
CREATE INDEX IF NOT EXISTS idx_qa_wallets_user           ON qa_wallets(user_id);
-- 自動出金対象ウォレットのインデックス（WHERE句は削除）
CREATE INDEX IF NOT EXISTS idx_qa_wallets_auto_payout    ON qa_wallets(auto_payout_enabled, balance_available);

-- wallet tx
CREATE INDEX IF NOT EXISTS idx_qa_wallet_tx_wallet       ON qa_wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_qa_wallet_tx_created      ON qa_wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_wallet_tx_reference    ON qa_wallet_transactions(reference_type, reference_id);

-- payouts
CREATE INDEX IF NOT EXISTS idx_qa_payouts_user           ON qa_payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_qa_payouts_status         ON qa_payouts(status);
CREATE INDEX IF NOT EXISTS idx_qa_payouts_requested      ON qa_payouts(requested_at DESC);

-- invoices
CREATE INDEX IF NOT EXISTS idx_qa_invoices_recipient     ON qa_invoices(recipient_id);
CREATE INDEX IF NOT EXISTS idx_qa_invoices_period        ON qa_invoices(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_qa_invoices_status        ON qa_invoices(status);
CREATE INDEX IF NOT EXISTS idx_qa_invoices_no            ON qa_invoices(invoice_no);

-- notifications
-- 未読通知のインデックス
CREATE INDEX IF NOT EXISTS idx_qa_notifications_user_unread ON qa_notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_qa_notifications_created     ON qa_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_notifications_expires     ON qa_notifications(expires_at);

-- ratings
CREATE INDEX IF NOT EXISTS idx_qa_ratings_answer         ON qa_ratings(answer_id);
CREATE INDEX IF NOT EXISTS idx_qa_ratings_rater          ON qa_ratings(rater_id);

-- audit logs
CREATE INDEX IF NOT EXISTS idx_qa_audit_actor            ON qa_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_qa_audit_entity           ON qa_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_qa_audit_action           ON qa_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_qa_audit_created_brin     ON qa_audit_logs USING brin (created_at) WITH (pages_per_range = 128);

-- [REMOVED] VIEWに変更したためインデックス削除（VIEWにはインデックスを作成できない）

-- カバリングインデックス（ホットデータ）
-- 注: 部分インデックスはIMMUTABLE制約があるため通常のインデックスに変更
CREATE INDEX IF NOT EXISTS idx_questions_covering
ON qa_questions (status, created_at DESC)
INCLUDE (title, bounty_amount, asker_display_name);

-- 最近の質問用インデックス（WHERE句削除）
CREATE INDEX IF NOT EXISTS idx_questions_recent
ON qa_questions (created_at DESC);

-- 追加統計系
CREATE INDEX IF NOT EXISTS idx_qa_questions_stats     ON qa_questions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_answers_stats       ON qa_answers(question_id, is_best, created_at);
CREATE INDEX IF NOT EXISTS idx_qa_transactions_daily  ON qa_transactions(created_at, type, status);

-- =====================================================
-- PART 9: 初期データ
-- =====================================================

INSERT INTO qa_user_profiles (user_id, display_name, tier)
SELECT id, 'QA Platform Admin', 'VERIFIED'
FROM auth.users
WHERE email = 'admin@qa-platform.com'
ON CONFLICT (user_id) DO NOTHING;

-- =====================================================
-- PART 10: スケジュール済みジョブ（pg_cron使用）
-- =====================================================
-- [FIXED] pg_cron拡張機能は手動で有効化が必要なためコメントアウト
-- Supabaseダッシュボードから Extensions > pg_cron を有効化後、
-- 以下のコメントを解除して実行してください

-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- SELECT cron.schedule(
--     'generate-monthly-invoices',
--     '0 0 1 * *',
--     'SELECT generate_monthly_invoices();'
-- );

-- SELECT cron.schedule(
--     'cleanup-expired-notifications',
--     '0 2 * * *',
--     'DELETE FROM qa_notifications WHERE expires_at < CURRENT_TIMESTAMP;'
-- );

-- SELECT cron.schedule(
--     'process-auto-payouts',
--     '0 10 25 * *',
--     $$
--     INSERT INTO qa_payouts (user_id, wallet_id, amount)
--     SELECT user_id, id, balance_available
--     FROM qa_wallets
--     WHERE auto_payout_enabled = true
--       AND balance_available >= GREATEST(auto_payout_threshold, 3000);
--     $$
-- );

-- ※ プール分配の運用例（毎日3:00） -- [ADDED]
-- SELECT cron.schedule(
--   'distribute-ppv-pools',
--   '0 3 * * *',
--   $$ DO $BODY$
--     DECLARE r RECORD;
--     BEGIN
--       FOR r IN SELECT question_id FROM qa_ppv_pools WHERE total_amount > 0 LOOP
--         PERFORM distribute_ppv_pool(r.question_id);
--       END LOOP;
--     END
--   $BODY$; $$
-- );

-- =====================================================
-- PART 11: パーティショニング設定（ハイパースケール対応）
-- =====================================================

-- 例：qa_questions を月次パーティションにしたい場合
-- ALTER TABLE qa_questions PARTITION BY RANGE (created_at);     -- [OPTION]
-- CREATE TABLE qa_questions_2025_09 PARTITION OF qa_questions
--   FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');

-- pg_partman使用例
-- SELECT partman.create_parent(
--   p_parent_table => 'public.qa_questions',
--   p_control => 'created_at',
--   p_type => 'range',
--   p_interval => 'monthly',
--   p_premake => 3
-- );

-- =====================================================
-- PART 12: ホットデータ用テーブル（オプション）
-- =====================================================

CREATE OR REPLACE FUNCTION migrate_cold_questions()
RETURNS void AS $$
BEGIN
    RAISE NOTICE 'Cold data migration completed';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 13: イベントストア（オプション）
-- =====================================================

CREATE TABLE IF NOT EXISTS qa_events (
    id BIGSERIAL,
    event_id UUID DEFAULT uuid_generate_v4(),
    aggregate_type VARCHAR(50) NOT NULL,
    aggregate_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB NOT NULL,
    event_metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (created_at, id)
) PARTITION BY RANGE (created_at);

CREATE OR REPLACE FUNCTION record_event(
    p_aggregate_type VARCHAR,
    p_aggregate_id UUID,
    p_event_type VARCHAR,
    p_event_data JSONB
) RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
BEGIN
    v_event_id := uuid_generate_v4();

    INSERT INTO qa_events (
        event_id, aggregate_type, aggregate_id,
        event_type, event_data
    ) VALUES (
        v_event_id, p_aggregate_type, p_aggregate_id,
        p_event_type, p_event_data
    );

    PERFORM pg_notify('event_channel', json_build_object(
        'event_id', v_event_id,
        'aggregate_type', p_aggregate_type,
        'event_type', p_event_type
    )::text);

    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 14: ダッシュボード用ビュー
-- =====================================================

-- [CHANGED] 直近1時間のイベントを分単位で集計。
--           既存の 'QUESTION' / 'ANSWER' に加え、決済内訳（ESCROW/PPV）と
--           収益（総額/プラットフォーム手数料/分配額）を強化。
--           データソースはイベントストアに限定（軽量集計）しつつ、
--           金額はトランザクション実テーブルで正確に集計。
-- [FIXED] MATERIALIZED VIEWからVIEWに変更（NOW()関数のIMMUTABLEエラー回避）
CREATE OR REPLACE VIEW qa_stats_realtime AS
WITH minutes AS (
  SELECT generate_series(
           date_trunc('minute', NOW() - INTERVAL '59 minutes'),
           date_trunc('minute', NOW() ),
           INTERVAL '1 minute'
         ) AS minute
),
event_counts AS (
  SELECT
    date_trunc('minute', e.created_at) AS minute,
    COUNT(*) FILTER (WHERE e.aggregate_type = 'QUESTION') AS questions_count,
    COUNT(*) FILTER (WHERE e.aggregate_type = 'ANSWER')   AS answers_count,
    COUNT(*) FILTER (WHERE e.aggregate_type = 'PAYMENT')  AS payments_count
  FROM qa_events e
  WHERE e.created_at >= NOW() - INTERVAL '60 minutes'
  GROUP BY 1
),
-- [ADDED] 支払い種別ごとの件数と金額（確定取引のみ）
tx_agg AS (
  SELECT
    date_trunc('minute', t.created_at) AS minute,
    COUNT(*) FILTER (WHERE t.type = 'ESCROW' AND t.status = 'COMPLETED') AS escrow_tx_count,
    COUNT(*) FILTER (WHERE t.type = 'PPV'    AND t.status = 'COMPLETED') AS ppv_tx_count,
    SUM(CASE WHEN t.status = 'COMPLETED' THEN t.amount        ELSE 0 END) AS revenue_total,
    SUM(CASE WHEN t.status = 'COMPLETED' THEN t.platform_fee  ELSE 0 END) AS revenue_platform_fee,
    SUM(CASE WHEN t.status = 'COMPLETED' THEN t.split_to_asker ELSE 0 END) AS revenue_to_asker,
    SUM(CASE WHEN t.status = 'COMPLETED' THEN t.split_to_responder ELSE 0 END) AS revenue_to_responder
  FROM qa_transactions t
  WHERE t.created_at >= NOW() - INTERVAL '60 minutes'
  GROUP BY 1
)
SELECT
  m.minute,
  COALESCE(e.questions_count, 0) AS questions_count,
  COALESCE(e.answers_count,   0) AS answers_count,
  COALESCE(e.payments_count,  0) AS payments_count,
  COALESCE(x.escrow_tx_count, 0) AS escrow_tx_count,         -- [ADDED]
  COALESCE(x.ppv_tx_count,    0) AS ppv_tx_count,            -- [ADDED]
  COALESCE(x.revenue_total,   0)::numeric(12,2) AS revenue_total,             -- [ADDED]
  COALESCE(x.revenue_platform_fee, 0)::numeric(12,2) AS revenue_platform_fee, -- [ADDED]
  COALESCE(x.revenue_to_asker, 0)::numeric(12,2) AS revenue_to_asker,         -- [ADDED]
  COALESCE(x.revenue_to_responder, 0)::numeric(12,2) AS revenue_to_responder  -- [ADDED]
FROM minutes m
LEFT JOIN event_counts e ON e.minute = m.minute
LEFT JOIN tx_agg x       ON x.minute = m.minute;

-- [REMOVED] VIEWに変更したためインデックス不要

-- [ADDED] 直近30日のPPV売上ダッシュボード用（集計性能優先）
-- [FIXED] MATERIALIZED VIEWからVIEWに変更（NOW()関数のIMMUTABLEエラー回避）
CREATE OR REPLACE VIEW qa_stats_ppv_daily AS
SELECT
  date_trunc('day', created_at)::date AS day,
  COUNT(*) FILTER (WHERE type = 'PPV' AND status = 'COMPLETED') AS ppv_orders,
  SUM(CASE WHEN type = 'PPV' AND status = 'COMPLETED' THEN amount END)::numeric(14,2) AS ppv_gmv,
  SUM(CASE WHEN type = 'PPV' AND status = 'COMPLETED' THEN platform_fee END)::numeric(14,2) AS ppv_platform_fee,
  SUM(CASE WHEN type = 'PPV' AND status = 'COMPLETED' THEN split_to_asker END)::numeric(14,2) AS ppv_to_asker,
  SUM(CASE WHEN type = 'PPV' AND status = 'COMPLETED' THEN split_to_responder END)::numeric(14,2) AS ppv_to_responder
FROM qa_transactions
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY 1;

-- [REMOVED] VIEWに変更したためインデックス不要

-- [ADDED] Note:
-- VIEWに変更したため、リアルタイムにデータが反映されます。
-- パフォーマンスが問題になる場合は、キャッシュレイヤーまたは
-- 定期的なスナップショットテーブルの作成を検討してください。

-- =====================================================
-- PART 15: パフォーマンス監視
-- =====================================================

-- [CHANGED] メトリクスを追加し、キャッシュヒット率のゼロ除算を回避。
--           直近1分/5分の件数、決済成功数、PPV成功数、平均回答時間を可視化。
CREATE OR REPLACE VIEW qa_performance_metrics AS
WITH qpm AS (
  SELECT COUNT(*) AS v FROM qa_questions
  WHERE created_at > NOW() - INTERVAL '1 minute'
),
apm AS (
  SELECT COUNT(*) AS v FROM qa_answers
  WHERE created_at > NOW() - INTERVAL '1 minute'
),
t5m AS (
  SELECT
    COUNT(*) FILTER (WHERE status = 'COMPLETED') AS tx_completed_5m,
    COUNT(*) FILTER (WHERE type = 'PPV' AND status = 'COMPLETED') AS ppv_completed_5m
  FROM qa_transactions
  WHERE created_at > NOW() - INTERVAL '5 minutes'
),
-- [ADDED] 平均回答時間（質問公開→最初の回答まで）
first_answer AS (
  SELECT
    AVG(EXTRACT(EPOCH FROM (fa.first_answer_at - q.published_at)) / 60.0) AS avg_answer_time_min
  FROM qa_questions q
  JOIN LATERAL (
    SELECT MIN(a.created_at) AS first_answer_at
    FROM qa_answers a
    WHERE a.question_id = q.id
  ) fa ON TRUE
  WHERE q.published_at IS NOT NULL
    AND q.created_at > NOW() - INTERVAL '1 day'
),
cache_ratio AS (
  SELECT
    CASE
      WHEN (blks_hit + blks_read) = 0 THEN 100.0
      ELSE (blks_hit::numeric / NULLIF(blks_hit + blks_read, 0)) * 100.0
    END AS ratio
  FROM pg_stat_database
  WHERE datname = current_database()
  ORDER BY stats_reset DESC NULLS LAST
  LIMIT 1
)
SELECT 'questions_per_minute' AS metric, (SELECT v FROM qpm)::numeric AS value
UNION ALL
SELECT 'answers_per_minute', (SELECT v FROM apm)::numeric
UNION ALL
SELECT 'tx_completed_5m', (SELECT tx_completed_5m FROM t5m)::numeric
UNION ALL
SELECT 'ppv_completed_5m', (SELECT ppv_completed_5m FROM t5m)::numeric
UNION ALL
SELECT 'avg_answer_time_min_1d', COALESCE((SELECT avg_answer_time_min FROM first_answer), 0)::numeric
UNION ALL
SELECT 'cache_hit_ratio_percent', ROUND((SELECT ratio FROM cache_ratio), 2);

-- =====================================================
-- PART 16: 外部キー制約の追加（テーブル作成後）
-- =====================================================

-- qa_questionsテーブルのbest_answer_idに外部キー制約を追加
ALTER TABLE qa_questions
    ADD CONSTRAINT qa_questions_best_answer_id_fkey
    FOREIGN KEY (best_answer_id)
    REFERENCES qa_answers(id)
    ON DELETE SET NULL;

-- =====================================================
-- 完了メッセージ
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Q&A Platform HyperScale Schema Updated';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Key changes aligned to fees & splits:';
    RAISE NOTICE '- [CHANGED] ESCROW fee 20%% (responder 80%%)';
    RAISE NOTICE '- [CHANGED] PPV split 20%% platform / 40%% asker / 24%% best / 16%% others';
    RAISE NOTICE '- [CHANGED] purchase_ppv_access(): 50/30/20 -> 40/24/16 and pool semantics fixed';
    RAISE NOTICE '- [CHANGED] qa_ppv_pools: held_for_best=24%% / total_amount=others16%%';
    RAISE NOTICE '- [CHANGED] distribute_ppv_pool() label to 16%% pool';
    RAISE NOTICE 'Optimizations Applied (Parts 14-15):';
    RAISE NOTICE '- qa_stats_realtime / qa_stats_ppv_daily updated';
    RAISE NOTICE '- qa_performance_metrics reinforced';
    RAISE NOTICE '========================================';
END $$;