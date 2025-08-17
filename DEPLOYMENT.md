# 本番環境デプロイメントガイド

## 🚀 Vercel環境変数設定

### 必須環境変数
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI
OPENAI_API_KEY=sk-your_production_key

# NextAuth
NEXTAUTH_SECRET=your_production_secret
NEXTAUTH_URL=https://your-domain.vercel.app

# App設定
NODE_ENV=production
```

## 🔒 セキュリティチェックリスト

### デプロイ前確認事項
- [ ] `.env.local`に実際のキーが含まれていないこと
- [ ] `dev-login`が本番で無効化されていること
- [ ] 開発用スクリプトファイルが削除されていること
- [ ] ログ出力に機密情報が含まれていないこと
- [ ] Supabase RLSが適切に設定されていること

### Supabase本番設定
1. 本番用Supabaseプロジェクト作成
2. RLSポリシーの設定
3. 認証設定の確認
4. データベーススキーマの適用

### ドメイン設定
1. Vercelでカスタムドメイン設定
2. SSL証明書の確認
3. リダイレクト設定

## 📊 監視設定

### エラー追跡
- Vercel Analytics有効化
- エラーログ監視設定

### パフォーマンス監視
- Core Web Vitals確認
- 応答時間監視

## 🔄 デプロイ手順

1. `git push origin main`
2. Vercel自動デプロイ確認
3. 本番環境動作確認
4. ユーザー受け入れテスト

## ⚠️ 注意事項

- 開発用機能は本番で絶対に使用しない
- 機密情報は環境変数でのみ管理
- 定期的なセキュリティ監査実施