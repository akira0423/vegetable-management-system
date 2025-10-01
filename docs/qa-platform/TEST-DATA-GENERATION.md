# Q&Aプラットフォーム - テストデータ生成ガイド

## 📌 重要な注意事項

各関数の正しいパラメータ型を使用する必要があります。型の不一致はエラーの原因になります。

## 1. 関数のシグネチャ確認

### 現在利用可能な関数と正しいパラメータ

```sql
-- 関数のシグネチャを確認
SELECT
    routine_name,
    parameter_name,
    data_type,
    parameter_mode,
    ordinal_position
FROM information_schema.parameters
WHERE routine_name IN ('build_invoice_line_items', 'generate_monthly_invoices_improved', 'generate_invoice_number')
ORDER BY routine_name, ordinal_position;
```

### 各関数の正しい使用方法

#### 1. `generate_monthly_invoices_improved`
```sql
-- パラメータ: p_year INTEGER, p_month INTEGER
-- 例: 2025年9月の請求書を生成
SELECT generate_monthly_invoices_improved(2025, 9);

-- 前月の請求書を自動生成（パラメータなし）
SELECT generate_monthly_invoices_improved();

-- 現在月の請求書を生成
SELECT generate_monthly_invoices_improved(
    EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
    EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER
);
```

#### 2. `build_invoice_line_items`
```sql
-- パラメータ: p_recipient_id UUID, p_start_date DATE, p_end_date DATE
-- 例: 特定ユーザーの請求明細を生成
SELECT build_invoice_line_items(
    '2f4781b5-7a5d-494e-a144-25a0854a5ea0'::UUID,  -- ユーザーID
    '2025-09-01'::DATE,                             -- 開始日
    '2025-09-30'::DATE                              -- 終了日
);
```

#### 3. `generate_invoice_number`
```sql
-- パラメータなし
-- 例: 新しい請求書番号を生成
SELECT generate_invoice_number();
```

## 2. テストデータ生成スクリプト

### 基本的なテストデータセット

```sql
-- ========================================
-- STEP 1: テストユーザーの確認/作成
-- ========================================
DO $$
DECLARE
    v_test_user_id UUID;
BEGIN
    -- テストユーザーの確認
    SELECT user_id INTO v_test_user_id
    FROM qa_user_profiles
    WHERE display_name = '開発テストユーザー'
    LIMIT 1;

    IF v_test_user_id IS NULL THEN
        RAISE NOTICE 'テストユーザーが存在しません。作成が必要です。';
    ELSE
        RAISE NOTICE 'テストユーザーID: %', v_test_user_id;
    END IF;
END $$;

-- ========================================
-- STEP 2: テストトランザクションの作成
-- ========================================
-- ESCROWトランザクション（ベストアンサー報酬）
INSERT INTO qa_transactions (
    user_id,
    question_id,
    answer_id,
    type,
    status,
    amount,
    platform_fee,
    split_to_responder,
    created_at
)
SELECT
    (SELECT user_id FROM qa_user_profiles LIMIT 1),
    gen_random_uuid(),
    gen_random_uuid(),
    'ESCROW',
    'COMPLETED',
    10000,
    2000,  -- 20%の手数料
    8000,  -- 80%が回答者へ
    CURRENT_DATE - INTERVAL '10 days'
WHERE NOT EXISTS (
    SELECT 1 FROM qa_transactions WHERE type = 'ESCROW' LIMIT 1
);

-- PPVトランザクション
INSERT INTO qa_transactions (
    user_id,
    question_id,
    type,
    status,
    amount,
    platform_fee,
    split_to_asker,
    created_at
)
SELECT
    (SELECT user_id FROM qa_user_profiles LIMIT 1),
    gen_random_uuid(),
    'PPV',
    'COMPLETED',
    5000,
    1000,  -- 20%の手数料
    2000,  -- 40%が質問者へ
    CURRENT_DATE - INTERVAL '5 days'
WHERE NOT EXISTS (
    SELECT 1 FROM qa_transactions WHERE type = 'PPV' LIMIT 1
);

-- ========================================
-- STEP 3: 請求書の生成
-- ========================================
-- 現在月の請求書を生成
SELECT generate_monthly_invoices_improved(
    EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
    EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER
);

-- 生成された請求書を確認
SELECT
    invoice_number,
    period_start,
    period_end,
    subtotal,
    tax_amount,
    total_amount,
    status
FROM qa_invoices
ORDER BY created_at DESC
LIMIT 5;
```

### 高度なテストシナリオ

```sql
-- ========================================
-- シナリオ1: 複数月のデータ生成
-- ========================================
DO $$
DECLARE
    v_month INTEGER;
    v_year INTEGER;
BEGIN
    v_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;

    -- 過去3ヶ月分の請求書を生成
    FOR v_month IN 1..3 LOOP
        PERFORM generate_monthly_invoices_improved(
            v_year,
            EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER - v_month
        );
    END LOOP;

    RAISE NOTICE '過去3ヶ月分の請求書生成が完了しました';
END $$;

-- ========================================
-- シナリオ2: 特定ユーザーの請求明細確認
-- ========================================
WITH user_invoices AS (
    SELECT
        u.display_name,
        i.*,
        jsonb_array_length(i.line_items) as item_count
    FROM qa_invoices i
    JOIN qa_user_profiles u ON u.user_id = i.recipient_id
)
SELECT
    display_name,
    invoice_number,
    period_start || ' - ' || period_end as period,
    item_count,
    subtotal,
    tax_amount,
    total_amount,
    status
FROM user_invoices
ORDER BY period_start DESC;
```

## 3. データ検証クエリ

```sql
-- ========================================
-- 請求書生成の検証
-- ========================================
-- 月別の請求書サマリー
SELECT
    DATE_TRUNC('month', period_start) as month,
    COUNT(*) as invoice_count,
    SUM(subtotal) as total_subtotal,
    SUM(tax_amount) as total_tax,
    SUM(total_amount) as total_amount
FROM qa_invoices
GROUP BY DATE_TRUNC('month', period_start)
ORDER BY month DESC;

-- ユーザー別の請求書状況
SELECT
    p.display_name,
    COUNT(i.id) as invoice_count,
    SUM(i.total_amount) as total_billed
FROM qa_user_profiles p
LEFT JOIN qa_invoices i ON i.recipient_id = p.user_id
GROUP BY p.user_id, p.display_name;

-- トランザクションと請求書の照合
SELECT
    t.type,
    COUNT(*) as transaction_count,
    SUM(t.platform_fee) as total_platform_fee,
    COUNT(DISTINCT DATE_TRUNC('month', t.created_at)) as months_with_transactions
FROM qa_transactions t
WHERE t.status = 'COMPLETED'
AND t.platform_fee > 0
GROUP BY t.type;
```

## 4. トラブルシューティング

### よくあるエラーと解決方法

#### エラー: function does not exist
```sql
-- 原因: パラメータの型が間違っている
-- 間違い
SELECT generate_monthly_invoices_improved(
    DATE_TRUNC('month', CURRENT_DATE),  -- TIMESTAMP型
    DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day'
);

-- 正しい
SELECT generate_monthly_invoices_improved(2025, 9);  -- INTEGER型
```

#### エラー: insufficient privilege
```sql
-- 原因: RLSポリシーにより挿入が制限されている
-- 解決: サービスロール権限で実行するか、開発環境で実行
```

## 5. クリーンアップ

```sql
-- ========================================
-- テストデータのクリーンアップ（必要な場合）
-- ========================================
-- 請求書の削除
DELETE FROM qa_invoices WHERE metadata->>'test' = 'true';

-- テストトランザクションの削除
DELETE FROM qa_transactions WHERE metadata->>'test' = 'true';
```

## 6. 推奨される実行順序

1. 関数のシグネチャ確認
2. テストユーザーの確認/作成
3. テストトランザクションの作成
4. 請求書の生成（正しい型で）
5. 生成結果の確認
6. 必要に応じてクリーンアップ