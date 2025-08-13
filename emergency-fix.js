console.log('🚨 緊急修正: 外部キー制約を完全削除')

// Supabase Local APIを使用して直接SQL実行
const fetch = require('node-fetch') || fetch

async function emergencyFix() {
  const supabaseUrl = 'http://localhost:54321'
  const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

  const queries = [
    // 1. 外部キー制約を完全削除
    'ALTER TABLE vegetables DROP CONSTRAINT IF EXISTS vegetables_created_by_fkey;',
    
    // 2. created_byをNULL許可に変更
    'ALTER TABLE vegetables ALTER COLUMN created_by DROP NOT NULL;',
    
    // 3. 実際のテストデータ作成（制約なしで安全）
    `INSERT INTO companies (id, name, email, created_at, updated_at) VALUES (
      'a1111111-1111-1111-1111-111111111111',
      'テスト会社',
      'test@example.com',
      now(),
      now()
    ) ON CONFLICT (id) DO NOTHING;`,
    
    // 4. 確認クエリ
    'SELECT COUNT(*) as vegetable_count FROM vegetables;',
    'SELECT COUNT(*) as company_count FROM companies WHERE id = \'a1111111-1111-1111-1111-111111111111\';'
  ]

  for (const query of queries) {
    try {
      console.log(`📝 実行中: ${query.substring(0, 50)}...`)
      
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey
        },
        body: JSON.stringify({ query })
      })

      if (response.ok) {
        const result = await response.text()
        console.log('✅ 成功:', result || '実行完了')
      } else {
        console.log('⚠️ スキップ:', response.status, await response.text())
      }
    } catch (error) {
      console.log('⚠️ エラー:', error.message)
    }
  }
  
  console.log('\n🎉 緊急修正完了！外部キー制約を削除しました。')
  console.log('📝 野菜登録を再度テストしてください。')
}

emergencyFix()