import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// Redisクライアントの初期化（環境変数が設定されている場合のみ）
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

// メモリベースのレートリミット（Redisが利用できない場合のフォールバック）
const memoryStore = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitConfig {
  interval: number; // ミリ秒
  uniqueTokenPerInterval: number; // インターバルあたりのリクエスト数
}

const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  // 一般エンドポイント
  general: {
    interval: 60000, // 1分
    uniqueTokenPerInterval: 60, // 60リクエスト/分
  },
  // 質問投稿
  'qa/questions': {
    interval: 3600000, // 1時間
    uniqueTokenPerInterval: 10, // 10質問/時間
  },
  // 回答投稿
  'qa/answers': {
    interval: 600000, // 10分
    uniqueTokenPerInterval: 20, // 20回答/10分
  },
  // 決済エンドポイント
  'qa/payments': {
    interval: 60000, // 1分
    uniqueTokenPerInterval: 10, // 10決済/分
  },
  // 出金申請
  'qa/payouts': {
    interval: 86400000, // 24時間
    uniqueTokenPerInterval: 3, // 3回/日
  },
};

/**
 * IPアドレスを取得
 */
function getIpAddress(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const real = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] || real || 'unknown';
  return ip.trim();
}

/**
 * エンドポイントを解析
 */
function getEndpointKey(pathname: string): string {
  // /api/qa/questions -> qa/questions
  const path = pathname.replace(/^\/api\//, '');
  
  // 動的ルートの処理
  const normalized = path
    .replace(/\/[a-f0-9-]{36}/gi, '/:id') // UUIDを:idに置換
    .replace(/\/\d+/g, '/:id'); // 数値IDを:idに置換

  return normalized;
}

/**
 * レートリミットチェック（Redis版）
 */
async function checkRateLimitWithRedis(
  key: string,
  limit: RateLimitConfig
): Promise<{ success: boolean; remaining: number; reset: number }> {
  if (!redis) {
    return { success: true, remaining: limit.uniqueTokenPerInterval, reset: 0 };
  }

  const now = Date.now();
  const window = Math.floor(now / limit.interval) * limit.interval;
  const redisKey = `rate_limit:${key}:${window}`;

  try {
    const count = await redis.incr(redisKey);
    
    if (count === 1) {
      // 初回のリクエストの場合、TTLを設定
      await redis.expire(redisKey, Math.ceil(limit.interval / 1000));
    }

    const remaining = Math.max(0, limit.uniqueTokenPerInterval - count);
    const reset = window + limit.interval;

    return {
      success: count <= limit.uniqueTokenPerInterval,
      remaining,
      reset,
    };
  } catch (error) {
    console.error('Redis rate limit error:', error);
    // エラーの場合は通す
    return { success: true, remaining: limit.uniqueTokenPerInterval, reset: 0 };
  }
}

/**
 * レートリミットチェック（メモリ版）
 */
function checkRateLimitWithMemory(
  key: string,
  limit: RateLimitConfig
): { success: boolean; remaining: number; reset: number } {
  const now = Date.now();
  const window = Math.floor(now / limit.interval) * limit.interval;
  const memoryKey = `${key}:${window}`;

  // 古いエントリをクリーンアップ
  for (const [k, v] of memoryStore.entries()) {
    if (v.resetAt < now) {
      memoryStore.delete(k);
    }
  }

  const current = memoryStore.get(memoryKey) || {
    count: 0,
    resetAt: window + limit.interval,
  };

  current.count++;
  memoryStore.set(memoryKey, current);

  const remaining = Math.max(0, limit.uniqueTokenPerInterval - current.count);

  return {
    success: current.count <= limit.uniqueTokenPerInterval,
    remaining,
    reset: current.resetAt,
  };
}

/**
 * レートリミットミドルウェア
 */
export async function rateLimit(
  request: NextRequest,
  config?: RateLimitConfig
): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname;
  const endpointKey = getEndpointKey(pathname);
  const ip = getIpAddress(request);
  
  // 設定を取得
  const limit = config || DEFAULT_LIMITS[endpointKey] || DEFAULT_LIMITS.general;
  
  // レートリミットキーを生成
  const rateLimitKey = `${endpointKey}:${ip}`;
  
  // レートリミットチェック
  const result = redis
    ? await checkRateLimitWithRedis(rateLimitKey, limit)
    : checkRateLimitWithMemory(rateLimitKey, limit);
  
  // ヘッダーを設定
  const headers = new Headers();
  headers.set('X-RateLimit-Limit', limit.uniqueTokenPerInterval.toString());
  headers.set('X-RateLimit-Remaining', result.remaining.toString());
  headers.set('X-RateLimit-Reset', new Date(result.reset).toISOString());
  
  // レートリミット超過の場合
  if (!result.success) {
    headers.set('Retry-After', Math.ceil((result.reset - Date.now()) / 1000).toString());
    
    return new NextResponse(
      JSON.stringify({
        error: 'Too many requests',
        message: `Rate limit exceeded. Please retry after ${new Date(result.reset).toISOString()}`,
      }),
      {
        status: 429,
        headers,
      }
    );
  }
  
  // 正常の場合はnullを返し、後続処理を続行
  return null;
}

/**
 * Expressスタイルのミドルウェアラッパー
 */
export function withRateLimit(config?: RateLimitConfig) {
  return async (request: NextRequest) => {
    const rateLimitResponse = await rateLimit(request, config);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    // レートリミットを通過した場合はnullを返す
    return null;
  };
}