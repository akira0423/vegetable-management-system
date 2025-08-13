// 日付フィルター問題のデバッグ
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rsofuafiacwygmfkcrrk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzb2Z1YWZpYWN3eWdtZmtjcnJrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY5MzIyOSwiZXhwIjoyMDcwMjY5MjI5fQ.CGVm-_sIw8_-zkFBRxBm9V2MNPidd98X4dMrur-FQMw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugDateFilter() {
  console.log('🕵️ 日付フィルター問題のデバッグ中...\n');
  
  const companyId = 'a1111111-1111-1111-1111-111111111111';
  
  // 現在のAPIロジックをシミュレート
  const period = '3months';
  const periodDays = {
    '1month': 30,
    '3months': 90,
    '6months': 180,
    '1year': 365
  };
  
  const days = periodDays[period];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  console.log('📅 期間設定:');
  console.log(`   • 期間: ${period} (${days}日間)`);
  console.log(`   • 開始日: ${startDate.toISOString().split('T')[0]}`);
  console.log(`   • 今日: ${new Date().toISOString().split('T')[0]}`);
  
  // 1. 全ての作業記録（フィルターなし）
  console.log('\n1️⃣  全ての作業記録（フィルターなし）:');
  const { data: allLogs } = await supabase
    .from('operation_logs')
    .select('date, work_type, harvest_qty, vegetable:vegetables(company_id, name)')
    .eq('vegetables.company_id', companyId)
    .order('date', { ascending: false });
  
  console.log(`   件数: ${allLogs?.length || 0}件`);
  allLogs?.slice(0, 5).forEach(log => {
    console.log(`   • ${log.date}: ${log.work_type} - ${log.vegetable.name} (収穫: ${log.harvest_qty || 0}kg)`);
  });
  
  // 2. 日付フィルター適用
  console.log('\n2️⃣  日付フィルター適用後:');
  const { data: filteredLogs } = await supabase
    .from('operation_logs')
    .select('date, work_type, harvest_qty, vegetable:vegetables(company_id, name)')
    .eq('vegetables.company_id', companyId)
    .gte('date', startDate.toISOString())
    .order('date', { ascending: false });
  
  console.log(`   件数: ${filteredLogs?.length || 0}件`);
  filteredLogs?.forEach(log => {
    console.log(`   • ${log.date}: ${log.work_type} - ${log.vegetable.name} (収穫: ${log.harvest_qty || 0}kg)`);
  });
  
  // 3. 収穫データのみ
  console.log('\n3️⃣  収穫データのみ（フィルター適用後）:');
  const { data: harvestLogs } = await supabase
    .from('operation_logs')
    .select('date, harvest_qty, harvest_unit, harvest_quality, vegetable:vegetables(company_id, name)')
    .eq('vegetables.company_id', companyId)
    .eq('work_type', 'harvesting')
    .gte('date', startDate.toISOString())
    .order('date', { ascending: false });
  
  console.log(`   件数: ${harvestLogs?.length || 0}件`);
  harvestLogs?.forEach(log => {
    console.log(`   • ${log.date}: ${log.vegetable.name} - ${log.harvest_qty}${log.harvest_unit} (${log.harvest_quality})`);
  });
  
  const totalHarvest = harvestLogs?.reduce((sum, log) => sum + (log.harvest_qty || 0), 0) || 0;
  console.log(`   📈 総収穫量: ${totalHarvest} kg`);
  
  // 4. 野菜テーブルの作成日確認
  console.log('\n4️⃣  野菜テーブルの作成日確認:');
  const { data: vegetables } = await supabase
    .from('vegetables')
    .select('id, name, created_at, area_size')
    .eq('company_id', companyId);
  
  vegetables?.forEach(veg => {
    const createdDate = new Date(veg.created_at);
    const isInPeriod = createdDate >= startDate;
    console.log(`   • ${veg.name}: ${veg.created_at.split('T')[0]} (期間内: ${isInPeriod ? '✅' : '❌'})`);
  });
}

debugDateFilter();