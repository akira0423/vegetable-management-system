import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// RLS無効化での確実な削除のためService Roleクライアント使用

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    
    const supabase = await createServiceClient()
    
    // シンプルなハード削除実行
    const { error: deleteError } = await supabase
      .from('growing_tasks')
      .delete()
      .eq('id', id)

    if (deleteError) {
      
      return NextResponse.json({
        success: false,
        error: deleteError.message
      }, { status: 500 })
    }

    
    
    // キャッシュクリア用ヘッダー追加
    const response = NextResponse.json({
      success: true,
      message: 'タスクを削除しました'
    })
    
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    
    return response

  } catch (error) {
    
    return NextResponse.json({
      success: false,
      error: 'サーバーエラー'
    }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServiceClient()
    
    const { data: task } = await supabase
      .from('growing_tasks')
      .select(`
        id,
        name,
        vegetable_id,
        vegetables:vegetable_id (
          id,
          name
        )
      `)
      .eq('id', id)
      .single()

    if (!task) {
      return NextResponse.json({
        can_delete: false,
        warnings: ['タスクが存在しません']
      })
    }

    return NextResponse.json({
      can_delete: true,
      task_info: {
        id: task.id,
        name: task.name,
        vegetable: task.vegetables?.name
      },
      warnings: []
    })

  } catch (error) {
    return NextResponse.json({
      can_delete: false,
      error: 'データ確認エラー'
    }, { status: 500 })
  }
}