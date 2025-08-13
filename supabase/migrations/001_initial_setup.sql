-- ====================================================================
-- 野菜栽培管理システム - 初期データベース設計
-- ====================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================================================
-- 1. 企業テーブル（companies）
-- ====================================================================
CREATE TABLE companies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    logo_url text,
    plan_type text NOT NULL DEFAULT 'basic', -- basic, premium, enterprise
    contact_email text,
    contact_phone text,
    address text,
    postal_code text,
    prefecture text,
    city text,
    is_active boolean NOT NULL DEFAULT true,
    subscription_expires_at timestamptz,
    max_users integer NOT NULL DEFAULT 5,
    max_vegetables integer NOT NULL DEFAULT 50,
    settings jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 企業テーブルのインデックス
CREATE INDEX idx_companies_active ON companies(is_active);
CREATE INDEX idx_companies_plan ON companies(plan_type);

-- ====================================================================
-- 2. ユーザーテーブル（users）
-- ====================================================================
CREATE TABLE users (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    email text NOT NULL,
    full_name text,
    role text NOT NULL DEFAULT 'operator', -- admin, manager, operator
    is_active boolean NOT NULL DEFAULT true,
    last_login_at timestamptz,
    profile_image_url text,
    phone text,
    department text,
    position text,
    settings jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- ユーザーテーブルのインデックス
CREATE INDEX idx_users_company ON users(company_id);
CREATE INDEX idx_users_role ON users(company_id, role);
CREATE INDEX idx_users_active ON users(company_id, is_active);
CREATE UNIQUE INDEX idx_users_email ON users(email);

-- ====================================================================
-- 3. 野菜品種マスターテーブル（vegetable_varieties）
-- ====================================================================
CREATE TABLE vegetable_varieties (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,              -- "トマト"
    variety text,                    -- "桃太郎"
    category text NOT NULL,          -- "果菜類", "葉菜類", "根菜類"
    standard_growth_days integer,    -- 標準栽培期間（日）
    standard_tasks jsonb DEFAULT '[]', -- 標準作業テンプレート
    planting_season text,            -- "春", "夏", "秋", "冬", "通年"
    harvest_season text,
    optimal_temperature_min integer, -- 適温範囲（℃）
    optimal_temperature_max integer,
    water_requirement text,          -- "多", "中", "少"
    sunlight_requirement text,       -- "全日照", "半日照", "日陰"
    soil_ph_min decimal(3,1),       -- 適正pH範囲
    soil_ph_max decimal(3,1),
    notes text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 品種マスターのインデックス
CREATE INDEX idx_varieties_category ON vegetable_varieties(category);
CREATE INDEX idx_varieties_name ON vegetable_varieties(name);

-- ====================================================================
-- 4. 野菜テーブル（vegetables）
-- ====================================================================
CREATE TABLE vegetables (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    variety_id uuid REFERENCES vegetable_varieties(id),
    name text NOT NULL,              -- "第1圃場トマト"
    variety_name text,               -- カスタム品種名
    plot_name text,                  -- 圃場名
    area_size decimal(10,2),         -- 栽培面積（㎡）
    plant_count integer,             -- 株数
    planting_date date NOT NULL,
    expected_harvest_start date,
    expected_harvest_end date,
    actual_harvest_start date,
    actual_harvest_end date,
    status text NOT NULL DEFAULT 'planning', -- planning, growing, harvesting, completed, cancelled
    notes text,
    custom_fields jsonb DEFAULT '{}', -- カスタムフィールド
    created_by uuid REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 野菜テーブルのインデックス
CREATE INDEX idx_vegetables_company ON vegetables(company_id);
CREATE INDEX idx_vegetables_status ON vegetables(company_id, status);
CREATE INDEX idx_vegetables_dates ON vegetables(company_id, planting_date, expected_harvest_start);
CREATE INDEX idx_vegetables_created_by ON vegetables(created_by);

-- ====================================================================
-- 5. 栽培タスクテーブル（growing_tasks）
-- ====================================================================
CREATE TABLE growing_tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vegetable_id uuid NOT NULL REFERENCES vegetables(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    task_type text NOT NULL,         -- "seeding", "transplanting", "fertilizing", "watering", "pruning", "harvesting", "other"
    priority text NOT NULL DEFAULT 'medium', -- high, medium, low
    status text NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, cancelled, overdue
    start_date date NOT NULL,
    end_date date NOT NULL,
    estimated_hours decimal(4,1),
    actual_hours decimal(4,1),
    progress integer NOT NULL DEFAULT 0, -- 0-100
    assigned_to uuid REFERENCES users(id),
    dependencies jsonb DEFAULT '[]',  -- 依存タスクのID配列
    required_materials jsonb DEFAULT '{}', -- 必要な資材・道具
    weather_dependency boolean DEFAULT false,
    notes text,
    created_by uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- タスクテーブルのインデックス
CREATE INDEX idx_tasks_vegetable ON growing_tasks(vegetable_id);
CREATE INDEX idx_tasks_status ON growing_tasks(status, start_date);
CREATE INDEX idx_tasks_assigned ON growing_tasks(assigned_to, status);
CREATE INDEX idx_tasks_dates ON growing_tasks(start_date, end_date);

-- ====================================================================
-- 6. 作業記録テーブル（operation_logs）
-- ====================================================================
CREATE TABLE operation_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    growing_task_id uuid REFERENCES growing_tasks(id) ON DELETE CASCADE,
    vegetable_id uuid NOT NULL REFERENCES vegetables(id) ON DELETE CASCADE,
    date date NOT NULL,
    work_type text NOT NULL,         -- タスクと同じtask_type
    work_notes text,
    weather text,                    -- "晴れ", "曇り", "雨", "雪"
    temperature_morning decimal(4,1),
    temperature_afternoon decimal(4,1),
    humidity integer,                -- 湿度（%）
    
    -- 肥料関連
    fertilizer_type text,
    fertilizer_name text,
    fertilizer_qty decimal(8,2),
    fertilizer_unit text,            -- "kg", "L", "袋"
    
    -- 土壌データ
    soil_ph decimal(3,1),
    soil_moisture integer,           -- 土壌水分（%）
    soil_temperature decimal(4,1),
    
    -- 収穫データ
    harvest_qty decimal(8,2),
    harvest_unit text,               -- "kg", "個", "束"
    harvest_quality text,            -- "優", "良", "可", "不良"
    
    -- 病害虫
    pest_disease_found boolean DEFAULT false,
    pest_disease_notes text,
    treatment_applied text,
    
    -- 作業時間
    work_hours decimal(4,1),
    worker_count integer DEFAULT 1,
    
    -- メタデータ
    location_lat decimal(10,6),      -- GPS座標
    location_lng decimal(10,6),
    custom_data jsonb DEFAULT '{}',   -- カスタムデータ
    
    created_by uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 作業記録テーブルのインデックス
CREATE INDEX idx_logs_vegetable_date ON operation_logs(vegetable_id, date DESC);
CREATE INDEX idx_logs_task ON operation_logs(growing_task_id);
CREATE INDEX idx_logs_date_range ON operation_logs(date) WHERE date >= CURRENT_DATE - INTERVAL '1 year';
CREATE INDEX idx_logs_work_type ON operation_logs(work_type, date);

-- ====================================================================
-- 7. 写真テーブル（photos）
-- ====================================================================
CREATE TABLE photos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_log_id uuid REFERENCES operation_logs(id) ON DELETE CASCADE,
    vegetable_id uuid NOT NULL REFERENCES vegetables(id) ON DELETE CASCADE,
    storage_path text NOT NULL,      -- Supabase Storage パス
    original_filename text NOT NULL,
    file_size integer NOT NULL,      -- bytes
    mime_type text NOT NULL,
    width integer,
    height integer,
    taken_at timestamptz NOT NULL,
    location_lat decimal(10,6),      -- 撮影場所GPS
    location_lng decimal(10,6),
    description text,
    tags text[],                     -- 検索用タグ
    is_primary boolean DEFAULT false, -- メイン写真フラグ
    thumbnail_path text,             -- サムネイルパス
    created_by uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 写真テーブルのインデックス
CREATE INDEX idx_photos_vegetable ON photos(vegetable_id, taken_at DESC);
CREATE INDEX idx_photos_log ON photos(operation_log_id);
CREATE INDEX idx_photos_tags ON photos USING GIN(tags);

-- ====================================================================
-- 8. 監査ログテーブル（audit_logs）
-- ====================================================================
CREATE TABLE audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id),
    user_id uuid REFERENCES users(id),
    table_name text NOT NULL,
    record_id uuid NOT NULL,
    action text NOT NULL,            -- INSERT, UPDATE, DELETE
    old_data jsonb,
    new_data jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 監査ログインデックス
CREATE INDEX idx_audit_company_date ON audit_logs(company_id, created_at DESC);
CREATE INDEX idx_audit_table_action ON audit_logs(table_name, action);
CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);

-- ====================================================================
-- 9. 通知テーブル（notifications）
-- ====================================================================
CREATE TABLE notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type text NOT NULL,              -- task_reminder, deadline_warning, system_update
    title text NOT NULL,
    message text NOT NULL,
    data jsonb DEFAULT '{}',         -- 通知に関連するデータ
    is_read boolean NOT NULL DEFAULT false,
    read_at timestamptz,
    expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 通知インデックス
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_type ON notifications(type, created_at);

-- ====================================================================
-- 更新日時の自動更新（トリガー設定）
-- ====================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 更新日時トリガー
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_vegetables_updated_at BEFORE UPDATE ON vegetables FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON growing_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_logs_updated_at BEFORE UPDATE ON operation_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at();