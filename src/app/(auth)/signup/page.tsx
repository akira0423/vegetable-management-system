'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Sprout, Mail, Lock, User, Building, AlertCircle, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    companyName: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const validateForm = () => {
    if (formData.password !== formData.confirmPassword) {
      setError('パスワードが一致しません')
      return false
    }
    if (formData.password.length < 8) {
      setError('パスワードは8文字以上で入力してください')
      return false
    }
    return true
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!validateForm()) {
      setLoading(false)
      return
    }

    try {
      // Step 1: Supabase認証ユーザー作成
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            company_name: formData.companyName,
          },
        },
      })

      if (error) {
        if (error.message.includes('already registered')) {
          setError('このメールアドレスは既に登録されています')
        } else {
          setError('アカウント作成に失敗しました。入力内容を確認してください。')
        }
        return
      }

      // Step 2: アプリケーション側データ作成
      if (data.user) {
        const completeResponse = await fetch('/api/auth/complete-signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: data.user.id,
            email: formData.email,
            full_name: formData.fullName,
            company_name: formData.companyName
          })
        })

        const completeResult = await completeResponse.json()

        if (!completeResult.success) {
          setError(`アカウント作成に失敗しました: ${completeResult.error}`)
          return
        }

        
      }

      setSuccess(true)
    } catch (err) {
      setError('システムエラーが発生しました。しばらく経ってから再試行してください。')
      
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card>
            <CardContent className="pt-6 text-center">
              <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                登録完了
              </h2>
              <p className="text-gray-600 mb-6">
                確認メールを送信しました。メールをご確認いただき、アカウントを有効化してください。
              </p>
              <div className="space-y-3">
                <Button
                  onClick={() => router.push('/login')}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  ログインページへ
                </Button>
                <Link href="/" className="block text-sm text-gray-500 hover:underline">
                  ホームに戻る
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
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

        {/* Signup Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-center">新規登録</CardTitle>
            <CardDescription className="text-center">
              企業アカウントを作成してください
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-md mb-4">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="companyName" className="text-sm font-medium text-gray-700">
                  会社名
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="companyName"
                    name="companyName"
                    type="text"
                    placeholder="株式会社○○"
                    value={formData.companyName}
                    onChange={handleInputChange}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="fullName" className="text-sm font-medium text-gray-700">
                  担当者名
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="fullName"
                    name="fullName"
                    type="text"
                    placeholder="山田 太郎"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-gray-700">
                  メールアドレス
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="your-email@company.com"
                    value={formData.email}
                    onChange={handleInputChange}
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
                    name="password"
                    type="password"
                    placeholder="8文字以上"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                  パスワード（確認）
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    placeholder="パスワードを再入力"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
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
                {loading ? 'アカウント作成中...' : 'アカウント作成'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                既にアカウントをお持ちの方は{' '}
                <Link href="/login" className="text-green-600 hover:underline">
                  ログイン
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