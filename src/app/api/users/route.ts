import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // URLクエリパラメータを取得
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')
    const search = searchParams.get('search')
    const role = searchParams.get('role')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 })
    }

    // ベースクエリ
    let query = supabase
      .from('users')
      .select(`
        id,
        email,
        full_name,
        role,
        department,
        phone_number,
        is_active,
        last_login_at,
        created_at,
        updated_at,
        profile_image_url,
        user_stats:user_activity_stats!left(
          total_logins,
          reports_created,
          photos_uploaded,
          last_activity_at
        )
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // フィルター条件を追加
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,department.ilike.%${search}%`)
    }

    if (role && role !== 'all') {
      query = query.eq('role', role)
    }

    if (status && status !== 'all') {
      const isActive = status === 'active'
      query = query.eq('is_active', isActive)
    }

    const { data: users, error } = await query

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    // 統計情報も取得
    const { count: totalUsers } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)

    // 役割別統計
    const { data: roleStats } = await supabase
      .from('users')
      .select('role')
      .eq('company_id', companyId)

    const roleCounts = {
      admin: roleStats?.filter(u => u.role === 'admin').length || 0,
      manager: roleStats?.filter(u => u.role === 'manager').length || 0,
      operator: roleStats?.filter(u => u.role === 'operator').length || 0
    }

    // アクティブユーザー数
    const { count: activeUsers } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('is_active', true)

    return NextResponse.json({
      success: true,
      data: users?.map(user => ({
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        department: user.department,
        phone_number: user.phone_number,
        is_active: user.is_active,
        last_login_at: user.last_login_at,
        created_at: user.created_at,
        updated_at: user.updated_at,
        profile_image_url: user.profile_image_url,
        stats: user.user_stats?.[0] || {
          total_logins: 0,
          reports_created: 0,
          photos_uploaded: 0,
          last_activity_at: null
        }
      })) || [],
      pagination: {
        total: totalUsers || 0,
        offset,
        limit,
        hasMore: (users?.length || 0) === limit
      },
      summary: {
        total_users: totalUsers || 0,
        active_users: activeUsers || 0,
        role_distribution: roleCounts
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
      email,
      full_name,
      role,
      department,
      phone_number,
      is_active = true,
      company_id
    } = body

    // 必須フィールドのバリデーション
    if (!email || !full_name || !role || !company_id) {
      return NextResponse.json({ 
        error: 'Missing required fields: email, full_name, role, company_id' 
      }, { status: 400 })
    }

    // 役割のバリデーション
    const validRoles = ['admin', 'manager', 'operator']
    if (!validRoles.includes(role)) {
      return NextResponse.json({ 
        error: 'Invalid role. Must be one of: admin, manager, operator' 
      }, { status: 400 })
    }

    // メールアドレスの重複チェック
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (existingUser) {
      return NextResponse.json({ 
        error: 'Email address already exists' 
      }, { status: 400 })
    }

    // 新しいユーザーを作成
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        email,
        full_name,
        role,
        department,
        phone_number,
        is_active,
        company_id
      })
      .select(`
        id,
        email,
        full_name,
        role,
        department,
        phone_number,
        is_active,
        created_at,
        company_id
      `)
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
    }

    // ユーザー統計テーブルも初期化
    await supabase
      .from('user_activity_stats')
      .insert({
        user_id: user.id,
        total_logins: 0,
        reports_created: 0,
        photos_uploaded: 0
      })

    return NextResponse.json({
      success: true,
      data: user,
      message: 'User created successfully'
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
      full_name, 
      role, 
      department, 
      phone_number, 
      is_active,
      profile_image_url 
    } = body

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // 役割のバリデーション（指定された場合）
    if (role) {
      const validRoles = ['admin', 'manager', 'operator']
      if (!validRoles.includes(role)) {
        return NextResponse.json({ 
          error: 'Invalid role. Must be one of: admin, manager, operator' 
        }, { status: 400 })
      }
    }

    // 更新データの準備
    const updateData: any = { updated_at: new Date().toISOString() }
    if (full_name !== undefined) updateData.full_name = full_name
    if (role !== undefined) updateData.role = role
    if (department !== undefined) updateData.department = department
    if (phone_number !== undefined) updateData.phone_number = phone_number
    if (is_active !== undefined) updateData.is_active = is_active
    if (profile_image_url !== undefined) updateData.profile_image_url = profile_image_url

    const { data: user, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select(`
        id,
        email,
        full_name,
        role,
        department,
        phone_number,
        is_active,
        updated_at,
        profile_image_url
      `)
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: user,
      message: 'User updated successfully'
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
    const userId = searchParams.get('id')

    if (!userId) {
      return NextResponse.json({ 
        error: 'User ID is required' 
      }, { status: 400 })
    }

    // ユーザーが存在するかチェック
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('id', userId)
      .single()

    if (fetchError || !existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // 関連データも含めて削除（カスケード削除）
    // まず関連統計データを削除
    await supabase
      .from('user_activity_stats')
      .delete()
      .eq('user_id', userId)

    // ユーザーを削除
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId)

    if (deleteError) {
      console.error('Database deletion error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `User "${existingUser.full_name}" deleted successfully`,
      deleted_user: {
        id: existingUser.id,
        name: existingUser.full_name,
        email: existingUser.email
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