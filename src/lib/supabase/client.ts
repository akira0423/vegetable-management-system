import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database'

// グローバルクライアントインスタンス（ブラウザ側のシングルトン）
let supabaseClientInstance: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createBrowserClientSingleton() {
  // 既にインスタンスが存在する場合はそれを返す
  if (supabaseClientInstance) {
    return supabaseClientInstance
  }

  // 新しいクライアントインスタンスを作成
  supabaseClientInstance = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  console.log('✅ ブラウザSupabaseクライアント作成（シングルトン）')
  return supabaseClientInstance
}

// 後方互換性のために古い関数名も残しておく
export function createClient() {
  return createBrowserClientSingleton()
}