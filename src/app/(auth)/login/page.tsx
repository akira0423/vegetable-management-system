'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Sprout, Mail, Lock, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // 環境変数をデバッグログに出力（本番環境では削除予定）
      if (process.env.NODE_ENV === 'development') {
        
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        
        
        // より詳細なエラーメッセージを提供
        if (error.message.includes('Invalid login credentials')) {
          setError('メールアドレスまたはパスワードが正しくありません。')
        } else if (error.message.includes('Email not confirmed')) {
          setError('メールアドレスの確認が完了していません。確認メールをチェックしてください。')
        } else if (error.message.includes('Too many requests')) {
          setError('ログイン試行回数が上限に達しました。しばらく経ってから再試行してください。')
        } else {
          setError(`ログインエラー: ${error.message}`)
        }
        return
      }

      if (data?.user) {
        console.log('Login successful, ensuring profile exists...')

        // プロファイルの確認・作成
        try {
          const profileResponse = await fetch('/api/auth/ensure-profile', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            }
          })

          const profileData = await profileResponse.json()
          console.log('Profile status:', profileData)

          if (!profileData.success) {
            setError('プロファイル作成に失敗しました。もう一度お試しください。')
            return
          }
        } catch (profileError) {
          console.error('Profile check error:', profileError)
        }

        // ミドルウェアに認証直後であることを通知
        document.cookie = `auth_timestamp=${Date.now()}; path=/; max-age=10`

        console.log('Redirecting to dashboard...')
        // 少し待ってからリダイレクト（セッション同期を待つ）
        setTimeout(() => {
          window.location.href = '/dashboard/gantt'
        }, 500)

        return // 追加の処理を防ぐ
      } else {
        console.log('Login response but no user data')
        setError('ログインに失敗しました。もう一度お試しください。')
      }
    } catch (err) {
      
      setError('システムエラーが発生しました。しばらく経ってから再試行してください。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2">
            <Sprout className="h-8 w-8 text-green-600" />
            <span className="text-xl font-bold text-gray-900">野菜栽培管理システム</span>
          </Link>
        </div>

        {/* Login Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-center">ログイン</CardTitle>
            <CardDescription className="text-center">
              企業アカウントでログインしてください
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-md mb-4">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-gray-700">
                  メールアドレス
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your-email@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-gray-700">
                  パスワード
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={loading}
              >
                {loading ? 'ログイン中...' : 'ログイン'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                アカウントをお持ちでない方は{' '}
                <Link href="/signup" className="text-green-600 hover:underline">
                  新規登録
                </Link>
              </p>
            </div>

            <div className="mt-4 pt-4 border-t text-center">
              <Link href="/" className="text-sm text-gray-500 hover:underline">
                ← ホームに戻る
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}