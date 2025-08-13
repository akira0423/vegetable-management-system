-- ====================================================================
-- 農地編集機能用データベース拡張 - 010_farm_plots_extension.sql
-- ====================================================================

-- Extensions for spatial data (PostGIS)
CREATE EXTENSION IF NOT EXISTS postgis;

-- ====================================================================
-- 1. 農地ポリゴンテーブル (farm_plots)
-- ====================================================================
CREATE TABLE farm_plots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name text NOT NULL,                    -- 農地名 (例: "第1圃場")
    description text,                      -- 農地の説明
    area_hectares decimal(10,4),          -- 面積（ha）
    geometry geometry(POLYGON, 4326) NOT NULL, -- 農地境界のポリゴン (WGS84)
    geometry_jgd2011 geometry(POLYGON, 6677), -- JGD2011平面直角座標系での正確な境界
    prefecture text,                       -- 都道府県
    city text,                            -- 市区町村
    address text,                         -- 詳細住所
    postal_code text,                     -- 郵便番号
    
    -- WAGRI連携情報
    wagri_plot_id text,                   -- WAGRI農地ピンAPI連携ID
    wagri_city_code text,                 -- 市区町村コード
    wagri_last_updated timestamptz,       -- WAGRI情報最終取得日時
    
    -- ステータス
    status text NOT NULL DEFAULT 'active', -- active, inactive, archived
    is_mesh_generated boolean DEFAULT false, -- メッシュ生成済みフラグ
    mesh_size_meters integer DEFAULT 5,    -- メッシュサイズ（メートル）
    mesh_generated_at timestamptz,         -- メッシュ生成日時
    
    -- メタデータ
    created_by uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 農地テーブルのインデックス
CREATE INDEX idx_farm_plots_company ON farm_plots(company_id);
CREATE INDEX idx_farm_plots_status ON farm_plots(company_id, status);
CREATE INDEX idx_farm_plots_geometry ON farm_plots USING GIST(geometry);
CREATE INDEX idx_farm_plots_wagri ON farm_plots(wagri_city_code, wagri_plot_id);

-- ====================================================================
-- 2. 5mメッシュセルテーブル (plot_cells)
-- ====================================================================
CREATE TABLE plot_cells (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_plot_id uuid NOT NULL REFERENCES farm_plots(id) ON DELETE CASCADE,
    cell_index integer NOT NULL,          -- セル番号（圃場内でユニーク）
    geometry geometry(POLYGON, 4326) NOT NULL, -- セルの境界ポリゴン
    center_point geometry(POINT, 4326) NOT NULL, -- セルの中心点
    
    -- セル位置情報
    row_index integer NOT NULL,           -- 行インデックス
    col_index integer NOT NULL,           -- 列インデックス
    area_sqm decimal(8,2) DEFAULT 25.0,   -- セル面積（㎡）- 5m×5m=25㎡
    
    -- セル状態
    is_cultivated boolean DEFAULT false,  -- 栽培中フラグ
    soil_quality text,                    -- 土壌品質 ("good", "fair", "poor")
    drainage text,                        -- 排水性 ("good", "moderate", "poor")
    slope_degree decimal(4,1),            -- 傾斜角度
    
    -- 統計情報
    vegetable_count integer DEFAULT 0,    -- このセルで栽培されている野菜数
    last_cultivation_date date,           -- 最終栽培日
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- メッシュセルテーブルのインデックス
CREATE INDEX idx_plot_cells_farm_plot ON plot_cells(farm_plot_id);
CREATE INDEX idx_plot_cells_geometry ON plot_cells USING GIST(geometry);
CREATE INDEX idx_plot_cells_center ON plot_cells USING GIST(center_point);
CREATE INDEX idx_plot_cells_position ON plot_cells(farm_plot_id, row_index, col_index);
CREATE INDEX idx_plot_cells_status ON plot_cells(farm_plot_id, is_cultivated);

-- セル位置のユニーク制約
CREATE UNIQUE INDEX idx_plot_cells_unique_position 
ON plot_cells(farm_plot_id, row_index, col_index);

-- ====================================================================
-- 3. 野菜-メッシュセル関連テーブル (vegetable_cells)
-- ====================================================================
CREATE TABLE vegetable_cells (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vegetable_id uuid NOT NULL REFERENCES vegetables(id) ON DELETE CASCADE,
    plot_cell_id uuid NOT NULL REFERENCES plot_cells(id) ON DELETE CASCADE,
    
    -- 栽培情報
    planting_date date NOT NULL,
    expected_harvest_date date,
    actual_harvest_date date,
    
    -- セル単位での栽培状況
    plant_count integer DEFAULT 1,        -- このセルでの株数
    growth_stage text,                    -- 成長段階
    health_status text DEFAULT 'healthy', -- 健康状態 ("healthy", "diseased", "pest_damaged")
    
    -- 収穫データ
    harvest_quantity decimal(8,2),        -- 収穫量
    harvest_unit text,                    -- 収穫単位 ("kg", "pieces")
    harvest_quality text,                 -- 収穫品質
    
    -- 作業記録関連
    last_watered_date date,
    last_fertilized_date date,
    last_weeded_date date,
    
    -- メタデータ
    notes text,
    created_by uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 野菜セルテーブルのインデックス
CREATE INDEX idx_vegetable_cells_vegetable ON vegetable_cells(vegetable_id);
CREATE INDEX idx_vegetable_cells_cell ON vegetable_cells(plot_cell_id);
CREATE INDEX idx_vegetable_cells_dates ON vegetable_cells(planting_date, expected_harvest_date);
CREATE INDEX idx_vegetable_cells_status ON vegetable_cells(health_status, growth_stage);

-- 同じセルに同じ野菜を重複登録防止
CREATE UNIQUE INDEX idx_vegetable_cells_unique 
ON vegetable_cells(vegetable_id, plot_cell_id);

-- ====================================================================
-- 4. 住所検索キャッシュテーブル (address_geocoding_cache)
-- ====================================================================
CREATE TABLE address_geocoding_cache (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    query text NOT NULL,                  -- 検索クエリ
    query_type text NOT NULL,             -- "address", "coordinates", "postal_code"
    
    -- 結果データ
    latitude decimal(10,6),
    longitude decimal(10,6),
    formatted_address text,
    prefecture text,
    city text,
    
    -- キャッシュ管理
    source text NOT NULL,                 -- "gsi_api", "manual"
    confidence_score decimal(3,2),        -- 信頼度スコア (0.0-1.0)
    expires_at timestamptz DEFAULT (now() + interval '30 days'),
    
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 住所キャッシュテーブルのインデックス
CREATE INDEX idx_geocoding_cache_query ON address_geocoding_cache(query, query_type);
CREATE INDEX idx_geocoding_cache_coords ON address_geocoding_cache(latitude, longitude);
CREATE INDEX idx_geocoding_cache_expires ON address_geocoding_cache(expires_at);

-- クエリのユニーク制約
CREATE UNIQUE INDEX idx_geocoding_cache_unique_query 
ON address_geocoding_cache(query, query_type);

-- ====================================================================
-- 5. 既存vegetablesテーブルに農地関連カラム追加
-- ====================================================================
ALTER TABLE vegetables ADD COLUMN IF NOT EXISTS farm_plot_id uuid REFERENCES farm_plots(id);
ALTER TABLE vegetables ADD COLUMN IF NOT EXISTS selected_cells_count integer DEFAULT 0;
ALTER TABLE vegetables ADD COLUMN IF NOT EXISTS total_cultivation_area_sqm decimal(10,2);

-- 新しいインデックス
CREATE INDEX IF NOT EXISTS idx_vegetables_farm_plot ON vegetables(farm_plot_id);

-- ====================================================================
-- 6. トリガー関数とトリガーの作成
-- ====================================================================

-- 農地の更新時刻自動更新
CREATE OR REPLACE FUNCTION update_farm_plots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_farm_plots_updated_at
    BEFORE UPDATE ON farm_plots
    FOR EACH ROW EXECUTE FUNCTION update_farm_plots_updated_at();

-- メッシュセルの更新時刻自動更新
CREATE TRIGGER trigger_plot_cells_updated_at
    BEFORE UPDATE ON plot_cells
    FOR EACH ROW EXECUTE FUNCTION update_farm_plots_updated_at();

-- 野菜セルの更新時刻自動更新
CREATE TRIGGER trigger_vegetable_cells_updated_at
    BEFORE UPDATE ON vegetable_cells
    FOR EACH ROW EXECUTE FUNCTION update_farm_plots_updated_at();

-- 野菜セル数の自動カウント更新
CREATE OR REPLACE FUNCTION update_vegetable_cells_count()
RETURNS TRIGGER AS $$
BEGIN
    -- 野菜追加時/削除時に選択セル数を更新
    IF TG_OP = 'INSERT' THEN
        UPDATE vegetables 
        SET 
            selected_cells_count = (
                SELECT COUNT(*) 
                FROM vegetable_cells 
                WHERE vegetable_id = NEW.vegetable_id
            ),
            total_cultivation_area_sqm = (
                SELECT COALESCE(SUM(pc.area_sqm), 0)
                FROM vegetable_cells vc
                JOIN plot_cells pc ON vc.plot_cell_id = pc.id
                WHERE vc.vegetable_id = NEW.vegetable_id
            )
        WHERE id = NEW.vegetable_id;
        
        -- セルの栽培状態更新
        UPDATE plot_cells 
        SET 
            is_cultivated = true,
            vegetable_count = (
                SELECT COUNT(*) 
                FROM vegetable_cells 
                WHERE plot_cell_id = NEW.plot_cell_id
            ),
            last_cultivation_date = NEW.planting_date
        WHERE id = NEW.plot_cell_id;
        
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE vegetables 
        SET 
            selected_cells_count = (
                SELECT COUNT(*) 
                FROM vegetable_cells 
                WHERE vegetable_id = OLD.vegetable_id
            ),
            total_cultivation_area_sqm = (
                SELECT COALESCE(SUM(pc.area_sqm), 0)
                FROM vegetable_cells vc
                JOIN plot_cells pc ON vc.plot_cell_id = pc.id
                WHERE vc.vegetable_id = OLD.vegetable_id
            )
        WHERE id = OLD.vegetable_id;
        
        -- セルの栽培状態更新
        UPDATE plot_cells 
        SET 
            vegetable_count = (
                SELECT COUNT(*) 
                FROM vegetable_cells 
                WHERE plot_cell_id = OLD.plot_cell_id
            ),
            is_cultivated = (
                SELECT COUNT(*) > 0
                FROM vegetable_cells 
                WHERE plot_cell_id = OLD.plot_cell_id
            )
        WHERE id = OLD.plot_cell_id;
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_vegetable_cells_count
    AFTER INSERT OR DELETE ON vegetable_cells
    FOR EACH ROW EXECUTE FUNCTION update_vegetable_cells_count();

-- ====================================================================
-- 7. 初期サンプルデータ（開発・テスト用）
-- ====================================================================

-- サンプル農地データ（関東地方の農地）
INSERT INTO farm_plots (
    company_id,
    name, 
    description,
    area_hectares,
    geometry,
    prefecture,
    city,
    address,
    postal_code,
    created_by
) VALUES 
(
    (SELECT id FROM companies WHERE name LIKE '%テスト%' LIMIT 1),
    'テスト農場第1圃場',
    '農地編集機能テスト用の農場データです',
    0.1, -- 1000㎡ = 0.1ha
    ST_GeomFromText('POLYGON((139.6917 35.6895, 139.6920 35.6895, 139.6920 35.6892, 139.6917 35.6892, 139.6917 35.6895))', 4326),
    '東京都',
    '新宿区',
    '新宿1-1-1',
    '160-0022',
    (SELECT id FROM users WHERE email LIKE '%@%' LIMIT 1)
),
(
    (SELECT id FROM companies WHERE name LIKE '%テスト%' LIMIT 1),
    'テスト農場第2圃場',
    'より大きな農場でのメッシュテスト用',
    0.25, -- 2500㎡ = 0.25ha  
    ST_GeomFromText('POLYGON((139.6925 35.6900, 139.6930 35.6900, 139.6930 35.6895, 139.6925 35.6895, 139.6925 35.6900))', 4326),
    '東京都', 
    '新宿区',
    '新宿2-2-2',
    '160-0022',
    (SELECT id FROM users WHERE email LIKE '%@%' LIMIT 1)
);

-- 期限切れジオコーディングキャッシュのクリーンアップ関数
CREATE OR REPLACE FUNCTION cleanup_expired_geocoding_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM address_geocoding_cache WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- コメント追加
COMMENT ON TABLE farm_plots IS '農地ポリゴン情報を管理するテーブル';
COMMENT ON TABLE plot_cells IS '5m×5mメッシュセル情報を管理するテーブル';  
COMMENT ON TABLE vegetable_cells IS '野菜とメッシュセルの関連を管理するテーブル';
COMMENT ON TABLE address_geocoding_cache IS '住所検索結果のキャッシュテーブル';

-- ====================================================================
-- END OF MIGRATION
-- ====================================================================