'use client';

import { useState } from 'react';

interface FilterSidebarProps {
  filters: any;
  onChange: (filters: any) => void;
  questionCount: number;
}

export default function FilterSidebar({
  filters,
  onChange,
  questionCount
}: FilterSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['status', 'bounty'])
  );

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const handleStatusChange = (status: string) => {
    const currentStatus = filters.status || [];
    let newStatus;
    if (currentStatus.includes(status)) {
      newStatus = currentStatus.filter((s: string) => s !== status);
    } else {
      newStatus = [...currentStatus, status];
    }
    onChange({ ...filters, status: newStatus.length > 0 ? newStatus : undefined });
  };

  const handleBountyChange = (min?: number, max?: number) => {
    onChange({
      ...filters,
      bountyMin: min,
      bountyMax: max
    });
  };

  const handleRequirementChange = (type: 'photo' | 'video', checked: boolean) => {
    if (type === 'photo') {
      onChange({ ...filters, requiresPhoto: checked || undefined });
    } else {
      onChange({ ...filters, requiresVideo: checked || undefined });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900">絞り込み</h3>
        <span className="text-sm text-gray-500">{questionCount}件</span>
      </div>

      {/* ステータスフィルター */}
      <div className="mb-6">
        <button
          onClick={() => toggleSection('status')}
          className="flex items-center justify-between w-full text-left font-medium text-gray-700 mb-2"
        >
          <span>ステータス</span>
          <svg
            className={`w-4 h-4 transition-transform ${
              expandedSections.has('status') ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {expandedSections.has('status') && (
          <div className="space-y-2">
            {[
              { value: 'open', label: '回答受付中', color: 'green' },
              { value: 'closed', label: '受付終了', color: 'gray' },
              { value: 'resolved', label: '解決済み', color: 'blue' }
            ].map((status) => (
              <label key={status.value} className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.status?.includes(status.value) || false}
                  onChange={() => handleStatusChange(status.value)}
                  className="mr-2 rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{status.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* 報酬額フィルター */}
      <div className="mb-6">
        <button
          onClick={() => toggleSection('bounty')}
          className="flex items-center justify-between w-full text-left font-medium text-gray-700 mb-2"
        >
          <span>報酬額</span>
          <svg
            className={`w-4 h-4 transition-transform ${
              expandedSections.has('bounty') ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {expandedSections.has('bounty') && (
          <div className="space-y-3">
            {[
              { min: undefined, max: 1000, label: '〜¥1,000' },
              { min: 1000, max: 3000, label: '¥1,000 〜 ¥3,000' },
              { min: 3000, max: 5000, label: '¥3,000 〜 ¥5,000' },
              { min: 5000, max: 10000, label: '¥5,000 〜 ¥10,000' },
              { min: 10000, max: undefined, label: '¥10,000〜' }
            ].map((range) => (
              <label key={range.label} className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="bounty"
                  checked={
                    filters.bountyMin === range.min && filters.bountyMax === range.max
                  }
                  onChange={() => handleBountyChange(range.min, range.max)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">{range.label}</span>
              </label>
            ))}
            <button
              onClick={() => handleBountyChange(undefined, undefined)}
              className="text-sm text-blue-600 hover:underline"
            >
              クリア
            </button>
          </div>
        )}
      </div>

      {/* 作物フィルター */}
      <div className="mb-6">
        <button
          onClick={() => toggleSection('crop')}
          className="flex items-center justify-between w-full text-left font-medium text-gray-700 mb-2"
        >
          <span>作物</span>
          <svg
            className={`w-4 h-4 transition-transform ${
              expandedSections.has('crop') ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {expandedSections.has('crop') && (
          <div className="space-y-2">
            <select
              value={filters.crop || ''}
              onChange={(e) => onChange({ ...filters, crop: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">すべて</option>
              <option value="tomato">トマト</option>
              <option value="cucumber">きゅうり</option>
              <option value="eggplant">なす</option>
              <option value="pepper">ピーマン</option>
              <option value="lettuce">レタス</option>
              <option value="cabbage">キャベツ</option>
              <option value="rice">稲</option>
              <option value="other">その他</option>
            </select>
          </div>
        )}
      </div>

      {/* 病害フィルター */}
      <div className="mb-6">
        <button
          onClick={() => toggleSection('disease')}
          className="flex items-center justify-between w-full text-left font-medium text-gray-700 mb-2"
        >
          <span>病害虫</span>
          <svg
            className={`w-4 h-4 transition-transform ${
              expandedSections.has('disease') ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {expandedSections.has('disease') && (
          <div className="space-y-2">
            <select
              value={filters.disease || ''}
              onChange={(e) => onChange({ ...filters, disease: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">すべて</option>
              <option value="powdery_mildew">うどんこ病</option>
              <option value="downy_mildew">べと病</option>
              <option value="gray_mold">灰色かび病</option>
              <option value="bacterial_wilt">青枯病</option>
              <option value="aphids">アブラムシ</option>
              <option value="thrips">アザミウマ</option>
              <option value="spider_mites">ハダニ</option>
              <option value="other">その他</option>
            </select>
          </div>
        )}
      </div>

      {/* 品質要件フィルター */}
      <div className="mb-6">
        <button
          onClick={() => toggleSection('requirements')}
          className="flex items-center justify-between w-full text-left font-medium text-gray-700 mb-2"
        >
          <span>回答要件</span>
          <svg
            className={`w-4 h-4 transition-transform ${
              expandedSections.has('requirements') ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {expandedSections.has('requirements') && (
          <div className="space-y-2">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={filters.requiresPhoto || false}
                onChange={(e) => handleRequirementChange('photo', e.target.checked)}
                className="mr-2 rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">写真必須</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={filters.requiresVideo || false}
                onChange={(e) => handleRequirementChange('video', e.target.checked)}
                className="mr-2 rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">動画必須</span>
            </label>
          </div>
        )}
      </div>

      {/* PPV実績フィルター */}
      <div className="mb-6">
        <button
          onClick={() => toggleSection('ppv')}
          className="flex items-center justify-between w-full text-left font-medium text-gray-700 mb-2"
        >
          <span>PPV実績</span>
          <svg
            className={`w-4 h-4 transition-transform ${
              expandedSections.has('ppv') ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {expandedSections.has('ppv') && (
          <div className="space-y-2">
            {[
              { value: 0, label: 'すべて' },
              { value: 1, label: '1件以上' },
              { value: 5, label: '5件以上' },
              { value: 10, label: '10件以上' }
            ].map((ppv) => (
              <label key={ppv.value} className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="ppv"
                  checked={filters.ppvMin === ppv.value}
                  onChange={() => onChange({ ...filters, ppvMin: ppv.value || undefined })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">{ppv.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* フィルタークリアボタン */}
      <button
        onClick={() => onChange({})}
        className="w-full py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        すべてクリア
      </button>
    </div>
  );
}