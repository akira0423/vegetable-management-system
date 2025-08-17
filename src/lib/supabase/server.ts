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

// Service role client（RLS制限をバイパス）
export async function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase environment variables:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!serviceRoleKey
    })
    throw new Error('Missing Supabase configuration for service client')
  }

  console.log('🔧 Creating service client with service role key')
  
  // Simple service role client without cookies
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

  console.log('✅ Service client created successfully')
  
  // サービスクライアントの接続テスト
  try {
    const { data, error } = await client.from('companies').select('id').limit(1)
    if (error) {
      console.error('❌ Service client connection test failed:', error)
    } else {
      console.log('✅ Service client connection test passed')
    }
  } catch (testError) {
    console.error('❌ Service client test error:', testError)
  }
  
  return client
}