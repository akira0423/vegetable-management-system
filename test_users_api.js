// ユーザーAPIのテスト
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://rsofuafiacwygmfkcrrk.supabase.co'
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzb2Z1YWZpYWN3eWdtZmtjcnJrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY5MzIyOSwiZXhwIjoyMDcwMjY5MjI5fQ.CGVm-_sIw8_-zkFBRxBm9V2MNPidd98X4dMrur-FQMw'

const supabase = createClient(supabaseUrl, serviceKey)

async function testUsersAPI() {
  console.log('🧪 Users APIテストを開始...\n')

  try {
    const companyId = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
    
    console.log('=== 1. usersテーブル直接確認 ===')
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .eq('company_id', companyId)

    if (usersError) {
      console.log('❌ usersテーブルエラー:', usersError.message)
    } else {
      console.log(`✅ usersテーブル: ${users.length}件`)
      users.forEach(u => {
        console.log(`  - ${u.full_name || 'N/A'} (${u.email}): settings=${JSON.stringify(u.settings)}`)
      })
    }

    console.log('\n=== 2. users APIエンドポイント実行シミュレーション ===')
    
    // 現在のユーザーIDを使用
    const currentUserId = 'beac7ddc-766c-48c6-b18f-808ae1643249'
    
    console.log(`現在のユーザーID: ${currentUserId}`)
    
    // 現在のユーザーの情報を取得
    const { data: currentUserData, error: userError } = await supabase
      .from('users')
      .select('settings, company_id')
      .eq('id', currentUserId)
      .single()

    if (userError) {
      console.log(`❌ 現在のユーザー取得エラー: ${userError.message}`)
      console.log(`エラー詳細: ${JSON.stringify(userError)}`)
      
      if (userError.code === 'PGRST116') {
        console.log('🔍 ユーザーが存在しない - 作成を試行します')
        
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert({
            id: currentUserId,
            company_id: companyId,
            email: 'iguchi.akira.p@gmail.com',
            full_name: '井口 亮',
            is_active: true,
            settings: { role: 'operator' }
          })
          .select('settings, company_id')
          .single()

        if (insertError) {
          console.log(`❌ ユーザー作成エラー: ${insertError.message}`)
          console.log(`作成エラー詳細: ${JSON.stringify(insertError)}`)
        } else {
          console.log(`✅ ユーザー作成成功:`, newUser)
        }
      }
    } else {
      console.log(`✅ 現在のユーザー取得成功:`, currentUserData)
    }

    console.log('\n=== 3. company_idのユーザー一覧取得 ===')
    const { data: companyUsers, error: companyError } = await supabase
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

    if (companyError) {
      console.log(`❌ 会社ユーザー取得エラー: ${companyError.message}`)
      console.log(`エラー詳細: ${JSON.stringify(companyError)}`)
    } else {
      console.log(`✅ 会社ユーザー取得成功: ${companyUsers.length}件`)
      companyUsers.forEach(u => {
        console.log(`  - ${u.full_name || u.email} (role: ${u.settings?.role || 'N/A'})`)
      })
    }

    console.log('\n✅ テスト完了')

  } catch (error) {
    console.error('❌ テスト中エラー:', error)
  }
}

testUsersAPI()