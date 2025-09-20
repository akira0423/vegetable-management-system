/**
 * 本番環境用エラーハンドラー
 * 機密情報を含まない安全なエラーレスポンスを提供
 */

import { NextResponse } from 'next/server'

export interface ApiError {
  message: string
  code?: string
  statusCode?: number
  details?: any
}

/**
 * 本番環境で安全なエラーレスポンスを生成
 */
export function createSafeErrorResponse(
  error: any,
  defaultMessage: string = 'An error occurred',
  statusCode: number = 500
): NextResponse {
  // 開発環境では詳細なエラー情報を表示
  if (process.env.NODE_ENV === 'development') {
    const devError = {
      error: defaultMessage,
      details: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    }
    
    
    
    return NextResponse.json(devError, { status: statusCode })
  }

  // 本番環境では一般的なエラーメッセージのみ
  const safeError = {
    error: defaultMessage,
    timestamp: new Date().toISOString(),
    requestId: generateRequestId()
  }

  // 本番環境でのエラーログ（外部ログサービスに送信することを推奨）
  if (process.env.NODE_ENV === 'production') {
    
  }

  return NextResponse.json(safeError, { status: statusCode })
}

/**
 * データベースエラー用の安全なハンドラー
 */
export function handleDatabaseError(error: any): NextResponse {
  // 開発環境では詳細なデータベースエラーを表示
  if (process.env.NODE_ENV === 'development') {
    return createSafeErrorResponse(
      error,
      'Database operation failed',
      500
    )
  }

  // 本番環境では一般的なメッセージのみ
  return createSafeErrorResponse(
    null,
    'A server error occurred. Please try again later.',
    500
  )
}

/**
 * 認証エラー用ハンドラー
 */
export function handleAuthError(error: any): NextResponse {
  return createSafeErrorResponse(
    null,
    'Authentication failed. Please login again.',
    401
  )
}

/**
 * バリデーションエラー用ハンドラー
 */
export function handleValidationError(
  missingFields: string[],
  message?: string
): NextResponse {
  const defaultMessage = `Required fields missing: ${missingFields.join(', ')}`
  
  return createSafeErrorResponse(
    null,
    message || defaultMessage,
    400
  )
}

/**
 * 権限エラー用ハンドラー
 */
export function handlePermissionError(message?: string): NextResponse {
  return createSafeErrorResponse(
    null,
    message || 'Access denied. You do not have permission to perform this action.',
    403
  )
}

/**
 * レート制限エラー用ハンドラー
 */
export function handleRateLimitError(): NextResponse {
  return createSafeErrorResponse(
    null,
    'Too many requests. Please try again later.',
    429
  )
}

/**
 * リクエストID生成（ログトレーシング用）
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}

/**
 * エラー分類用ユーティリティ
 */
export function categorizeError(error: any): {
  category: 'database' | 'auth' | 'validation' | 'permission' | 'rate_limit' | 'unknown'
  statusCode: number
  message: string
} {
  if (error?.code === 'PGRST116' || error?.message?.includes('permission denied')) {
    return {
      category: 'permission',
      statusCode: 403,
      message: 'Access denied'
    }
  }

  if (error?.message?.includes('authentication') || error?.message?.includes('unauthorized')) {
    return {
      category: 'auth',
      statusCode: 401,
      message: 'Authentication required'
    }
  }

  if (error?.message?.includes('validation') || error?.message?.includes('required')) {
    return {
      category: 'validation',
      statusCode: 400,
      message: 'Invalid request data'
    }
  }

  if (error?.code?.startsWith('PGRST') || error?.message?.includes('database')) {
    return {
      category: 'database',
      statusCode: 500,
      message: 'Server error occurred'
    }
  }

  return {
    category: 'unknown',
    statusCode: 500,
    message: 'An unexpected error occurred'
  }
}