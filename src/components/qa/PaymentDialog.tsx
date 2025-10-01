'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';

interface PaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'ESCROW' | 'PPV';
  amount: number;
  questionId: string;
  onSuccess?: () => void;
}

// Stripeキーを条件付きで読み込み（開発環境では無効化）
const stripePromise = process.env.NEXT_PUBLIC_QA_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_QA_STRIPE_PUBLISHABLE_KEY)
  : null;

export default function PaymentDialog({
  isOpen,
  onClose,
  type,
  amount,
  questionId,
  onSuccess
}: PaymentDialogProps) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePayment = async () => {
    setProcessing(true);
    setError(null);

    try {
      // 開発環境ではStripe決済をスキップ
      if (process.env.NODE_ENV !== 'production' || !stripePromise) {
        console.log('開発環境: 決済をスキップします');
        if (onSuccess) {
          onSuccess();
        }
        onClose();
        return;
      }

      if (type === 'ESCROW') {
        // エスクロー決済（与信枠確保）
        const response = await fetch('/api/questions/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionId, amount })
        });

        if (!response.ok) {
          throw new Error('決済の準備に失敗しました');
        }

        const { clientSecret } = await response.json();
        const stripe = await stripePromise;

        if (!stripe) {
          throw new Error('Stripeの初期化に失敗しました');
        }

        // Stripeの決済フォームにリダイレクト（実装簡略化のため）
        alert('決済フォームへリダイレクトします（実装簡略化）');

      } else if (type === 'PPV') {
        // PPV決済
        const response = await fetch('/api/questions/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionId,
            amount,
            accessLogId: 'temp-access-log-id' // 実際にはアクセスログIDを渡す
          })
        });

        if (!response.ok) {
          throw new Error('PPV決済に失敗しました');
        }
      }

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '決済処理中にエラーが発生しました');
    } finally {
      setProcessing(false);
    }
  };

  const getBreakdown = () => {
    if (type === 'ESCROW') {
      return {
        platform: amount * 0.2,
        responder: amount * 0.8
      };
    } else {
      return {
        platform: amount * 0.2,
        asker: amount * 0.4,
        bestAnswer: amount * 0.24,
        others: amount * 0.16
      };
    }
  };

  const breakdown = getBreakdown();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">
            {type === 'ESCROW' ? '質問報酬の決済' : 'PPV決済'}
          </h2>

          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-900 mb-2">
                ¥{amount.toLocaleString()}
              </div>

              <div className="space-y-2 text-sm">
                <div className="font-medium text-gray-700 mb-1">内訳:</div>

                {type === 'ESCROW' ? (
                  <>
                    <div className="flex justify-between">
                      <span>運営手数料 (20%)</span>
                      <span className="font-medium">¥{breakdown.platform.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>回答者報酬 (80%)</span>
                      <span className="font-medium">¥{breakdown.responder.toLocaleString()}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span>運営手数料 (20%)</span>
                      <span className="font-medium">¥{breakdown.platform.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-green-600">
                      <span>質問者 (40% - 即時)</span>
                      <span className="font-medium">¥{breakdown.asker.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-orange-600">
                      <span>ベスト回答 (24% - 保留)</span>
                      <span className="font-medium">¥{breakdown.bestAnswer.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-orange-600">
                      <span>その他回答 (16% - 保留)</span>
                      <span className="font-medium">¥{breakdown.others.toLocaleString()}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {type === 'ESCROW' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                <p className="font-medium mb-1">エスクロー決済について</p>
                <ul className="space-y-1 text-xs">
                  <li>• 今は与信枠の確保のみ行われます</li>
                  <li>• 実際の決済はベストアンサー選定時</li>
                  <li>• 7日以内に選定がない場合は再与信が必要</li>
                </ul>
              </div>
            )}

            {type === 'PPV' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700">
                <p className="font-medium mb-1">PPV分配について</p>
                <ul className="space-y-1 text-xs">
                  <li>• 質問者への40%は即座に付与</li>
                  <li>• ベスト/その他回答者分はベスト選定後に分配</li>
                  <li>• ベスト未選定の場合は質問者に返還</li>
                </ul>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handlePayment}
              disabled={processing}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? '処理中...' : '決済する'}
            </button>
            <button
              onClick={onClose}
              disabled={processing}
              className="flex-1 border border-gray-300 px-4 py-2 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              キャンセル
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}