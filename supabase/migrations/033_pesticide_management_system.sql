-- ===================================================
-- 🧪 Phase 1: JA準拠農薬管理システム
-- 農薬取締法・出荷基準完全対応データベーススキーマ
-- ===================================================

-- 1. 農薬製品マスタテーブル
CREATE TABLE IF NOT EXISTS public.pesticide_products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- 基本情報
    product_name TEXT NOT NULL, -- 商品名
    active_ingredient TEXT NOT NULL, -- 有効成分
    registration_number TEXT UNIQUE NOT NULL, -- 農薬登録番号
    manufacturer TEXT NOT NULL, -- メーカー名
    product_type TEXT NOT NULL CHECK (product_type IN ('殺虫剤', '殺菌剤', '除草剤', '殺虫殺菌剤', 'その他')),
    
    -- 使用基準情報
    dilution_rate JSONB, -- 希釈倍率 {"min": 1000, "max": 2000, "standard": 1500}
    max_applications_per_season INTEGER, -- 年間使用回数制限
    application_interval_days INTEGER, -- 散布間隔（日）
    harvest_restriction_days INTEGER NOT NULL DEFAULT 0, -- 収穫前日数制限
    
    -- 対象作物・適用病害虫
    target_crops TEXT[], -- 適用作物リスト
    target_pests TEXT[], -- 対象病害虫リスト
    
    -- 法規制情報
    organic_approved BOOLEAN DEFAULT false, -- 有機JAS使用可能
    ja_approved BOOLEAN DEFAULT true, -- JA出荷可能
    export_approved BOOLEAN DEFAULT true, -- 輸出対応可能
    special_restrictions TEXT, -- 特別制限事項
    
    -- 安全情報
    toxicity_class TEXT CHECK (toxicity_class IN ('毒物', '劇物', '普通物')),
    ppe_required TEXT[], -- 必要保護具
    storage_requirements TEXT, -- 保管要件
    
    -- システム管理
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    -- インデックス用
    search_vector tsvector GENERATED ALWAYS AS (
        to_tsvector('japanese', product_name || ' ' || active_ingredient || ' ' || manufacturer)
    ) STORED
);

-- 2. 農薬散布記録テーブル
CREATE TABLE IF NOT EXISTS public.pesticide_applications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- 関連情報
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    vegetable_id UUID NOT NULL REFERENCES public.vegetables(id) ON DELETE CASCADE,
    work_report_id UUID REFERENCES public.work_reports(id) ON DELETE SET NULL,
    pesticide_product_id UUID NOT NULL REFERENCES public.pesticide_products(id),
    
    -- 散布情報
    application_date DATE NOT NULL,
    application_time TIME,
    target_area_sqm DECIMAL(10,2) NOT NULL, -- 散布面積
    
    -- 使用量・濃度
    amount_used DECIMAL(10,3) NOT NULL, -- 使用量（L or kg）
    dilution_rate INTEGER, -- 実際の希釈倍率
    water_volume DECIMAL(10,2), -- 使用水量（L）
    
    -- 散布条件
    weather_condition TEXT, -- 天候
    wind_speed TEXT, -- 風速
    temperature DECIMAL(4,1), -- 気温
    humidity INTEGER, -- 湿度
    
    -- 対象・目的
    target_pest TEXT NOT NULL, -- 対象病害虫
    application_reason TEXT, -- 散布理由
    application_method TEXT CHECK (application_method IN ('土壌混和', '株元散布', '茎葉散布', '全面散布', '帯状散布')),
    
    -- 作業者情報
    applicator_name TEXT NOT NULL, -- 散布者名
    applicator_license TEXT, -- 防除作業監督者証等
    
    -- 効果・結果
    effectiveness_rating INTEGER CHECK (effectiveness_rating BETWEEN 1 AND 5), -- 効果評価
    side_effects TEXT, -- 副作用・問題
    next_application_date DATE, -- 次回散布予定日
    
    -- 法規制チェック
    pre_harvest_interval_ok BOOLEAN NOT NULL DEFAULT false, -- 収穫前日数OK
    application_count_ok BOOLEAN NOT NULL DEFAULT false, -- 使用回数OK
    compliance_checked_at TIMESTAMP WITH TIME ZONE,
    compliance_checked_by UUID REFERENCES auth.users(id),
    
    -- 認証対応
    organic_compliant BOOLEAN DEFAULT true,
    ja_compliant BOOLEAN DEFAULT true,
    export_compliant BOOLEAN DEFAULT true,
    
    -- システム管理
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) NOT NULL
);

-- 3. 残留農薬基準値マスタテーブル
CREATE TABLE IF NOT EXISTS public.pesticide_residue_limits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    pesticide_product_id UUID NOT NULL REFERENCES public.pesticide_products(id),
    crop_name TEXT NOT NULL, -- 作物名
    
    -- 基準値情報
    mrl_domestic DECIMAL(10,6), -- 国内残留基準値 (ppm)
    mrl_export_us DECIMAL(10,6), -- 米国輸出基準値
    mrl_export_eu DECIMAL(10,6), -- EU輸出基準値
    mrl_export_asia DECIMAL(10,6), -- アジア輸出基準値
    
    -- 検出情報
    detection_method TEXT, -- 検出方法
    analysis_cost INTEGER, -- 分析費用(円)
    
    -- 管理情報
    regulation_updated_at DATE, -- 法規制更新日
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(pesticide_product_id, crop_name)
);

-- 4. 気象データテーブル
CREATE TABLE IF NOT EXISTS public.weather_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- 場所・時間情報
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    location_name TEXT NOT NULL, -- 地点名
    prefecture TEXT, -- 都道府県
    latitude DECIMAL(10,8), -- 緯度
    longitude DECIMAL(11,8), -- 経度
    
    -- 日時情報
    weather_date DATE NOT NULL,
    data_time TIME, -- 観測時刻
    forecast_type TEXT CHECK (forecast_type IN ('実測', '予報', '週間予報')) DEFAULT '実測',
    
    -- 気象データ
    temperature_max DECIMAL(4,1), -- 最高気温
    temperature_min DECIMAL(4,1), -- 最低気温
    temperature_avg DECIMAL(4,1), -- 平均気温
    humidity_avg INTEGER, -- 平均湿度
    precipitation DECIMAL(6,2) DEFAULT 0, -- 降水量(mm)
    wind_speed DECIMAL(4,1), -- 風速(m/s)
    wind_direction TEXT, -- 風向
    
    -- 農業関連情報
    sunshine_hours DECIMAL(4,2), -- 日照時間
    uv_index INTEGER, -- UV指数
    soil_temperature DECIMAL(4,1), -- 地温
    
    -- 予報・警報情報
    weather_condition TEXT, -- 天気
    precipitation_probability INTEGER, -- 降水確率
    weather_warning TEXT, -- 気象警報
    
    -- データソース
    data_source TEXT DEFAULT 'jma_api', -- データ取得元
    api_response JSONB, -- API生データ
    
    -- システム管理
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- インデックス制約
    UNIQUE(company_id, location_name, weather_date, data_time)
);

-- 5. 気象アラートテーブル
CREATE TABLE IF NOT EXISTS public.weather_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    
    -- アラート基本情報
    alert_type TEXT NOT NULL CHECK (alert_type IN ('降雨予報', '強風注意', '高温注意', '低温注意', '病害警報', '害虫警報')),
    severity TEXT NOT NULL CHECK (severity IN ('情報', '注意', '警戒', '緊急')) DEFAULT '情報',
    title TEXT NOT NULL, -- アラートタイトル
    message TEXT NOT NULL, -- アラート内容
    
    -- 条件設定
    trigger_condition JSONB NOT NULL, -- 発生条件 {"type": "precipitation", "threshold": 10, "period_hours": 24}
    target_area TEXT, -- 対象地域
    
    -- 対象作業・作物
    affected_vegetables UUID[] DEFAULT '{}', -- 影響する野菜ID
    recommended_actions TEXT[], -- 推奨対応
    
    -- アラート管理
    is_active BOOLEAN DEFAULT true,
    triggered_at TIMESTAMP WITH TIME ZONE, -- 発生時刻
    resolved_at TIMESTAMP WITH TIME ZONE, -- 解決時刻
    acknowledged_by UUID REFERENCES auth.users(id), -- 確認者
    acknowledged_at TIMESTAMP WITH TIME ZONE, -- 確認時刻
    
    -- システム管理
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES auth.users(id)
);

-- 6. 認証記録テーブル（有機JAS等）
CREATE TABLE IF NOT EXISTS public.certification_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    vegetable_id UUID REFERENCES public.vegetables(id) ON DELETE CASCADE,
    
    -- 認証情報
    certification_type TEXT NOT NULL CHECK (certification_type IN ('有機JAS', 'GLOBALG.A.P.', '特別栽培', '自然栽培', 'その他')),
    certification_number TEXT, -- 認証番号
    certifying_body TEXT, -- 認証機関
    
    -- 期間
    valid_from DATE NOT NULL,
    valid_until DATE NOT NULL,
    
    -- 制限・要件
    allowed_inputs JSONB, -- 使用可能資材
    prohibited_inputs JSONB, -- 禁止資材
    inspection_requirements JSONB, -- 検査要件
    
    -- 記録保持
    record_keeping_required BOOLEAN DEFAULT true,
    audit_trail JSONB DEFAULT '[]', -- 監査証跡
    
    -- ドキュメント
    certificate_file_url TEXT, -- 証明書ファイル
    inspection_reports JSONB DEFAULT '[]', -- 検査報告書
    
    -- システム管理
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES auth.users(id)
);

-- ===================================================
-- インデックス作成
-- ===================================================

-- 農薬製品検索用インデックス
CREATE INDEX IF NOT EXISTS idx_pesticide_products_search ON public.pesticide_products USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_pesticide_products_type ON public.pesticide_products(product_type);
CREATE INDEX IF NOT EXISTS idx_pesticide_products_crops ON public.pesticide_products USING gin(target_crops);

-- 農薬散布記録用インデックス
CREATE INDEX IF NOT EXISTS idx_pesticide_applications_company ON public.pesticide_applications(company_id);
CREATE INDEX IF NOT EXISTS idx_pesticide_applications_vegetable ON public.pesticide_applications(vegetable_id);
CREATE INDEX IF NOT EXISTS idx_pesticide_applications_date ON public.pesticide_applications(application_date);
CREATE INDEX IF NOT EXISTS idx_pesticide_applications_product ON public.pesticide_applications(pesticide_product_id);

-- 気象データ用インデックス
CREATE INDEX IF NOT EXISTS idx_weather_data_company_date ON public.weather_data(company_id, weather_date);
CREATE INDEX IF NOT EXISTS idx_weather_data_location ON public.weather_data(location_name, weather_date);

-- 気象アラート用インデックス
CREATE INDEX IF NOT EXISTS idx_weather_alerts_company ON public.weather_alerts(company_id);
CREATE INDEX IF NOT EXISTS idx_weather_alerts_active ON public.weather_alerts(is_active, triggered_at);

-- 認証記録用インデックス
CREATE INDEX IF NOT EXISTS idx_certification_company ON public.certification_records(company_id);
CREATE INDEX IF NOT EXISTS idx_certification_vegetable ON public.certification_records(vegetable_id);
CREATE INDEX IF NOT EXISTS idx_certification_type_active ON public.certification_records(certification_type, is_active);

-- ===================================================
-- RLS (Row Level Security) 設定
-- ===================================================

-- 農薬製品マスタ：全ユーザー読み取り可能、管理者のみ編集可能
ALTER TABLE public.pesticide_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pesticide_products_read" ON public.pesticide_products FOR SELECT USING (true);
CREATE POLICY "pesticide_products_write" ON public.pesticide_products FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
        AND u.role IN ('admin', 'manager')
    )
);

-- 農薬散布記録：企業内ユーザーのみアクセス可能
ALTER TABLE public.pesticide_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pesticide_applications_company" ON public.pesticide_applications FOR ALL 
USING (
    company_id IN (
        SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()
    )
);

-- 残留基準値：全ユーザー読み取り可能
ALTER TABLE public.pesticide_residue_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pesticide_residue_limits_read" ON public.pesticide_residue_limits FOR SELECT USING (true);
CREATE POLICY "pesticide_residue_limits_write" ON public.pesticide_residue_limits FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
        AND u.role IN ('admin')
    )
);

-- 気象データ：企業内ユーザーのみアクセス可能
ALTER TABLE public.weather_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weather_data_company" ON public.weather_data FOR ALL 
USING (
    company_id IN (
        SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()
    )
);

-- 気象アラート：企業内ユーザーのみアクセス可能
ALTER TABLE public.weather_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weather_alerts_company" ON public.weather_alerts FOR ALL 
USING (
    company_id IN (
        SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()
    )
);

-- 認証記録：企業内ユーザーのみアクセス可能
ALTER TABLE public.certification_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "certification_records_company" ON public.certification_records FOR ALL 
USING (
    company_id IN (
        SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()
    )
);

-- ===================================================
-- 初期データ投入（主要農薬製品サンプル）
-- ===================================================

INSERT INTO public.pesticide_products (
    product_name, active_ingredient, registration_number, manufacturer, product_type,
    dilution_rate, max_applications_per_season, harvest_restriction_days,
    target_crops, target_pests, organic_approved, toxicity_class
) VALUES 
-- 殺虫剤
('アクタラ粒剤5', 'チアメトキサム', '第22506号', '住友化学', '殺虫剤', 
 '{"application_rate": "3-4g/株"}', 1, 7, 
 '{"トマト", "キュウリ", "ナス", "ピーマン"}', '{"アブラムシ類", "アザミウマ類", "コナジラミ類"}', false, '普通物'),

('アディオン乳剤', 'ジノテフラン', '第21737号', '住友化学', '殺虫剤',
 '{"min": 4000, "max": 8000}', 2, 3,
 '{"キャベツ", "ブロッコリー", "レタス"}', '{"アブラムシ類", "アザミウマ類"}', false, '普通物'),

-- 殺菌剤  
('アミスター20フロアブル', 'アゾキシストロビン', '第21528号', 'シンジェンタ ジャパン', '殺菌剤',
 '{"min": 2000, "max": 4000}', 4, 1,
 '{"トマト", "キュウリ", "イチゴ", "レタス"}', '{"うどんこ病", "灰色かび病", "べと病"}', false, '普通物'),

('オーソサイド水和剤80', 'キャプタン', '第468号', 'アリスタ ライフサイエンス', '殺菌剤',
 '{"min": 400, "max": 800}', 5, 7,
 '{"トマト", "キュウリ", "ナス"}', '{"疫病", "灰色かび病"}', false, '普通物'),

-- 除草剤
('ラウンドアップマックスロード', 'グリホサートカリウム塩', '第22761号', '日産化学', '除草剤',
 '{"min": 25, "max": 100}', 3, 0,
 '{"果樹園", "畑地"}', '{"一年生雑草", "多年生雑草"}', false, '普通物'),

-- 有機適用農薬
('BT菌水和剤', 'BT菌', '第18854号', '住友化学', '殺虫剤',
 '{"min": 1000, "max": 2000}', 10, 0,
 '{"キャベツ", "ブロッコリー", "トマト"}', '{"チョウ目害虫"}', true, '普通物')

ON CONFLICT (registration_number) DO NOTHING;

-- ===================================================
-- 関数作成：農薬使用基準チェック
-- ===================================================

CREATE OR REPLACE FUNCTION check_pesticide_compliance(
    p_vegetable_id UUID,
    p_pesticide_product_id UUID,
    p_application_date DATE
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_product RECORD;
    v_vegetable RECORD;
    v_application_count INTEGER;
    v_last_application_date DATE;
    v_planned_harvest_date DATE;
    v_result JSONB := '{}';
BEGIN
    -- 農薬製品情報取得
    SELECT * INTO v_product FROM public.pesticide_products WHERE id = p_pesticide_product_id;
    
    -- 野菜情報取得
    SELECT * INTO v_vegetable FROM public.vegetables WHERE id = p_vegetable_id;
    
    -- 今シーズンの散布回数チェック
    SELECT COUNT(*)
    INTO v_application_count
    FROM public.pesticide_applications pa
    WHERE pa.vegetable_id = p_vegetable_id
    AND pa.pesticide_product_id = p_pesticide_product_id
    AND pa.application_date >= (DATE_TRUNC('year', p_application_date))::DATE;
    
    -- 前回散布日取得
    SELECT MAX(application_date)
    INTO v_last_application_date  
    FROM public.pesticide_applications pa
    WHERE pa.vegetable_id = p_vegetable_id
    AND pa.pesticide_product_id = p_pesticide_product_id
    AND pa.application_date < p_application_date;
    
    -- 予定収穫日取得（growing_tasksから推定）
    SELECT MIN(end_date)
    INTO v_planned_harvest_date
    FROM public.growing_tasks gt
    WHERE gt.vegetable_id = p_vegetable_id
    AND gt.name LIKE '%収穫%'
    AND gt.end_date > p_application_date;
    
    -- 使用回数チェック
    v_result := jsonb_set(v_result, '{max_applications_ok}', 
        to_jsonb(v_application_count < COALESCE(v_product.max_applications_per_season, 999))
    );
    
    -- 散布間隔チェック
    v_result := jsonb_set(v_result, '{interval_ok}', 
        to_jsonb(
            v_last_application_date IS NULL 
            OR p_application_date >= v_last_application_date + COALESCE(v_product.application_interval_days, 0)
        )
    );
    
    -- 収穫前日数チェック
    v_result := jsonb_set(v_result, '{harvest_interval_ok}', 
        to_jsonb(
            v_planned_harvest_date IS NULL 
            OR v_planned_harvest_date >= p_application_date + v_product.harvest_restriction_days
        )
    );
    
    -- 作物適用チェック
    v_result := jsonb_set(v_result, '{crop_approved}', 
        to_jsonb(v_vegetable.name = ANY(v_product.target_crops) OR array_length(v_product.target_crops, 1) IS NULL)
    );
    
    -- 結果詳細
    v_result := jsonb_set(v_result, '{details}', json_build_object(
        'current_applications', v_application_count,
        'max_applications', v_product.max_applications_per_season,
        'last_application', v_last_application_date,
        'planned_harvest', v_planned_harvest_date,
        'harvest_restriction_days', v_product.harvest_restriction_days
    )::jsonb);
    
    RETURN v_result;
END;
$$;

-- ===================================================
-- 関数作成：JA出荷用帳票データ生成
-- ===================================================

CREATE OR REPLACE FUNCTION generate_ja_pesticide_report(
    p_vegetable_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
) RETURNS TABLE (
    vegetable_name TEXT,
    application_date DATE,
    pesticide_name TEXT,
    active_ingredient TEXT,
    registration_number TEXT,
    dilution_rate INTEGER,
    target_pest TEXT,
    applicator_name TEXT,
    harvest_restriction_days INTEGER,
    compliance_status TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.name as vegetable_name,
        pa.application_date,
        pp.product_name as pesticide_name,
        pp.active_ingredient,
        pp.registration_number,
        pa.dilution_rate,
        pa.target_pest,
        pa.applicator_name,
        pp.harvest_restriction_days,
        CASE 
            WHEN pa.pre_harvest_interval_ok AND pa.application_count_ok THEN '適合'
            ELSE '要確認'
        END as compliance_status
    FROM public.pesticide_applications pa
    JOIN public.vegetables v ON v.id = pa.vegetable_id
    JOIN public.pesticide_products pp ON pp.id = pa.pesticide_product_id
    WHERE pa.vegetable_id = p_vegetable_id
    AND (p_start_date IS NULL OR pa.application_date >= p_start_date)
    AND (p_end_date IS NULL OR pa.application_date <= p_end_date)
    ORDER BY pa.application_date DESC;
END;
$$;

COMMENT ON TABLE public.pesticide_products IS 'JA準拠農薬管理：登録農薬製品マスタ';
COMMENT ON TABLE public.pesticide_applications IS 'JA準拠農薬管理：散布記録（出荷用帳票対応）';
COMMENT ON TABLE public.pesticide_residue_limits IS 'JA準拠農薬管理：残留農薬基準値マスタ';
COMMENT ON TABLE public.weather_data IS 'Phase1気象連携：気象庁API気象データ蓄積';
COMMENT ON TABLE public.weather_alerts IS 'Phase1気象連携：気象条件アラートシステム';
COMMENT ON TABLE public.certification_records IS 'JA準拠農薬管理：有機JAS等認証記録管理';