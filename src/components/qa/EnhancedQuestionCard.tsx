'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useState, useEffect } from 'react';

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

interface EnhancedQuestionCardProps {
  question: Question;
  searchQuery?: string;
  onCompareAdd?: (id: string) => void;
}

function CountdownTimer({ deadline }: { deadline: string }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const deadlineDate = new Date(deadline);
      const diff = deadlineDate.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft('締切済み');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        setTimeLeft(`残り${days}日${hours}時間`);
      } else if (hours > 0) {
        setTimeLeft(`残り${hours}時間${minutes}分`);
      } else {
        setTimeLeft(`残り${minutes}分`);
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 60000); // 1分ごとに更新

    return () => clearInterval(timer);
  }, [deadline]);

  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diff = deadlineDate.getTime() - now.getTime();
  const isUrgent = diff < 24 * 60 * 60 * 1000; // 24時間以内

  return (
    <span className={`text-sm ${isUrgent ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
      {timeLeft}
    </span>
  );
}

export default function EnhancedQuestionCard({
  question,
  searchQuery,
  onCompareAdd
}: EnhancedQuestionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // 検索ハイライト処理
  const highlightText = (text: string) => {
    if (!searchQuery || !text) return text;

    try {
      const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      const parts = text.split(regex);

      return parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-200 px-0.5 rounded">
            {part}
          </mark>
        ) : (
          part
        )
      );
    } catch {
      return text;
    }
  };

  // ステータスの色とラベル
  const getStatusBadge = () => {
    switch (question.status) {
      case 'open':
        return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">回答受付中</span>;
      case 'closed':
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded">受付終了</span>;
      case 'resolved':
        return <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">解決済み</span>;
      default:
        return null;
    }
  };

  const bodyPreview = question.body.length > 200 && !isExpanded
    ? question.body.substring(0, 200) + '...'
    : question.body;

  return (
    <div className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow p-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {getStatusBadge()}
            {question.category && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {question.category}
              </span>
            )}
          </div>

          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            <Link href={`/qa/${question.id}`} className="hover:text-blue-600">
              {highlightText(question.title)}
            </Link>
          </h3>

          {/* 品質要件バッジ */}
          <div className="flex flex-wrap gap-2">
            {question.require_photo && (
              <span className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
                写真必須
              </span>
            )}
            {question.require_video && (
              <span className="inline-flex items-center px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>
                動画必須
              </span>
            )}
            {question.min_answer_chars >= 500 && (
              <span className="inline-flex items-center px-2 py-1 bg-green-50 text-green-700 text-xs rounded">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                </svg>
                {question.min_answer_chars}字以上
              </span>
            )}
          </div>
        </div>

        {/* 報酬額と期限 */}
        <div className="text-right ml-4">
          <div className="text-2xl font-bold text-green-600 mb-1">
            ¥{question.bounty_amount.toLocaleString()}
          </div>
          <CountdownTimer deadline={question.deadline_at} />
        </div>
      </div>

      {/* 本文 */}
      <div className="text-gray-700 mb-4 whitespace-pre-wrap">
        {highlightText(bodyPreview)}
        {question.body.length > 200 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="ml-2 text-blue-600 hover:underline text-sm"
          >
            {isExpanded ? '折りたたむ' : '続きを読む'}
          </button>
        )}
      </div>

      {/* タグ */}
      {question.tags && question.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {question.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* メタ情報とアクション */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="flex items-center gap-4 text-sm text-gray-600">
          {/* 投稿者情報 */}
          <div className="flex items-center gap-2">
            {question.asker.avatar_url ? (
              <img
                src={question.asker.avatar_url}
                alt={question.asker.display_name}
                className="w-6 h-6 rounded-full"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs text-white">
                {question.asker.display_name[0]}
              </div>
            )}
            <span>{question.asker.display_name}</span>
            {question.asker.reputation_score && question.asker.reputation_score > 0 && (
              <span className="text-yellow-600">★{question.asker.reputation_score}</span>
            )}
          </div>

          {/* 統計情報 */}
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {question.answer_count} 回答
          </span>
          {question.ppv_sales_count > 0 && (
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {question.ppv_sales_count} PPV
            </span>
          )}
          <span className="text-xs text-gray-500">
            {formatDistanceToNow(new Date(question.created_at), { addSuffix: true, locale: ja })}
          </span>
        </div>

        {/* アクション */}
        <div className="flex gap-2">
          {onCompareAdd && (
            <button
              onClick={() => onCompareAdd(question.id)}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded hover:bg-gray-50"
            >
              比較に追加
            </button>
          )}
          <Link
            href={`/qa/${question.id}`}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            詳細を見る
          </Link>
        </div>
      </div>
    </div>
  );
}