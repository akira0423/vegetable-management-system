/**
 * API認証ミドルウェア
 * 本番環境でのAPIエンドポイント保護
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string
    email: string
    company_id?: string
  }
}

/**
 * APIエンドポイント用認証ミドルウェア
 * 認証されていないリクエストを拒否
 */
export async function requireAuth(request: NextRequest): Promise<{
  success: boolean
  user?: any
  error?: string
  response?: NextResponse
}> {
  try {
    // 本番環境でない場合は認証をスキップ（開発便利のため）
    if (process.env.NODE_ENV !== 'production') {
      return { success: true }
    }

    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return {
        success: false,
        error: 'Authentication required',
        response: NextResponse.json(
          { error: 'Authentication required', message: 'Please login to access this resource' },
          { status: 401 }
        )
      }
    }

    // ユーザー情報を取得
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (profileError) {
      return {
        success: false,
        error: 'User profile not found',
        response: NextResponse.json(
          { error: 'User profile not found' },
          { status: 401 }
        )
      }
    }

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        company_id: userProfile?.company_id
      }
    }
  } catch (error) {
    return {
      success: false,
      error: 'Authentication failed',
      response: NextResponse.json(
        { error: 'Authentication failed' },
        { status: 500 }
      )
    }
  }
}

/**
 * 会社別データアクセス権限チェック
 */
export async function requireCompanyAccess(
  request: NextRequest,
  companyId: string
): Promise<{
  success: boolean
  error?: string
  response?: NextResponse
}> {
  const authResult = await requireAuth(request)
  
  if (!authResult.success) {
    return authResult
  }

  if (!authResult.user?.company_id) {
    return {
      success: false,
      error: 'Company access required',
      response: NextResponse.json(
        { error: 'Company access required' },
        { status: 403 }
      )
    }
  }

  if (authResult.user.company_id !== companyId) {
    return {
      success: false,
      error: 'Access denied to this company data',
      response: NextResponse.json(
        { error: 'Access denied to this company data' },
        { status: 403 }
      )
    }
  }

  return { success: true }
}

/**
 * 入力値バリデーション用ヘルパー
 */
export function validateRequired(data: any, requiredFields: string[]): {
  isValid: boolean
  missing: string[]
} {
  const missing = requiredFields.filter(field => 
    !data[field] || (typeof data[field] === 'string' && data[field].trim() === '')
  )
  
  return {
    isValid: missing.length === 0,
    missing
  }
}

/**
 * SQLインジェクション防止のための文字列サニタイズ
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return ''
  
  return input
    .replace(/['"\\;]/g, '') // 危険な文字を除去
    .trim()
    .substring(0, 1000) // 長すぎる文字列を制限
}

/**
 * APIレート制限（簡易実装）
 */
const requestCounts = new Map<string, { count: number, resetTime: number }>()

export function rateLimit(clientId: string, maxRequests: number = 100, windowMs: number = 60000): boolean {
  const now = Date.now()
  const clientData = requestCounts.get(clientId)

  if (!clientData || now > clientData.resetTime) {
    requestCounts.set(clientId, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (clientData.count >= maxRequests) {
    return false
  }

  clientData.count++
  return true
}