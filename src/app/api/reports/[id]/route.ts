import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Report ID is required' },
        { status: 400 }
      )
    }

    const { data: report, error } = await supabase
      .from('work_reports')
      .select(`
        *,
        vegetables (
          id,
          name,
          variety_name,
          plot_name
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('作業レポート取得エラー:', error)
      return NextResponse.json(
        { success: false, error: 'Report not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: report
    })

  } catch (error) {
    console.error('API エラー:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Report ID is required' },
        { status: 400 }
      )
    }

    // 更新対象フィールドの準備
    const updateData: any = {
      work_date: body.work_date,
      work_type: body.work_type,
      work_notes: body.work_notes,
      
      // 天候・環境
      weather: body.weather || null,
      temperature: body.temperature || null,
      humidity: body.humidity || null,
      
      // 作業情報
      work_duration: body.work_duration || null,
      worker_count: body.worker_count || null,
      
      // 収穫情報
      harvest_amount: body.harvest_amount || null,
      harvest_unit: body.harvest_unit || null,
      harvest_quality: body.harvest_quality || null,
      
      
      // その他
      work_amount: body.work_amount || null,
      work_unit: body.work_unit || null,
      expected_price: body.expected_price || null,
      photos: body.photos || null,
      
      // 土壌情報
      soil_ph: body.soil_ph || null,
      soil_ec: body.soil_ec || null,
      phosphorus_absorption: body.phosphorus_absorption || null,
      available_phosphorus: body.available_phosphorus || null,
      cec: body.cec || null,
      exchangeable_calcium: body.exchangeable_calcium || null,
      exchangeable_magnesium: body.exchangeable_magnesium || null,
      exchangeable_potassium: body.exchangeable_potassium || null,
      base_saturation: body.base_saturation || null,
      calcium_magnesium_ratio: body.calcium_magnesium_ratio || null,
      magnesium_potassium_ratio: body.magnesium_potassium_ratio || null,
      available_silica: body.available_silica || null,
      free_iron_oxide: body.free_iron_oxide || null,
      humus_content: body.humus_content || null,
      ammonium_nitrogen: body.ammonium_nitrogen || null,
      nitrate_nitrogen: body.nitrate_nitrogen || null,
      manganese: body.manganese || null,
      boron: body.boron || null,
      soil_notes: body.soil_notes || null,
      
      // 会計情報
      income_items: body.income_items || null,
      expense_items: body.expense_items || null,
      income_total: body.income_total || null,
      expense_total: body.expense_total || null,
      net_income: body.net_income || null,
      
      updated_at: new Date().toISOString()
    }

    // Nullや未定義値をクリーンアップ
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key]
      }
    })

    console.log('作業レポート更新データ:', { id, updateData })
    console.log('土壌データ詳細:', {
      soil_ph: body.soil_ph,
      soil_ec: body.soil_ec,
      available_phosphorus: body.available_phosphorus
    })

    const { data: updatedReport, error } = await supabase
      .from('work_reports')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        vegetables (
          id,
          name,
          variety_name,
          plot_name
        )
      `)
      .single()

    if (error) {
      console.error('作業レポート更新エラー:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }

    console.log('作業レポート更新成功:', updatedReport)

    return NextResponse.json({
      success: true,
      data: updatedReport,
      message: '作業記録が正常に更新されました'
    })

  } catch (error) {
    console.error('作業レポート更新 API エラー:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Report ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('work_reports')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('作業レポート削除エラー:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '作業記録が正常に削除されました'
    })

  } catch (error) {
    console.error('作業レポート削除 API エラー:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}