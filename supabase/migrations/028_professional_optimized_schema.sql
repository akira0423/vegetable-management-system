-- ====================================================================
-- プロフェッショナルデータベース再設計 - 段階2: 最適化スキーマ
-- ====================================================================

-- 1. companiesテーブル最適化
DROP TABLE IF EXISTS companies CASCADE;
CREATE TABLE companies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    contact_email text UNIQUE NOT NULL,
    phone text,
    address text,
    is_active boolean NOT NULL DEFAULT true,
    settings jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. usersテーブル最適化（1企業1アカウント対応）
DROP TABLE IF EXISTS users CASCADE;
CREATE TABLE users (
    id uuid PRIMARY KEY,  -- auth.users.idと同じ
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    email text UNIQUE NOT NULL,
    full_name text,
    is_active boolean NOT NULL DEFAULT true,
    last_login_at timestamptz,
    settings jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. vegetablesテーブル最適化
DROP TABLE IF EXISTS vegetables CASCADE;
CREATE TABLE vegetables (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name text NOT NULL,
    variety_name text,
    plot_name text,
    area_size decimal(10,2),
    plant_count integer,
    planting_date date NOT NULL,
    expected_harvest_start date,
    expected_harvest_end date,
    actual_harvest_start date,
    actual_harvest_end date,
    status text NOT NULL DEFAULT 'planning',  -- planning, growing, harvesting, completed
    notes text,
    deleted_at timestamptz,  -- ソフト削除
    created_by uuid REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    CONSTRAINT chk_status CHECK (status IN ('planning', 'growing', 'harvesting', 'completed'))
);

-- 4. growing_tasksテーブル最適化
DROP TABLE IF EXISTS growing_tasks CASCADE;
CREATE TABLE growing_tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    vegetable_id uuid NOT NULL REFERENCES vegetables(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    task_type text NOT NULL,  -- watering, fertilizing, harvesting, pruning, other
    priority text NOT NULL DEFAULT 'medium',  -- high, medium, low
    status text NOT NULL DEFAULT 'pending',  -- pending, in_progress, completed, cancelled
    start_date date NOT NULL,
    end_date date NOT NULL,
    estimated_hours decimal(4,1),
    actual_hours decimal(4,1),
    progress integer NOT NULL DEFAULT 0,  -- 0-100
    notes text,
    deleted_at timestamptz,  -- ソフト削除
    created_by uuid REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    CONSTRAINT chk_priority CHECK (priority IN ('high', 'medium', 'low')),
    CONSTRAINT chk_status CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    CONSTRAINT chk_progress CHECK (progress >= 0 AND progress <= 100),
    CONSTRAINT chk_dates CHECK (start_date <= end_date)
);

-- 5. work_reportsテーブル最適化
DROP TABLE IF EXISTS work_reports CASCADE;
CREATE TABLE work_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    vegetable_id uuid NOT NULL REFERENCES vegetables(id) ON DELETE CASCADE,
    growing_task_id uuid REFERENCES growing_tasks(id) ON DELETE SET NULL,
    work_type text NOT NULL,
    description text,
    work_date date NOT NULL,
    start_time time,
    end_time time,
    duration_hours decimal(4,1),
    weather text,
    temperature decimal(4,1),
    
    -- 収穫データ
    harvest_amount decimal(8,2),
    harvest_unit text,
    harvest_quality text,
    
    -- 作業者情報
    worker_count integer DEFAULT 1,
    
    notes text,
    deleted_at timestamptz,  -- ソフト削除
    created_by uuid REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. パフォーマンス最適化インデックス
CREATE INDEX idx_users_company ON users(company_id);
CREATE INDEX idx_users_email ON users(email);

CREATE INDEX idx_vegetables_company ON vegetables(company_id);
CREATE INDEX idx_vegetables_active ON vegetables(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_vegetables_status ON vegetables(company_id, status);

CREATE INDEX idx_growing_tasks_company ON growing_tasks(company_id);
CREATE INDEX idx_growing_tasks_vegetable ON growing_tasks(vegetable_id);
CREATE INDEX idx_growing_tasks_active ON growing_tasks(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_growing_tasks_dates ON growing_tasks(start_date, end_date);

CREATE INDEX idx_work_reports_company ON work_reports(company_id);
CREATE INDEX idx_work_reports_vegetable ON work_reports(vegetable_id);
CREATE INDEX idx_work_reports_active ON work_reports(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_work_reports_date ON work_reports(work_date);

-- 7. 更新日時自動更新関数
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. 更新日時トリガー
CREATE TRIGGER update_companies_updated_at 
    BEFORE UPDATE ON companies 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_vegetables_updated_at 
    BEFORE UPDATE ON vegetables 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_growing_tasks_updated_at 
    BEFORE UPDATE ON growing_tasks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_work_reports_updated_at 
    BEFORE UPDATE ON work_reports 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 9. 確認ログ
DO $$ 
BEGIN
    RAISE NOTICE '=== 段階2完了: 最適化スキーマ実装 ===';
    RAISE NOTICE '✅ 5つの必須テーブル最適化完了';
    RAISE NOTICE '✅ パフォーマンスインデックス実装';
    RAISE NOTICE '✅ データ整合性制約実装';
    RAISE NOTICE '✅ ソフト削除対応実装';
    RAISE NOTICE '⚡ 段階3でシンプルRLS実装予定';
    RAISE NOTICE '==================================';
END $$;