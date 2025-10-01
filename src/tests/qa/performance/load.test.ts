import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createServiceRoleClient } from '@/lib/qa/supabase-client';

// パフォーマンステスト用のヘルパー
const API_BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface PerformanceMetrics {
  responseTime: number;
  statusCode: number;
  success: boolean;
  error?: string;
}

const measureAPICall = async (
  path: string,
  options: RequestInit = {}
): Promise<PerformanceMetrics> => {
  const startTime = performance.now();
  
  try {
    const response = await fetch(`${API_BASE}/api/qa${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    return {
      responseTime,
      statusCode: response.status,
      success: response.ok,
    };
  } catch (error) {
    const endTime = performance.now();
    return {
      responseTime: endTime - startTime,
      statusCode: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

const runConcurrentRequests = async (
  count: number,
  requestFn: () => Promise<PerformanceMetrics>
): Promise<PerformanceMetrics[]> => {
  const promises = Array.from({ length: count }, () => requestFn());
  return Promise.all(promises);
};

const calculateStats = (metrics: PerformanceMetrics[]) => {
  const responseTimes = metrics.map(m => m.responseTime);
  const successCount = metrics.filter(m => m.success).length;
  
  return {
    min: Math.min(...responseTimes),
    max: Math.max(...responseTimes),
    avg: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
    median: responseTimes.sort()[Math.floor(responseTimes.length / 2)],
    p95: responseTimes.sort()[Math.floor(responseTimes.length * 0.95)],
    p99: responseTimes.sort()[Math.floor(responseTimes.length * 0.99)],
    successRate: (successCount / metrics.length) * 100,
    errorRate: ((metrics.length - successCount) / metrics.length) * 100,
  };
};

describe('パフォーマンステスト', () => {
  let supabase: ReturnType<typeof createServiceRoleClient>;
  let testQuestionIds: string[] = [];
  let testUserIds: string[] = [];

  beforeAll(async () => {
    supabase = createServiceRoleClient();
    
    // テスト用データ準備
    console.log('🔧 テストデータ準備中...');
    
    // 複数のテストユーザー作成
    for (let i = 0; i < 10; i++) {
      const { data: user } = await supabase
        .from('qa_user_profiles')
        .insert({
          display_name: `Perf Test User ${i}`,
          email: `perftest${i}@example.com`,
        })
        .select()
        .single();
      
      if (user) testUserIds.push(user.user_id);
    }

    // 複数のテスト質問作成
    for (let i = 0; i < 20; i++) {
      const { data: question } = await supabase
        .from('qa_questions')
        .insert({
          title: `Performance Test Question ${i}`,
          body: `This is a test question for performance testing. `.repeat(10),
          bounty_amount: 500 + (i * 100),
          status: 'ANSWERING',
          asker_id: testUserIds[i % testUserIds.length],
          deadline_at: new Date(Date.now() + 86400000).toISOString(),
        })
        .select()
        .single();
      
      if (question) testQuestionIds.push(question.id);
    }
  });

  afterAll(async () => {
    // テストデータクリーンアップ
    console.log('🧹 テストデータクリーンアップ中...');
    
    if (testQuestionIds.length > 0) {
      await supabase.from('qa_questions').delete().in('id', testQuestionIds);
    }
    if (testUserIds.length > 0) {
      await supabase.from('qa_user_profiles').delete().in('user_id', testUserIds);
    }
  });

  describe('レスポンスタイム測定', () => {
    it('質問一覧APIが1秒以内に応答する', async () => {
      const metrics = await measureAPICall('/questions?limit=10');
      
      console.log(`📊 質問一覧API応答時間: ${metrics.responseTime.toFixed(2)}ms`);
      
      expect(metrics.success).toBe(true);
      expect(metrics.responseTime).toBeLessThan(1000); // 1秒以内
    });

    it('質問詳細APIが500ms以内に応答する', async () => {
      const metrics = await measureAPICall(`/questions/${testQuestionIds[0]}`);
      
      console.log(`📊 質問詳細API応答時間: ${metrics.responseTime.toFixed(2)}ms`);
      
      expect(metrics.success).toBe(true);
      expect(metrics.responseTime).toBeLessThan(500); // 500ms以内
    });

    it('回答投稿APIが2秒以内に応答する', async () => {
      const answerData = {
        question_id: testQuestionIds[0],
        body: 'This is a test answer for performance testing.'.repeat(10),
      };

      const metrics = await measureAPICall('/answers', {
        method: 'POST',
        body: JSON.stringify(answerData),
      });
      
      console.log(`📊 回答投稿API応答時間: ${metrics.responseTime.toFixed(2)}ms`);
      
      expect(metrics.responseTime).toBeLessThan(2000); // 2秒以内
    });
  });

  describe('負荷テスト', () => {
    it('10件の同時リクエストを処理できる', async () => {
      console.log('🚀 10件同時リクエストテスト開始...');
      
      const metrics = await runConcurrentRequests(10, () => 
        measureAPICall('/questions?limit=5')
      );
      
      const stats = calculateStats(metrics);
      
      console.log('📊 統計情報:');
      console.log(`  最小: ${stats.min.toFixed(2)}ms`);
      console.log(`  最大: ${stats.max.toFixed(2)}ms`);
      console.log(`  平均: ${stats.avg.toFixed(2)}ms`);
      console.log(`  中央値: ${stats.median.toFixed(2)}ms`);
      console.log(`  95パーセンタイル: ${stats.p95.toFixed(2)}ms`);
      console.log(`  成功率: ${stats.successRate.toFixed(1)}%`);
      
      expect(stats.successRate).toBeGreaterThan(95); // 95%以上成功
      expect(stats.avg).toBeLessThan(2000); // 平均2秒以内
    });

    it('50件の同時リクエストを処理できる', async () => {
      console.log('🚀 50件同時リクエストテスト開始...');
      
      const metrics = await runConcurrentRequests(50, () => 
        measureAPICall(`/questions/${testQuestionIds[Math.floor(Math.random() * testQuestionIds.length)]}`)
      );
      
      const stats = calculateStats(metrics);
      
      console.log('📊 統計情報:');
      console.log(`  最小: ${stats.min.toFixed(2)}ms`);
      console.log(`  最大: ${stats.max.toFixed(2)}ms`);
      console.log(`  平均: ${stats.avg.toFixed(2)}ms`);
      console.log(`  95パーセンタイル: ${stats.p95.toFixed(2)}ms`);
      console.log(`  99パーセンタイル: ${stats.p99.toFixed(2)}ms`);
      console.log(`  成功率: ${stats.successRate.toFixed(1)}%`);
      
      expect(stats.successRate).toBeGreaterThan(90); // 90%以上成功
      expect(stats.p95).toBeLessThan(5000); // 95%が5秒以内
    });

    it('100件の順次リクエストを処理できる', async () => {
      console.log('🚀 100件順次リクエストテスト開始...');
      
      const metrics: PerformanceMetrics[] = [];
      const startTime = performance.now();
      
      for (let i = 0; i < 100; i++) {
        const metric = await measureAPICall('/questions?limit=1&offset=' + i);
        metrics.push(metric);
        
        if (i % 20 === 0) {
          console.log(`  進捗: ${i}/100`);
        }
      }
      
      const totalTime = performance.now() - startTime;
      const stats = calculateStats(metrics);
      
      console.log('📊 統計情報:');
      console.log(`  合計時間: ${(totalTime / 1000).toFixed(2)}秒`);
      console.log(`  平均応答時間: ${stats.avg.toFixed(2)}ms`);
      console.log(`  成功率: ${stats.successRate.toFixed(1)}%`);
      
      expect(stats.successRate).toBeGreaterThan(98); // 98%以上成功
      expect(totalTime).toBeLessThan(60000); // 1分以内
    });
  });

  describe('スパイクテスト', () => {
    it('急激な負荷増加に対応できる', async () => {
      console.log('🚀 スパイクテスト開始...');
      
      // 通常負荷（5リクエスト）
      console.log('  Phase 1: 通常負荷');
      const normalMetrics = await runConcurrentRequests(5, () => 
        measureAPICall('/questions')
      );
      const normalStats = calculateStats(normalMetrics);
      console.log(`    平均: ${normalStats.avg.toFixed(2)}ms`);
      
      // スパイク負荷（30リクエスト）
      console.log('  Phase 2: スパイク負荷');
      const spikeMetrics = await runConcurrentRequests(30, () => 
        measureAPICall('/questions')
      );
      const spikeStats = calculateStats(spikeMetrics);
      console.log(`    平均: ${spikeStats.avg.toFixed(2)}ms`);
      
      // 通常負荷に戻る（5リクエスト）
      console.log('  Phase 3: 通常負荷復帰');
      const recoveryMetrics = await runConcurrentRequests(5, () => 
        measureAPICall('/questions')
      );
      const recoveryStats = calculateStats(recoveryMetrics);
      console.log(`    平均: ${recoveryStats.avg.toFixed(2)}ms`);
      
      // スパイク時でも一定の成功率を維持
      expect(spikeStats.successRate).toBeGreaterThan(85);
      // 復帰後は通常のパフォーマンスに戻る
      expect(recoveryStats.avg).toBeLessThan(normalStats.avg * 1.5);
    });
  });

  describe('データ量スケールテスト', () => {
    it('大量データのページネーションが効率的', async () => {
      console.log('🚀 ページネーション効率テスト...');
      
      const pageSizes = [10, 50, 100];
      const results: any = {};
      
      for (const size of pageSizes) {
        const metrics = await measureAPICall(`/questions?limit=${size}`);
        results[size] = metrics.responseTime;
        console.log(`  ${size}件取得: ${metrics.responseTime.toFixed(2)}ms`);
      }
      
      // データ量が増えても線形以下の増加
      const ratio = results[100] / results[10];
      expect(ratio).toBeLessThan(5); // 10倍のデータでも5倍以内の時間
    });

    it('複雑なクエリでも許容時間内', async () => {
      // カテゴリ、ソート、フィルタを含む複雑なクエリ
      const complexQuery = '/questions?category=vegetable&sort=bounty_desc&status=ANSWERING&limit=20';
      const metrics = await measureAPICall(complexQuery);
      
      console.log(`📊 複雑クエリ応答時間: ${metrics.responseTime.toFixed(2)}ms`);
      
      expect(metrics.responseTime).toBeLessThan(2000); // 2秒以内
    });
  });

  describe('メモリ使用量テスト', () => {
    it('メモリリークがない', async () => {
      if (typeof global.gc === 'function') {
        console.log('🚀 メモリリークテスト開始...');
        
        // 初期メモリ使用量
        global.gc();
        const initialMemory = process.memoryUsage().heapUsed;
        console.log(`  初期メモリ: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`);
        
        // 1000回のリクエスト
        for (let i = 0; i < 1000; i++) {
          await measureAPICall('/questions?limit=1');
          
          if (i % 100 === 0) {
            global.gc();
            const currentMemory = process.memoryUsage().heapUsed;
            console.log(`  ${i}回後: ${(currentMemory / 1024 / 1024).toFixed(2)}MB`);
          }
        }
        
        // 最終メモリ使用量
        global.gc();
        const finalMemory = process.memoryUsage().heapUsed;
        console.log(`  最終メモリ: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`);
        
        // メモリ増加が50MB以内
        const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;
        expect(memoryIncrease).toBeLessThan(50);
      } else {
        console.log('⚠️ GCが無効なためメモリテストをスキップ');
      }
    });
  });
});

describe('エンドツーエンド パフォーマンステスト', () => {
  it('完全な質問投稿フローが5秒以内', async () => {
    console.log('🚀 E2Eパフォーマンステスト開始...');
    const startTime = performance.now();
    
    // 1. 質問作成
    const questionData = {
      title: 'E2E Performance Test',
      body: 'Testing end-to-end performance',
      bounty_amount: 1000,
    };
    
    const createMetrics = await measureAPICall('/questions', {
      method: 'POST',
      body: JSON.stringify(questionData),
    });
    
    console.log(`  質問作成: ${createMetrics.responseTime.toFixed(2)}ms`);
    
    // 2. 質問取得
    const listMetrics = await measureAPICall('/questions');
    console.log(`  一覧取得: ${listMetrics.responseTime.toFixed(2)}ms`);
    
    const totalTime = performance.now() - startTime;
    console.log(`  合計時間: ${totalTime.toFixed(2)}ms`);
    
    expect(totalTime).toBeLessThan(5000); // 5秒以内
  });
});
