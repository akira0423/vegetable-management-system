import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// 気象庁API設定
const JMA_API_BASE = 'https://www.jma.go.jp/bosai/forecast/data/forecast'
const JMA_AREA_LIST = 'https://www.jma.go.jp/bosai/common/const/area.json'

// 都道府県コードマップ（主要な農業地域）
const PREFECTURE_CODES = {
  '北海道': '016000',
  '青森県': '020000', 
  '岩手県': '030000',
  '宮城県': '040000',
  '秋田県': '050000',
  '山形県': '060000',
  '福島県': '070000',
  '茨城県': '080000',
  '栃木県': '090000',
  '群馬県': '100000',
  '埼玉県': '110000',
  '千葉県': '120000',
  '東京都': '130000',
  '神奈川県': '140000',
  '新潟県': '150000',
  '富山県': '160000',
  '石川県': '170000',
  '福井県': '180000',
  '山梨県': '190000',
  '長野県': '200000',
  '岐阜県': '210000',
  '静岡県': '220000',
  '愛知県': '230000',
  '三重県': '240000',
  '滋賀県': '250000',
  '京都府': '260000',
  '大阪府': '270000',
  '兵庫県': '280000',
  '奈良県': '290000',
  '和歌山県': '300000',
  '鳥取県': '310000',
  '島根県': '320000',
  '岡山県': '330000',
  '広島県': '340000',
  '山口県': '350000',
  '徳島県': '360000',
  '香川県': '370000',
  '愛媛県': '380000',
  '高知県': '390000',
  '福岡県': '400000',
  '佐賀県': '410000',
  '長崎県': '420000',
  '熊本県': '430000',
  '大分県': '440000',
  '宮崎県': '450000',
  '鹿児島県': '460100',
  '沖縄県': '471000'
}

// GET /api/weather - 天気データ取得・保存
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceClient()
    
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')
    const prefecture = searchParams.get('prefecture')
    const days = parseInt(searchParams.get('days') || '7')
    const refresh = searchParams.get('refresh') === 'true'

    

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 })
    }

    // 企業の所在地情報取得
    const { data: company } = await supabase
      .from('companies')
      .select('prefecture, city, name')
      .eq('id', companyId)
      .single()

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const targetPrefecture = prefecture || company.prefecture
    const prefectureCode = PREFECTURE_CODES[targetPrefecture as keyof typeof PREFECTURE_CODES]

    if (!prefectureCode) {
      return NextResponse.json({ 
        error: `Unsupported prefecture: ${targetPrefecture}` 
      }, { status: 400 })
    }

    // 既存データチェック（今日のデータがあるか）
    const today = new Date().toISOString().split('T')[0]
    const { data: existingData } = await supabase
      .from('weather_data')
      .select('*')
      .eq('company_id', companyId)
      .eq('location_name', targetPrefecture)
      .eq('weather_date', today)
      .eq('forecast_type', '予報')
      .single()

    if (existingData && !refresh) {
      
      
      // 今日から指定日数分のデータを取得
      const { data: weatherData } = await supabase
        .from('weather_data')
        .select('*')
        .eq('company_id', companyId)
        .eq('location_name', targetPrefecture)
        .gte('weather_date', today)
        .lte('weather_date', new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('weather_date')

      return NextResponse.json({
        success: true,
        data: weatherData || [],
        source: 'cache',
        updated_at: existingData.created_at
      })
    }

    // 気象庁APIから天気予報取得
    
    
    const jmaResponse = await fetch(`${JMA_API_BASE}/${prefectureCode}.json`, {
      headers: {
        'User-Agent': 'AgriFinance-Pro/1.0 (Agricultural Management System)'
      }
    })

    if (!jmaResponse.ok) {
      
      return NextResponse.json({ 
        error: 'Weather API request failed',
        status: jmaResponse.status 
      }, { status: 500 })
    }

    const jmaData = await jmaResponse.json()
    

    // 天気データを解析・変換
    const weatherRecords = []
    const forecastData = jmaData[0]?.timeSeries || []

    if (forecastData.length > 0) {
      const timeData = forecastData[0]
      const weatherAreas = timeData.areas[0] // 最初のエリアを使用
      const times = timeData.timeDefines
      const weatherCodes = weatherAreas.weatherCodes
      const temperatures = forecastData[1]?.areas[0]?.temps || []
      
      for (let i = 0; i < Math.min(times.length, days); i++) {
        const forecastTime = new Date(times[i])
        const forecastDate = forecastTime.toISOString().split('T')[0]
        
        const weatherCode = weatherCodes[i]
        const weatherCondition = getWeatherFromCode(weatherCode)
        
        // 気温データは6時間間隔のため調整
        const tempIndex = Math.floor(i / 2)
        const temperature = temperatures[tempIndex] ? parseInt(temperatures[tempIndex]) : null

        weatherRecords.push({
          company_id: companyId,
          location_name: targetPrefecture,
          weather_date: forecastDate,
          forecast_type: '予報',
          weather_condition: weatherCondition.condition,
          temperature_max: temperature,
          temperature_min: null, // 気象庁APIでは最低気温の取得が複雑
          precipitation_probability: weatherCondition.rain_prob,
          api_response: {
            weather_code: weatherCode,
            original_time: times[i],
            area_name: weatherAreas.area?.name || targetPrefecture
          }
        })
      }
    }

    // データベースに保存（既存データは更新）
    if (weatherRecords.length > 0) {
      // 既存データを削除してから挿入（upsertの代替）
      await supabase
        .from('weather_data')
        .delete()
        .eq('company_id', companyId)
        .eq('location_name', targetPrefecture)
        .eq('forecast_type', '予報')
        .gte('weather_date', today)

      const { error: insertError } = await supabase
        .from('weather_data')
        .insert(weatherRecords)

      if (insertError) {
        
        // エラーでも取得したデータは返す
      } else {
        
      }
    }

    return NextResponse.json({
      success: true,
      data: weatherRecords,
      source: 'jma_api',
      updated_at: new Date().toISOString()
    })

  } catch (error) {
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST /api/weather/alerts - 気象アラート設定
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServiceClient()
    const body = await request.json()

    

    const requiredFields = ['company_id', 'alert_type', 'title', 'message', 'trigger_condition']
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({ 
          error: `${field} is required` 
        }, { status: 400 })
      }
    }

    const { data, error } = await supabase
      .from('weather_alerts')
      .insert({
        company_id: body.company_id,
        alert_type: body.alert_type,
        severity: body.severity || '情報',
        title: body.title,
        message: body.message,
        trigger_condition: body.trigger_condition,
        target_area: body.target_area || null,
        affected_vegetables: body.affected_vegetables || [],
        recommended_actions: body.recommended_actions || [],
        created_by: body.created_by
      })
      .select()
      .single()

    if (error) {
      
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    

    return NextResponse.json({
      success: true,
      data: data
    }, { status: 201 })

  } catch (error) {
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// 気象庁天気コードから天気情報を取得
function getWeatherFromCode(code: string) {
  const weatherMap: { [key: string]: { condition: string; rain_prob: number } } = {
    '100': { condition: '晴れ', rain_prob: 0 },
    '101': { condition: '晴れ時々曇り', rain_prob: 10 },
    '102': { condition: '晴れ一時雨', rain_prob: 20 },
    '103': { condition: '晴れ時々雨', rain_prob: 30 },
    '104': { condition: '晴れ一時雪', rain_prob: 20 },
    '105': { condition: '晴れ時々雪', rain_prob: 30 },
    '110': { condition: '晴れ後曇り', rain_prob: 20 },
    '112': { condition: '晴れ後雨', rain_prob: 40 },
    '115': { condition: '晴れ後雪', rain_prob: 40 },
    '200': { condition: '曇り', rain_prob: 30 },
    '201': { condition: '曇り時々晴れ', rain_prob: 20 },
    '202': { condition: '曇り一時雨', rain_prob: 50 },
    '203': { condition: '曇り時々雨', rain_prob: 60 },
    '204': { condition: '曇り一時雪', rain_prob: 50 },
    '205': { condition: '曇り時々雪', rain_prob: 60 },
    '210': { condition: '曇り後晴れ', rain_prob: 30 },
    '212': { condition: '曇り後雨', rain_prob: 70 },
    '215': { condition: '曇り後雪', rain_prob: 70 },
    '300': { condition: '雨', rain_prob: 80 },
    '301': { condition: '雨時々晴れ', rain_prob: 60 },
    '302': { condition: '雨時々曇り', rain_prob: 70 },
    '303': { condition: '雨時々雪', rain_prob: 80 },
    '308': { condition: '大雨', rain_prob: 90 },
    '311': { condition: '雨後晴れ', rain_prob: 60 },
    '313': { condition: '雨後曇り', rain_prob: 70 },
    '314': { condition: '雨後雪', rain_prob: 80 },
    '400': { condition: '雪', rain_prob: 80 },
    '401': { condition: '雪時々晴れ', rain_prob: 60 },
    '402': { condition: '雪時々曇り', rain_prob: 70 },
    '403': { condition: '雪時々雨', rain_prob: 80 },
    '406': { condition: '大雪', rain_prob: 90 },
    '411': { condition: '雪後晴れ', rain_prob: 60 },
    '413': { condition: '雪後曇り', rain_prob: 70 },
    '414': { condition: '雪後雨', rain_prob: 80 }
  }

  return weatherMap[code] || { condition: '不明', rain_prob: 0 }
}