// テスト用データベースセットアップスクリプト
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rsofuafiacwygmfkcrrk.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzb2Z1YWZpYWN3eWdtZmtjcnJrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY5MzIyOSwiZXhwIjoyMDcwMjY5MjI5fQ.CGVm-_sIw8_-zkFBRxBm9V2MNPidd98X4dMrur-FQMw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupTestData() {
  console.log('🚀 テストデータベースのセットアップを開始します...');
  
  try {
    // 1. テスト用会社の作成
    console.log('\n1️⃣  テスト用会社を作成しています...');
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .upsert({
        id: '11111111-1111-1111-1111-111111111111',
        name: 'テスト農園株式会社',
        plan_type: 'basic',
        contact_email: 'test@example.com',
        contact_phone: '090-1234-5678',
        address: '東京都テスト区テスト町1-2-3',
        prefecture: '東京都',
        city: 'テスト区',
        postal_code: '123-4567'
      }, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (companyError) {
      console.error('❌ 会社作成エラー:', companyError);
      throw companyError;
    }
    console.log('✅ テスト用会社を作成しました:', company.name);

    // 2. テスト用auth.usersの作成
    console.log('\n2️⃣  テスト用認証ユーザーを作成しています...');
    let authUserId = '22222222-2222-2222-2222-222222222222';
    
    try {
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        user_id: authUserId,
        email: 'test-operator@example.com',
        password: 'testpass123',
        email_confirm: true,
        user_metadata: {
          full_name: 'テスト作業員',
          company_id: company.id,
          role: 'operator'
        }
      });

      if (authError && !authError.message.includes('already registered')) {
        console.error('❌ 認証ユーザー作成エラー:', authError);
        throw authError;
      }
      
      if (authUser?.user) {
        authUserId = authUser.user.id;
      }
      
      console.log('✅ テスト用認証ユーザーを作成しました:', authUserId);
    } catch (error) {
      if (error.message?.includes('already registered')) {
        console.log('⚠️  認証ユーザーは既に存在しています。既存のものを使用します。');
      } else {
        throw error;
      }
    }

    // 3. テスト用usersテーブルレコードの作成
    console.log('\n3️⃣  テスト用ユーザーレコードを作成しています...');
    const { data: user, error: userError } = await supabase
      .from('users')
      .upsert({
        id: authUserId,
        company_id: company.id,
        email: 'test-operator@example.com',
        full_name: 'テスト作業員',
        role: 'operator',
        phone: '090-9876-5432',
        is_active: true
      }, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (userError) {
      console.error('❌ ユーザーレコード作成エラー:', userError);
      throw userError;
    }
    console.log('✅ テスト用ユーザーレコードを作成しました:', user.full_name);

    // 4. テスト用野菜の作成
    console.log('\n4️⃣  テスト用野菜データを作成しています...');
    const { data: vegetable, error: vegetableError } = await supabase
      .from('vegetables')
      .upsert({
        id: '33333333-3333-3333-3333-333333333333',
        company_id: company.id,
        name: 'トマト',
        variety_name: '桃太郎',
        plot_name: 'A区画1番',
        planting_date: '2025-01-01',
        expected_harvest_start: '2025-08-01',
        expected_harvest_end: '2025-08-31',
        status: 'growing',
        plant_count: 50,
        area_size: 100.5,
        created_by: user.id
      }, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (vegetableError) {
      console.error('❌ 野菜データ作成エラー:', vegetableError);
      throw vegetableError;
    }
    console.log('✅ テスト用野菜データを作成しました:', `${vegetable.name} (${vegetable.variety_name})`);

    // 5. テスト用栽培タスクの作成
    console.log('\n5️⃣  テスト用栽培タスクを作成しています...');
    const { data: task, error: taskError } = await supabase
      .from('growing_tasks')
      .upsert({
        id: '44444444-4444-4444-4444-444444444444',
        vegetable_id: vegetable.id,
        name: 'トマト収穫作業',
        description: 'テスト用の収穫作業タスク',
        task_type: 'harvesting',
        start_date: '2025-08-01',
        end_date: '2025-08-31',
        status: 'in_progress',
        assigned_to: user.id,
        priority: 'medium',
        progress: 50
      }, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (taskError) {
      console.error('❌ 栽培タスク作成エラー:', taskError);
      throw taskError;
    }
    console.log('✅ テスト用栽培タスクを作成しました:', task.name);

    // 6. RLSポリシーのデバッグ情報
    console.log('\n6️⃣  RLSポリシーのデバッグ情報を取得しています...');
    try {
      const { data: debugInfo } = await supabase.rpc('debug_auth_status');
      console.log('🔍 認証デバッグ情報:', debugInfo);
    } catch (debugError) {
      console.log('⚠️  認証デバッグ取得失敗 (Service Roleでは正常):', debugError.message);
    }

    // 7. 作成したデータの確認
    console.log('\n7️⃣  作成したデータを確認しています...');
    const { data: verification, error: verifyError } = await supabase
      .from('vegetables')
      .select(`
        id,
        name,
        variety_name,
        plot_name,
        company:companies(name),
        creator:users!created_by(full_name),
        tasks:growing_tasks(name, status)
      `)
      .eq('id', vegetable.id)
      .single();

    if (verifyError) {
      console.error('❌ データ確認エラー:', verifyError);
    } else {
      console.log('✅ データ確認完了:');
      console.log(JSON.stringify(verification, null, 2));
    }

    console.log('\n🎉 テストデータベースのセットアップが完了しました！');
    console.log('📋 作成されたテストデータ:');
    console.log(`   • 会社: ${company.name} (ID: ${company.id})`);
    console.log(`   • ユーザー: ${user.full_name} (ID: ${user.id})`);
    console.log(`   • 野菜: ${vegetable.name} ${vegetable.variety_name} (ID: ${vegetable.id})`);
    console.log(`   • タスク: ${task.name} (ID: ${task.id})`);
    
    console.log('\n📝 作業報告テスト用データ:');
    console.log({
      vegetable_id: vegetable.id,
      growing_task_id: task.id,
      work_date: new Date().toISOString().split('T')[0],
      work_type: 'harvesting',
      harvest_amount: 20,
      harvest_unit: 'kg',
      harvest_quality: 'good',
      created_by: user.id
    });

  } catch (error) {
    console.error('💥 テストデータベースセットアップ中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// 既存データのクリーンアップ機能
async function cleanupTestData() {
  console.log('🧹 テストデータをクリーンアップしています...');
  
  try {
    // 逆順で削除（外部キー制約に配慮）
    await supabase.from('operation_logs').delete().ilike('created_by', '2%');
    await supabase.from('growing_tasks').delete().ilike('id', '4%');
    await supabase.from('vegetables').delete().ilike('id', '3%');
    await supabase.from('users').delete().ilike('id', '2%');
    await supabase.from('companies').delete().ilike('id', '1%');
    
    console.log('✅ テストデータのクリーンアップが完了しました');
  } catch (error) {
    console.error('❌ クリーンアップエラー:', error);
  }
}

// コマンドライン引数に応じて実行
const command = process.argv[2];

switch (command) {
  case 'setup':
    setupTestData();
    break;
  case 'cleanup':
    cleanupTestData();
    break;
  case 'reset':
    cleanupTestData().then(() => setupTestData());
    break;
  default:
    console.log('使用方法:');
    console.log('  node create-test-data.js setup   - テストデータを作成');
    console.log('  node create-test-data.js cleanup - テストデータを削除');
    console.log('  node create-test-data.js reset   - テストデータを削除して再作成');
    break;
}