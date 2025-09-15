/**
 * Supabase自動バックアップスクリプト
 * Node.jsで実行してデータベースを自動バックアップ
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

// 環境変数から設定を読み込み
require('dotenv').config({ path: '../../.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase環境変数が設定されていません');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// バックアップ先ディレクトリ
const BACKUP_DIR = path.join(__dirname, `backup_${new Date().toISOString().split('T')[0]}`);

/**
 * テーブルデータをバックアップ
 */
async function backupTable(tableName) {
  try {
    console.log(`📊 ${tableName} テーブルをバックアップ中...`);

    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error(`❌ ${tableName} のバックアップ失敗:`, error);
      return false;
    }

    // JSONファイルとして保存
    const filePath = path.join(BACKUP_DIR, `${tableName}.json`);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));

    console.log(`✅ ${tableName}: ${data.length}件のレコードを保存`);
    return true;
  } catch (error) {
    console.error(`❌ ${tableName} の処理中にエラー:`, error);
    return false;
  }
}

/**
 * メインバックアップ処理
 */
async function main() {
  console.log('🚀 Supabaseデータベースバックアップを開始します');
  console.log(`📁 バックアップ先: ${BACKUP_DIR}`);

  // バックアップディレクトリを作成
  await fs.mkdir(BACKUP_DIR, { recursive: true });

  // バックアップするテーブルのリスト
  const tables = [
    'companies',
    'users',
    'vegetables',
    'plots',
    'tasks',
    'work_reports',
    'work_accounting',
    'work_accounting_items',
    'work_report_comments',
    'work_report_images',
    'notifications'
  ];

  // 各テーブルをバックアップ
  const results = [];
  for (const table of tables) {
    const success = await backupTable(table);
    results.push({ table, success });
  }

  // バックアップメタデータを作成
  const metadata = {
    backup_date: new Date().toISOString(),
    supabase_url: supabaseUrl,
    tables_backed_up: results.filter(r => r.success).map(r => r.table),
    tables_failed: results.filter(r => !r.success).map(r => r.table),
    total_tables: tables.length,
    successful_backups: results.filter(r => r.success).length
  };

  // メタデータを保存
  await fs.writeFile(
    path.join(BACKUP_DIR, '_metadata.json'),
    JSON.stringify(metadata, null, 2)
  );

  // 結果サマリー
  console.log('\n📋 バックアップ完了サマリー:');
  console.log(`✅ 成功: ${metadata.successful_backups}/${metadata.total_tables} テーブル`);
  if (metadata.tables_failed.length > 0) {
    console.log(`❌ 失敗: ${metadata.tables_failed.join(', ')}`);
  }
  console.log(`📁 保存先: ${BACKUP_DIR}`);

  // リストアスクリプトを生成
  await generateRestoreScript();
}

/**
 * リストアスクリプトを生成
 */
async function generateRestoreScript() {
  const restoreScript = `
/**
 * データリストアスクリプト
 * バックアップからデータを復元
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

const supabaseUrl = '${supabaseUrl}';
const supabaseAnonKey = 'YOUR_ANON_KEY_HERE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const BACKUP_DIR = __dirname;

async function restoreTable(tableName) {
  try {
    const data = JSON.parse(
      await fs.readFile(path.join(BACKUP_DIR, \`\${tableName}.json\`), 'utf8')
    );

    if (data.length === 0) {
      console.log(\`⏭️ \${tableName}: データなし\`);
      return true;
    }

    const { error } = await supabase
      .from(tableName)
      .insert(data);

    if (error) {
      console.error(\`❌ \${tableName} の復元失敗:\`, error);
      return false;
    }

    console.log(\`✅ \${tableName}: \${data.length}件のレコードを復元\`);
    return true;
  } catch (error) {
    console.error(\`❌ \${tableName} の処理中にエラー:\`, error);
    return false;
  }
}

async function main() {
  console.log('🔄 データベースリストアを開始します');

  const metadata = JSON.parse(
    await fs.readFile(path.join(BACKUP_DIR, '_metadata.json'), 'utf8')
  );

  console.log(\`📅 バックアップ日時: \${metadata.backup_date}\`);
  console.log(\`📊 テーブル数: \${metadata.tables_backed_up.length}\`);

  // 各テーブルを復元（依存関係の順序で）
  const tables = [
    'companies',
    'users',
    'vegetables',
    'plots',
    'tasks',
    'work_reports',
    'work_accounting',
    'work_accounting_items',
    'work_report_comments',
    'work_report_images',
    'notifications'
  ];

  for (const table of tables) {
    if (metadata.tables_backed_up.includes(table)) {
      await restoreTable(table);
    }
  }

  console.log('✨ リストア完了');
}

main().catch(console.error);
`;

  await fs.writeFile(
    path.join(BACKUP_DIR, 'restore.js'),
    restoreScript
  );

  console.log('📝 リストアスクリプトを生成しました: restore.js');
}

// 実行
main().catch(console.error);