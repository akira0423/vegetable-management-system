'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Users, 
  Building2, 
  Calendar, 
  UserPlus,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Shield,
  UserCog,
  Crown,
  Loader2
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import Image from 'next/image'

interface InvitationData {
  id: string
  email: string
  full_name?: string
  role: 'admin' | 'manager' | 'operator'
  status: string
  expires_at: string
  created_at: string
  invitation_message?: string
  is_valid: boolean
  error_reason?: string
  companies: {
    name: string
    logo_url?: string
  }
  invited_by: {
    full_name?: string
    email: string
  }
}

const ROLE_CONFIG = {
  admin: {
    label: '管理者',
    description: '全機能へのアクセス権限',
    color: 'bg-red-100 text-red-800',
    icon: Crown
  },
  manager: {
    label: 'マネージャー',
    description: '管理・レポート機能',
    color: 'bg-blue-100 text-blue-800',
    icon: UserCog
  },
  operator: {
    label: 'オペレーター',
    description: '基本操作のみ',
    color: 'bg-green-100 text-green-800',
    icon: Users
  }
}

export default function InvitePage() {
  const router = useRouter()
  const params = useParams()
  const token = params.token as string

  const [invitation, setInvitation] = useState<InvitationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    if (token) {
      fetchInvitation()
      checkCurrentUser()
    }
  }, [token])

  const fetchInvitation = async () => {
    try {
      const response = await fetch(`/api/invitations/accept?token=${token}`)
      const data = await response.json()

      if (data.success) {
        setInvitation(data.invitation)
      } else {
        setError(data.error)
        if (data.invitation) {
          setInvitation(data.invitation)
        }
      }
    } catch (err) {
      
      setError('招待情報の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const checkCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/user')
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setUser(data.user)
        }
      }
    } catch (err) {
      
    }
  }

  const handleAcceptInvitation = async () => {
    if (!user) {
      // 未ログインの場合はログインページにリダイレクト
      const currentUrl = window.location.href
      router.push(`/login?redirect=${encodeURIComponent(currentUrl)}`)
      return
    }

    setAccepting(true)
    try {
      const response = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          user_id: user.id
        })
      })

      const data = await response.json()

      if (data.success) {
        // 成功時はダッシュボードにリダイレクト
        router.push('/dashboard?invitation_accepted=true')
      } else {
        setError(data.error)
      }
    } catch (err) {
      
      setError('招待の受諾に失敗しました')
    } finally {
      setAccepting(false)
    }
  }

  const handleDeclineInvitation = () => {
    // 招待を辞退（ページを閉じるか別ページに遷移）
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-12">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-gray-400 mb-4" />
            <p className="text-gray-600">招待情報を確認中...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-12">
            <XCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              招待が見つかりません
            </h2>
            <p className="text-gray-600 mb-6">
              {error}
            </p>
            <Button onClick={() => router.push('/')}>
              ホームに戻る
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!invitation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-12">
            <AlertTriangle className="w-16 h-16 mx-auto text-yellow-500 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              招待情報が取得できません
            </h2>
            <Button onClick={() => router.push('/')}>
              ホームに戻る
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const roleConfig = ROLE_CONFIG[invitation.role]
  const RoleIcon = roleConfig.icon

  // 無効な招待の場合
  if (!invitation.is_valid) {
    let title = '招待が無効です'
    let description = error || '詳細不明'
    let icon = <XCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />

    if (invitation.error_reason === 'expired') {
      title = '招待の期限が切れています'
      description = `この招待は ${format(parseISO(invitation.expires_at), 'yyyy年MM月dd日', { locale: ja })} に期限切れになりました`
      icon = <Clock className="w-16 h-16 mx-auto text-yellow-500 mb-4" />
    } else if (invitation.error_reason === 'already_processed') {
      title = '招待は既に処理されています'
      description = 'この招待は既に受諾または辞退されています'
      icon = <CheckCircle className="w-16 h-16 mx-auto text-gray-500 mb-4" />
    }

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-12">
            {icon}
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {title}
            </h2>
            <p className="text-gray-600 mb-6">
              {description}
            </p>
            <Button onClick={() => router.push('/')}>
              ホームに戻る
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          {invitation.companies.logo_url && (
            <div className="w-16 h-16 mx-auto mb-4 rounded-full overflow-hidden bg-white shadow-sm">
              <Image
                src={invitation.companies.logo_url}
                alt={invitation.companies.name}
                width={64}
                height={64}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <CardTitle className="text-2xl font-bold text-gray-900">
            チームに招待されました
          </CardTitle>
          <CardDescription>
            {invitation.companies.name}への参加招待です
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* 招待情報 */}
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <UserPlus className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-blue-900 font-medium">
                  {invitation.invited_by.full_name || invitation.invited_by.email}さんから招待されました
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  {format(parseISO(invitation.created_at), 'yyyy年MM月dd日', { locale: ja })}
                </p>
              </div>
            </div>
          </div>

          {/* 招待詳細 */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900">{invitation.companies.name}</p>
                <p className="text-sm text-gray-600">会社名</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <RoleIcon className="w-5 h-5 text-gray-400" />
              <div>
                <Badge className={roleConfig.color} variant="secondary">
                  <RoleIcon className="w-3 h-3 mr-1" />
                  {roleConfig.label}
                </Badge>
                <p className="text-sm text-gray-600 mt-1">{roleConfig.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900">
                  {format(parseISO(invitation.expires_at), 'yyyy年MM月dd日', { locale: ja })}
                </p>
                <p className="text-sm text-gray-600">招待期限</p>
              </div>
            </div>
          </div>

          {/* 招待メッセージ */}
          {invitation.invitation_message && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">メッセージ</h4>
              <p className="text-sm text-gray-700">
                {invitation.invitation_message}
              </p>
            </div>
          )}

          {/* ログイン状態による表示切り替え */}
          {!user ? (
            <Alert>
              <Shield className="w-4 h-4" />
              <AlertDescription>
                招待を受諾するにはログインが必要です。ログイン後、このページに戻ってきてください。
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <CheckCircle className="w-4 h-4" />
              <AlertDescription>
                {user.email} としてログイン中です。招待を受諾できます。
              </AlertDescription>
            </Alert>
          )}

          {/* アクションボタン */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={handleDeclineInvitation}
              className="flex-1"
              disabled={accepting}
            >
              辞退
            </Button>
            <Button
              onClick={handleAcceptInvitation}
              className="flex-1"
              disabled={accepting}
            >
              {accepting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {user ? '受諾中...' : 'ログイン中...'}
                </>
              ) : (
                <>
                  {user ? '招待を受諾' : 'ログインして受諾'}
                </>
              )}
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                {error}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}