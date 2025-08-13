// テスト用：データベースのusersテーブル確認
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rsofuafiacwygmfkcrrk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzb2Z1YWZpYWN3eWdtZmtjcnJrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY5MzIyOSwiZXhwIjoyMDcwMjY5MjI5fQ.CGVm-_sIw8_-zkFBRxBm9V2MNPidd98X4dMrur-FQMw'; // service role key

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
  try {
    console.log('Checking users in database...');
    
    const { data: users, error } = await supabase
      .from('users')
      .select('id, full_name, email, company_id')
      .limit(10);

    if (error) {
      console.error('Error fetching users:', error);
    } else {
      console.log('Found users:');
      console.log(JSON.stringify(users, null, 2));
    }
  } catch (error) {
    console.error('Network error:', error);
  }
}

checkUsers();