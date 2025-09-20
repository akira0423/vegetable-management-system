import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    // Supabaseのセッションクッキーをチェック
    const cookieStore = cookies()
    const supabaseAuthToken = cookieStore.get('sb-access-token')
    const supabaseRefreshToken = cookieStore.get('sb-refresh-token')

    // ログイン済みの場合
    if (supabaseAuthToken || supabaseRefreshToken) {
      return NextResponse.json({
        success: false,
        message: 'ログイン済みユーザーはデモページにアクセスできません',
        redirect: '/dashboard/gantt'
      }, { status: 403 })
    }

    // 未ログインの場合はアクセス許可
    return NextResponse.json({
      success: true,
      message: 'デモページへのアクセスが許可されました'
    })
  } catch (error) {
    
    // エラーの場合もデモページへのアクセスを許可
    return NextResponse.json({
      success: true,
      message: 'デモページへのアクセスが許可されました'
    })
  }
}