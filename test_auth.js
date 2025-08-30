// 認証処理のテスト
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://rsofuafiacwygmfkcrrk.supabase.co'
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzb2Z1YWZpYWN3eWdtZmtjcnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2OTMyMjksImV4cCI6MjA3MDI2OTIyOX0.ROB-FGrEjrQEtcw0glHLqOFJZeHnrGJqNyhKR-OHMFc'

const supabase = createClient(supabaseUrl, anonKey)

async function testAuth() {
  console.log('🔐 認証処理テストを開始...\n')

  try {
    // 実際にログインしているユーザーをシミュレート
    const testUserId = 'beac7ddc-766c-48c6-b18f-808ae1643249' // iguchi.akira.p@gmail.com

    // そのユーザーでログインしたとして、プロファイル取得をシミュレート
    const { data: profile, error } = await supabase
      .from('users')
      .select('company_id, full_name, settings')
      .eq('id', testUserId)
      .single()

    if (profile) {
      console.log('✅ 既存プロファイル発見:')
      console.log(`  📧 ユーザー: ${profile.full_name}`)
      console.log(`  🏢 会社ID: ${profile.company_id}`)
      
      // 会社名を取得
      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', profile.company_id)
        .single()
      
      console.log(`  🏢 会社名: ${company?.name}`)
      
      // この会社のデータを確認
      console.log('\n📊 この会社のデータ数:')
      
      const { count: tasksCount } = await supabase
        .from('growing_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)
      
      const { count: vegetablesCount } = await supabase
        .from('vegetables')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)
      
      console.log(`  📝 タスク数: ${tasksCount}`)
      console.log(`  🥬 野菜数: ${vegetablesCount}`)
      
      if (tasksCount > 0 || vegetablesCount > 0) {
        console.log('\n✅ このユーザーでログインすればデータが表示されるはずです！')
      } else {
        console.log('\n⚠️  このユーザーの会社にはデータがありません。')
      }
      
    } else {
      console.log('❌ プロファイルが見つかりません:', error?.message)
    }

  } catch (error) {
    console.error('❌ テスト中エラー:', error)
  }
}

testAuth()