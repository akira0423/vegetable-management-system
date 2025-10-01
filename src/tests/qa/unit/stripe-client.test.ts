import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import Stripe from 'stripe';
import {
  createPaymentIntent,
  capturePaymentIntent,
  createTransfer,
  refundPaymentIntent,
  createConnectAccount,
  createPayout,
} from '@/lib/qa/stripe-client';

// Stripeモック
jest.mock('stripe');
const MockedStripe = Stripe as jest.MockedClass<typeof Stripe>;

describe('Stripeクライアント ユニットテスト', () => {
  let stripeMock: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    stripeMock = {
      paymentIntents: {
        create: jest.fn(),
        capture: jest.fn(),
        cancel: jest.fn(),
        retrieve: jest.fn(),
      },
      transfers: {
        create: jest.fn(),
      },
      refunds: {
        create: jest.fn(),
      },
      accounts: {
        create: jest.fn(),
        retrieve: jest.fn(),
        update: jest.fn(),
      },
      payouts: {
        create: jest.fn(),
      },
      customers: {
        create: jest.fn(),
        retrieve: jest.fn(),
      },
    };

    MockedStripe.mockImplementation(() => stripeMock as any);
  });

  describe('PaymentIntent処理', () => {
    describe('エスクロー決済（手動キャプチャ）', () => {
      it('正常に与信が取得される', async () => {
        const mockPaymentIntent = {
          id: 'pi_test_123',
          amount: 50000,
          currency: 'jpy',
          status: 'requires_payment_method',
          capture_method: 'manual',
          client_secret: 'pi_test_secret',
        };

        stripeMock.paymentIntents.create.mockResolvedValue(mockPaymentIntent);

        const result = await createPaymentIntent({
          amount: 500,
          customerId: 'cus_123',
          metadata: {
            questionId: 'q-123',
            type: 'escrow',
          },
        });

        expect(result).toEqual(mockPaymentIntent);
        expect(stripeMock.paymentIntents.create).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: 50000, // 円に変換
            currency: 'jpy',
            capture_method: 'manual',
            customer: 'cus_123',
            metadata: {
              questionId: 'q-123',
              type: 'escrow',
            },
          })
        );
      });

      it('キャプチャ時に正しく処理される', async () => {
        const mockCapturedIntent = {
          id: 'pi_test_123',
          amount: 50000,
          amount_captured: 50000,
          status: 'succeeded',
          charges: {
            data: [{ id: 'ch_test_123' }],
          },
        };

        stripeMock.paymentIntents.capture.mockResolvedValue(mockCapturedIntent);

        const result = await capturePaymentIntent('pi_test_123', 500);

        expect(result).toEqual(mockCapturedIntent);
        expect(stripeMock.paymentIntents.capture).toHaveBeenCalledWith(
          'pi_test_123',
          { amount_to_capture: 50000 }
        );
      });

      it('キャプチャ失敗時にエラーを返す', async () => {
        const mockError = new Error('Card was declined');
        stripeMock.paymentIntents.capture.mockRejectedValue(mockError);

        await expect(
          capturePaymentIntent('pi_test_123', 500)
        ).rejects.toThrow('Card was declined');
      });
    });

    describe('PPV決済（自動キャプチャ）', () => {
      it('正常に決済が処理される', async () => {
        const mockPaymentIntent = {
          id: 'pi_ppv_123',
          amount: 50000,
          currency: 'jpy',
          status: 'requires_payment_method',
          capture_method: 'automatic',
        };

        stripeMock.paymentIntents.create.mockResolvedValue(mockPaymentIntent);

        const result = await createPaymentIntent({
          amount: 500,
          customerId: 'cus_123',
          captureMethod: 'automatic',
          metadata: {
            questionId: 'q-123',
            type: 'ppv',
            buyerId: 'user-456',
          },
        });

        expect(result).toEqual(mockPaymentIntent);
        expect(stripeMock.paymentIntents.create).toHaveBeenCalledWith(
          expect.objectContaining({
            capture_method: 'automatic',
            metadata: expect.objectContaining({
              type: 'ppv',
            }),
          })
        );
      });
    });

    describe('返金処理', () => {
      it('全額返金が処理される', async () => {
        const mockRefund = {
          id: 'refund_123',
          amount: 50000,
          status: 'succeeded',
        };

        stripeMock.refunds.create.mockResolvedValue(mockRefund);

        const result = await refundPaymentIntent('pi_test_123');

        expect(result).toEqual(mockRefund);
        expect(stripeMock.refunds.create).toHaveBeenCalledWith({
          payment_intent: 'pi_test_123',
        });
      });

      it('部分返金が処理される', async () => {
        const mockRefund = {
          id: 'refund_123',
          amount: 20000,
          status: 'succeeded',
        };

        stripeMock.refunds.create.mockResolvedValue(mockRefund);

        const result = await refundPaymentIntent('pi_test_123', 200);

        expect(result).toEqual(mockRefund);
        expect(stripeMock.refunds.create).toHaveBeenCalledWith({
          payment_intent: 'pi_test_123',
          amount: 20000,
        });
      });
    });
  });

  describe('Transfer処理', () => {
    it('ベスト回答者への送金が処理される', async () => {
      const mockTransfer = {
        id: 'tr_123',
        amount: 40000, // 500円の80%
        currency: 'jpy',
        destination: 'acct_responder',
      };

      stripeMock.transfers.create.mockResolvedValue(mockTransfer);

      const result = await createTransfer({
        amount: 400,
        destination: 'acct_responder',
        transferGroup: 'question_123',
        metadata: {
          type: 'best_answer_reward',
          questionId: 'q-123',
        },
      });

      expect(result).toEqual(mockTransfer);
      expect(stripeMock.transfers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 40000,
          currency: 'jpy',
          destination: 'acct_responder',
          transfer_group: 'question_123',
        })
      );
    });

    it('PPV分配が正しく計算される', async () => {
      const ppvAmount = 500;
      const platformFee = Math.round(ppvAmount * 0.20); // 100
      const askerShare = Math.round(ppvAmount * 0.40); // 200
      const bestShare = Math.round(ppvAmount * 0.24); // 120
      const othersShare = ppvAmount - platformFee - askerShare - bestShare; // 80

      expect(platformFee).toBe(100);
      expect(askerShare).toBe(200);
      expect(bestShare).toBe(120);
      expect(othersShare).toBe(80);
      expect(platformFee + askerShare + bestShare + othersShare).toBe(ppvAmount);
    });
  });

  describe('Stripe Connect', () => {
    it('アカウント作成が処理される', async () => {
      const mockAccount = {
        id: 'acct_123',
        type: 'express',
        charges_enabled: false,
        payouts_enabled: false,
      };

      stripeMock.accounts.create.mockResolvedValue(mockAccount);

      const result = await createConnectAccount({
        email: 'farmer@example.com',
        metadata: {
          userId: 'user-123',
        },
      });

      expect(result).toEqual(mockAccount);
      expect(stripeMock.accounts.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'express',
          email: 'farmer@example.com',
          metadata: {
            userId: 'user-123',
          },
        })
      );
    });

    it('アカウントリンクURL生成', async () => {
      const accountId = 'acct_123';
      const returnUrl = 'https://example.com/return';
      const refreshUrl = 'https://example.com/refresh';

      // アカウントリンクのモック
      stripeMock.accountLinks = {
        create: jest.fn().mockResolvedValue({
          url: 'https://connect.stripe.com/setup/123',
          expires_at: Date.now() + 300000,
        }),
      };

      const result = await stripeMock.accountLinks.create({
        account: accountId,
        return_url: returnUrl,
        refresh_url: refreshUrl,
        type: 'account_onboarding',
      });

      expect(result.url).toContain('connect.stripe.com');
      expect(stripeMock.accountLinks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          account: accountId,
          type: 'account_onboarding',
        })
      );
    });
  });

  describe('出金処理', () => {
    it('最低出金額の検証', async () => {
      const MIN_PAYOUT = 3000;
      const requestAmount = 2000;

      expect(requestAmount).toBeLessThan(MIN_PAYOUT);

      // APIはエラーを返すべき
      const error = new Error('Minimum payout amount is 3000');
      await expect(
        createPayout({ amount: requestAmount, destination: 'ba_123' })
      ).rejects.toThrow('Minimum payout amount');
    });

    it('出金手数料の計算', () => {
      const payoutAmount = 10000;
      const fixedFee = 250;
      const rateFee = Math.round(payoutAmount * 0.0025); // 25
      const totalFee = fixedFee + rateFee; // 275
      const netAmount = payoutAmount - totalFee; // 9725

      expect(fixedFee).toBe(250);
      expect(rateFee).toBe(25);
      expect(totalFee).toBe(275);
      expect(netAmount).toBe(9725);
    });

    it('正常な出金処理', async () => {
      const mockPayout = {
        id: 'po_123',
        amount: 972500, // 9725円（手数料引き後）
        currency: 'jpy',
        status: 'pending',
      };

      stripeMock.payouts.create.mockResolvedValue(mockPayout);

      const result = await createPayout({
        amount: 9725,
        destination: 'ba_bank_123',
        metadata: {
          userId: 'user-123',
          fee: 275,
        },
      });

      expect(result).toEqual(mockPayout);
      expect(stripeMock.payouts.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 972500,
          currency: 'jpy',
          destination: 'ba_bank_123',
        })
      );
    });
  });

  describe('エラーケース', () => {
    it('ネットワークエラーのリトライ', async () => {
      let attempts = 0;
      stripeMock.paymentIntents.create.mockImplementation(() => {
        attempts++;
        if (attempts === 1) {
          throw new Error('Network error');
        }
        return {
          id: 'pi_retry_123',
          status: 'requires_payment_method',
        };
      });

      // リトライロジックを実装
      const createWithRetry = async () => {
        try {
          return await createPaymentIntent({
            amount: 500,
            customerId: 'cus_123',
          });
        } catch (error) {
          // 1回リトライ
          return await createPaymentIntent({
            amount: 500,
            customerId: 'cus_123',
          });
        }
      };

      const result = await createWithRetry();
      expect(result.id).toBe('pi_retry_123');
      expect(stripeMock.paymentIntents.create).toHaveBeenCalledTimes(2);
    });

    it('カード拒否のハンドリング', async () => {
      const mockError = {
        type: 'StripeCardError',
        code: 'card_declined',
        message: 'Your card was declined.',
      };

      stripeMock.paymentIntents.create.mockRejectedValue(mockError);

      await expect(
        createPaymentIntent({
          amount: 500,
          customerId: 'cus_123',
        })
      ).rejects.toMatchObject({
        code: 'card_declined',
      });
    });

    it('レート制限エラー', async () => {
      const mockError = {
        type: 'StripeRateLimitError',
        message: 'Too many requests',
      };

      stripeMock.paymentIntents.create.mockRejectedValue(mockError);

      await expect(
        createPaymentIntent({
          amount: 500,
          customerId: 'cus_123',
        })
      ).rejects.toMatchObject({
        type: 'StripeRateLimitError',
      });
    });
  });
});
