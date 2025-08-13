const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

// Supabase設定（ローカル環境）
const supabaseUrl = 'http://localhost:54321'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

async function applyDataIntegrityFix() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    console.log('🔧 データ整合性修正を開始...')
    
    // マイグレーションSQLを読み込み
    const migrationSQL = fs.readFileSync('./supabase/migrations/015_comprehensive_data_integrity_fix.sql', 'utf8')
    
    // SQLを実行（複数ステートメント対応）
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`📝 実行中: ${statement.substring(0, 60)}...`)
        const { error } = await supabase.rpc('exec_sql', { sql: statement })
        if (error && !error.message.includes('already exists')) {
          console.warn('⚠️ 警告:', error.message)
        }
      }
    }
    
    // データ整合性の検証
    console.log('\n✅ データ整合性チェック:')
    
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('id', '11111111-1111-1111-1111-111111111111')
    
    console.log('👤 テストユーザー:', users)
    
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', 'a1111111-1111-1111-1111-111111111111')
    
    console.log('🏢 テスト会社:', companies)
    
    const { data: vegetables } = await supabase
      .from('vegetables')
      .select('id, name, created_by')
      .limit(3)
    
    console.log('🥕 テスト野菜:', vegetables)
    
    console.log('\n🎉 データ整合性修正が完了しました！')
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error)
    process.exit(1)
  }
}

applyDataIntegrityFix()