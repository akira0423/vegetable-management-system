// growing_tasks テーブルの確認
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rsofuafiacwygmfkcrrk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzb2Z1YWZpYWN3eWdtZmtjcnJrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY5MzIyOSwiZXhwIjoyMDcwMjY5MjI5fQ.CGVm-_sIw8_-zkFBRxBm9V2MNPidd98X4dMrur-FQMw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkGrowingTasks() {
  try {
    console.log('Checking growing_tasks table...');
    
    // テーブルが存在するかテスト
    const { data, error } = await supabase
      .from('growing_tasks')
      .select('count')
      .limit(1);

    if (error) {
      console.error('❌ growing_tasks table does not exist:', error.message);
      console.log('\n🔍 Available tables:');
      
      // 利用可能なテーブルを確認
      const { data: allTables, error: tablesError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .order('table_name');
      
      if (!tablesError && allTables) {
        allTables.forEach(table => console.log(' -', table.table_name));
      }
      
      return false;
    }

    console.log('✅ growing_tasks table exists');
    
    // 既存データを確認
    const { data: existingData, error: selectError } = await supabase
      .from('growing_tasks')
      .select('*')
      .limit(10);
    
    if (selectError) {
      console.error('❌ Error reading from growing_tasks:', selectError);
      return false;
    }
    
    console.log(`📊 Found ${existingData?.length || 0} existing tasks`);
    if (existingData && existingData.length > 0) {
      console.log('📝 Sample data:', JSON.stringify(existingData[0], null, 2));
    }
    
    return true;

  } catch (error) {
    console.error('Unexpected error:', error);
    return false;
  }
}

// テスト用タスクを作成
async function testTaskCreation() {
  console.log('\n🧪 Testing task creation...');
  
  const testTask = {
    vegetable_id: '677c425d-a99c-4229-84b9-d2d7d7b5148b', // 実際の野菜ID
    name: 'テスト作業',
    start_date: '2025-08-15',
    end_date: '2025-08-20',
    priority: 'medium',
    task_type: 'watering',
    description: 'テーブル確認用の作業',
    status: 'pending',
    progress: 0,
    created_by: 'd0efa1ac-7e7e-420b-b147-dabdf01454b7' // テスト用ユーザーID
  };

  try {
    const { data, error } = await supabase
      .from('growing_tasks')
      .insert(testTask)
      .select()
      .single();

    if (error) {
      console.error('❌ Task creation failed:', error);
      return false;
    }

    console.log('✅ Task created successfully:', data.id);
    console.log('📝 Created task:', JSON.stringify(data, null, 2));
    
    return true;
  } catch (error) {
    console.error('❌ Unexpected error during task creation:', error);
    return false;
  }
}

// 実行
async function main() {
  const tableExists = await checkGrowingTasks();
  
  if (tableExists) {
    await testTaskCreation();
  }
  
  process.exit(0);
}

main();