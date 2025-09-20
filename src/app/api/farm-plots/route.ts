import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { FarmPlot } from '@/types/database'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    
    const companyId = searchParams.get('company_id')
    const plotId = searchParams.get('plot_id')
    
    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'company_id is required' },
        { status: 400 }
      )
    }

    let query = supabase
      .from('farm_plots')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (plotId) {
      query = query.eq('id', plotId)
    }

    const { data: plots, error } = await query

    if (error) {
      
      return NextResponse.json(
        { success: false, error: 'Failed to fetch farm plots' },
        { status: 500 }
      )
    }

    // PostGISのgeometryを GeoJSON に変換
    const formattedPlots = plots?.map(plot => ({
      ...plot,
      geometry: plot.geometry ? JSON.parse(plot.geometry) : null,
      geometry_jgd2011: plot.geometry_jgd2011 ? JSON.parse(plot.geometry_jgd2011) : null
    })) || []

    return NextResponse.json({
      success: true,
      data: formattedPlots,
      total: formattedPlots.length
    })

  } catch (error) {
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    const {
      company_id,
      name,
      description,
      area_hectares,
      geometry,
      geometry_jgd2011,
      prefecture,
      city,
      address,
      postal_code,
      wagri_plot_id,
      wagri_city_code,
      created_by
    } = body

    // 必須フィールドの検証
    if (!company_id || !name || !geometry || !created_by) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Required fields: company_id, name, geometry, created_by' 
        },
        { status: 400 }
      )
    }

    // geometryをWKT形式に変換
    const geometryWKT = `ST_GeomFromGeoJSON('${JSON.stringify(geometry)}')`
    const geometryJGD2011WKT = geometry_jgd2011 
      ? `ST_GeomFromGeoJSON('${JSON.stringify(geometry_jgd2011)}')`
      : null

    // 農地データ作成
    const { data: newPlot, error } = await supabase
      .from('farm_plots')
      .insert({
        company_id,
        name,
        description,
        area_hectares: area_hectares || null,
        geometry: geometryWKT,
        geometry_jgd2011: geometryJGD2011WKT,
        prefecture,
        city,
        address,
        postal_code,
        wagri_plot_id,
        wagri_city_code,
        created_by
      })
      .select('*')
      .single()

    if (error) {
      
      return NextResponse.json(
        { success: false, error: 'Failed to create farm plot' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        ...newPlot,
        geometry: newPlot.geometry ? JSON.parse(newPlot.geometry) : null
      }
    }, { status: 201 })

  } catch (error) {
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const body = await request.json()
    
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Plot ID is required' },
        { status: 400 }
      )
    }

    // geometryが含まれている場合はWKT形式に変換
    if (updateData.geometry) {
      updateData.geometry = `ST_GeomFromGeoJSON('${JSON.stringify(updateData.geometry)}')`
    }
    if (updateData.geometry_jgd2011) {
      updateData.geometry_jgd2011 = `ST_GeomFromGeoJSON('${JSON.stringify(updateData.geometry_jgd2011)}')`
    }

    const { data: updatedPlot, error } = await supabase
      .from('farm_plots')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      
      return NextResponse.json(
        { success: false, error: 'Failed to update farm plot' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        ...updatedPlot,
        geometry: updatedPlot.geometry ? JSON.parse(updatedPlot.geometry) : null
      }
    })

  } catch (error) {
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    
    const plotId = searchParams.get('plot_id')

    if (!plotId) {
      return NextResponse.json(
        { success: false, error: 'plot_id is required' },
        { status: 400 }
      )
    }

    // ソフト削除（ステータスを'archived'に変更）
    const { error } = await supabase
      .from('farm_plots')
      .update({ 
        status: 'archived',
        updated_at: new Date().toISOString()
      })
      .eq('id', plotId)

    if (error) {
      
      return NextResponse.json(
        { success: false, error: 'Failed to delete farm plot' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Farm plot deleted successfully'
    })

  } catch (error) {
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}