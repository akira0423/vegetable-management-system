-- デモ用野菜管理テーブルの作成（本番vegetablesテーブルと同じ構造）
CREATE TABLE IF NOT EXISTS demo_vegetables (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL DEFAULT 'a1111111-1111-1111-1111-111111111111', -- デモ用固定ID
  name TEXT NOT NULL,
  variety_name TEXT,
  plot_name TEXT,
  area_size NUMERIC,
  plant_count INTEGER,
  planting_date DATE NOT NULL,
  expected_harvest_start DATE,
  expected_harvest_end DATE,
  actual_harvest_start DATE,
  actual_harvest_end DATE,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status = ANY (ARRAY['planning'::text, 'growing'::text, 'harvesting'::text, 'completed'::text])),
  notes TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  spatial_data JSONB,
  polygon_coordinates JSONB,
  plot_center_lat NUMERIC,
  plot_center_lng NUMERIC,
  polygon_color VARCHAR DEFAULT '#22c55e',
  -- デモ版用の追加フィールド
  has_spatial_data BOOLEAN GENERATED ALWAYS AS (spatial_data IS NOT NULL OR polygon_coordinates IS NOT NULL) STORED,
  farm_area_data JSONB, -- 互換性のため残す
  CONSTRAINT demo_vegetables_pkey PRIMARY KEY (id)
);

-- サンプルデータの投入
INSERT INTO demo_vegetables (
  company_id,
  name,
  variety_name,
  plot_name,
  area_size,
  plant_count,
  planting_date,
  expected_harvest_start,
  expected_harvest_end,
  status,
  spatial_data,
  polygon_coordinates,
  plot_center_lat,
  plot_center_lng,
  polygon_color,
  farm_area_data,
  notes
) VALUES
(
  'a1111111-1111-1111-1111-111111111111',
  'トマト',
  'サンマルツァーノ',
  '東農地A-1',
  2500.50,
  500,
  '2025-04-15',
  '2025-07-01',
  '2025-09-30',
  'planning',
  '{
    "type": "Polygon",
    "coordinates": [[[139.6917, 35.6895], [139.6927, 35.6895], [139.6927, 35.6885], [139.6917, 35.6885], [139.6917, 35.6895]]]
  }'::jsonb,
  '[[[139.6917, 35.6895], [139.6927, 35.6895], [139.6927, 35.6885], [139.6917, 35.6885], [139.6917, 35.6895]]]'::jsonb,
  35.6890,
  139.6922,
  '#ef4444',
  '{
    "geometry": {
      "type": "Polygon",
      "coordinates": [[[139.6917, 35.6895], [139.6927, 35.6895], [139.6927, 35.6885], [139.6917, 35.6885], [139.6917, 35.6895]]]
    },
    "name": "東農地A-1",
    "area_square_meters": 2500.50
  }'::jsonb,
  'イタリアン料理用の加工用トマト。水はけの良い土壌で栽培予定。'
),
(
  'a1111111-1111-1111-1111-111111111111',
  'キャベツ',
  '金系201号',
  '北農地B-2',
  3200.00,
  800,
  '2025-03-20',
  '2025-06-15',
  '2025-07-15',
  'growing',
  '{
    "type": "Polygon",
    "coordinates": [[[139.6937, 35.6905], [139.6947, 35.6905], [139.6947, 35.6895], [139.6937, 35.6895], [139.6937, 35.6905]]]
  }'::jsonb,
  '[[[139.6937, 35.6905], [139.6947, 35.6905], [139.6947, 35.6895], [139.6937, 35.6895], [139.6937, 35.6905]]]'::jsonb,
  35.6900,
  139.6942,
  '#22c55e',
  '{
    "geometry": {
      "type": "Polygon",
      "coordinates": [[[139.6937, 35.6905], [139.6947, 35.6905], [139.6947, 35.6895], [139.6937, 35.6895], [139.6937, 35.6905]]]
    },
    "name": "北農地B-2",
    "area_square_meters": 3200.00
  }'::jsonb,
  '春キャベツの主力品種。病害虫対策を強化中。'
),
(
  'a1111111-1111-1111-1111-111111111111',
  'ナス',
  '千両二号',
  '南農地C-3',
  1800.75,
  300,
  '2025-05-01',
  '2025-07-20',
  '2025-10-31',
  'growing',
  '{
    "type": "Polygon",
    "coordinates": [[[139.6907, 35.6875], [139.6917, 35.6875], [139.6917, 35.6865], [139.6907, 35.6865], [139.6907, 35.6875]]]
  }'::jsonb,
  '[[[139.6907, 35.6875], [139.6917, 35.6875], [139.6917, 35.6865], [139.6907, 35.6865], [139.6907, 35.6875]]]'::jsonb,
  35.6870,
  139.6912,
  '#8b5cf6',
  '{
    "geometry": {
      "type": "Polygon",
      "coordinates": [[[139.6907, 35.6875], [139.6917, 35.6875], [139.6917, 35.6865], [139.6907, 35.6865], [139.6907, 35.6875]]]
    },
    "name": "南農地C-3",
    "area_square_meters": 1800.75
  }'::jsonb,
  '長期収穫可能な品種。支柱立て完了済み。'
),
(
  'a1111111-1111-1111-1111-111111111111',
  'ダイコン',
  '青首大根',
  '西農地D-4',
  4500.00,
  1500,
  '2025-09-01',
  '2025-11-15',
  '2025-12-31',
  'planning',
  null,
  null,
  null,
  null,
  '#3b82f6',
  null,
  '秋冬野菜の主力。土壌改良を実施予定。'
),
(
  'a1111111-1111-1111-1111-111111111111',
  'レタス',
  'シスコ',
  '中央農地E-5',
  1200.00,
  600,
  '2025-03-01',
  '2025-05-01',
  '2025-05-31',
  'harvesting',
  '{
    "type": "Polygon",
    "coordinates": [[[139.6927, 35.6885], [139.6937, 35.6885], [139.6937, 35.6875], [139.6927, 35.6875], [139.6927, 35.6885]]]
  }'::jsonb,
  '[[[139.6927, 35.6885], [139.6937, 35.6885], [139.6937, 35.6875], [139.6927, 35.6875], [139.6927, 35.6885]]]'::jsonb,
  35.6880,
  139.6932,
  '#10b981',
  '{
    "geometry": {
      "type": "Polygon",
      "coordinates": [[[139.6927, 35.6885], [139.6937, 35.6885], [139.6937, 35.6875], [139.6927, 35.6875], [139.6927, 35.6885]]]
    },
    "name": "中央農地E-5",
    "area_square_meters": 1200.00
  }'::jsonb,
  '結球レタス。現在収穫中、品質良好。'
);

-- インデックスの作成
CREATE INDEX idx_demo_vegetables_status ON demo_vegetables(status);
CREATE INDEX idx_demo_vegetables_planting_date ON demo_vegetables(planting_date);
CREATE INDEX idx_demo_vegetables_has_spatial_data ON demo_vegetables(has_spatial_data);