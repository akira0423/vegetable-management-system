'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

interface Transaction {
  id: string;
  type: 'ESCROW' | 'PPV' | 'BEST_ANSWER' | 'PPV_SHARE' | 'PAYOUT' | 'FEE';
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  description: string;
  created_at: string;
  question_id?: string;
  question_title?: string;
}

interface WalletData {
  user_id: string;
  balance_available: number;
  balance_pending: number;
  total_earned: number;
  total_withdrawn: number;
  auto_payout_enabled: boolean;
  auto_payout_threshold: number;
  last_payout_at?: string;
  transactions: Transaction[];
  pending_ppv_shares: number;
}

export default function WalletPage() {
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRequestingPayout, setIsRequestingPayout] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'settings'>('overview');

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      // 開発環境ではテストユーザーIDを使用
      const response = await fetch('/api/questions/wallets/me');
      if (!response.ok) throw new Error('Failed to fetch wallet data');
      const data = await response.json();
      setWallet(data);
    } catch (error) {
      console.error('Error fetching wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePayoutRequest = async () => {
    const amount = parseInt(payoutAmount);
    if (!amount || amount < 1000) {
      alert('出金額は¥1,000以上を指定してください');
      return;
    }

    if (wallet && amount > wallet.balance_available) {
      alert('出金可能額を超えています');
      return;
    }

    setIsRequestingPayout(true);
    try {
      const response = await fetch('/api/questions/payouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
        }),
      });

      if (!response.ok) throw new Error('Failed to request payout');

      alert('出金申請を受け付けました。処理完了まで3〜5営業日かかります。');
      setPayoutAmount('');
      await fetchWalletData();
    } catch (error) {
      console.error('Error requesting payout:', error);
      alert('出金申請に失敗しました');
    } finally {
      setIsRequestingPayout(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">ウォレット情報を取得できませんでした</div>
      </div>
    );
  }

  const transactionTypeLabels: Record<string, string> = {
    ESCROW: 'エスクロー決済',
    PPV: 'PPV購入',
    BEST_ANSWER: 'ベストアンサー報酬',
    PPV_SHARE: 'PPV分配',
    PAYOUT: '出金',
    FEE: '手数料',
  };

  const transactionStatusLabels: Record<string, string> = {
    PENDING: '保留中',
    COMPLETED: '完了',
    FAILED: '失敗',
    REFUNDED: '返金済み',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">ウォレット</h1>
          <p className="text-gray-600 mt-2">報酬の管理と出金申請</p>
        </div>

        {/* タブメニュー */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              概要
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'transactions'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              取引履歴
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'settings'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              設定
            </button>
          </nav>
        </div>

        {/* 概要タブ */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 残高情報 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">残高情報</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">出金可能額</span>
                  <span className="text-2xl font-bold text-green-600">
                    ¥{wallet.balance_available.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">保留中</span>
                  <span className="text-lg font-medium text-yellow-600">
                    ¥{wallet.balance_pending.toLocaleString()}
                  </span>
                </div>
                {wallet.pending_ppv_shares > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">PPV分配待ち</span>
                    <span className="text-lg font-medium text-blue-600">
                      ¥{wallet.pending_ppv_shares.toLocaleString()}
                    </span>
                  </div>
                )}
                <hr className="my-3" />
                <div className="flex justify-between">
                  <span className="text-gray-600">総獲得額</span>
                  <span className="text-lg text-gray-900">
                    ¥{wallet.total_earned.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">総出金額</span>
                  <span className="text-lg text-gray-900">
                    ¥{wallet.total_withdrawn.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* 出金申請 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">出金申請</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="payoutAmount" className="block text-sm font-medium text-gray-700 mb-2">
                    出金額（¥1,000以上）
                  </label>
                  <input
                    id="payoutAmount"
                    type="number"
                    min="1000"
                    max={wallet.balance_available}
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="1000"
                  />
                </div>
                <div className="text-sm text-gray-500">
                  <p>・手数料: ¥250（固定）</p>
                  <p>・処理期間: 3〜5営業日</p>
                  <p>・最小出金額: ¥1,000</p>
                </div>
                <button
                  onClick={handlePayoutRequest}
                  disabled={isRequestingPayout || !payoutAmount || parseInt(payoutAmount) < 1000}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRequestingPayout ? '処理中...' : '出金を申請'}
                </button>
                {wallet.last_payout_at && (
                  <p className="text-sm text-gray-500">
                    最終出金: {formatDistanceToNow(new Date(wallet.last_payout_at), {
                      addSuffix: true,
                      locale: ja
                    })}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 取引履歴タブ */}
        {activeTab === 'transactions' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">取引履歴</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      日時
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      種類
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      説明
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      状態
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      金額
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {wallet.transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(transaction.created_at).toLocaleDateString('ja-JP')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transactionTypeLabels[transaction.type] || transaction.type}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {transaction.question_id ? (
                          <a
                            href={`/questions/${transaction.question_id}`}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            {transaction.question_title || transaction.description}
                          </a>
                        ) : (
                          transaction.description
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          transaction.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-800'
                            : transaction.status === 'PENDING'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {transactionStatusLabels[transaction.status] || transaction.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        <span className={transaction.type === 'PAYOUT' || transaction.type === 'FEE'
                          ? 'text-red-600'
                          : 'text-green-600'
                        }>
                          {transaction.type === 'PAYOUT' || transaction.type === 'FEE' ? '-' : '+'}
                          ¥{transaction.amount.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 設定タブ */}
        {activeTab === 'settings' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">自動出金設定</h2>
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  id="auto-payout"
                  type="checkbox"
                  checked={wallet.auto_payout_enabled}
                  onChange={() => {/* TODO: 実装 */}}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="auto-payout" className="ml-2 block text-sm text-gray-900">
                  自動出金を有効にする
                </label>
              </div>
              {wallet.auto_payout_enabled && (
                <div>
                  <label htmlFor="threshold" className="block text-sm font-medium text-gray-700 mb-2">
                    自動出金しきい値
                  </label>
                  <input
                    id="threshold"
                    type="number"
                    value={wallet.auto_payout_threshold}
                    onChange={() => {/* TODO: 実装 */}}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    残高がこの金額を超えると自動的に出金申請されます
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}