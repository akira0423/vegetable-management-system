# Supabase RLS問題分析と解決レポート

## 実施日: 2024年1月21日

## 問題の概要

ログイン後、ガンチャートやデータ分析ページでデータが表示されない問題が発生。

## 根本原因の特定

### 1. RLS（行レベルセキュリティ）の不整合
- **未定義関数への依存**: `is_service_role()` と `get_current_company_id()` が未定義
- **重複・矛盾するポリシー**: 各テーブルに複数の競合するポリシー
- **セキュリティホール**: `users.simple_user_access` が全データアクセスを許可

### 2. company_idの伝播不全
- users.company_id のNOT NULL制約による循環依存
- auth.usersとpublic.usersの同期タイミングのずれ

### 3. Service Role乱用
- RLS回避のためAPIで過度にService Roleクライアントを使用
- 本来不要な権限昇格

## 実施した修正

### Supabase側の修正

#### Step 1: 必須関数の作成
```sql
-- is_service_role() 関数
-- get_current_company_id() 関数
```

#### Step 2: 危険なポリシー削除
- `simple_user_access` (usersテーブル)
- `Allow service role company creation` (companiesテーブル)
- `Allow service role user creation` (usersテーブル)

#### Step 3: 重複ポリシーの整理
各テーブルで重複する以下のポリシーを削除：
- vegetables: 3つ → 1つに統一
- growing_tasks: 3つ → 1つに統一
- work_reports: 3つ → 1つに統一
- companies: 3つ → 1つに統一
- users: 3つ → 残り1つ

#### Step 4: パフォーマンス最適化
5つのインデックスを作成：
- idx_users_auth_lookup
- idx_users_company
- idx_vegetables_company_active
- idx_growing_tasks_company
- idx_work_reports_company_active

#### Step 5: トリガー改善
新規ユーザー登録時の自動プロビジョニングを改善

### アプリケーション側の修正

以下のAPIファイルで `createServiceClient()` を `createClient()` に変更：
- /api/gantt/route.ts
- /api/vegetables/route.ts
- /api/auth/user/route.ts
- /api/auth/ensure-profile/route.ts

## 検証結果

### 修正前の状態
- RLSポリシー総数: 多数の重複
- データアクセス: Service Role依存
- セキュリティ: 脆弱（simple_user_access）

### 修正後の状態
- RLSポリシー総数: 11（整理済み）
- データアクセス: 正常なRLS適用
- セキュリティ: 強化済み
- パフォーマンス: インデックスで最適化

## 残タスク

以下のAPIファイルも同様の修正が必要：
- accounting-items/route.ts
- accounting-recommendations/route.ts
- growing-tasks/route.ts
- migrate-cost-data/route.ts
- pesticide-applications/route.ts
- pesticides/route.ts
- reports/route.ts
- users/route.ts
- weather/route.ts
- work-accounting/route.ts

## 推奨事項

1. **定期的なRLS監査**: 新しいテーブル追加時にポリシー重複を避ける
2. **Service Role最小化**: 管理機能以外では使用しない
3. **インデックス管理**: パフォーマンス監視と最適化
4. **バックアップ**: RLS変更前には必ずバックアップ

## まとめ

RLSの根本的な問題を解決し、データアクセスを正常化。セキュリティとパフォーマンスの両面で改善を実現。