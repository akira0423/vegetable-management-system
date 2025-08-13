// 既存のサンプルデータを確認するスクリプト
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rsofuafiacwygmfkcrrk.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzb2Z1YWZpYWN3eWdtZmtjcnJrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY5MzIyOSwiZXhwIjoyMDcwMjY5MjI5fQ.CGVm-_sIw8_-zkFBRxBm9V2MNPidd98X4dMrur-FQMw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSampleData() {
  console.log('🔍 既存のサンプルデータを確認しています...\n');
  
  try {
    // 1. 会社データ確認
    console.log('1️⃣  会社データ:');
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id, name, contact_email')
      .limit(10);
    
    if (companiesError) {
      console.error('❌ 会社データ取得エラー:', companiesError);
    } else {
      companies?.forEach(company => {
        console.log(`   • ${company.name} (${company.id})`);
      });
    }
    
    // 2. ユーザーデータ確認
    console.log('\n2️⃣  ユーザーデータ:');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, full_name, email, company_id')
      .limit(10);
    
    if (usersError) {
      console.error('❌ ユーザーデータ取得エラー:', usersError);
    } else {
      users?.forEach(user => {
        console.log(`   • ${user.full_name} (${user.id}) - 会社: ${user.company_id}`);
      });
    }
    
    // 3. 野菜データ確認
    console.log('\n3️⃣  野菜データ:');
    const { data: vegetables, error: vegetablesError } = await supabase
      .from('vegetables')
      .select('id, name, variety_name, plot_name, company_id')
      .limit(10);
    
    if (vegetablesError) {
      console.error('❌ 野菜データ取得エラー:', vegetablesError);
    } else {
      vegetables?.forEach(vegetable => {
        console.log(`   • ${vegetable.name} ${vegetable.variety_name} (${vegetable.id}) - 区画: ${vegetable.plot_name}`);
      });
    }
    
    // 4. 栽培タスクデータ確認
    console.log('\n4️⃣  栽培タスクデータ:');
    const { data: tasks, error: tasksError } = await supabase
      .from('growing_tasks')
      .select('id, name, task_type, vegetable_id, status')
      .limit(10);
    
    if (tasksError) {
      console.error('❌ 栽培タスクデータ取得エラー:', tasksError);
    } else {
      tasks?.forEach(task => {
        console.log(`   • ${task.name} (${task.id}) - 種類: ${task.task_type}, 状態: ${task.status}`);
      });
    }
    
    // 5. 既存の作業記録確認
    console.log('\n5️⃣  既存の作業記録データ:');
    const { data: logs, error: logsError } = await supabase
      .from('operation_logs')
      .select('id, work_type, date, vegetable_id, created_by')
      .limit(5);
    
    if (logsError) {
      console.error('❌ 作業記録データ取得エラー:', logsError);
    } else {
      logs?.forEach(log => {
        console.log(`   • ${log.work_type} (${log.date}) - 野菜ID: ${log.vegetable_id}`);
      });
    }
    
    // 6. 作業報告テスト用の推奨データ
    console.log('\n6️⃣  作業報告テスト用推奨データ:');
    
    if (vegetables && vegetables.length > 0 && users && users.length > 0) {
      const testVegetable = vegetables[0];
      const testUser = users[0];
      
      // 該当野菜のタスクを確認
      const { data: vegetableTasks } = await supabase
        .from('growing_tasks')
        .select('id, name, task_type')
        .eq('vegetable_id', testVegetable.id)
        .limit(1);
      
      const recommendedData = {
        vegetable_id: testVegetable.id,
        growing_task_id: vegetableTasks?.[0]?.id || null,
        work_date: new Date().toISOString().split('T')[0],
        work_type: 'harvesting',
        harvest_amount: 10,
        harvest_unit: 'kg',
        harvest_quality: 'good',
        created_by: testUser.id
      };
      
      console.log('📋 推奨テストデータ:');
      console.log(JSON.stringify(recommendedData, null, 2));
    } else {
      console.log('⚠️  テスト用データが不足しています。サンプルデータを作成してください。');
    }
    
    console.log('\n🎯 データ確認完了！');
    
  } catch (error) {
    console.error('💥 データ確認中にエラーが発生しました:', error);
  }
}

checkSampleData();