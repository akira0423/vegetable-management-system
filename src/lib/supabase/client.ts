import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database'

// グローバルクライアントインスタンス（ブラウザ側のシングルトン）
let supabaseClientInstance: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createBrowserClientSingleton() {
  // 既にインスタンスが存在する場合はそれを返す
  if (supabaseClientInstance) {
    return supabaseClientInstance
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // 環境変数の検証
  if (!supabaseUrl) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL is missing')
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
  }

  if (!supabaseAnonKey) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY is missing')
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable')
  }

  // 新しいクライアントインスタンスを作成
  supabaseClientInstance = createBrowserClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  )

  console.log('✅ ブラウザSupabaseクライアント作成（シングルトン）', {
    url: supabaseUrl.substring(0, 30) + '...',
    hasKey: !!supabaseAnonKey
  })
  
  return supabaseClientInstance
}

// 後方互換性のために古い関数名も残しておく
export function createClient() {
  return createBrowserClientSingleton()
}