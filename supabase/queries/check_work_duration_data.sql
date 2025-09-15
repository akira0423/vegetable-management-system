-- ====================================================================
-- 総作業時間が0hになる原因調査
-- work_duration フィールドのデータ確認
-- ====================================================================

-- 1. work_duration フィールドの状態確認
SELECT
  '=== work_duration データ確認 ===' as section;

SELECT
  COUNT(*) as "総レポート数",
  COUNT(work_duration) as "work_duration設定済み",
  COUNT(CASE WHEN work_duration > 0 THEN 1 END) as "work_duration > 0",
  COUNT(CASE WHEN work_duration = 0 THEN 1 END) as "work_duration = 0",
  COUNT(CASE WHEN work_duration IS NULL THEN 1 END) as "work_duration NULL",
  COUNT(duration_hours) as "duration_hours設定済み",
  COUNT(worker_count) as "worker_count設定済み"
FROM work_reports
WHERE
  company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
  AND work_date >= CURRENT_DATE - INTERVAL '12 months'
  AND deleted_at IS NULL;

-- 2. 各レポートの作業時間詳細
SELECT
  '=== 各レポートの作業時間詳細 ===' as section;

SELECT
  wr.id,
  wr.work_date,
  v.name as vegetable_name,
  wr.work_type,
  wr.work_duration as "work_duration(分)",
  wr.duration_hours as "duration_hours(時)",
  wr.worker_count,
  -- フロントエンドの計算ロジックを再現
  CASE
    WHEN wr.work_duration IS NOT NULL THEN
      (wr.work_duration::float * COALESCE(wr.worker_count, 1) / 60)
    ELSE 0
  END as "計算後の時間(h)"
FROM work_reports wr
LEFT JOIN vegetables v ON wr.vegetable_id = v.id
WHERE
  wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
  AND wr.work_date >= CURRENT_DATE - INTERVAL '12 months'
  AND wr.deleted_at IS NULL
ORDER BY wr.work_date DESC;

-- 3. 総作業時間の計算（フロントエンドロジック再現）
SELECT
  '=== 総作業時間計算 ===' as section;

SELECT
  -- work_duration のみ使用（duration_hours フォールバックなし）
  SUM(
    CASE
      WHEN wr.work_duration IS NOT NULL THEN
        (wr.work_duration::float * COALESCE(wr.worker_count, 1) / 60)
      ELSE 0
    END
  ) as "総作業時間(h) - work_durationのみ",

  -- 以前のロジック（duration_hours フォールバック付き）
  SUM(
    CASE
      WHEN wr.work_duration IS NOT NULL THEN
        (wr.work_duration::float * COALESCE(wr.worker_count, 1) / 60)
      WHEN wr.duration_hours IS NOT NULL THEN
        (wr.duration_hours * COALESCE(wr.worker_count, 1))
      ELSE 0
    END
  ) as "総作業時間(h) - フォールバック付き"
FROM work_reports wr
WHERE
  wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
  AND wr.work_date >= CURRENT_DATE - INTERVAL '12 months'
  AND wr.deleted_at IS NULL;

-- 4. work_duration が NULL または 0 のレポート一覧
SELECT
  '=== work_duration未設定レポート ===' as section;

SELECT
  wr.id,
  wr.work_date,
  v.name as vegetable_name,
  wr.work_type,
  wr.work_duration,
  wr.duration_hours,
  wr.start_time,
  wr.end_time,
  wr.notes
FROM work_reports wr
LEFT JOIN vegetables v ON wr.vegetable_id = v.id
WHERE
  wr.company_id = '4cb3e254-9d73-4d67-b9ae-433bf249fe38'
  AND wr.work_date >= CURRENT_DATE - INTERVAL '12 months'
  AND wr.deleted_at IS NULL
  AND (wr.work_duration IS NULL OR wr.work_duration = 0)
ORDER BY wr.work_date DESC;