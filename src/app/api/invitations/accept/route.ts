import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 招待情報取得（トークンベース）
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({
        success: false,
        error: '招待トークンが必要です'
      }, { status: 400 })
    }

    console.log('🔍 招待確認API - トークン:', token)

    // 招待情報を取得
    const { data: invitation, error } = await supabase
      .from('user_invitations')
      .select(`
        id,
        email,
        full_name,
        role,
        status,
        expires_at,
        created_at,
        invitation_message,
        companies(
          name,
          logo_url
        ),
        invited_by:company_memberships!user_invitations_invited_by_fkey(
          full_name,
          email
        )
      `)
      .eq('invitation_token', token)
      .single()

    if (error) {
      console.error('招待取得エラー:', error)
      return NextResponse.json({
        success: false,
        error: '招待が見つかりません'
      }, { status: 404 })
    }

    // 招待の有効性をチェック
    const now = new Date()
    const expiresAt = new Date(invitation.expires_at)
    
    if (invitation.status !== 'pending') {
      return NextResponse.json({
        success: false,
        error: '招待は既に処理されています',
        invitation: {
          ...invitation,
          is_valid: false,
          error_reason: 'already_processed'
        }
      }, { status: 400 })
    }

    if (expiresAt < now) {
      // 期限切れの場合、ステータスを更新
      await supabase
        .from('user_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id)

      return NextResponse.json({
        success: false,
        error: '招待の期限が切れています',
        invitation: {
          ...invitation,
          status: 'expired',
          is_valid: false,
          error_reason: 'expired'
        }
      }, { status: 400 })
    }

    console.log('✅ 有効な招待を確認:', invitation.id)

    return NextResponse.json({
      success: true,
      invitation: {
        ...invitation,
        is_valid: true
      }
    })

  } catch (error) {
    console.error('招待確認API エラー:', error)
    return NextResponse.json({
      success: false,
      error: 'システムエラーが発生しました'
    }, { status: 500 })
  }
}

// 招待受諾処理
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { token, user_id } = body

    if (!token || !user_id) {
      return NextResponse.json({
        success: false,
        error: 'トークンとユーザーIDが必要です'
      }, { status: 400 })
    }

    console.log('🔍 招待受諾API - リクエスト:', { token, user_id })

    // 招待受諾処理を実行
    const { data: result, error } = await supabase
      .rpc('accept_invitation', {
        p_invitation_token: token,
        p_user_id: user_id
      })

    if (error) {
      console.error('招待受諾エラー:', error)
      return NextResponse.json({
        success: false,
        error: '招待の受諾に失敗しました'
      }, { status: 500 })
    }

    // 結果を確認
    const acceptResult = result[0]
    if (!acceptResult.success) {
      return NextResponse.json({
        success: false,
        error: acceptResult.message
      }, { status: 400 })
    }

    console.log('✅ 招待受諾成功:', acceptResult.membership_id)

    // 新しいメンバーシップ情報を取得
    const { data: membership, error: membershipError } = await supabase
      .from('company_memberships')
      .select(`
        id,
        user_id,
        email,
        full_name,
        role,
        status,
        company_id,
        companies(
          name,
          logo_url
        )
      `)
      .eq('id', acceptResult.membership_id)
      .single()

    if (membershipError) {
      console.error('メンバーシップ取得エラー:', membershipError)
      // 受諾は成功したが、情報取得に失敗した場合
      return NextResponse.json({
        success: true,
        message: '招待を受諾しました',
        data: {
          membership_id: acceptResult.membership_id,
          company_id: acceptResult.company_id
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: '招待を受諾しました',
      data: membership
    })

  } catch (error) {
    console.error('招待受諾API エラー:', error)
    return NextResponse.json({
      success: false,
      error: 'システムエラーが発生しました'
    }, { status: 500 })
  }
}