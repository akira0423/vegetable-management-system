// Test date filtering logic
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rsofuafiacwygmfkcrrk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzb2Z1YWZpYWN3eWdtZmtjcnJrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY5MzIyOSwiZXhwIjoyMDcwMjY5MjI5fQ.CGVm-_sIw8_-zkFBRxBm9V2MNPidd98X4dMrur-FQMw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDateLogic() {
  console.log('🔍 Testing date filtering logic...\n');
  
  // Task dates: 2025-08-15 to 2025-08-20
  // Query range: 2025-08-01 to 2025-08-31
  
  const startDate = '2025-08-01';
  const endDate = '2025-08-31';
  const companyId = 'a1111111-1111-1111-1111-111111111111';

  console.log(`Query range: ${startDate} to ${endDate}`);
  console.log(`Task range: 2025-08-15 to 2025-08-20`);
  console.log(`Expected: Task should be included\n`);

  // Test 1: Current logic
  console.log('1. Testing current date filtering logic:');
  try {
    const { data: tasks1, error: error1 } = await supabase
      .from('growing_tasks')
      .select(`
        id,
        name,
        start_date,
        end_date,
        vegetable:vegetables!inner(
          id,
          name,
          variety_name,
          company_id
        )
      `)
      .eq('vegetables.company_id', companyId)
      .lte('start_date', endDate)    // タスク開始日 <= 範囲終了日
      .gte('end_date', startDate);   // タスク終了日 >= 範囲開始日

    if (error1) {
      console.error('❌ Error:', error1);
    } else {
      console.log(`✅ Current logic result: ${tasks1?.length || 0} tasks`);
    }
  } catch (err) {
    console.error('❌ Exception:', err);
  }

  // Test 2: Without date filtering
  console.log('\n2. Testing without date filtering:');
  try {
    const { data: tasks2, error: error2 } = await supabase
      .from('growing_tasks')
      .select(`
        id,
        name,
        start_date,
        end_date,
        vegetable:vegetables!inner(
          id,
          name,
          variety_name,
          company_id
        )
      `)
      .eq('vegetables.company_id', companyId);

    if (error2) {
      console.error('❌ Error:', error2);
    } else {
      console.log(`✅ No date filter result: ${tasks2?.length || 0} tasks`);
      if (tasks2 && tasks2.length > 0) {
        console.log('   Task dates:', tasks2[0].start_date, 'to', tasks2[0].end_date);
      }
    }
  } catch (err) {
    console.error('❌ Exception:', err);
  }

  // Test 3: Manual date check
  console.log('\n3. Manual date logic verification:');
  const taskStart = '2025-08-15';
  const taskEnd = '2025-08-20';
  const queryStart = '2025-08-01';
  const queryEnd = '2025-08-31';
  
  const condition1 = taskStart <= queryEnd;  // 2025-08-15 <= 2025-08-31
  const condition2 = taskEnd >= queryStart;  // 2025-08-20 >= 2025-08-01
  
  console.log(`   Task start (${taskStart}) <= Query end (${queryEnd}): ${condition1}`);
  console.log(`   Task end (${taskEnd}) >= Query start (${queryStart}): ${condition2}`);
  console.log(`   Both conditions met: ${condition1 && condition2}`);
}

testDateLogic();