'use client';

interface ActiveFiltersProps {
  filters: any;
  onRemove: (key: string, value?: any) => void;
  onClear: () => void;
}

export default function ActiveFilters({ filters, onRemove, onClear }: ActiveFiltersProps) {
  const activeFilters: { key: string; label: string; value: any }[] = [];

  // フィルターをラベル付きで整理
  if (filters.q) {
    activeFilters.push({ key: 'q', label: '検索', value: filters.q });
  }

  if (filters.status && filters.status.length > 0) {
    filters.status.forEach((status: string) => {
      const statusLabels: Record<string, string> = {
        open: '回答受付中',
        closed: '受付終了',
        resolved: '解決済み'
      };
      activeFilters.push({
        key: 'status',
        label: 'ステータス',
        value: { display: statusLabels[status] || status, actual: status }
      });
    });
  }

  if (filters.bountyMin !== undefined || filters.bountyMax !== undefined) {
    let label = '報酬額: ';
    if (filters.bountyMin && filters.bountyMax) {
      label += `¥${filters.bountyMin.toLocaleString()} 〜 ¥${filters.bountyMax.toLocaleString()}`;
    } else if (filters.bountyMin) {
      label += `¥${filters.bountyMin.toLocaleString()}〜`;
    } else if (filters.bountyMax) {
      label += `〜¥${filters.bountyMax.toLocaleString()}`;
    }
    activeFilters.push({ key: 'bounty', label, value: null });
  }

  if (filters.crop) {
    const cropLabels: Record<string, string> = {
      tomato: 'トマト',
      cucumber: 'きゅうり',
      eggplant: 'なす',
      pepper: 'ピーマン',
      lettuce: 'レタス',
      cabbage: 'キャベツ',
      rice: '稲',
      other: 'その他'
    };
    activeFilters.push({
      key: 'crop',
      label: '作物',
      value: cropLabels[filters.crop] || filters.crop
    });
  }

  if (filters.disease) {
    const diseaseLabels: Record<string, string> = {
      powdery_mildew: 'うどんこ病',
      downy_mildew: 'べと病',
      gray_mold: '灰色かび病',
      bacterial_wilt: '青枯病',
      aphids: 'アブラムシ',
      thrips: 'アザミウマ',
      spider_mites: 'ハダニ',
      other: 'その他'
    };
    activeFilters.push({
      key: 'disease',
      label: '病害虫',
      value: diseaseLabels[filters.disease] || filters.disease
    });
  }

  if (filters.region) {
    activeFilters.push({ key: 'region', label: '地域', value: filters.region });
  }

  if (filters.season) {
    const seasonLabels: Record<string, string> = {
      spring: '春',
      summer: '夏',
      autumn: '秋',
      winter: '冬'
    };
    activeFilters.push({
      key: 'season',
      label: '季節',
      value: seasonLabels[filters.season] || filters.season
    });
  }

  if (filters.tags && filters.tags.length > 0) {
    filters.tags.forEach((tag: string) => {
      activeFilters.push({ key: 'tags', label: 'タグ', value: tag });
    });
  }

  if (filters.requiresPhoto) {
    activeFilters.push({ key: 'requiresPhoto', label: '写真必須', value: true });
  }

  if (filters.requiresVideo) {
    activeFilters.push({ key: 'requiresVideo', label: '動画必須', value: true });
  }

  if (filters.ppvMin) {
    activeFilters.push({
      key: 'ppvMin',
      label: 'PPV',
      value: `${filters.ppvMin}件以上`
    });
  }

  if (activeFilters.length === 0) {
    return null;
  }

  return (
    <div className="mb-4 p-3 bg-blue-50 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">
          絞り込み中 ({activeFilters.length}件)
        </span>
        <button
          onClick={onClear}
          className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
        >
          すべてクリア
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {activeFilters.map((filter, index) => (
          <div
            key={`${filter.key}-${index}`}
            className="inline-flex items-center gap-1 px-3 py-1 bg-white rounded-full text-sm border border-gray-300"
          >
            <span className="text-gray-600">{filter.label}:</span>
            <span className="font-medium text-gray-900">
              {typeof filter.value === 'object' && filter.value?.display
                ? filter.value.display
                : filter.value || ''}
            </span>
            <button
              onClick={() => {
                if (filter.key === 'bounty') {
                  onRemove('bountyMin');
                  onRemove('bountyMax');
                } else if (filter.key === 'status' && typeof filter.value === 'object') {
                  onRemove(filter.key, filter.value.actual);
                } else {
                  onRemove(filter.key, filter.value);
                }
              }}
              className="ml-1 text-gray-400 hover:text-gray-600"
              aria-label={`${filter.label}フィルターを削除`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}