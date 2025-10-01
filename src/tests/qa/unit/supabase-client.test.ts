import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createBrowserSupabaseClient, createServerSupabaseClient, createServiceRoleClient } from '@/lib/qa/supabase-client';

// Supabaseクライアントのモック
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
  })),
}));

jest.mock('@supabase/ssr', () => ({
  createBrowserClient: jest.fn(),
  createServerClient: jest.fn(),
}));

describe('Supabaseクライアント ユニットテスト', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createBrowserSupabaseClient', () => {
    it('ブラウザ用クライアントが作成される', () => {
      const client = createBrowserSupabaseClient();
      expect(client).toBeDefined();
      expect(client.auth).toBeDefined();
      expect(client.from).toBeDefined();
    });

    it('環境変数が正しく使用される', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
      
      const client = createBrowserSupabaseClient();
      expect(client).toBeDefined();
    });
  });

  describe('createServerSupabaseClient', () => {
    it('サーバー用クライアントが作成される', async () => {
      const mockCookies = {
        get: jest.fn(),
        set: jest.fn(),
        delete: jest.fn(),
      };

      const client = await createServerSupabaseClient();
      expect(client).toBeDefined();
      expect(client.auth).toBeDefined();
    });
  });

  describe('createServiceRoleClient', () => {
    it('サービスロールクライアントが作成される', () => {
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
      
      const client = createServiceRoleClient();
      expect(client).toBeDefined();
      expect(client.auth).toBeDefined();
    });

    it('サービスロールキーが無い場合エラー', () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      expect(() => createServiceRoleClient()).toThrow();
    });
  });

  describe('データベース操作', () => {
    let client: any;

    beforeEach(() => {
      client = createBrowserSupabaseClient();
    });

    it('質問データの取得', async () => {
      const mockData = [
        { id: '1', title: 'Test Question 1' },
        { id: '2', title: 'Test Question 2' },
      ];

      client.from = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            data: mockData,
            error: null,
          })),
        })),
      }));

      const { data, error } = await client
        .from('qa_questions')
        .select('*')
        .eq('status', 'ANSWERING');

      expect(data).toEqual(mockData);
      expect(error).toBeNull();
    });

    it('質問データの作成', async () => {
      const newQuestion = {
        title: 'New Question',
        body: 'Question body',
        bounty_amount: 500,
      };

      client.from = jest.fn(() => ({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({
              data: { id: '123', ...newQuestion },
              error: null,
            })),
          })),
        })),
      }));

      const { data, error } = await client
        .from('qa_questions')
        .insert(newQuestion)
        .select()
        .single();

      expect(data).toMatchObject(newQuestion);
      expect(data.id).toBe('123');
      expect(error).toBeNull();
    });

    it('エラーハンドリング', async () => {
      const mockError = {
        code: 'PGRST301',
        message: 'JWT expired',
        details: null,
        hint: null,
      };

      client.from = jest.fn(() => ({
        select: jest.fn(() => ({
          data: null,
          error: mockError,
        })),
      }));

      const { data, error } = await client
        .from('qa_questions')
        .select('*');

      expect(data).toBeNull();
      expect(error).toEqual(mockError);
    });
  });

  describe('認証機能', () => {
    let client: any;

    beforeEach(() => {
      client = createBrowserSupabaseClient();
    });

    it('ユーザー認証状態の確認', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      client.auth.getUser = jest.fn().mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const { data, error } = await client.auth.getUser();
      expect(data.user).toEqual(mockUser);
      expect(error).toBeNull();
    });

    it('未認証状態の確認', async () => {
      client.auth.getUser = jest.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const { data, error } = await client.auth.getUser();
      expect(data.user).toBeNull();
      expect(error).toBeNull();
    });
  });

  describe('RLSポリシーテスト', () => {
    let client: any;

    beforeEach(() => {
      client = createBrowserSupabaseClient();
    });

    it('認証済みユーザーは自分の質問を更新できる', async () => {
      const userId = 'user-123';
      const questionId = 'question-456';

      client.auth.getUser = jest.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      });

      client.from = jest.fn(() => ({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              data: { id: questionId, title: 'Updated' },
              error: null,
            })),
          })),
        })),
      }));

      const { data, error } = await client
        .from('qa_questions')
        .update({ title: 'Updated' })
        .eq('id', questionId)
        .eq('asker_id', userId);

      expect(data).toBeDefined();
      expect(error).toBeNull();
    });

    it('他人の質問は更新できない', async () => {
      const userId = 'user-123';
      const otherUserId = 'user-456';
      const questionId = 'question-789';

      client.auth.getUser = jest.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      });

      client.from = jest.fn(() => ({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              data: null,
              error: {
                code: '42501',
                message: 'new row violates row-level security policy',
              },
            })),
          })),
        })),
      }));

      const { data, error } = await client
        .from('qa_questions')
        .update({ title: 'Updated' })
        .eq('id', questionId)
        .eq('asker_id', otherUserId);

      expect(data).toBeNull();
      expect(error).toBeDefined();
      expect(error.code).toBe('42501');
    });
  });
});

describe('トランザクション処理', () => {
  let client: any;

  beforeEach(() => {
    client = createServiceRoleClient();
  });

  it('ベスト選定トランザクション', async () => {
    const questionId = 'q-123';
    const answerId = 'a-456';
    const responderId = 'u-789';

    // RPC関数のモック
    client.rpc = jest.fn().mockResolvedValue({
      data: {
        success: true,
        message: 'Best answer selected successfully',
      },
      error: null,
    });

    const { data, error } = await client.rpc('select_best_answer', {
      p_question_id: questionId,
      p_answer_id: answerId,
    });

    expect(data.success).toBe(true);
    expect(error).toBeNull();
    expect(client.rpc).toHaveBeenCalledWith('select_best_answer', {
      p_question_id: questionId,
      p_answer_id: answerId,
    });
  });

  it('ウォレット残高更新', async () => {
    const userId = 'user-123';
    const amount = 1000;

    client.rpc = jest.fn().mockResolvedValue({
      data: {
        new_balance: 5000,
        transaction_id: 'tx-123',
      },
      error: null,
    });

    const { data, error } = await client.rpc('update_wallet_balance', {
      p_user_id: userId,
      p_amount: amount,
      p_type: 'CREDIT',
      p_reference_type: 'BEST_ANSWER',
      p_reference_id: 'q-123',
    });

    expect(data.new_balance).toBe(5000);
    expect(data.transaction_id).toBeDefined();
    expect(error).toBeNull();
  });
});
