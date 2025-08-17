import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // 6ヶ月前の日付を計算
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const cutoffDate = sixMonthsAgo.toISOString()
    
    console.log(`6ヶ月自動削除処理開始: ${cutoffDate}以前のデータを削除`)
    
    // 期限切れタスクを物理削除
    const { data: expiredTasks, error: tasksSelectError } = await supabase
      .from('growing_tasks')
      .select('id, name, deleted_at')
      .not('deleted_at', 'is', null)
      .lt('deleted_at', cutoffDate)
    
    if (tasksSelectError) {
      console.error('期限切れタスク取得エラー:', tasksSelectError)
      throw tasksSelectError
    }
    
    let deletedTasksCount = 0
    if (expiredTasks && expiredTasks.length > 0) {
      const { error: deleteTasksError } = await supabase
        .from('growing_tasks')
        .delete()
        .in('id', expiredTasks.map(t => t.id))
      
      if (deleteTasksError) {
        console.error('タスク物理削除エラー:', deleteTasksError)
        throw deleteTasksError
      }
      
      deletedTasksCount = expiredTasks.length
      console.log(`${deletedTasksCount}件のタスクを自動削除しました`)
    }
    
    // 期限切れ実績記録を物理削除
    const { data: expiredReports, error: reportsSelectError } = await supabase
      .from('work_reports')
      .select('id, work_type, deleted_at')
      .not('deleted_at', 'is', null)
      .lt('deleted_at', cutoffDate)
    
    if (reportsSelectError) {
      console.error('期限切れ実績記録取得エラー:', reportsSelectError)
      throw reportsSelectError
    }
    
    let deletedReportsCount = 0
    if (expiredReports && expiredReports.length > 0) {
      const { error: deleteReportsError } = await supabase
        .from('work_reports')
        .delete()
        .in('id', expiredReports.map(r => r.id))
      
      if (deleteReportsError) {
        console.error('実績記録物理削除エラー:', deleteReportsError)
        throw deleteReportsError
      }
      
      deletedReportsCount = expiredReports.length
      console.log(`${deletedReportsCount}件の実績記録を自動削除しました`)
    }
    
    // 削除ログを記録（オプション）
    const logEntry = {
      cleanup_date: new Date().toISOString(),
      cutoff_date: cutoffDate,
      deleted_tasks_count: deletedTasksCount,
      deleted_reports_count: deletedReportsCount,
      status: 'success'
    }
    
    console.log('自動削除処理完了:', logEntry)
    
    return NextResponse.json({
      success: true,
      message: '6ヶ月期限切れデータの自動削除が完了しました',
      data: {
        deletedTasks: deletedTasksCount,
        deletedReports: deletedReportsCount,
        cutoffDate: cutoffDate,
        processedAt: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('自動削除処理エラー:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error', 
        message: '自動削除処理に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    )
  }
}

// 手動実行用POSTエンドポイント
export async function POST() {
  try {
    // 管理者認証チェック（実装時に追加）
    // const user = await getCurrentUser()
    // if (user.role !== 'admin') {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    // }
    
    // GETと同じ処理を実行
    return await GET()
    
  } catch (error) {
    console.error('手動削除処理エラー:', error)
    return NextResponse.json(
      { error: 'Manual cleanup failed' },
      { status: 500 }
    )
  }
}