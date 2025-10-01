import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { createServiceRoleClient } from '@/lib/qa/supabase-client';

const API_BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const fetchAPI = async (path: string, options: RequestInit = {}) => {
  const response = await fetch(`${API_BASE}/api/qa${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await response.json();
  return { response, data };
};

describe('回答API統合テスト', () => {
  let supabase: ReturnType<typeof createServiceRoleClient>;
  let testAskerId: string;
  let testResponderId: string;
  let testQuestionId: string;
  let testAnswerId: string;

  beforeAll(async () => {
    supabase = createServiceRoleClient();
    
    // 質問者用ユーザー作成
    const { data: asker } = await supabase
      .from('qa_user_profiles')
      .insert({
        display_name: 'Test Asker ' + Date.now(),
        email: `asker${Date.now()}@example.com`,
      })
      .select()
      .single();
    
    testAskerId = asker?.user_id;

    // 回答者用ユーザー作成
    const { data: responder } = await supabase
      .from('qa_user_profiles')
      .insert({
        display_name: 'Test Responder ' + Date.now(),
        email: `responder${Date.now()}@example.com`,
      })
      .select()
      .single();
    
    testResponderId = responder?.user_id;

    // ウォレット作成
    await supabase
      .from('qa_wallets')
      .insert([
        { user_id: testAskerId, balance_available: 10000 },
        { user_id: testResponderId, balance_available: 0 },
      ]);
  });

  afterAll(async () => {
    // テストデータクリーンアップ
    if (testAnswerId) {
      await supabase.from('qa_answers').delete().eq('id', testAnswerId);
    }
    if (testQuestionId) {
      await supabase.from('qa_questions').delete().eq('id', testQuestionId);
    }
    await supabase.from('qa_wallets').delete().in('user_id', [testAskerId, testResponderId]);
    await supabase.from('qa_user_profiles').delete().in('user_id', [testAskerId, testResponderId]);
  });

  describe('POST /api/qa/answers - 回答投稿', () => {
    beforeEach(async () => {
      // テスト用質問作成
      const { data } = await supabase
        .from('qa_questions')
        .insert({
          title: 'テスト用質問',
          body: 'これは回答テスト用の質問です',
          bounty_amount: 1000,
          status: 'ANSWERING',
          asker_id: testAskerId,
          deadline_at: new Date(Date.now() + 86400000).toISOString(),
          min_answer_chars: 200,
          require_photo: false,
          require_video: false,
        })
        .select()
        .single();
      
      testQuestionId = data?.id;
    });

    it('基本的な回答が投稿できる', async () => {
      const answerData = {
        question_id: testQuestionId,
        body: 'これはテスト回答です。'.repeat(20), // 200文字以上
      };

      const { response, data } = await fetchAPI('/answers', {
        method: 'POST',
        body: JSON.stringify(answerData),
      });

      expect(response.status).toBe(201);
      expect(data).toHaveProperty('id');
      expect(data.question_id).toBe(testQuestionId);
      expect(data.body).toBe(answerData.body);
      
      testAnswerId = data.id;
    });

    it('最小文字数要件を満たさない回答は拒否', async () => {
      const answerData = {
        question_id: testQuestionId,
        body: '短い回答', // 200文字未満
      };

      const { response, data } = await fetchAPI('/answers', {
        method: 'POST',
        body: JSON.stringify(answerData),
      });

      expect(response.status).toBe(422);
      expect(data.error).toContain('200');
      expect(data.error).toContain('characters');
    });

    it('写真必須要件の検証', async () => {
      // 写真必須の質問作成
      const { data: photoQuestion } = await supabase
        .from('qa_questions')
        .insert({
          title: '写真必須質問',
          body: '写真を添付してください',
          bounty_amount: 500,
          status: 'ANSWERING',
          asker_id: testAskerId,
          deadline_at: new Date(Date.now() + 86400000).toISOString(),
          require_photo: true,
          require_photo_min: 2,
        })
        .select()
        .single();

      // 写真なしの回答
      const answerWithoutPhoto = {
        question_id: photoQuestion?.id,
        body: '写真なしの回答です',
        media_urls: [],
      };

      const { response: res1, data: data1 } = await fetchAPI('/answers', {
        method: 'POST',
        body: JSON.stringify(answerWithoutPhoto),
      });

      expect(res1.status).toBe(422);
      expect(data1.error).toContain('photo');

      // 写真1枚のみ（最小2枚要求）
      const answerWithOnePhoto = {
        question_id: photoQuestion?.id,
        body: '写真1枚の回答です',
        media_urls: ['https://example.com/photo1.jpg'],
      };

      const { response: res2, data: data2 } = await fetchAPI('/answers', {
        method: 'POST',
        body: JSON.stringify(answerWithOnePhoto),
      });

      expect(res2.status).toBe(422);
      expect(data2.error).toContain('2');

      // 写真2枚以上（正常）
      const answerWithPhotos = {
        question_id: photoQuestion?.id,
        body: '写真2枚の回答です',
        media_urls: [
          'https://example.com/photo1.jpg',
          'https://example.com/photo2.jpg',
        ],
      };

      const { response: res3, data: data3 } = await fetchAPI('/answers', {
        method: 'POST',
        body: JSON.stringify(answerWithPhotos),
      });

      expect(res3.status).toBe(201);
      expect(data3.media_urls).toHaveLength(2);
    });

    it('質問者は自分の質問に回答できない', async () => {
      // 質問者として回答を試みる
      const answerData = {
        question_id: testQuestionId,
        body: '自分の質問に回答',
        // テストでは質問者IDをセット
        responder_id: testAskerId,
      };

      const { response, data } = await fetchAPI('/answers', {
        method: 'POST',
        body: JSON.stringify(answerData),
        headers: {
          'X-Test-User-Id': testAskerId,
        },
      });

      expect(response.status).toBe(400);
      expect(data.error).toContain('own question');
    });

    it('同じ質問に複数回答できない', async () => {
      // 1回目の回答
      const firstAnswer = {
        question_id: testQuestionId,
        body: '最初の回答です'.repeat(20),
      };

      const { response: res1 } = await fetchAPI('/answers', {
        method: 'POST',
        body: JSON.stringify(firstAnswer),
        headers: {
          'X-Test-User-Id': testResponderId,
        },
      });

      expect(res1.status).toBe(201);

      // 2回目の回答（同じユーザー）
      const secondAnswer = {
        question_id: testQuestionId,
        body: '2回目の回答です'.repeat(20),
      };

      const { response: res2, data: data2 } = await fetchAPI('/answers', {
        method: 'POST',
        body: JSON.stringify(secondAnswer),
        headers: {
          'X-Test-User-Id': testResponderId,
        },
      });

      expect(res2.status).toBe(400);
      expect(data2.error).toContain('already answered');
    });

    it('締切りを過ぎた質問には回答できない', async () => {
      // 締切りが過去の質問作成
      const { data: expiredQuestion } = await supabase
        .from('qa_questions')
        .insert({
          title: '期限切れ質問',
          body: 'すでに締切りです',
          bounty_amount: 500,
          status: 'ANSWERING',
          asker_id: testAskerId,
          deadline_at: new Date(Date.now() - 86400000).toISOString(), // 1日前
        })
        .select()
        .single();

      const answerData = {
        question_id: expiredQuestion?.id,
        body: '期限切れへの回答',
      };

      const { response, data } = await fetchAPI('/answers', {
        method: 'POST',
        body: JSON.stringify(answerData),
      });

      expect(response.status).toBe(400);
      expect(data.error).toContain('deadline');
    });
  });

  describe('POST /api/qa/answers/[id]/best - ベスト回答選定', () => {
    let questionForBest: string;
    let answer1Id: string;
    let answer2Id: string;
    let responder2Id: string;

    beforeEach(async () => {
      // 追加の回答者作成
      const { data: responder2 } = await supabase
        .from('qa_user_profiles')
        .insert({
          display_name: 'Responder 2 ' + Date.now(),
          email: `responder2_${Date.now()}@example.com`,
        })
        .select()
        .single();
      
      responder2Id = responder2?.user_id;

      // ベスト選定用質問作成
      const { data: question } = await supabase
        .from('qa_questions')
        .insert({
          title: 'ベスト選定テスト',
          body: '複数回答から選ぶ',
          bounty_amount: 2000,
          status: 'ANSWERING',
          asker_id: testAskerId,
          deadline_at: new Date(Date.now() + 86400000).toISOString(),
        })
        .select()
        .single();
      
      questionForBest = question?.id;

      // 複数回答作成
      const { data: a1 } = await supabase
        .from('qa_answers')
        .insert({
          question_id: questionForBest,
          responder_id: testResponderId,
          body: 'これは最初の回答です。詳細な情報を含んでいます。',
        })
        .select()
        .single();
      
      answer1Id = a1?.id;

      const { data: a2 } = await supabase
        .from('qa_answers')
        .insert({
          question_id: questionForBest,
          responder_id: responder2Id,
          body: 'これは2番目の回答です。より詳細な情報を提供します。',
        })
        .select()
        .single();
      
      answer2Id = a2?.id;
    });

    it('質問者がベスト回答を選定できる', async () => {
      const { response, data } = await fetchAPI(`/answers/${answer1Id}/best`, {
        method: 'POST',
        headers: {
          'X-Test-User-Id': testAskerId,
        },
      });

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('selected');

      // 回答がベストに設定されたか確認
      const { data: answer } = await supabase
        .from('qa_answers')
        .select('is_best')
        .eq('id', answer1Id)
        .single();
      
      expect(answer?.is_best).toBe(true);

      // 質問がクローズされたか確認
      const { data: question } = await supabase
        .from('qa_questions')
        .select('status, best_answer_id')
        .eq('id', questionForBest)
        .single();
      
      expect(question?.status).toBe('CLOSED');
      expect(question?.best_answer_id).toBe(answer1Id);
    });

    it('ベスト選定で報酬が分配される', async () => {
      // 選定前のウォレット残高確認
      const { data: walletBefore } = await supabase
        .from('qa_wallets')
        .select('balance_available')
        .eq('user_id', testResponderId)
        .single();
      
      const balanceBefore = walletBefore?.balance_available || 0;

      // ベスト選定
      await fetchAPI(`/answers/${answer1Id}/best`, {
        method: 'POST',
        headers: {
          'X-Test-User-Id': testAskerId,
        },
      });

      // 選定後のウォレット残高確認
      const { data: walletAfter } = await supabase
        .from('qa_wallets')
        .select('balance_available')
        .eq('user_id', testResponderId)
        .single();
      
      const balanceAfter = walletAfter?.balance_available || 0;
      const expectedReward = 2000 * 0.8; // 80%が回答者に

      expect(balanceAfter - balanceBefore).toBe(expectedReward);

      // トランザクション記録確認
      const { data: transaction } = await supabase
        .from('qa_transactions')
        .select('*')
        .eq('question_id', questionForBest)
        .eq('type', 'ESCROW')
        .single();
      
      expect(transaction?.amount).toBe(2000);
      expect(transaction?.platform_fee).toBe(400); // 20%
      expect(transaction?.split_to_responder).toBe(1600); // 80%
    });

    it('質問者以外はベスト選定できない', async () => {
      const { response, data } = await fetchAPI(`/answers/${answer1Id}/best`, {
        method: 'POST',
        headers: {
          'X-Test-User-Id': testResponderId, // 回答者が選定を試みる
        },
      });

      expect(response.status).toBe(403);
      expect(data.error).toContain('Only question asker');
    });

    it('ベストは1回しか選定できない', async () => {
      // 1回目の選定
      await fetchAPI(`/answers/${answer1Id}/best`, {
        method: 'POST',
        headers: {
          'X-Test-User-Id': testAskerId,
        },
      });

      // 2回目の選定試行
      const { response, data } = await fetchAPI(`/answers/${answer2Id}/best`, {
        method: 'POST',
        headers: {
          'X-Test-User-Id': testAskerId,
        },
      });

      expect(response.status).toBe(400);
      expect(data.error).toContain('already selected');
    });
  });

  describe('GET /api/qa/answers - 回答一覧取得', () => {
    let questionWithAnswers: string;

    beforeEach(async () => {
      // 複数回答を持つ質問作成
      const { data: question } = await supabase
        .from('qa_questions')
        .insert({
          title: '回答一覧テスト',
          body: '複数回答を含む',
          bounty_amount: 1500,
          status: 'ANSWERING',
          asker_id: testAskerId,
          deadline_at: new Date(Date.now() + 86400000).toISOString(),
        })
        .select()
        .single();
      
      questionWithAnswers = question?.id;

      // 複数の回答者と回答を作成
      for (let i = 1; i <= 3; i++) {
        const { data: responder } = await supabase
          .from('qa_user_profiles')
          .insert({
            display_name: `Responder ${i}`,
            email: `responder${i}_${Date.now()}@example.com`,
          })
          .select()
          .single();

        await supabase
          .from('qa_answers')
          .insert({
            question_id: questionWithAnswers,
            responder_id: responder?.user_id,
            body: `これは${i}番目の回答です。十分な情報を含んでいます。`,
            created_at: new Date(Date.now() - i * 3600000).toISOString(), // 1時間ずつ違う
          });
      }
    });

    it('特定の質問の回答一覧を取得できる', async () => {
      const { response, data } = await fetchAPI(`/answers?questionId=${questionWithAnswers}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(3);
      
      // すべて同じ質問ID
      data.forEach((answer: any) => {
        expect(answer.question_id).toBe(questionWithAnswers);
      });
    });

    it('回答者情報が含まれる', async () => {
      const { response, data } = await fetchAPI(`/answers?questionId=${questionWithAnswers}`);

      expect(response.status).toBe(200);
      data.forEach((answer: any) => {
        expect(answer.responder).toBeDefined();
        expect(answer.responder).toHaveProperty('display_name');
        expect(answer.responder).toHaveProperty('avatar_url');
      });
    });

    it('時系列順にソートされる', async () => {
      const { response, data } = await fetchAPI(`/answers?questionId=${questionWithAnswers}`);

      expect(response.status).toBe(200);
      
      // 古い順（先に投稿された順）
      for (let i = 1; i < data.length; i++) {
        const prev = new Date(data[i - 1].created_at).getTime();
        const curr = new Date(data[i].created_at).getTime();
        expect(prev).toBeLessThanOrEqual(curr);
      }
    });
  });
});
