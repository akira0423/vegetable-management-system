// 現在のユーザーの会社割り当てを確認
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://rsofuafiacwygmfkcrrk.supabase.co'
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzb2Z1YWZpYWN3eWdtZmtjcnJrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY5MzIyOSwiZXhwIjoyMDcwMjY5MjI5fQ.CGVm-_sIw8_-zkFBRxBm9V2MNPidd98X4dMrur-FQMw'

const supabase = createClient(supabaseUrl, serviceKey)

async function checkCurrentUser() {
  console.log('🔍 現在のユーザー状況を確認...\n')

  try {
    // auth.usersの確認
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()
    
    if (authError) {
      console.log('❌ auth.users取得エラー:', authError.message)
      return
    }

    console.log('=== Auth.users一覧 ===')
    authUsers.users.forEach(user => {
      console.log(`📧 ${user.email}: ID=${user.id}, 最終ログイン=${user.last_sign_in_at || 'なし'}`)
    })

    // usersテーブルとの照合
    console.log('\n=== Users テーブルとの照合 ===')
    for (const authUser of authUsers.users) {
      const { data: userProfile, error } = await supabase
        .from('users')
        .select('company_id, full_name, settings')
        .eq('id', authUser.id)
        .single()

      if (error) {
        console.log(`❌ ${authUser.email}: usersテーブルにプロファイルなし`)
        
        // どの会社に割り当てるべきかシミュレート
        const domain = authUser.email?.split('@')[1]?.toLowerCase()
        const domainToCompanyMapping = {
          'test-company.com': 'a1111111-1111-1111-1111-111111111111',
          'company.com': '98486022-f937-4022-86a5-b1e6d7011071',
          'gmail.com': '4cb3e254-9d73-4d67-b9ae-433bf249fe38',
          'test.farm': '98466022-f937-4022-86a5-b1e6d7011071'
        }
        
        const suggestedCompany = domainToCompanyMapping[domain || ''] || '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
        
        // 会社名を取得
        const { data: company } = await supabase
          .from('companies')
          .select('name')
          .eq('id', suggestedCompany)
          .single()
        
        console.log(`  💡 推奨割り当て: ${company?.name} (${suggestedCompany})`)
        
      } else {
        const { data: company } = await supabase
          .from('companies')
          .select('name')
          .eq('id', userProfile.company_id)
          .single()
        
        console.log(`✅ ${authUser.email}: ${company?.name} (${userProfile.company_id})`)
      }
    }

    console.log('\n✅ 現在のユーザー状況確認完了')

  } catch (error) {
    console.error('❌ 確認中エラー:', error)
  }
}

checkCurrentUser()