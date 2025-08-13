// work_reports テーブル作成
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rsofuafiacwygmfkcrrk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzb2Z1YWZpYWN3eWdtZmtjcnJrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY5MzIyOSwiZXhwIjoyMDcwMjY5MjI5fQ.CGVm-_sIw8_-zkFBRxBm9V2MNPidd98X4dMrur-FQMw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createWorkReportsTable() {
  try {
    console.log('Checking if work_reports table exists...');
    
    // テーブルが既に存在するか確認
    const { data: existingTable, error: checkError } = await supabase
      .from('work_reports')
      .select('id')
      .limit(1);

    if (!checkError) {
      console.log('✅ work_reports table already exists!');
      return true;
    }

    console.log('Creating work_reports table...');

    // テーブル作成のSQL文を個別に実行
    const createTableSQL = `
      CREATE TABLE work_reports (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        vegetable_id uuid REFERENCES vegetables(id) ON DELETE CASCADE,
        work_type varchar(100) NOT NULL,
        description text,
        work_date date NOT NULL DEFAULT CURRENT_DATE,
        start_time time,
        end_time time,
        duration_hours decimal(4,2),
        photos jsonb DEFAULT '[]'::jsonb,
        weather varchar(50),
        temperature decimal(4,1),
        notes text,
        created_by uuid REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamp with time zone DEFAULT now(),
        updated_at timestamp with time zone DEFAULT now()
      );
    `;

    // 最初にテストデータを挿入してテーブル作成を試行
    const { data, error } = await supabase
      .from('work_reports')
      .insert({
        company_id: 'a1111111-1111-1111-1111-111111111111',
        work_type: 'テスト',
        description: 'テスト用作業報告',
        work_date: '2024-01-01',
        notes: 'テーブル作成確認用'
      })
      .select();

    if (error) {
      console.error('Table creation failed:', error);
      console.log('This likely means the table doesn\'t exist yet. Manual creation required.');
      return false;
    }

    console.log('✅ work_reports table is working!');
    console.log('Test data inserted:', data);

    // テストデータを削除
    if (data && data[0]) {
      const { error: deleteError } = await supabase
        .from('work_reports')
        .delete()
        .eq('id', data[0].id);

      if (deleteError) {
        console.warn('Could not delete test data:', deleteError);
      } else {
        console.log('✅ Test data cleaned up');
      }
    }

    return true;

  } catch (error) {
    console.error('Unexpected error:', error);
    return false;
  }
}

// 実行
createWorkReportsTable()
  .then(success => {
    if (success) {
      console.log('🎉 work_reports table is ready!');
    } else {
      console.log('❌ Table creation/verification failed!');
      console.log('Please create the table manually in Supabase dashboard');
    }
    process.exit(success ? 0 : 1);
  });