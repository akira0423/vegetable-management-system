import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // URLクエリパラメータを取得
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')
    const vegetableId = searchParams.get('vegetable_id')
    const operationLogId = searchParams.get('operation_log_id')
    const tags = searchParams.get('tags')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 })
    }

    // ベースクエリ
    let query = supabase
      .from('photos')
      .select(`
        id,
        vegetable_id,
        operation_log_id,
        storage_path,
        original_filename,
        file_size,
        mime_type,
        taken_at,
        description,
        tags,
        is_primary,
        created_at,
        updated_at,
        created_by,
        vegetable:vegetables!inner(
          id,
          name,
          variety_name,
          plot_name,
          company_id
        ),
        operation_log:operation_logs(
          id,
          work_type,
          date,
          work_notes
        ),
        created_by_user:users!created_by(
          id,
          full_name
        )
      `)
      .eq('vegetables.company_id', companyId)
      .order('taken_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // フィルター条件を追加
    if (vegetableId) {
      query = query.eq('vegetable_id', vegetableId)
    }

    if (operationLogId) {
      query = query.eq('operation_log_id', operationLogId)
    }

    if (startDate && endDate) {
      query = query
        .gte('taken_at', startDate)
        .lte('taken_at', endDate)
    }

    if (tags) {
      // タグでのフィルタリング（PostgreSQLの配列検索）
      query = query.contains('tags', [tags])
    }

    const { data: photos, error } = await query

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch photos' }, { status: 500 })
    }

    // データの変換とStorageの公開URLを生成
    const formattedPhotos = await Promise.all(photos.map(async (photo) => {
      // Supabase Storageから公開URLを取得
      const { data: urlData } = supabase.storage
        .from('vegetable-photos')
        .getPublicUrl(photo.storage_path)

      return {
        id: photo.id,
        vegetable_id: photo.vegetable_id,
        operation_log_id: photo.operation_log_id,
        storage_path: photo.storage_path,
        original_filename: photo.original_filename,
        file_size: photo.file_size,
        mime_type: photo.mime_type,
        taken_at: photo.taken_at,
        description: photo.description,
        tags: photo.tags || [],
        is_primary: photo.is_primary,
        created_at: photo.created_at,
        updated_at: photo.updated_at,
        public_url: urlData.publicUrl,
        vegetable: {
          id: photo.vegetable.id,
          name: photo.vegetable.name,
          variety: photo.vegetable.variety_name,
          plot_name: photo.vegetable.plot_name
        },
        operation_log: photo.operation_log ? {
          id: photo.operation_log.id,
          work_type: photo.operation_log.work_type,
          work_date: photo.operation_log.date,
          work_notes: photo.operation_log.work_notes
        } : null,
        created_by: photo.created_by_user ? {
          id: photo.created_by_user.id,
          name: photo.created_by_user.full_name
        } : null
      }
    }))

    // 統計情報も取得
    const { count: totalPhotos } = await supabase
      .from('photos')
      .select(`
        id,
        vegetable:vegetables!inner(company_id)
      `, { count: 'exact', head: true })
      .eq('vegetables.company_id', companyId)

    return NextResponse.json({
      success: true,
      data: formattedPhotos,
      pagination: {
        total: totalPhotos || 0,
        offset,
        limit,
        hasMore: formattedPhotos.length === limit
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
      operation_log_id,
      storage_path,
      original_filename,
      file_size,
      mime_type,
      taken_at,
      description,
      tags = [],
      is_primary = false,
      created_by
    } = body

    // 必須フィールドのバリデーション
    if (!vegetable_id || !storage_path || !original_filename) {
      return NextResponse.json({ 
        error: 'Missing required fields: vegetable_id, storage_path, original_filename' 
      }, { status: 400 })
    }

    // ファイルサイズの制限チェック（50MB）
    if (file_size && file_size > 50 * 1024 * 1024) {
      return NextResponse.json({ 
        error: 'File size exceeds 50MB limit' 
      }, { status: 400 })
    }

    // 写真メタデータを保存
    const { data: photo, error } = await supabase
      .from('photos')
      .insert({
        vegetable_id,
        operation_log_id,
        storage_path,
        original_filename,
        file_size,
        mime_type,
        taken_at: taken_at || new Date().toISOString(),
        description,
        tags,
        is_primary,
        created_by
      })
      .select(`
        id,
        vegetable_id,
        operation_log_id,
        storage_path,
        original_filename,
        file_size,
        mime_type,
        taken_at,
        description,
        tags,
        is_primary,
        created_at,
        vegetable:vegetables(
          id,
          name,
          variety_name,
          plot_name
        )
      `)
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to save photo metadata' }, { status: 500 })
    }

    // 公開URLを生成
    const { data: urlData } = supabase.storage
      .from('vegetable-photos')
      .getPublicUrl(photo.storage_path)

    return NextResponse.json({
      success: true,
      data: {
        id: photo.id,
        vegetable_id: photo.vegetable_id,
        operation_log_id: photo.operation_log_id,
        storage_path: photo.storage_path,
        original_filename: photo.original_filename,
        file_size: photo.file_size,
        mime_type: photo.mime_type,
        taken_at: photo.taken_at,
        description: photo.description,
        tags: photo.tags,
        is_primary: photo.is_primary,
        created_at: photo.created_at,
        public_url: urlData.publicUrl,
        vegetable: {
          id: photo.vegetable.id,
          name: photo.vegetable.name,
          variety: photo.vegetable.variety_name,
          plot_name: photo.vegetable.plot_name
        }
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

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { id, description, tags, is_primary } = body

    if (!id) {
      return NextResponse.json({ error: 'Photo ID is required' }, { status: 400 })
    }

    // 写真メタデータを更新
    const updateData: any = { updated_at: new Date().toISOString() }
    if (description !== undefined) updateData.description = description
    if (tags !== undefined) updateData.tags = tags
    if (is_primary !== undefined) updateData.is_primary = is_primary

    const { data: photo, error } = await supabase
      .from('photos')
      .update(updateData)
      .eq('id', id)
      .select(`
        id,
        vegetable_id,
        original_filename,
        description,
        tags,
        is_primary,
        storage_path,
        updated_at
      `)
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to update photo' }, { status: 500 })
    }

    // 公開URLを生成
    const { data: urlData } = supabase.storage
      .from('vegetable-photos')
      .getPublicUrl(photo.storage_path)

    return NextResponse.json({
      success: true,
      data: {
        ...photo,
        public_url: urlData.publicUrl
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

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const photoId = searchParams.get('id')
    const photoIds = searchParams.get('ids')?.split(',').filter(Boolean)

    if (!photoId && !photoIds?.length) {
      return NextResponse.json({ 
        error: 'Photo ID or IDs are required' 
      }, { status: 400 })
    }

    const idsToDelete = photoId ? [photoId] : photoIds!

    // 削除対象の写真情報を取得（Storageファイルも削除するため）
    const { data: photos, error: fetchError } = await supabase
      .from('photos')
      .select('id, storage_path')
      .in('id', idsToDelete)

    if (fetchError) {
      console.error('Fetch error:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch photos for deletion' }, { status: 500 })
    }

    if (!photos || photos.length === 0) {
      return NextResponse.json({ error: 'No photos found' }, { status: 404 })
    }

    // Storageからファイルを削除
    const storagePaths = photos.map(photo => photo.storage_path)
    const { error: storageError } = await supabase.storage
      .from('vegetable-photos')
      .remove(storagePaths)

    if (storageError) {
      console.error('Storage deletion error:', storageError)
      // ストレージ削除エラーでも続行（データベースからは削除）
    }

    // データベースから写真メタデータを削除
    const { error: dbError } = await supabase
      .from('photos')
      .delete()
      .in('id', idsToDelete)

    if (dbError) {
      console.error('Database deletion error:', dbError)
      return NextResponse.json({ error: 'Failed to delete photos from database' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `${photos.length} photo(s) deleted successfully`,
      deleted_ids: idsToDelete
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}