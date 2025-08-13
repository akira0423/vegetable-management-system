-- ====================================================================
-- 野菜栽培管理システム - サンプルデータ投入（Auth対応版）
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
-- 3. サンプルユーザーをauth.usersに直接作成（テスト用）
-- ====================================================================
-- 注意: 本来はSupabase Authのサインアップ機能で作成しますが、テスト用に直接挿入
INSERT INTO auth.users (
    id, 
    aud, 
    role, 
    email, 
    email_confirmed_at,
    phone_confirmed_at,
    confirmation_sent_at,
    recovery_sent_at,
    email_change_sent_at,
    new_email,
    new_phone,
    invited_at,
    action_link,
    email_change,
    phone_change,
    phone_change_token,
    email_change_token_current,
    email_change_token_new,
    recovery_token,
    reauthentication_token,
    reauthentication_sent_at,
    is_sso_user,
    deleted_at,
    is_anonymous,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    phone,
    phone_change_sent_at,
    confirmed_at,
    email_change_confirm_status,
    banned_until,
    encrypted_password,
    email_change_token,
    instance_id
) VALUES 
('e1111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'system@greenfarm.example.com', now(), null, null, null, null, '', '', null, '', '', '', '', '', '', '', '', null, false, null, false, '{}', '{"full_name": "システム管理者"}', now(), now(), '', null, now(), 0, null, '', '', '00000000-0000-0000-0000-000000000000'),
('e2222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'system@agritech.example.com', now(), null, null, null, null, '', '', null, '', '', '', '', '', '', '', '', null, false, null, false, '{}', '{"full_name": "システム管理者"}', now(), now(), '', null, now(), 0, null, '', '', '00000000-0000-0000-0000-000000000000'),
('e3333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'system@tanaka-farm.example.com', now(), null, null, null, null, '', '', null, '', '', '', '', '', '', '', '', null, false, null, false, '{}', '{"full_name": "システム管理者"}', now(), now(), '', null, now(), 0, null, '', '', '00000000-0000-0000-0000-000000000000');

-- ====================================================================
-- 4. サンプルシステムユーザー（public.users）
-- ====================================================================
INSERT INTO users (id, company_id, email, full_name, role) VALUES
('e1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'system@greenfarm.example.com', 'システム管理者', 'admin'),
('e2222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222', 'system@agritech.example.com', 'システム管理者', 'admin'),
('e3333333-3333-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', 'system@tanaka-farm.example.com', 'システム管理者', 'admin');

-- ====================================================================
-- 5. サンプル野菜データ（グリーンファーム用）
-- ====================================================================
INSERT INTO vegetables (id, company_id, variety_id, name, variety_name, plot_name, area_size, plant_count, planting_date, expected_harvest_start, expected_harvest_end, status, created_by) VALUES
('d1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 
 (SELECT id FROM vegetable_varieties WHERE name = 'トマト' AND variety = '桃太郎' LIMIT 1), 
 'A棟トマト（桃太郎）', '桃太郎', 'A棟温室', 100.0, 50, '2024-03-01', '2024-06-10', '2024-08-31', 'growing', 'e1111111-1111-1111-1111-111111111111'),

('d2222222-2222-2222-2222-222222222222', 'a1111111-1111-1111-1111-111111111111',
 (SELECT id FROM vegetable_varieties WHERE name = 'キュウリ' AND variety = '四葉' LIMIT 1),
 'B棟キュウリ（四葉）', '四葉', 'B棟温室', 80.0, 40, '2024-03-15', '2024-05-20', '2024-07-15', 'growing', 'e1111111-1111-1111-1111-111111111111'),

('d3333333-3333-3333-3333-333333333333', 'a1111111-1111-1111-1111-111111111111',
 (SELECT id FROM vegetable_varieties WHERE name = 'レタス' AND variety = 'グリーンリーフ' LIMIT 1),
 '露地レタス（春作）', 'グリーンリーフ', '露地第1圃場', 200.0, 200, '2024-03-20', '2024-05-10', '2024-05-25', 'planning', 'e1111111-1111-1111-1111-111111111111'),

('d4444444-4444-4444-4444-444444444444', 'a1111111-1111-1111-1111-111111111111',
 (SELECT id FROM vegetable_varieties WHERE name = 'ナス' AND variety = '千両二号' LIMIT 1),
 'C棟ナス（千両二号）', '千両二号', 'C棟温室', 120.0, 60, '2024-02-15', '2024-05-15', '2024-08-15', 'growing', 'e1111111-1111-1111-1111-111111111111');

-- ====================================================================
-- 6. サンプル栽培タスク
-- ====================================================================
INSERT INTO growing_tasks (vegetable_id, name, description, task_type, priority, status, start_date, end_date, progress, created_by) VALUES
-- A棟トマトのタスク
('d1111111-1111-1111-1111-111111111111', '種まき', 'トマト桃太郎の種まき作業', 'seeding', 'high', 'completed', '2024-03-01', '2024-03-01', 100, 'e1111111-1111-1111-1111-111111111111'),
('d1111111-1111-1111-1111-111111111111', '移植', '育苗トレイから本圃場への移植', 'transplanting', 'high', 'completed', '2024-03-30', '2024-03-30', 100, 'e1111111-1111-1111-1111-111111111111'),
('d1111111-1111-1111-1111-111111111111', '支柱立て', '支柱とネットの設置', 'other', 'medium', 'completed', '2024-04-15', '2024-04-15', 100, 'e1111111-1111-1111-1111-111111111111'),
('d1111111-1111-1111-1111-111111111111', '第1回追肥', '開花期の追肥作業', 'fertilizing', 'medium', 'in_progress', '2024-05-01', '2024-05-01', 50, 'e1111111-1111-1111-1111-111111111111'),
('d1111111-1111-1111-1111-111111111111', '第2回追肥', '果実肥大期の追肥', 'fertilizing', 'medium', 'pending', '2024-06-01', '2024-06-01', 0, 'e1111111-1111-1111-1111-111111111111'),
('d1111111-1111-1111-1111-111111111111', '収穫開始', 'トマトの収穫作業開始', 'harvesting', 'high', 'pending', '2024-06-10', '2024-08-31', 0, 'e1111111-1111-1111-1111-111111111111'),

-- B棟キュウリのタスク
('d2222222-2222-2222-2222-222222222222', '種まき', 'キュウリ四葉の種まき', 'seeding', 'high', 'completed', '2024-03-15', '2024-03-15', 100, 'e1111111-1111-1111-1111-111111111111'),
('d2222222-2222-2222-2222-222222222222', '移植', 'キュウリの移植作業', 'transplanting', 'high', 'completed', '2024-04-10', '2024-04-10', 100, 'e1111111-1111-1111-1111-111111111111'),
('d2222222-2222-2222-2222-222222222222', 'ネット張り', 'キュウリ用ネットの設置', 'other', 'medium', 'completed', '2024-04-20', '2024-04-20', 100, 'e1111111-1111-1111-1111-111111111111'),
('d2222222-2222-2222-2222-222222222222', '第1回追肥', 'キュウリ第1回追肥', 'fertilizing', 'medium', 'completed', '2024-05-01', '2024-05-01', 100, 'e1111111-1111-1111-1111-111111111111'),
('d2222222-2222-2222-2222-222222222222', '収穫準備', '収穫用コンテナ準備', 'other', 'low', 'pending', '2024-05-18', '2024-05-20', 0, 'e1111111-1111-1111-1111-111111111111'),

-- 露地レタスのタスク
('d3333333-3333-3333-3333-333333333333', '畑準備', '露地圃場の耕起・施肥', 'other', 'high', 'pending', '2024-03-18', '2024-03-19', 0, 'e1111111-1111-1111-1111-111111111111'),
('d3333333-3333-3333-3333-333333333333', '種まき', 'レタスの直播作業', 'seeding', 'high', 'pending', '2024-03-20', '2024-03-20', 0, 'e1111111-1111-1111-1111-111111111111'),
('d3333333-3333-3333-3333-333333333333', '第1回間引き', 'レタスの間引き作業', 'other', 'medium', 'pending', '2024-03-30', '2024-03-30', 0, 'e1111111-1111-1111-1111-111111111111'),
('d3333333-3333-3333-3333-333333333333', '第2回間引き', 'レタス最終間引き', 'other', 'medium', 'pending', '2024-04-10', '2024-04-10', 0, 'e1111111-1111-1111-1111-111111111111'),
('d3333333-3333-3333-3333-333333333333', '追肥作業', 'レタス追肥', 'fertilizing', 'medium', 'pending', '2024-04-20', '2024-04-20', 0, 'e1111111-1111-1111-1111-111111111111');

-- ====================================================================
-- 7. サンプル作業記録
-- ====================================================================
INSERT INTO operation_logs (vegetable_id, date, work_type, work_notes, weather, temperature_morning, temperature_afternoon, work_hours, created_by) VALUES
('d1111111-1111-1111-1111-111111111111', '2024-03-01', 'seeding', 'トマト桃太郎200粒播種完了。発芽率良好の種子を使用。', '晴れ', 12.5, 18.2, 2.0, 'e1111111-1111-1111-1111-111111111111'),
('d1111111-1111-1111-1111-111111111111', '2024-03-30', 'transplanting', '育苗した苗50株を本圃場に移植。株間30cm、条間40cmで配置。', '曇り', 15.8, 22.1, 3.5, 'e1111111-1111-1111-1111-111111111111'),
('d2222222-2222-2222-2222-222222222222', '2024-05-01', 'fertilizing', 'キュウリ専用肥料を施用。1株あたり10g。', '晴れ', 18.2, 24.8, 1.5, 'e1111111-1111-1111-1111-111111111111');

-- 更に詳細な作業記録（肥料・土壌データ付き）
INSERT INTO operation_logs (
    vegetable_id, date, work_type, work_notes, weather, 
    fertilizer_type, fertilizer_name, fertilizer_qty, fertilizer_unit,
    soil_ph, soil_moisture, temperature_morning, temperature_afternoon,
    work_hours, worker_count, created_by
) VALUES
('d1111111-1111-1111-1111-111111111111', '2024-04-15', 'fertilizing', 
 'トマト第1回追肥実施。開花が始まったため、リン酸重点の肥料を選択。', '晴れ',
 '化成肥料', 'トマト専用8-8-8', 500.0, 'g',
 6.2, 65, 16.5, 23.8, 2.0, 2, 'e1111111-1111-1111-1111-111111111111'),

('d2222222-2222-2222-2222-222222222222', '2024-04-25', 'other',
 'キュウリの誘引作業。つるの整理とネットへの固定を実施。', '曇り',
 NULL, NULL, NULL, NULL,
 6.1, 70, 17.2, 21.5, 1.0, 1, 'e1111111-1111-1111-1111-111111111111');