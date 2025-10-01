import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { createServiceRoleClient } from '@/lib/qa/supabase-client';

// APIエンドポイントのテスト用ヘルパー
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

describe('質問API統合テスト', () => {
  let supabase: ReturnType<typeof createServiceRoleClient>;
  let testUserId: string;
  let testQuestionId: string;

  beforeAll(async () => {
    supabase = createServiceRoleClient();
    
    // テストユーザー作成
    const { data: user } = await supabase
      .from('qa_user_profiles')
      .insert({
        display_name: 'Test User ' + Date.now(),
        email: `test${Date.now()}@example.com`,
      })
      .select()
      .single();
    
    testUserId = user?.user_id;
  });

  afterAll(async () => {
    // テストデータクリーンアップ
    if (testQuestionId) {
      await supabase.from('qa_questions').delete().eq('id', testQuestionId);
    }
    if (testUserId) {
      await supabase.from('qa_user_profiles').delete().eq('user_id', testUserId);
    }
  });

  describe('POST /api/qa/questions - 質問作成', () => {
    it('基本的な質問が作成できる', async () => {
      const questionData = {
        title: 'トマトの葉が黄色くなってきました',
        body: '家庭菜園でトマトを育てていますが、下の葉から黄色くなってきました。何が原因でしょうか？',
        bounty_amount: 500,
        deadline_hours: 72,
        category: 'vegetable',
        tags: ['トマト', '病気', '家庭菜園'],
      };

      const { response, data } = await fetchAPI('/questions', {
        method: 'POST',
        body: JSON.stringify(questionData),
      });

      expect(response.status).toBe(201);
      expect(data).toHaveProperty('id');
      expect(data.title).toBe(questionData.title);
      expect(data.bounty_amount).toBe(questionData.bounty_amount);
      expect(data.status).toBe('PENDING_PAYMENT');
      
      testQuestionId = data.id;
    });

    it('品質要件付き質問が作成できる', async () => {
      const questionData = {
        title: '害虫駆除方法を教えてください',
        body: 'キャベツに青虫がついています。農薬を使わない駆除方法を教えてください。',
        bounty_amount: 1000,
        deadline_hours: 48,
        requirements: {
          min_answer_chars: 500,
          require_photo: true,
          require_photo_min: 3,
          require_video: false,
        },
      };

      const { response, data } = await fetchAPI('/questions', {
        method: 'POST',
        body: JSON.stringify(questionData),
      });

      expect(response.status).toBe(201);
      expect(data.min_answer_chars).toBe(500);
      expect(data.require_photo).toBe(true);
      expect(data.require_photo_min).toBe(3);
    });

    it('最低報酬額未満はエラー', async () => {
      const questionData = {
        title: 'テスト質問',
        body: 'テスト本文',
        bounty_amount: 5, // 最低額10円未満
      };

      const { response, data } = await fetchAPI('/questions', {
        method: 'POST',
        body: JSON.stringify(questionData),
      });

      expect(response.status).toBe(400);
      expect(data.error).toContain('minimum');
    });

    it('必須フィールド不足はエラー', async () => {
      const questionData = {
        title: 'タイトルのみ',
      };

      const { response, data } = await fetchAPI('/questions', {
        method: 'POST',
        body: JSON.stringify(questionData),
      });

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  describe('GET /api/qa/questions - 質問一覧取得', () => {
    beforeEach(async () => {
      // テスト用質問を複数作成
      const questions = [
        { title: 'Public Question 1', status: 'ANSWERING', bounty_amount: 500 },
        { title: 'Public Question 2', status: 'ANSWERING', bounty_amount: 1000 },
        { title: 'Draft Question', status: 'DRAFT', bounty_amount: 500 },
        { title: 'Closed Question', status: 'CLOSED', bounty_amount: 500 },
      ];

      for (const q of questions) {
        await supabase.from('qa_questions').insert({
          ...q,
          asker_id: testUserId,
          body: 'Test body',
          deadline_at: new Date(Date.now() + 86400000).toISOString(),
        });
      }
    });

    it('公開中の質問のみ取得される', async () => {
      const { response, data } = await fetchAPI('/questions');

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      
      // ANSWERINGステータスのみ
      const allAnswering = data.every((q: any) => 
        q.status === 'ANSWERING' || q.status === 'FUNDED'
      );
      expect(allAnswering).toBe(true);
    });

    it('カテゴリでフィルタリングできる', async () => {
      const { response, data } = await fetchAPI('/questions?category=vegetable');

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    it('ソート順を指定できる', async () => {
      const { response, data } = await fetchAPI('/questions?sort=bounty_desc');

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      
      // 報酬額降順チェック
      for (let i = 1; i < data.length; i++) {
        expect(data[i - 1].bounty_amount).toBeGreaterThanOrEqual(data[i].bounty_amount);
      }
    });

    it('ページネーションが動作する', async () => {
      const { response: res1, data: page1 } = await fetchAPI('/questions?limit=2&offset=0');
      const { response: res2, data: page2 } = await fetchAPI('/questions?limit=2&offset=2');

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(page1.length).toBeLessThanOrEqual(2);
      expect(page2.length).toBeLessThanOrEqual(2);
      
      // 異なるデータであること
      if (page1.length > 0 && page2.length > 0) {
        expect(page1[0].id).not.toBe(page2[0].id);
      }
    });
  });

  describe('GET /api/qa/questions/[id] - 質問詳細取得', () => {
    let publicQuestionId: string;

    beforeEach(async () => {
      // 公開質問作成
      const { data } = await supabase
        .from('qa_questions')
        .insert({
          title: 'Detail Test Question',
          body: 'This is a detailed question body with complete information.',
          bounty_amount: 1500,
          status: 'ANSWERING',
          asker_id: testUserId,
          deadline_at: new Date(Date.now() + 86400000).toISOString(),
        })
        .select()
        .single();
      
      publicQuestionId = data?.id;
    });

    it('未認証でも質問本文が取得できる', async () => {
      const { response, data } = await fetchAPI(`/questions/${publicQuestionId}`);

      expect(response.status).toBe(200);
      expect(data.id).toBe(publicQuestionId);
      expect(data.title).toBe('Detail Test Question');
      expect(data.body).toBe('This is a detailed question body with complete information.');
    });

    it('質問者情報が含まれる', async () => {
      const { response, data } = await fetchAPI(`/questions/${publicQuestionId}`);

      expect(response.status).toBe(200);
      expect(data.asker).toBeDefined();
      expect(data.asker).toHaveProperty('display_name');
      expect(data.asker).toHaveProperty('avatar_url');
    });

    it('存在しない質問は404', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const { response, data } = await fetchAPI(`/questions/${fakeId}`);

      expect(response.status).toBe(404);
      expect(data.error).toContain('not found');
    });

    it('回答が含まれる場合は回答数も取得', async () => {
      // 回答を追加
      await supabase
        .from('qa_answers')
        .insert({
          question_id: publicQuestionId,
          responder_id: testUserId,
          body: 'Test answer',
        });

      const { response, data } = await fetchAPI(`/questions/${publicQuestionId}`);

      expect(response.status).toBe(200);
      expect(data.answer_count).toBeGreaterThan(0);
    });
  });

  describe('PATCH /api/qa/questions/[id] - 質問更新', () => {
    let draftQuestionId: string;

    beforeEach(async () => {
      // 下書き質問作成
      const { data } = await supabase
        .from('qa_questions')
        .insert({
          title: 'Draft to Update',
          body: 'Original body',
          bounty_amount: 500,
          status: 'DRAFT',
          asker_id: testUserId,
          deadline_at: new Date(Date.now() + 86400000).toISOString(),
        })
        .select()
        .single();
      
      draftQuestionId = data?.id;
    });

    it('下書き質問を更新できる', async () => {
      const updateData = {
        title: 'Updated Title',
        body: 'Updated body content',
        bounty_amount: 1000,
      };

      const { response, data } = await fetchAPI(`/questions/${draftQuestionId}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData),
      });

      expect(response.status).toBe(200);
      expect(data.title).toBe(updateData.title);
      expect(data.body).toBe(updateData.body);
      expect(data.bounty_amount).toBe(updateData.bounty_amount);
    });

    it('公開後は本文の更新ができない', async () => {
      // 質問を公開状態に
      await supabase
        .from('qa_questions')
        .update({ status: 'ANSWERING', published_at: new Date().toISOString() })
        .eq('id', draftQuestionId);

      const updateData = {
        body: 'Try to update published question',
      };

      const { response, data } = await fetchAPI(`/questions/${draftQuestionId}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData),
      });

      expect(response.status).toBe(400);
      expect(data.error).toContain('published');
    });

    it('回答後は品質要件を厳格化できない', async () => {
      // 質問を公開
      await supabase
        .from('qa_questions')
        .update({ 
          status: 'ANSWERING',
          published_at: new Date().toISOString(),
          min_answer_chars: 100,
        })
        .eq('id', draftQuestionId);

      // 回答を追加
      await supabase
        .from('qa_answers')
        .insert({
          question_id: draftQuestionId,
          responder_id: testUserId,
          body: 'A'.repeat(150), // 150文字
        });

      // 要件を厳格化しようとする
      const updateData = {
        requirements: {
          min_answer_chars: 500, // 厳格化
        },
      };

      const { response, data } = await fetchAPI(`/questions/${draftQuestionId}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData),
      });

      expect(response.status).toBe(400);
      expect(data.error).toContain('stricter');
    });
  });

  describe('DELETE /api/qa/questions/[id] - 質問削除', () => {
    it('下書き質問を削除できる', async () => {
      // 削除用質問作成
      const { data: question } = await supabase
        .from('qa_questions')
        .insert({
          title: 'To Be Deleted',
          body: 'Delete me',
          bounty_amount: 500,
          status: 'DRAFT',
          asker_id: testUserId,
          deadline_at: new Date(Date.now() + 86400000).toISOString(),
        })
        .select()
        .single();

      const { response } = await fetchAPI(`/questions/${question?.id}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(204);

      // 削除確認
      const { data: check } = await supabase
        .from('qa_questions')
        .select('*')
        .eq('id', question?.id)
        .single();
      
      expect(check).toBeNull();
    });

    it('公開済み質問は削除できない', async () => {
      // 公開質問作成
      const { data: question } = await supabase
        .from('qa_questions')
        .insert({
          title: 'Published Question',
          body: 'Cannot delete',
          bounty_amount: 500,
          status: 'ANSWERING',
          published_at: new Date().toISOString(),
          asker_id: testUserId,
          deadline_at: new Date(Date.now() + 86400000).toISOString(),
        })
        .select()
        .single();

      const { response, data } = await fetchAPI(`/questions/${question?.id}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(400);
      expect(data.error).toContain('published');
    });
  });
});
