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

// テスト・開発用のservice role client（RLS制限をバイパス）
export async function createServiceClient() {
  // Verify environment variables are available
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase environment variables:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!serviceRoleKey
    })
    throw new Error('Missing Supabase configuration for service client')
  }

  console.log('Creating service client with service role key')
  
  const cookieStore = await cookies()

  const client = createServerClient<Database>(
    supabaseUrl,
    serviceRoleKey,  // service role keyを使用
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
            // Ignore cookie setting errors in server components
            console.warn('Cookie setting error in service client:', error)
          }
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )

  console.log('Service client created successfully')
  return client
}