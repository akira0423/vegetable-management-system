import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // URLクエリパラメータを取得
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')
    const vegetableId = searchParams.get('vegetable_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const workType = searchParams.get('work_type')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 })
    }

    // ベースクエリ
    let query = supabase
      .from('work_reports')
      .select(`
        id,
        vegetable_id,
        work_type,
        description,
        work_date,
        start_time,
        end_time,
        duration_hours,
        photos,
        weather,
        temperature,
        notes,
        created_by,
        created_at,
        vegetables:vegetable_id (
          id,
          name,
          variety_name,
          plot_name
        )
      `)
      .eq('company_id', companyId)
      .order('work_date', { ascending: false })
      .order('created_at', { ascending: false })

    // フィルター条件の適用
    if (vegetableId) {
      query = query.eq('vegetable_id', vegetableId)
    }

    if (startDate) {
      query = query.gte('work_date', startDate)
    }

    if (endDate) {
      query = query.lte('work_date', endDate)
    }

    if (workType) {
      query = query.eq('work_type', workType)
    }

    // ページネーション
    query = query.range(offset, offset + limit - 1)

    const { data, error } = await query

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Database error', details: error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      count: data?.length || 0
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    let body;
    try {
      body = await request.json()
    } catch (jsonError) {
      console.error('JSON parse error:', jsonError)
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    // 必須フィールドの検証
    if (!body.company_id) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 })
    }

    if (!body.work_type) {
      return NextResponse.json({ error: 'Work type is required' }, { status: 400 })
    }

    if (!body.work_date) {
      return NextResponse.json({ error: 'Work date is required' }, { status: 400 })
    }

    // 作業報告データの準備
    const reportData = {
      company_id: body.company_id,
      vegetable_id: body.vegetable_id || null,
      work_type: body.work_type,
      description: body.description || null,
      work_date: body.work_date,
      start_time: body.start_time || null,
      end_time: body.end_time || null,
      duration_hours: body.duration_hours || null,
      photos: body.photos || [],
      weather: body.weather || null,
      temperature: body.temperature || null,
      notes: body.notes || null,
      created_by: body.created_by || null
    }

    // データベースに挿入
    const { data, error } = await supabase
      .from('work_reports')
      .insert(reportData)
      .select(`
        id,
        vegetable_id,
        work_type,
        description,
        work_date,
        start_time,
        end_time,
        duration_hours,
        photos,
        weather,
        temperature,
        notes,
        created_by,
        created_at,
        vegetables:vegetable_id (
          id,
          name,
          variety_name,
          plot_name
        )
      `)
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Database error', details: error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data,
      message: 'Work report created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('POST API error:', error)
    console.error('Error stack:', error.stack)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}