'use client';

import { useState, useEffect, useRef } from 'react';

interface SearchSuggestionsProps {
  query: string;
  onSelect: (suggestion: string) => void;
  onClose: () => void;
}

interface Suggestion {
  type: 'recent' | 'popular' | 'tag' | 'crop' | 'disease';
  value: string;
  count?: number;
}

export default function SearchSuggestions({ query, onSelect, onClose }: SearchSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // クリック外を検知して閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // サジェスト取得
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (query.length < 2) {
        // デフォルトのサジェスト表示
        setSuggestions([
          { type: 'popular', value: 'トマト うどんこ病', count: 234 },
          { type: 'popular', value: '有機栽培 方法', count: 189 },
          { type: 'popular', value: '病害虫 対策', count: 156 },
          { type: 'tag', value: '#初心者', count: 89 },
          { type: 'tag', value: '#緊急', count: 45 },
          { type: 'crop', value: 'きゅうり', count: 123 },
          { type: 'disease', value: 'アブラムシ', count: 98 }
        ]);
        return;
      }

      setLoading(true);
      try {
        // API呼び出しのシミュレーション
        await new Promise(resolve => setTimeout(resolve, 100));

        // クエリに基づいたサジェスト生成
        const dynamicSuggestions: Suggestion[] = [];

        // 部分一致する作物
        const crops = ['トマト', 'きゅうり', 'なす', 'ピーマン', 'レタス', 'キャベツ'];
        crops.forEach(crop => {
          if (crop.includes(query)) {
            dynamicSuggestions.push({ type: 'crop', value: crop, count: Math.floor(Math.random() * 200) });
          }
        });

        // 部分一致する病害虫
        const diseases = ['うどんこ病', 'べと病', '灰色かび病', 'アブラムシ', 'ハダニ'];
        diseases.forEach(disease => {
          if (disease.includes(query)) {
            dynamicSuggestions.push({ type: 'disease', value: disease, count: Math.floor(Math.random() * 150) });
          }
        });

        // 関連するタグ
        if (query.includes('#')) {
          dynamicSuggestions.push(
            { type: 'tag', value: '#' + query.replace('#', ''), count: Math.floor(Math.random() * 100) }
          );
        }

        // クエリを含む人気の検索
        dynamicSuggestions.push(
          { type: 'popular', value: query + ' 対策', count: Math.floor(Math.random() * 300) },
          { type: 'popular', value: query + ' 原因', count: Math.floor(Math.random() * 250) },
          { type: 'popular', value: query + ' 予防', count: Math.floor(Math.random() * 200) }
        );

        setSuggestions(dynamicSuggestions.slice(0, 8));
      } catch (error) {
        console.error('Failed to fetch suggestions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestions();
  }, [query]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'recent':
        return '🕐';
      case 'popular':
        return '🔥';
      case 'tag':
        return '#';
      case 'crop':
        return '🌱';
      case 'disease':
        return '🦠';
      default:
        return '🔍';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'recent':
        return '最近の検索';
      case 'popular':
        return '人気の検索';
      case 'tag':
        return 'タグ';
      case 'crop':
        return '作物';
      case 'disease':
        return '病害虫';
      default:
        return '';
    }
  };

  if (suggestions.length === 0 && !loading) {
    return null;
  }

  return (
    <div
      ref={suggestionsRef}
      className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto"
    >
      {loading ? (
        <div className="p-4 text-center text-gray-500">
          <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
        </div>
      ) : (
        <>
          {/* サジェストヘッダー */}
          <div className="px-4 py-2 border-b bg-gray-50">
            <span className="text-xs text-gray-600">検索候補</span>
          </div>

          {/* サジェストリスト */}
          <ul className="py-2">
            {suggestions.map((suggestion, index) => (
              <li key={index}>
                <button
                  onClick={() => onSelect(suggestion.value)}
                  className="w-full px-4 py-2 text-left hover:bg-blue-50 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg opacity-60">{getIcon(suggestion.type)}</span>
                    <div>
                      <div className="text-sm font-medium text-gray-900 group-hover:text-blue-600">
                        {suggestion.value}
                      </div>
                      <div className="text-xs text-gray-500">{getTypeLabel(suggestion.type)}</div>
                    </div>
                  </div>
                  {suggestion.count && (
                    <span className="text-xs text-gray-400">{suggestion.count}件</span>
                  )}
                </button>
              </li>
            ))}
          </ul>

          {/* 検索ヒント */}
          <div className="px-4 py-3 border-t bg-gray-50">
            <p className="text-xs text-gray-600">
              <span className="font-medium">ヒント:</span> "完全一致"、-除外、#タグで絞り込み
            </p>
          </div>
        </>
      )}
    </div>
  );
}