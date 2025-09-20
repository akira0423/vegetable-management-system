import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceClient()
    
    // URLクエリパラメータを取得
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')
    const limit = parseInt(searchParams.get('limit') || '100')
    const vegetableId = searchParams.get('vegetable_id')
    const status = searchParams.get('status')

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 })
    }

    // 統一アーキテクチャのベースクエリ（work_reportsと同じ直接フィルタリング）
    let query = supabase
      .from('growing_tasks')
      .select(`
        id,
        company_id,
        vegetable_id,
        name,
        start_date,
        end_date,
        progress,
        status,
        priority,
        task_type,
        description,
        created_at,
        updated_at,
        vegetables:vegetable_id (
          id,
          name,
          variety_name,
          plot_name,
          status,
          deleted_at
        )
      `)
      .eq('company_id', companyId) // 作業記録と同じ直接フィルタリング
      .is('deleted_at', null) // ソフト削除フィルター有効化
      .order('start_date', { ascending: true })
      .limit(limit)

    // フィルター条件を追加
    if (vegetableId) {
      query = query.eq('vegetable_id', vegetableId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data: tasks, error } = await query

    if (error) {
      
      return NextResponse.json({ error: 'Failed to fetch growing tasks' }, { status: 500 })
    }

    // 削除された野菜に関連するタスクを除外（既にdeleted_at IS NULLでフィルタ済み）
    const activeTasks = tasks.filter(task => {
      return task.vegetables !== null && task.vegetables.deleted_at === null
    })

    

    // レスポンス用にデータを整形
    const formattedTasks = activeTasks.map(task => ({
      id: task.id,
      name: task.name,
      start_date: task.start_date,
      end_date: task.end_date,
      progress: task.progress || 0,
      status: task.status,
      priority: task.priority,
      task_type: task.task_type,
      description: task.description,
      vegetable: {
        id: task.vegetables?.id || task.vegetable_id,
        name: task.vegetables?.name || '不明',
        variety: task.vegetables?.variety_name || '',
        plot: task.vegetables?.plot_name || ''
      },
      created_at: task.created_at,
      updated_at: task.updated_at
    }))

    return NextResponse.json({
      success: true,
      data: formattedTasks,
      total: formattedTasks.length
    })

  } catch (error) {
    
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServiceClient()
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

    // vegetable_idからcompany_idを取得（作業記録と同じパターン）
    const { data: vegetableData, error: vegetableError } = await supabase
      .from('vegetables')
      .select('company_id')
      .eq('id', vegetable_id)
      .single()
    
    if (vegetableError) {
      
      return NextResponse.json({ 
        error: 'Invalid vegetable_id or vegetable not found' 
      }, { status: 400 })
    }

    // 統一されたアーキテクチャでタスクを作成（work_reportsと同じ堅牢性）
    const taskData = {
      // 必須フィールド
      company_id: vegetableData.company_id, // 直接フィルタリング用
      vegetable_id,
      name,
      start_date,
      end_date,
      priority,
      task_type: validTaskType,
      
      // オプショナルフィールド
      description,
      created_by: created_by || 'd0efa1ac-7e7e-420b-b147-dabdf01454b7', // 既存ユーザーID
      status: 'in_progress',
      progress: 0
    }

    const { data: task, error } = await supabase
      .from('growing_tasks')
      .insert(taskData)
      .select(`
        id,
        company_id,
        vegetable_id,
        name,
        start_date,
        end_date,
        progress,
        status,
        priority,
        task_type,
        description,
        created_at,
        updated_at,
        vegetables:vegetable_id (
          id,
          name,
          variety_name,
          plot_name,
          status
        )
      `)
      .single()

    if (error) {
      
      return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
    }

    // レスポンス用にデータを整形
    const formattedTask = {
      id: task.id,
      name: task.name,
      start_date: task.start_date,
      end_date: task.end_date,
      progress: task.progress || 0,
      status: task.status,
      priority: task.priority,
      task_type: task.task_type,
      description: task.description,
      vegetable: {
        id: task.vegetables?.id || task.vegetable_id,
        name: task.vegetables?.name || '不明',
        variety: task.vegetables?.variety_name || '',
        plot: task.vegetables?.plot_name || ''
      },
      created_at: task.created_at,
      updated_at: task.updated_at
    }

    return NextResponse.json({
      success: true,
      data: formattedTask
    })

  } catch (error) {
    
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServiceClient()
    const body = await request.json()
    
    const {
      id,
      name,
      start_date,
      end_date,
      progress,
      status,
      priority,
      task_type,
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
    if (task_type !== undefined) updateData.task_type = task_type
    if (description !== undefined) updateData.description = description
    // assigned_to カラムは新しいスキーマにないため削除

    const { data: task, error } = await supabase
      .from('growing_tasks')
      .update(updateData)
      .eq('id', id)
      .select(`
        id,
        company_id,
        vegetable_id,
        name,
        start_date,
        end_date,
        progress,
        status,
        priority,
        task_type,
        description,
        created_at,
        updated_at,
        vegetables:vegetable_id (
          id,
          name,
          variety_name,
          plot_name,
          status
        )
      `)
      .single()

    if (error) {
      
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
    }

    // レスポンス用にデータを整形
    const formattedTask = {
      id: task.id,
      name: task.name,
      start_date: task.start_date,
      end_date: task.end_date,
      progress: task.progress || 0,
      status: task.status,
      priority: task.priority,
      task_type: task.task_type,
      description: task.description,
      vegetable: {
        id: task.vegetables?.id || task.vegetable_id,
        name: task.vegetables?.name || '不明',
        variety: task.vegetables?.variety_name || '',
        plot: task.vegetables?.plot_name || ''
      },
      created_at: task.created_at,
      updated_at: task.updated_at
    }

    return NextResponse.json({
      success: true,
      data: formattedTask
    })

  } catch (error) {
    
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServiceClient()
    const body = await request.json()
    
    const { id, reason, hard_delete = false } = body

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    // ハード削除実装（work_reportsと統一）
    
    
    const { error } = await supabase
      .from('growing_tasks')
      .delete()
      .eq('id', id)

    if (error) {
      
      return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
    }

    

    return NextResponse.json({
      success: true,
      message: 'タスクを削除しました'
    })

  } catch (error) {
    
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}