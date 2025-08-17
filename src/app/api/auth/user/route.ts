import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 認証API - ユーザー取得開始')
    const user = await getCurrentUser()
    
    console.log('🔍 認証API - 取得されたユーザー:', { 
      id: user?.id, 
      email: user?.email, 
      company_id: user?.company_id,
      userExists: !!user 
    })
    
    if (!user) {
      console.log('❌ 認証API - ユーザーが見つかりません')
      return NextResponse.json({
        success: false,
        error: 'Not authenticated'
      }, { status: 401 })
    }

    const response = {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        company_id: user.company_id,
        full_name: user.full_name,
        role: user.role
      }
    }
    
    console.log('✅ 認証API - レスポンス:', response)
    return NextResponse.json(response)

  } catch (error) {
    console.error('Auth user API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}