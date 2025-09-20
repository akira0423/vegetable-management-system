const fs = require('fs');
const path = require('path');

// 本番環境用のロガーに置換するスクリプト
// 実行前に必ずバックアップを取ってください

const isDryRun = process.argv.includes('--dry-run');
const isProduction = process.argv.includes('--production');

const logMessage = isDryRun ?
  '🔍 DRY RUN MODE - 変更をシミュレートしています...' :
  '⚠️  実際にファイルを変更します...';

console.log(logMessage);

let totalFiles = 0;
let modifiedFiles = 0;
let totalReplacements = 0;

// スキップするディレクトリ
const skipDirs = ['node_modules', '.next', '.git', 'dist', 'build'];

// console.logを残すファイル（設定ファイルなど）
const skipFiles = [
  'next.config.js',
  'postcss.config.js',
  'tailwind.config.js',
  '.eslintrc.js',
  'remove-console-logs.js'
];

function shouldSkipFile(filePath) {
  const fileName = path.basename(filePath);
  return skipFiles.includes(fileName);
}

function processFile(filePath) {
  if (shouldSkipFile(filePath)) {
    return;
  }

  const ext = path.extname(filePath);
  if (!['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
    return;
  }

  totalFiles++;

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // console.* を削除またはコメントアウト
    const patterns = [
      // console.log, console.error, console.warn を削除
      /console\.(log|error|warn|info|debug)\([^)]*\);?/g,
      // 複数行のconsole.logも対応
      /console\.(log|error|warn|info|debug)\([^)]*\n[^)]*\);?/g
    ];

    let replacements = 0;
    patterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        replacements += matches.length;
        if (isProduction) {
          // 本番環境では完全削除
          content = content.replace(pattern, '');
        } else {
          // 開発環境ではコメントアウト
          content = content.replace(pattern, (match) => `// [REMOVED] ${match}`);
        }
      }
    });

    if (replacements > 0 && content !== originalContent) {
      modifiedFiles++;
      totalReplacements += replacements;

      if (!isDryRun) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ 修正: ${filePath} (${replacements}箇所)`);
      } else {
        console.log(`🔍 変更予定: ${filePath} (${replacements}箇所)`);
      }
    }
  } catch (error) {
    console.error(`❌ エラー: ${filePath}`, error.message);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (!skipDirs.includes(file)) {
        walkDir(filePath);
      }
    } else {
      processFile(filePath);
    }
  });
}

// srcディレクトリを処理
const srcPath = path.join(__dirname, '..', 'src');
if (fs.existsSync(srcPath)) {
  console.log(`📁 処理対象: ${srcPath}`);
  walkDir(srcPath);
}

// 結果を表示
console.log('\n📊 処理結果:');
console.log(`  総ファイル数: ${totalFiles}`);
console.log(`  修正ファイル数: ${modifiedFiles}`);
console.log(`  置換箇所: ${totalReplacements}`);

if (isDryRun) {
  console.log('\n💡 実際に変更を適用するには、--dry-runオプションを外して実行してください');
  console.log('   例: node scripts/remove-console-logs.js');
}

console.log('\n⚠️  重要: ');
console.log('  1. 変更前に必ずgit commitでバックアップを取ってください');
console.log('  2. 変更後は必ず動作確認を行ってください');
console.log('  3. 本番環境では --production オプションを使用してください');