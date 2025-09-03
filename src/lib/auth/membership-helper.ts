/**
 * ユーザーメンバーシップ管理ヘルパー
 * 認証されたユーザーの企業メンバーシップを自動管理
 */

import { createClient } from '@/lib/supabase/server'

export interface MembershipResult {
  success: boolean
  membership?: any
  error?: string
}

/**
 * ユーザーのメンバーシップを取得または作成
 */
export async function ensureUserMembership(
  userId: string, 
  companyId: string
): Promise<MembershipResult> {
  try {
    console.log('🔍 メンバーシップ確認開始:', { userId, companyId })
    
    const supabase = await createClient()

    // 既存のメンバーシップを確認
    const { data: existingMembership, error: membershipError } = await supabase
      .from('company_memberships')
      .select('id, role, status')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .single()

    console.log('📊 既存メンバーシップ検索結果:', { 
      data: existingMembership, 
      error: membershipError?.message 
    })

    // メンバーシップが存在し、アクティブな場合
    if (existingMembership && !membershipError) {
      console.log('✅ 既存メンバーシップを発見:', existingMembership)
      
      if (existingMembership.status === 'active') {
        return {
          success: true,
          membership: existingMembership
        }
      }
      
      console.log('🔄 非アクティブメンバーシップを有効化中...')
      
      // 非アクティブな場合はアクティブにする
      const { data: updatedMembership, error: updateError } = await supabase
        .from('company_memberships')
        .update({ status: 'active' })
        .eq('id', existingMembership.id)
        .select('id, role, status')
        .single()

      if (updateError) {
        console.error('❌ メンバーシップ有効化エラー:', updateError)
        return {
          success: false,
          error: `Failed to activate membership: ${updateError.message}`
        }
      }

      console.log('✅ メンバーシップ有効化完了:', updatedMembership)
      return {
        success: true,
        membership: updatedMembership
      }
    }

    console.log('🆕 新しいメンバーシップを作成中...')
    
    // メンバーシップが存在しない場合は作成
    const { data: newMembership, error: createError } = await supabase
      .from('company_memberships')
      .insert({
        user_id: userId,
        company_id: companyId,
        role: 'member', // デフォルトロール
        status: 'active',
        created_at: new Date().toISOString()
      })
      .select('id, role, status')
      .single()

    if (createError) {
      console.error('❌ メンバーシップ作成エラー:', createError)
      return {
        success: false,
        error: `Failed to create membership: ${createError.message}`
      }
    }

    console.log('✅ 新規メンバーシップ作成完了:', newMembership)
    return {
      success: true,
      membership: newMembership
    }

  } catch (error) {
    console.error('💥 メンバーシップ確認で予期しないエラー:', error)
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