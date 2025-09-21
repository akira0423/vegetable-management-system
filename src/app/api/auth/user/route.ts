import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Not authenticated'
      }, { status: 401 })
    }

    // company_idがnullの場合、プロファイルを確認・修正
    let finalCompanyId = user.company_id

    if (!finalCompanyId) {
      console.log('[Auth/User] Company ID is null, checking profile...')

      const serviceSupabase = await createServiceClient()

      // プロファイルを再取得
      const { data: profile } = await serviceSupabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (profile?.company_id) {
        finalCompanyId = profile.company_id
      } else {
        // プロファイルがない、または company_id がない場合は作成
        console.log('[Auth/User] Creating company for user:', user.email)

        const companyName = user.email?.split('@')[1]?.split('.')[0] || 'My Farm'
        const newCompanyId = crypto.randomUUID()

        // 会社作成
        await serviceSupabase
          .from('companies')
          .insert({
            id: newCompanyId,
            name: companyName,
            contact_email: user.email,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })

        // プロファイル更新または作成
        await serviceSupabase
          .from('users')
          .upsert({
            id: user.id,
            company_id: newCompanyId,
            email: user.email,
            full_name: user.full_name || user.email,
            is_active: true,
            updated_at: new Date().toISOString()
          })

        finalCompanyId = newCompanyId
      }
    }

    const response = {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        company_id: finalCompanyId,
        full_name: user.full_name,
        role: user.role
      }
    }
    
    
    return NextResponse.json(response)

  } catch (error) {
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}