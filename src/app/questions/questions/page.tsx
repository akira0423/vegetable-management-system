'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import SearchBar from '@/components/qa/SearchBar';
import FilterSidebar from '@/components/qa/FilterSidebar';
import SortDropdown from '@/components/qa/SortDropdown';
import ActiveFilters from '@/components/qa/ActiveFilters';
import QuestionCard from '@/components/qa/EnhancedQuestionCard';

interface Question {
  id: string;
  title: string;
  body: string;
  bounty_amount: number;
  status: string;
  answer_count: number;
  ppv_sales_count: number;
  created_at: string;
  deadline_at: string;
  category?: string;
  crop?: string;
  disease?: string;
  region?: string;
  season?: string;
  tags: string[];
  min_answer_chars: number;
  require_photo: boolean;
  require_video: boolean;
  asker: {
    display_name: string;
    avatar_url?: string;
    reputation_score?: number;
  };
}

interface FilterState {
  q?: string;
  status?: string[];
  crop?: string;
  disease?: string;
  region?: string;
  season?: string;
  tags?: string[];
  bountyMin?: number;
  bountyMax?: number;
  requiresPhoto?: boolean;
  requiresVideo?: boolean;
  ppvMin?: number;
  sort?: string;
}

export default function QuestionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>({});
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);

  // URLパラメータからフィルター状態を初期化
  useEffect(() => {
    const initialFilters: FilterState = {};

    searchParams.forEach((value, key) => {
      if (key === 'tags' || key === 'status') {
        initialFilters[key] = value.split(',');
      } else if (key === 'bountyMin' || key === 'bountyMax' || key === 'ppvMin') {
        initialFilters[key] = parseInt(value);
      } else if (key === 'requiresPhoto' || key === 'requiresVideo') {
        initialFilters[key] = value === 'true';
      } else {
        initialFilters[key] = value;
      }
    });

    setFilters(initialFilters);
  }, [searchParams]);

  // 質問データ取得
  const fetchQuestions = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();

      // フィルターパラメータ設定
      if (filters.q) params.set('q', filters.q);
      if (filters.status) params.set('status', filters.status.join(','));
      if (filters.crop) params.set('crop', filters.crop);
      if (filters.disease) params.set('disease', filters.disease);
      if (filters.region) params.set('region', filters.region);
      if (filters.season) params.set('season', filters.season);
      if (filters.tags) params.set('tags', filters.tags.join(','));
      if (filters.bountyMin) params.set('bountyMin', filters.bountyMin.toString());
      if (filters.bountyMax) params.set('bountyMax', filters.bountyMax.toString());
      if (filters.requiresPhoto !== undefined) params.set('requiresPhoto', filters.requiresPhoto.toString());
      if (filters.requiresVideo !== undefined) params.set('requiresVideo', filters.requiresVideo.toString());
      if (filters.ppvMin) params.set('ppvMin', filters.ppvMin.toString());
      if (filters.sort) params.set('sort', filters.sort);
      params.set('page', page.toString());
      params.set('limit', '20');

      const response = await fetch(`/api/qa/questions?${params}`);
      const data = await response.json();

      setQuestions(data.questions || []);
      setTotalCount(data.totalCount || 0);
    } catch (error) {
      console.error('Error fetching questions:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // フィルター変更処理
  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setPage(1);

    // URLパラメータ更新
    const params = new URLSearchParams();
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          params.set(key, value.join(','));
        } else {
          params.set(key, value.toString());
        }
      }
    });

    router.push(`/qa/questions?${params}`);
  };

  // 検索処理
  const handleSearch = (query: string) => {
    handleFilterChange({ ...filters, q: query });
  };

  // ソート変更
  const handleSortChange = (sort: string) => {
    handleFilterChange({ ...filters, sort });
  };

  // フィルター削除
  const removeFilter = (key: keyof FilterState, value?: any) => {
    const newFilters = { ...filters };

    if (Array.isArray(newFilters[key]) && value !== undefined) {
      newFilters[key] = (newFilters[key] as any[]).filter(v => v !== value);
      if (newFilters[key].length === 0) {
        delete newFilters[key];
      }
    } else {
      delete newFilters[key];
    }

    handleFilterChange(newFilters);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">質問を探す</h1>
            <Link
              href="/qa/new"
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
            >
              質問を投稿
            </Link>
          </div>

          {/* 検索バー */}
          <SearchBar
            initialValue={filters.q}
            onSearch={handleSearch}
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* サイドバー */}
          <div className="w-64 flex-shrink-0">
            <FilterSidebar
              filters={filters}
              onChange={handleFilterChange}
              questionCount={totalCount}
            />
          </div>

          {/* メインコンテンツ */}
          <div className="flex-1">
            {/* アクティブフィルター */}
            <ActiveFilters
              filters={filters}
              onRemove={removeFilter}
              onClear={() => handleFilterChange({})}
            />

            {/* ソートと結果数 */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-600">
                {totalCount > 0 ? `${totalCount}件の質問` : '質問が見つかりません'}
              </p>
              <SortDropdown
                value={filters.sort || 'newest'}
                onChange={handleSortChange}
              />
            </div>

            {/* 質問一覧 */}
            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
                    <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                  </div>
                ))}
              </div>
            ) : questions.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <p className="text-gray-500 mb-4">条件に一致する質問が見つかりません</p>
                <button
                  onClick={() => handleFilterChange({})}
                  className="text-blue-600 hover:underline"
                >
                  フィルターをクリア
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {questions.map((question) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    searchQuery={filters.q}
                  />
                ))}
              </div>
            )}

            {/* ページネーション */}
            {totalCount > 20 && (
              <div className="mt-8 flex justify-center">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    前へ
                  </button>

                  {[...Array(Math.min(5, Math.ceil(totalCount / 20)))].map((_, i) => {
                    const pageNum = i + 1;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`px-4 py-2 border rounded-md ${
                          page === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => setPage(Math.min(Math.ceil(totalCount / 20), page + 1))}
                    disabled={page >= Math.ceil(totalCount / 20)}
                    className="px-4 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    次へ
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}