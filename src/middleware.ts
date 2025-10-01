import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/qa/middleware/rate-limit';

export async function middleware(request: NextRequest) {
  // Q&A APIエンドポイントのみレートリミットを適用
  if (request.nextUrl.pathname.startsWith('/api/qa/')) {
    const rateLimitResponse = await rateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
  }

  // レートリミットを通過した場合は通常の処理を続行
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Q&A APIエンドポイント
    '/api/qa/:path*',
  ],
};