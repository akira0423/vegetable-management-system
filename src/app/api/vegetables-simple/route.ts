import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 })
    }

    const { checkAndEnsureMembership } = await import('@/lib/auth/membership-helper')
    const membershipResult = await checkAndEnsureMembership(user.id, companyId)

    if (!membershipResult.success) {
      return NextResponse.json(
        { error: 'Access denied to this company data' },
        { status: 403 }
      )
    }

    let query = supabase
      .from('vegetables')
      .select(`
        id,
        name,
        variety_name,
        plot_name,
        area_size,
        planting_date,
        expected_harvest_start,
        expected_harvest_end,
        status,
        notes,
        custom_fields,
        created_at,
        company_id
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    const { data, error } = await query

    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Database error:', error)
      }
      return NextResponse.json(
        { error: 'Database error occurred' },
        { status: 500 }
      )
    }

    const processedData = (data || []).map(vegetable => ({
      ...vegetable,
      farm_area_data: vegetable.custom_fields?.farm_area_data || null,
      has_spatial_data: vegetable.custom_fields?.has_spatial_data || false,
      polygon_color: vegetable.custom_fields?.polygon_color || '#22c55e'
    }))

    return NextResponse.json({
      success: true,
      data: processedData,
      count: processedData.length
    })

  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('API error:', error)
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()

    if (!body.company_id) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 })
    }

    const { checkAndEnsureMembership } = await import('@/lib/auth/membership-helper')
    const membershipResult = await checkAndEnsureMembership(user.id, body.company_id)

    if (!membershipResult.success) {
      return NextResponse.json(
        { error: 'Access denied to this company data' },
        { status: 403 }
      )
    }

    if (!body.name || !body.variety_name || !body.plot_name) {
      return NextResponse.json(
        { error: 'Required fields missing (name, variety_name, plot_name)' },
        { status: 400 }
      )
    }

    const insertData = {
      name: body.name,
      variety_name: body.variety_name,
      plot_name: body.plot_name,
      area_size: body.area_size || 0,
      planting_date: body.planting_date,
      expected_harvest_start: body.expected_harvest_start || null,
      expected_harvest_end: body.expected_harvest_end || null,
      status: body.status || 'planning',
      notes: body.notes || '',
      company_id: body.company_id,
      created_by: user.id,
      custom_fields: body.custom_fields || null
    }

    const { data, error } = await supabase
      .from('vegetables')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Database error:', error)
      }
      return NextResponse.json(
        { error: 'Database error occurred' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data
    }, { status: 201 })

  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('API error:', error)
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}