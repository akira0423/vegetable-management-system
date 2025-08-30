import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const serviceSupabase = await createServiceClient()
    
    console.log('🔍 Users API - 開始')
    
    // 現在のユーザーを取得（認証確認）
    const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !currentUser) {
      console.log('❌ Users API - 認証エラー:', authError?.message)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    console.log('✅ Users API - 認証成功:', currentUser.email)

    // URLクエリパラメータを取得
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')
    const search = searchParams.get('search')
    const role = searchParams.get('role')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!companyId) {
      console.log('❌ Users API - Company ID が必要です')
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 })
    }
    
    console.log('📋 Users API - Company ID:', companyId)

    // 現在のユーザーの情報を取得（Service clientを使用してRLSをバイパス）
    const { data: currentUserData, error: userError } = await serviceSupabase
      .from('users')
      .select('settings, company_id')
      .eq('id', currentUser.id)
      .single()
      
    console.log('📋 Users API - ユーザーデータ取得:', userError ? `エラー: ${userError.message}` : '成功')

    // ユーザーがusersテーブルに存在しない場合のみ作成
    if (userError && userError.code === 'PGRST116') {
      // ユーザーが存在しない場合は作成
      const { data: newUser, error: insertError } = await serviceSupabase
        .from('users')
        .insert({
          id: currentUser.id,
          company_id: companyId,
          email: currentUser.email || '',
          full_name: currentUser.user_metadata?.full_name || currentUser.email || '',
          is_active: true,
          settings: { role: 'operator' } // デフォルトロール
        })
        .select('settings, company_id')
        .single()

      if (insertError) {
        console.error('User creation error:', insertError)
        return NextResponse.json({ error: `Failed to create user profile: ${insertError.message}` }, { status: 500 })
      }
      
      console.log('New user created:', newUser)
    } else if (userError) {
      // その他のデータベースエラー
      console.error('Database error when fetching user:', userError)
      return NextResponse.json({ error: `Database error: ${userError.message}` }, { status: 500 })
    } else if (currentUserData) {
      // ユーザーが既に存在する場合
      console.log('Existing user found:', currentUserData)
      
      // 管理者権限チェック
      if (currentUserData.company_id !== companyId) {
        return NextResponse.json({ error: 'Access denied to this company' }, { status: 403 })
      }
    }

    // auth.usersとusersテーブルを結合してクエリ（Service clientを使用）
    let query = serviceSupabase
      .from('users')
      .select(`
        id,
        email,
        full_name,
        is_active,
        last_login_at,
        created_at,
        updated_at,
        settings
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // フィルター条件を追加
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    if (role && role !== 'all') {
      query = query.eq('settings->>role', role)
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

    // 統計情報も取得（Service clientを使用）
    const { count: totalUsers } = await serviceSupabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)

    // 役割別統計（settingsフィールドから取得）
    const { data: roleStats } = await serviceSupabase
      .from('users')
      .select('settings')
      .eq('company_id', companyId)

    const roleCounts = {
      admin: roleStats?.filter(u => u.settings?.role === 'admin').length || 0,
      manager: roleStats?.filter(u => u.settings?.role === 'manager').length || 0,
      operator: roleStats?.filter(u => u.settings?.role === 'operator').length || 0
    }

    // アクティブユーザー数
    const { count: activeUsers } = await serviceSupabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('is_active', true)
      
    console.log('📊 Users API - 統計情報:', { totalUsers, activeUsers, roleCounts })

    return NextResponse.json({
      success: true,
      data: users?.map(user => ({
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.settings?.role || 'operator',
        is_active: user.is_active,
        last_login_at: user.last_login_at,
        created_at: user.created_at,
        updated_at: user.updated_at,
        settings: user.settings
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
    const serviceSupabase = await createServiceClient()
    const body = await request.json()
    
    console.log('🔍 Users POST API - 開始')
    console.log('📋 リクエストボディ:', body)
    
    const {
      email,
      full_name,
      role,
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

    // メールアドレスの重複チェック（Service clientを使用）
    const { data: existingUser } = await serviceSupabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (existingUser) {
      console.log('❌ Users POST API - メール重複:', email)
      return NextResponse.json({ 
        error: 'Email address already exists' 
      }, { status: 400 })
    }

    // 新しいユーザーを作成（実在するカラムのみ使用）
    const { data: user, error } = await serviceSupabase
      .from('users')
      .insert({
        id: randomUUID(), // UUIDを手動生成
        company_id,
        email,
        full_name,
        is_active,
        settings: { role } // roleをsettingsに格納
      })
      .select(`
        id,
        email,
        full_name,
        is_active,
        settings,
        created_at,
        company_id
      `)
      .single()

    console.log('📋 Users POST API - 挿入結果:', error ? `エラー: ${error.message}` : '成功')

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: `Failed to create user: ${error.message}` }, { status: 500 })
    }

    console.log('✅ Users POST API - ユーザー作成成功:', user)

    // 招待メール送信 (Supabase Auth)
    try {
      const { error: inviteError } = await serviceSupabase.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: full_name,
          role: role,
          company_id: company_id
        }
      })
      
      if (inviteError) {
        console.log('⚠️ 招待メール送信エラー:', inviteError.message)
        // エラーでも作成は成功とする（手動でパスワード設定可能）
      } else {
        console.log('✅ 招待メール送信成功:', email)
      }
    } catch (inviteError) {
      console.log('⚠️ 招待メール送信エラー:', inviteError)
    }

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.settings?.role || 'operator',
        is_active: user.is_active,
        created_at: user.created_at,
        company_id: user.company_id
      },
      message: 'User created successfully. Invitation email sent if configured.'
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
    const serviceSupabase = await createServiceClient()
    const body = await request.json()
    
    const { 
      id, 
      full_name, 
      role, 
      is_active
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
    if (role !== undefined) {
      // roleはsettings内に格納
      updateData.settings = { role }
    }
    if (is_active !== undefined) updateData.is_active = is_active

    const { data: user, error } = await serviceSupabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select(`
        id,
        email,
        full_name,
        settings,
        is_active,
        updated_at
      `)
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        ...user,
        role: user.settings?.role || 'operator'
      },
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
    const serviceSupabase = await createServiceClient()
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('id')

    if (!userId) {
      return NextResponse.json({ 
        error: 'User ID is required' 
      }, { status: 400 })
    }

    // ユーザーが存在するかチェック
    const { data: existingUser, error: fetchError } = await serviceSupabase
      .from('users')
      .select('id, full_name, email')
      .eq('id', userId)
      .single()

    if (fetchError || !existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // 関連データも含めて削除（カスケード削除）
    // まず関連統計データを削除
    await serviceSupabase
      .from('user_activity_stats')
      .delete()
      .eq('user_id', userId)

    // ユーザーを削除
    const { error: deleteError } = await serviceSupabase
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