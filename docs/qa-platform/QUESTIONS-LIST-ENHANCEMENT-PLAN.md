# 🔍 Q&Aプラットフォーム 質問一覧ページ機能強化計画

## 📋 実装概要
質問一覧ページ（/qa/questions）に検索・絞り込み・ソート機能を実装し、ユーザビリティを大幅に向上させます。

## 🎯 実装優先順位

### Phase 1: コア機能（必須）
1. **フリーテキスト検索**
2. **基本フィルタリング**（ステータス、報酬額）
3. **ソート機能**
4. **ページネーション**

### Phase 2: 拡張機能（推奨）
5. **ファセット検索**
6. **高度な絞り込み**
7. **検索履歴・保存**

### Phase 3: 最適化（将来）
8. **パフォーマンス最適化**
9. **クエリビルダーUI**
10. **比較機能**

---

## 📐 実装設計

### 1. データベース拡張

```sql
-- 既存のqa_questionsテーブルに対する変更なし（search_vectorは既に存在）
-- 必要なインデックスを確認・追加

-- 検索用インデックス（既存）
-- CREATE INDEX IF NOT EXISTS idx_qa_questions_search ON qa_questions USING gin(search_vector);

-- 追加インデックス
CREATE INDEX IF NOT EXISTS idx_qa_questions_crop ON qa_questions(crop) WHERE crop IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_qa_questions_disease ON qa_questions(disease) WHERE disease IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_qa_questions_region ON qa_questions(region) WHERE region IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_qa_questions_season ON qa_questions(season) WHERE season IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_qa_questions_ppv_count ON qa_questions(ppv_sales_count DESC);
CREATE INDEX IF NOT EXISTS idx_qa_questions_composite ON qa_questions(
    status, published_at DESC, bounty_amount DESC
) WHERE published_at IS NOT NULL;
```

### 2. API設計

#### GET /api/qa/questions エンドポイント拡張

```typescript
interface QueryParams {
  // 検索
  q?: string;                    // フリーテキスト検索

  // フィルター
  crop?: string;                  // 作物
  disease?: string;               // 病害
  region?: string;                // 地域
  season?: string;                // 季節
  tags?: string[];                // タグ（複数可）
  tagsMode?: 'AND' | 'OR';       // タグ検索モード
  status?: string[];              // ステータス

  // 範囲フィルター
  bountyMin?: number;             // 最低報酬額
  bountyMax?: number;             // 最高報酬額
  deadlineFrom?: string;          // 期限開始
  deadlineTo?: string;            // 期限終了
  answersMin?: number;            // 最低回答数
  answersMax?: number;            // 最高回答数

  // 品質要件フィルター
  requiresPhoto?: boolean;        // 写真必須
  requiresVideo?: boolean;        // 動画必須
  minCharsMin?: number;           // 最低文字数

  // PPV実績
  ppvMin?: number;                // 最低PPV購入数

  // ソート
  sort?: 'newest' | 'oldest' | 'bounty_high' | 'bounty_low' |
         'deadline_soon' | 'popular' | 'most_answers' | 'no_answers';

  // ページネーション
  page?: number;
  limit?: number;
  cursor?: string;                // カーソルベースページネーション
}
```

### 3. フロントエンド実装

#### コンポーネント構成

```
/qa/questions/
├── page.tsx                    # メインページ
├── components/
│   ├── SearchBar.tsx           # 検索バー
│   ├── FilterSidebar.tsx       # フィルターサイドバー
│   ├── QuestionCard.tsx        # 質問カード（拡張版）
│   ├── SortDropdown.tsx        # ソートドロップダウン
│   ├── ActiveFilters.tsx       # 選択中フィルター表示
│   ├── SearchSuggestions.tsx   # 検索サジェスト
│   └── QuestionSkeleton.tsx    # ローディングスケルトン
└── hooks/
    ├── useQuestionsSearch.ts    # 検索ロジック
    ├── useDebounce.ts           # 入力デバウンス
    └── useInfiniteScroll.ts     # 無限スクロール
```

#### SearchBar実装例

```tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import SearchSuggestions from './SearchSuggestions';

export default function SearchBar({
  initialValue = '',
  onSearch
}: {
  initialValue?: string;
  onSearch: (query: string) => void;
}) {
  const [query, setQuery] = useState(initialValue);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (debouncedQuery !== initialValue) {
      onSearch(debouncedQuery);
    }
  }, [debouncedQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
    setShowSuggestions(false);
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          placeholder="キーワード、#タグ、作物名..."
          className="w-full px-4 py-3 pl-12 pr-20 border rounded-lg focus:outline-none focus:border-blue-500"
        />
        <svg className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />

        {/* クエリ構文ヘルプ */}
        {query.includes('"') || query.includes('-') ? (
          <div className="absolute right-24 top-3.5 text-xs text-gray-500">
            {query.includes('"') && '完全一致'}
            {query.includes('-') && '除外'}
          </div>
        ) : null}

        <button
          type="submit"
          className="absolute right-2 top-2 px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          検索
        </button>
      </div>

      {showSuggestions && (
        <SearchSuggestions
          query={query}
          onSelect={(suggestion) => {
            setQuery(suggestion);
            setShowSuggestions(false);
            onSearch(suggestion);
          }}
          onClose={() => setShowSuggestions(false)}
        />
      )}
    </form>
  );
}
```

### 4. 検索実装詳細

#### クエリ解析ロジック

```typescript
function parseSearchQuery(query: string): {
  terms: string[];
  phrases: string[];
  excludes: string[];
  tags: string[];
} {
  const result = {
    terms: [] as string[],
    phrases: [] as string[],
    excludes: [] as string[],
    tags: [] as string[]
  };

  // 引用句抽出
  const phraseMatches = query.match(/"([^"]+)"/g);
  if (phraseMatches) {
    result.phrases = phraseMatches.map(m => m.replace(/"/g, ''));
    query = query.replace(/"[^"]+"/g, '');
  }

  // タグ抽出
  const tagMatches = query.match(/#[\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+/g);
  if (tagMatches) {
    result.tags = tagMatches.map(m => m.substring(1));
    query = query.replace(/#[\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+/g, '');
  }

  // 除外語抽出
  const excludeMatches = query.match(/-[\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+/g);
  if (excludeMatches) {
    result.excludes = excludeMatches.map(m => m.substring(1));
    query = query.replace(/-[\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+/g, '');
  }

  // 残りの語句
  result.terms = query.trim().split(/\s+/).filter(Boolean);

  return result;
}
```

### 5. パフォーマンス最適化

```typescript
// React Query使用例
import { useInfiniteQuery } from '@tanstack/react-query';

export function useQuestionsInfinite(params: QueryParams) {
  return useInfiniteQuery({
    queryKey: ['questions', params],
    queryFn: async ({ pageParam = 0 }) => {
      const response = await fetch(
        `/api/qa/questions?${new URLSearchParams({
          ...params,
          cursor: pageParam,
        })}`
      );
      return response.json();
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30 * 1000, // 30秒
    cacheTime: 5 * 60 * 1000, // 5分
  });
}
```

### 6. カード表示の拡張

```tsx
interface EnhancedQuestionCardProps {
  question: Question;
  searchQuery?: string;
  onCompareAdd?: (id: string) => void;
}

export default function EnhancedQuestionCard({
  question,
  searchQuery,
  onCompareAdd
}: EnhancedQuestionCardProps) {
  // 検索ハイライト処理
  const highlightText = (text: string) => {
    if (!searchQuery) return text;

    const regex = new RegExp(`(${searchQuery})`, 'gi');
    return text.split(regex).map((part, i) =>
      regex.test(part) ? <mark key={i}>{part}</mark> : part
    );
  };

  return (
    <div className="border rounded-lg p-6 hover:shadow-lg transition">
      {/* ヘッダー */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-xl font-semibold">
            {highlightText(question.title)}
          </h3>

          {/* 品質要件バッジ */}
          <div className="flex gap-2 mt-2">
            {question.require_photo && (
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                📷 写真必須
              </span>
            )}
            {question.require_video && (
              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                🎥 動画必須
              </span>
            )}
            {question.min_answer_chars >= 500 && (
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                ✍️ {question.min_answer_chars}字以上
              </span>
            )}
          </div>
        </div>

        {/* 報酬額 */}
        <div className="text-right">
          <p className="text-2xl font-bold text-green-600">
            ¥{question.bounty_amount.toLocaleString()}
          </p>
          <CountdownTimer deadline={question.deadline_at} />
        </div>
      </div>

      {/* 本文（全文表示） */}
      <div className="text-gray-700 mb-4 whitespace-pre-wrap">
        {highlightText(question.body)}
      </div>

      {/* メタ情報 */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <div className="flex items-center gap-4">
          <span>💬 {question.answer_count} 回答</span>
          {question.ppv_sales_count > 0 && (
            <span>👁 {question.ppv_sales_count} PPV</span>
          )}
          <span>{question.category}</span>
        </div>

        {/* アクション */}
        <div className="flex gap-2">
          <button
            onClick={() => onCompareAdd?.(question.id)}
            className="text-blue-600 hover:underline"
          >
            比較に追加
          </button>
          <Link
            href={`/qa/${question.id}`}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            詳細を見る
          </Link>
        </div>
      </div>
    </div>
  );
}
```

---

## 📊 KPI計測

```typescript
// analytics.ts
export const trackSearchEvent = (params: {
  query: string;
  filters: Record<string, any>;
  resultsCount: number;
  responseTime: number;
}) => {
  // GA4 or 独自分析システムへ送信
  gtag('event', 'search_performed', params);
};

export const trackFilterChange = (filterType: string, value: any) => {
  gtag('event', 'filter_changed', { filterType, value });
};

export const trackQuestionView = (questionId: string, position: number) => {
  gtag('event', 'question_card_viewed', { questionId, position });
};
```

---

## 🚀 実装スケジュール

### Week 1
- [ ] データベースインデックス追加
- [ ] API拡張（検索・フィルター）
- [ ] SearchBarコンポーネント

### Week 2
- [ ] FilterSidebarコンポーネント
- [ ] 拡張版QuestionCard
- [ ] 無限スクロール実装

### Week 3
- [ ] パフォーマンス最適化
- [ ] 検索サジェスト
- [ ] KPI計測実装

---

## 📝 注意事項

1. **既存コードとの互換性維持**
   - 現在の`/qa`ページは残す
   - 新機能は`/qa/questions`として実装

2. **段階的リリース**
   - フィーチャーフラグで機能制御
   - A/Bテストで効果測定

3. **パフォーマンス基準**
   - 検索API: p95 < 150ms
   - ページ表示: p95 < 400ms
   - 同時検索数: 100req/s対応