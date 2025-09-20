'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter,
  Edit3,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Clock,
  Crown,
  UserCog,
  Eye,
  EyeOff,
  RefreshCw,
  Download,
  Send,
  Copy,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Calendar
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import Image from 'next/image'

interface Membership {
  id: string
  user_id: string
  email: string
  full_name?: string
  role: 'admin' | 'manager' | 'operator'
  status: 'active' | 'inactive' | 'pending'
  phone?: string
  department?: string
  position?: string
  invited_at?: string
  accepted_at?: string
  created_at: string
  updated_at: string
  stats?: {
    total_logins: number
    last_login_at?: string
    reports_created: number
    photos_uploaded: number
    vegetables_managed: number
    last_activity_at?: string
  }
}

interface Invitation {
  id: string
  email: string
  full_name?: string
  role: 'admin' | 'manager' | 'operator'
  status: 'pending' | 'accepted' | 'expired' | 'cancelled'
  invitation_token: string
  expires_at: string
  created_at: string
  invited_by: {
    full_name?: string
    email: string
  }
}

interface InvitationFormData {
  email: string
  full_name: string
  role: 'admin' | 'manager' | 'operator'
  invitation_message: string
}

const USER_ROLES = [
  { 
    value: 'admin', 
    label: '管理者', 
    description: '全機能へのアクセス権限',
    color: 'bg-red-100 text-red-800',
    icon: Crown
  },
  { 
    value: 'manager', 
    label: 'マネージャー', 
    description: '管理・レポート機能',
    color: 'bg-blue-100 text-blue-800',
    icon: UserCog
  },
  { 
    value: 'operator', 
    label: 'オペレーター', 
    description: '基本操作のみ',
    color: 'bg-green-100 text-green-800',
    icon: Users
  }
]

const DEPARTMENTS = [
  '栽培部',
  '品質管理部',
  '営業部',
  '管理部',
  '技術部',
  'その他'
]

export default function MembersPage() {
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  // フィルター・検索状態
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRole, setSelectedRole] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  
  // モーダル状態
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedMembership, setSelectedMembership] = useState<Membership | null>(null)
  
  // フォーム状態
  const [inviteFormData, setInviteFormData] = useState<InvitationFormData>({
    email: '',
    full_name: '',
    role: 'operator',
    invitation_message: ''
  })
  const [editFormData, setEditFormData] = useState<Partial<Membership>>({})
  const [formLoading, setFormLoading] = useState(false)
  
  // 通知状態
  const [notification, setNotification] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    await Promise.all([
      fetchMemberships(),
      fetchInvitations()
    ])
    setLoading(false)
  }

  const fetchMemberships = async () => {
    try {
      const response = await fetch('/api/memberships?include_stats=true')
      const result = await response.json()

      if (result.success) {
        setMemberships(result.data)
      } else {
        
        showNotification('error', result.error)
      }
    } catch (error) {
      
      showNotification('error', 'メンバー情報の取得に失敗しました')
    }
  }

  const fetchInvitations = async () => {
    try {
      const response = await fetch('/api/invitations')
      const result = await response.json()

      if (result.success) {
        setInvitations(result.data)
      } else {
        
        // 招待取得エラーは警告レベルとする（メンバーシップは取得できている可能性）
        
      }
    } catch (error) {
      
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 5000)
  }

  const handleSendInvitation = async () => {
    setFormLoading(true)
    try {
      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(inviteFormData)
      })

      const result = await response.json()

      if (result.success) {
        showNotification('success', '招待を送信しました')
        setShowInviteModal(false)
        resetInviteForm()
        await fetchInvitations()
      } else {
        showNotification('error', result.error)
      }
    } catch (error) {
      
      showNotification('error', '招待の送信に失敗しました')
    } finally {
      setFormLoading(false)
    }
  }

  const handleUpdateMembership = async () => {
    if (!selectedMembership) return
    
    setFormLoading(true)
    try {
      const response = await fetch('/api/memberships', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          membership_id: selectedMembership.id,
          ...editFormData
        })
      })

      const result = await response.json()

      if (result.success) {
        showNotification('success', 'メンバー情報を更新しました')
        setShowEditModal(false)
        setSelectedMembership(null)
        await fetchMemberships()
      } else {
        showNotification('error', result.error)
      }
    } catch (error) {
      
      showNotification('error', 'メンバー情報の更新に失敗しました')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDeleteMembership = async (membership: Membership) => {
    if (!confirm(`「${membership.full_name || membership.email}」をチームから削除しますか？この操作は取り消せません。`)) {
      return
    }

    try {
      const response = await fetch(`/api/memberships?id=${membership.id}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        showNotification('success', 'メンバーを削除しました')
        await fetchMemberships()
      } else {
        showNotification('error', result.error)
      }
    } catch (error) {
      
      showNotification('error', 'メンバーの削除に失敗しました')
    }
  }

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/invitations?id=${invitationId}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        showNotification('success', '招待をキャンセルしました')
        await fetchInvitations()
      } else {
        showNotification('error', result.error)
      }
    } catch (error) {
      
      showNotification('error', '招待のキャンセルに失敗しました')
    }
  }

  const resetInviteForm = () => {
    setInviteFormData({
      email: '',
      full_name: '',
      role: 'operator',
      invitation_message: ''
    })
  }

  const openEditModal = (membership: Membership) => {
    setSelectedMembership(membership)
    setEditFormData({
      full_name: membership.full_name,
      role: membership.role,
      status: membership.status,
      phone: membership.phone,
      department: membership.department,
      position: membership.position
    })
    setShowEditModal(true)
  }

  const copyInvitationLink = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`
    navigator.clipboard.writeText(url)
    showNotification('success', '招待リンクをコピーしました')
  }

  const getRoleConfig = (role: string) => {
    return USER_ROLES.find(r => r.value === role) || USER_ROLES[2]
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">アクティブ</Badge>
      case 'inactive':
        return <Badge className="bg-gray-100 text-gray-800">非アクティブ</Badge>
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">保留中</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>
    }
  }

  const getInvitationStatusBadge = (invitation: Invitation) => {
    const isExpired = new Date(invitation.expires_at) < new Date()
    
    switch (invitation.status) {
      case 'pending':
        if (isExpired) {
          return <Badge className="bg-red-100 text-red-800">期限切れ</Badge>
        }
        return <Badge className="bg-blue-100 text-blue-800">送信済み</Badge>
      case 'accepted':
        return <Badge className="bg-green-100 text-green-800">受諾済み</Badge>
      case 'expired':
        return <Badge className="bg-red-100 text-red-800">期限切れ</Badge>
      case 'cancelled':
        return <Badge className="bg-gray-100 text-gray-800">キャンセル</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-800">{invitation.status}</Badge>
    }
  }

  // フィルタリング
  const filteredMemberships = memberships.filter(member => {
    // 検索クエリフィルター
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesName = member.full_name?.toLowerCase().includes(query)
      const matchesEmail = member.email.toLowerCase().includes(query)
      const matchesDepartment = member.department?.toLowerCase().includes(query)
      
      if (!matchesName && !matchesEmail && !matchesDepartment) {
        return false
      }
    }
    
    // ロールフィルター
    if (selectedRole !== 'all' && member.role !== selectedRole) {
      return false
    }
    
    // ステータスフィルター
    if (selectedStatus !== 'all' && member.status !== selectedStatus) {
      return false
    }
    
    return true
  })

  const filteredInvitations = invitations.filter(invitation => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesName = invitation.full_name?.toLowerCase().includes(query)
      const matchesEmail = invitation.email.toLowerCase().includes(query)
      
      if (!matchesName && !matchesEmail) {
        return false
      }
    }
    
    if (selectedRole !== 'all' && invitation.role !== selectedRole) {
      return false
    }
    
    return true
  })

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 通知 */}
      {notification && (
        <Alert variant={notification.type === 'error' ? 'destructive' : 'default'}>
          {notification.type === 'success' ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <AlertTriangle className="w-4 h-4" />
          )}
          <AlertDescription>
            {notification.message}
          </AlertDescription>
        </Alert>
      )}

      {/* ヘッダー */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">チーム管理</h1>
          <p className="text-gray-600">
            メンバーと招待の管理
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            更新
          </Button>
          
          <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={resetInviteForm}>
                <Send className="w-4 h-4 mr-2" />
                メンバーを招待
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>メンバー招待</DialogTitle>
                <DialogDescription>
                  新しいメンバーをチームに招待します
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>メールアドレス *</Label>
                  <Input
                    type="email"
                    value={inviteFormData.email}
                    onChange={(e) => setInviteFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="user@example.com"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>氏名</Label>
                  <Input
                    value={inviteFormData.full_name}
                    onChange={(e) => setInviteFormData(prev => ({ ...prev, full_name: e.target.value }))}
                    placeholder="山田 太郎"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>権限レベル *</Label>
                  <Select 
                    value={inviteFormData.role} 
                    onValueChange={(value: 'admin' | 'manager' | 'operator') => 
                      setInviteFormData(prev => ({ ...prev, role: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {USER_ROLES.map(role => {
                        const Icon = role.icon
                        return (
                          <SelectItem key={role.value} value={role.value}>
                            <div className="flex items-center gap-2">
                              <Icon className="w-4 h-4" />
                              <div>
                                <div className="font-medium">{role.label}</div>
                                <div className="text-xs text-gray-500">{role.description}</div>
                              </div>
                            </div>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2 mt-4">
                <Label>招待メッセージ（任意）</Label>
                <Textarea
                  value={inviteFormData.invitation_message}
                  onChange={(e) => setInviteFormData(prev => ({ ...prev, invitation_message: e.target.value }))}
                  placeholder="チームに参加していただき、一緒に働けることを楽しみにしています。"
                  rows={3}
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowInviteModal(false)}
                  disabled={formLoading}
                >
                  キャンセル
                </Button>
                <Button
                  onClick={handleSendInvitation}
                  disabled={formLoading || !inviteFormData.email}
                >
                  {formLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      送信中...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      招待を送信
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 統計サマリー */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">
              {memberships.filter(m => m.status === 'active').length}
            </div>
            <div className="text-sm text-gray-600">アクティブメンバー</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {memberships.filter(m => m.role === 'admin').length}
            </div>
            <div className="text-sm text-gray-600">管理者</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">
              {invitations.filter(i => i.status === 'pending').length}
            </div>
            <div className="text-sm text-gray-600">保留中の招待</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-gray-600">
              {memberships.length + invitations.filter(i => i.status === 'pending').length}
            </div>
            <div className="text-sm text-gray-600">総メンバー数</div>
          </CardContent>
        </Card>
      </div>

      {/* フィルター・検索バー */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Filter className="w-5 h-5 mr-2" />
            フィルター・検索
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>検索</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="名前・メールで検索"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>権限</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  {USER_ROLES.map(role => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>ステータス</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  <SelectItem value="active">アクティブ</SelectItem>
                  <SelectItem value="inactive">非アクティブ</SelectItem>
                  <SelectItem value="pending">保留中</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* メンバー・招待タブ */}
      <Tabs defaultValue="members" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="members">
            メンバー ({filteredMemberships.length})
          </TabsTrigger>
          <TabsTrigger value="invitations">
            招待 ({filteredInvitations.length})
          </TabsTrigger>
        </TabsList>

        {/* メンバータブ */}
        <TabsContent value="members" className="space-y-4 mt-6">
          {filteredMemberships.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Users className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  メンバーが見つかりません
                </h3>
                <p className="text-gray-600 mb-4">
                  {searchQuery || selectedRole !== 'all' ? 
                    'フィルター条件に一致するメンバーがいません' :
                    '最初のメンバーを招待してください'
                  }
                </p>
                <Button onClick={() => setShowInviteModal(true)}>
                  <Send className="w-4 h-4 mr-2" />
                  メンバーを招待
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredMemberships.map((member) => {
                const roleConfig = getRoleConfig(member.role)
                const RoleIcon = roleConfig.icon
                
                return (
                  <Card key={member.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        {/* メンバー基本情報 */}
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                            <Users className="w-6 h-6 text-gray-600" />
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="font-semibold text-gray-900">
                                {member.full_name || member.email}
                              </h3>
                              <Badge className={roleConfig.color} variant="secondary">
                                <RoleIcon className="w-3 h-3 mr-1" />
                                {roleConfig.label}
                              </Badge>
                              {getStatusBadge(member.status)}
                            </div>
                            
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <div className="flex items-center gap-1">
                                <Mail className="w-4 h-4" />
                                {member.email}
                              </div>
                              
                              {member.department && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="w-4 h-4" />
                                  {member.department}
                                  {member.position && ` • ${member.position}`}
                                </div>
                              )}
                              
                              {member.phone && (
                                <div className="flex items-center gap-1">
                                  <Phone className="w-4 h-4" />
                                  {member.phone}
                                </div>
                              )}
                            </div>

                            {member.stats && (
                              <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                                <div>作業報告: {member.stats.reports_created}件</div>
                                <div>写真投稿: {member.stats.photos_uploaded}枚</div>
                                {member.stats.last_login_at && (
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    最終ログイン: {format(parseISO(member.stats.last_login_at), 'MM/dd HH:mm', { locale: ja })}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* アクション */}
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(member)}
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                          
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteMembership(member)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* 招待タブ */}
        <TabsContent value="invitations" className="space-y-4 mt-6">
          {filteredInvitations.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Send className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  招待がありません
                </h3>
                <p className="text-gray-600 mb-4">
                  新しいメンバーを招待してチームを拡大しましょう
                </p>
                <Button onClick={() => setShowInviteModal(true)}>
                  <Send className="w-4 h-4 mr-2" />
                  メンバーを招待
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredInvitations.map((invitation) => {
                const roleConfig = getRoleConfig(invitation.role)
                const RoleIcon = roleConfig.icon
                const isExpired = new Date(invitation.expires_at) < new Date()
                
                return (
                  <Card key={invitation.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        {/* 招待基本情報 */}
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                            <Send className="w-6 h-6 text-blue-600" />
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="font-semibold text-gray-900">
                                {invitation.full_name || invitation.email}
                              </h3>
                              <Badge className={roleConfig.color} variant="secondary">
                                <RoleIcon className="w-3 h-3 mr-1" />
                                {roleConfig.label}
                              </Badge>
                              {getInvitationStatusBadge(invitation)}
                            </div>
                            
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <div className="flex items-center gap-1">
                                <Mail className="w-4 h-4" />
                                {invitation.email}
                              </div>
                              
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                期限: {format(parseISO(invitation.expires_at), 'MM/dd', { locale: ja })}
                              </div>
                            </div>

                            <div className="text-xs text-gray-500 mt-2">
                              {invitation.invited_by.full_name || invitation.invited_by.email}が招待 • 
                              {format(parseISO(invitation.created_at), 'yyyy/MM/dd', { locale: ja })}
                            </div>
                          </div>
                        </div>
                        
                        {/* アクション */}
                        <div className="flex items-center gap-2">
                          {invitation.status === 'pending' && !isExpired && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyInvitationLink(invitation.invitation_token)}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          )}
                          
                          {invitation.status === 'pending' && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleCancelInvitation(invitation.id)}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* メンバー編集モーダル */}
      {selectedMembership && (
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>メンバー情報編集</DialogTitle>
              <DialogDescription>
                {selectedMembership.full_name || selectedMembership.email} の情報を編集
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>氏名</Label>
                <Input
                  value={editFormData.full_name || ''}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, full_name: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label>権限レベル</Label>
                <Select 
                  value={editFormData.role || selectedMembership.role} 
                  onValueChange={(value: 'admin' | 'manager' | 'operator') => 
                    setEditFormData(prev => ({ ...prev, role: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {USER_ROLES.map(role => {
                      const Icon = role.icon
                      return (
                        <SelectItem key={role.value} value={role.value}>
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            <div>
                              <div className="font-medium">{role.label}</div>
                              <div className="text-xs text-gray-500">{role.description}</div>
                            </div>
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>電話番号</Label>
                <Input
                  type="tel"
                  value={editFormData.phone || ''}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label>部署</Label>
                <Select 
                  value={editFormData.department || ''} 
                  onValueChange={(value) => setEditFormData(prev => ({ ...prev, department: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="部署を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map(dept => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>役職</Label>
                <Input
                  value={editFormData.position || ''}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, position: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label>ステータス</Label>
                <Select 
                  value={editFormData.status || selectedMembership.status} 
                  onValueChange={(value: 'active' | 'inactive') => 
                    setEditFormData(prev => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">アクティブ</SelectItem>
                    <SelectItem value="inactive">非アクティブ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowEditModal(false)}
                disabled={formLoading}
              >
                キャンセル
              </Button>
              <Button
                onClick={handleUpdateMembership}
                disabled={formLoading}
              >
                {formLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    更新中...
                  </>
                ) : (
                  '更新'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}