// データベース制約の一時的修正
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rsofuafiacwygmfkcrrk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzb2Z1YWZpYWN3eWdtZmtjcnJrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY5MzIyOSwiZXhwIjoyMDcwMjY5MjI5fQ.CGVm-_sIw8_-zkFBRxBm9V2MNPidd98X4dMrur-FQMw'; // service role key

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixConstraints() {
  try {
    console.log('Attempting to modify database constraints...');
    
    // アプローチ1: created_byをnull許可に変更
    console.log('1. Trying to make created_by nullable...');
    try {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: 'ALTER TABLE operation_logs ALTER COLUMN created_by DROP NOT NULL;'
      });
      
      if (error) {
        console.log('RPC exec_sql failed:', error.message);
      } else {
        console.log('Successfully made created_by nullable!');
        return;
      }
    } catch (e) {
      console.log('exec_sql method not available');
    }
    
    // アプローチ2: 直接テスト用ダミーレコードを挿入して、制約がどう動作するかテスト
    console.log('2. Testing direct insert without created_by...');
    const { data, error } = await supabase
      .from('operation_logs')
      .insert({
        vegetable_id: 'd1111111-1111-1111-1111-111111111111',
        date: '2024-08-10',
        work_type: 'watering',
        work_notes: 'テスト挿入',
        work_hours: 1,
        worker_count: 1
      })
      .select()
      .single();
    
    if (error) {
      console.log('Direct insert failed as expected:', error.code, error.message);
      
      // 別のアプローチ：外部キー制約を確認
      console.log('3. Checking table schema...');
      const { data: schemaData, error: schemaError } = await supabase
        .from('information_schema.columns')
        .select('column_name, is_nullable, column_default')
        .eq('table_name', 'operation_logs')
        .eq('column_name', 'created_by');
      
      if (schemaData && schemaData.length > 0) {
        console.log('created_by column info:', schemaData[0]);
      }
      
    } else {
      console.log('Unexpected success! Record created:', data);
    }
    
  } catch (error) {
    console.error('Network error:', error);
  }
}

fixConstraints();