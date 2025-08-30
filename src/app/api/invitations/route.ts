import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'

// 招待作成
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
    const {
      email,
      full_name,
      role = 'operator',
      invitation_message
    } = body

    // バリデーション
    if (!email) {
      return NextResponse.json({
        success: false,
        error: 'メールアドレスは必須です'
      }, { status: 400 })
    }

    const validRoles = ['admin', 'manager', 'operator']
    if (!validRoles.includes(role)) {
      return NextResponse.json({
        success: false,
        error: '無効な権限です'
      }, { status: 400 })
    }

    console.log('🔍 招待API - リクエスト:', { 
      email, 
      full_name, 
      role, 
      currentUser: currentUser.id,
      company_id: currentUser.company_id 
    })

    // 現在のユーザーのメンバーシップを確認
    const { data: membership, error: membershipError } = await supabase
      .from('company_memberships')
      .select('id, role, company_id')
      .eq('user_id', currentUser.id)
      .eq('company_id', currentUser.company_id)
      .eq('status', 'active')
      .single()

    if (membershipError || !membership) {
      // メンバーシップが存在しない場合、既存ユーザーから作成
      const { data: newMembership, error: createError } = await supabase
        .rpc('create_membership_for_existing_user', {
          p_company_id: currentUser.company_id,
          p_user_id: currentUser.id,
          p_email: currentUser.email,
          p_full_name: currentUser.full_name,
          p_role: 'admin'
        })

      if (createError) {
        console.error('メンバーシップ作成エラー:', createError)
        return NextResponse.json({
          success: false,
          error: 'メンバーシップの作成に失敗しました'
        }, { status: 500 })
      }

      // 作成されたメンバーシップ情報を再取得
      const { data: createdMembership } = await supabase
        .from('company_memberships')
        .select('id, role, company_id')
        .eq('id', newMembership)
        .single()

      if (!createdMembership) {
        return NextResponse.json({
          success: false,
          error: 'メンバーシップ情報の取得に失敗しました'
        }, { status: 500 })
      }

      membership.id = createdMembership.id
      membership.role = createdMembership.role
      membership.company_id = createdMembership.company_id
    }

    // 招待権限をチェック
    if (membership.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: '招待する権限がありません'
      }, { status: 403 })
    }

    // 既存の招待をチェック
    const { data: existingInvitation } = await supabase
      .from('user_invitations')
      .select('id, status')
      .eq('company_id', currentUser.company_id)
      .eq('email', email)
      .eq('status', 'pending')
      .maybeSingle()

    if (existingInvitation) {
      return NextResponse.json({
        success: false,
        error: 'このメールアドレスには既に招待が送信されています'
      }, { status: 400 })
    }

    // 既存メンバーをチェック
    const { data: existingMember } = await supabase
      .from('company_memberships')
      .select('id, status')
      .eq('company_id', currentUser.company_id)
      .eq('email', email)
      .maybeSingle()

    if (existingMember) {
      const statusText = existingMember.status === 'active' ? 'アクティブ' : '非アクティブ'
      return NextResponse.json({
        success: false,
        error: `このメールアドレスは既に${statusText}なメンバーです`
      }, { status: 400 })
    }

    // 招待を作成
    const { data: invitation, error: invitationError } = await supabase
      .from('user_invitations')
      .insert({
        company_id: currentUser.company_id,
        email,
        full_name,
        role,
        invited_by: membership.id,
        invitation_message,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7日後
      })
      .select(`
        id,
        email,
        full_name,
        role,
        invitation_token,
        expires_at,
        created_at
      `)
      .single()

    if (invitationError) {
      console.error('招待作成エラー:', invitationError)
      return NextResponse.json({
        success: false,
        error: '招待の作成に失敗しました'
      }, { status: 500 })
    }

    console.log('✅ 招待作成成功:', invitation.id)

    // TODO: ここで招待メールを送信
    // await sendInvitationEmail(invitation)

    return NextResponse.json({
      success: true,
      data: invitation,
      message: '招待を送信しました'
    })

  } catch (error) {
    console.error('招待API エラー:', error)
    return NextResponse.json({
      success: false,
      error: 'システムエラーが発生しました'
    }, { status: 500 })
  }
}

// 招待一覧取得
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
    const status = searchParams.get('status') || 'all'

    console.log('🔍 招待一覧API - リクエスト:', { 
      company_id: currentUser.company_id,
      status 
    })

    // 現在のユーザーが管理者かチェック
    const { data: membership } = await supabase
      .from('company_memberships')
      .select('role')
      .eq('user_id', currentUser.id)
      .eq('company_id', currentUser.company_id)
      .eq('status', 'active')
      .single()

    if (!membership || membership.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: '招待一覧を見る権限がありません'
      }, { status: 403 })
    }

    // 招待一覧を取得
    let query = supabase
      .from('user_invitations')
      .select(`
        id,
        email,
        full_name,
        role,
        status,
        invitation_token,
        expires_at,
        created_at,
        invited_by:company_memberships!user_invitations_invited_by_fkey(
          full_name,
          email
        )
      `)
      .eq('company_id', currentUser.company_id)
      .order('created_at', { ascending: false })

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    const { data: invitations, error } = await query

    if (error) {
      console.error('招待一覧取得エラー:', error)
      return NextResponse.json({
        success: false,
        error: '招待一覧の取得に失敗しました'
      }, { status: 500 })
    }

    // 期限切れ招待のステータスを自動更新
    const expiredInvitations = invitations?.filter(inv => 
      inv.status === 'pending' && new Date(inv.expires_at) < new Date()
    ) || []

    if (expiredInvitations.length > 0) {
      const expiredIds = expiredInvitations.map(inv => inv.id)
      await supabase
        .from('user_invitations')
        .update({ status: 'expired' })
        .in('id', expiredIds)

      // ステータスをローカルで更新
      invitations?.forEach(inv => {
        if (expiredIds.includes(inv.id)) {
          inv.status = 'expired'
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: invitations || []
    })

  } catch (error) {
    console.error('招待一覧API エラー:', error)
    return NextResponse.json({
      success: false,
      error: 'システムエラーが発生しました'
    }, { status: 500 })
  }
}

// 招待のキャンセル
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
    const invitationId = searchParams.get('id')

    if (!invitationId) {
      return NextResponse.json({
        success: false,
        error: '招待IDが必要です'
      }, { status: 400 })
    }

    console.log('🔍 招待キャンセルAPI - リクエスト:', { 
      invitationId,
      currentUser: currentUser.id 
    })

    // 現在のユーザーが管理者かチェック
    const { data: membership } = await supabase
      .from('company_memberships')
      .select('role')
      .eq('user_id', currentUser.id)
      .eq('company_id', currentUser.company_id)
      .eq('status', 'active')
      .single()

    if (!membership || membership.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: '招待をキャンセルする権限がありません'
      }, { status: 403 })
    }

    // 招待をキャンセル（削除ではなくステータス更新）
    const { data: cancelledInvitation, error } = await supabase
      .from('user_invitations')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', invitationId)
      .eq('company_id', currentUser.company_id)
      .eq('status', 'pending') // pending状態のもののみキャンセル可能
      .select('id, email')
      .single()

    if (error) {
      console.error('招待キャンセルエラー:', error)
      return NextResponse.json({
        success: false,
        error: '招待のキャンセルに失敗しました'
      }, { status: 500 })
    }

    if (!cancelledInvitation) {
      return NextResponse.json({
        success: false,
        error: '招待が見つからないか、既にキャンセル済みです'
      }, { status: 404 })
    }

    console.log('✅ 招待キャンセル成功:', cancelledInvitation.id)

    return NextResponse.json({
      success: true,
      data: cancelledInvitation,
      message: '招待をキャンセルしました'
    })

  } catch (error) {
    console.error('招待キャンセルAPI エラー:', error)
    return NextResponse.json({
      success: false,
      error: 'システムエラーが発生しました'
    }, { status: 500 })
  }
}