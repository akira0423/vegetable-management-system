/**
 * ユーザー企業アクセス管理ヘルパー
 * 既存のusers.company_idアーキテクチャを活用
 */

import { createClient } from '@/lib/supabase/server'

export interface MembershipResult {
  success: boolean
  membership?: any
  error?: string
}

/**
 * ユーザーの企業アクセス権を確認
 * 既存のusers.company_idアーキテクチャを使用
 */
export async function ensureUserMembership(
  userId: string, 
  companyId: string
): Promise<MembershipResult> {
  try {
    console.log('🔍 企業アクセス権確認開始:', { userId, companyId })
    console.log('🌍 実行環境:', process.env.NODE_ENV)
    
    const supabase = await createClient()

    // ユーザーの企業関連付けを確認
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, company_id, is_active')
      .eq('id', userId)
      .single()

    console.log('📊 ユーザー情報:', { 
      user, 
      error: userError?.message,
      userError: userError,
      timestamp: new Date().toISOString()
    })

    if (userError || !user) {
      console.log('❌ ユーザー検索失敗:', { 
        userError: userError?.message,
        userId,
        timestamp: new Date().toISOString()
      })
      return {
        success: false,
        error: `User not found: ${userError?.message || 'No user data'}`
      }
    }

    // ユーザーがアクティブでない場合
    if (!user.is_active) {
      return {
        success: false,
        error: 'User account is inactive'
      }
    }

    // ユーザーが既に企業に関連付けられている場合
    if (user.company_id === companyId) {
      console.log('✅ ユーザーは既に企業に関連付けられています', {
        userCompanyId: user.company_id,
        requestedCompanyId: companyId,
        match: user.company_id === companyId
      })
      return {
        success: true,
        membership: {
          user_id: userId,
          company_id: companyId,
          role: 'member',
          status: 'active'
        }
      }
    }

    // ユーザーが企業に関連付けられていない場合、自動で関連付け
    if (!user.company_id) {
      console.log('🔄 ユーザーを企業に関連付け中...')
      
      const { error: updateError } = await supabase
        .from('users')
        .update({ company_id: companyId })
        .eq('id', userId)

      if (updateError) {
        console.error('❌ ユーザー企業関連付けエラー:', updateError)
        return {
          success: false,
          error: `Failed to associate user with company: ${updateError.message}`
        }
      }

      console.log('✅ ユーザー企業関連付け完了')
      return {
        success: true,
        membership: {
          user_id: userId,
          company_id: companyId,
          role: 'member',
          status: 'active'
        }
      }
    }

    // ユーザーが異なる企業に関連付けられている場合
    console.log('⚠️ ユーザーは異なる企業に関連付けられています:', {
      userCompanyId: user.company_id,
      requestedCompanyId: companyId,
      userId: userId
    })
    return {
      success: false,
      error: `User belongs to different company: ${user.company_id} (requested: ${companyId})`
    }

  } catch (error) {
    console.error('💥 企業アクセス権確認で予期しないエラー:', error)
    return {
      success: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * ユーザーが企業にアクセス権限を持っているかチェック（自動作成付き）
 */
export async function checkAndEnsureMembership(
  userId: string,
  companyId: string
): Promise<MembershipResult> {
  try {
    // まず通常のメンバーシップチェック
    const membershipResult = await ensureUserMembership(userId, companyId)
    
    if (membershipResult.success) {
      return membershipResult
    }

    // メンバーシップ作成に失敗した場合、企業が存在するかチェック
    const supabase = await createClient()
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      return {
        success: false,
        error: 'Company not found or access denied'
      }
    }

    // 企業は存在するが、メンバーシップ作成に失敗
    return {
      success: false,
      error: 'Failed to create membership for existing company'
    }

  } catch (error) {
    return {
      success: false,
      error: `Membership check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}