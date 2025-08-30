// 直接Users APIをテスト
const http = require('http')

async function testUsersAPIDirect() {
  console.log('🧪 Users API 直接テストを開始...\n')

  try {
    const companyId = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
    const url = `http://localhost:3000/api/users?company_id=${companyId}`
    
    console.log(`📞 APIテスト: ${url}`)
    
    // Supabaseを使って直接ユーザー管理ページからのリクエストをシミュレート
    const { createClient } = require('@supabase/supabase-js')
    
    const supabaseUrl = 'https://rsofuafiacwygmfkcrrk.supabase.co'
    const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzb2Z1YWZpYWN3eWdtZmtjcnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2OTMyMjksImV4cCI6MjA3MDI2OTIyOX0.ROB-FGrEjrQEtcw0glHLqOFJZeHnrGJqNyhKR-OHMFc'
    
    const supabase = createClient(supabaseUrl, anonKey)
    
    // ユーザー認証確認 (APIと同じロジック)
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) {
      console.log('❌ 認証エラー:', error.message)
      console.log('🔍 デバッグ: ログイン状態を確認してください')
    } else if (!user) {
      console.log('❌ ユーザーが認証されていません')
      console.log('🔍 デバッグ: ログインが必要です')
    } else {
      console.log('✅ ユーザー認証成功:', user.email)
      console.log('📋 ユーザーID:', user.id)
    }

    // 直接usersテーブルからデータ取得
    console.log('\n=== 直接データベースアクセス ===')
    const { data: users, error: dbError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        full_name,
        is_active,
        last_login_at,
        created_at,
        updated_at,
        settings
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (dbError) {
      console.log('❌ データベースエラー:', dbError.message)
    } else {
      console.log(`✅ データベース取得成功: ${users.length}件`)
      users.forEach(u => {
        console.log(`  - ${u.full_name || u.email} (role: ${u.settings?.role || 'N/A'})`)
      })
    }

    console.log('\n✅ テスト完了')
    console.log('💡 ブラウザでhttp://localhost:3000/dashboard/usersにアクセスしてAPIログを確認してください')

  } catch (error) {
    console.error('❌ テスト中エラー:', error.message)
  }
}

testUsersAPIDirect()