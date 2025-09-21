/**
 * ユーザー企業アクセス管理ヘルパー
 * 既存のusers.company_idアーキテクチャを活用
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

export interface MembershipResult {
  success: boolean
  membership?: any
  error?: string
}

/**
 * Service Roleクライアントを作成（メンバーシップチェック用）
 */
function getServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
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

    // Service Roleクライアントを使用（ユーザー情報の確認のため）
    const supabase = getServiceClient()

    // ユーザーの企業関連付けを確認
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, company_id, is_active')
      .eq('id', userId)
      .single()



    if (userError || !user) {
      // ユーザーレコードが存在しない場合はエラー
      // （本来はauth.usersトリガーで自動作成されるはず）
      return {
        success: false,
        error: `User record not found in users table. Please contact administrator.`
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


      const { error: updateError } = await supabase
        .from('users')
        .update({ company_id: companyId })
        .eq('id', userId)

      if (updateError) {

        return {
          success: false,
          error: `Failed to associate user with company: ${updateError.message}`
        }
      }


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

    return {
      success: false,
      error: `User belongs to different company: ${user.company_id} (requested: ${companyId})`
    }

  } catch (error) {

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
    const supabase = getServiceClient()
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