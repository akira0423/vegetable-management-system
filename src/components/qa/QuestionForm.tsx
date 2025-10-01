'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface QuestionFormProps {
  onSuccess?: (questionId: string) => void;
}

export default function QuestionForm({ onSuccess }: QuestionFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    body: '',
    preview: '',
    bountyAmount: 1000,
    category: 'GENERAL',
    tags: '',
    // 回答品質要件
    minAnswerChars: 0,
    requirePhoto: false,
    requirePhotoMin: 1,
    requireVideo: false,
    requireVideoMin: 1,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/questions/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          body: formData.body,
          preview: formData.preview || formData.body.substring(0, 200),
          bounty_amount: formData.bountyAmount,
          category: formData.category,
          tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
          deadline_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7日後
          // 回答品質要件
          requirements: {
            min_answer_chars: formData.minAnswerChars,
            require_photo: formData.requirePhoto,
            require_photo_min: formData.requirePhotoMin,
            require_video: formData.requireVideo,
            require_video_min: formData.requireVideoMin,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create question');
      }

      const data = await response.json();

      if (onSuccess) {
        onSuccess(data.id);
      } else {
        router.push(`/questions/${data.id}`);
      }
    } catch (error) {
      console.error('Error creating question:', error);
      alert('質問の作成に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto p-6">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
          タイトル *
        </label>
        <input
          type="text"
          id="title"
          required
          maxLength={200}
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="質問のタイトルを入力してください"
        />
      </div>

      <div>
        <label htmlFor="preview" className="block text-sm font-medium text-gray-700 mb-2">
          プレビュー（無料公開部分）
        </label>
        <textarea
          id="preview"
          rows={3}
          maxLength={500}
          value={formData.preview}
          onChange={(e) => setFormData({ ...formData, preview: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="誰でも見られる部分（未入力の場合、本文の先頭200文字）"
        />
      </div>

      <div>
        <label htmlFor="body" className="block text-sm font-medium text-gray-700 mb-2">
          本文 *
        </label>
        <textarea
          id="body"
          required
          rows={10}
          value={formData.body}
          onChange={(e) => setFormData({ ...formData, body: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="質問の詳細を入力してください"
        />
      </div>

      <div>
        <label htmlFor="bounty" className="block text-sm font-medium text-gray-700 mb-2">
          報酬金額（円）*
        </label>
        <div className="relative">
          <input
            type="number"
            id="bounty"
            required
            min={100}
            max={100000}
            step={100}
            value={formData.bountyAmount}
            onChange={(e) => setFormData({ ...formData, bountyAmount: parseInt(e.target.value) || 0 })}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <div className="mt-2 text-sm text-gray-600">
            <p>• 最小: ¥100 / 最大: ¥100,000</p>
            <p className="text-red-600 font-medium">• 手数料20%が含まれます（回答者受取額: ¥{Math.floor(formData.bountyAmount * 0.8)}）</p>
            <p>• 決済は回答者選定時に確定します</p>
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
          カテゴリー
        </label>
        <select
          id="category"
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="GENERAL">一般</option>
          <option value="FARMING">農業技術</option>
          <option value="EQUIPMENT">農機具・設備</option>
          <option value="CROPS">作物栽培</option>
          <option value="LIVESTOCK">畜産</option>
          <option value="BUSINESS">経営・販売</option>
          <option value="OTHER">その他</option>
        </select>
      </div>

      <div>
        <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-2">
          タグ（カンマ区切り）
        </label>
        <input
          type="text"
          id="tags"
          value={formData.tags}
          onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="例: 水稲, 病害虫, 有機栽培"
        />
      </div>

      {/* 回答品質要件設定 */}
      <div className="border border-gray-200 rounded-md p-4 space-y-4">
        <h3 className="font-semibold text-gray-900">回答品質要件（オプション）</h3>

        <div>
          <label htmlFor="minAnswerChars" className="block text-sm font-medium text-gray-700 mb-2">
            最小文字数
          </label>
          <input
            type="number"
            id="minAnswerChars"
            min={0}
            max={10000}
            step={50}
            value={formData.minAnswerChars}
            onChange={(e) => setFormData({ ...formData, minAnswerChars: parseInt(e.target.value) || 0 })}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-sm text-gray-500 mt-1">回答に必要な最小文字数を設定できます</p>
        </div>

        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.requirePhoto}
              onChange={(e) => setFormData({ ...formData, requirePhoto: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">写真を必須にする</span>
          </label>
          {formData.requirePhoto && (
            <div className="ml-6 mt-2">
              <label htmlFor="requirePhotoMin" className="block text-sm text-gray-600 mb-1">
                最小枚数
              </label>
              <input
                type="number"
                id="requirePhotoMin"
                min={1}
                max={10}
                value={formData.requirePhotoMin}
                onChange={(e) => setFormData({ ...formData, requirePhotoMin: parseInt(e.target.value) || 1 })}
                className="w-24 px-3 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}
        </div>

        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.requireVideo}
              onChange={(e) => setFormData({ ...formData, requireVideo: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">動画を必須にする</span>
          </label>
          {formData.requireVideo && (
            <div className="ml-6 mt-2">
              <label htmlFor="requireVideoMin" className="block text-sm text-gray-600 mb-1">
                最小本数
              </label>
              <input
                type="number"
                id="requireVideoMin"
                min={1}
                max={5}
                value={formData.requireVideoMin}
                onChange={(e) => setFormData({ ...formData, requireVideoMin: parseInt(e.target.value) || 1 })}
                className="w-24 px-3 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}
        </div>

        <div className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
          ⚠️ 注意: 最初の回答が投稿されると、要件を厳しくすることはできません
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
        <h3 className="font-semibold text-yellow-800 mb-2">ご注意事項</h3>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• 質問投稿時に報酬額の与信枠が確保されます（実際の決済は後日）</li>
          <li>• ベストアンサー選定時に決済が実行されます</li>
          <li>• 7日以内に選定がない場合、再度与信取得が必要になる場合があります</li>
          <li>• プラットフォーム手数料20%は運営費として使用されます</li>
        </ul>
      </div>

      <div className="flex gap-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {isSubmitting ? '投稿中...' : '質問を投稿'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-3 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}