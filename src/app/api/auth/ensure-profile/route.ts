import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServiceClient()

    // 現在のユーザーを取得
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({
        success: false,
        error: '認証されていません'
      }, { status: 401 })
    }

    // 既存のプロファイルをチェック
    const { data: existingProfile } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single()

    if (existingProfile) {
      console.log('[EnsureProfile] Profile already exists:', authUser.email)
      return NextResponse.json({
        success: true,
        profile: existingProfile,
        created: false
      })
    }

    console.log('[EnsureProfile] Creating new profile for:', authUser.email)

    // プロファイルが存在しない場合は作成
    // 1. まず会社を作成（またはデフォルト会社を使用）
    const companyName = authUser.user_metadata?.company_name ||
                       authUser.email?.split('@')[1]?.split('.')[0] ||
                       'My Farm'

    const company_id = crypto.randomUUID()

    // 会社作成
    const { error: companyError } = await supabase
      .from('companies')
      .insert({
        id: company_id,
        name: companyName,
        contact_email: authUser.email!,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

    if (companyError) {
      console.error('[EnsureProfile] Company creation error:', companyError)
      // 既存の会社がある場合は、デモ会社を使用
      const { data: demoCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .single()

      if (demoCompany) {
        console.log('[EnsureProfile] Using existing company:', demoCompany.id)
      }
    }

    // 2. ユーザープロファイル作成
    const { data: newProfile, error: profileError } = await supabase
      .from('users')
      .insert({
        id: authUser.id,
        company_id: company_id,
        email: authUser.email!,
        full_name: authUser.user_metadata?.full_name || authUser.email!,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (profileError) {
      console.error('[EnsureProfile] Profile creation error:', profileError)
      return NextResponse.json({
        success: false,
        error: 'プロファイル作成に失敗しました',
        details: profileError.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      profile: newProfile,
      created: true,
      message: 'プロファイルを作成しました'
    })

  } catch (error) {
    console.error('[EnsureProfile] Unexpected error:', error)
    return NextResponse.json({
      success: false,
      error: 'システムエラーが発生しました'
    }, { status: 500 })
  }
}