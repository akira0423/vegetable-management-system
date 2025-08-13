import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // URLクエリパラメータを取得
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')
    const vegetableId = searchParams.get('vegetable_id')
    const status = searchParams.get('status')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 })
    }

    // ベースクエリ - シンプル化してデバッグ
    let query = supabase
      .from('growing_tasks')
      .select(`
        id,
        name,
        start_date,
        end_date,
        progress,
        status,
        priority,
        task_type,
        description,
        assigned_to,
        vegetable:vegetables!inner(
          id,
          name,
          variety_name,
          company_id
        )
      `)
      .eq('vegetables.company_id', companyId)
      .order('start_date', { ascending: true })

    // フィルター条件を追加
    if (vegetableId) {
      query = query.eq('vegetable_id', vegetableId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (startDate && endDate) {
      // 指定期間と重複するタスクを取得
      query = query
        .lte('start_date', endDate)   // タスク開始日 <= 範囲終了日
        .gte('end_date', startDate)   // タスク終了日 >= 範囲開始日
    }

    const { data: tasks, error } = await query

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
    }


    // データの変換
    const ganttTasks = tasks.map(task => ({
      id: task.id,
      name: task.name,
      start: task.start_date,
      end: task.end_date,
      progress: task.progress || 0,
      status: task.status,
      priority: task.priority || 'medium',
      vegetable: {
        id: task.vegetable.id,
        name: task.vegetable.name,
        variety: task.vegetable.variety_name
      },
      assignedUser: task.assigned_to ? {
        id: task.assigned_to,
        name: 'User' // 一時的
      } : null,
      description: task.description,
      workType: task.task_type,
      color: getStatusColor(task.status)
    }))

    // 野菜一覧も取得
    const { data: vegetables, error: vegetablesError } = await supabase
      .from('vegetables')
      .select('id, name, variety_name, status')
      .eq('company_id', companyId)
      .order('name', { ascending: true })

    if (vegetablesError) {
      console.error('Vegetables fetch error:', vegetablesError)
    }

    return NextResponse.json({
      success: true,
      data: {
        tasks: ganttTasks,
        vegetables: vegetables || []
      }
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
    const body = await request.json()
    
    const {
      vegetable_id,
      name,
      start_date,
      end_date,
      priority = 'medium',
      task_type,
      description,
      assigned_user_id,
      created_by
    } = body

    // 必須フィールドのバリデーション
    if (!vegetable_id || !name || !start_date || !end_date) {
      return NextResponse.json({ 
        error: 'Missing required fields: vegetable_id, name, start_date, end_date' 
      }, { status: 400 })
    }

    // UUIDバリデーション: 無効なUUIDの場合はnullに設定
    const isValidUUID = (uuid: string) => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      return uuidRegex.test(uuid)
    }

    const validAssignedUserId = assigned_user_id && isValidUUID(assigned_user_id) ? assigned_user_id : null

    // task_typeのデフォルト値を設定（null制約対応）
    const validTaskType = task_type || 'other'

    // タスクを作成
    const { data: task, error } = await supabase
      .from('growing_tasks')
      .insert({
        vegetable_id,
        name,
        start_date,
        end_date,
        priority,
        task_type: validTaskType,
        description,
        assigned_to: validAssignedUserId,
        created_by: created_by || null,
        status: 'pending',
        progress: 0
      })
      .select(`
        id,
        name,
        start_date,
        end_date,
        progress,
        status,
        priority,
        task_type,
        description,
        assigned_to,
        vegetable:vegetables(
          id,
          name,
          variety_name
        )
      `)
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
    }

    // レスポンス用にデータを整形
    const ganttTask = {
      id: task.id,
      name: task.name,
      start: task.start_date,
      end: task.end_date,
      progress: task.progress || 0,
      status: task.status,
      priority: task.priority,
      vegetable: {
        id: task.vegetable.id,
        name: task.vegetable.name,
        variety: task.vegetable.variety_name
      },
      assignedUser: task.assigned_to ? {
        id: task.assigned_to,
        name: 'User' // 一時的 - ユーザー情報は別途取得が必要
      } : null,
      color: getStatusColor(task.status)
    }

    return NextResponse.json({
      success: true,
      data: ganttTask
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const {
      id,
      name,
      start_date,
      end_date,
      progress,
      status,
      priority,
      description,
      assigned_user_id
    } = body

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    // タスクを更新
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (start_date !== undefined) updateData.start_date = start_date
    if (end_date !== undefined) updateData.end_date = end_date
    if (progress !== undefined) updateData.progress = progress
    if (status !== undefined) updateData.status = status
    if (priority !== undefined) updateData.priority = priority
    if (description !== undefined) updateData.description = description
    if (assigned_user_id !== undefined) updateData.assigned_to = assigned_user_id

    const { data: task, error } = await supabase
      .from('growing_tasks')
      .update(updateData)
      .eq('id', id)
      .select(`
        id,
        name,
        start_date,
        end_date,
        progress,
        status,
        priority,
        task_type,
        description,
        assigned_to,
        vegetable:vegetables(
          id,
          name,
          variety_name
        )
      `)
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
    }

    const ganttTask = {
      id: task.id,
      name: task.name,
      start: task.start_date,
      end: task.end_date,
      progress: task.progress || 0,
      status: task.status,
      priority: task.priority,
      vegetable: {
        id: task.vegetable.id,
        name: task.vegetable.name,
        variety: task.vegetable.variety_name
      },
      assignedUser: task.assigned_to ? {
        id: task.assigned_to,
        name: 'User' // 一時的 - ユーザー情報は別途取得が必要
      } : null,
      color: getStatusColor(task.status)
    }

    return NextResponse.json({
      success: true,
      data: ganttTask
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    // タスクを削除
    const { error } = await supabase
      .from('growing_tasks')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Task deleted successfully'
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

function getStatusColor(status: string): string {
  const colors = {
    pending: '#94a3b8',      // グレー
    in_progress: '#3b82f6',  // ブルー
    completed: '#10b981',    // グリーン
    cancelled: '#ef4444',    // レッド
  }
  return colors[status as keyof typeof colors] || colors.pending
}