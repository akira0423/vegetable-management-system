-- ====================================================================
-- 作業報告テーブルの作成
-- ====================================================================

-- 作業報告テーブル
CREATE TABLE work_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    vegetable_id uuid REFERENCES vegetables(id) ON DELETE CASCADE,
    work_type varchar(100) NOT NULL,
    description text,
    work_date date NOT NULL DEFAULT CURRENT_DATE,
    start_time time,
    end_time time,
    duration_hours decimal(4,2),
    photos jsonb DEFAULT '[]'::jsonb,
    weather varchar(50),
    temperature decimal(4,1),
    notes text,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- インデックス作成
CREATE INDEX idx_work_reports_company ON work_reports(company_id);
CREATE INDEX idx_work_reports_vegetable ON work_reports(vegetable_id);
CREATE INDEX idx_work_reports_date ON work_reports(company_id, work_date DESC);
CREATE INDEX idx_work_reports_work_type ON work_reports(company_id, work_type);
CREATE INDEX idx_work_reports_created_by ON work_reports(created_by);

-- 更新時刻の自動更新トリガー
CREATE TRIGGER update_work_reports_updated_at 
    BEFORE UPDATE ON work_reports 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at();

-- Row Level Security (RLS) の有効化
ALTER TABLE work_reports ENABLE ROW LEVEL SECURITY;

-- RLSポリシーの作成
CREATE POLICY "work_reports_select_policy" ON work_reports
    FOR SELECT
    USING (
        company_id = get_current_user_company_id()
        OR get_current_user_company_id() IS NULL -- テスト時
    );

CREATE POLICY "work_reports_insert_policy" ON work_reports
    FOR INSERT
    WITH CHECK (
        company_id = get_current_user_company_id()
        OR get_current_user_company_id() IS NULL -- テスト時
    );

CREATE POLICY "work_reports_update_policy" ON work_reports
    FOR UPDATE
    USING (
        company_id = get_current_user_company_id()
        OR get_current_user_company_id() IS NULL -- テスト時
    )
    WITH CHECK (
        company_id = get_current_user_company_id()
        OR get_current_user_company_id() IS NULL -- テスト時
    );

CREATE POLICY "work_reports_delete_policy" ON work_reports
    FOR DELETE
    USING (
        company_id = get_current_user_company_id()
        OR get_current_user_company_id() IS NULL -- テスト時
    );

-- 監査ログのトリガー追加
CREATE TRIGGER audit_work_reports 
    AFTER INSERT OR UPDATE OR DELETE ON work_reports 
    FOR EACH ROW 
    EXECUTE FUNCTION log_changes();

-- テーブルコメント
COMMENT ON TABLE work_reports IS '作業報告テーブル - 各野菜の栽培作業記録を管理';
COMMENT ON COLUMN work_reports.work_type IS '作業種類（種まき、水やり、施肥、収穫など）';
COMMENT ON COLUMN work_reports.photos IS '作業写真のパス情報をJSON配列で保存';
COMMENT ON COLUMN work_reports.duration_hours IS '作業時間（時間単位、小数点以下2桁まで）';