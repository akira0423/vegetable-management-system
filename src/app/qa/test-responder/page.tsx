'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TestResponderPage() {
  const router = useRouter();

  useEffect(() => {
    // 開発環境のみ: セッションストレージにテスト回答者モードを設定
    if (process.env.NODE_ENV !== 'production') {
      sessionStorage.setItem('qa_test_mode', 'responder');
      alert('テスト回答者モードが有効になりました。質問詳細ページで回答を投稿できます。');
      router.push('/qa');
    } else {
      alert('この機能は開発環境でのみ利用可能です。');
      router.push('/qa');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">テスト回答者モード</h1>
        <p className="text-gray-600">設定中...</p>
      </div>
    </div>
  );
}