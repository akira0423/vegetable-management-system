'use client'

import { useState, useEffect } from 'react'

export interface AuthUser {
  id: string
  email: string
  company_id: string
  role: 'admin' | 'manager' | 'operator' | 'user'
  full_name: string
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCurrentUser()
  }, [])

  const fetchCurrentUser = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // getCurrentUserと同じAPIエンドポイントを使用
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      })

      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
      } else if (response.status === 401) {
        // 認証されていない場合はログインページにリダイレクト
        setUser(null)
        window.location.href = '/login'
      } else {
        setError('ユーザー情報の取得に失敗しました')
      }
    } catch (err) {
      
      setError('認証エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return {
    user,
    loading,
    error,
    refetch: fetchCurrentUser
  }
}