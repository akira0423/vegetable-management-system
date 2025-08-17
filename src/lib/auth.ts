import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AuthUser } from '@/types'

// 開発環境用の認証チェック
function getDevUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  
  const devUser = localStorage.getItem('dev_user')
  if (!devUser) return null
  
  try {
    return JSON.parse(devUser) as AuthUser
  } catch {
    return null
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  // 開発環境では、まず Supabase 認証をチェックして、失敗したら開発用認証を使用
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user) {
    // Get user profile from database
    const { data: profile } = await supabase
      .from('users')
      .select('company_id, full_name')
      .eq('id', user.id)
      .single()

    if (profile) {
      return {
        id: user.id,
        email: user.email!,
        company_id: profile.company_id,
        role: 'user', // 1企業1アカウントモデルでは全員user
        full_name: profile.full_name,
      }
    }
  }

  // Supabase 認証が失敗した場合、開発環境では開発用認証をチェック
  if (process.env.NODE_ENV === 'development') {
    // サーバーサイドでは cookies から dev_user を取得
    if (typeof window === 'undefined') {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      const devUserCookie = cookieStore.get('dev_user')
      
      if (devUserCookie?.value) {
        try {
          return JSON.parse(devUserCookie.value) as AuthUser
        } catch {
          return null
        }
      }
    } else {
      // クライアントサイドでは localStorage から取得
      const devUser = getDevUser()
      if (devUser) {
        return devUser
      }
    }
  }

  return null
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/login')
  }
  
  return user
}

export async function requireRole(allowedRoles: AuthUser['role'][]): Promise<AuthUser> {
  const user = await requireAuth()
  
  if (!allowedRoles.includes(user.role)) {
    redirect('/dashboard') // Redirect to dashboard if insufficient permissions
  }
  
  return user
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  
  // 開発環境ではクッキーもクリア
  if (process.env.NODE_ENV === 'development') {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('dev_user')
      document.cookie = 'dev_user=; path=/; max-age=0'
    }
  }
  
  redirect('/login')
}