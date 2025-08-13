// RLS検証用：作業報告API テストスクリプト
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rsofuafiacwygmfkcrrk.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzb2Z1YWZpYWN3eWdtZmtjcnJrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY5MzIyOSwiZXhwIjoyMDcwMjY5MjI5fQ.CGVm-_sIw8_-zkFBRxBm9V2MNPidd98X4dMrur-FQMw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRLSPolicies() {
  console.log('🔐 RLS ポリシーのテストを開始します...\n');

  // テストデータの準備
  const testData = {
    vegetable_id: 'd1111111-1111-1111-1111-111111111111',
    growing_task_id: null, // タスクIDは空のままテスト
    work_date: new Date().toISOString().split('T')[0],
    work_type: 'harvesting',
    harvest_amount: 15,
    harvest_unit: 'kg',
    harvest_quality: 'good',
    expected_revenue: 3000,
    expected_price: 200,
    created_by: 'd0efa1ac-7e7e-420b-b147-dabdf01454b7'
  };

  console.log('📋 テスト用作業報告データ:');
  console.log(JSON.stringify(testData, null, 2));

  try {
    // 1. RLSポリシーの現在の状態を確認
    console.log('\n1️⃣  現在のRLSポリシー状態を確認...');
    
    const { data: policies } = await supabase
      .from('pg_policies')
      .select('tablename, policyname, permissive, roles, cmd, qual')
      .eq('tablename', 'operation_logs');
    
    console.log('📊 operation_logs テーブルのRLSポリシー:');
    policies?.forEach(policy => {
      console.log(`   • ${policy.policyname} (${policy.cmd})`);
    });

    // 2. Service Role でのアクセステスト
    console.log('\n2️⃣  Service Role でのダイレクトDBアクセステスト...');
    
    const insertData = {
      vegetable_id: testData.vegetable_id,
      growing_task_id: testData.growing_task_id,
      date: testData.work_date,
      work_type: testData.work_type,
      harvest_qty: testData.harvest_amount,
      harvest_unit: testData.harvest_unit,
      harvest_quality: testData.harvest_quality,
      created_by: testData.created_by
    };

    console.log('🔍 データベースに直接挿入をテスト...');
    const { data: directInsert, error: directError } = await supabase
      .from('operation_logs')
      .insert(insertData)
      .select('id, work_type, harvest_qty, created_by')
      .single();

    if (directError) {
      console.error('❌ 直接挿入エラー:', directError);
      console.log('   エラーコード:', directError.code);
      console.log('   エラー詳細:', directError.details);
      console.log('   ヒント:', directError.hint);
      
      // RLS違反の場合の詳細分析
      if (directError.code === '42501') {
        console.log('\n🚨 RLS違反が検出されました:');
        console.log('   • Service Roleでもアクセスが制限されています');
        console.log('   • ポリシーの設定を確認してください');
        
        // デバッグ情報の取得試行
        try {
          const { data: debugInfo } = await supabase.rpc('debug_auth_status');
          console.log('🔍 認証デバッグ情報:', debugInfo);
        } catch (debugError) {
          console.log('⚠️  デバッグ情報取得失敗:', debugError.message);
        }
      }
    } else {
      console.log('✅ 直接挿入成功:', directInsert);
    }

    // 3. HTTP API経由でのテスト
    console.log('\n3️⃣  HTTP API経由でのテスト...');
    
    const apiUrl = 'http://localhost:3000/api/reports';
    console.log(`📡 API エンドポイント: ${apiUrl}`);
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData)
      });

      const result = await response.json();

      if (response.ok) {
        console.log('✅ API経由の作業報告作成成功:');
        console.log('   ID:', result.data?.id);
        console.log('   作業種類:', result.data?.work_type);
        console.log('   作成日:', result.data?.created_at);
      } else {
        console.error('❌ API経由の作業報告作成失敗:');
        console.error('   ステータス:', response.status);
        console.error('   エラー:', result.error);
        console.error('   詳細:', result.details);
        console.error('   コード:', result.code);
      }
    } catch (fetchError) {
      console.error('💥 API通信エラー:', fetchError.message);
      console.log('⚠️  アプリケーションサーバーが起動していることを確認してください');
    }

    // 4. 作成されたレコードの確認
    console.log('\n4️⃣  作成されたレコードの確認...');
    
    const { data: createdRecords, error: selectError } = await supabase
      .from('operation_logs')
      .select(`
        id,
        vegetable_id,
        date,
        work_type,
        harvest_qty,
        harvest_unit,
        harvest_quality,
        created_by,
        created_at,
        vegetable:vegetables(name, variety_name, plot_name)
      `)
      .eq('vegetable_id', testData.vegetable_id)
      .eq('date', testData.work_date)
      .order('created_at', { ascending: false })
      .limit(3);

    if (selectError) {
      console.error('❌ レコード確認エラー:', selectError);
    } else {
      console.log(`✅ 該当する作業記録が ${createdRecords.length} 件見つかりました:`);
      createdRecords.forEach((record, index) => {
        console.log(`   ${index + 1}. ID: ${record.id}`);
        console.log(`      作業: ${record.work_type}`);
        console.log(`      収穫量: ${record.harvest_qty} ${record.harvest_unit}`);
        console.log(`      野菜: ${record.vegetable?.name} ${record.vegetable?.variety_name}`);
        console.log(`      作成者: ${record.created_by}`);
        console.log(`      作成日時: ${record.created_at}`);
      });
    }

    // 5. RLSバイパス確認テスト
    console.log('\n5️⃣  RLSバイパス確認テスト...');
    
    // 異なる会社のデータを作成しようとする（失敗するはず）
    const unauthorizedData = {
      ...insertData,
      vegetable_id: '99999999-9999-9999-9999-999999999999', // 存在しない野菜ID
      created_by: '99999999-9999-9999-9999-999999999999'    // 存在しないユーザーID
    };

    const { data: unauthorizedInsert, error: unauthorizedError } = await supabase
      .from('operation_logs')
      .insert(unauthorizedData)
      .select()
      .single();

    if (unauthorizedError) {
      console.log('✅ 予想通り未認可データの挿入が拒否されました:', unauthorizedError.message);
    } else {
      console.warn('⚠️  警告: 未認可データの挿入が成功してしまいました。セキュリティ設定を確認してください。');
      console.log('   挿入されたデータ:', unauthorizedInsert);
    }

    console.log('\n🎯 RLSテスト完了！');

  } catch (error) {
    console.error('💥 RLSテスト中にエラーが発生しました:', error);
  }
}

// クリーンアップ関数
async function cleanupTestRecords() {
  console.log('🧹 テスト用作業記録をクリーンアップしています...');
  
  try {
    const { data: deletedRecords, error: deleteError } = await supabase
      .from('operation_logs')
      .delete()
      .eq('vegetable_id', 'd1111111-1111-1111-1111-111111111111')
      .eq('work_type', 'harvesting')
      .select('id');

    if (deleteError) {
      console.error('❌ クリーンアップエラー:', deleteError);
    } else {
      console.log(`✅ ${deletedRecords.length} 件のテスト記録を削除しました`);
    }
  } catch (error) {
    console.error('💥 クリーンアップ中にエラーが発生しました:', error);
  }
}

// デバッグ情報表示関数
async function showDebugInfo() {
  console.log('🔍 デバッグ情報を表示しています...\n');
  
  try {
    // 1. 認証状態
    console.log('1️⃣  認証状態:');
    try {
      const { data: debugInfo } = await supabase.rpc('debug_auth_status');
      console.log(JSON.stringify(debugInfo, null, 2));
    } catch (error) {
      console.log('   Service Role使用中（auth関数は利用不可）');
    }

    // 2. テストデータの存在確認
    console.log('\n2️⃣  テストデータの存在確認:');
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name')
      .ilike('id', '1%').or('id.ilike.2%').or('id.ilike.3%').or('id.ilike.4%');
    console.log('   会社:', companies?.length || 0, '件');

    const { data: users } = await supabase
      .from('users')
      .select('id, full_name, role')
      .ilike('id', '1%').or('id.ilike.2%').or('id.ilike.3%').or('id.ilike.4%');
    console.log('   ユーザー:', users?.length || 0, '件');

    const { data: vegetables } = await supabase
      .from('vegetables')
      .select('id, name, variety_name')
      .ilike('id', '1%').or('id.ilike.2%').or('id.ilike.3%').or('id.ilike.4%');
    console.log('   野菜:', vegetables?.length || 0, '件');

    const { data: tasks } = await supabase
      .from('growing_tasks')
      .select('id, name, status')
      .ilike('id', '1%').or('id.ilike.2%').or('id.ilike.3%').or('id.ilike.4%');
    console.log('   タスク:', tasks?.length || 0, '件');

    // 3. RLSポリシーの状態
    console.log('\n3️⃣  operation_logs RLSポリシー:');
    const { data: policies } = await supabase
      .from('pg_policies')
      .select('policyname, cmd, permissive')
      .eq('tablename', 'operation_logs');
    
    policies?.forEach(policy => {
      console.log(`   • ${policy.policyname} (${policy.cmd})`);
    });

  } catch (error) {
    console.error('💥 デバッグ情報取得エラー:', error);
  }
}

// コマンドライン引数に応じて実行
const command = process.argv[2];

switch (command) {
  case 'test':
    testRLSPolicies();
    break;
  case 'cleanup':
    cleanupTestRecords();
    break;
  case 'debug':
    showDebugInfo();
    break;
  default:
    console.log('使用方法:');
    console.log('  node test-rls-reports.js test    - RLSポリシーをテスト');
    console.log('  node test-rls-reports.js cleanup - テスト記録を削除');
    console.log('  node test-rls-reports.js debug   - デバッグ情報を表示');
    break;
}