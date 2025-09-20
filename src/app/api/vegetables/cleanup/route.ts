import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * 時限ソフトデリート戦略：6ヶ月経過したアーカイブデータの自動完全削除
 * 
 * 使用方法:
 * - cron job: POST /api/vegetables/cleanup (月次実行推奨)
 * - 手動実行: GET /api/vegetables/cleanup?preview=true (削除対象の確認)
 */

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const preview = searchParams.get('preview') === 'true'

    // 6ヶ月前の日付を計算
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    // 削除対象の野菜を取得
    const { data: targetVegetables, error } = await supabase
      .from('vegetables')
      .select(`
        id,
        name,
        variety_name,
        custom_fields,
        notes,
        updated_at
      `)
      .eq('custom_fields->>is_archived', 'true')
      .eq('custom_fields->>permanent_keep', 'false')
      .lt('custom_fields->>auto_delete_after', new Date().toISOString())

    if (error) {
      
      return NextResponse.json({ error: 'Failed to query vegetables' }, { status: 500 })
    }

    // 削除対象の詳細情報を整理
    const deletionCandidates = (targetVegetables || []).map(vegetable => ({
      id: vegetable.id,
      name: vegetable.name,
      variety_name: vegetable.variety_name,
      archived_at: vegetable.custom_fields?.archived_at,
      auto_delete_after: vegetable.custom_fields?.auto_delete_after,
      related_data: vegetable.custom_fields?.related_data_snapshot,
      days_since_archive: Math.floor(
        (new Date().getTime() - new Date(vegetable.custom_fields?.archived_at).getTime()) / 
        (1000 * 60 * 60 * 24)
      )
    }))

    if (preview) {
      // プレビューモード：削除対象の表示のみ
      return NextResponse.json({
        success: true,
        preview: true,
        deletion_candidates: deletionCandidates,
        total_count: deletionCandidates.length,
        message: `${deletionCandidates.length}件の野菜データが自動削除の対象です`
      })
    }

    return NextResponse.json({
      success: true,
      deletion_candidates: deletionCandidates,
      total_count: deletionCandidates.length,
      message: 'Use POST method to execute cleanup'
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
    const supabase = await createClient()
    
    

    // 削除対象の野菜を取得
    const { data: targetVegetables, error: queryError } = await supabase
      .from('vegetables')
      .select(`
        id,
        name,
        variety_name,
        custom_fields
      `)
      .eq('custom_fields->>is_archived', 'true')
      .eq('custom_fields->>permanent_keep', 'false')
      .lt('custom_fields->>auto_delete_after', new Date().toISOString())

    if (queryError) {
      
      return NextResponse.json({ error: 'Failed to query vegetables' }, { status: 500 })
    }

    if (!targetVegetables || targetVegetables.length === 0) {
      return NextResponse.json({
        success: true,
        deleted_count: 0,
        message: '削除対象のデータはありません'
      })
    }

    

    // 関連データも同時に削除
    const vegetableIds = targetVegetables.map(v => v.id)
    
    // タスクを削除
    const { error: taskDeleteError } = await supabase
      .from('gantt_tasks')
      .delete()
      .in('vegetable_id', vegetableIds)

    if (taskDeleteError) {
      
    }

    // 写真を削除
    const { error: photoDeleteError } = await supabase
      .from('photos')
      .delete()
      .in('vegetable_id', vegetableIds)

    if (photoDeleteError) {
      
    }

    // 作業ログを削除
    const { error: logDeleteError } = await supabase
      .from('operation_logs')
      .delete()
      .in('vegetable_id', vegetableIds)

    if (logDeleteError) {
      
    }

    // 野菜データを完全削除
    const { error: deleteError } = await supabase
      .from('vegetables')
      .delete()
      .in('id', vegetableIds)

    if (deleteError) {
      
      return NextResponse.json({ error: 'Failed to delete vegetables' }, { status: 500 })
    }

    const deletedVegetables = targetVegetables.map(v => ({
      id: v.id,
      name: v.name,
      variety_name: v.variety_name,
      archived_at: v.custom_fields?.archived_at,
      auto_delete_after: v.custom_fields?.auto_delete_after
    }))

    

    return NextResponse.json({
      success: true,
      deleted_count: targetVegetables.length,
      deleted_vegetables: deletedVegetables,
      message: `${targetVegetables.length}件のアーカイブされた野菜データとその関連データを完全削除しました`,
      execution_time: new Date().toISOString()
    })

  } catch (error) {
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}