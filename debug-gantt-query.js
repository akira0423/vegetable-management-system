// Gantt クエリのデバッグ
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rsofuafiacwygmfkcrrk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzb2Z1YWZpYWN3eWdtZmtjcnJrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY5MzIyOSwiZXhwIjoyMDcwMjY5MjI5fQ.CGVm-_sIw8_-zkFBRxBm9V2MNPidd98X4dMrur-FQMw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugGanttQuery() {
  console.log('🔍 Debugging Gantt Query...\n');

  // 1. growing_tasks テーブルの中身を確認
  console.log('1. Checking all growing_tasks:');
  const { data: allTasks, error: tasksError } = await supabase
    .from('growing_tasks')
    .select('*');
  
  if (tasksError) {
    console.error('❌ Error fetching tasks:', tasksError);
  } else {
    console.log(`📊 Total tasks: ${allTasks?.length || 0}`);
    if (allTasks && allTasks.length > 0) {
      console.log('📝 First task:', JSON.stringify(allTasks[0], null, 2));
    }
  }

  // 2. vegetables テーブルの中身を確認
  console.log('\n2. Checking vegetables with company_id:');
  const { data: vegetables, error: vegError } = await supabase
    .from('vegetables')
    .select('id, name, variety_name, company_id')
    .eq('company_id', 'a1111111-1111-1111-1111-111111111111');
  
  if (vegError) {
    console.error('❌ Error fetching vegetables:', vegError);
  } else {
    console.log(`🥬 Total vegetables: ${vegetables?.length || 0}`);
    if (vegetables && vegetables.length > 0) {
      console.log('📝 First vegetable:', JSON.stringify(vegetables[0], null, 2));
    }
  }

  // 3. JOINクエリをテスト
  console.log('\n3. Testing JOIN query (same as API):');
  try {
    const { data: joinedData, error: joinError } = await supabase
      .from('growing_tasks')
      .select(`
        id,
        name,
        start_date,
        end_date,
        progress,
        status,
        priority,
        task_type,
        description,
        assigned_user:users!growing_tasks_assigned_to_fkey(
          id,
          full_name
        ),
        vegetable:vegetables!inner(
          id,
          name,
          variety_name,
          company_id
        )
      `)
      .eq('vegetables.company_id', 'a1111111-1111-1111-1111-111111111111')
      .order('start_date', { ascending: true });

    if (joinError) {
      console.error('❌ JOIN query error:', joinError);
      
      // より簡単なクエリでテスト
      console.log('\n4. Testing simple query without JOIN:');
      const { data: simpleData, error: simpleError } = await supabase
        .from('growing_tasks')
        .select('*')
        .limit(5);
      
      if (simpleError) {
        console.error('❌ Simple query error:', simpleError);
      } else {
        console.log(`📊 Simple query result: ${simpleData?.length || 0} tasks`);
      }
    } else {
      console.log(`📊 JOIN query result: ${joinedData?.length || 0} tasks`);
      if (joinedData && joinedData.length > 0) {
        console.log('📝 First joined result:', JSON.stringify(joinedData[0], null, 2));
      }
    }
  } catch (error) {
    console.error('❌ Query execution error:', error);
  }
}

debugGanttQuery();