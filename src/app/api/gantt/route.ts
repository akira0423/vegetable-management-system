import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // 認証済みクライアントを使用（セキュリティ強化）
    const supabase = await createClient()
    
    // ユーザー認証確認
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    // URLクエリパラメータを取得
    const { searchParams } = new URL(request.url)
    let companyId = searchParams.get('company_id')
    const vegetableId = searchParams.get('vegetable_id')
    const status = searchParams.get('status')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    // API リクエストパラメータの基本ログ
    

    // Company IDが指定されていない場合はエラー
    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 })
    }

    // ユーザーの企業アクセス権を確認
    const { ensureUserMembership } = await import('@/lib/auth/membership-helper')
    const membershipResult = await ensureUserMembership(user.id, companyId)

    if (!membershipResult.success) {
      if (process.env.NODE_ENV === 'development') {
        
      }
      return NextResponse.json(
        { error: 'Access denied to this company data' },
        { status: 403 }
      )
    }

    // アクティブなタスクのみ取得するかどうか
    const activeOnly = searchParams.get('active_only') !== 'false'
    
    
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
        assigned_to,
        created_at,
        updated_at,
        vegetables:vegetable_id (
          id,
          name,
          variety_name,
          plot_name,
          status,
          deleted_at
        ),
        assignedUser:users!growing_tasks_assigned_to_fkey (
          id,
          full_name,
          email
        )
      `)
      .eq('company_id', companyId) // 作業記録と同じ直接フィルタリング
      
    // 一時的にソフト削除フィルターを無効化（カラムが存在しないため）
    
    // if (activeOnly) {
    //   ')
    //   query = query.is('deleted_at', null)
    // } else {
    //   
    // }
    
    query = query.order('start_date', { ascending: true })

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
      
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
    }


    // データの変換（削除された野菜に関連するタスクを除外）
    const ganttTasks = tasks
      .filter(task => {
        // ハード削除のため、タスクの削除チェックは不要
        // 野菜が存在し、かつ削除されていないかのみチェック
        const vegetableValid = task.vegetables !== null && task.vegetables.deleted_at === null
        
        if (!vegetableValid) {
          
        }
        return vegetableValid
      })
      .map(task => ({
        id: task.id,
        name: task.name,
        start: task.start_date,
        end: task.end_date,
        progress: task.progress || 0,
        status: task.status,
        priority: task.priority || 'medium',
        vegetable: {
          id: task.vegetables?.id || task.vegetable_id,
          name: task.vegetables?.name || '不明',
          variety: task.vegetables?.variety_name || ''
        },
        assignedUser: task.assignedUser ? {
          id: task.assignedUser.id,
          name: task.assignedUser.full_name || task.assignedUser.email,
          email: task.assignedUser.email
        } : null,
        description: task.description,
        workType: task.task_type,
        color: getStatusColor(task.status)
      }))

    // 野菜一覧も取得（削除された野菜を除外）
    const { data: vegetables, error: vegetablesError } = await supabase
      .from('vegetables')
      .select('id, name, variety_name, status, area_size')
      .eq('company_id', companyId)
      .is('deleted_at', null) // ソフトデリート：削除済みデータを除外
      .order('name', { ascending: true })

    if (vegetablesError) {
      
    }

    // 野菜データの面積情報をログ出力（削除済み）

    return NextResponse.json({
      success: true,
      data: {
        tasks: ganttTasks,
        vegetables: vegetables || []
      }
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
    // 認証済みクライアントを使用（セキュリティ強化）
    const supabase = await createClient()
    
    // ユーザー認証確認
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
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

    // vegetable_idからcompany_idを取得し、アクセス権限を確認
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

    // ユーザーが該当企業にアクセス権限を持っているか確認
    const { checkAndEnsureMembership } = await import('@/lib/auth/membership-helper')
    const membershipResult = await checkAndEnsureMembership(user.id, vegetableData.company_id)

    if (!membershipResult.success) {
      if (process.env.NODE_ENV === 'development') {
        
      }
      return NextResponse.json(
        { error: 'Access denied to this company data' },
        { status: 403 }
      )
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
      // assigned_to: validAssignedUserId, // カラムが存在しないためコメントアウト
      created_by: created_by || 'd0efa1ac-7e7e-420b-b147-dabdf01454b7', // 既存ユーザーID
      status: 'pending',
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
        assigned_to,
        created_at,
        updated_at,
        vegetables:vegetable_id (
          id,
          name,
          variety_name,
          plot_name,
          status,
          deleted_at
        ),
        assignedUser:users!growing_tasks_assigned_to_fkey (
          id,
          full_name,
          email
        )
      `)
      .single()

    if (error) {
      
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
        id: task.vegetables?.id || task.vegetable_id,
        name: task.vegetables?.name || '不明',
        variety: task.vegetables?.variety_name || ''
      },
      assignedUser: task.assignedUser ? {
        id: task.assignedUser.id,
        name: task.assignedUser.full_name || task.assignedUser.email,
        email: task.assignedUser.email
      } : null,
      color: getStatusColor(task.status)
    }

    return NextResponse.json({
      success: true,
      data: ganttTask
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
    // 認証済みクライアントを使用（セキュリティ強化）
    const supabase = await createClient()
    const serviceSupabase = await createServiceClient()

    // ユーザー認証確認
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
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

    // タスクの存在確認と企業アクセス権限チェック
    const { data: existingTask, error: taskError } = await supabase
      .from('growing_tasks')
      .select('company_id')
      .eq('id', id)
      .single()

    if (taskError || !existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // ユーザーが該当企業にアクセス権限を持っているか確認
    const { checkAndEnsureMembership } = await import('@/lib/auth/membership-helper')
    const membershipResult = await checkAndEnsureMembership(user.id, existingTask.company_id)

    if (!membershipResult.success) {
      if (process.env.NODE_ENV === 'development') {
        
      }
      return NextResponse.json(
        { error: 'Access denied to this company data' },
        { status: 403 }
      )
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

    // assigned_user_idの処理: nullまたは有効なUUIDのみ許可
    if (assigned_user_id !== undefined) {
      if (assigned_user_id === null) {
        // NULLは許可（未割当）
        updateData.assigned_to = null
      } else if (assigned_user_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(assigned_user_id)) {
        // 有効なUUIDの場合、ユーザーが存在するか確認 (serviceSupabaseを使用してRLSをバイパス)
        const { data: userExists } = await serviceSupabase
          .from('users')
          .select('id')
          .eq('id', assigned_user_id)
          .single()

        if (userExists) {
          updateData.assigned_to = assigned_user_id
          
        } else {
          
        }
      } else {
        
      }
    }

    // 更新データが空の場合はエラーを返す
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No data to update' }, { status: 400 })
    }

    // まず、タスクが実際に存在するか確認（削除されていないか）
    const { data: taskExists, error: checkError } = await supabase
      .from('growing_tasks')
      .select('id, deleted_at')
      .eq('id', id)
      .single()

    if (checkError || !taskExists) {
      
      return NextResponse.json({ error: 'Task not found in database' }, { status: 404 })
    }

    if (taskExists.deleted_at) {
      
      return NextResponse.json({ error: 'Task has been deleted' }, { status: 410 })
    }

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
          variety_name,
          deleted_at
        ),
        assignedUser:users!growing_tasks_assigned_to_fkey (
          id,
          full_name,
          email
        )
      `)
      .single()

    if (error) {
      
      
      
      return NextResponse.json({ error: `Failed to update task: ${error.message}` }, { status: 500 })
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
      assignedUser: task.assignedUser ? {
        id: task.assignedUser.id,
        name: task.assignedUser.full_name || task.assignedUser.email,
        email: task.assignedUser.email
      } : null,
      color: getStatusColor(task.status)
    }

    return NextResponse.json({
      success: true,
      data: ganttTask
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
    
    // 認証済みクライアントを使用（セキュリティ強化）
    const supabase = await createClient()
    
    // ユーザー認証確認
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    const body = await request.json()
    
    const { id, reason, hard_delete = false } = body
    

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    // タスクの存在確認と企業アクセス権限チェック
    const { data: taskToDelete, error: taskFetchError } = await supabase
      .from('growing_tasks')
      .select('company_id, name')
      .eq('id', id)
      .single()

    if (taskFetchError || !taskToDelete) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // ユーザーが該当企業にアクセス権限を持っているか確認
    const { checkAndEnsureMembership } = await import('@/lib/auth/membership-helper')
    const membershipResult = await checkAndEnsureMembership(user.id, taskToDelete.company_id)

    if (!membershipResult.success) {
      if (process.env.NODE_ENV === 'development') {
        
      }
      return NextResponse.json(
        { error: 'Access denied to this company data' },
        { status: 403 }
      )
    }

    // ハード削除実行（work_reportsと同じ方式）
    
    
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

function getStatusColor(status: string): string {
  const colors = {
    pending: '#94a3b8',      // グレー
    in_progress: '#3b82f6',  // ブルー
    completed: '#10b981',    // グリーン
    cancelled: '#ef4444',    // レッド
  }
  return colors[status as keyof typeof colors] || colors.pending
}