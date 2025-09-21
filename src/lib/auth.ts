import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AuthUser, AuthUserWithMembership } from '@/types'

// 開発環境用の認証チェック
function getDevUser(): AuthUser | null {
  if (typeof window === 'undefined') return null

  const devUser = localStorage.getItem('dev_user')
  if (!devUser || devUser === '') return null

  try {
    return JSON.parse(devUser) as AuthUser
  } catch {
    localStorage.removeItem('dev_user')
    return null
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  // 開発環境では、まず Supabase 認証をチェックして、失敗したら開発用認証を使用
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // Get user profile from database
    const { data: profile, error } = await supabase
      .from('users')
      .select('company_id, full_name, settings')
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
      
      if (devUserCookie?.value && devUserCookie.value !== '') {
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

// メンバーシップ情報を含むユーザー取得（新機能）
export async function getCurrentUserWithMembership(): Promise<AuthUserWithMembership | null> {
  const user = await getCurrentUser()
  
  if (!user) {
    return null
  }
  
  const supabase = await createClient()
  
  // メンバーシップ情報を取得
  const { data: membership, error } = await supabase
    .from('company_memberships')
    .select(`
      id,
      role,
      status,
      phone,
      department,
      position,
      created_at,
      companies(
        name,
        company_code,
        plan_type,
        max_users
      ),
      stats:member_activity_stats(
        total_logins,
        last_login_at,
        reports_created,
        photos_uploaded,
        vegetables_managed,
        last_activity_at
      )
    `)
    .eq('user_id', user.id)
    .eq('company_id', user.company_id)
    .eq('status', 'active')
    .maybeSingle()
  
  if (error && error.code !== 'PGRST116') {
    
  }
  
  const userWithMembership: AuthUserWithMembership = {
    ...user,
    membership: membership ? {
      id: membership.id,
      role: membership.role,
      status: membership.status,
      phone: membership.phone,
      department: membership.department,
      position: membership.position,
      joined_at: membership.created_at,
      company: membership.companies,
      stats: membership.stats?.[0]
    } : undefined
  }
  
  return userWithMembership
}

// メンバーシップベースの権限チェック（新機能）
export async function requireMembershipRole(allowedRoles: ("admin" | "manager" | "operator")[]): Promise<AuthUserWithMembership> {
  const user = await getCurrentUserWithMembership()
  
  if (!user) {
    redirect('/login')
  }
  
  // メンバーシップが存在しない場合は、既存システムの権限を使用
  if (!user.membership) {
    // 既存ユーザーの場合は通す（後方互換性）
    return user
  }
  
  if (!allowedRoles.includes(user.membership.role)) {
    redirect('/dashboard') // 権限不足時はダッシュボードにリダイレクト
  }
  
  return user
}

// 既存ユーザーをメンバーシップシステムに移行する関数
export async function migrateToMembership(userId: string, companyId: string, email: string, fullName?: string): Promise<string | null> {
  const supabase = await createClient()
  
  try {
    const { data: membershipId, error } = await supabase
      .rpc('create_membership_for_existing_user', {
        p_company_id: companyId,
        p_user_id: userId,
        p_email: email,
        p_full_name: fullName,
        p_role: 'admin' // 既存ユーザーは管理者として移行
      })
    
    if (error) {
      
      return null
    }
    
    return membershipId
  } catch (error) {
    
    return null
  }
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