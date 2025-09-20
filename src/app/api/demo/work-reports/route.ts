import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Supabaseクライアントの作成
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    // デモAPIは誰でもアクセス可能（認証チェック削除）
    // demo_work_reportsテーブルからデータを取得
    const { data: reports, error: reportsError } = await supabase
      .from('demo_work_reports')
      .select(`
        *,
        vegetable:demo_vegetables (
          id,
          name,
          variety_name
        ),
        task:demo_growing_tasks (
          id,
          name,
          task_type
        )
      `)
      .order('work_date', { ascending: false })

    if (reportsError) {
      
      return NextResponse.json({
        success: false,
        error: reportsError.message
      }, { status: 500 })
    }

    // フォーマット変換
    const formattedReports = (reports || []).map(report => ({
      id: report.id,
      vegetable_id: report.vegetable_id,
      growing_task_id: report.growing_task_id,
      work_type: report.work_type,
      work_date: report.work_date,
      description: report.description,
      duration_hours: report.duration_hours,
      weather: report.weather,
      temperature: report.temperature,
      harvest_amount: report.harvest_amount,
      harvest_unit: report.harvest_unit,
      expected_revenue: report.expected_revenue,
      work_notes: report.notes,
      worker_count: report.worker_count,
      vegetable: report.vegetable,
      task: report.task,
      created_at: report.created_at
    }))

    return NextResponse.json({
      success: true,
      data: formattedReports
    })
  } catch (error) {
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// POSTリクエスト（デモ版では実際に保存しない）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // デモ版では実際にデータベースに保存せず、成功レスポンスのみ返す
    

    // 仮のレスポンス
    return NextResponse.json({
      success: true,
      message: 'デモ版のため、実際には保存されません',
      data: {
        ...body,
        id: `demo-report-${Date.now()}`,
        created_at: new Date().toISOString()
      }
    })
  } catch (error) {
    
    return NextResponse.json({
      success: false,
      error: 'デモ版のため、作業記録の作成はできません'
    }, { status: 400 })
  }
}

// PUTリクエスト（デモ版では実際に更新しない）
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    // デモ版では実際にデータベースを更新せず、成功レスポンスのみ返す
    

    return NextResponse.json({
      success: true,
      message: 'デモ版のため、実際には更新されません',
      data: body
    })
  } catch (error) {
    
    return NextResponse.json({
      success: false,
      error: 'デモ版のため、作業記録の更新はできません'
    }, { status: 400 })
  }
}

// DELETEリクエスト（デモ版では実際に削除しない）
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const reportId = searchParams.get('id')

    // デモ版では実際にデータベースから削除せず、成功レスポンスのみ返す
    

    return NextResponse.json({
      success: true,
      message: 'デモ版のため、実際には削除されません'
    })
  } catch (error) {
    
    return NextResponse.json({
      success: false,
      error: 'デモ版のため、作業記録の削除はできません'
    }, { status: 400 })
  }
}