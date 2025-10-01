import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import TestModeToggle from '@/components/qa/TestModeToggle';

async function getQuestions() {
  // In production, this would be a server-side fetch
  return [
    {
      id: '1',
      title: '水稲の病害虫対策について',
      preview: '今年の稲作で病害虫被害が多く...',
      bounty_amount: 5000,
      status: 'ANSWERING',
      answer_count: 3,
      created_at: new Date().toISOString(),
      category: 'CROPS',
      tags: ['水稲', '病害虫'],
      asker: {
        display_name: '農家太郎'
      }
    }
  ];
}

export default async function QAPage() {
  const questions = await getQuestions();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Q&Aプラットフォーム</h1>
            <p className="text-gray-600 mt-2">農業の疑問を解決する報酬型Q&Aサービス</p>
          </div>
          <Link
            href="/questions/new"
            className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 font-medium"
          >
            質問を投稿
          </Link>
        </div>

        {/* 開発環境でのテストモード切り替え */}
        <TestModeToggle />

        {/* カテゴリーフィルター */}
        <div className="mb-6 flex gap-2 flex-wrap">
          <button className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
            すべて
          </button>
          <button className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
            農業技術
          </button>
          <button className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
            作物栽培
          </button>
          <button className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
            農機具・設備
          </button>
          <button className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
            経営・販売
          </button>
        </div>

        {/* 質問一覧 */}
        <div className="space-y-4">
          {questions.map((question) => (
            <Link
              key={question.id}
              href={`/questions/${question.id}`}
              className="block bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    {question.title}
                  </h2>
                  <p className="text-gray-600 mb-3">
                    {question.preview}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>{question.asker.display_name}</span>
                    <span>
                      {formatDistanceToNow(new Date(question.created_at), {
                        addSuffix: true,
                        locale: ja
                      })}
                    </span>
                    <span>{question.answer_count} 回答</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    {question.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-md"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="ml-6 text-right">
                  <div className="text-2xl font-bold text-green-600">
                    ¥{question.bounty_amount.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">報酬</div>
                  <div className="mt-2">
                    <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                      question.status === 'ANSWERING'
                        ? 'bg-blue-100 text-blue-800'
                        : question.status === 'RESOLVED'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {question.status === 'ANSWERING' ? '回答受付中' :
                       question.status === 'RESOLVED' ? '解決済み' :
                       question.status === 'PUBLISHED' ? '公開中' : question.status}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {questions.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">まだ質問がありません</p>
            <Link
              href="/qa/new"
              className="mt-4 inline-block text-blue-600 hover:text-blue-800"
            >
              最初の質問を投稿する
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}