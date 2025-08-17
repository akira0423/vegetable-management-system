import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServiceClient()
    const body = await request.json()
    
    const { user_id, email, full_name, company_name } = body

    if (!user_id || !email || !company_name) {
      return NextResponse.json({
        success: false,
        error: '必須パラメータが不足しています'
      }, { status: 400 })
    }

    console.log('🏢 サインアップ完了処理開始:', { user_id, email, company_name })

    // 1. 会社作成
    const company_id = crypto.randomUUID()
    const { error: companyError } = await supabase
      .from('companies')
      .insert({
        id: company_id,
        name: company_name,
        contact_email: email,
        is_active: true
      })

    if (companyError) {
      console.error('会社作成エラー:', companyError)
      return NextResponse.json({
        success: false,
        error: '会社情報の作成に失敗しました'
      }, { status: 500 })
    }

    // 2. アプリユーザー作成
    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: user_id,
        company_id: company_id,
        email: email,
        full_name: full_name || 'ユーザー',
        is_active: true
      })

    if (userError) {
      console.error('ユーザー作成エラー:', userError)
      return NextResponse.json({
        success: false,
        error: 'ユーザー情報の作成に失敗しました'
      }, { status: 500 })
    }

    console.log('✅ サインアップ完了:', { company_id, user_id })

    return NextResponse.json({
      success: true,
      message: 'アカウント作成が完了しました',
      data: {
        company_id,
        user_id,
        company_name
      }
    })

  } catch (error) {
    console.error('サインアップ完了APIエラー:', error)
    return NextResponse.json({
      success: false,
      error: 'システムエラーが発生しました'
    }, { status: 500 })
  }
}