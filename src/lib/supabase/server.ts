import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/types/database'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch (error) {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

// ⚠️ Service role client - 本番環境では管理機能のみに制限してください
// 通常のユーザー操作では createClient() を使用してください
export async function createServiceClient() {
  // 本番環境では Service Role の使用を制限
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Service role client is restricted in production environment. Use authenticated client instead.')
  }
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase configuration for service client')
  }
  
  // Simple service role client without cookies (開発環境のみ)
  const { createClient } = await import('@supabase/supabase-js')
  
  const client = createClient<Database>(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
  
  return client
}

// 本番環境で安全に使用できる認証済みクライアント
export async function createAuthenticatedClient() {
  return await createClient()
}

// エイリアス関数 - 本番環境では認証済みクライアントを使用
export const createServerSupabaseClient = process.env.NODE_ENV === 'production' 
  ? createAuthenticatedClient
  : createServiceClient