import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    const { vegetable_id, cells } = body

    if (!vegetable_id || !cells || !Array.isArray(cells) || cells.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'vegetable_id and cells array are required' 
        },
        { status: 400 }
      )
    }

    // バッチ挿入
    const { data: insertedCells, error } = await supabase
      .from('vegetable_cells')
      .insert(cells)
      .select('*')

    if (error) {
      console.error('野菜セル登録エラー:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to register vegetable cells' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: insertedCells,
      total: insertedCells.length
    }, { status: 201 })

  } catch (error) {
    console.error('野菜セルAPI POST エラー:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    
    const vegetableId = searchParams.get('vegetable_id')
    const plotCellId = searchParams.get('plot_cell_id')
    
    let query = supabase
      .from('vegetable_cells')
      .select(`
        *,
        vegetables:vegetable_id (
          id,
          name,
          variety_name,
          status
        ),
        plot_cells:plot_cell_id (
          id,
          row_index,
          col_index,
          area_sqm
        )
      `)

    if (vegetableId) {
      query = query.eq('vegetable_id', vegetableId)
    }

    if (plotCellId) {
      query = query.eq('plot_cell_id', plotCellId)
    }

    const { data: vegetableCells, error } = await query

    if (error) {
      console.error('野菜セルデータ取得エラー:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch vegetable cells' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: vegetableCells || [],
      total: vegetableCells?.length || 0
    })

  } catch (error) {
    console.error('野菜セルAPI GET エラー:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}