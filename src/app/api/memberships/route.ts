import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'

// メンバーシップ一覧取得
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({
        success: false,
        error: '認証が必要です'
      }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const includeStats = searchParams.get('include_stats') === 'true'

    

    // 現在のユーザーのメンバーシップを確認
    const { data: currentMembership, error: membershipError } = await supabase
      .from('company_memberships')
      .select('id, role')
      .eq('user_id', currentUser.id)
      .eq('company_id', currentUser.company_id)
      .eq('status', 'active')
      .maybeSingle()

    if (membershipError) {
      
    }

    // メンバーシップが存在しない場合、既存ユーザーから作成
    if (!currentMembership) {
      
      
      const { data: newMembershipId, error: createError } = await supabase
        .rpc('create_membership_for_existing_user', {
          p_company_id: currentUser.company_id,
          p_user_id: currentUser.id,
          p_email: currentUser.email,
          p_full_name: currentUser.full_name,
          p_role: 'admin'
        })

      if (createError) {
        
        return NextResponse.json({
          success: false,
          error: 'メンバーシップの作成に失敗しました'
        }, { status: 500 })
      }

      
    }

    // メンバーシップ一覧を取得
    let selectQuery = `
      id,
      user_id,
      email,
      full_name,
      role,
      status,
      phone,
      department,
      position,
      invited_at,
      accepted_at,
      created_at,
      updated_at
    `

    if (includeStats) {
      selectQuery += `,
        stats:member_activity_stats(
          total_logins,
          last_login_at,
          reports_created,
          photos_uploaded,
          vegetables_managed,
          first_activity_at,
          last_activity_at
        )
      `
    }

    const { data: memberships, error } = await supabase
      .from('company_memberships')
      .select(selectQuery)
      .eq('company_id', currentUser.company_id)
      .order('created_at', { ascending: false })

    if (error) {
      
      return NextResponse.json({
        success: false,
        error: 'メンバーシップ一覧の取得に失敗しました'
      }, { status: 500 })
    }

    // 統計情報の集計
    const summary = {
      total_members: memberships?.length || 0,
      active_members: memberships?.filter(m => m.status === 'active').length || 0,
      pending_members: memberships?.filter(m => m.status === 'pending').length || 0,
      role_distribution: {
        admin: memberships?.filter(m => m.role === 'admin' && m.status === 'active').length || 0,
        manager: memberships?.filter(m => m.role === 'manager' && m.status === 'active').length || 0,
        operator: memberships?.filter(m => m.role === 'operator' && m.status === 'active').length || 0
      }
    }

    

    return NextResponse.json({
      success: true,
      data: memberships || [],
      summary
    })

  } catch (error) {
    
    return NextResponse.json({
      success: false,
      error: 'システムエラーが発生しました'
    }, { status: 500 })
  }
}

// メンバーシップ更新
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({
        success: false,
        error: '認証が必要です'
      }, { status: 401 })
    }

    const body = await request.json()
    const {
      membership_id,
      role,
      status,
      full_name,
      phone,
      department,
      position
    } = body

    if (!membership_id) {
      return NextResponse.json({
        success: false,
        error: 'メンバーシップIDが必要です'
      }, { status: 400 })
    }

    

    // 現在のユーザーが管理者かチェック
    const { data: currentMembership } = await supabase
      .from('company_memberships')
      .select('role')
      .eq('user_id', currentUser.id)
      .eq('company_id', currentUser.company_id)
      .eq('status', 'active')
      .single()

    if (!currentMembership || currentMembership.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: 'メンバーを編集する権限がありません'
      }, { status: 403 })
    }

    // 更新するメンバーシップが同じ会社のものかチェック
    const { data: targetMembership } = await supabase
      .from('company_memberships')
      .select('id, user_id, email, role')
      .eq('id', membership_id)
      .eq('company_id', currentUser.company_id)
      .single()

    if (!targetMembership) {
      return NextResponse.json({
        success: false,
        error: 'メンバーが見つかりません'
      }, { status: 404 })
    }

    // 自分自身を非アクティブにすることを防ぐ
    if (targetMembership.user_id === currentUser.id && status === 'inactive') {
      return NextResponse.json({
        success: false,
        error: '自分自身を非アクティブにすることはできません'
      }, { status: 400 })
    }

    // 最後の管理者を非管理者にすることを防ぐ
    if (targetMembership.role === 'admin' && role && role !== 'admin') {
      const { count: adminCount } = await supabase
        .from('company_memberships')
        .select('id', { count: 'exact' })
        .eq('company_id', currentUser.company_id)
        .eq('role', 'admin')
        .eq('status', 'active')

      if ((adminCount || 0) <= 1) {
        return NextResponse.json({
          success: false,
          error: '最後の管理者の権限は変更できません'
        }, { status: 400 })
      }
    }

    // 更新データの準備
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (role !== undefined) updateData.role = role
    if (status !== undefined) updateData.status = status
    if (full_name !== undefined) updateData.full_name = full_name
    if (phone !== undefined) updateData.phone = phone
    if (department !== undefined) updateData.department = department
    if (position !== undefined) updateData.position = position

    // メンバーシップを更新
    const { data: updatedMembership, error } = await supabase
      .from('company_memberships')
      .update(updateData)
      .eq('id', membership_id)
      .select(`
        id,
        user_id,
        email,
        full_name,
        role,
        status,
        phone,
        department,
        position,
        updated_at
      `)
      .single()

    if (error) {
      
      return NextResponse.json({
        success: false,
        error: 'メンバー情報の更新に失敗しました'
      }, { status: 500 })
    }

    

    return NextResponse.json({
      success: true,
      data: updatedMembership,
      message: 'メンバー情報を更新しました'
    })

  } catch (error) {
    
    return NextResponse.json({
      success: false,
      error: 'システムエラーが発生しました'
    }, { status: 500 })
  }
}

// メンバーシップ削除
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({
        success: false,
        error: '認証が必要です'
      }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const membershipId = searchParams.get('id')

    if (!membershipId) {
      return NextResponse.json({
        success: false,
        error: 'メンバーシップIDが必要です'
      }, { status: 400 })
    }

    

    // 現在のユーザーが管理者かチェック
    const { data: currentMembership } = await supabase
      .from('company_memberships')
      .select('role')
      .eq('user_id', currentUser.id)
      .eq('company_id', currentUser.company_id)
      .eq('status', 'active')
      .single()

    if (!currentMembership || currentMembership.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: 'メンバーを削除する権限がありません'
      }, { status: 403 })
    }

    // 削除対象のメンバーシップをチェック
    const { data: targetMembership } = await supabase
      .from('company_memberships')
      .select('id, user_id, email, role, full_name')
      .eq('id', membershipId)
      .eq('company_id', currentUser.company_id)
      .single()

    if (!targetMembership) {
      return NextResponse.json({
        success: false,
        error: 'メンバーが見つかりません'
      }, { status: 404 })
    }

    // 自分自身を削除することを防ぐ
    if (targetMembership.user_id === currentUser.id) {
      return NextResponse.json({
        success: false,
        error: '自分自身を削除することはできません'
      }, { status: 400 })
    }

    // 最後の管理者を削除することを防ぐ
    if (targetMembership.role === 'admin') {
      const { count: adminCount } = await supabase
        .from('company_memberships')
        .select('id', { count: 'exact' })
        .eq('company_id', currentUser.company_id)
        .eq('role', 'admin')
        .eq('status', 'active')

      if ((adminCount || 0) <= 1) {
        return NextResponse.json({
          success: false,
          error: '最後の管理者は削除できません'
        }, { status: 400 })
      }
    }

    // メンバーシップを削除（関連データもカスケード削除される）
    const { error } = await supabase
      .from('company_memberships')
      .delete()
      .eq('id', membershipId)

    if (error) {
      
      return NextResponse.json({
        success: false,
        error: 'メンバーの削除に失敗しました'
      }, { status: 500 })
    }

    

    return NextResponse.json({
      success: true,
      message: `${targetMembership.full_name || targetMembership.email}を削除しました`,
      deleted_member: {
        id: targetMembership.id,
        email: targetMembership.email,
        full_name: targetMembership.full_name
      }
    })

  } catch (error) {
    
    return NextResponse.json({
      success: false,
      error: 'システムエラーが発生しました'
    }, { status: 500 })
  }
}

// 現在のユーザーのメンバーシップ情報取得
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({
        success: false,
        error: '認証が必要です'
      }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    if (action === 'get_current_membership') {
      

      // 現在のユーザーのメンバーシップを取得
      const { data: membership, error } = await supabase
        .from('company_memberships')
        .select(`
          id,
          user_id,
          email,
          full_name,
          role,
          status,
          phone,
          department,
          position,
          created_at,
          company_id,
          companies(
            name,
            company_code,
            plan_type,
            max_users
          ),
          stats:member_activity_stats(
            total_logins,
            last_login_at,
            reports_created,
            photos_uploaded,
            vegetables_managed,
            last_activity_at
          )
        `)
        .eq('user_id', currentUser.id)
        .eq('company_id', currentUser.company_id)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        
        return NextResponse.json({
          success: false,
          error: 'メンバーシップ情報の取得に失敗しました'
        }, { status: 500 })
      }

      if (!membership) {
        // メンバーシップが存在しない場合、作成
        const { data: newMembershipId, error: createError } = await supabase
          .rpc('create_membership_for_existing_user', {
            p_company_id: currentUser.company_id,
            p_user_id: currentUser.id,
            p_email: currentUser.email,
            p_full_name: currentUser.full_name,
            p_role: 'admin'
          })

        if (createError) {
          
          return NextResponse.json({
            success: false,
            error: 'メンバーシップの作成に失敗しました'
          }, { status: 500 })
        }

        // 作成されたメンバーシップを再取得
        const { data: newMembership, error: fetchError } = await supabase
          .from('company_memberships')
          .select(`
            id,
            user_id,
            email,
            full_name,
            role,
            status,
            phone,
            department,
            position,
            created_at,
            company_id,
            companies(
              name,
              company_code,
              plan_type,
              max_users
            ),
            stats:member_activity_stats(
              total_logins,
              last_login_at,
              reports_created,
              photos_uploaded,
              vegetables_managed,
              last_activity_at
            )
          `)
          .eq('id', newMembershipId)
          .single()

        if (fetchError) {
          
          return NextResponse.json({
            success: false,
            error: 'メンバーシップ情報の取得に失敗しました'
          }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          data: newMembership,
          message: 'メンバーシップを作成しました'
        })
      }

      return NextResponse.json({
        success: true,
        data: membership
      })
    }

    return NextResponse.json({
      success: false,
      error: '無効なアクションです'
    }, { status: 400 })

  } catch (error) {
    
    return NextResponse.json({
      success: false,
      error: 'システムエラーが発生しました'
    }, { status: 500 })
  }
}