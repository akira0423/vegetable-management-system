'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter,
  MoreHorizontal,
  Edit3,
  Trash2,
  Shield,
  Mail,
  Clock,
  Activity,
  Crown,
  UserCog,
  Eye,
  EyeOff,
  RefreshCw,
  Download,
  Upload,
  AlertTriangle,
  Sprout,
  TrendingUp,
  DollarSign,
  BarChart3,
  Leaf,
  PiggyBank,
  Banknote,
  Wallet
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import Image from 'next/image'

interface User {
  id: string
  email: string
  full_name?: string
  role: 'admin' | 'manager' | 'operator'
  is_active: boolean
  last_login_at?: string
  settings?: Record<string, any>
  created_at: string
  updated_at: string
  company?: {
    id: string
    name: string
  }
  activity_stats?: {
    total_reports: number
    total_photos: number
    last_activity: string
  }
}

interface UserFormData {
  email: string
  full_name: string
  role: 'admin' | 'manager' | 'operator'
  is_active: boolean
}

const USER_ROLES = [
  { 
    value: 'admin', 
    label: '農場管理責任者', 
    description: '全機能・財務管理・意思決定',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: Crown
  },
  { 
    value: 'manager', 
    label: '農場マネージャー', 
    description: '営農管理・収支分析・レポート',
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: BarChart3
  },
  { 
    value: 'operator', 
    label: '農場作業員', 
    description: '日常作業・データ入力',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: Sprout
  }
]


export default function UsersPage() {
  const { user: currentUser, loading: authLoading } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  // フィルター・検索状態
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRole, setSelectedRole] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('name')
  
  // モーダル状態
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showUserDetail, setShowUserDetail] = useState(false)
  
  // フォーム状態
  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    full_name: '',
    role: 'operator',
    is_active: true
  })
  const [formLoading, setFormLoading] = useState(false)

  useEffect(() => {
    if (currentUser?.company_id) {
      fetchUsers()
    }
  }, [currentUser])

  const fetchUsers = async () => {
    if (!currentUser?.company_id) {
      
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      // 認証されたユーザーの実際の会社IDを使用
      const companyId = currentUser.company_id
      
      const response = await fetch(`/api/users?company_id=${companyId}`, {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include' // 認証クッキーを含める
      })
      
      const result = await response.json()

      if (response.ok && result.success) {
        setUsers(result.data)
      } else {
        
        
        if (response.status === 401) {
          // 認証が必要
          alert('ログインが必要です')
          // ログインページにリダイレクト（実装時に追加）
        } else if (response.status === 403) {
          // 権限不足
          alert('管理者権限が必要です')
        } else {
          // その他のエラー - サンプルデータを使用
          
          loadSampleData()
        }
      }
    } catch (error) {
      
      loadSampleData()
    } finally {
      setLoading(false)
    }
  }

  const loadSampleData = () => {
    const sampleUsers: User[] = [
      {
        id: 'u1',
        email: 'admin@example.com',
        full_name: '田中 太郎',
        role: 'admin',
        is_active: true,
        last_login_at: '2024-08-09T09:30:00Z',
        created_at: '2024-01-15T00:00:00Z',
        updated_at: '2024-08-09T09:30:00Z',
        activity_stats: {
          total_reports: 125,
          total_photos: 89,
          last_activity: '2024-08-09T09:30:00Z'
        }
      },
      {
        id: 'u2',
        email: 'manager@example.com',
        full_name: '佐藤 花子',
        role: 'manager',
        is_active: true,
        last_login_at: '2024-08-08T16:45:00Z',
        created_at: '2024-02-20T00:00:00Z',
        updated_at: '2024-08-08T16:45:00Z',
        activity_stats: {
          total_reports: 89,
          total_photos: 156,
          last_activity: '2024-08-08T16:45:00Z'
        }
      },
      {
        id: 'u3',
        email: 'operator1@example.com',
        full_name: '山田 次郎',
        role: 'operator',
        is_active: true,
        last_login_at: '2024-08-07T14:20:00Z',
        created_at: '2024-03-10T00:00:00Z',
        updated_at: '2024-08-07T14:20:00Z',
        activity_stats: {
          total_reports: 67,
          total_photos: 124,
          last_activity: '2024-08-07T14:20:00Z'
        }
      },
      {
        id: 'u4',
        email: 'operator2@example.com',
        full_name: '鈴木 美咲',
        role: 'operator',
        is_active: false,
        last_login_at: '2024-07-15T10:30:00Z',
        created_at: '2024-04-05T00:00:00Z',
        updated_at: '2024-07-15T10:30:00Z',
        activity_stats: {
          total_reports: 23,
          total_photos: 45,
          last_activity: '2024-07-15T10:30:00Z'
        }
      },
      {
        id: 'u5',
        email: 'newuser@example.com',
        full_name: '高橋 健一',
        role: 'operator',
        is_active: true,
        last_login_at: null,
        created_at: '2024-08-01T00:00:00Z',
        updated_at: '2024-08-01T00:00:00Z',
        activity_stats: {
          total_reports: 0,
          total_photos: 0,
          last_activity: null
        }
      }
    ]
    
    setUsers(sampleUsers)
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchUsers()
    setRefreshing(false)
  }

  // フィルタリング・ソート処理
  const filteredAndSortedUsers = users
    .filter(user => {
      // 検索クエリフィルター
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesName = user.full_name?.toLowerCase().includes(query)
        const matchesEmail = user.email.toLowerCase().includes(query)
        
        if (!matchesName && !matchesEmail) {
          return false
        }
      }
      
      // ロールフィルター
      if (selectedRole !== 'all' && user.role !== selectedRole) {
        return false
      }
      
      
      // ステータスフィルター
      if (selectedStatus !== 'all') {
        if (selectedStatus === 'active' && !user.is_active) return false
        if (selectedStatus === 'inactive' && user.is_active) return false
        if (selectedStatus === 'never_logged_in' && user.last_login_at) return false
      }
      
      return true
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.full_name || a.email).localeCompare(b.full_name || b.email)
        case 'email':
          return a.email.localeCompare(b.email)
        case 'role':
          return a.role.localeCompare(b.role)
        case 'last_login':
          const aLogin = a.last_login_at ? new Date(a.last_login_at).getTime() : 0
          const bLogin = b.last_login_at ? new Date(b.last_login_at).getTime() : 0
          return bLogin - aLogin
        case 'created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        default:
          return 0
      }
    })

  const resetForm = () => {
    setFormData({
      email: '',
      full_name: '',
      role: 'operator',
      is_active: true
    })
  }

  const handleCreateUser = async () => {
    setFormLoading(true)
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          company_id: currentUser?.company_id
        })
      })

      const result = await response.json()

      if (result.success) {
        alert('ユーザーを作成しました！')
        setUsers(prev => [result.data, ...prev])
        setShowCreateModal(false)
        resetForm()
      } else {
        alert(`作成に失敗しました: ${result.error}`)
      }
    } catch (error) {
      
      alert('作成に失敗しました')
    } finally {
      setFormLoading(false)
    }
  }

  const handleEditUser = async () => {
    if (!selectedUser) return
    
    setFormLoading(true)
    try {
      const response = await fetch(`/api/users?id=${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })

      const result = await response.json()

      if (result.success) {
        alert('ユーザー情報を更新しました！')
        setUsers(prev => prev.map(user => 
          user.id === selectedUser.id ? { ...user, ...result.data } : user
        ))
        setShowEditModal(false)
        setSelectedUser(null)
      } else {
        alert(`更新に失敗しました: ${result.error}`)
      }
    } catch (error) {
      
      alert('更新に失敗しました')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`「${user.full_name || user.email}」を削除しますか？この操作は取り消せません。`)) {
      return
    }

    try {
      const response = await fetch(`/api/users?id=${user.id}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        alert('ユーザーを削除しました')
        setUsers(prev => prev.filter(u => u.id !== user.id))
      } else {
        alert(`削除に失敗しました: ${result.error}`)
      }
    } catch (error) {
      
      alert('削除に失敗しました')
    }
  }

  const handleToggleStatus = async (user: User) => {
    const newStatus = !user.is_active
    const action = newStatus ? 'アクティベート' : '無効化'
    
    if (!confirm(`「${user.full_name || user.email}」を${action}しますか？`)) {
      return
    }

    try {
      const response = await fetch(`/api/users?id=${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: newStatus })
      })

      const result = await response.json()

      if (result.success) {
        alert(`ユーザーを${action}しました`)
        setUsers(prev => prev.map(u => 
          u.id === user.id ? { ...u, is_active: newStatus } : u
        ))
      } else {
        alert(`${action}に失敗しました: ${result.error}`)
      }
    } catch (error) {
      
      alert(`${action}に失敗しました`)
    }
  }

  const openEditModal = (user: User) => {
    setSelectedUser(user)
    setFormData({
      email: user.email,
      full_name: user.full_name || '',
      role: user.role,
      is_active: user.is_active
    })
    setShowEditModal(true)
  }

  const openUserDetail = (user: User) => {
    setSelectedUser(user)
    setShowUserDetail(true)
  }

  const getRoleConfig = (role: string) => {
    return USER_ROLES.find(r => r.value === role) || USER_ROLES[2]
  }

  const getActivityStatus = (user: User) => {
    if (!user.last_login_at) return { status: 'never', label: '未ログイン', color: 'bg-gray-100 text-gray-800' }
    
    const lastLogin = new Date(user.last_login_at)
    const now = new Date()
    const hoursSinceLogin = (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60)
    
    if (hoursSinceLogin < 24) return { status: 'active', label: 'アクティブ', color: 'bg-green-100 text-green-800' }
    if (hoursSinceLogin < 168) return { status: 'recent', label: '最近', color: 'bg-blue-100 text-blue-800' }
    return { status: 'inactive', label: '非アクティブ', color: 'bg-yellow-100 text-yellow-800' }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-6">
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-lg border border-green-100 p-6">
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center">
                  <Sprout className="w-8 h-8 text-white animate-pulse" />
                </div>
                <div>
                  <div className="h-8 bg-green-200 rounded-lg w-48 mb-2 animate-pulse"></div>
                  <div className="h-4 bg-green-100 rounded w-64 animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-lg border border-green-100 p-6">
                <div className="animate-pulse">
                  <div className="h-8 bg-green-200 rounded w-16 mb-2"></div>
                  <div className="h-4 bg-green-100 rounded w-24"></div>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl shadow-lg border border-green-100 p-6">
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-green-50 rounded-xl animate-pulse"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
      <div className="space-y-6 p-6">
        {/* ヘッダー */}
        <div className="bg-white rounded-2xl shadow-lg border border-green-100 p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-lg">
                <Users className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-green-800 to-emerald-700 bg-clip-text text-transparent">
                  農場メンバー管理
                </h1>
                <p className="text-green-600 font-medium">
                  <Sprout className="w-4 h-4 inline mr-2" />
                  農場スタッフの権限・役割管理 • {filteredAndSortedUsers.length}名のメンバー
                  <Wallet className="w-4 h-4 inline ml-4 mr-2" />
                  収支管理・営農分析
                </p>
              </div>
            </div>
        
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="border-green-200 text-green-700 hover:bg-green-50 shadow-sm"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                更新
              </Button>
              
              <Button 
                variant="outline" 
                size="sm"
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 shadow-sm"
              >
                <Download className="w-4 h-4 mr-2" />
                <BarChart3 className="w-4 h-4 mr-1" />
                メンバー分析
              </Button>
          
              <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
                <DialogTrigger asChild>
                  <Button 
                    size="sm" 
                    onClick={resetForm}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg border-0"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    <Sprout className="w-4 h-4 mr-2" />
                    新メンバー追加
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl bg-white rounded-2xl border border-green-100 shadow-2xl">
                  <DialogHeader className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-t-2xl p-6 border-b border-green-100">
                    <DialogTitle className="text-xl font-bold text-green-800 flex items-center gap-2">
                      <Sprout className="w-6 h-6 text-green-600" />
                      新メンバー追加
                    </DialogTitle>
                    <DialogDescription className="text-green-600">
                      農場に新しいメンバーを追加して、招待メールを送信します
                    </DialogDescription>
                  </DialogHeader>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>メールアドレス *</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="user@example.com"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>氏名 *</Label>
                  <Input
                    value={formData.full_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                    placeholder="山田 太郎"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>権限レベル *</Label>
                  <Select 
                    value={formData.role} 
                    onValueChange={(value: 'admin' | 'manager' | 'operator') => 
                      setFormData(prev => ({ ...prev, role: value }))
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
              
              <div className="flex items-center gap-2 mt-4">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="is_active">アクティブユーザーとして作成</Label>
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  disabled={formLoading}
                >
                  キャンセル
                </Button>
                <Button
                  onClick={handleCreateUser}
                  disabled={formLoading || !formData.email || !formData.full_name}
                >
                  {formLoading ? '作成中...' : 'ユーザーを作成'}
                </Button>
              </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* 農場メンバー統計 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-emerald-50 to-green-100 border-emerald-200 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-emerald-700">{users.filter(u => u.is_active).length}</div>
                  <div className="text-sm text-emerald-600 font-medium flex items-center mt-1">
                    <Activity className="w-4 h-4 mr-1" />
                    稼働中メンバー
                  </div>
                </div>
                <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Sprout className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-50 to-emerald-100 border-green-200 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-green-700">{users.filter(u => u.role === 'admin').length}</div>
                  <div className="text-sm text-green-600 font-medium flex items-center mt-1">
                    <Crown className="w-4 h-4 mr-1" />
                    管理責任者
                  </div>
                </div>
                <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center shadow-lg">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-amber-50 to-orange-100 border-amber-200 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-amber-700">{users.filter(u => !u.last_login_at).length}</div>
                  <div className="text-sm text-amber-600 font-medium flex items-center mt-1">
                    <AlertTriangle className="w-4 h-4 mr-1" />
                    未アクセス
                  </div>
                </div>
                <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Clock className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-teal-50 to-cyan-100 border-teal-200 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-teal-700">{users.length}</div>
                  <div className="text-sm text-teal-600 font-medium flex items-center mt-1">
                    <Users className="w-4 h-4 mr-1" />
                    総メンバー数
                  </div>
                </div>
                <div className="w-12 h-12 bg-teal-500 rounded-xl flex items-center justify-center shadow-lg">
                  <PiggyBank className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* メンバー検索・フィルター */}
        <Card className="bg-white shadow-lg border border-green-100 rounded-2xl">
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-t-2xl border-b border-green-100">
            <CardTitle className="text-lg flex items-center text-green-800">
              <Search className="w-5 h-5 mr-3 text-green-600" />
              <Leaf className="w-4 h-4 mr-2 text-green-500" />
              メンバー検索・フィルター
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label className="text-green-700 font-medium">メンバー検索</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-green-400" />
                  <Input
                    placeholder="名前・メールで検索"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 border-green-200 focus:border-green-400 focus:ring-green-400"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-green-700 font-medium flex items-center">
                  <Shield className="w-4 h-4 mr-1 text-green-500" />
                  役割・権限
                </Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="border-green-200 focus:border-green-400">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべての役割</SelectItem>
                    {USER_ROLES.map(role => (
                      <SelectItem key={role.value} value={role.value}>
                        <div className="flex items-center gap-2">
                          <Sprout className="w-4 h-4 text-green-500" />
                          {role.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-green-700 font-medium flex items-center">
                  <Activity className="w-4 h-4 mr-1 text-green-500" />
                  稼働状況
                </Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="border-green-200 focus:border-green-400">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべての状況</SelectItem>
                    <SelectItem value="active">
                      <div className="flex items-center gap-2">
                        <Sprout className="w-4 h-4 text-green-500" />
                        稼働中
                      </div>
                    </SelectItem>
                    <SelectItem value="inactive">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-500" />
                        休止中
                      </div>
                    </SelectItem>
                    <SelectItem value="never_logged_in">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        未アクセス
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-green-700 font-medium flex items-center">
                  <BarChart3 className="w-4 h-4 mr-1 text-green-500" />
                  並び順
                </Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="border-green-200 focus:border-green-400">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-green-500" />
                        名前順
                      </div>
                    </SelectItem>
                    <SelectItem value="email">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-green-500" />
                        メール順
                      </div>
                    </SelectItem>
                    <SelectItem value="role">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-green-500" />
                        権限順
                      </div>
                    </SelectItem>
                    <SelectItem value="last_login">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-green-500" />
                        最終アクセス順
                      </div>
                    </SelectItem>
                    <SelectItem value="created">
                      <div className="flex items-center gap-2">
                        <Sprout className="w-4 h-4 text-green-500" />
                        参加日順
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

      {/* ユーザー一覧 */}
      {filteredAndSortedUsers.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              ユーザーが見つかりません
            </h3>
            <p className="text-gray-600 mb-4">
              {searchQuery || selectedRole !== 'all' ? 
                'フィルター条件に一致するユーザーがいません' :
                '最初のユーザーを作成してください'
              }
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              新規ユーザー作成
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredAndSortedUsers.map((user) => {
            const roleConfig = getRoleConfig(user.role)
            const activityStatus = getActivityStatus(user)
            const RoleIcon = roleConfig.icon
            
            return (
              <Card key={user.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    {/* ユーザー基本情報 */}
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-300 flex items-center justify-center">
                          <Users className="w-6 h-6 text-gray-600" />
                        </div>
                        {!user.is_active && (
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white"></div>
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 
                            className="font-semibold text-gray-900 cursor-pointer hover:text-blue-600"
                            onClick={() => openUserDetail(user)}
                          >
                            {user.full_name || user.email}
                          </h3>
                          <Badge className={roleConfig.color} variant="secondary">
                            <RoleIcon className="w-3 h-3 mr-1" />
                            {roleConfig.label}
                          </Badge>
                          <Badge className={activityStatus.color} variant="secondary">
                            {activityStatus.label}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Mail className="w-4 h-4" />
                            {user.email}
                          </div>
                          
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                          {user.last_login_at ? (
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              最終ログイン: {format(parseISO(user.last_login_at), 'yyyy/MM/dd HH:mm', { locale: ja })}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-orange-500" />
                              未ログイン
                            </div>
                          )}
                          
                          {user.activity_stats && (
                            <>
                              <div>作業報告: {user.activity_stats.total_reports}件</div>
                              <div>写真投稿: {user.activity_stats.total_photos}枚</div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* アクション */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openUserDetail(user)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditModal(user)}
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleStatus(user)}
                      >
                        {user.is_active ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </Button>
                      
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteUser(user)}
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

      {/* ユーザー編集モーダル */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>ユーザー情報編集</DialogTitle>
            <DialogDescription>
              {selectedUser?.full_name || selectedUser?.email} の情報を編集
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>メールアドレス *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label>氏名 *</Label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label>権限レベル *</Label>
              <Select 
                value={formData.role} 
                onValueChange={(value: 'admin' | 'manager' | 'operator') => 
                  setFormData(prev => ({ ...prev, role: value }))
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
          
          <div className="flex items-center gap-2 mt-4">
            <input
              type="checkbox"
              id="edit_is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
              className="rounded border-gray-300"
            />
            <Label htmlFor="edit_is_active">アクティブユーザー</Label>
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
              onClick={handleEditUser}
              disabled={formLoading || !formData.email || !formData.full_name}
            >
              {formLoading ? '更新中...' : '更新'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ユーザー詳細モーダル */}
      {selectedUser && (
        <Dialog open={showUserDetail} onOpenChange={setShowUserDetail}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-300 flex items-center justify-center">
                  <Users className="w-4 h-4 text-gray-600" />
                </div>
                {selectedUser.full_name || selectedUser.email}
              </DialogTitle>
              <DialogDescription>
                ユーザー詳細情報とアクティビティ
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 基本情報 */}
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-3">基本情報</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">メール:</span>
                      <span>{selectedUser.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">権限:</span>
                      <Badge className={getRoleConfig(selectedUser.role).color} variant="secondary">
                        {getRoleConfig(selectedUser.role).label}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">ステータス:</span>
                      <Badge className={selectedUser.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} variant="secondary">
                        {selectedUser.is_active ? 'アクティブ' : '非アクティブ'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">登録日:</span>
                      <span>{format(parseISO(selectedUser.created_at), 'yyyy/MM/dd', { locale: ja })}</span>
                    </div>
                  </div>
                </div>

                {selectedUser.activity_stats && (
                  <div>
                    <h4 className="font-semibold mb-3">アクティビティ統計</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">
                          {selectedUser.activity_stats.total_reports}
                        </div>
                        <div className="text-xs text-blue-600">作業報告</div>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          {selectedUser.activity_stats.total_photos}
                        </div>
                        <div className="text-xs text-green-600">写真投稿</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* アクティビティ情報 */}
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-3">アクセス情報</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">最終ログイン:</span>
                      <span>
                        {selectedUser.last_login_at ? 
                          format(parseISO(selectedUser.last_login_at), 'yyyy/MM/dd HH:mm', { locale: ja }) :
                          '未ログイン'
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">アクティビティ:</span>
                      <Badge className={getActivityStatus(selectedUser).color} variant="secondary">
                        {getActivityStatus(selectedUser).label}
                      </Badge>
                    </div>
                    {selectedUser.activity_stats?.last_activity && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">最終活動:</span>
                        <span>
                          {format(parseISO(selectedUser.activity_stats.last_activity), 'yyyy/MM/dd HH:mm', { locale: ja })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowUserDetail(false)
                        openEditModal(selectedUser)
                      }}
                    >
                      <Edit3 className="w-4 h-4 mr-2" />
                      編集
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleStatus(selectedUser)}
                    >
                      {selectedUser.is_active ? (
                        <>
                          <EyeOff className="w-4 h-4 mr-2" />
                          無効化
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4 mr-2" />
                          有効化
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
      </div>
    </div>
  )
}