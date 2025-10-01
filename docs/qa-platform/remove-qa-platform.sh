#!/bin/bash

# Q&Aプラットフォーム自動削除スクリプト (Mac/Linux)
# 実行方法: chmod +x remove-qa-platform.sh && ./remove-qa-platform.sh

echo ""
echo "========================================"
echo -e "\033[36m Q&Aプラットフォーム切り離しツール\033[0m"
echo "========================================"
echo ""

# 安全確認
read -p "Q&Aプラットフォームを完全に削除しますか？ (yes/no): " confirmation
if [ "$confirmation" != "yes" ]; then
    echo -e "\033[33m処理を中止しました。\033[0m"
    exit 1
fi

echo ""
echo -e "\033[33m[Step 1/5] 環境変数の無効化...\033[0m"

# .env.local のバックアップ
if [ -f ".env.local" ]; then
    cp .env.local ".env.local.backup.$(date +%Y%m%d_%H%M%S)"

    # 環境変数の更新
    sed -i.bak 's/^QA_ENABLE_PLATFORM=.*/QA_ENABLE_PLATFORM=false/' .env.local
    sed -i.bak 's/^QA_/# QA_/' .env.local
    rm .env.local.bak

    echo -e "\033[32m✓ 環境変数を無効化しました\033[0m"
fi

echo ""
echo -e "\033[33m[Step 2/5] コードのバックアップ...\033[0m"

# バックアップディレクトリ作成
backup_dir="qa_platform_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$backup_dir"

# コードのバックアップ
dirs_to_backup=(
    "src/app/qa"
    "src/components/qa"
    "src/lib/qa"
    "src/hooks/qa"
    "src/app/api/qa"
    "docs/qa-platform"
)

for dir in "${dirs_to_backup[@]}"; do
    if [ -d "$dir" ]; then
        cp -r "$dir" "$backup_dir/"
        echo -e "\033[32m✓ $dir をバックアップしました\033[0m"
    fi
done

# マイグレーションファイルのバックアップ
if [ -d "supabase/migrations" ]; then
    find supabase/migrations -name "*qa*" -exec cp {} "$backup_dir/" \; 2>/dev/null
fi

echo ""
echo -e "\033[33m[Step 3/5] Q&A関連コードの削除...\033[0m"

# ディレクトリの削除
for dir in "${dirs_to_backup[@]}"; do
    if [ -d "$dir" ]; then
        rm -rf "$dir"
        echo -e "\033[32m✓ $dir を削除しました\033[0m"
    fi
done

# マイグレーションファイルの削除
if [ -d "supabase/migrations" ]; then
    find supabase/migrations -name "*qa*" -exec rm {} \; 2>/dev/null
    echo -e "\033[32m✓ Q&A関連マイグレーションファイルを削除しました\033[0m"
fi

echo ""
echo -e "\033[33m[Step 4/5] データベーススクリプトの生成...\033[0m"

# データベース削除スクリプトの生成
cat > "$backup_dir/remove_qa_database.sql" << 'EOF'
-- Q&Aプラットフォーム データベース削除スクリプト
-- 生成日時: TIMESTAMP_PLACEHOLDER

-- 1. バックアップスキーマの作成
CREATE SCHEMA IF NOT EXISTS qa_backup_DATE_PLACEHOLDER;

-- 2. データのバックアップ
CREATE TABLE qa_backup_DATE_PLACEHOLDER.qa_questions AS SELECT * FROM qa_questions;
CREATE TABLE qa_backup_DATE_PLACEHOLDER.qa_answers AS SELECT * FROM qa_answers;
CREATE TABLE qa_backup_DATE_PLACEHOLDER.qa_user_profiles AS SELECT * FROM qa_user_profiles;
CREATE TABLE qa_backup_DATE_PLACEHOLDER.qa_purchases AS SELECT * FROM qa_purchases;
CREATE TABLE qa_backup_DATE_PLACEHOLDER.qa_wallets AS SELECT * FROM qa_wallets;
CREATE TABLE qa_backup_DATE_PLACEHOLDER.qa_wallet_transactions AS SELECT * FROM qa_wallet_transactions;
CREATE TABLE qa_backup_DATE_PLACEHOLDER.qa_access_grants AS SELECT * FROM qa_access_grants;
CREATE TABLE qa_backup_DATE_PLACEHOLDER.qa_payouts AS SELECT * FROM qa_payouts;
CREATE TABLE qa_backup_DATE_PLACEHOLDER.qa_invoices AS SELECT * FROM qa_invoices;
CREATE TABLE qa_backup_DATE_PLACEHOLDER.qa_notifications AS SELECT * FROM qa_notifications;
CREATE TABLE qa_backup_DATE_PLACEHOLDER.qa_reputation AS SELECT * FROM qa_reputation;
CREATE TABLE qa_backup_DATE_PLACEHOLDER.qa_audit_logs AS SELECT * FROM qa_audit_logs;

-- 3. トリガーの削除
DROP TRIGGER IF EXISTS update_qa_user_profiles_updated_at ON qa_user_profiles;
DROP TRIGGER IF EXISTS update_qa_questions_updated_at ON qa_questions;
DROP TRIGGER IF EXISTS update_qa_answers_updated_at ON qa_answers;
DROP TRIGGER IF EXISTS update_qa_wallets_updated_at ON qa_wallets;

-- 4. 関数の削除
DROP FUNCTION IF EXISTS generate_invoice_no();
DROP FUNCTION IF EXISTS check_question_access(UUID, UUID);
DROP FUNCTION IF EXISTS update_wallet_balance(UUID, DECIMAL, VARCHAR, VARCHAR, UUID, TEXT);

-- 5. ビューの削除
DROP VIEW IF EXISTS qa_questions_summary;
DROP VIEW IF EXISTS qa_user_stats;

-- 6. テーブルの削除
DROP TABLE IF EXISTS qa_audit_logs CASCADE;
DROP TABLE IF EXISTS qa_reputation CASCADE;
DROP TABLE IF EXISTS qa_notifications CASCADE;
DROP TABLE IF EXISTS qa_invoices CASCADE;
DROP TABLE IF EXISTS qa_payouts CASCADE;
DROP TABLE IF EXISTS qa_access_grants CASCADE;
DROP TABLE IF EXISTS qa_wallet_transactions CASCADE;
DROP TABLE IF EXISTS qa_wallets CASCADE;
DROP TABLE IF EXISTS qa_purchases CASCADE;
DROP TABLE IF EXISTS qa_answers CASCADE;
DROP TABLE IF EXISTS qa_questions CASCADE;
DROP TABLE IF EXISTS qa_user_profiles CASCADE;

-- 7. 列挙型の削除
DROP TYPE IF EXISTS qa_question_status CASCADE;
DROP TYPE IF EXISTS qa_answer_status CASCADE;
DROP TYPE IF EXISTS qa_payment_type CASCADE;
DROP TYPE IF EXISTS qa_payout_status CASCADE;
DROP TYPE IF EXISTS qa_access_reason CASCADE;

-- 8. 確認
SELECT 'Q&Aプラットフォームのデータベース削除完了: ' || NOW() as status;
EOF

# プレースホルダーを実際の値に置換
sed -i "" "s/TIMESTAMP_PLACEHOLDER/$(date '+%Y-%m-%d %H:%M:%S')/g" "$backup_dir/remove_qa_database.sql"
sed -i "" "s/DATE_PLACEHOLDER/$(date +%Y%m%d)/g" "$backup_dir/remove_qa_database.sql"

echo -e "\033[32m✓ データベース削除スクリプトを生成しました\033[0m"
echo -e "\033[90m  場所: $backup_dir/remove_qa_database.sql\033[0m"

echo ""
echo -e "\033[33m[Step 5/5] クリーンアップ...\033[0m"

# .nextキャッシュのクリア
if [ -d ".next" ]; then
    rm -rf .next
    echo -e "\033[32m✓ .nextキャッシュをクリアしました\033[0m"
fi

# ログファイルの作成
cat > "$backup_dir/removal_log.txt" << EOF
Q&Aプラットフォーム削除ログ
実行日時: $(date '+%Y-%m-%d %H:%M:%S')
実行者: $USER
バックアップ場所: $backup_dir
削除されたディレクトリ:
EOF

for dir in "${dirs_to_backup[@]}"; do
    echo "  - $dir" >> "$backup_dir/removal_log.txt"
done

echo ""
echo -e "\033[32m========================================"
echo " 削除完了！"
echo "========================================\033[0m"
echo ""
echo -e "\033[36mバックアップ場所: $backup_dir\033[0m"
echo ""
echo -e "\033[33m次のステップ:\033[0m"
echo "1. Supabaseダッシュボードでデータベーススクリプトを実行"
echo -e "\033[90m   $backup_dir/remove_qa_database.sql\033[0m"
echo ""
echo "2. アプリケーションを再起動"
echo -e "\033[90m   npm run build"
echo "   npm run dev\033[0m"
echo ""
echo -e "\033[33m復元が必要な場合:\033[0m"
echo -e "\033[90m  バックアップフォルダ内のファイルを元の場所に戻してください\033[0m"
echo ""

echo -e "\033[32m処理が完了しました。\033[0m"