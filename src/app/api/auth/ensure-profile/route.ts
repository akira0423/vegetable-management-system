import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    // リクエストボディを取得
    const body = await request.json()
    const { userId, email, metadata } = body

    if (!userId || !email) {
      return NextResponse.json({
        success: false,
        error: '必須パラメータが不足しています'
      }, { status: 400 })
    }

    console.log('[EnsureProfile] Processing user:', email)

    // Service roleクライアントを使用してプロファイル操作
    const serviceSupabase = await createServiceClient()

    // 既存のプロファイルをチェック
    const { data: existingProfile } = await serviceSupabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (existingProfile) {
      console.log('[EnsureProfile] Profile already exists:', email)
      return NextResponse.json({
        success: true,
        profile: existingProfile,
        created: false
      })
    }

    console.log('[EnsureProfile] Creating new profile for:', email)

    // プロファイルが存在しない場合は作成
    // 1. まず会社を作成（またはデフォルト会社を使用）
    const companyName = metadata?.company_name ||
                       email?.split('@')[1]?.split('.')[0] ||
                       'My Farm'

    const company_id = crypto.randomUUID()

    // 会社作成
    const { error: companyError } = await serviceSupabase
      .from('companies')
      .insert({
        id: company_id,
        name: companyName,
        contact_email: email,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

    if (companyError) {
      console.error('[EnsureProfile] Company creation error:', companyError)
      // 既存の会社がある場合は、デモ会社を使用
      const { data: demoCompany } = await serviceSupabase
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
    const { data: newProfile, error: profileError } = await serviceSupabase
      .from('users')
      .insert({
        id: userId,
        company_id: company_id,
        email: email,
        full_name: metadata?.full_name || email,
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