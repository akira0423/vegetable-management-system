'use client';

import { useState, useRef, useEffect } from 'react';

interface SearchBarProps {
  initialValue?: string;
  onSearch: (query: string) => void;
}

export default function SearchBar({ initialValue = '', onSearch }: SearchBarProps) {
  const [query, setQuery] = useState(initialValue);
  const [showHelp, setShowHelp] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setQuery(initialValue || '');
  }, [initialValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  const handleClear = () => {
    setQuery('');
    onSearch('');
    inputRef.current?.focus();
  };

  // クエリ構文のヘルプテキスト
  const getQueryHelp = () => {
    const helps = [];
    if (query.includes('"')) helps.push('完全一致検索');
    if (query.includes('-')) helps.push('除外検索');
    if (query.includes('#')) helps.push('タグ検索');
    return helps.join(' / ');
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="relative">
        {/* 検索アイコン */}
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>

        {/* 検索入力 */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="キーワード、#タグ、作物名..."
          className="w-full pl-12 pr-32 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        {/* クエリヘルプ */}
        {getQueryHelp() && (
          <span className="absolute right-28 top-1/2 -translate-y-1/2 text-xs text-gray-500">
            {getQueryHelp()}
          </span>
        )}

        {/* クリアボタン */}
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-20 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}

        {/* 検索ボタン */}
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          検索
        </button>
      </div>

      {/* 検索のヒント */}
      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowHelp(!showHelp)}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          検索のヒント {showHelp ? '▲' : '▼'}
        </button>

        {/* 人気の検索キーワード */}
        <div className="flex gap-2 text-xs">
          <span className="text-gray-500">人気:</span>
          {['トマト', 'うどんこ病', '有機栽培', '病害虫'].map((keyword) => (
            <button
              key={keyword}
              type="button"
              onClick={() => {
                setQuery(keyword);
                onSearch(keyword);
              }}
              className="text-blue-600 hover:underline"
            >
              {keyword}
            </button>
          ))}
        </div>
      </div>

      {/* 検索ヒント展開 */}
      {showHelp && (
        <div className="mt-2 p-3 bg-blue-50 rounded-lg text-sm">
          <p className="font-semibold mb-2">検索方法:</p>
          <ul className="space-y-1 text-gray-700">
            <li>• <code>"完全一致"</code> - 引用符で囲むと完全一致検索</li>
            <li>• <code>-除外</code> - マイナスを付けると除外検索</li>
            <li>• <code>#タグ</code> - ハッシュタグでタグ検索</li>
            <li>• <code>トマト うどんこ病</code> - スペース区切りでAND検索</li>
          </ul>
        </div>
      )}
    </form>
  );
}