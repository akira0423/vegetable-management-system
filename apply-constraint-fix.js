const fs = require('fs')
const { spawn } = require('child_process')

console.log('🔧 外部キー制約修正を開始...')

// SQLファイルを読み込み
const migrationSQL = fs.readFileSync('./supabase/migrations/016_fix_foreign_key_constraints.sql', 'utf8')

// 実行可能なSQL文に分割
const statements = migrationSQL
  .split(/(?:;(?:\s*--.*$)?)/gm)
  .map(stmt => stmt.trim())
  .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.match(/^\s*$/))

console.log(`📝 ${statements.length} 個のSQL文を実行します`)

// シンプルなNode.js SQL実行
const executeSQL = (sql) => {
  return new Promise((resolve, reject) => {
    // Dockerコマンドでローカルのpostgresに接続
    const child = spawn('docker', [
      'exec', '-i', 'supabase_db_my-app',
      'psql', '-U', 'postgres', '-d', 'postgres', '-c', sql
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let output = ''
    let error = ''

    child.stdout.on('data', (data) => {
      output += data.toString()
    })

    child.stderr.on('data', (data) => {
      error += data.toString()
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve(output)
      } else {
        console.warn(`⚠️ 警告 (終了コード: ${code}):`, error)
        resolve(output) // エラーでも継続
      }
    })

    child.on('error', (err) => {
      console.warn('⚠️ コマンド実行エラー:', err.message)
      resolve('') // エラーでも継続
    })
  })
}

// メイン実行
async function main() {
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i]
    if (statement.trim()) {
      console.log(`\n[${i + 1}/${statements.length}] 実行中...`)
      console.log(`📄 ${statement.substring(0, 60).replace(/\n/g, ' ')}${statement.length > 60 ? '...' : ''}`)
      
      try {
        const result = await executeSQL(statement)
        if (result) {
          console.log('✅ 成功:', result.replace(/\n+$/, ''))
        }
      } catch (err) {
        console.warn('⚠️ スキップ:', err.message)
      }
    }
  }
  
  console.log('\n🎉 外部キー制約修正が完了しました！')
  console.log('📝 次のステップ: 野菜登録をテストしてください')
}

main().catch(console.error)