-- ====================================================================
-- 複数ユーザー管理システム - Company Memberships
-- 既存のusersテーブルに影響しない並行システム
-- ====================================================================

-- ====================================================================
-- 1. 会社メンバーシップテーブル
-- ====================================================================
CREATE TABLE company_memberships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id uuid NOT NULL, -- auth.usersのIDを参照（外部キー制約は設定しない）
    email text NOT NULL,
    full_name text,
    role text NOT NULL DEFAULT 'operator', -- admin, manager, operator
    status text NOT NULL DEFAULT 'active', -- active, inactive, pending, invited
    
    -- 招待関連
    invited_by uuid REFERENCES company_memberships(id),
    invited_at timestamptz,
    accepted_at timestamptz,
    
    -- 基本情報
    phone text,
    department text,
    position text,
    
    -- メタデータ
    settings jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- 制約
    UNIQUE(company_id, user_id), -- 同一企業内で同一ユーザーは1つのみ
    UNIQUE(company_id, email) -- 同一企業内で同一メールは1つのみ
);

-- インデックス
CREATE INDEX idx_company_memberships_company ON company_memberships(company_id);
CREATE INDEX idx_company_memberships_user ON company_memberships(user_id);
CREATE INDEX idx_company_memberships_status ON company_memberships(company_id, status);
CREATE INDEX idx_company_memberships_role ON company_memberships(company_id, role);
CREATE INDEX idx_company_memberships_email ON company_memberships(email);

-- ====================================================================
-- 2. 招待テーブル
-- ====================================================================
CREATE TABLE user_invitations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    email text NOT NULL,
    full_name text,
    role text NOT NULL DEFAULT 'operator',
    
    -- 招待者情報
    invited_by uuid REFERENCES company_memberships(id) ON DELETE CASCADE,
    invitation_token text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
    
    -- ステータス管理
    status text NOT NULL DEFAULT 'pending', -- pending, accepted, expired, cancelled
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
    accepted_at timestamptz,
    
    -- メッセージ
    invitation_message text,
    
    -- メタデータ
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- 制約
    UNIQUE(company_id, email, status) -- 同一企業・メールで有効な招待は1つのみ
);

-- インデックス
CREATE INDEX idx_user_invitations_company ON user_invitations(company_id);
CREATE INDEX idx_user_invitations_email ON user_invitations(email);
CREATE INDEX idx_user_invitations_token ON user_invitations(invitation_token);
CREATE INDEX idx_user_invitations_status ON user_invitations(status, expires_at);

-- ====================================================================
-- 3. 企業設定の拡張
-- ====================================================================
ALTER TABLE companies ADD COLUMN IF NOT EXISTS user_join_policy text DEFAULT 'invitation_only';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS company_code text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS auto_approve_domains text[];

-- 企業コードのユニーク制約
CREATE UNIQUE INDEX idx_companies_code ON companies(company_code) WHERE company_code IS NOT NULL;

-- ====================================================================
-- 4. ユーザー活動統計テーブル（メンバーシップ用）
-- ====================================================================
CREATE TABLE member_activity_stats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    membership_id uuid NOT NULL REFERENCES company_memberships(id) ON DELETE CASCADE,
    
    -- ログイン統計
    total_logins integer DEFAULT 0,
    last_login_at timestamptz,
    
    -- 活動統計
    reports_created integer DEFAULT 0,
    photos_uploaded integer DEFAULT 0,
    vegetables_managed integer DEFAULT 0,
    
    -- 活動期間
    first_activity_at timestamptz,
    last_activity_at timestamptz,
    
    -- メタデータ
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- インデックス
CREATE UNIQUE INDEX idx_member_activity_membership ON member_activity_stats(membership_id);

-- ====================================================================
-- 5. 関数: 既存ユーザーのメンバーシップ作成
-- ====================================================================
CREATE OR REPLACE FUNCTION create_membership_for_existing_user(
    p_company_id uuid,
    p_user_id uuid,
    p_email text,
    p_full_name text DEFAULT NULL,
    p_role text DEFAULT 'admin'
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
    membership_id uuid;
BEGIN
    INSERT INTO company_memberships (
        company_id,
        user_id,
        email,
        full_name,
        role,
        status,
        accepted_at
    ) VALUES (
        p_company_id,
        p_user_id,
        p_email,
        p_full_name,
        p_role,
        'active',
        now()
    ) RETURNING id INTO membership_id;
    
    -- 統計テーブルも初期化
    INSERT INTO member_activity_stats (membership_id)
    VALUES (membership_id);
    
    RETURN membership_id;
END;
$$;

-- ====================================================================
-- 6. 関数: 招待受諾処理
-- ====================================================================
CREATE OR REPLACE FUNCTION accept_invitation(
    p_invitation_token text,
    p_user_id uuid
)
RETURNS TABLE(
    success boolean,
    membership_id uuid,
    company_id uuid,
    message text
)
LANGUAGE plpgsql
AS $$
DECLARE
    invitation_record record;
    new_membership_id uuid;
BEGIN
    -- 招待レコードを取得
    SELECT * INTO invitation_record
    FROM user_invitations
    WHERE invitation_token = p_invitation_token
    AND status = 'pending'
    AND expires_at > now();
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, '招待が見つからないか期限切れです'::text;
        RETURN;
    END IF;
    
    -- メンバーシップを作成
    INSERT INTO company_memberships (
        company_id,
        user_id,
        email,
        full_name,
        role,
        status,
        invited_by,
        invited_at,
        accepted_at
    ) VALUES (
        invitation_record.company_id,
        p_user_id,
        invitation_record.email,
        invitation_record.full_name,
        invitation_record.role,
        'active',
        invitation_record.invited_by,
        invitation_record.created_at,
        now()
    ) RETURNING id INTO new_membership_id;
    
    -- 統計テーブルを初期化
    INSERT INTO member_activity_stats (membership_id)
    VALUES (new_membership_id);
    
    -- 招待ステータスを更新
    UPDATE user_invitations
    SET status = 'accepted',
        accepted_at = now(),
        updated_at = now()
    WHERE id = invitation_record.id;
    
    RETURN QUERY SELECT true, new_membership_id, invitation_record.company_id, '招待を受諾しました'::text;
END;
$$;

-- ====================================================================
-- 7. RLS（Row Level Security）設定
-- ====================================================================

-- Company Memberships RLS
ALTER TABLE company_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own company memberships"
ON company_memberships FOR SELECT
USING (
    company_id IN (
        SELECT company_id FROM company_memberships cm2
        WHERE cm2.user_id = auth.uid()
        AND cm2.status = 'active'
    )
);

CREATE POLICY "Admins can manage company memberships"
ON company_memberships FOR ALL
USING (
    company_id IN (
        SELECT company_id FROM company_memberships cm2
        WHERE cm2.user_id = auth.uid()
        AND cm2.role = 'admin'
        AND cm2.status = 'active'
    )
);

-- User Invitations RLS
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage invitations"
ON user_invitations FOR ALL
USING (
    company_id IN (
        SELECT company_id FROM company_memberships cm
        WHERE cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.status = 'active'
    )
);

CREATE POLICY "Users can view invitations by token"
ON user_invitations FOR SELECT
USING (true); -- 招待トークンがあれば誰でも閲覧可能

-- Member Activity Stats RLS
ALTER TABLE member_activity_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company member stats"
ON member_activity_stats FOR SELECT
USING (
    membership_id IN (
        SELECT cm.id FROM company_memberships cm
        WHERE cm.company_id IN (
            SELECT cm2.company_id FROM company_memberships cm2
            WHERE cm2.user_id = auth.uid()
            AND cm2.status = 'active'
        )
    )
);

-- ====================================================================
-- 8. トリガー関数: updated_at自動更新
-- ====================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- updated_at自動更新トリガー
CREATE TRIGGER update_company_memberships_updated_at
    BEFORE UPDATE ON company_memberships
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_invitations_updated_at
    BEFORE UPDATE ON user_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_member_activity_stats_updated_at
    BEFORE UPDATE ON member_activity_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ====================================================================
-- 9. 初期設定: 既存ユーザーのマイグレーション準備
-- ====================================================================

-- 既存のusersテーブルから会社コードを生成
UPDATE companies 
SET company_code = UPPER(SUBSTRING(gen_random_uuid()::text, 1, 6))
WHERE company_code IS NULL;

-- 成功メッセージ
DO $$
BEGIN
    RAISE NOTICE '✅ Company Memberships システムが正常に作成されました';
    RAISE NOTICE '📋 作成されたテーブル:';
    RAISE NOTICE '   - company_memberships (メンバーシップ管理)';
    RAISE NOTICE '   - user_invitations (招待管理)'; 
    RAISE NOTICE '   - member_activity_stats (活動統計)';
    RAISE NOTICE '🔧 作成された関数:';
    RAISE NOTICE '   - create_membership_for_existing_user()';
    RAISE NOTICE '   - accept_invitation()';
    RAISE NOTICE '🛡️ RLS ポリシーが設定されました';
END $$;