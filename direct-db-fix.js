const { Client } = require('pg')

async function fixDatabaseDirectly() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'your_password' // 実際のパスワードに変更
  })

  try {
    await client.connect()
    console.log('🔗 データベースに接続しました')

    // 1. テスト会社の作成/更新
    console.log('📝 テスト会社を作成中...')
    await client.query(`
      INSERT INTO companies (id, name, email, phone, address, prefecture, industry, description, created_at, updated_at)
      VALUES (
        'a1111111-1111-1111-1111-111111111111',
        '株式会社グリーンファーム',
        'info@greenfarm.example.com',
        '03-1234-5678',
        '東京都港区虎ノ門1-1-1',
        '東京都',
        'agriculture',
        'テスト用農業会社',
        now(),
        now()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        updated_at = now()
    `)

    // 2. テストユーザーの作成/更新
    console.log('👤 テストユーザーを作成中...')
    await client.query(`
      INSERT INTO users (id, company_id, email, full_name, role, created_at, updated_at)
      VALUES (
        '11111111-1111-1111-1111-111111111111',
        'a1111111-1111-1111-1111-111111111111',
        'test-admin@greenfarm.example.com',
        'テスト管理者',
        'admin',
        now(),
        now()
      )
      ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        updated_at = now()
    `)

    // 3. 整合性確認
    console.log('✅ データ整合性確認中...')
    const userResult = await client.query('SELECT id, full_name FROM users WHERE id = $1', ['11111111-1111-1111-1111-111111111111'])
    const companyResult = await client.query('SELECT id, name FROM companies WHERE id = $1', ['a1111111-1111-1111-1111-111111111111'])
    
    console.log('👤 テストユーザー:', userResult.rows)
    console.log('🏢 テスト会社:', companyResult.rows)

    console.log('🎉 データ修正が完了しました！')
    
  } catch (error) {
    console.error('❌ エラー:', error.message)
  } finally {
    await client.end()
  }
}

fixDatabaseDirectly()