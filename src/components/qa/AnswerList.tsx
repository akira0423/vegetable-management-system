'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

interface Answer {
  id: string;
  body: string;
  created_at: string;
  is_best: boolean;
  responder_id: string;
  responder?: {
    display_name: string;
    avatar_url?: string;
  };
  vote_count: number;
}

interface AnswerListProps {
  questionId: string;
  questionOwnerId?: string;
  currentUserId?: string;
  bestAnswerId?: string;
  onSelectBest?: (answerId: string) => void;
}

export default function AnswerList({
  questionId,
  questionOwnerId,
  currentUserId,
  bestAnswerId,
  onSelectBest
}: AnswerListProps) {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAnswer, setNewAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAnswers();
  }, [questionId]);

  const fetchAnswers = async () => {
    try {
      const response = await fetch(`/api/questions/answers?questionId=${questionId}`);
      if (!response.ok) throw new Error('Failed to fetch answers');
      const data = await response.json();
      setAnswers(data);
    } catch (error) {
      console.error('Error fetching answers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnswer.trim()) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/questions/answers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question_id: questionId,
          body: newAnswer,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        throw new Error(errorData.error || 'Failed to submit answer');
      }

      setNewAnswer('');
      await fetchAnswers();
    } catch (error) {
      console.error('Error submitting answer:', error);
      alert(`回答の投稿に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectBest = async (answerId: string) => {
    if (!confirm('この回答をベストアンサーに選定しますか？この操作は取り消せません。')) {
      return;
    }

    try {
      const response = await fetch(`/api/questions/answers/${answerId}/best`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to select best answer');

      if (onSelectBest) {
        onSelectBest(answerId);
      }
      await fetchAnswers();
    } catch (error) {
      console.error('Error selecting best answer:', error);
      alert('ベストアンサーの選定に失敗しました');
    }
  };

  if (loading) {
    return <div className="text-center py-8">読み込み中...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">
        回答 ({answers.length}件)
      </h2>

      {/* 回答一覧 */}
      <div className="space-y-4">
        {answers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            まだ回答がありません
          </div>
        ) : (
          answers.map((answer) => (
            <div
              key={answer.id}
              className={`bg-white rounded-lg shadow-sm border ${
                answer.is_best || answer.id === bestAnswerId
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200'
              } p-6`}
            >
              {(answer.is_best || answer.id === bestAnswerId) && (
                <div className="mb-3">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    ✓ ベストアンサー
                  </span>
                </div>
              )}

              <div className="flex items-start gap-4">
                {answer.responder?.avatar_url ? (
                  <img
                    src={answer.responder.avatar_url}
                    alt={answer.responder.display_name}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                    <span className="text-gray-600 text-sm">
                      {answer.responder?.display_name?.[0] || '?'}
                    </span>
                  </div>
                )}

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-gray-900">
                      {answer.responder?.display_name || '匿名ユーザー'}
                    </span>
                    <span className="text-sm text-gray-500">
                      {formatDistanceToNow(new Date(answer.created_at), {
                        addSuffix: true,
                        locale: ja,
                      })}
                    </span>
                  </div>

                  <div className="prose prose-sm max-w-none text-gray-700">
                    {answer.body.split('\n').map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center gap-4">
                    {questionOwnerId === currentUserId &&
                     !bestAnswerId &&
                     answer.responder_id !== currentUserId && (
                      <button
                        onClick={() => handleSelectBest(answer.id)}
                        className="text-sm bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                      >
                        ベストアンサーに選ぶ
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 回答投稿フォーム */}
      {currentUserId && currentUserId !== questionOwnerId && !bestAnswerId && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">回答を投稿</h3>
          <form onSubmit={handleSubmitAnswer}>
            <textarea
              value={newAnswer}
              onChange={(e) => setNewAnswer(e.target.value)}
              rows={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="回答を入力してください..."
              disabled={submitting}
            />
            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={submitting || !newAnswer.trim()}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? '投稿中...' : '回答を投稿'}
              </button>
            </div>
          </form>
        </div>
      )}

      {bestAnswerId && (
        <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-600">
          ベストアンサーが選定されたため、新しい回答は受け付けていません
        </div>
      )}
    </div>
  );
}