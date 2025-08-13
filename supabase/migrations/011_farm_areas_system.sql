-- ====================================================================
-- 農地エリア管理システム - 011_farm_areas_system.sql
-- ====================================================================

-- Extensions for spatial data (PostGIS)
CREATE EXTENSION IF NOT EXISTS postgis;

-- ====================================================================
-- 1. 農地エリアテーブル (farm_areas)
-- ====================================================================
CREATE TABLE farm_areas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    
    -- 空間データ
    geometry geometry(POLYGON, 4326) NOT NULL, -- WGS84座標系
    area_hectares decimal(10,4) NOT NULL,      -- 面積（ha）
    area_square_meters decimal(12,2) NOT NULL, -- 面積（㎡）
    
    -- メッシュ設定
    mesh_size_meters integer NOT NULL DEFAULT 5, -- メッシュサイズ（メートル）
    estimated_cell_count integer,                -- 推定セル数
    
    -- 位置情報
    center_latitude decimal(10,6),
    center_longitude decimal(10,6),
    prefecture text,
    city text,
    address text,
    
    -- ステータス
    status text NOT NULL DEFAULT 'active', -- active, inactive, archived
    is_locked boolean DEFAULT false,       -- 編集ロック
    
    -- メタデータ
    drawing_style jsonb DEFAULT '{"fillColor": "#22c55e", "fillOpacity": 0.3, "strokeColor": "#16a34a", "strokeWidth": 2}',
    notes text,
    tags text[], -- 検索用タグ
    
    created_by uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 農地エリアのインデックス
CREATE INDEX idx_farm_areas_company ON farm_areas(company_id);
CREATE INDEX idx_farm_areas_status ON farm_areas(company_id, status);
CREATE INDEX idx_farm_areas_geometry ON farm_areas USING GIST(geometry);
CREATE INDEX idx_farm_areas_location ON farm_areas(center_latitude, center_longitude);
CREATE INDEX idx_farm_areas_area ON farm_areas(area_hectares);
CREATE INDEX idx_farm_areas_tags ON farm_areas USING GIN(tags);

-- ====================================================================
-- 2. セル割り当てテーブル (cell_assignments)
-- ====================================================================
CREATE TABLE cell_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_area_id uuid NOT NULL REFERENCES farm_areas(id) ON DELETE CASCADE,
    
    -- セル識別（安定したID生成）
    cell_id text NOT NULL,              -- 安定したセルID
    cell_row integer NOT NULL,          -- セル行番号
    cell_col integer NOT NULL,          -- セル列番号
    
    -- 作物情報
    vegetable_id uuid REFERENCES vegetables(id) ON DELETE SET NULL,
    
    -- 日付情報
    assigned_date date NOT NULL DEFAULT CURRENT_DATE,
    planting_date date,
    expected_harvest_date date,
    actual_harvest_date date,
    
    -- 栽培情報
    plant_count integer DEFAULT 1,
    growth_stage text DEFAULT 'planned', -- planned, planted, growing, harvesting, harvested
    health_status text DEFAULT 'healthy',
    
    -- 作業記録
    last_watered_date date,
    last_fertilized_date date,
    last_weeded_date date,
    
    -- 収穫データ
    harvest_quantity decimal(8,2),
    harvest_unit text DEFAULT 'kg',
    harvest_quality text,
    
    notes text,
    
    created_by uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- セル割り当てのインデックス
CREATE INDEX idx_cell_assignments_farm_area ON cell_assignments(farm_area_id);
CREATE INDEX idx_cell_assignments_vegetable ON cell_assignments(vegetable_id);
CREATE INDEX idx_cell_assignments_cell ON cell_assignments(farm_area_id, cell_row, cell_col);
CREATE INDEX idx_cell_assignments_dates ON cell_assignments(assigned_date, planting_date);
CREATE INDEX idx_cell_assignments_status ON cell_assignments(growth_stage, health_status);

-- セルの重複割り当て防止
CREATE UNIQUE INDEX idx_cell_assignments_unique 
ON cell_assignments(farm_area_id, cell_id, assigned_date);

-- ====================================================================
-- 3. 農地作業履歴テーブル (farm_work_logs)
-- ====================================================================
CREATE TABLE farm_work_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_area_id uuid NOT NULL REFERENCES farm_areas(id) ON DELETE CASCADE,
    
    -- 作業内容
    work_type text NOT NULL, -- drawing, mesh_generation, cell_assignment, harvesting, etc.
    work_description text NOT NULL,
    
    -- 対象範囲
    affected_cells text[], -- セルIDの配列
    affected_area_sqm decimal(10,2),
    
    -- 作業データ
    work_data jsonb, -- 作業固有のデータ
    
    -- 結果
    success boolean DEFAULT true,
    error_message text,
    
    work_date timestamptz NOT NULL DEFAULT now(),
    worked_by uuid NOT NULL REFERENCES users(id),
    
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 作業履歴のインデックス
CREATE INDEX idx_farm_work_logs_farm_area ON farm_work_logs(farm_area_id);
CREATE INDEX idx_farm_work_logs_type ON farm_work_logs(work_type);
CREATE INDEX idx_farm_work_logs_date ON farm_work_logs(work_date);
CREATE INDEX idx_farm_work_logs_worker ON farm_work_logs(worked_by);

-- ====================================================================
-- 4. エリア統計ビュー (farm_area_stats)
-- ====================================================================
CREATE VIEW farm_area_stats AS
SELECT 
    fa.id,
    fa.name,
    fa.area_hectares,
    fa.area_square_meters,
    fa.estimated_cell_count,
    
    -- セル統計
    COUNT(ca.id) as assigned_cells_count,
    COUNT(CASE WHEN ca.growth_stage != 'planned' THEN 1 END) as active_cells_count,
    COUNT(CASE WHEN ca.growth_stage = 'harvested' THEN 1 END) as harvested_cells_count,
    
    -- 作物統計
    COUNT(DISTINCT ca.vegetable_id) as unique_vegetables_count,
    
    -- 収穫統計
    COALESCE(SUM(ca.harvest_quantity), 0) as total_harvest_kg,
    COALESCE(AVG(ca.harvest_quantity), 0) as avg_harvest_per_cell,
    
    -- 日付情報
    MIN(ca.planting_date) as earliest_planting,
    MAX(ca.expected_harvest_date) as latest_expected_harvest,
    
    -- 利用率
    CASE 
        WHEN fa.estimated_cell_count > 0 
        THEN ROUND((COUNT(ca.id)::decimal / fa.estimated_cell_count) * 100, 2)
        ELSE 0 
    END as utilization_percentage
    
FROM farm_areas fa
LEFT JOIN cell_assignments ca ON fa.id = ca.farm_area_id
GROUP BY fa.id, fa.name, fa.area_hectares, fa.area_square_meters, fa.estimated_cell_count;

-- ====================================================================
-- 5. トリガー関数の作成
-- ====================================================================

-- 農地エリアの面積自動計算
CREATE OR REPLACE FUNCTION calculate_farm_area_metrics()
RETURNS TRIGGER AS $$
BEGIN
    -- 面積を計算（WGS84を平面座標系に変換して計算）
    NEW.area_square_meters = ST_Area(ST_Transform(NEW.geometry, 3857)); -- Web Mercator
    NEW.area_hectares = NEW.area_square_meters / 10000;
    
    -- 中心点を計算
    WITH centroid AS (
        SELECT ST_Centroid(NEW.geometry) as center
    )
    SELECT 
        ST_Y(center) as lat,
        ST_X(center) as lng
    INTO 
        NEW.center_latitude,
        NEW.center_longitude
    FROM centroid;
    
    -- 推定セル数を計算
    NEW.estimated_cell_count = CEIL(NEW.area_square_meters / (NEW.mesh_size_meters * NEW.mesh_size_meters));
    
    NEW.updated_at = now();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_farm_area_metrics
    BEFORE INSERT OR UPDATE ON farm_areas
    FOR EACH ROW EXECUTE FUNCTION calculate_farm_area_metrics();

-- セル割り当ての更新時刻自動更新
CREATE OR REPLACE FUNCTION update_cell_assignment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_cell_assignment_timestamp
    BEFORE UPDATE ON cell_assignments
    FOR EACH ROW EXECUTE FUNCTION update_cell_assignment_timestamp();

-- 作業ログ自動生成
CREATE OR REPLACE FUNCTION log_farm_area_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO farm_work_logs (
            farm_area_id,
            work_type,
            work_description,
            work_data,
            worked_by
        ) VALUES (
            NEW.id,
            'area_creation',
            format('新しい農地エリア "%s" を作成', NEW.name),
            jsonb_build_object(
                'area_hectares', NEW.area_hectares,
                'estimated_cells', NEW.estimated_cell_count
            ),
            NEW.created_by
        );
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- 面積が変更された場合
        IF NEW.area_hectares != OLD.area_hectares THEN
            INSERT INTO farm_work_logs (
                farm_area_id,
                work_type,
                work_description,
                work_data,
                worked_by
            ) VALUES (
                NEW.id,
                'area_modification',
                format('農地エリア "%s" の面積を変更', NEW.name),
                jsonb_build_object(
                    'old_area', OLD.area_hectares,
                    'new_area', NEW.area_hectares,
                    'old_cells', OLD.estimated_cell_count,
                    'new_cells', NEW.estimated_cell_count
                ),
                NEW.created_by -- 実際には更新者IDが欲しい
            );
        END IF;
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO farm_work_logs (
            farm_area_id,
            work_type,
            work_description,
            work_data,
            worked_by
        ) VALUES (
            OLD.id,
            'area_deletion',
            format('農地エリア "%s" を削除', OLD.name),
            jsonb_build_object(
                'area_hectares', OLD.area_hectares,
                'cell_count', OLD.estimated_cell_count
            ),
            OLD.created_by -- 実際には削除者IDが欲しい
        );
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_farm_area_changes
    AFTER INSERT OR UPDATE OR DELETE ON farm_areas
    FOR EACH ROW EXECUTE FUNCTION log_farm_area_changes();

-- ====================================================================
-- 6. RLS (Row Level Security) 設定
-- ====================================================================

ALTER TABLE farm_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cell_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_work_logs ENABLE ROW LEVEL SECURITY;

-- 農地エリアは自社のみアクセス可能
CREATE POLICY "Farm areas company access" ON farm_areas
    FOR ALL USING (
        company_id IN (
            SELECT company_id FROM user_company_roles 
            WHERE user_id = auth.uid()
        )
    );

-- セル割り当ては自社のみアクセス可能
CREATE POLICY "Cell assignments company access" ON cell_assignments
    FOR ALL USING (
        farm_area_id IN (
            SELECT id FROM farm_areas 
            WHERE company_id IN (
                SELECT company_id FROM user_company_roles 
                WHERE user_id = auth.uid()
            )
        )
    );

-- 作業ログは自社のみ閲覧可能
CREATE POLICY "Work logs company access" ON farm_work_logs
    FOR SELECT USING (
        farm_area_id IN (
            SELECT id FROM farm_areas 
            WHERE company_id IN (
                SELECT company_id FROM user_company_roles 
                WHERE user_id = auth.uid()
            )
        )
    );

-- ====================================================================
-- 7. サンプルデータ（開発・テスト用）
-- ====================================================================

-- サンプル農地エリア
INSERT INTO farm_areas (
    company_id,
    name,
    description,
    geometry,
    mesh_size_meters,
    prefecture,
    city,
    address,
    tags,
    created_by
) VALUES (
    (SELECT id FROM companies WHERE name LIKE '%テスト%' LIMIT 1),
    'テスト農場メインエリア',
    '手描き機能テスト用の農地エリアです',
    ST_GeomFromText('POLYGON((139.6917 35.6895, 139.6925 35.6895, 139.6925 35.6890, 139.6917 35.6890, 139.6917 35.6895))', 4326),
    5,
    '東京都',
    '新宿区',
    '新宿1-1-1',
    ARRAY['テスト', '都市農業', 'メイン'],
    (SELECT id FROM users WHERE email LIKE '%@%' LIMIT 1)
);

-- ====================================================================
-- 8. 便利な関数
-- ====================================================================

-- セルIDを安定して生成する関数
CREATE OR REPLACE FUNCTION generate_stable_cell_id(
    farm_area_id uuid,
    row_num integer,
    col_num integer,
    mesh_size integer DEFAULT 5
) RETURNS text AS $$
BEGIN
    RETURN format('cell_%s_%s_%s_%s', 
        farm_area_id, 
        mesh_size, 
        row_num, 
        col_num
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 農地エリア内のセル数を正確に計算する関数
CREATE OR REPLACE FUNCTION calculate_exact_cell_count(
    area_geometry geometry,
    mesh_size_meters integer DEFAULT 5
) RETURNS integer AS $$
DECLARE
    bbox_data record;
    cell_count integer := 0;
    current_lng decimal;
    current_lat decimal;
    cell_size_deg decimal;
BEGIN
    -- メッシュサイズを度に変換（概算）
    cell_size_deg := mesh_size_meters / 111000.0;
    
    -- バウンディングボックスを取得
    SELECT 
        ST_XMin(area_geometry) as min_lng,
        ST_YMin(area_geometry) as min_lat,
        ST_XMax(area_geometry) as max_lng,
        ST_YMax(area_geometry) as max_lat
    INTO bbox_data;
    
    -- グリッドを生成してポリゴン内のセルをカウント
    current_lat := bbox_data.min_lat;
    WHILE current_lat < bbox_data.max_lat LOOP
        current_lng := bbox_data.min_lng;
        WHILE current_lng < bbox_data.max_lng LOOP
            -- セルの中心点がポリゴン内にあるかチェック
            IF ST_Contains(
                area_geometry, 
                ST_Point(current_lng + cell_size_deg/2, current_lat + cell_size_deg/2)
            ) THEN
                cell_count := cell_count + 1;
            END IF;
            current_lng := current_lng + cell_size_deg;
        END LOOP;
        current_lat := current_lat + cell_size_deg;
    END LOOP;
    
    RETURN cell_count;
END;
$$ LANGUAGE plpgsql;

-- ====================================================================
-- 9. コメント追加
-- ====================================================================
COMMENT ON TABLE farm_areas IS '農地エリア管理テーブル - 手描きポリゴンで定義された農地';
COMMENT ON TABLE cell_assignments IS 'セル割り当てテーブル - 5mメッシュでの作物割り当て';
COMMENT ON TABLE farm_work_logs IS '農地作業履歴テーブル - 全ての農地操作を記録';
COMMENT ON VIEW farm_area_stats IS '農地エリア統計ビュー - リアルタイム統計情報';

-- ====================================================================
-- END OF MIGRATION
-- ====================================================================