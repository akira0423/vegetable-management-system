-- ====================================================================
-- GeoJSON 変換関数 - 012_geojson_functions.sql
-- ====================================================================

-- 農地エリアのgeometryをGeoJSONに変換する関数
CREATE OR REPLACE FUNCTION st_asgeojson_farm_area(farm_area_id uuid)
RETURNS text AS $$
DECLARE
    geom_geojson text;
BEGIN
    SELECT ST_AsGeoJSON(geometry, 6) -- 6桁精度
    INTO geom_geojson
    FROM farm_areas
    WHERE id = farm_area_id;
    
    IF geom_geojson IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- GeoJSON Featureとして返す
    RETURN json_build_object(
        'type', 'Feature',
        'geometry', geom_geojson::jsonb,
        'properties', json_build_object(
            'farm_area_id', farm_area_id
        )
    )::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 複数の農地エリアをGeoJSON FeatureCollectionとして取得
CREATE OR REPLACE FUNCTION get_farm_areas_geojson(company_id_param uuid)
RETURNS text AS $$
DECLARE
    features jsonb[];
    feature_record record;
BEGIN
    features := ARRAY[]::jsonb[];
    
    FOR feature_record IN
        SELECT 
            id,
            name,
            ST_AsGeoJSON(geometry, 6) as geom_json,
            area_hectares,
            status,
            created_at
        FROM farm_areas 
        WHERE company_id = company_id_param 
          AND status != 'archived'
        ORDER BY name
    LOOP
        features := array_append(features, jsonb_build_object(
            'type', 'Feature',
            'geometry', feature_record.geom_json::jsonb,
            'properties', jsonb_build_object(
                'id', feature_record.id,
                'name', feature_record.name,
                'area_hectares', feature_record.area_hectares,
                'status', feature_record.status,
                'created_at', feature_record.created_at
            )
        ));
    END LOOP;
    
    RETURN jsonb_build_object(
        'type', 'FeatureCollection',
        'features', to_jsonb(features)
    )::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- セルメッシュをGeoJSONに変換する関数（将来用）
CREATE OR REPLACE FUNCTION cells_to_geojson(cell_data jsonb[])
RETURNS text AS $$
DECLARE
    features jsonb[];
    cell_record jsonb;
    cell_geom geometry;
BEGIN
    features := ARRAY[]::jsonb[];
    
    FOREACH cell_record IN ARRAY cell_data
    LOOP
        -- セルのboundsからPolygonを作成
        WITH bounds AS (
            SELECT 
                (cell_record->>'west')::decimal as west,
                (cell_record->>'south')::decimal as south,
                (cell_record->>'east')::decimal as east,
                (cell_record->>'north')::decimal as north
        )
        SELECT ST_MakeEnvelope(west, south, east, north, 4326)
        INTO cell_geom
        FROM bounds;
        
        features := array_append(features, jsonb_build_object(
            'type', 'Feature',
            'geometry', ST_AsGeoJSON(cell_geom, 6)::jsonb,
            'properties', cell_record
        ));
    END LOOP;
    
    RETURN jsonb_build_object(
        'type', 'FeatureCollection',
        'features', to_jsonb(features)
    )::text;
END;
$$ LANGUAGE plpgsql;

-- 農地エリア内のポイントが含まれるかチェック
CREATE OR REPLACE FUNCTION point_in_farm_area(
    farm_area_id uuid,
    longitude decimal,
    latitude decimal
)
RETURNS boolean AS $$
DECLARE
    contains_point boolean;
BEGIN
    SELECT ST_Contains(geometry, ST_Point(longitude, latitude))
    INTO contains_point
    FROM farm_areas
    WHERE id = farm_area_id;
    
    RETURN COALESCE(contains_point, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 農地エリアの境界ボックスを取得
CREATE OR REPLACE FUNCTION get_farm_area_bbox(farm_area_id uuid)
RETURNS jsonb AS $$
DECLARE
    bbox_result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'west', ST_XMin(geometry),
        'south', ST_YMin(geometry),
        'east', ST_XMax(geometry),
        'north', ST_YMax(geometry)
    )
    INTO bbox_result
    FROM farm_areas
    WHERE id = farm_area_id;
    
    RETURN bbox_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 権限設定
GRANT EXECUTE ON FUNCTION st_asgeojson_farm_area(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_farm_areas_geojson(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION cells_to_geojson(jsonb[]) TO authenticated;
GRANT EXECUTE ON FUNCTION point_in_farm_area(uuid, decimal, decimal) TO authenticated;
GRANT EXECUTE ON FUNCTION get_farm_area_bbox(uuid) TO authenticated;

-- ====================================================================
-- END OF MIGRATION
-- ====================================================================