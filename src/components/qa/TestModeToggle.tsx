'use client';

import { useState, useEffect } from 'react';

export default function TestModeToggle() {
  const [testMode, setTestMode] = useState<string | null>(null);

  useEffect(() => {
    // クライアントサイドでのみ実行
    if (typeof window !== 'undefined') {
      setTestMode(sessionStorage.getItem('qa_test_mode'));
    }
  }, []);

  // 本番環境では表示しない
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  const handleModeChange = (mode: 'asker' | 'responder') => {
    if (mode === 'asker') {
      sessionStorage.removeItem('qa_test_mode');
    } else {
      sessionStorage.setItem('qa_test_mode', mode);
    }
    window.location.reload();
  };

  return (
    <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <h3 className="font-bold text-yellow-800 mb-2">🔧 開発環境テストモード</h3>
      <div className="flex gap-2 items-center">
        <button
          onClick={() => handleModeChange('asker')}
          className={`px-4 py-2 rounded transition-colors ${
            testMode !== 'responder'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          💬 質問者モード
        </button>
        <button
          onClick={() => handleModeChange('responder')}
          className={`px-4 py-2 rounded transition-colors ${
            testMode === 'responder'
              ? 'bg-green-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          ✍️ 回答者モード
        </button>
        <span className="ml-4 py-2 text-yellow-700 font-medium">
          現在: {testMode === 'responder' ? '回答者' : '質問者'}モード
        </span>
      </div>
      <div className="mt-2 text-sm text-yellow-600">
        {testMode === 'responder' ? (
          <>
            ✅ 自分の質問に回答を投稿できます（テスト用）<br />
            ※ 別のユーザーIDで回答を投稿します
          </>
        ) : (
          <>
            📝 質問を投稿できます<br />
            ❌ 自分の質問には回答できません
          </>
        )}
      </div>
    </div>
  );
}