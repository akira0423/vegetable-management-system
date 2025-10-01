'use client';

interface SortDropdownProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SortDropdown({ value, onChange }: SortDropdownProps) {
  const sortOptions = [
    { value: 'newest', label: '新着順', icon: '🕐' },
    { value: 'oldest', label: '古い順', icon: '📅' },
    { value: 'bounty_high', label: '報酬額が高い順', icon: '💰' },
    { value: 'bounty_low', label: '報酬額が低い順', icon: '💵' },
    { value: 'deadline_soon', label: '締切が近い順', icon: '⏰' },
    { value: 'popular', label: '人気順', icon: '🔥' },
    { value: 'most_answers', label: '回答が多い順', icon: '💬' },
    { value: 'no_answers', label: '未回答', icon: '❓' }
  ];

  const currentOption = sortOptions.find(opt => opt.value === value);

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-white border border-gray-300 rounded-md pl-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
      >
        {sortOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {/* カスタムドロップダウンアイコン */}
      <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 10l5 5 5-5" />
        </svg>
      </div>

      {/* 現在の選択を表示（オプション） */}
      {currentOption && (
        <div className="mt-1 text-xs text-gray-500">
          並び替え: {currentOption.label}
        </div>
      )}
    </div>
  );
}