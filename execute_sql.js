// SQLファイルを実行
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const supabaseUrl = 'https://rsofuafiacwygmfkcrrk.supabase.co'
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzb2Z1YWZpYWN3eWdtZmtjcnJrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY5MzIyOSwiZXhwIjoyMDcwMjY5MjI5fQ.CGVm-_sIw8_-zkFBRxBm9V2MNPidd98X4dMrur-FQMw'

const supabase = createClient(supabaseUrl, serviceKey)

async function executeSQLFile(filename) {
  try {
    const sqlContent = fs.readFileSync(filename, 'utf8')
    const sqlCommands = sqlContent.split(';').filter(cmd => cmd.trim() && !cmd.trim().startsWith('--'))
    
    console.log(`📝 ${filename} を実行中...`)
    
    for (const command of sqlCommands) {
      if (command.trim()) {
        try {
          if (command.includes('ALTER TABLE') || command.includes('DROP POLICY')) {
            // PostgreSQL直接実行が必要なコマンド
            console.log(`⚙️  実行: ${command.trim().substring(0, 50)}...`)
            await supabase.rpc('exec_sql', { sql: command.trim() })
          } else if (command.includes('SELECT')) {
            // SELECT文は通常のクエリとして実行
            const { data, error } = await supabase.from('dummy').select(command.trim())
            if (data) console.log(data)
          }
        } catch (error) {
          console.log(`⚠️  コマンド実行中にエラー: ${error.message}`)
        }
      }
    }
    
    console.log('✅ SQL実行完了')
    
  } catch (error) {
    console.error('❌ SQLファイル実行エラー:', error.message)
  }
}

// RLS無効化を実行
executeSQLFile('disable_rls_temporarily.sql')