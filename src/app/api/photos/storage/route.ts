import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const formData = await request.formData()
    
    
    
    // 現在のユーザーを取得（認証確認）
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    

    // フォームデータから必要な情報を取得
    const file = formData.get('file') as File
    const vegetableId = formData.get('vegetable_id') as string
    const operationLogId = formData.get('operation_log_id') as string
    const description = formData.get('description') as string
    const tags = formData.get('tags') as string
    const companyId = formData.get('company_id') as string

    if (!file || !vegetableId || !companyId) {
      
      return NextResponse.json({ 
        error: 'Missing required fields: file, vegetable_id, company_id' 
      }, { status: 400 })
    }

    

    // ファイルサイズの制限チェック（50MB）
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ 
        error: 'File size exceeds 50MB limit' 
      }, { status: 400 })
    }

    // ファイル形式の確認
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed' 
      }, { status: 400 })
    }

    // ファイル名を生成（重複を避けるためタイムスタンプを追加）
    const timestamp = Date.now()
    const fileExtension = file.name.split('.').pop()
    const fileName = `${companyId}/${vegetableId}/${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`

    

    // ファイルをSupabase Storageにアップロード
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('vegetable-photos')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      
      return NextResponse.json({ 
        error: `Failed to upload file: ${uploadError.message}` 
      }, { status: 500 })
    }

    

    // 写真メタデータをデータベースに保存
    const photoData = {
      vegetable_id: vegetableId,
      operation_log_id: operationLogId || null,
      storage_path: uploadData.path,
      original_filename: file.name,
      file_size: file.size,
      mime_type: file.type,
      taken_at: new Date().toISOString(),
      description: description || null,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      is_primary: false,
      created_by: user.id
    }

    

    const { data: photo, error: dbError } = await supabase
      .from('photos')
      .insert(photoData)
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

    if (dbError) {
      
      
      // データベースエラーの場合、アップロード済みファイルを削除
      await supabase.storage
        .from('vegetable-photos')
        .remove([uploadData.path])
        
      return NextResponse.json({ 
        error: `Failed to save photo metadata: ${dbError.message}` 
      }, { status: 500 })
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
        vegetable: photo.vegetable ? {
          id: photo.vegetable.id,
          name: photo.vegetable.name,
          variety: photo.vegetable.variety_name,
          plot_name: photo.vegetable.plot_name
        } : null
      },
      message: 'Photo uploaded successfully'
    })

  } catch (error) {
    
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')
    
    
    
    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 })
    }

    

    // Supabase Storageの使用量統計を取得
    // 注意: Storageの直接統計取得はできないため、データベースから算出
    const { data: storageStats, error } = await supabase
      .from('photos')
      .select(`
        file_size,
        mime_type,
        created_at,
        vegetable:vegetables!inner(company_id)
      `)
      .eq('vegetables.company_id', companyId)

    if (error) {
      
      return NextResponse.json({ error: 'Failed to fetch storage statistics' }, { status: 500 })
    }

    // 統計データを計算
    const totalFiles = storageStats?.length || 0
    const totalSize = storageStats?.reduce((sum, photo) => sum + (photo.file_size || 0), 0) || 0
    const totalSizeMB = Math.round(totalSize / (1024 * 1024) * 100) / 100

    // ファイル形式別統計
    const fileTypes = storageStats?.reduce((acc, photo) => {
      const type = photo.mime_type || 'unknown'
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    // 月別統計
    const monthlyStats = storageStats?.reduce((acc, photo) => {
      const month = photo.created_at?.substring(0, 7) || 'unknown' // YYYY-MM
      acc[month] = (acc[month] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    

    return NextResponse.json({
      success: true,
      data: {
        storage_usage: {
          total_files: totalFiles,
          total_size_bytes: totalSize,
          total_size_mb: totalSizeMB,
          file_types: fileTypes,
          monthly_uploads: monthlyStats
        },
        limits: {
          max_file_size_mb: 50,
          allowed_types: ['image/jpeg', 'image/png', 'image/webp'],
          storage_quota_mb: 1000 // 1GB制限（仮定）
        }
      }
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
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const storagePath = searchParams.get('storage_path')
    const companyId = searchParams.get('company_id')
    
    
    
    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!storagePath || !companyId) {
      return NextResponse.json({ 
        error: 'Storage path and company ID are required' 
      }, { status: 400 })
    }

    

    // まずデータベースから写真情報を取得（権限確認のため）
    const { data: photo, error: fetchError } = await supabase
      .from('photos')
      .select(`
        id,
        storage_path,
        vegetable:vegetables!inner(company_id)
      `)
      .eq('storage_path', storagePath)
      .eq('vegetables.company_id', companyId)
      .single()

    if (fetchError || !photo) {
      return NextResponse.json({ error: 'Photo not found or access denied' }, { status: 404 })
    }

    // Storageからファイルを削除
    const { error: storageError } = await supabase.storage
      .from('vegetable-photos')
      .remove([storagePath])

    if (storageError) {
      
      // ストレージ削除エラーでも続行（データベースからは削除）
    }

    // データベースから写真メタデータを削除
    const { error: dbError } = await supabase
      .from('photos')
      .delete()
      .eq('id', photo.id)

    if (dbError) {
      
      return NextResponse.json({ error: 'Failed to delete photo metadata' }, { status: 500 })
    }

    

    return NextResponse.json({
      success: true,
      message: 'Photo deleted successfully',
      deleted_photo: {
        id: photo.id,
        storage_path: photo.storage_path
      }
    })

  } catch (error) {
    
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}