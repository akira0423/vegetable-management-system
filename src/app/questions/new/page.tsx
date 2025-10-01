import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import QuestionForm from '@/components/qa/QuestionForm';

export default async function NewQuestionPage() {
  // 既存システムの認証を使用（ダッシュボードと同じ）
  const user = await getCurrentUser();

  // 未ログインの場合はログインページへリダイレクト
  if (!user) {
    redirect('/login?redirect=/questions/new');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">新しい質問を投稿</h1>
          <p className="text-gray-600 mt-2">
            農業に関する質問を投稿し、専門家からの回答を得ましょう
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <QuestionForm />
        </div>
      </div>
    </div>
  );
}