/**
 * 企業ID解決ヘルパー
 * ユーザーの企業関連付けを確実に行う
 */

import { createClient } from '@/lib/supabase/server'

export interface CompanyResolutionResult {
  success: boolean
  companyId?: string
  error?: string
}

/**
 * ユーザーの企業IDを確実に取得・作成
 */
export async function resolveUserCompany(userId: string): Promise<CompanyResolutionResult> {
  try {
    console.log('🏢 企業ID解決開始 - ユーザー:', userId)
    
    const supabase = await createClient()

    // 1. まず既存のメンバーシップを確認
    const { data: existingMemberships, error: membershipError } = await supabase
      .from('company_memberships')
      .select('company_id, status')
      .eq('user_id', userId)
      .eq('status', 'active')

    if (!membershipError && existingMemberships && existingMemberships.length > 0) {
      console.log('✅ 既存アクティブメンバーシップを発見:', existingMemberships)
      return {
        success: true,
        companyId: existingMemberships[0].company_id
      }
    }

    // 2. 既存企業を検索（デフォルト企業）
    const { data: companies, error: companyError } = await supabase
      .from('companies')
      .select('id')
      .limit(1)

    let targetCompanyId: string

    if (!companyError && companies && companies.length > 0) {
      targetCompanyId = companies[0].id
      console.log('📊 既存企業を使用:', targetCompanyId)
    } else {
      // 3. デフォルト企業を作成
      console.log('🆕 デフォルト企業を作成中...')
      
      const { data: newCompany, error: createCompanyError } = await supabase
        .from('companies')
        .insert({
          name: '農業企業',
          description: '野菜栽培管理システム',
          created_by: userId,
          created_at: new Date().toISOString()
        })
        .select('id')
        .single()

      if (createCompanyError || !newCompany) {
        console.error('❌ 企業作成エラー:', createCompanyError)
        return {
          success: false,
          error: `Failed to create company: ${createCompanyError?.message}`
        }
      }

      targetCompanyId = newCompany.id
      console.log('✅ 新規企業作成完了:', targetCompanyId)
    }

    // 4. メンバーシップを作成
    console.log('👤 メンバーシップ作成中...')
    
    const { data: membership, error: membershipCreateError } = await supabase
      .from('company_memberships')
      .insert({
        user_id: userId,
        company_id: targetCompanyId,
        role: 'admin', // 初回ユーザーは管理者権限
        status: 'active',
        created_at: new Date().toISOString()
      })
      .select('company_id')
      .single()

    if (membershipCreateError || !membership) {
      console.error('❌ メンバーシップ作成エラー:', membershipCreateError)
      return {
        success: false,
        error: `Failed to create membership: ${membershipCreateError?.message}`
      }
    }

    console.log('✅ メンバーシップ作成完了:', membership.company_id)
    return {
      success: true,
      companyId: membership.company_id
    }

  } catch (error) {
    console.error('💥 企業ID解決で予期しないエラー:', error)
    return {
      success: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}