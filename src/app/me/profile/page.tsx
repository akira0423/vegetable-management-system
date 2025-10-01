'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface UserProfile {
  user_id: string;
  email?: string;
  display_name: string;
  avatar_url?: string;
  bio?: string;
  expertise_areas: string[];
  tier: string;
  reputation_score: number;
  total_answers: number;
  total_best_answers: number;
  best_answer_rate: number;
  // 請求先情報
  invoice_registration_no?: string;
  company_name?: string;
  billing_address?: string;
  // ウォレット情報
  wallet?: {
    balance_available: number;
    balance_pending: number;
    total_earned: number;
  };
  // Stripe Connect状態
  stripe_account_status?: string;
  stripe_onboarding_complete?: boolean;
}

export default function MyProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    display_name: '',
    bio: '',
    expertise_areas: '',
    invoice_registration_no: '',
    company_name: '',
    billing_address: '',
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/questions/profile');
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/auth/login');
          return;
        }
        throw new Error('Failed to fetch profile');
      }
      const data = await response.json();
      setProfile(data);
      setFormData({
        display_name: data.display_name || '',
        bio: data.bio || '',
        expertise_areas: data.expertise_areas?.join(', ') || '',
        invoice_registration_no: data.invoice_registration_no || '',
        company_name: data.company_name || '',
        billing_address: data.billing_address || '',
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/questions/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          display_name: formData.display_name,
          bio: formData.bio,
          expertise_areas: formData.expertise_areas
            .split(',')
            .map(s => s.trim())
            .filter(Boolean),
          invoice_registration_no: formData.invoice_registration_no,
          company_name: formData.company_name,
          billing_address: formData.billing_address,
        }),
      });

      if (!response.ok) throw new Error('Failed to update profile');

      await fetchProfile();
      setEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('プロフィールの更新に失敗しました');
    } finally {
      setSaving(false);
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
        <div className="text-gray-500">プロフィールを取得できませんでした</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">マイプロフィール</h1>
          <div className="flex gap-2">
            <Link
              href={`/u/${profile.user_id}`}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              公開プロフィールを見る
            </Link>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                編集
              </button>
            )}
          </div>
        </div>

        {/* 基本情報 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">基本情報</h2>

          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  表示名
                </label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  自己紹介
                </label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  専門分野（カンマ区切り）
                </label>
                <input
                  type="text"
                  value={formData.expertise_areas}
                  onChange={(e) => setFormData({ ...formData, expertise_areas: e.target.value })}
                  placeholder="有機栽培, 病害虫対策, 土壌改良"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.display_name}
                    className="w-16 h-16 rounded-full"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center">
                    <span className="text-gray-600 text-xl">
                      {profile.display_name?.[0] || '?'}
                    </span>
                  </div>
                )}
                <div>
                  <div className="text-xl font-medium text-gray-900">
                    {profile.display_name}
                  </div>
                  <div className="text-sm text-gray-600">{profile.email}</div>
                </div>
              </div>

              {profile.bio && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">自己紹介</div>
                  <div className="text-gray-900">{profile.bio}</div>
                </div>
              )}

              {profile.expertise_areas && profile.expertise_areas.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">専門分野</div>
                  <div className="flex flex-wrap gap-2">
                    {profile.expertise_areas.map((area) => (
                      <span
                        key={area}
                        className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-md"
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 請求先情報 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">請求先情報</h2>

          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  適格請求書発行事業者登録番号
                </label>
                <input
                  type="text"
                  value={formData.invoice_registration_no}
                  onChange={(e) => setFormData({ ...formData, invoice_registration_no: e.target.value })}
                  placeholder="T1234567890123"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  会社名
                </label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  請求先住所
                </label>
                <textarea
                  value={formData.billing_address}
                  onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium text-gray-700">登録番号</div>
                <div className="text-gray-900">
                  {profile.invoice_registration_no || '未設定'}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-700">会社名</div>
                <div className="text-gray-900">
                  {profile.company_name || '未設定'}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-700">請求先住所</div>
                <div className="text-gray-900">
                  {profile.billing_address || '未設定'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ウォレット情報 */}
        {profile.wallet && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">ウォレット情報</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-sm font-medium text-gray-700">出金可能額</div>
                <div className="text-2xl font-bold text-green-600">
                  ¥{profile.wallet.balance_available.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-700">保留中</div>
                <div className="text-xl font-medium text-yellow-600">
                  ¥{profile.wallet.balance_pending.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-700">総獲得額</div>
                <div className="text-xl font-medium text-gray-900">
                  ¥{profile.wallet.total_earned.toLocaleString()}
                </div>
              </div>
            </div>
            <div className="mt-4">
              <Link
                href="/wallet"
                className="text-blue-600 hover:text-blue-800"
              >
                ウォレット詳細を見る →
              </Link>
            </div>
          </div>
        )}

        {/* 実績 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">実績</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {profile.total_answers}
              </div>
              <div className="text-sm text-gray-600">回答数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {profile.total_best_answers}
              </div>
              <div className="text-sm text-gray-600">ベストアンサー</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {profile.best_answer_rate}%
              </div>
              <div className="text-sm text-gray-600">採用率</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {profile.reputation_score}
              </div>
              <div className="text-sm text-gray-600">評価スコア</div>
            </div>
          </div>
        </div>

        {/* 編集時のボタン */}
        {editing && (
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={() => {
                setEditing(false);
                setFormData({
                  display_name: profile.display_name || '',
                  bio: profile.bio || '',
                  expertise_areas: profile.expertise_areas?.join(', ') || '',
                  invoice_registration_no: profile.invoice_registration_no || '',
                  company_name: profile.company_name || '',
                  billing_address: profile.billing_address || '',
                });
              }}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}