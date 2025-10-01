'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import AnswerList from '@/components/qa/AnswerList';
import AnswerForm from '@/components/qa/AnswerForm';
import PaymentDialog from '@/components/qa/PaymentDialog';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface Question {
  id: string;
  title: string;
  body: string;
  preview: string;
  bounty_amount: number;
  status: string;
  best_answer_id?: string;
  asker_id: string;
  created_at: string;
  deadline_at: string;
  category: string;
  tags: string[];
  asker: {
    display_name: string;
    avatar_url?: string;
  };
}

export default function QuestionDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasFullAccess, setHasFullAccess] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isPurchasingPPV, setIsPurchasingPPV] = useState(false);

  useEffect(() => {
    fetchQuestion();
  }, [id]);

  const fetchQuestion = async () => {
    try {
      // 開発環境でのテストモードチェック
      const headers: HeadersInit = {};
      if (process.env.NODE_ENV !== 'production') {
        const testMode = sessionStorage.getItem('qa_test_mode');
        if (testMode) {
          headers['x-qa-test-mode'] = testMode;
        }
      }

      const response = await fetch(`/api/questions/questions/${id}`, {
        headers
      });
      if (!response.ok) throw new Error('Failed to fetch question');
      const data = await response.json();
      setQuestion(data);

      // APIレスポンスから現在のユーザーIDを取得
      if (data.current_user_id) {
        setCurrentUser(data.current_user_id);
        console.log('Current user ID set:', data.current_user_id);
      } else {
        console.log('No current_user_id in API response');
      }

      // アクセス権限の設定
      if (data.has_full_access) {
        setHasFullAccess(true);
      }
    } catch (error) {
      console.error('Error fetching question:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenFullContent = async () => {
    if (hasFullAccess) return;

    try {
      const response = await fetch(`/api/questions/questions/${id}/open-full`, {
        method: 'POST'
      });

      if (!response.ok) throw new Error('Failed to open full content');

      const data = await response.json();

      if (data.requiresPayment) {
        setShowPaymentDialog(true);
      } else {
        setHasFullAccess(true);
      }
    } catch (error) {
      console.error('Error opening full content:', error);
      alert('全文開封に失敗しました');
    }
  };

  const handleBestAnswerSelected = (answerId: string) => {
    if (question) {
      setQuestion({ ...question, best_answer_id: answerId });
    }
  };

  const handlePPVPurchase = async () => {
    if (isPurchasingPPV) return;

    setIsPurchasingPPV(true);
    try {
      const response = await fetch(`/api/questions/${id}/ppv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'PPV購入に失敗しました');
      }

      alert('PPV購入が完了しました！全ての回答が閲覧可能になりました。');
      await fetchQuestion();
    } catch (error) {
      console.error('PPV purchase error:', error);
      alert(error instanceof Error ? error.message : 'PPV購入に失敗しました');
    } finally {
      setIsPurchasingPPV(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">質問が見つかりませんでした</div>
      </div>
    );
  }

  const statusLabels: Record<string, string> = {
    DRAFT: '下書き',
    PUBLISHED: '公開中',
    FUNDED: '報酬確定',
    ANSWERING: '回答受付中',
    SELECTING: 'ベスト選定中',
    RESOLVED: '解決済み',
    CLOSED: '終了'
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* 質問詳細 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900 flex-1">
              {question.title}
            </h1>
            <span className={`ml-4 px-3 py-1 text-sm rounded-full ${
              question.status === 'RESOLVED'
                ? 'bg-green-100 text-green-800'
                : question.status === 'ANSWERING'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {statusLabels[question.status] || question.status}
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
            <div className="flex items-center gap-2">
              {question.asker.avatar_url ? (
                <img
                  src={question.asker.avatar_url}
                  alt={question.asker.display_name}
                  className="w-6 h-6 rounded-full"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gray-300"></div>
              )}
              <span>{question.asker.display_name}</span>
            </div>
            <span>
              {formatDistanceToNow(new Date(question.created_at), {
                addSuffix: true,
                locale: ja
              })}
            </span>
            <span className="text-green-600 font-medium">
              報酬: ¥{question.bounty_amount.toLocaleString()}
            </span>
          </div>

          <div className="flex gap-2 mb-6">
            {question.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-md"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* 質問本文 */}
          <div className="prose prose-lg max-w-none">
            <div className="whitespace-pre-wrap">{question.body}</div>
          </div>

          {/* PPV購入ボタン（質問者以外でアクセス権がない場合に表示） */}
          {!hasFullAccess && currentUser && currentUser !== question.asker_id && (
            <div className="mt-6 p-6 bg-yellow-50 rounded-lg border border-yellow-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                🔓 全回答を閲覧するにはPPV購入が必要です
              </h3>
              <p className="text-gray-600 mb-4">
                PPVを購入すると、この質問の全ての回答を閲覧できます。
                購入金額は懸賞金と同額の¥{question.bounty_amount.toLocaleString()}です。
              </p>
              <div className="text-sm text-gray-500 mb-4">
                <p>・購入金額の配分：</p>
                <ul className="ml-4">
                  <li>- 運営手数料: 20%</li>
                  <li>- 質問者: 40%</li>
                  <li>- ベストアンサー: 24%</li>
                  <li>- その他の回答者: 16%（均等分配）</li>
                </ul>
              </div>
              <button
                onClick={handlePPVPurchase}
                disabled={isPurchasingPPV}
                className="bg-yellow-600 text-white px-6 py-3 rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {isPurchasingPPV ? '処理中...' : `PPVを購入する（¥${question.bounty_amount.toLocaleString()}）`}
              </button>
            </div>
          )}
        </div>

        {/* 回答一覧 - 常に表示（アクセス制限は各回答の本文で制御） */}
        <AnswerList
          questionId={question.id}
          questionOwnerId={question.asker_id}
          currentUserId={currentUser || undefined}
          bestAnswerId={question.best_answer_id}
          onSelectBest={handleBestAnswerSelected}
        />

        {/* 回答投稿フォーム - フルアクセスがなくても、質問者以外なら投稿可能 */}
        {console.log('Answer form conditions:', {
          currentUser,
          questionAskerId: question.asker_id,
          isNotAsker: currentUser !== question.asker_id,
          bestAnswerId: question.best_answer_id,
          status: question.status,
          statusOk: question.status === 'FUNDED' || question.status === 'ANSWERING',
          deadline: question.deadline_at,
          deadlineOk: !question.deadline_at || new Date(question.deadline_at) > new Date()
        })}
        {currentUser &&
         currentUser !== question.asker_id &&
         !question.best_answer_id &&
         (question.status === 'FUNDED' || question.status === 'ANSWERING') &&
         (!question.deadline_at || new Date(question.deadline_at) > new Date()) && (
          <div className="mt-8">
            <AnswerForm
              questionId={question.id}
              onSuccess={() => {
                // 回答投稿成功時にページをリロード
                window.location.reload();
              }}
            />
          </div>
        )}

        {/* 決済ダイアログ */}
        <PaymentDialog
          isOpen={showPaymentDialog}
          onClose={() => setShowPaymentDialog(false)}
          type="ESCROW"
          amount={question.bounty_amount}
          questionId={question.id}
          onSuccess={() => {
            setHasFullAccess(true);
            setShowPaymentDialog(false);
          }}
        />
      </div>
    </div>
  );
}