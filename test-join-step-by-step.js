// JOIN クエリの段階的テスト
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rsofuafiacwygmfkcrrk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzb2Z1YWZpYWN3eWdtZmtjcnJrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY5MzIyOSwiZXhwIjoyMDcwMjY5MjI5fQ.CGVm-_sIw8_-zkFBRxBm9V2MNPidd98X4dMrur-FQMw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testJoinStepByStep() {
  const companyId = 'a1111111-1111-1111-1111-111111111111';
  const startDate = '2025-08-01';
  const endDate = '2025-08-31';

  console.log('🔍 Step-by-step JOIN testing...\n');

  // Step 1: Basic growing_tasks query
  console.log('1. Testing basic growing_tasks query:');
  try {
    const { data: basicTasks, error: basicError } = await supabase
      .from('growing_tasks')
      .select('*')
      .gte('end_date', startDate)
      .lte('start_date', endDate);

    if (basicError) {
      console.error('❌ Basic tasks error:', basicError);
    } else {
      console.log(`✅ Basic tasks: ${basicTasks?.length || 0}`);
    }
  } catch (err) {
    console.error('❌ Basic tasks exception:', err);
  }

  // Step 2: Test vegetables table
  console.log('\n2. Testing vegetables query:');
  try {
    const { data: basicVeg, error: vegError } = await supabase
      .from('vegetables')
      .select('id, name, variety_name, company_id')
      .eq('company_id', companyId);

    if (vegError) {
      console.error('❌ Vegetables error:', vegError);
    } else {
      console.log(`✅ Vegetables: ${basicVeg?.length || 0}`);
      if (basicVeg && basicVeg.length > 0) {
        console.log('   First vegetable:', basicVeg[0]);
      }
    }
  } catch (err) {
    console.error('❌ Vegetables exception:', err);
  }

  // Step 3: Test simple JOIN
  console.log('\n3. Testing simple JOIN:');
  try {
    const { data: simpleJoin, error: joinError } = await supabase
      .from('growing_tasks')
      .select(`
        id,
        name,
        vegetable_id,
        vegetables!inner(id, name, company_id)
      `)
      .eq('vegetables.company_id', companyId);

    if (joinError) {
      console.error('❌ Simple JOIN error:', joinError);
    } else {
      console.log(`✅ Simple JOIN: ${simpleJoin?.length || 0}`);
    }
  } catch (err) {
    console.error('❌ Simple JOIN exception:', err);
  }

  // Step 4: Check foreign key relationships
  console.log('\n4. Checking foreign key relationships:');
  try {
    const { data: fkCheck, error: fkError } = await supabase
      .from('growing_tasks')
      .select('vegetable_id, vegetables(id, company_id)')
      .limit(5);

    if (fkError) {
      console.error('❌ FK check error:', fkError);
    } else {
      console.log(`✅ FK check: ${fkCheck?.length || 0}`);
      if (fkCheck && fkCheck.length > 0) {
        console.log('   Sample FK data:', JSON.stringify(fkCheck[0], null, 2));
      }
    }
  } catch (err) {
    console.error('❌ FK check exception:', err);
  }
}

testJoinStepByStep();