'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface AnswerFormProps {
  questionId: string;
  onSuccess?: () => void;
}

export default function AnswerForm({ questionId, onSuccess }: AnswerFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    body: '',
    attachments: [] as Array<{ type: string; url: string; name?: string }>,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // 回答を投稿
      const response = await fetch('/api/questions/answers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question_id: questionId,
          body: formData.body,
          attachments: formData.attachments,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '回答の投稿に失敗しました');
      }

      const data = await response.json();

      // フォームをリセット
      setFormData({
        body: '',
        attachments: [],
      });

      // 成功コールバック
      if (onSuccess) {
        onSuccess();
      }

      // ページをリロードして最新の回答を表示
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '予期しないエラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">回答を投稿</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="body" className="block text-sm font-medium text-gray-700 mb-2">
            回答内容 <span className="text-red-500">*</span>
          </label>
          <textarea
            id="body"
            name="body"
            rows={8}
            value={formData.body}
            onChange={(e) => setFormData({ ...formData, body: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
            placeholder="質問に対する回答を入力してください。具体的で実践的な内容を心がけてください。"
            required
            minLength={10}
            maxLength={10000}
          />
          <div className="mt-1 text-xs text-gray-500 text-right">
            {formData.body.length} / 10000文字
          </div>
        </div>

        {/* 添付ファイル機能（簡略版） */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            添付ファイル（オプション）
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-600">
              画像やPDFファイルをドラッグ＆ドロップ
            </p>
            <p className="text-xs text-gray-500 mt-1">
              ※ファイルアップロード機能は後日実装予定
            </p>
          </div>
        </div>

        {/* 注意事項 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                回答投稿時の注意
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc list-inside space-y-1">
                  <li>一度投稿した回答は編集できません</li>
                  <li>質問者がベストアンサーを選択すると報酬の80%が支払われます</li>
                  <li>他の閲覧者がPPV購入すると追加収益が発生する可能性があります</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            disabled={isSubmitting}
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={isSubmitting || formData.body.length < 10}
            className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? '投稿中...' : '回答を投稿'}
          </button>
        </div>
      </form>
    </div>
  );
}