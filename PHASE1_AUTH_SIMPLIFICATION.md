# フェーズ1: 認証モデル簡素化

## 1.1 スキーマ修正

```sql
-- ====================================================================
-- フェーズ1: 1企業1アカウントモデル対応
-- ====================================================================

-- 1. usersテーブル構造簡素化
ALTER TABLE users DROP COLUMN IF EXISTS role;
ALTER TABLE users DROP COLUMN IF EXISTS department;
ALTER TABLE users DROP COLUMN IF EXISTS position;

-- 2. 会社代表ユーザーフラグ追加
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_company_account boolean DEFAULT true;

-- 3. 会社認証用の簡素化された権限関数
CREATE OR REPLACE FUNCTION get_current_company_id() 
RETURNS uuid AS $$
BEGIN
    -- ユーザーの会社IDを直接返す（権限チェックなし）
    RETURN (
        SELECT company_id 
        FROM users 
        WHERE id = auth.uid()
        LIMIT 1
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 既存の複雑な権限関数を廃止
DROP FUNCTION IF EXISTS get_current_user_role();

-- 5. 確認ログ
DO $$ 
BEGIN
    RAISE NOTICE 'フェーズ1完了: 認証モデル簡素化';
    RAISE NOTICE '- role権限廃止';
    RAISE NOTICE '- 会社ID直接取得';
    RAISE NOTICE '- シンプル認証モデル適用';
END $$;
```

## 1.2 認証ロジック確認

```sql
-- 新しい認証ロジックテスト
SELECT 
    id,
    email,
    company_id,
    is_company_account
FROM users
WHERE company_id = 'a1111111-1111-1111-1111-111111111111';

-- 会社ID取得テスト
SELECT get_current_company_id() as current_company;
```