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
    
    
    const supabase = await createClient()

    // 1. まず既存のメンバーシップを確認
    const { data: existingMemberships, error: membershipError } = await supabase
      .from('company_memberships')
      .select('company_id, status')
      .eq('user_id', userId)
      .eq('status', 'active')

    if (!membershipError && existingMemberships && existingMemberships.length > 0) {
      
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
      
    } else {
      // 3. デフォルト企業を作成
      
      
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
        
        return {
          success: false,
          error: `Failed to create company: ${createCompanyError?.message}`
        }
      }

      targetCompanyId = newCompany.id
      
    }

    // 4. メンバーシップを作成
    
    
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
      
      return {
        success: false,
        error: `Failed to create membership: ${membershipCreateError?.message}`
      }
    }

    
    return {
      success: true,
      companyId: membership.company_id
    }

  } catch (error) {
    
    return {
      success: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}