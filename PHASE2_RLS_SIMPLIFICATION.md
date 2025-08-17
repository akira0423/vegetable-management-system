# フェーズ2: RLS簡素化

## 2.1 シンプルRLSポリシー実装

```sql
-- ====================================================================
-- フェーズ2: 会社ID一致のみのシンプルRLS
-- ====================================================================

-- 1. 既存の複雑なポリシーを削除
DROP POLICY IF EXISTS "growing_tasks_company_select" ON growing_tasks;
DROP POLICY IF EXISTS "growing_tasks_company_insert" ON growing_tasks;
DROP POLICY IF EXISTS "growing_tasks_company_update" ON growing_tasks;
DROP POLICY IF EXISTS "growing_tasks_admin_delete" ON growing_tasks;

-- 2. シンプル統一ポリシー作成
CREATE POLICY "growing_tasks_company_only" ON growing_tasks
    FOR ALL
    USING (
        company_id = get_current_company_id()
        OR auth.uid() IS NULL  -- Service Role許可
    )
    WITH CHECK (
        company_id = get_current_company_id()
        OR auth.uid() IS NULL
    );

-- 3. work_reportsも同様にシンプル化
ALTER TABLE work_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "work_reports_company_only" ON work_reports
    FOR ALL
    USING (
        company_id = get_current_company_id()
        OR auth.uid() IS NULL
    )
    WITH CHECK (
        company_id = get_current_company_id()
        OR auth.uid() IS NULL
    );

-- 4. vegetablesテーブルも統一
DROP POLICY IF EXISTS "vegetables_select_policy" ON vegetables;
DROP POLICY IF EXISTS "vegetables_insert_policy" ON vegetables;
DROP POLICY IF EXISTS "vegetables_update_policy" ON vegetables;
DROP POLICY IF EXISTS "vegetables_delete_policy" ON vegetables;

CREATE POLICY "vegetables_company_only" ON vegetables
    FOR ALL
    USING (
        company_id = get_current_company_id()
        OR auth.uid() IS NULL
    )
    WITH CHECK (
        company_id = get_current_company_id()
        OR auth.uid() IS NULL
    );

-- 5. パフォーマンス最適化
CREATE INDEX IF NOT EXISTS idx_growing_tasks_company_simple 
    ON growing_tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_work_reports_company_simple 
    ON work_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_vegetables_company_simple 
    ON vegetables(company_id);

-- 6. 確認ログ
DO $$ 
BEGIN
    RAISE NOTICE 'フェーズ2完了: RLS簡素化';
    RAISE NOTICE '- 全テーブル統一ポリシー';
    RAISE NOTICE '- 会社ID一致のみチェック';
    RAISE NOTICE '- Service Role許可';
    RAISE NOTICE '- パフォーマンス最適化';
END $$;
```

## 2.2 RLSテスト

```sql
-- シンプルRLSテスト
-- 1. 権限確認
SELECT get_current_company_id();

-- 2. データアクセステスト
SELECT COUNT(*) FROM growing_tasks;
SELECT COUNT(*) FROM work_reports;
SELECT COUNT(*) FROM vegetables;

-- 3. 削除テスト
DELETE FROM growing_tasks WHERE name LIKE '%テスト%';
```