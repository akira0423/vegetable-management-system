'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

interface WalletData {
  balance: number;
  pending_amount: number;
  auto_payout_enabled: boolean;
  auto_payout_threshold: number;
  last_payout_at?: string;
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    status: string;
    created_at: string;
    description: string;
  }>;
}

interface WalletBalanceProps {
  userId: string;
}

export default function WalletBalance({ userId }: WalletBalanceProps) {
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTransactions, setShowTransactions] = useState(false);
  const [requestingPayout, setRequestingPayout] = useState(false);

  useEffect(() => {
    fetchWalletData();
  }, [userId]);

  const fetchWalletData = async () => {
    try {
      const response = await fetch(`/api/questions/wallets/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch wallet data');
      const data = await response.json();
      setWalletData(data);
    } catch (error) {
      console.error('Error fetching wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePayoutRequest = async () => {
    if (!walletData || walletData.balance < 1000) {
      alert('出金可能額は¥1,000以上です');
      return;
    }

    setRequestingPayout(true);
    try {
      const response = await fetch('/api/questions/wallets/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: walletData.balance
        })
      });

      if (!response.ok) throw new Error('Failed to request payout');

      alert('出金リクエストを受け付けました');
      await fetchWalletData();
    } catch (error) {
      console.error('Error requesting payout:', error);
      alert('出金リクエストに失敗しました');
    } finally {
      setRequestingPayout(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse bg-gray-200 h-32 rounded-lg"></div>;
  }

  if (!walletData) {
    return <div className="text-gray-500">ウォレット情報を取得できませんでした</div>;
  }

  const transactionTypeLabels: Record<string, string> = {
    'ESCROW_REWARD': 'エスクロー報酬',
    'PPV_ASKER_SHARE': 'PPV質問者分配',
    'PPV_BEST_ANSWER_SHARE': 'PPVベスト回答報酬',
    'PPV_OTHER_ANSWER_SHARE': 'PPVその他回答報酬',
    'PAYOUT_REQUEST': '出金申請',
    'PAYOUT_COMPLETED': '出金完了',
    'PLATFORM_FEE': 'プラットフォーム手数料'
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">ウォレット残高</h2>
        <button
          onClick={() => setShowTransactions(!showTransactions)}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          {showTransactions ? '取引履歴を隠す' : '取引履歴を表示'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="text-sm text-gray-500 mb-1">利用可能残高</div>
          <div className="text-3xl font-bold text-gray-900">
            ¥{walletData.balance.toLocaleString()}
          </div>
        </div>

        {walletData.pending_amount > 0 && (
          <div>
            <div className="text-sm text-gray-500 mb-1">
              保留中（PPVベスト選定待ち）
              <span className="ml-1 text-xs text-orange-600">
                ※ベスト選定後に反映
              </span>
            </div>
            <div className="text-2xl font-semibold text-orange-600">
              ¥{walletData.pending_amount.toLocaleString()}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700">自動出金</span>
          <span className={`text-sm ${walletData.auto_payout_enabled ? 'text-green-600' : 'text-gray-500'}`}>
            {walletData.auto_payout_enabled ? 'ON' : 'OFF'}
          </span>
        </div>
        {walletData.auto_payout_enabled && (
          <div className="text-xs text-gray-600">
            残高が ¥{walletData.auto_payout_threshold.toLocaleString()} を超えたら自動出金
          </div>
        )}
        {walletData.last_payout_at && (
          <div className="text-xs text-gray-500 mt-2">
            最終出金: {formatDistanceToNow(new Date(walletData.last_payout_at), {
              addSuffix: true,
              locale: ja
            })}
          </div>
        )}
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={handlePayoutRequest}
          disabled={walletData.balance < 1000 || requestingPayout}
          className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {requestingPayout ? '処理中...' : '出金申請'}
        </button>
        <button
          onClick={() => fetchWalletData()}
          className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          更新
        </button>
      </div>

      <div className="mt-3 text-xs text-gray-500">
        ※ 出金手数料: ¥250/回　最低出金額: ¥1,000
      </div>

      {showTransactions && walletData.transactions.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3">取引履歴</h3>
          <div className="space-y-2">
            {walletData.transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    {transactionTypeLabels[tx.type] || tx.type}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(tx.created_at), {
                      addSuffix: true,
                      locale: ja
                    })}
                  </div>
                </div>
                <div className={`text-sm font-semibold ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {tx.amount > 0 ? '+' : ''}¥{Math.abs(tx.amount).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}