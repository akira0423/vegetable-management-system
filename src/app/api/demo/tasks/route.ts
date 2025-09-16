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
    // demo_growing_tasksテーブルからデータを取得
    const { data: tasks, error: tasksError } = await supabase
      .from('demo_growing_tasks')
      .select(`
        *,
        vegetable:demo_vegetables (
          id,
          name,
          variety_name,
          status
        )
      `)
      .order('start_date', { ascending: true })

    if (tasksError) {
      console.error('Error fetching demo tasks:', tasksError)
      return NextResponse.json({
        success: false,
        error: tasksError.message
      }, { status: 500 })
    }

    // ガントチャートフォーマットに変換
    const ganttTasks = (tasks || []).map(task => ({
      id: task.id,
      name: task.name,
      start: task.start_date,
      end: task.end_date,
      progress: task.progress || 0,
      status: task.status,
      priority: task.priority,
      vegetable: {
        id: task.vegetable?.id,
        name: task.vegetable?.name || '不明',
        variety: task.vegetable?.variety_name || ''
      },
      description: task.description,
      workType: task.task_type,
      color: getTaskColor(task.status),
      assignedUser: {
        id: 'demo-user',
        name: 'デモユーザー'
      }
    }))

    return NextResponse.json({
      success: true,
      data: ganttTasks
    })
  } catch (error) {
    console.error('Error in demo tasks API:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// タスクステータスに応じた色を返す
function getTaskColor(status: string): string {
  const colors: Record<string, string> = {
    pending: '#94a3b8',      // グレー
    in_progress: '#3b82f6',  // ブルー
    completed: '#10b981',    // グリーン
    cancelled: '#ef4444'     // レッド
  }
  return colors[status] || '#94a3b8'
}

// POSTリクエスト（デモ版では実際に保存しない）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // デモ版では実際にデータベースに保存せず、成功レスポンスのみ返す
    console.log('Demo task creation request:', body)

    // 仮のレスポンス
    return NextResponse.json({
      success: true,
      message: 'デモ版のため、実際には保存されません',
      data: {
        ...body,
        id: `demo-${Date.now()}`,
        created_at: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Error in demo task creation:', error)
    return NextResponse.json({
      success: false,
      error: 'デモ版のため、タスクの作成はできません'
    }, { status: 400 })
  }
}

// PUTリクエスト（デモ版では実際に更新しない）
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    // デモ版では実際にデータベースを更新せず、成功レスポンスのみ返す
    console.log('Demo task update request:', body)

    return NextResponse.json({
      success: true,
      message: 'デモ版のため、実際には更新されません',
      data: body
    })
  } catch (error) {
    console.error('Error in demo task update:', error)
    return NextResponse.json({
      success: false,
      error: 'デモ版のため、タスクの更新はできません'
    }, { status: 400 })
  }
}

// DELETEリクエスト（デモ版では実際に削除しない）
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('id')

    // デモ版では実際にデータベースから削除せず、成功レスポンスのみ返す
    console.log('Demo task deletion request for ID:', taskId)

    return NextResponse.json({
      success: true,
      message: 'デモ版のため、実際には削除されません'
    })
  } catch (error) {
    console.error('Error in demo task deletion:', error)
    return NextResponse.json({
      success: false,
      error: 'デモ版のため、タスクの削除はできません'
    }, { status: 400 })
  }
}