-- ====================================================================
-- 野菜栽培管理システム - サンプルデータ投入（簡略版）
-- ====================================================================

-- ====================================================================
-- 1. 野菜品種マスターデータ
-- ====================================================================
INSERT INTO vegetable_varieties (name, variety, category, standard_growth_days, planting_season, harvest_season, standard_tasks, optimal_temperature_min, optimal_temperature_max, soil_ph_min, soil_ph_max, water_requirement, sunlight_requirement) VALUES
-- 果菜類
('トマト', '桃太郎', '果菜類', 120, '春', '夏〜秋', '[
    {"name": "種まき", "days_from_start": 0, "duration": 1},
    {"name": "移植", "days_from_start": 30, "duration": 1},
    {"name": "支柱立て", "days_from_start": 45, "duration": 1},
    {"name": "追肥(1回目)", "days_from_start": 60, "duration": 1},
    {"name": "追肥(2回目)", "days_from_start": 90, "duration": 1},
    {"name": "収穫開始", "days_from_start": 100, "duration": 30}
]', 18, 28, 6.0, 6.8, '多', '全日照'),

('トマト', 'アイコ', '果菜類', 110, '春', '夏〜秋', '[
    {"name": "種まき", "days_from_start": 0, "duration": 1},
    {"name": "移植", "days_from_start": 30, "duration": 1},
    {"name": "支柱立て", "days_from_start": 40, "duration": 1},
    {"name": "追肥(1回目)", "days_from_start": 55, "duration": 1},
    {"name": "追肥(2回目)", "days_from_start": 80, "duration": 1},
    {"name": "収穫開始", "days_from_start": 90, "duration": 35}
]', 18, 28, 6.0, 6.8, '多', '全日照'),

('キュウリ', '四葉', '果菜類', 90, '春〜夏', '夏〜秋', '[
    {"name": "種まき", "days_from_start": 0, "duration": 1},
    {"name": "移植", "days_from_start": 25, "duration": 1},
    {"name": "支柱・ネット設置", "days_from_start": 35, "duration": 1},
    {"name": "追肥(1回目)", "days_from_start": 45, "duration": 1},
    {"name": "追肥(2回目)", "days_from_start": 65, "duration": 1},
    {"name": "収穫開始", "days_from_start": 60, "duration": 45}
]', 15, 25, 6.0, 6.5, '多', '全日照'),

('ナス', '千両二号', '果菜類', 130, '春', '夏〜秋', '[
    {"name": "種まき", "days_from_start": 0, "duration": 1},
    {"name": "移植", "days_from_start": 35, "duration": 1},
    {"name": "支柱立て", "days_from_start": 50, "duration": 1},
    {"name": "追肥(1回目)", "days_from_start": 70, "duration": 1},
    {"name": "追肥(2回目)", "days_from_start": 100, "duration": 1},
    {"name": "収穫開始", "days_from_start": 90, "duration": 60}
]', 20, 30, 6.0, 6.5, '多', '全日照'),

-- 葉菜類
('レタス', 'グリーンリーフ', '葉菜類', 60, '春・秋', '春・秋', '[
    {"name": "種まき", "days_from_start": 0, "duration": 1},
    {"name": "間引き(1回目)", "days_from_start": 10, "duration": 1},
    {"name": "間引き(2回目)", "days_from_start": 20, "duration": 1},
    {"name": "追肥", "days_from_start": 30, "duration": 1},
    {"name": "収穫", "days_from_start": 50, "duration": 10}
]', 15, 20, 6.0, 6.5, '中', '半日照'),

('キャベツ', '金系201号', '葉菜類', 90, '春・夏・秋', '春・夏・秋・冬', '[
    {"name": "種まき", "days_from_start": 0, "duration": 1},
    {"name": "移植", "days_from_start": 30, "duration": 1},
    {"name": "追肥(1回目)", "days_from_start": 45, "duration": 1},
    {"name": "追肥(2回目)", "days_from_start": 60, "duration": 1},
    {"name": "収穫", "days_from_start": 85, "duration": 5}
]', 15, 22, 6.0, 6.5, '中', '全日照'),

('ほうれん草', '次郎丸', '葉菜類', 45, '春・秋・冬', '春・秋・冬', '[
    {"name": "種まき", "days_from_start": 0, "duration": 1},
    {"name": "間引き", "days_from_start": 15, "duration": 1},
    {"name": "追肥", "days_from_start": 25, "duration": 1},
    {"name": "収穫", "days_from_start": 40, "duration": 5}
]', 15, 20, 6.0, 7.0, '中', '半日照'),

-- 根菜類
('大根', '青首', '根菜類', 70, '春・秋', '夏・秋・冬', '[
    {"name": "種まき", "days_from_start": 0, "duration": 1},
    {"name": "間引き(1回目)", "days_from_start": 10, "duration": 1},
    {"name": "間引き(2回目)", "days_from_start": 20, "duration": 1},
    {"name": "追肥", "days_from_start": 35, "duration": 1},
    {"name": "収穫", "days_from_start": 65, "duration": 10}
]', 15, 25, 5.5, 6.5, '中', '全日照'),

('人参', '五寸人参', '根菜類', 90, '春・夏', '夏・秋', '[
    {"name": "種まき", "days_from_start": 0, "duration": 1},
    {"name": "間引き(1回目)", "days_from_start": 15, "duration": 1},
    {"name": "間引き(2回目)", "days_from_start": 30, "duration": 1},
    {"name": "追肥", "days_from_start": 50, "duration": 1},
    {"name": "収穫", "days_from_start": 85, "duration": 10}
]', 15, 25, 5.5, 6.8, '中', '全日照'),

('じゃがいも', '男爵', '根菜類', 100, '春・秋', '夏・冬', '[
    {"name": "植付", "days_from_start": 0, "duration": 1},
    {"name": "芽かき", "days_from_start": 30, "duration": 1},
    {"name": "土寄せ(1回目)", "days_from_start": 40, "duration": 1},
    {"name": "土寄せ(2回目)", "days_from_start": 60, "duration": 1},
    {"name": "収穫", "days_from_start": 95, "duration": 5}
]', 15, 24, 5.0, 6.0, '少', '全日照');

-- ====================================================================
-- 2. サンプル企業データ
-- ====================================================================
INSERT INTO companies (id, name, plan_type, contact_email, contact_phone, prefecture, city, max_users, max_vegetables) VALUES
('a1111111-1111-1111-1111-111111111111', '株式会社グリーンファーム', 'premium', 'contact@greenfarm.example.com', '03-1234-5678', '茨城県', '水戸市', 20, 100),
('b2222222-2222-2222-2222-222222222222', '農業法人アグリテック', 'enterprise', 'info@agritech.example.com', '03-2345-6789', '千葉県', '千葉市', 50, 200),
('c3333333-3333-3333-3333-333333333333', '田中農園', 'basic', 'tanaka@farm.example.com', '03-3456-7890', '群馬県', '前橋市', 5, 30);

-- ====================================================================
-- 3. サンプル野菜データ（グリーンファーム用） - created_byなし
-- ====================================================================
INSERT INTO vegetables (id, company_id, variety_id, name, variety_name, plot_name, area_size, plant_count, planting_date, expected_harvest_start, expected_harvest_end, status) VALUES
('d1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 
 (SELECT id FROM vegetable_varieties WHERE name = 'トマト' AND variety = '桃太郎' LIMIT 1), 
 'A棟トマト（桃太郎）', '桃太郎', 'A棟温室', 100.0, 50, '2024-03-01', '2024-06-10', '2024-08-31', 'growing'),

('d2222222-2222-2222-2222-222222222222', 'a1111111-1111-1111-1111-111111111111',
 (SELECT id FROM vegetable_varieties WHERE name = 'キュウリ' AND variety = '四葉' LIMIT 1),
 'B棟キュウリ（四葉）', '四葉', 'B棟温室', 80.0, 40, '2024-03-15', '2024-05-20', '2024-07-15', 'growing'),

('d3333333-3333-3333-3333-333333333333', 'a1111111-1111-1111-1111-111111111111',
 (SELECT id FROM vegetable_varieties WHERE name = 'レタス' AND variety = 'グリーンリーフ' LIMIT 1),
 '露地レタス（春作）', 'グリーンリーフ', '露地第1圃場', 200.0, 200, '2024-03-20', '2024-05-10', '2024-05-25', 'planning'),

('d4444444-4444-4444-4444-444444444444', 'a1111111-1111-1111-1111-111111111111',
 (SELECT id FROM vegetable_varieties WHERE name = 'ナス' AND variety = '千両二号' LIMIT 1),
 'C棟ナス（千両二号）', '千両二号', 'C棟温室', 120.0, 60, '2024-02-15', '2024-05-15', '2024-08-15', 'growing');

-- ====================================================================
-- 4. 補足：ユーザー関連データについて
-- ====================================================================
-- 
-- 以下のデータはSupabase Authでユーザー登録を行った後に追加してください：
--
-- 1. growing_tasks（タスク）
-- 2. operation_logs（作業記録）
-- 3. photos（写真）
-- 4. notifications（通知）
--
-- これらは全てcreated_byフィールドが必須のため、
-- 実際のユーザーアカウント作成後に手動で追加するか、
-- アプリケーションから追加してください。
--
-- サンプルSQLは以下に記載しています：

/*
-- ユーザー登録後に実行するサンプルタスク
INSERT INTO growing_tasks (vegetable_id, name, description, task_type, priority, status, start_date, end_date, progress, created_by) VALUES
('d1111111-1111-1111-1111-111111111111', '種まき', 'トマト桃太郎の種まき作業', 'seeding', 'high', 'completed', '2024-03-01', '2024-03-01', 100, auth.uid()),
('d1111111-1111-1111-1111-111111111111', '移植', '育苗トレイから本圃場への移植', 'transplanting', 'high', 'completed', '2024-03-30', '2024-03-30', 100, auth.uid()),
('d1111111-1111-1111-1111-111111111111', '支柱立て', '支柱とネットの設置', 'other', 'medium', 'completed', '2024-04-15', '2024-04-15', 100, auth.uid());

-- ユーザー登録後に実行するサンプル作業記録
INSERT INTO operation_logs (vegetable_id, date, work_type, work_notes, weather, temperature_morning, temperature_afternoon, work_hours, created_by) VALUES
('d1111111-1111-1111-1111-111111111111', '2024-03-01', 'seeding', 'トマト桃太郎200粒播種完了。発芽率良好の種子を使用。', '晴れ', 12.5, 18.2, 2.0, auth.uid()),
('d1111111-1111-1111-1111-111111111111', '2024-03-30', 'transplanting', '育苗した苗50株を本圃場に移植。株間30cm、条間40cmで配置。', '曇り', 15.8, 22.1, 3.5, auth.uid());
*/