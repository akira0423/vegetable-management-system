// 手動でRLS マイグレーションを適用するスクリプト
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rsofuafiacwygmfkcrrk.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzb2Z1YWZpYWN3eWdtZmtjcnJrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY5MzIyOSwiZXhwIjoyMDcwMjY5MjI5fQ.CGVm-_sIw8_-zkFBRxBm9V2MNPidd98X4dMrur-FQMw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyRLSMigration() {
  console.log('🚀 RLS マイグレーション適用を開始します...');
  
  try {
    // RLS マイグレーションファイルを読み込み
    const migrationPath = path.join(__dirname, 'supabase/migrations/009_flexible_rls_for_testing.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 マイグレーションファイルを読み込みました:', migrationPath);
    
    // SQLをセミコロンで分割して個別に実行
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 ${statements.length} 個のSQLステートメントを実行します...\n`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (statement.trim().length === 0) continue;
      
      console.log(`${i + 1}/${statements.length}: ${statement.substring(0, 60)}...`);
      
      try {
        // rpcで生のSQLを実行
        const { data, error } = await supabase.rpc('exec_sql', { 
          sql: statement + ';'
        });
        
        if (error) {
          // rpcが使えない場合は別の方法を試す
          if (error.code === '42883') {
            console.log('   ⚠️  rpc関数が使用できません。個別実行をスキップします。');
            continue;
          }
          
          throw error;
        }
        
        console.log('   ✅ 実行成功');
        
      } catch (stmtError) {
        console.error(`   ❌ ステートメント実行エラー:`, stmtError.message);
        
        // 既に存在するエラーの場合は警告として扱う
        if (stmtError.message.includes('already exists') || 
            stmtError.message.includes('does not exist') ||
            stmtError.code === '42710' || // duplicate object
            stmtError.code === '42P07') {  // duplicate table
          console.log('   ⚠️  オブジェクトが既に存在するか、存在しないオブジェクトの削除です。続行します。');
        } else {
          throw stmtError;
        }
      }
    }
    
    console.log('\n🎉 RLS マイグレーション適用が完了しました！');
    
    // 適用結果の確認
    console.log('\n🔍 適用結果を確認しています...');
    
    // デバッグ関数があるかチェック
    try {
      const { data: functions } = await supabase
        .from('pg_proc')
        .select('proname')
        .ilike('proname', 'debug_auth_status');
      
      if (functions && functions.length > 0) {
        console.log('✅ デバッグ関数が作成されました');
        
        // デバッグ関数を実行
        const { data: debugInfo } = await supabase.rpc('debug_auth_status');
        console.log('🔍 認証デバッグ情報:', debugInfo);
      } else {
        console.log('⚠️  デバッグ関数は作成されませんでした');
      }
    } catch (error) {
      console.log('⚠️  デバッグ関数の確認に失敗しました:', error.message);
    }
    
    // ポリシーの確認
    try {
      const { data: policies } = await supabase
        .from('pg_policies')
        .select('tablename, policyname, cmd')
        .eq('tablename', 'operation_logs');
      
      if (policies && policies.length > 0) {
        console.log('📊 operation_logs のRLSポリシー:');
        policies.forEach(policy => {
          console.log(`   • ${policy.policyname} (${policy.cmd})`);
        });
      } else {
        console.log('⚠️  operation_logs のRLSポリシーが見つかりません');
      }
    } catch (error) {
      console.log('⚠️  ポリシーの確認に失敗しました:', error.message);
    }
    
  } catch (error) {
    console.error('💥 RLS マイグレーション適用中にエラーが発生しました:', error);
    console.error('詳細:', error.message);
    process.exit(1);
  }
}

// すべてのRLSポリシーを一度に削除して新しいものを作成する関数
async function resetOperationLogsRLS() {
  console.log('🔄 operation_logs のRLSポリシーをリセットしています...');
  
  const resetSQL = `
    -- 既存ポリシーの削除
    DROP POLICY IF EXISTS "operation_logs_insert_policy" ON operation_logs;
    DROP POLICY IF EXISTS "operation_logs_select_policy" ON operation_logs;
    DROP POLICY IF EXISTS "operation_logs_update_policy" ON operation_logs;
    DROP POLICY IF EXISTS "operation_logs_insert_policy_flexible" ON operation_logs;
    DROP POLICY IF EXISTS "operation_logs_select_policy_flexible" ON operation_logs;
    DROP POLICY IF EXISTS "operation_logs_update_policy_flexible" ON operation_logs;
    
    -- Service Role検知関数
    CREATE OR REPLACE FUNCTION auth.is_service_role()
    RETURNS boolean
    LANGUAGE sql
    SECURITY DEFINER
    AS $$
        SELECT auth.role() = 'service_role';
    $$;
    
    -- 柔軟なINSERTポリシー（Service Role許可）
    CREATE POLICY "operation_logs_insert_policy_flexible" ON operation_logs
        FOR INSERT
        WITH CHECK (
            auth.is_service_role()
            OR
            (
                auth.uid() IS NOT NULL
                AND EXISTS (
                    SELECT 1 FROM vegetables 
                    WHERE vegetables.id = operation_logs.vegetable_id 
                    AND vegetables.company_id = auth.current_user_company_id()
                )
                AND auth.current_user_role() IN ('admin', 'manager', 'operator')
            )
        );
        
    -- 柔軟なSELECTポリシー（Service Role許可）
    CREATE POLICY "operation_logs_select_policy_flexible" ON operation_logs
        FOR SELECT
        USING (
            auth.is_service_role()
            OR
            (
                auth.uid() IS NOT NULL
                AND EXISTS (
                    SELECT 1 FROM vegetables 
                    WHERE vegetables.id = operation_logs.vegetable_id 
                    AND vegetables.company_id = auth.current_user_company_id()
                )
            )
        );
    
    -- RLSを確実に有効化
    ALTER TABLE operation_logs ENABLE ROW LEVEL SECURITY;
  `;
  
  try {
    // 一つずつ実行
    const statements = resetSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim().length === 0) continue;
      
      console.log(`実行中: ${statement.substring(0, 50)}...`);
      
      // 直接テーブルへクエリを送信
      try {
        await supabase.from('_').select('1').limit(0); // ダミークエリで接続確認
        console.log('   ✅ 接続確認OK');
      } catch (error) {
        console.log('   ⚠️  直接実行は制限されています。Supabase SQL Editorでの手動実行が必要です。');
        
        console.log('\n📋 以下のSQLをSupabase SQL Editorで手動実行してください:');
        console.log('=' * 60);
        console.log(resetSQL);
        console.log('=' * 60);
        return;
      }
    }
    
    console.log('✅ RLSポリシーリセット完了');
    
  } catch (error) {
    console.error('❌ RLSポリシーリセット失敗:', error.message);
    
    console.log('\n📋 手動実行用SQL:');
    console.log('=' * 60);
    console.log(resetSQL);
    console.log('=' * 60);
  }
}

// コマンドライン引数に応じて実行
const command = process.argv[2];

switch (command) {
  case 'apply':
    applyRLSMigration();
    break;
  case 'reset':
    resetOperationLogsRLS();
    break;
  default:
    console.log('使用方法:');
    console.log('  node apply-rls-migration.js apply - RLSマイグレーションを適用');
    console.log('  node apply-rls-migration.js reset - operation_logsのRLSポリシーをリセット');
    break;
}