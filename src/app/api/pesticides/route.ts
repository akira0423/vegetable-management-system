import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/pesticides - 農薬製品マスタ一覧取得
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceClient()
    
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const productType = searchParams.get('product_type')
    const organicOnly = searchParams.get('organic_only') === 'true'
    const targetCrop = searchParams.get('target_crop')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    console.log('🧪 農薬API - リクエストパラメータ:', { 
      search, productType, organicOnly, targetCrop, limit, offset 
    })

    // ベースクエリ
    let query = supabase
      .from('pesticide_products')
      .select(`
        id,
        product_name,
        active_ingredient,
        registration_number,
        manufacturer,
        product_type,
        dilution_rate,
        max_applications_per_season,
        application_interval_days,
        harvest_restriction_days,
        target_crops,
        target_pests,
        organic_approved,
        ja_approved,
        export_approved,
        special_restrictions,
        toxicity_class,
        ppe_required,
        storage_requirements,
        is_active,
        created_at,
        updated_at
      `)
      .eq('is_active', true)

    // フィルター適用
    if (search) {
      query = query.or(`product_name.ilike.%${search}%,active_ingredient.ilike.%${search}%,manufacturer.ilike.%${search}%`)
    }

    if (productType) {
      query = query.eq('product_type', productType)
    }

    if (organicOnly) {
      query = query.eq('organic_approved', true)
    }

    if (targetCrop) {
      query = query.contains('target_crops', [targetCrop])
    }

    // 実行
    const { data, error, count } = await query
      .range(offset, offset + limit - 1)
      .order('product_name')

    if (error) {
      console.error('❌ 農薬API - データベースエラー:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('✅ 農薬API - 取得成功:', { count: data?.length || 0 })

    return NextResponse.json({
      success: true,
      data: data || [],
      count: data?.length || 0
    })

  } catch (error) {
    console.error('❌ 農薬API - 予期しないエラー:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

// POST /api/pesticides - 農薬製品マスタ新規作成
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServiceClient()
    const body = await request.json()

    console.log('🧪 農薬API - 新規作成:', body)

    // 必須フィールドチェック
    const requiredFields = ['product_name', 'active_ingredient', 'registration_number', 'manufacturer', 'product_type']
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({ 
          error: `${field} is required` 
        }, { status: 400 })
      }
    }

    // 重複チェック（登録番号）
    const { data: existing } = await supabase
      .from('pesticide_products')
      .select('id')
      .eq('registration_number', body.registration_number)
      .single()

    if (existing) {
      return NextResponse.json({ 
        error: 'Registration number already exists' 
      }, { status: 409 })
    }

    // データ挿入
    const { data, error } = await supabase
      .from('pesticide_products')
      .insert({
        product_name: body.product_name,
        active_ingredient: body.active_ingredient,
        registration_number: body.registration_number,
        manufacturer: body.manufacturer,
        product_type: body.product_type,
        dilution_rate: body.dilution_rate || null,
        max_applications_per_season: body.max_applications_per_season || null,
        application_interval_days: body.application_interval_days || null,
        harvest_restriction_days: body.harvest_restriction_days || 0,
        target_crops: body.target_crops || [],
        target_pests: body.target_pests || [],
        organic_approved: body.organic_approved || false,
        ja_approved: body.ja_approved !== false, // デフォルトtrue
        export_approved: body.export_approved !== false, // デフォルトtrue
        special_restrictions: body.special_restrictions || null,
        toxicity_class: body.toxicity_class || '普通物',
        ppe_required: body.ppe_required || [],
        storage_requirements: body.storage_requirements || null
      })
      .select()
      .single()

    if (error) {
      console.error('❌ 農薬API - 作成エラー:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('✅ 農薬API - 作成成功:', data.id)

    return NextResponse.json({
      success: true,
      data: data
    }, { status: 201 })

  } catch (error) {
    console.error('❌ 農薬API - 予期しないエラー:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}