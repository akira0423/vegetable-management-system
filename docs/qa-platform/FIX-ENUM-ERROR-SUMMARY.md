# ENUM型エラー修正概要

## エラー内容
### 第1のエラー
```
ERROR: 22P02: invalid input value for enum qa_payment_type: "BEST_ANSWER"
ERROR: 22P02: invalid input value for enum qa_payment_type: "PPV_SHARE"
```

### 第2のエラー（修正後に発生）
```
ERROR: 42P01: relation "qa_ppv_access" does not exist
```

### 第3のエラー
```
ERROR: 42P01: relation "qa_wallet_operations" does not exist
```

### 第4のエラー
```
ERROR: 42703: column "is_admin" does not exist
```

## 根本原因分析

### 1. 型の混同
- **qa_payment_type enum**: トランザクションタイプ（ESCROW, PPV, TIP, REFUND, WITHDRAWAL）
- **wallet operation reference_type**: ウォレット操作の参照タイプ（文字列）
  - 'BEST_ANSWER': ベストアンサー報酬
  - 'PPV_REVENUE': PPV収益（質問者の40%）
  - 'PPV_HELD_BEST': PPV保留分（24%）のベストアンサー払い出し
  - 'PPV_POOL': PPVプール分配（16%）

### 2. 設計の整合性
実装ドキュメントと照合した結果：
- `qa_transactions`テーブル: 決済記録（qa_payment_type使用）
- `qa_wallet_operations`テーブル: ウォレット操作履歴（reference_typeは文字列）
- 両者は異なる目的のテーブルで、異なる型体系を使用

### 3. エラー発生箇所
`20250929_profile_and_invoice_enhancements.sql`の`v_public_profile_stats`ビュー：
```sql
-- 誤った実装1
AND t.type IN ('BEST_ANSWER', 'PPV_SHARE')  -- これらはqa_payment_typeに存在しない

-- 誤った実装2
LEFT JOIN qa_ppv_access ppv ON ppv.question_id = q.id  -- qa_ppv_accessテーブルは存在しない
```

### 4. 正しいテーブル構造
実際のスキーマでは：
- PPVアクセス管理は`qa_access_grants`テーブルの`access_type='PPV'`で管理
- `qa_ppv_access`という独立したテーブルは存在しない
- ウォレット取引は`qa_wallet_transactions`テーブル（`qa_wallet_operations`ではない）
- 管理者権限など一部のカラムが`qa_user_profiles`に不足

## 修正内容

### 1. 不足カラム追加マイグレーション
`20250929_add_missing_profile_columns.sql`（新規作成）：
- `is_admin`: 管理者権限フラグ
- `is_public`: プロフィール公開設定
- `is_expert`: 専門家認証フラグ
- `expert_categories`: 専門分野
- `website`, `twitter_handle`, `location`: SNS・場所情報
- `billing_address`: 請求書送付先
- `member_since`: メンバー登録日

### 2. オリジナルマイグレーションファイルの修正
`20250929_profile_and_invoice_enhancements.sql`：
- `v_public_profile_stats`ビューで正しいENUM値を使用
- `t.type IN ('BEST_ANSWER', 'PPV_SHARE')`を削除
- ウォレット残高とトランザクションテーブルから収益を計算
- `t.description`カラムへの参照を削除（存在しないため）
- CASE文で手数料の説明を動的生成
- COALESCE関数で不足カラムへの安全なアクセス

### 3. 修正版マイグレーションファイル
`20250929_fix_profile_stats_enum.sql`：
- ビューを正しく再定義
- `qa_transactions.type`には正しいenum値（ESCROW, PPV）を使用
- `qa_wallet_transactions`テーブルを使用（`qa_wallet_operations`ではない）
- `qa_ppv_access`の代わりに`qa_access_grants`テーブルを使用
- PPV購入者数の計算を修正

### 2. TypeScriptコード修正
- `InvoicePDF.tsx`: 正しい型ラベルに更新
- `invoices/[id]/pdf/route.ts`: テストデータを正しい型で生成
- `invoices/route.ts`: テストデータ生成関数を修正

## 実装ドキュメントとの整合性

### ✅ 確認済み項目
1. **supabase-complete-schema.sql**: qa_payment_type定義と一致
2. **api-specification.md**: APIレスポンスの型定義と一致
3. **IMPLEMENTATION-STATUS.md**: 既存の実装状況と矛盾なし
4. **implementation-plan.md**: 設計思想に準拠

### 設計原則の遵守
- ✅ トランザクション記録とウォレット操作の分離
- ✅ 適切な型使用（ENUMと文字列の使い分け）
- ✅ RLSポリシーへの影響なし
- ✅ 既存データとの互換性維持

## Supabaseで実行するSQL

以下のコマンドを順番に実行してください：

```sql
-- 1. 修正マイグレーションを実行
-- ファイル: supabase/migrations/20250929_fix_profile_stats_enum.sql
-- の内容を実行

-- 2. 動作確認
SELECT * FROM v_public_profile_stats LIMIT 1;
SELECT * FROM v_public_profiles LIMIT 1;
```

## 修正後の動作

### 正しいデータフロー
1. **ベストアンサー選定時**：
   - `qa_transactions`に`type='ESCROW'`で記録
   - `qa_wallet_operations`に`reference_type='BEST_ANSWER'`で記録

2. **PPV購入時**：
   - `qa_transactions`に`type='PPV'`で記録
   - `qa_wallet_operations`に各種reference_typeで分配記録：
     - 'PPV_REVENUE': 質問者の40%
     - 'PPV_HELD_BEST': ベスト保留分24%
     - 'PPV_POOL': その他プール16%

### 請求書生成
- 正しい型（ESCROW, PPV, TIP）のみを使用
- 各手数料を適切に計算・表示

## 今後の推奨事項

1. **型定義の明確化**：
   - TypeScriptで型定義ファイルを作成
   - ENUMと文字列型の使い分けを文書化

2. **テストケース追加**：
   - 請求書生成のテスト
   - プロフィール統計の計算テスト

3. **監視**：
   - エラーログの監視
   - 型不一致の早期発見

## 関連ファイル
- 修正マイグレーション: `supabase/migrations/20250929_fix_profile_stats_enum.sql`
- 修正コンポーネント: `src/components/qa/InvoicePDF.tsx`
- 修正API: `src/app/api/questions/invoices/[id]/pdf/route.ts`
- 修正API: `src/app/api/questions/invoices/route.ts`