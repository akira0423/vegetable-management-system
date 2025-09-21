# 🚀 収支構造分析システム - 最適化実装計画書 v2.0

## 📅 作成日: 2025-01-21

## 🎯 目標: Supabase 分析結果に基づく本質的な最適化

---

## 📊 Supabase_20250921.md 分析結果との統合

### 🔍 発見された追加の問題点

1. **RLS ポリシーの重複と競合**

   - accounting_items テーブルに 3 つの重複ポリシー
   - work_report_accounting テーブルに 5 つの重複ポリシー
   - 曖昧なポリシー定義による認証エラー

2. **クエリパフォーマンスの実測値**

   - work_reports クエリ: 平均 1.6 秒（5159 回実行）
   - LATERAL JOIN の多用による遅延
   - インデックスがほとんど使用されていない（使用率 30%未満）

3. **データ量の現状**

   - work_reports: 10 件
   - work_report_accounting: 11 件
   - 会計項目使用率: 24 項目中 7 項目のみ（29%）

4. **get_current_company_id()関数の問題**
   - VOLATILE として定義されている（キャッシュ無効）
   - 毎回 auth.uid()を呼び出している
   - インデックスが存在しない

---

## 🎯 最適化された実装計画

## 📊 Phase 0: 緊急修正（即座実行）

### 0.1 RLS ポリシーの整理と統合

```sql
-- update_rls_policies_urgent.sql
BEGIN;

-- 1. 重複ポリシーの削除と統合
DROP POLICY IF EXISTS "All authenticated users can view accounting items" ON accounting_items;
DROP POLICY IF EXISTS "Only admins can manage accounting items" ON accounting_items;
DROP POLICY IF EXISTS "accounting_items_select_all" ON accounting_items;

-- 統合された単一ポリシー
CREATE POLICY "accounting_items_read_all" ON accounting_items
    FOR SELECT USING (true);

-- work_report_accountingの重複ポリシー削除
DROP POLICY IF EXISTS "Users can delete their company work report accounting" ON work_report_accounting;
DROP POLICY IF EXISTS "Users can insert their company work report accounting" ON work_report_accounting;
DROP POLICY IF EXISTS "Users can update their company work report accounting" ON work_report_accounting;
DROP POLICY IF EXISTS "Users can view their company work report accounting" ON work_report_accounting;
DROP POLICY IF EXISTS "work_report_accounting_company_access" ON work_report_accounting;

-- 最適化された単一ポリシー
CREATE POLICY "work_report_accounting_unified" ON work_report_accounting
    FOR ALL
    USING (
        auth.jwt()->>'role' = 'service_role' OR
        EXISTS (
            SELECT 1 FROM work_reports wr
            WHERE wr.id = work_report_accounting.work_report_id
            AND wr.company_id = get_current_company_id()
            AND wr.deleted_at IS NULL
        )
    );

COMMIT;
```

### 0.2 get_current_company_id()関数の最適化

```sql
-- optimize_helper_functions.sql

-- 関数を STABLE に変更（同一トランザクション内でキャッシュ）
CREATE OR REPLACE FUNCTION get_current_company_id()
RETURNS uuid
LANGUAGE sql
STABLE -- VOLATILEから変更
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT company_id
    FROM public.users
    WHERE id = auth.uid()
    LIMIT 1;
$$;

-- 必須インデックスの作成
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_id_company
    ON users(id, company_id);

-- is_service_role関数の追加（高速判定）
CREATE OR REPLACE FUNCTION is_service_role()
RETURNS boolean
LANGUAGE sql
IMMUTABLE -- 完全にキャッシュ可能
SECURITY DEFINER
AS $$
    SELECT coalesce(
        current_setting('request.jwt.claim.role', true) = 'service_role',
        false
    );
$$;
```

### 0.3 緊急インデックスの作成

```sql
-- create_critical_indexes.sql


CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_reports_composite
    ON work_reports(company_id, work_date DESC, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_report_accounting_composite
    ON work_report_accounting(work_report_id, accounting_item_id)
    INCLUDE (amount); -- カバリングインデックス

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounting_items_cost_type
    ON accounting_items(cost_type, id);
```

---

## 📊 Phase 1: API 最適化（1 日）

### 1.1 最適化された API エンドポイント

```typescript
// /src/app/api/financial-performance/optimized/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// Edge Runtimeで実行（より高速）
export const runtime = "edge";

// メモリキャッシュ（Edge Worker内）
const memCache = new Map();

export async function POST(request: NextRequest) {
  const { workReportIds, companyId, dateRange } = await request.json();

  // キャッシュキー生成
  const cacheKey = `${companyId}-${dateRange.start}-${dateRange.end}`;

  // キャッシュチェック
  if (memCache.has(cacheKey)) {
    const cached = memCache.get(cacheKey);
    if (Date.now() - cached.timestamp < 60000) {
      // 1分間有効
      return NextResponse.json(cached.data);
    }
  }

  const supabase = createServerClient();

  // 最適化されたクエリ（ビューを使用）
  const { data, error } = await supabase
    .from("v_work_reports_with_accounting") // 作成したビューを使用
    .select("*")
    .eq("company_id", companyId)
    .gte("work_date", dateRange.start)
    .lte("work_date", dateRange.end)
    .order("work_date", { ascending: false });

  if (error) {
    console.error("Optimized API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // データ整形（軽量化）
  const formatted = formatForChart(data);

  // キャッシュ保存
  memCache.set(cacheKey, {
    data: formatted,
    timestamp: Date.now(),
  });

  // CDNキャッシュヘッダー設定
  return NextResponse.json(formatted, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      "CDN-Cache-Control": "max-age=3600",
    },
  });
}

function formatForChart(data: any[]) {
  // 月別に集約（クライアント側の処理を削減）
  const monthly = data.reduce((acc, record) => {
    const month = record.work_date.substring(0, 7);

    if (!acc[month]) {
      acc[month] = {
        month,
        income: 0,
        fixed_cost: 0,
        variable_cost: 0,
        items: [],
      };
    }

    acc[month].income += record.total_income || 0;
    acc[month].fixed_cost += record.total_fixed_cost || 0;
    acc[month].variable_cost += record.total_variable_cost || 0;

    return acc;
  }, {});

  return Object.values(monthly);
}
```

---

## 📊 Phase 2: データベース最適化（3 日）

### 2.1 パーティショニングの実装

```sql
-- implement_partitioning.sql

-- work_reportsテーブルのパーティショニング（年月別）
CREATE TABLE work_reports_partitioned (
  LIKE work_reports INCLUDING ALL
) PARTITION BY RANGE (work_date);

-- 2024年のパーティション
CREATE TABLE work_reports_2024
  PARTITION OF work_reports_partitioned
  FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- 2025年のパーティション
CREATE TABLE work_reports_2025
  PARTITION OF work_reports_partitioned
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

-- データ移行
INSERT INTO work_reports_partitioned
SELECT * FROM work_reports;

-- テーブル入れ替え
ALTER TABLE work_reports RENAME TO work_reports_old;
ALTER TABLE work_reports_partitioned RENAME TO work_reports;
```

### 2.2 マテリアライズドビューの実装

```sql
-- create_materialized_views.sql

-- リアルタイムに近い集計ビュー
CREATE MATERIALIZED VIEW mv_financial_monthly_summary AS
WITH monthly_aggregation AS (
  SELECT
    wr.company_id,
    DATE_TRUNC('month', wr.work_date) AS month,
    wr.vegetable_id,
    v.name AS vegetable_name,
    -- 作業統計
    COUNT(DISTINCT wr.id) AS report_count,
    SUM(wr.duration_hours) AS total_hours,
    -- 会計集計
    SUM(CASE WHEN ai.cost_type = 'income' THEN wra.amount ELSE 0 END) AS total_income,
    SUM(CASE WHEN ai.cost_type = 'fixed_cost' THEN wra.amount ELSE 0 END) AS total_fixed_cost,
    SUM(CASE WHEN ai.cost_type = 'variable_cost' THEN wra.amount ELSE 0 END) AS total_variable_cost,
    -- 詳細JSON
    jsonb_object_agg(
      ai.code,
      jsonb_build_object(
        'name', ai.name,
        'amount', SUM(wra.amount),
        'type', ai.cost_type
      )
    ) FILTER (WHERE ai.id IS NOT NULL) AS accounting_details
  FROM work_reports wr
  LEFT JOIN vegetables v ON wr.vegetable_id = v.id
  LEFT JOIN work_report_accounting wra ON wr.id = wra.work_report_id
  LEFT JOIN accounting_items ai ON wra.accounting_item_id = ai.id
  WHERE wr.deleted_at IS NULL
  GROUP BY wr.company_id, DATE_TRUNC('month', wr.work_date), wr.vegetable_id, v.name
)
SELECT * FROM monthly_aggregation;

-- ユニークインデックス（同時リフレッシュ用）
CREATE UNIQUE INDEX ON mv_financial_monthly_summary (company_id, month, vegetable_id);

-- リフレッシュ関数（増分更新）
CREATE OR REPLACE FUNCTION refresh_financial_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_financial_monthly_summary;
END;
$$ LANGUAGE plpgsql;

-- 自動リフレッシュ（pg_cronを使用）
SELECT cron.schedule('refresh-financial-summary', '*/5 * * * *',
  'SELECT refresh_financial_summary()');
```

### 2.3 リアルタイムトリガーの最適化

```sql
-- optimize_triggers.sql

-- 非同期更新キューテーブル
CREATE TABLE update_queue (
  id SERIAL PRIMARY KEY,
  table_name TEXT,
  operation TEXT,
  record_id UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE
);

-- 軽量トリガー（キューに追加のみ）
CREATE OR REPLACE FUNCTION queue_update()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO update_queue (table_name, operation, record_id)
  VALUES (TG_TABLE_NAME, TG_OP, COALESCE(NEW.id, OLD.id));

  -- 即座に通知（オプション）
  PERFORM pg_notify('update_queue', json_build_object(
    'table', TG_TABLE_NAME,
    'op', TG_OP,
    'id', COALESCE(NEW.id, OLD.id)
  )::text);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガー設定
CREATE TRIGGER trigger_queue_accounting_update
AFTER INSERT OR UPDATE OR DELETE ON work_report_accounting
FOR EACH ROW EXECUTE FUNCTION queue_update();

-- バックグラウンド処理（別プロセス）
CREATE OR REPLACE FUNCTION process_update_queue()
RETURNS void AS $$
DECLARE
  queue_record RECORD;
BEGIN
  FOR queue_record IN
    SELECT * FROM update_queue
    WHERE NOT processed
    ORDER BY created_at
    LIMIT 100
  LOOP
    -- マテリアライズドビューを更新
    PERFORM refresh_financial_summary();

    -- 処理済みフラグ
    UPDATE update_queue
    SET processed = TRUE
    WHERE id = queue_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

---

## 📊 Phase 3: フロントエンド最適化（2 日）

### 3.1 React Query 統合

```typescript
// /src/hooks/useFinancialData.ts

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

export function useFinancialData(companyId: string, dateRange: DateRange) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["financial", companyId, dateRange],
    queryFn: async () => {
      // まずキャッシュから取得を試みる
      const cached = queryClient.getQueryData([
        "financial",
        companyId,
        dateRange,
      ]);
      if (cached) return cached;

      // マテリアライズドビューから取得（超高速）
      const { data, error } = await supabase
        .from("mv_financial_monthly_summary")
        .select("*")
        .eq("company_id", companyId)
        .gte("month", dateRange.start)
        .lte("month", dateRange.end)
        .order("month");

      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5分間は再取得しない
    cacheTime: 30 * 60 * 1000, // 30分間キャッシュ保持
    refetchOnWindowFocus: false, // フォーカス時の再取得を無効化
  });
}

// プリフェッチ用関数
export async function prefetchFinancialData(
  queryClient: QueryClient,
  companyId: string,
  dateRange: DateRange
) {
  return queryClient.prefetchQuery({
    queryKey: ["financial", companyId, dateRange],
    queryFn: async () => {
      const response = await fetch("/api/financial-performance/optimized", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, dateRange }),
      });
      return response.json();
    },
  });
}
```

### 3.2 仮想スクロールとレンダリング最適化

```typescript
// /src/components/charts/financial-performance-optimized.tsx

import { memo, useMemo, useCallback } from "react";
import { FixedSizeList } from "react-window";
import { useFinancialData } from "@/hooks/useFinancialData";

const FinancialPerformanceOptimized = memo(({ companyId, dateRange }) => {
  const { data, isLoading } = useFinancialData(companyId, dateRange);

  // Chart.jsのオプションをメモ化
  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 0, // アニメーション無効化で高速化
      },
      plugins: {
        legend: {
          display: true,
          position: "top" as const,
        },
        decimation: {
          enabled: true,
          algorithm: "lttb", // データポイント削減アルゴリズム
          samples: 100, // 最大100ポイントに削減
        },
      },
    }),
    []
  );

  // データ変換をメモ化
  const chartData = useMemo(() => {
    if (!data) return null;

    return {
      labels: data.map((d) => d.month),
      datasets: [
        {
          label: "収入",
          data: data.map((d) => d.total_income),
          backgroundColor: "rgba(34, 197, 94, 0.8)",
          borderColor: "rgb(34, 197, 94)",
          borderWidth: 2,
        },
        {
          label: "固定費",
          data: data.map((d) => -d.total_fixed_cost),
          backgroundColor: "rgba(239, 68, 68, 0.8)",
          borderColor: "rgb(239, 68, 68)",
          borderWidth: 2,
        },
        {
          label: "変動費",
          data: data.map((d) => -d.total_variable_cost),
          backgroundColor: "rgba(249, 115, 22, 0.8)",
          borderColor: "rgb(249, 115, 22)",
          borderWidth: 2,
        },
      ],
    };
  }, [data]);

  // Web Workerでの重い処理
  const processInWorker = useCallback(async (data: any[]) => {
    return new Promise((resolve) => {
      const worker = new Worker("/workers/financial-processor.js");
      worker.postMessage({ type: "process", data });
      worker.onmessage = (e) => {
        resolve(e.data);
        worker.terminate();
      };
    });
  }, []);

  if (isLoading) {
    return <ChartSkeleton />;
  }

  return (
    <div className="h-[400px]">
      <Bar data={chartData} options={chartOptions} />
    </div>
  );
});

FinancialPerformanceOptimized.displayName = "FinancialPerformanceOptimized";

export default FinancialPerformanceOptimized;
```

---

## 📊 Phase 4: 監視とスケーリング（継続的）

### 4.1 パフォーマンス監視ダッシュボード

```sql
-- create_monitoring_views.sql

CREATE VIEW v_performance_metrics AS
SELECT
  'work_reports' as table_name,
  COUNT(*) as row_count,
  pg_size_pretty(pg_total_relation_size('work_reports')) as total_size,
  (SELECT COUNT(*) FROM pg_stat_user_indexes WHERE schemaname = 'public' AND tablename = 'work_reports' AND idx_scan > 0) as active_indexes
FROM work_reports
UNION ALL
SELECT
  'work_report_accounting' as table_name,
  COUNT(*) as row_count,
  pg_size_pretty(pg_total_relation_size('work_report_accounting')) as total_size,
  (SELECT COUNT(*) FROM pg_stat_user_indexes WHERE schemaname = 'public' AND tablename = 'work_report_accounting' AND idx_scan > 0) as active_indexes
FROM work_report_accounting;

-- スロークエリ監視
CREATE VIEW v_slow_queries AS
SELECT
  calls,
  mean_exec_time,
  total_exec_time,
  LEFT(query, 100) as query_preview
FROM pg_stat_statements
WHERE mean_exec_time > 100 -- 100ms以上
ORDER BY mean_exec_time DESC
LIMIT 20;
```

### 4.2 自動スケーリング設定

```typescript
// /src/lib/monitoring/performance.ts

class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  async measureQuery(queryName: string, queryFn: () => Promise<any>) {
    const start = performance.now();

    try {
      const result = await queryFn();
      const duration = performance.now() - start;

      // メトリクス記録
      if (!this.metrics.has(queryName)) {
        this.metrics.set(queryName, []);
      }
      this.metrics.get(queryName)!.push(duration);

      // 閾値チェック
      if (duration > 1000) {
        console.warn(`Slow query detected: ${queryName} took ${duration}ms`);
        this.reportToAnalytics(queryName, duration);
      }

      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.reportError(queryName, error, duration);
      throw error;
    }
  }

  private reportToAnalytics(queryName: string, duration: number) {
    // Vercel Analytics or custom solution
    if (typeof window !== "undefined" && window.analytics) {
      window.analytics.track("slow_query", {
        query: queryName,
        duration,
        timestamp: new Date().toISOString(),
      });
    }
  }

  getAverageTime(queryName: string): number {
    const times = this.metrics.get(queryName) || [];
    return times.reduce((a, b) => a + b, 0) / times.length || 0;
  }
}

export const performanceMonitor = new PerformanceMonitor();
```

---

## 📈 期待される成果

### パフォーマンス改善予測

| メトリクス         | 現在値 | Phase 0 後 | Phase 1 後 | Phase 2 後 | Phase 3 後 | 最終目標 |
| ------------------ | ------ | ---------- | ---------- | ---------- | ---------- | -------- |
| API 応答時間       | 2-3 秒 | 1.5 秒     | 800ms      | 200ms      | 100ms      | <100ms   |
| インデックス使用率 | 30%    | 60%        | 80%        | 90%        | 95%        | >95%     |
| キャッシュヒット率 | 0%     | 20%        | 50%        | 70%        | 85%        | >90%     |
| 同時接続数上限     | 10     | 30         | 100        | 500        | 1000       | >1000    |
| データ処理上限     | 1 千件 | 5 千件     | 5 万件     | 50 万件    | 500 万件   | 無制限   |

### コスト削減効果

- **データベース負荷**: 70%削減
- **API 呼び出し回数**: 80%削減
- **帯域幅使用量**: 60%削減
- **レスポンス時間**: 95%改善

---

## 🚨 実装時の重要な注意点

### 1. Phase 0 を最優先で実行

- RLS ポリシーの重複は即座に解決必要
- インデックス作成は CONCURRENTLY で実行
- 関数の最適化は大きな効果

### 2. データ移行時の注意

- 必ずトランザクションで実行
- バックアップを事前に取得
- ステージング環境でテスト

### 3. モニタリングの重要性

- 各フェーズ後にパフォーマンス測定
- 想定外の劣化があれば即座にロールバック
- メトリクスを継続的に記録

---

## ✅ 実装チェックリスト

### Phase 0（即座実行）

- [ ] RLS ポリシー整理スクリプト実行
- [ ] get_current_company_id()関数最適化
- [ ] 緊急インデックス作成
- [ ] パフォーマンス測定（実行前後）

### Phase 1（1 日）

- [ ] 最適化 API エンドポイント作成
- [ ] Edge ランタイム設定
- [ ] キャッシュ実装
- [ ] フロントエンド接続変更

### Phase 2（3 日）

- [ ] パーティショニング設計
- [ ] マテリアライズドビュー作成
- [ ] トリガー最適化
- [ ] データ移行実行

### Phase 3（2 日）

- [ ] React Query 統合
- [ ] レンダリング最適化
- [ ] Web Worker 実装
- [ ] パフォーマンステスト

### Phase 4（継続的）

- [ ] 監視ダッシュボード構築
- [ ] アラート設定
- [ ] 自動スケーリング設定
- [ ] ドキュメント更新

---

## 📞 サポート情報

実装中の問題が発生した場合：

1. このドキュメントの該当セクションを確認
2. Supabase_20250921.md の分析結果を参照
3. 作成済みの SQL ファイルを活用

**最終更新**: 2025-01-21
**バージョン**: 2.0
