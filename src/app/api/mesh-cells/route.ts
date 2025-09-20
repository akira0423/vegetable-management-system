import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { generateMesh } from '@/lib/mesh-generator'
import type { Feature, Polygon } from 'geojson'
import type { PlotCell, VegetableCell } from '@/types/database'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    
    const farmPlotId = searchParams.get('farm_plot_id')
    const includeVegetables = searchParams.get('include_vegetables') === 'true'
    
    if (!farmPlotId) {
      return NextResponse.json(
        { success: false, error: 'farm_plot_id is required' },
        { status: 400 }
      )
    }

    // メッシュセルデータを取得
    let query = supabase
      .from('plot_cells')
      .select('*')
      .eq('farm_plot_id', farmPlotId)
      .order('row_index')
      .order('col_index')

    const { data: cells, error } = await query

    if (error) {
      
      return NextResponse.json(
        { success: false, error: 'Failed to fetch mesh cells' },
        { status: 500 }
      )
    }

    // 野菜情報も含める場合
    let vegetableCellsData = []
    if (includeVegetables && cells && cells.length > 0) {
      const cellIds = cells.map(cell => cell.id)
      
      const { data: vegetableCells, error: vegError } = await supabase
        .from('vegetable_cells')
        .select(`
          *,
          vegetables:vegetable_id (
            id,
            name,
            variety_name,
            status
          )
        `)
        .in('plot_cell_id', cellIds)

      if (!vegError) {
        vegetableCellsData = vegetableCells || []
      }
    }

    // レスポンスデータの整形
    const formattedCells = cells?.map(cell => {
      const vegetableInfo = vegetableCellsData.find(
        (vc: any) => vc.plot_cell_id === cell.id
      )

      return {
        ...cell,
        geometry: cell.geometry ? JSON.parse(cell.geometry) : null,
        center_point: cell.center_point ? JSON.parse(cell.center_point) : null,
        vegetable_info: vegetableInfo ? {
          id: vegetableInfo.vegetables.id,
          name: vegetableInfo.vegetables.name,
          variety_name: vegetableInfo.vegetables.variety_name,
          status: vegetableInfo.vegetables.status,
          planting_date: vegetableInfo.planting_date,
          growth_stage: vegetableInfo.growth_stage,
          health_status: vegetableInfo.health_status
        } : null
      }
    }) || []

    return NextResponse.json({
      success: true,
      data: formattedCells,
      total: formattedCells.length
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
      farm_plot_id,
      regenerate = false,
      mesh_size_meters = 5
    } = body

    if (!farm_plot_id) {
      return NextResponse.json(
        { success: false, error: 'farm_plot_id is required' },
        { status: 400 }
      )
    }

    // 農地データを取得
    const { data: farmPlot, error: plotError } = await supabase
      .from('farm_plots')
      .select('*')
      .eq('id', farm_plot_id)
      .single()

    if (plotError || !farmPlot) {
      return NextResponse.json(
        { success: false, error: 'Farm plot not found' },
        { status: 404 }
      )
    }

    // 既存のメッシュが存在するかチェック
    if (!regenerate && farmPlot.is_mesh_generated) {
      const { data: existingCells } = await supabase
        .from('plot_cells')
        .select('id')
        .eq('farm_plot_id', farm_plot_id)
        .limit(1)

      if (existingCells && existingCells.length > 0) {
        return NextResponse.json({
          success: false,
          error: 'Mesh already exists. Use regenerate=true to recreate.',
          existing_mesh: true
        }, { status: 409 })
      }
    }

    // 既存メッシュを削除（再生成の場合）
    if (regenerate) {
      const { error: deleteError } = await supabase
        .from('plot_cells')
        .delete()
        .eq('farm_plot_id', farm_plot_id)

      if (deleteError) {
        
      }
    }

    // ポリゴンGeometry を取得・変換
    const plotGeometry = farmPlot.geometry ? JSON.parse(farmPlot.geometry) : null
    
    if (!plotGeometry) {
      return NextResponse.json(
        { success: false, error: 'Farm plot geometry not found' },
        { status: 400 }
      )
    }

    // メッシュ生成
    const meshResult = await generateMesh(
      {
        type: 'Feature',
        geometry: plotGeometry,
        properties: {}
      } as Feature<Polygon>,
      {
        cellSize: mesh_size_meters,
        units: 'meters',
        cropToPolygon: true,
        generateStatistics: true
      }
    )

    // データベースにメッシュセルを保存
    const cellsToInsert = meshResult.cells.map((cell, index) => {
      const [west, south, east, north] = cell.bounds
      
      return {
        farm_plot_id,
        cell_index: index,
        row_index: cell.row,
        col_index: cell.col,
        geometry: `ST_GeomFromGeoJSON('${JSON.stringify({
          type: 'Polygon',
          coordinates: [[
            [west, south],
            [east, south], 
            [east, north],
            [west, north],
            [west, south]
          ]]
        })}')`,
        center_point: `ST_GeomFromGeoJSON('${JSON.stringify({
          type: 'Point',
          coordinates: [cell.centerLng, cell.centerLat]
        })}')`,
        area_sqm: mesh_size_meters * mesh_size_meters
      }
    })

    // バッチ挿入
    const batchSize = 100
    const insertedCells = []

    for (let i = 0; i < cellsToInsert.length; i += batchSize) {
      const batch = cellsToInsert.slice(i, i + batchSize)
      
      const { data: batchResult, error: insertError } = await supabase
        .from('plot_cells')
        .insert(batch)
        .select('*')

      if (insertError) {
        
        return NextResponse.json(
          { success: false, error: 'Failed to insert mesh cells' },
          { status: 500 }
        )
      }

      if (batchResult) {
        insertedCells.push(...batchResult)
      }
    }

    // 農地のメッシュ生成フラグを更新
    const { error: updateError } = await supabase
      .from('farm_plots')
      .update({
        is_mesh_generated: true,
        mesh_size_meters,
        mesh_generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', farm_plot_id)

    if (updateError) {
      
    }

    return NextResponse.json({
      success: true,
      data: {
        farm_plot_id,
        total_cells: insertedCells.length,
        total_area_sqm: meshResult.totalAreaSqm,
        mesh_size_meters,
        statistics: meshResult.statistics
      }
    }, { status: 201 })

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
    
    const farmPlotId = searchParams.get('farm_plot_id')
    const cellId = searchParams.get('cell_id')

    if (!farmPlotId && !cellId) {
      return NextResponse.json(
        { success: false, error: 'farm_plot_id or cell_id is required' },
        { status: 400 }
      )
    }

    let query = supabase.from('plot_cells').delete()

    if (cellId) {
      query = query.eq('id', cellId)
    } else if (farmPlotId) {
      query = query.eq('farm_plot_id', farmPlotId)
    }

    const { error } = await query

    if (error) {
      
      return NextResponse.json(
        { success: false, error: 'Failed to delete mesh cells' },
        { status: 500 }
      )
    }

    // 農地のメッシュ生成フラグをリセット（全削除の場合）
    if (farmPlotId && !cellId) {
      const { error: updateError } = await supabase
        .from('farm_plots')
        .update({
          is_mesh_generated: false,
          mesh_generated_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', farmPlotId)

      if (updateError) {
        
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Mesh cells deleted successfully'
    })

  } catch (error) {
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}