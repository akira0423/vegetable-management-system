-- デモ用タスクテーブルの作成
CREATE TABLE IF NOT EXISTS public.demo_growing_tasks (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL DEFAULT 'a1111111-1111-1111-1111-111111111111'::uuid,
    vegetable_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    task_type text NOT NULL,
    priority text NOT NULL DEFAULT 'medium'::text CHECK (priority = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text])),
    status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])),
    start_date date NOT NULL,
    end_date date NOT NULL,
    estimated_hours numeric,
    actual_hours numeric,
    progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    notes text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT demo_growing_tasks_pkey PRIMARY KEY (id),
    CONSTRAINT demo_growing_tasks_vegetable_id_fkey FOREIGN KEY (vegetable_id) REFERENCES public.demo_vegetables(id)
);

-- デモ用作業レポートテーブルの作成
CREATE TABLE IF NOT EXISTS public.demo_work_reports (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL DEFAULT 'a1111111-1111-1111-1111-111111111111'::uuid,
    vegetable_id uuid NOT NULL,
    growing_task_id uuid,
    work_type text NOT NULL,
    description text,
    work_date date NOT NULL,
    start_time time without time zone,
    end_time time without time zone,
    duration_hours numeric,
    weather text,
    temperature numeric,
    harvest_amount numeric,
    harvest_unit text,
    harvest_quality text,
    worker_count integer DEFAULT 1,
    notes text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    expected_revenue numeric,
    work_amount numeric,
    work_unit text,
    fertilizer_type text,
    fertilizer_amount numeric,
    fertilizer_unit text,
    CONSTRAINT demo_work_reports_pkey PRIMARY KEY (id),
    CONSTRAINT demo_work_reports_vegetable_id_fkey FOREIGN KEY (vegetable_id) REFERENCES public.demo_vegetables(id),
    CONSTRAINT demo_work_reports_growing_task_id_fkey FOREIGN KEY (growing_task_id) REFERENCES public.demo_growing_tasks(id)
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_demo_growing_tasks_vegetable_id ON public.demo_growing_tasks(vegetable_id);
CREATE INDEX IF NOT EXISTS idx_demo_growing_tasks_status ON public.demo_growing_tasks(status);
CREATE INDEX IF NOT EXISTS idx_demo_growing_tasks_start_date ON public.demo_growing_tasks(start_date);
CREATE INDEX IF NOT EXISTS idx_demo_work_reports_vegetable_id ON public.demo_work_reports(vegetable_id);
CREATE INDEX IF NOT EXISTS idx_demo_work_reports_work_date ON public.demo_work_reports(work_date);

-- demo_vegetablesテーブルに既存データがない場合のサンプルデータ挿入
INSERT INTO public.demo_vegetables (id, name, variety_name, plot_name, area_size, plant_count, planting_date, expected_harvest_start, expected_harvest_end, status, notes)
VALUES
    ('b1111111-1111-1111-1111-111111111111'::uuid, 'トマト', 'ミニトマト', '第1農場A区画', 50, 100, '2025-03-15', '2025-06-01', '2025-08-31', 'planning', '春作のミニトマト栽培'),
    ('b2222222-2222-2222-2222-222222222222'::uuid, 'キュウリ', '夏すずみ', '第1農場B区画', 40, 80, '2025-04-01', '2025-06-15', '2025-09-30', 'planning', '夏野菜の主力品種'),
    ('b3333333-3333-3333-3333-333333333333'::uuid, 'ナス', '千両二号', '第2農場A区画', 35, 60, '2025-04-15', '2025-07-01', '2025-10-31', 'planning', '秋まで長期収穫'),
    ('b4444444-4444-4444-4444-444444444444'::uuid, 'レタス', 'サニーレタス', '第2農場B区画', 30, 200, '2025-03-01', '2025-04-20', '2025-05-31', 'planning', '春レタスの連作'),
    ('b5555555-5555-5555-5555-555555555555'::uuid, 'ダイコン', '青首大根', '第3農場', 45, 150, '2025-09-01', '2025-11-15', '2025-12-31', 'planning', '秋冬野菜の定番')
ON CONFLICT (id) DO NOTHING;

-- デモ用タスクのサンプルデータ挿入
INSERT INTO public.demo_growing_tasks (id, vegetable_id, name, description, task_type, priority, status, start_date, end_date, progress, estimated_hours, notes)
VALUES
    -- トマトのタスク
    ('c1111111-1111-1111-1111-111111111111'::uuid, 'b1111111-1111-1111-1111-111111111111'::uuid, '播種・育苗', '種まきと育苗管理', 'seeding', 'high', 'pending', '2025-02-01', '2025-03-14', 0, 20, '温室で育苗管理'),
    ('c1111112-1111-1111-1111-111111111112'::uuid, 'b1111111-1111-1111-1111-111111111111'::uuid, '定植準備', '畝立てとマルチ張り', 'planting', 'high', 'pending', '2025-03-10', '2025-03-14', 0, 8, '土壌改良も実施'),
    ('c1111113-1111-1111-1111-111111111113'::uuid, 'b1111111-1111-1111-1111-111111111111'::uuid, '定植作業', '苗の定植', 'planting', 'high', 'pending', '2025-03-15', '2025-03-16', 0, 6, '支柱立ても同時実施'),
    ('c1111114-1111-1111-1111-111111111114'::uuid, 'b1111111-1111-1111-1111-111111111111'::uuid, '整枝・誘引', '芽かきと誘引作業', 'pruning', 'medium', 'pending', '2025-04-01', '2025-08-31', 0, 40, '週2回の管理作業'),
    ('c1111115-1111-1111-1111-111111111115'::uuid, 'b1111111-1111-1111-1111-111111111111'::uuid, '収穫作業', '収穫と選別', 'harvesting', 'high', 'pending', '2025-06-01', '2025-08-31', 0, 60, '毎日収穫予定'),

    -- キュウリのタスク
    ('c2222221-2222-2222-2222-222222222221'::uuid, 'b2222222-2222-2222-2222-222222222222'::uuid, '播種・育苗', '種まきと育苗', 'seeding', 'high', 'pending', '2025-03-15', '2025-03-31', 0, 15, 'ポット育苗'),
    ('c2222222-2222-2222-2222-222222222222'::uuid, 'b2222222-2222-2222-2222-222222222222'::uuid, '定植', '苗の定植', 'planting', 'high', 'pending', '2025-04-01', '2025-04-02', 0, 8, 'ネット張りも実施'),
    ('c2222223-2222-2222-2222-222222222223'::uuid, 'b2222222-2222-2222-2222-222222222222'::uuid, '誘引・整枝', '誘引と側枝管理', 'pruning', 'medium', 'pending', '2025-04-15', '2025-09-30', 0, 50, '週3回の管理'),
    ('c2222224-2222-2222-2222-222222222224'::uuid, 'b2222222-2222-2222-2222-222222222222'::uuid, '追肥', '定期的な追肥', 'fertilizing', 'medium', 'pending', '2025-05-01', '2025-09-01', 0, 10, '2週間ごとに実施'),
    ('c2222225-2222-2222-2222-222222222225'::uuid, 'b2222222-2222-2222-2222-222222222222'::uuid, '収穫', '毎日の収穫作業', 'harvesting', 'high', 'pending', '2025-06-15', '2025-09-30', 0, 80, '朝夕2回収穫'),

    -- ナスのタスク
    ('c3333331-3333-3333-3333-333333333331'::uuid, 'b3333333-3333-3333-3333-333333333333'::uuid, '育苗', '種まきと育苗管理', 'seeding', 'high', 'pending', '2025-02-15', '2025-04-14', 0, 25, '温床育苗'),
    ('c3333332-3333-3333-3333-333333333332'::uuid, 'b3333333-3333-3333-3333-333333333333'::uuid, '定植', '本圃への定植', 'planting', 'high', 'pending', '2025-04-15', '2025-04-16', 0, 6, '支柱設置も同時'),
    ('c3333333-3333-3333-3333-333333333333'::uuid, 'b3333333-3333-3333-3333-333333333333'::uuid, '整枝作業', '3本仕立て', 'pruning', 'medium', 'pending', '2025-05-01', '2025-10-31', 0, 45, '週2回の整枝'),
    ('c3333334-3333-3333-3333-333333333334'::uuid, 'b3333333-3333-3333-3333-333333333333'::uuid, '病害虫防除', '定期防除', 'other', 'medium', 'pending', '2025-05-01', '2025-10-31', 0, 20, '週1回の防除'),
    ('c3333335-3333-3333-3333-333333333335'::uuid, 'b3333333-3333-3333-3333-333333333333'::uuid, '収穫', '収穫と調整', 'harvesting', 'high', 'pending', '2025-07-01', '2025-10-31', 0, 70, '2日に1回収穫'),

    -- レタスのタスク
    ('c4444441-4444-4444-4444-444444444441'::uuid, 'b4444444-4444-4444-4444-444444444444'::uuid, '播種', '直播き', 'seeding', 'high', 'pending', '2025-03-01', '2025-03-02', 0, 4, '条播きで実施'),
    ('c4444442-4444-4444-4444-444444444442'::uuid, 'b4444444-4444-4444-4444-444444444444'::uuid, '間引き', '適正株間に調整', 'other', 'medium', 'pending', '2025-03-15', '2025-03-20', 0, 8, '15cm間隔に調整'),
    ('c4444443-4444-4444-4444-444444444443'::uuid, 'b4444444-4444-4444-4444-444444444444'::uuid, '除草', '雑草管理', 'weeding', 'low', 'pending', '2025-03-20', '2025-04-30', 0, 12, '2週間ごとに実施'),
    ('c4444444-4444-4444-4444-444444444444'::uuid, 'b4444444-4444-4444-4444-444444444444'::uuid, '灌水管理', '適切な水分管理', 'watering', 'medium', 'pending', '2025-03-01', '2025-05-31', 0, 15, '乾燥時に灌水'),
    ('c4444445-4444-4444-4444-444444444445'::uuid, 'b4444444-4444-4444-4444-444444444444'::uuid, '収穫', '一斉収穫', 'harvesting', 'high', 'pending', '2025-04-20', '2025-05-31', 0, 20, '朝収穫で鮮度保持'),

    -- ダイコンのタスク
    ('c5555551-5555-5555-5555-555555555551'::uuid, 'b5555555-5555-5555-5555-555555555555'::uuid, '播種準備', '畝立てと施肥', 'other', 'high', 'pending', '2025-08-25', '2025-08-31', 0, 10, '基肥施用'),
    ('c5555552-5555-5555-5555-555555555552'::uuid, 'b5555555-5555-5555-5555-555555555555'::uuid, '播種', '直播き作業', 'seeding', 'high', 'pending', '2025-09-01', '2025-09-02', 0, 5, '点播きで実施'),
    ('c5555553-5555-5555-5555-555555555553'::uuid, 'b5555555-5555-5555-5555-555555555555'::uuid, '間引き', '2回の間引き', 'other', 'medium', 'pending', '2025-09-15', '2025-10-05', 0, 8, '最終株間20cm'),
    ('c5555554-5555-5555-5555-555555555554'::uuid, 'b5555555-5555-5555-5555-555555555555'::uuid, '追肥・土寄せ', '追肥と土寄せ', 'fertilizing', 'medium', 'pending', '2025-10-01', '2025-10-31', 0, 6, '2回実施'),
    ('c5555555-5555-5555-5555-555555555555'::uuid, 'b5555555-5555-5555-5555-555555555555'::uuid, '収穫', '収穫と洗浄', 'harvesting', 'high', 'pending', '2025-11-15', '2025-12-31', 0, 30, '順次収穫')
ON CONFLICT (id) DO NOTHING;

-- デモ用作業レポートのサンプルデータ挿入
INSERT INTO public.demo_work_reports (vegetable_id, growing_task_id, work_type, description, work_date, duration_hours, weather, temperature, notes, harvest_amount, harvest_unit, expected_revenue)
VALUES
    -- トマトの作業記録
    ('b1111111-1111-1111-1111-111111111111'::uuid, 'c1111111-1111-1111-1111-111111111111'::uuid, 'seeding', '種まき実施', '2025-02-01', 3, '晴れ', 18, '温室内で200粒播種', NULL, NULL, NULL),
    ('b1111111-1111-1111-1111-111111111111'::uuid, 'c1111112-1111-1111-1111-111111111112'::uuid, 'other', '畝立て作業', '2025-03-10', 4, '曇り', 15, 'マルチング完了', NULL, NULL, NULL),
    ('b1111111-1111-1111-1111-111111111111'::uuid, 'c1111113-1111-1111-1111-111111111113'::uuid, 'planting', '定植完了', '2025-03-15', 6, '晴れ', 20, '100株定植、活着良好', NULL, NULL, NULL),

    -- キュウリの作業記録
    ('b2222222-2222-2222-2222-222222222222'::uuid, 'c2222221-2222-2222-2222-222222222221'::uuid, 'seeding', '播種作業', '2025-03-15', 2, '晴れ', 22, 'セルトレイに播種', NULL, NULL, NULL),
    ('b2222222-2222-2222-2222-222222222222'::uuid, 'c2222222-2222-2222-2222-222222222222'::uuid, 'planting', '定植とネット張り', '2025-04-01', 8, '晴れ', 25, '80株定植、支柱とネット設置', NULL, NULL, NULL),

    -- ナスの作業記録
    ('b3333333-3333-3333-3333-333333333333'::uuid, 'c3333331-3333-3333-3333-333333333331'::uuid, 'seeding', '播種', '2025-02-15', 2, '曇り', 16, '温床で管理開始', NULL, NULL, NULL),

    -- レタスの作業記録
    ('b4444444-4444-4444-4444-444444444444'::uuid, 'c4444441-4444-4444-4444-444444444441'::uuid, 'seeding', '直播き実施', '2025-03-01', 4, '晴れ', 18, '発芽率良好見込み', NULL, NULL, NULL),
    ('b4444444-4444-4444-4444-444444444444'::uuid, 'c4444444-4444-4444-4444-444444444444'::uuid, 'watering', '灌水作業', '2025-03-10', 1, '晴れ', 20, '乾燥のため灌水実施', NULL, NULL, NULL),

    -- ダイコンの作業記録
    ('b5555555-5555-5555-5555-555555555555'::uuid, 'c5555551-5555-5555-5555-555555555551'::uuid, 'other', '圃場準備', '2025-08-25', 5, '曇り', 28, '堆肥と基肥施用', NULL, NULL, NULL),
    ('b5555555-5555-5555-5555-555555555555'::uuid, 'c5555552-5555-5555-5555-555555555552'::uuid, 'seeding', '播種完了', '2025-09-01', 5, '晴れ', 26, '150箇所に点播き', NULL, NULL, NULL);

-- 進行中のタスクをいくつか更新
UPDATE public.demo_growing_tasks
SET status = 'completed', progress = 100, actual_hours = estimated_hours
WHERE id IN ('c1111111-1111-1111-1111-111111111111'::uuid, 'c2222221-2222-2222-2222-222222222221'::uuid, 'c3333331-3333-3333-3333-333333333331'::uuid);

UPDATE public.demo_growing_tasks
SET status = 'in_progress', progress = 50
WHERE id IN ('c1111112-1111-1111-1111-111111111112'::uuid, 'c2222222-2222-2222-2222-222222222222'::uuid, 'c4444441-4444-4444-4444-444444444441'::uuid);

-- 野菜のステータスも更新
UPDATE public.demo_vegetables
SET status = 'growing'
WHERE id IN ('b1111111-1111-1111-1111-111111111111'::uuid, 'b2222222-2222-2222-2222-222222222222'::uuid);