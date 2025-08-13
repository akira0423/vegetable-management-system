// テスト用ユーザーの作成
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rsofuafiacwygmfkcrrk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzb2Z1YWZpYWN3eWdtZmtjcnJrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY5MzIyOSwiZXhwIjoyMDcwMjY5MjI5fQ.CGVm-_sIw8_-zkFBRxBm9V2MNPidd98X4dMrur-FQMw'; // service role key

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTestUser() {
  try {
    console.log('Creating test user...');
    
    // まず会社をチェック
    const { data: companies, error: companyError } = await supabase
      .from('companies')
      .select('id, name')
      .limit(5);
    
    console.log('Companies:', companies);
    
    if (companies && companies.length > 0) {
      const companyId = companies[0].id;
      
      // テスト用ユーザーを作成
      const testUser = {
        id: 'e1111111-1111-1111-1111-111111111111',
        company_id: companyId,
        email: 'test@example.com',
        full_name: 'テストユーザー',
        role: 'operator'
      };
      
      const { data: user, error } = await supabase
        .from('users')
        .insert(testUser)
        .select()
        .single();

      if (error) {
        console.error('Error creating user:', error);
      } else {
        console.log('Test user created successfully:');
        console.log(JSON.stringify(user, null, 2));
      }
    } else {
      console.log('No companies found, creating test company first...');
      
      // テスト用会社を作成
      const testCompany = {
        id: 'a1111111-1111-1111-1111-111111111111',
        name: '株式会社テスト',
        plan_type: 'basic',
        contact_email: 'test@company.com'
      };
      
      const { data: company, error: companyInsertError } = await supabase
        .from('companies')
        .insert(testCompany)
        .select()
        .single();

      if (companyInsertError) {
        console.error('Error creating company:', companyInsertError);
        return;
      }
      
      console.log('Test company created:', company);
      
      // その後ユーザーを作成
      const testUser = {
        id: 'e1111111-1111-1111-1111-111111111111',
        company_id: company.id,
        email: 'test@example.com',
        full_name: 'テストユーザー',
        role: 'operator'
      };
      
      const { data: user, error: userError } = await supabase
        .from('users')
        .insert(testUser)
        .select()
        .single();

      if (userError) {
        console.error('Error creating user after company:', userError);
      } else {
        console.log('Test user created successfully:');
        console.log(JSON.stringify(user, null, 2));
      }
    }
    
  } catch (error) {
    console.error('Network error:', error);
  }
}

createTestUser();