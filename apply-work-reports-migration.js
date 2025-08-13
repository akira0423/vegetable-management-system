// work_reports テーブル作成マイグレーション
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://rsofuafiacwygmfkcrrk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzb2Z1YWZpYWN3eWdtZmtjcnJrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY5MzIyOSwiZXhwIjoyMDcwMjY5MjI5fQ.CGVm-_sIw8_-zkFBRxBm9V2MNPidd98X4dMrur-FQMw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyWorkReportsMigration() {
  try {
    console.log('Applying work_reports table migration...');
    
    // マイグレーションファイルを読み込み
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '017_create_work_reports_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // マイグレーションを実行
    const { data, error } = await supabase.rpc('exec', {
      query: migrationSQL
    });

    if (error) {
      console.error('Migration failed:', error);
      return false;
    }

    console.log('✅ work_reports table created successfully!');

    // テーブルが作成されたか確認
    const { data: tableCheck, error: checkError } = await supabase
      .from('work_reports')
      .select('count')
      .limit(1);

    if (checkError) {
      console.error('Table check failed:', checkError);
      return false;
    }

    console.log('✅ Table verification successful');
    return true;

  } catch (error) {
    console.error('Unexpected error:', error);
    return false;
  }
}

// 実行
applyWorkReportsMigration()
  .then(success => {
    if (success) {
      console.log('🎉 Migration completed successfully!');
    } else {
      console.log('❌ Migration failed!');
    }
    process.exit(success ? 0 : 1);
  });