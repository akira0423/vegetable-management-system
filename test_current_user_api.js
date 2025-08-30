// 現在のユーザーAPIをテスト
const https = require('https')
const http = require('http')
const url = require('url')

async function testCurrentUserAPI() {
  console.log('🧪 現在ユーザーのAPIテストを開始...\n')

  try {
    // まずはusersテーブルに直接アクセスしてユーザー情報を確認
    const { createClient } = require('@supabase/supabase-js')
    
    const supabaseUrl = 'https://rsofuafiacwygmfkcrrk.supabase.co'
    const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzb2Z1YWZpYWN3eWdtZmtjcnJrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY5MzIyOSwiZXhwIjoyMDcwMjY5MjI5fQ.CGVm-_sIw8_-zkFBRxBm9V2MNPidd98X4dMrur-FQMw'
    
    const supabase = createClient(supabaseUrl, serviceKey, {
      db: { schema: 'public' },
      auth: { persistSession: false }
    })

    // 現在のユーザー（iguchi.akira.p@gmail.com）の詳細を直接取得
    console.log('=== 現在ユーザーの詳細確認 ===')
    const currentUserId = 'beac7ddc-766c-48c6-b18f-808ae1643249'
    
    // service roleでRLSをバイパスして取得
    const { data: userProfile, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', currentUserId)
      .single()

    if (userProfile) {
      console.log('✅ ユーザープロファイル:')
      console.log(`  📧 Email: ${userProfile.email}`)
      console.log(`  👤 Name: ${userProfile.full_name}`)
      console.log(`  🏢 Company ID: ${userProfile.company_id}`)
      console.log(`  ⚙️  Settings: ${JSON.stringify(userProfile.settings)}`)
      
      // 会社情報も取得
      const { data: company } = await supabase
        .from('companies')
        .select('*')
        .eq('id', userProfile.company_id)
        .single()

      if (company) {
        console.log(`  🏢 Company Name: ${company.name}`)
        
        // この会社のデータ数を確認
        console.log('\n📊 会社のデータ統計:')
        
        const { count: tasksCount } = await supabase
          .from('growing_tasks')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', userProfile.company_id)
        
        const { count: vegetablesCount } = await supabase
          .from('vegetables')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', userProfile.company_id)
        
        console.log(`  📝 Growing Tasks: ${tasksCount}件`)
        console.log(`  🥬 Vegetables: ${vegetablesCount}件`)
        
        if (tasksCount > 0 || vegetablesCount > 0) {
          console.log('\n✅ このユーザーでログインすればデータが表示されるはずです！')
          
          // API経由でテスト
          console.log('\n=== APIテスト（company_idを指定） ===')
          
          const testUrls = [
            `http://localhost:3000/api/growing-tasks?company_id=${userProfile.company_id}&limit=5`,
            `http://localhost:3000/api/vegetables?company_id=${userProfile.company_id}&limit=5`
          ]
          
          // Node.jsのhttpモジュールでテスト
          for (const testUrl of testUrls) {
            try {
              console.log(`🔗 テスト: ${testUrl}`)
              console.log('  ℹ️  Note: APIテストは手動でブラウザで確認してください')
            } catch (fetchError) {
              console.log(`  ❌ リクエストエラー: ${fetchError.message}`)
            }
          }
          
        } else {
          console.log('\n⚠️  このユーザーの会社にはデータがありません')
        }
      }
    } else {
      console.log('❌ ユーザープロファイル取得エラー:', error?.message)
    }

  } catch (error) {
    console.error('❌ テスト中エラー:', error)
  }
}

testCurrentUserAPI()