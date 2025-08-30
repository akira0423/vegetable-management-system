// データベース調査スクリプト
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://rsofuafiacwygmfkcrrk.supabase.co'
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzb2Z1YWZpYWN3eWdtZmtjcnJrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY5MzIyOSwiZXhwIjoyMDcwMjY5MjI5fQ.CGVm-_sIw8_-zkFBRxBm9V2MNPidd98X4dMrur-FQMw'

const supabase = createClient(supabaseUrl, serviceKey)

async function investigateDatabase() {
  console.log('🔍 データベース包括調査を開始...\n')

  try {
    // 1. 全テーブルのデータ数を確認
    console.log('=== 1. 全テーブルのデータ数 ===')
    const tables = ['companies', 'users', 'growing_tasks', 'reports', 'vegetables']
    
    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
      
      if (error) {
        console.log(`❌ ${table}: エラー - ${error.message}`)
      } else {
        console.log(`📊 ${table}: ${count}件`)
      }
    }

    // auth.usersの確認（RPC経由）
    const { data: authUsersCount, error: authError } = await supabase
      .rpc('count_auth_users')
    
    if (!authError && authUsersCount) {
      console.log(`📊 auth.users: ${authUsersCount}件`)
    }

    // 2. companiesテーブルの詳細確認
    console.log('\n=== 2. companiesテーブルの詳細 ===')
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id, name, contact_email, is_active, created_at')
      .order('created_at', { ascending: false })

    if (companiesError) {
      console.log('❌ companies取得エラー:', companiesError.message)
    } else {
      console.log(`📋 companies数: ${companies.length}`)
      companies.forEach(c => {
        console.log(`  - ${c.name} (${c.id}): ${c.contact_email} - Active: ${c.is_active}`)
      })
    }

    // 3. usersテーブルの詳細確認
    console.log('\n=== 3. usersテーブルの詳細 ===')
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, full_name, company_id, is_active, settings, created_at')
      .order('created_at', { ascending: false })

    if (usersError) {
      console.log('❌ users取得エラー:', usersError.message)
    } else {
      console.log(`👥 users数: ${users.length}`)
      users.forEach(u => {
        console.log(`  - ${u.full_name || 'N/A'} (${u.email}): company_id=${u.company_id}, role=${u.settings?.role || 'N/A'}`)
      })
    }

    // 4. デフォルトcompany_idのデータ確認
    const defaultCompanyId = 'a1111111-1111-1111-1111-111111111111'
    console.log(`\n=== 4. デフォルトcompany_id (${defaultCompanyId}) のデータ ===`)

    // デフォルトcompany_idが存在するか確認
    const { data: defaultCompany, error: defaultCompanyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', defaultCompanyId)
      .single()

    if (defaultCompanyError) {
      console.log(`❌ デフォルトcompany_id存在しません: ${defaultCompanyError.message}`)
    } else {
      console.log(`✅ デフォルトcompany_id存在: ${defaultCompany.name}`)
    }

    // デフォルトcompany_idのユーザー数
    const { count: defaultUsersCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', defaultCompanyId)

    console.log(`👥 デフォルトcompany_idのユーザー数: ${defaultUsersCount}`)

    // デフォルトcompany_idの各テーブルのデータ数
    const dataTypes = ['growing_tasks', 'reports', 'vegetables']
    for (const dataType of dataTypes) {
      const { count } = await supabase
        .from(dataType)
        .select('*', { count: 'exact', head: true })
        .eq('company_id', defaultCompanyId)
      
      console.log(`📊 ${dataType} (default company): ${count}件`)
    }

    // 5. 実際にデータが存在するcompany_idを特定
    console.log('\n=== 5. データが存在するcompany_idの特定 ===')
    
    // 各テーブルからcompany_idを収集
    const companyIds = new Set()
    
    for (const table of ['users', 'growing_tasks', 'reports', 'vegetables']) {
      const { data } = await supabase
        .from(table)
        .select('company_id')
        .not('company_id', 'is', null)
      
      if (data) {
        data.forEach(item => {
          if (item.company_id) {
            companyIds.add(item.company_id)
          }
        })
      }
    }

    console.log(`📊 データが存在するcompany_id数: ${companyIds.size}`)
    for (const companyId of companyIds) {
      // 各company_idの詳細情報を取得
      const { data: companyInfo } = await supabase
        .from('companies')
        .select('name')
        .eq('id', companyId)
        .single()

      // 各テーブルのデータ数を確認
      const counts = {}
      for (const table of ['users', 'growing_tasks', 'reports', 'vegetables']) {
        const { count } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
        counts[table] = count || 0
      }

      console.log(`  📋 ${companyId} (${companyInfo?.name || 'N/A'}):`)
      console.log(`    👥 users: ${counts.users}, 📝 tasks: ${counts.growing_tasks}, 📊 reports: ${counts.reports}, 🥬 vegetables: ${counts.vegetables}`)
    }

    console.log('\n✅ データベース調査完了')

  } catch (error) {
    console.error('❌ 調査中エラー:', error)
  }
}

// count_auth_users関数を作成するRPC
async function createCountFunction() {
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE OR REPLACE FUNCTION count_auth_users()
      RETURNS INTEGER AS $$
      BEGIN
        RETURN (SELECT COUNT(*) FROM auth.users);
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `
  })
  
  if (error) {
    console.log('RPC関数作成エラー:', error.message)
  }
}

// 実行
createCountFunction().then(() => {
  investigateDatabase()
})