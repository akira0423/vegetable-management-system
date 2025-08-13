# 本番リリース前チェックリスト

## 🚨 重要：テスト用実装の削除・変更が必要

### 1. 認証システムの実装
- [ ] テスト用ダミーユーザー作成機能を削除
- [ ] 実際のユーザー認証フロー実装
- [ ] セッション管理実装
- [ ] パスワードリセット機能
- [ ] ユーザー登録フロー

### 2. セキュリティ強化
- [ ] RLSポリシーを通常のclientで使用するよう変更
- [ ] Service role keyの使用を管理機能のみに限定
- [ ] API認証ミドルウェア実装
- [ ] CORS設定の厳格化
- [ ] 入力値バリデーション強化

### 3. データベース設定
- [ ] テスト用マイグレーション（007_disable_rls_for_testing.sql）の削除
- [ ] 適切なRLSポリシーの設定
- [ ] バックアップ設定
- [ ] インデックス最適化

### 4. 環境変数・設定
- [ ] 本番用環境変数の設定
- [ ] Supabase本番プロジェクトへの切り替え
- [ ] ログレベルの調整
- [ ] エラー処理の本番向け調整

### 5. テスト・品質管理
- [ ] E2Eテストの実装
- [ ] 負荷テストの実行
- [ ] セキュリティテストの実行
- [ ] 認証フローのテスト

### 6. 監視・運用
- [ ] エラー監視設定
- [ ] パフォーマンス監視
- [ ] ヘルスチェックAPI実装
- [ ] アラート設定

## 📝 現在のテスト用コードの場所

### APIファイル
- `src/app/api/reports/route.ts` - ダミーユーザー作成ロジック
- `src/lib/supabase/server.ts` - Service role client使用

### テストファイル（削除対象）
- `test-report.js`
- `test-users.js` 
- `create-test-user.js`
- `check-vegetables.js`
- `apply-migration.js`
- `fix-db-constraints.js`

### マイグレーションファイル（要検討）
- `supabase/migrations/007_disable_rls_for_testing.sql`
- `supabase/migrations/008_make_created_by_nullable.sql`

## ⚡ 緊急度：高
これらの修正なしに本番リリースを行うと、**重大なセキュリティリスク**があります。