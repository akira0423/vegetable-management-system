# Q&Aプラットフォーム デプロイメントガイド

## 目次
1. [事前準備](#事前準備)
2. [環境設定](#環境設定)
3. [データベース設定](#データベース設定)
4. [Stripe設定](#stripe設定)
5. [デプロイ手順](#デプロイ手順)
6. [動作確認](#動作確認)
7. [トラブルシューティング](#トラブルシューティング)

## 事前準備

### 必要なアカウント
- Supabaseアカウント（データベース用）
- Stripeアカウント（決済処理用）
- Upstash Redisアカウント（レート制限用）※オプション
- Vercelアカウント（ホスティング用）※Vercelを使用する場合

### 必要なツール
- Node.js 18以上
- npm または yarn
- Supabase CLI
- Git

## 環境設定

### 1. 環境変数の設定

`.env.production.example`を`.env.production`にコピーして、各値を設定します：

```bash
cp .env.production.example .env.production
```

### 2. 必須環境変数

#### Supabase
- `NEXT_PUBLIC_SUPABASE_URL`: プロジェクトURL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: 匿名キー
- `SUPABASE_SERVICE_ROLE_KEY`: サービスロールキー（管理者権限）

#### Stripe
- `STRIPE_SECRET_KEY`: 本番用シークレットキー（sk_live_...）
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: 本番用公開可能キー（pk_live_...）
- `STRIPE_WEBHOOK_SECRET`: Webhookシークレット
- `STRIPE_CONNECT_CLIENT_ID`: Connect用クライアントID

#### アプリケーション
- `NEXT_PUBLIC_APP_URL`: 本番環境のURL（例：https://yourdomain.com）
- `NODE_ENV`: production

## データベース設定

### 1. Supabaseプロジェクトの作成

1. [Supabase Dashboard](https://app.supabase.com)にログイン
2. 新しいプロジェクトを作成
3. プロジェクトURLとキーを取得

### 2. マイグレーションの実行

```bash
# Supabase CLIでログイン
npx supabase login

# プロジェクトをリンク
npx supabase link --project-ref your-project-ref

# マイグレーションを実行
npx supabase db push
```

### 3. RLS（Row Level Security）の確認

Supabase Dashboardで以下を確認：
- すべてのqa_テーブルでRLSが有効になっていること
- 適切なポリシーが設定されていること

## Stripe設定

### 1. Stripe Connectの設定

1. [Stripe Dashboard](https://dashboard.stripe.com)にログイン
2. 「Connect」セクションに移動
3. プラットフォーム設定を完了
4. OAuth設定でリダイレクトURIを追加：
   ```
   https://yourdomain.com/api/qa/connect/callback
   ```

### 2. Webhookエンドポイントの設定

1. Stripe Dashboard > 開発者 > Webhooks
2. エンドポイントを追加：
   ```
   https://yourdomain.com/api/qa/webhooks/stripe
   ```
3. 以下のイベントを選択：
   - `payment_intent.succeeded`
   - `payment_intent.canceled`
   - `payment_intent.payment_failed`
   - `charge.succeeded`
   - `transfer.created`
   - `transfer.failed`
   - `payout.created`
   - `payout.failed`
   - `payout.paid`

### 3. 本番環境への切り替え

- テストキーから本番キーに切り替え
- すべての環境変数を本番用に更新

## デプロイ手順

### Vercelへのデプロイ

1. プロジェクトをGitHubにプッシュ

2. Vercelでプロジェクトをインポート：
   ```bash
   vercel
   ```

3. 環境変数を設定（Vercel Dashboard）

4. デプロイを実行：
   ```bash
   vercel --prod
   ```

### 手動デプロイ

1. デプロイスクリプトを実行：
   ```bash
   chmod +x scripts/deploy-qa-platform.sh
   ./scripts/deploy-qa-platform.sh
   ```

2. または手動で：
   ```bash
   # ビルド
   npm run build
   
   # テスト実行
   npm run test
   
   # 本番環境起動
   npm run start
   ```

## 動作確認

### 1. 基本機能の確認

- [ ] トップページ（/qa）が表示される
- [ ] ユーザー登録・ログインができる
- [ ] 質問投稿ができる
- [ ] 回答投稿ができる

### 2. 決済機能の確認

- [ ] Stripe Connectでアカウント接続ができる
- [ ] エスクロー決済（質問投稿時）が動作する
- [ ] PPV購入が動作する
- [ ] 出金申請が動作する

### 3. 管理機能の確認

- [ ] 管理ダッシュボード（/qa/admin）にアクセスできる
- [ ] 統計情報が正しく表示される
- [ ] PPVプール分配が動作する

### 4. セキュリティの確認

- [ ] レート制限が動作している
- [ ] 未認証ユーザーが保護されたAPIにアクセスできない
- [ ] RLSポリシーが正しく動作している

## トラブルシューティング

### よくある問題と解決方法

#### 1. データベース接続エラー
```
Error: Failed to connect to database
```
**解決方法**: 
- Supabaseプロジェクトが起動していることを確認
- 環境変数が正しく設定されていることを確認
- ファイアウォール設定を確認

#### 2. Stripe決済エラー
```
Error: No such payment_intent
```
**解決方法**:
- Stripeキーが本番用になっていることを確認
- Webhookシークレットが正しいことを確認
- Stripe Dashboardでエラーログを確認

#### 3. レート制限エラー
```
Error: Too many requests
```
**解決方法**:
- Redis接続を確認（オプション）
- レート制限の設定を調整
- `/lib/qa/middleware/rate-limit.ts`の設定を確認

#### 4. 認証エラー
```
Error: Invalid authentication credentials
```
**解決方法**:
- Supabaseのサービスロールキーを確認
- JWTシークレットが正しいことを確認
- RLSポリシーを確認

### ログの確認

#### Vercelの場合
```bash
vercel logs --follow
```

#### サーバーログ
```bash
tail -f logs/qa-platform.log
```

#### Supabaseログ
Supabase Dashboard > Logs で確認

#### Stripeログ
Stripe Dashboard > 開発者 > ログ で確認

## メンテナンス

### データベースバックアップ

```bash
# バックアップ作成
npx supabase db dump -f backup.sql

# リストア
psql $DATABASE_URL < backup.sql
```

### 監視設定

1. **エラー監視**（Sentry推奨）
   - エラー率の監視
   - パフォーマンス監視

2. **アップタイム監視**
   - エンドポイントの死活監視
   - レスポンスタイムの監視

3. **アラート設定**
   - 決済エラー時の通知
   - システムダウン時の通知
   - 異常なトラフィックの検知

## セキュリティチェックリスト

- [ ] 本番環境で`NODE_ENV=production`が設定されている
- [ ] すべてのAPIキーが本番用になっている
- [ ] HTTPSが有効になっている
- [ ] CSRFトークンが設定されている
- [ ] レート制限が有効になっている
- [ ] エラーメッセージに機密情報が含まれていない
- [ ] ログに個人情報やAPIキーが記録されていない
- [ ] 定期的なセキュリティアップデートを行う体制がある

## サポート

問題が解決しない場合は、以下の情報を添えて開発チームに連絡してください：

1. エラーメッセージの全文
2. 実行した操作の手順
3. 環境情報（OS、Node.jsバージョンなど）
4. 関連するログファイル

---

最終更新: 2025年9月23日