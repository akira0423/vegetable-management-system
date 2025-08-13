// データ分析API の動作確認テストスクリプト
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rsofuafiacwygmfkcrrk.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzb2Z1YWZpYWN3eWdtZmtjcnJrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY5MzIyOSwiZXhwIjoyMDcwMjY5MjI5fQ.CGVm-_sIw8_-zkFBRxBm9V2MNPidd98X4dMrur-FQMw';

async function testAnalyticsAPI() {
  console.log('🧪 データ分析API動作確認テストを開始します...\n');
  
  try {
    // 1. HTTP API経由でのテスト
    console.log('1️⃣  HTTP API経由での分析データ取得テスト...');
    
    const apiUrl = 'http://localhost:3000/api/analytics';
    const testCompanyId = 'a1111111-1111-1111-1111-111111111111'; // 株式会社グリーンファーム
    
    console.log(`📡 API エンドポイント: ${apiUrl}?company_id=${testCompanyId}&period=3months`);
    
    try {
      const response = await fetch(`${apiUrl}?company_id=${testCompanyId}&period=3months`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log('✅ API経由の分析データ取得成功:');
        console.log('📊 サマリー統計:');
        console.log(`   • 総売上: ¥${result.data.summary.total_revenue.toLocaleString()}`);
        console.log(`   • 総コスト: ¥${result.data.summary.total_cost.toLocaleString()}`);
        console.log(`   • 利益率: ${result.data.summary.profit_margin.toFixed(1)}%`);
        console.log(`   • 総収穫量: ${result.data.summary.total_harvest} kg`);
        console.log(`   • 効率スコア: ${result.data.summary.efficiency_score}%`);
        
        console.log('\n🌾 収穫分析データ:');
        result.data.harvest_analysis.forEach(item => {
          console.log(`   • ${item.label}: ${item.value} kg`);
        });
        
        console.log('\n💰 コスト分析データ:');
        result.data.cost_analysis.forEach(item => {
          console.log(`   • ${item.label}: ¥${item.value.toLocaleString()} (作業回数: ${item.operationCount || 0}回)`);
        });
        
        console.log('\n🌟 野菜別パフォーマンス:');
        result.data.vegetable_performance.slice(0, 3).forEach(item => {
          console.log(`   • ${item.name} (${item.variety || '品種不明'})`);
          console.log(`     - 収穫量: ${item.harvest_amount} kg`);
          console.log(`     - 売上: ¥${item.revenue.toLocaleString()}`);
          console.log(`     - ROI: ${item.roi}%`);
          console.log(`     - ステータス: ${item.status}`);
        });
        
        console.log('\n📈 最近のアクティビティ:');
        result.data.recent_activities.slice(0, 3).forEach(activity => {
          console.log(`   • ${activity.title}`);
          console.log(`     - ${activity.description}`);
          console.log(`     - 日付: ${activity.timestamp}`);
        });
        
      } else {
        console.error('❌ API経由の分析データ取得失敗:');
        console.error('   ステータス:', response.status);
        console.error('   エラー:', result.error);
      }
    } catch (fetchError) {
      console.error('💥 API通信エラー:', fetchError.message);
      console.log('⚠️  アプリケーションサーバーが起動していることを確認してください');
    }

    // 2. 直接データベースでのデータ確認
    console.log('\n2️⃣  直接データベースでの実データ確認...');
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 作業記録の確認
    const { data: operationLogs, error: logsError } = await supabase
      .from('operation_logs')
      .select(`
        id,
        work_type,
        date,
        harvest_qty,
        harvest_unit,
        harvest_quality,
        work_hours,
        worker_count,
        vegetable:vegetables(name, variety_name, company_id)
      `)
      .eq('vegetables.company_id', testCompanyId)
      .order('date', { ascending: false })
      .limit(5);

    if (logsError) {
      console.error('❌ 作業記録取得エラー:', logsError);
    } else {
      console.log(`✅ 作業記録データ (${operationLogs.length}件):`);
      operationLogs.forEach((log, index) => {
        console.log(`   ${index + 1}. ${log.work_type} - ${log.vegetable?.name} (${log.date})`);
        if (log.work_type === 'harvesting') {
          console.log(`      収穫: ${log.harvest_qty || 0} ${log.harvest_unit || 'kg'} (品質: ${log.harvest_quality || '不明'})`);
        }
        console.log(`      作業時間: ${log.work_hours || 1}時間 (作業者: ${log.worker_count || 1}名)`);
      });
    }

    // 3. データの整合性チェック
    console.log('\n3️⃣  データ整合性チェック...');
    
    // 収穫データの詳細確認
    const { data: harvestData } = await supabase
      .from('operation_logs')
      .select('harvest_qty, harvest_unit, harvest_quality')
      .eq('work_type', 'harvesting')
      .not('harvest_qty', 'is', null);

    const totalDirectHarvest = harvestData?.reduce((sum, record) => sum + (record.harvest_qty || 0), 0) || 0;
    console.log(`📈 直接計算した総収穫量: ${totalDirectHarvest} kg`);
    
    // 品質別集計
    const qualityStats = { premium: 0, good: 0, fair: 0, other: 0 };
    harvestData?.forEach(record => {
      const quality = record.harvest_quality || 'good';
      const amount = record.harvest_qty || 0;
      
      if (quality === 'premium' || quality === 'excellent') {
        qualityStats.premium += amount;
      } else if (quality === 'good') {
        qualityStats.good += amount;
      } else if (quality === 'fair') {
        qualityStats.fair += amount;
      } else {
        qualityStats.other += amount;
      }
    });
    
    console.log('🏆 品質別収穫統計:');
    console.log(`   • プレミアム: ${qualityStats.premium} kg`);
    console.log(`   • 良品: ${qualityStats.good} kg`);
    console.log(`   • 並品: ${qualityStats.fair} kg`);
    console.log(`   • その他: ${qualityStats.other} kg`);

    console.log('\n🎯 データ分析API動作確認テスト完了！');

  } catch (error) {
    console.error('💥 テスト実行中にエラーが発生しました:', error);
  }
}

// コマンドライン引数に応じて実行
const command = process.argv[2];

switch (command) {
  case 'test':
    testAnalyticsAPI();
    break;
  default:
    console.log('使用方法:');
    console.log('  node test-analytics-api.js test - データ分析APIをテスト');
    console.log('');
    console.log('前提条件:');
    console.log('  • npm run dev でアプリケーションが起動している');
    console.log('  • 作業報告データがデータベースに存在している');
    break;
}