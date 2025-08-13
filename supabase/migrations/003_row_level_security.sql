-- ====================================================================
-- Row Level Security (RLS) 設定
-- 企業データの完全分離とセキュリティ確保
-- ====================================================================

-- ====================================================================
-- 1. RLSの有効化
-- ====================================================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vegetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE growing_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- vegetable_varieties はマスターデータなのでRLS不要（全社共通）

-- ====================================================================
-- 2. ユーザー認証情報取得用の関数
-- ====================================================================
CREATE OR REPLACE FUNCTION auth.current_user_company_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT company_id 
        FROM users 
        WHERE id = auth.uid()
        LIMIT 1
    );
END;
$$;

CREATE OR REPLACE FUNCTION auth.current_user_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT role 
        FROM users 
        WHERE id = auth.uid()
        LIMIT 1
    );
END;
$$;

CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT role = 'admin'
        FROM users 
        WHERE id = auth.uid()
        LIMIT 1
    );
END;
$$;

-- ====================================================================
-- 3. 企業テーブル (companies) のRLS
-- ====================================================================

-- 自社データのみ参照可能
CREATE POLICY "companies_select_policy" ON companies
    FOR SELECT
    USING (
        -- 管理者は自社のみ
        id = auth.current_user_company_id()
        OR
        -- システム管理者用（必要に応じて）
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'system_admin'
        )
    );

-- 管理者のみ自社情報更新可能
CREATE POLICY "companies_update_policy" ON companies
    FOR UPDATE
    USING (
        id = auth.current_user_company_id() 
        AND auth.current_user_role() = 'admin'
    );

-- INSERTとDELETEは通常運用では無効（システム管理者のみ）
CREATE POLICY "companies_insert_policy" ON companies
    FOR INSERT
    WITH CHECK (false); -- 基本的にInsert禁止

CREATE POLICY "companies_delete_policy" ON companies
    FOR DELETE
    USING (false); -- Delete禁止

-- ====================================================================
-- 4. ユーザーテーブル (users) のRLS
-- ====================================================================

-- 自社ユーザーのみ参照可能
CREATE POLICY "users_select_policy" ON users
    FOR SELECT
    USING (company_id = auth.current_user_company_id());

-- 管理者のみ自社ユーザー情報更新可能
CREATE POLICY "users_update_policy" ON users
    FOR UPDATE
    USING (
        company_id = auth.current_user_company_id()
        AND (
            -- 管理者は全ユーザー編集可能
            auth.current_user_role() = 'admin'
            OR
            -- 本人は自分のみ編集可能
            id = auth.uid()
        )
    );

-- 新規ユーザー作成（サインアップ時のトリガーで使用）
CREATE POLICY "users_insert_policy" ON users
    FOR INSERT
    WITH CHECK (
        -- 同じ会社のユーザーのみ作成可能
        company_id = auth.current_user_company_id()
        AND auth.current_user_role() IN ('admin', 'manager')
    );

-- ユーザー削除（管理者のみ）
CREATE POLICY "users_delete_policy" ON users
    FOR DELETE
    USING (
        company_id = auth.current_user_company_id()
        AND auth.current_user_role() = 'admin'
        AND id != auth.uid() -- 自分自身は削除不可
    );

-- ====================================================================
-- 5. 野菜テーブル (vegetables) のRLS
-- ====================================================================

-- 自社の野菜のみ参照可能
CREATE POLICY "vegetables_select_policy" ON vegetables
    FOR SELECT
    USING (company_id = auth.current_user_company_id());

-- 野菜データの作成・更新・削除
CREATE POLICY "vegetables_insert_policy" ON vegetables
    FOR INSERT
    WITH CHECK (
        company_id = auth.current_user_company_id()
        AND auth.current_user_role() IN ('admin', 'manager', 'operator')
    );

CREATE POLICY "vegetables_update_policy" ON vegetables
    FOR UPDATE
    USING (
        company_id = auth.current_user_company_id()
        AND auth.current_user_role() IN ('admin', 'manager', 'operator')
    );

CREATE POLICY "vegetables_delete_policy" ON vegetables
    FOR DELETE
    USING (
        company_id = auth.current_user_company_id()
        AND auth.current_user_role() IN ('admin', 'manager')
    );

-- ====================================================================
-- 6. 栽培タスクテーブル (growing_tasks) のRLS
-- ====================================================================

-- 自社野菜のタスクのみ参照可能
CREATE POLICY "growing_tasks_select_policy" ON growing_tasks
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM vegetables 
            WHERE vegetables.id = growing_tasks.vegetable_id 
            AND vegetables.company_id = auth.current_user_company_id()
        )
    );

-- タスクの作成・更新・削除
CREATE POLICY "growing_tasks_insert_policy" ON growing_tasks
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM vegetables 
            WHERE vegetables.id = growing_tasks.vegetable_id 
            AND vegetables.company_id = auth.current_user_company_id()
        )
        AND auth.current_user_role() IN ('admin', 'manager', 'operator')
    );

CREATE POLICY "growing_tasks_update_policy" ON growing_tasks
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM vegetables 
            WHERE vegetables.id = growing_tasks.vegetable_id 
            AND vegetables.company_id = auth.current_user_company_id()
        )
        AND (
            auth.current_user_role() IN ('admin', 'manager')
            OR
            (auth.current_user_role() = 'operator' AND assigned_to = auth.uid())
        )
    );

CREATE POLICY "growing_tasks_delete_policy" ON growing_tasks
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM vegetables 
            WHERE vegetables.id = growing_tasks.vegetable_id 
            AND vegetables.company_id = auth.current_user_company_id()
        )
        AND auth.current_user_role() IN ('admin', 'manager')
    );

-- ====================================================================
-- 7. 作業記録テーブル (operation_logs) のRLS
-- ====================================================================

-- 自社野菜の作業記録のみ参照可能
CREATE POLICY "operation_logs_select_policy" ON operation_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM vegetables 
            WHERE vegetables.id = operation_logs.vegetable_id 
            AND vegetables.company_id = auth.current_user_company_id()
        )
    );

-- 作業記録の作成・更新・削除
CREATE POLICY "operation_logs_insert_policy" ON operation_logs
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM vegetables 
            WHERE vegetables.id = operation_logs.vegetable_id 
            AND vegetables.company_id = auth.current_user_company_id()
        )
        AND auth.current_user_role() IN ('admin', 'manager', 'operator')
    );

CREATE POLICY "operation_logs_update_policy" ON operation_logs
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM vegetables 
            WHERE vegetables.id = operation_logs.vegetable_id 
            AND vegetables.company_id = auth.current_user_company_id()
        )
        AND (
            auth.current_user_role() IN ('admin', 'manager')
            OR
            (auth.current_user_role() = 'operator' AND created_by = auth.uid())
        )
    );

CREATE POLICY "operation_logs_delete_policy" ON operation_logs
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM vegetables 
            WHERE vegetables.id = operation_logs.vegetable_id 
            AND vegetables.company_id = auth.current_user_company_id()
        )
        AND auth.current_user_role() IN ('admin', 'manager')
    );

-- ====================================================================
-- 8. 写真テーブル (photos) のRLS
-- ====================================================================

-- 自社野菜の写真のみ参照可能
CREATE POLICY "photos_select_policy" ON photos
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM vegetables 
            WHERE vegetables.id = photos.vegetable_id 
            AND vegetables.company_id = auth.current_user_company_id()
        )
    );

-- 写真の作成・更新・削除
CREATE POLICY "photos_insert_policy" ON photos
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM vegetables 
            WHERE vegetables.id = photos.vegetable_id 
            AND vegetables.company_id = auth.current_user_company_id()
        )
        AND auth.current_user_role() IN ('admin', 'manager', 'operator')
    );

CREATE POLICY "photos_update_policy" ON photos
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM vegetables 
            WHERE vegetables.id = photos.vegetable_id 
            AND vegetables.company_id = auth.current_user_company_id()
        )
        AND (
            auth.current_user_role() IN ('admin', 'manager')
            OR
            (auth.current_user_role() = 'operator' AND created_by = auth.uid())
        )
    );

CREATE POLICY "photos_delete_policy" ON photos
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM vegetables 
            WHERE vegetables.id = photos.vegetable_id 
            AND vegetables.company_id = auth.current_user_company_id()
        )
        AND (
            auth.current_user_role() IN ('admin', 'manager')
            OR
            (auth.current_user_role() = 'operator' AND created_by = auth.uid())
        )
    );

-- ====================================================================
-- 9. 監査ログテーブル (audit_logs) のRLS
-- ====================================================================

-- 自社の監査ログのみ参照可能（管理者のみ）
CREATE POLICY "audit_logs_select_policy" ON audit_logs
    FOR SELECT
    USING (
        company_id = auth.current_user_company_id()
        AND auth.current_user_role() = 'admin'
    );

-- 監査ログは自動作成のみ（システムのみ）
CREATE POLICY "audit_logs_insert_policy" ON audit_logs
    FOR INSERT
    WITH CHECK (
        company_id = auth.current_user_company_id()
    );

-- 監査ログの更新・削除は禁止
CREATE POLICY "audit_logs_update_policy" ON audit_logs
    FOR UPDATE
    USING (false);

CREATE POLICY "audit_logs_delete_policy" ON audit_logs
    FOR DELETE
    USING (false);

-- ====================================================================
-- 10. 通知テーブル (notifications) のRLS
-- ====================================================================

-- 自分宛の通知のみ参照可能
CREATE POLICY "notifications_select_policy" ON notifications
    FOR SELECT
    USING (user_id = auth.uid());

-- 通知の作成（システムまたは同じ会社の管理者）
CREATE POLICY "notifications_insert_policy" ON notifications
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users target_user
            WHERE target_user.id = notifications.user_id
            AND target_user.company_id = auth.current_user_company_id()
        )
        AND auth.current_user_role() IN ('admin', 'manager')
    );

-- 通知の更新（本人のみ既読状態変更可能）
CREATE POLICY "notifications_update_policy" ON notifications
    FOR UPDATE
    USING (user_id = auth.uid());

-- 通知の削除（本人または管理者）
CREATE POLICY "notifications_delete_policy" ON notifications
    FOR DELETE
    USING (
        user_id = auth.uid()
        OR
        (
            EXISTS (
                SELECT 1 FROM users target_user
                WHERE target_user.id = notifications.user_id
                AND target_user.company_id = auth.current_user_company_id()
            )
            AND auth.current_user_role() = 'admin'
        )
    );

-- ====================================================================
-- 11. ユーザー登録時の自動処理用トリガー
-- ====================================================================

-- 新規ユーザー登録時に users テーブルに自動追加
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_company_id uuid;
    user_company_name text;
BEGIN
    -- メタデータから会社情報を取得
    user_company_id := (NEW.raw_user_meta_data ->> 'company_id')::uuid;
    user_company_name := NEW.raw_user_meta_data ->> 'company_name';
    
    -- 会社IDが指定されていない場合は新規企業として作成
    IF user_company_id IS NULL AND user_company_name IS NOT NULL THEN
        INSERT INTO companies (name, plan_type, contact_email)
        VALUES (user_company_name, 'basic', NEW.email)
        RETURNING id INTO user_company_id;
    END IF;
    
    -- usersテーブルに挿入
    INSERT INTO users (
        id, 
        company_id, 
        email, 
        full_name, 
        role
    ) VALUES (
        NEW.id,
        user_company_id,
        NEW.email,
        NEW.raw_user_meta_data ->> 'full_name',
        CASE 
            WHEN user_company_name IS NOT NULL THEN 'admin'  -- 新規企業の場合は管理者
            ELSE 'operator'  -- 既存企業への追加の場合はオペレーター
        END
    );
    
    RETURN NEW;
END;
$$;

-- トリガーの作成
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ====================================================================
-- 12. 監査ログ自動記録用トリガー
-- ====================================================================

CREATE OR REPLACE FUNCTION log_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    company_id_val uuid;
    record_id_val uuid;
BEGIN
    -- 会社IDを取得
    IF TG_TABLE_NAME = 'companies' THEN
        company_id_val := COALESCE(NEW.id, OLD.id);
        record_id_val := COALESCE(NEW.id, OLD.id);
    ELSIF TG_TABLE_NAME = 'users' THEN
        company_id_val := COALESCE(NEW.company_id, OLD.company_id);
        record_id_val := COALESCE(NEW.id, OLD.id);
    ELSIF TG_TABLE_NAME = 'vegetables' THEN
        company_id_val := COALESCE(NEW.company_id, OLD.company_id);
        record_id_val := COALESCE(NEW.id, OLD.id);
    ELSIF TG_TABLE_NAME IN ('growing_tasks', 'operation_logs', 'photos') THEN
        -- vegetable_idから会社IDを取得
        SELECT v.company_id INTO company_id_val
        FROM vegetables v
        WHERE v.id = COALESCE(NEW.vegetable_id, OLD.vegetable_id);
        record_id_val := COALESCE(NEW.id, OLD.id);
    ELSE
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- 監査ログに記録
    INSERT INTO audit_logs (
        company_id,
        user_id,
        table_name,
        record_id,
        action,
        old_data,
        new_data
    ) VALUES (
        company_id_val,
        auth.uid(),
        TG_TABLE_NAME,
        record_id_val,
        TG_OP,
        CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- 監査ログトリガーの作成（重要なテーブルのみ）
CREATE TRIGGER audit_companies AFTER INSERT OR UPDATE OR DELETE ON companies FOR EACH ROW EXECUTE FUNCTION log_changes();
CREATE TRIGGER audit_users AFTER INSERT OR UPDATE OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION log_changes();
CREATE TRIGGER audit_vegetables AFTER INSERT OR UPDATE OR DELETE ON vegetables FOR EACH ROW EXECUTE FUNCTION log_changes();
CREATE TRIGGER audit_growing_tasks AFTER INSERT OR UPDATE OR DELETE ON growing_tasks FOR EACH ROW EXECUTE FUNCTION log_changes();