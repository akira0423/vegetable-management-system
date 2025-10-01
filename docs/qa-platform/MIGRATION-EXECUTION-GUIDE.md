# 📋 回答本文分離マイグレーション実行ガイド

## 🎯 概要
`20250928_qa_answer_contents_separation.sql`を実行して、回答本文を分離管理する設計に移行します。

## ✅ 実行可能性

### **一括実行: 可能です**
このSQLスクリプトは以下の条件を満たしているため、**Supabase SQL Editorで一括実行可能**です：

1. **前提条件を満たしている**
   - `20250922_qa_platform_initial.sql`実行済み
   - 既存のqa_answersテーブルが存在

2. **破壊的変更がない**
   - 既存データは保持される
   - 新規テーブル追加のみ
   - 段階的移行を考慮した設計

3. **ロールバック可能**
   - qa_answers.bodyカラムは保持
   - データ移行は可逆的

## 📊 整合性確認

### ドキュメント間の整合性

| ドキュメント | 状態 | 更新内容 |
|-------------|------|----------|
| **supabase-complete-schema.sql** | ✅ 更新済み | qa_answer_contentsテーブル定義追加 |
| **api-specification.md** | ✅ 更新済み | 回答投稿APIに補足追加 |
| **IMPLEMENTATION-STATUS.md** | ✅ 更新済み | 2025-09-28の作業記録追加 |
| **implementation-plan.md** | 🔄 影響なし | 基本設計と矛盾なし |
| **user-journey-guide.md** | 🔄 影響なし | UX変更なし |

### 設計原則との整合性

✅ **完全分離設計を維持**
- 既存システムとの独立性保持
- qa_プレフィックスで名前空間分離

✅ **段階的移行を考慮**
- qa_answers.bodyを一時的に保持
- 既存APIとの互換性維持可能

✅ **RLS制御の強化**
- 回答者は自分の回答本文のみ閲覧
- 質問者・PPV購入者は全回答閲覧可能

## 🚀 実行手順

### 1. バックアップ（推奨）
```sql
-- Supabase Dashboard > Database > Backups
-- 手動バックアップを作成
```

### 2. マイグレーション実行
```sql
-- Supabase SQL Editorで以下のファイルを実行
-- ファイル: supabase/migrations/20250928_qa_answer_contents_separation.sql
-- 全内容をコピーして実行
```

### 3. 実行確認
```sql
-- 実行後の確認クエリ
SELECT
    COUNT(*) as total_answers,
    COUNT(DISTINCT ac.answer_id) as migrated_contents,
    COUNT(*) - COUNT(DISTINCT ac.answer_id) as missing_contents
FROM qa_answers a
LEFT JOIN qa_answer_contents ac ON ac.answer_id = a.id;

-- RLSポリシー確認
SELECT policyname FROM pg_policies
WHERE tablename = 'qa_answer_contents'
ORDER BY policyname;
```

## 📝 実行後の対応

### APIの更新が必要な箇所

#### 1. 回答投稿 (`POST /qa/answers`)
```typescript
// 変更前
await supabase.from('qa_answers').insert({
  body: requestBody.body,
  // ...
});

// 変更後
const { data: answer } = await supabase.from('qa_answers').insert({
  body_preview: requestBody.body.substring(0, 200),
  // ...
});

await supabase.from('qa_answer_contents').insert({
  answer_id: answer.id,
  body: requestBody.body
});
```

#### 2. 回答取得（権限に応じた処理）
```typescript
// メタデータは全員取得可能
const { data: answers } = await supabase
  .from('qa_answers')
  .select('*');

// 本文は権限者のみ
const { data: contents } = await supabase
  .from('qa_answer_contents')
  .select('*')
  .in('answer_id', answerIds);
```

## ⚠️ 注意事項

1. **開発環境での動作確認**
   - 開発環境で先に実行を推奨
   - RLSが正しく動作するか確認

2. **段階的な移行**
   - 当面はqa_answers.bodyも維持
   - APIとUIの更新後に削除予定

3. **パフォーマンス監視**
   - JOINが増えるため初期は監視強化
   - 必要に応じてインデックス追加

## 🔍 影響範囲

### 影響を受ける機能
- ✅ 回答投稿機能
- ✅ 回答閲覧機能
- ✅ PPV購入後の全文表示

### 影響を受けない機能
- ❌ 質問投稿・閲覧
- ❌ 検索・フィルタリング
- ❌ 決済処理

## 📊 期待される効果

1. **セキュリティ向上**
   - 回答本文の厳格な可視性制御
   - 意図しない情報漏洩の防止

2. **スケーラビリティ**
   - 本文とメタデータの分離
   - 将来的な最適化が容易

3. **保守性向上**
   - RLSロジックの明確化
   - テーブル責務の単一化