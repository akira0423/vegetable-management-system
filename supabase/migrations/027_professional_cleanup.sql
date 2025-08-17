-- ====================================================================
-- プロフェッショナルデータベース再設計 - 段階1: 不要要素削除
-- ====================================================================

-- 1. 全RLSポリシーを一旦削除（クリーンスタート）
DO $$
DECLARE
    pol_record RECORD;
BEGIN
    FOR pol_record IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol_record.policyname, pol_record.tablename);
        RAISE NOTICE 'Dropped policy: % on %', pol_record.policyname, pol_record.tablename;
    END LOOP;
END $$;

-- 2. 不要テーブルの削除
DROP TABLE IF EXISTS operation_logs CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS photos CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS farm_areas CASCADE;
DROP TABLE IF EXISTS farm_plots CASCADE;
DROP TABLE IF EXISTS vegetable_cells CASCADE;
DROP TABLE IF EXISTS mesh_cells CASCADE;

-- 3. 不要関数の削除
DROP FUNCTION IF EXISTS log_changes() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_task_status() CASCADE;
DROP FUNCTION IF EXISTS log_critical_operations() CASCADE;

-- 4. 確認ログ
DO $$ 
BEGIN
    RAISE NOTICE '=== 段階1完了: データベースクリーンアップ ===';
    RAISE NOTICE '✅ 不要テーブル削除完了';
    RAISE NOTICE '✅ 全RLSポリシー削除完了';
    RAISE NOTICE '✅ 不要関数削除完了';
    RAISE NOTICE '⚡ 段階2で最適化テーブル設計実行予定';
    RAISE NOTICE '=======================================';
END $$;