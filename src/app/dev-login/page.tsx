'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

// 開発環境専用のテストユーザー
const TEST_USERS = [
  {
    id: 'user1',
    email: 'admin@test.com',
    password: 'password123',
    full_name: '管理者太郎',
    role: 'admin',
    company_id: 'company1'
  },
  {
    id: 'user2', 
    email: 'manager@test.com',
    password: 'password123',
    full_name: 'マネージャー花子',
    role: 'manager',
    company_id: 'company1'
  },
  {
    id: 'user3',
    email: 'operator@test.com', 
    password: 'password123',
    full_name: 'オペレーター一郎',
    role: 'operator',
    company_id: 'company1'
  }
]

export default function DevLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // テストユーザーの認証
    const user = TEST_USERS.find(u => u.email === email && u.password === password)
    
    if (!user) {
      setError('無効なメールアドレスまたはパスワードです')
      setLoading(false)
      return
    }

    try {
      const userJson = JSON.stringify(user)
      
      // セッション情報をローカルストレージとクッキーに保存（開発環境のみ）
      localStorage.setItem('dev_user', userJson)
      
      // クッキーにも保存（サーバーサイドからアクセスできるように）
      document.cookie = `dev_user=${encodeURIComponent(userJson)}; path=/; max-age=86400`
      
      // ダッシュボードにリダイレクト
      router.push('/dashboard')
      
    } catch (err) {
      setError('ログインに失敗しました')
      setLoading(false)
    }
  }

  const handleTestLogin = (testUser: typeof TEST_USERS[0]) => {
    setEmail(testUser.email)
    setPassword(testUser.password)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>開発環境ログイン</CardTitle>
          <CardDescription>
            開発・テスト用の簡易ログインシステムです
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <AlertDescription>
              <strong>⚠️ 開発環境専用</strong><br/>
              本番環境では使用しないでください
            </AlertDescription>
          </Alert>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">パスワード</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button 
              type="submit" 
              className="w-full"
              disabled={loading}
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </Button>
          </form>

          <div className="mt-6">
            <p className="text-sm text-gray-600 mb-2">テストユーザー:</p>
            <div className="space-y-2">
              {TEST_USERS.map((user, index) => (
                <Button
                  key={index}
                  variant="outline" 
                  size="sm"
                  className="w-full text-left justify-start"
                  onClick={() => handleTestLogin(user)}
                >
                  <div>
                    <div className="font-medium">{user.full_name} ({user.role})</div>
                    <div className="text-xs text-gray-500">{user.email}</div>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}