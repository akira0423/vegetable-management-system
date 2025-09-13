-- ====================================
-- Supabase クイックバックアップSQL
-- これを1つずつ実行してください
-- ====================================

-- ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
-- 1. まず実行: データ件数の確認（所要時間: 1秒）
-- ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■

SELECT
    'companies' as table_name, COUNT(*) as count FROM public.companies
UNION ALL
SELECT 'users', COUNT(*) FROM public.users
UNION ALL
SELECT 'vegetables', COUNT(*) FROM public.vegetables
UNION ALL
SELECT 'growing_tasks', COUNT(*) FROM public.growing_tasks
UNION ALL
SELECT 'work_reports', COUNT(*) FROM public.work_reports;

-- 結果をメモしてください ↑


-- ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
-- 2. 次に実行: 会社データのバックアップ
-- ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■

SELECT json_agg(row_to_json(t)) AS companies_backup
FROM public.companies t;

-- 結果を「companies_backup.json」として保存 ↑


-- ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
-- 3. ユーザーデータのバックアップ
-- ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■

SELECT json_agg(row_to_json(t)) AS users_backup
FROM public.users t;

-- 結果を「users_backup.json」として保存 ↑


-- ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
-- 4. 野菜データのバックアップ
-- ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■

SELECT json_agg(row_to_json(t)) AS vegetables_backup
FROM public.vegetables t
WHERE deleted_at IS NULL;  -- 削除されていないデータのみ

-- 結果を「vegetables_backup.json」として保存 ↑


-- ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
-- 5. タスクデータのバックアップ
-- ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■

SELECT json_agg(row_to_json(t)) AS tasks_backup
FROM public.growing_tasks t;

-- 結果を「growing_tasks_backup.json」として保存 ↑


-- ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
-- 6. 作業報告データのバックアップ
-- ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■

SELECT json_agg(row_to_json(t)) AS reports_backup
FROM public.work_reports t
ORDER BY created_at DESC
LIMIT 1000;  -- 最新1000件のみ（全件必要な場合はLIMITを削除）

-- 結果を「work_reports_backup.json」として保存 ↑


-- ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
-- 7. 最後に実行: バックアップ完了確認
-- ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■

SELECT
    CURRENT_TIMESTAMP AS backup_completed_at,
    'バックアップが完了しました' AS message,
    '保存したファイル:' AS files,
    '1. companies_backup.json' AS file1,
    '2. users_backup.json' AS file2,
    '3. vegetables_backup.json' AS file3,
    '4. growing_tasks_backup.json' AS file4,
    '5. work_reports_backup.json' AS file5;