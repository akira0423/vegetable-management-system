'use client';

import { useState, useEffect, use } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface PublicProfile {
  user_id: string;
  display_name: string;
  avatar_url?: string;
  bio?: string;
  expertise_areas: string[];
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  reputation_score: number;
  total_answers: number;
  total_best_answers: number;
  best_answer_rate: number;
  created_at: string;
  stats?: {
    total_questions: number;
    total_earned: number;
    last_answer_at?: string;
    last_question_at?: string;
  };
  recent_answers?: Array<{
    id: string;
    question_id: string;
    question_title: string;
    is_best: boolean;
    created_at: string;
  }>;
  recent_questions?: Array<{
    id: string;
    title: string;
    status: string;
    bounty_amount: number;
    answer_count: number;
    created_at: string;
  }>;
}

export default function PublicProfilePage({ params }: PageProps) {
  const { id } = use(params);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'answers' | 'questions'>('answers');

  useEffect(() => {
    fetchProfile();
  }, [id]);

  const fetchProfile = async () => {
    try {
      const response = await fetch(`/api/questions/users/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          setProfile(null);
        }
        throw new Error('Failed to fetch profile');
      }
      const data = await response.json();
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">ユーザーが見つかりませんでした</div>
      </div>
    );
  }

  const tierColors = {
    BRONZE: 'bg-orange-100 text-orange-800',
    SILVER: 'bg-gray-100 text-gray-800',
    GOLD: 'bg-yellow-100 text-yellow-800',
    PLATINUM: 'bg-purple-100 text-purple-800',
  };

  const tierLabels = {
    BRONZE: 'ブロンズ',
    SILVER: 'シルバー',
    GOLD: 'ゴールド',
    PLATINUM: 'プラチナ',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* プロフィールヘッダー */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start gap-6">
            {/* アバター */}
            <div className="flex-shrink-0">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name}
                  className="w-24 h-24 rounded-full"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gray-300 flex items-center justify-center">
                  <span className="text-gray-600 text-3xl">
                    {profile.display_name?.[0] || '?'}
                  </span>
                </div>
              )}
            </div>

            {/* プロフィール情報 */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900">
                  {profile.display_name}
                </h1>
                <span className={`px-3 py-1 text-sm rounded-full font-medium ${tierColors[profile.tier]}`}>
                  {tierLabels[profile.tier]}
                </span>
              </div>

              {profile.bio && (
                <p className="text-gray-700 mb-4">{profile.bio}</p>
              )}

              {/* 専門分野タグ */}
              {profile.expertise_areas && profile.expertise_areas.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {profile.expertise_areas.map((area) => (
                    <span
                      key={area}
                      className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-md"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              )}

              {/* 統計情報 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    {profile.total_answers}
                  </div>
                  <div className="text-sm text-gray-600">回答数</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {profile.total_best_answers}
                  </div>
                  <div className="text-sm text-gray-600">ベストアンサー</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {profile.best_answer_rate}%
                  </div>
                  <div className="text-sm text-gray-600">採用率</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-600">
                    {profile.reputation_score}
                  </div>
                  <div className="text-sm text-gray-600">評価スコア</div>
                </div>
              </div>

              {/* 追加統計 */}
              {profile.stats && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    <span>
                      質問数: {profile.stats.total_questions}
                    </span>
                    <span>
                      総獲得額: ¥{profile.stats.total_earned.toLocaleString()}
                    </span>
                    {profile.stats.last_answer_at && (
                      <span>
                        最終回答: {formatDistanceToNow(new Date(profile.stats.last_answer_at), {
                          addSuffix: true,
                          locale: ja
                        })}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* アクティビティタブ */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex">
              <button
                onClick={() => setActiveTab('answers')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'answers'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                最近の回答
              </button>
              <button
                onClick={() => setActiveTab('questions')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'questions'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                投稿した質問
              </button>
            </nav>
          </div>

          <div className="p-6">
            {/* 最近の回答 */}
            {activeTab === 'answers' && (
              <div className="space-y-4">
                {profile.recent_answers && profile.recent_answers.length > 0 ? (
                  profile.recent_answers.map((answer) => (
                    <Link
                      key={answer.id}
                      href={`/questions/${answer.question_id}`}
                      className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900 mb-1">
                            {answer.question_title}
                          </h3>
                          <div className="flex items-center gap-3 text-sm text-gray-600">
                            {answer.is_best && (
                              <span className="px-2 py-1 bg-green-100 text-green-800 rounded-md">
                                ✓ ベストアンサー
                              </span>
                            )}
                            <span>
                              {formatDistanceToNow(new Date(answer.created_at), {
                                addSuffix: true,
                                locale: ja
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    まだ回答がありません
                  </div>
                )}
              </div>
            )}

            {/* 投稿した質問 */}
            {activeTab === 'questions' && (
              <div className="space-y-4">
                {profile.recent_questions && profile.recent_questions.length > 0 ? (
                  profile.recent_questions.map((question) => (
                    <Link
                      key={question.id}
                      href={`/questions/${question.id}`}
                      className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900 mb-1">
                            {question.title}
                          </h3>
                          <div className="flex items-center gap-3 text-sm text-gray-600">
                            <span className="text-green-600">
                              ¥{question.bounty_amount.toLocaleString()}
                            </span>
                            <span>{question.answer_count} 回答</span>
                            <span>
                              {formatDistanceToNow(new Date(question.created_at), {
                                addSuffix: true,
                                locale: ja
                              })}
                            </span>
                          </div>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          question.status === 'RESOLVED'
                            ? 'bg-green-100 text-green-800'
                            : question.status === 'ANSWERING'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {question.status === 'RESOLVED' ? '解決済み' :
                           question.status === 'ANSWERING' ? '回答受付中' :
                           question.status}
                        </span>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    まだ質問がありません
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}