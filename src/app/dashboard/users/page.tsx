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
  Phone,
  MapPin,
  Clock,
  Activity,
  Crown,
  UserCog,
  Eye,
  EyeOff,
  RefreshCw,
  Download,
  Upload,
  AlertTriangle
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
  profile_image_url?: string
  phone?: string
  department?: string
  position?: string
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
  phone?: string
  department?: string
  position?: string
  is_active: boolean
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

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  // フィルター・検索状態
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRole, setSelectedRole] = useState<string>('all')
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all')
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
    phone: '',
    department: '',
    position: '',
    is_active: true
  })
  const [formLoading, setFormLoading] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      // 会社IDは将来的に認証から取得
      const companyId = 'a1111111-1111-1111-1111-111111111111'
      
      const response = await fetch(`/api/users?company_id=${companyId}`)
      const result = await response.json()

      if (result.success) {
        setUsers(result.data)
      } else {
        // APIエラーの場合はサンプルデータを使用
        console.log('API エラー、サンプルデータを使用:', result.error)
        loadSampleData()
      }
    } catch (error) {
      console.error('データ取得エラー:', error)
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
        profile_image_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
        phone: '090-1234-5678',
        department: '管理部',
        position: '部長',
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
        profile_image_url: 'https://images.unsplash.com/photo-1494790108755-2616b612b3d4?w=150&h=150&fit=crop&crop=face',
        phone: '090-2345-6789',
        department: '栽培部',
        position: '課長',
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
        profile_image_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
        phone: '090-3456-7890',
        department: '栽培部',
        position: '作業員',
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
        profile_image_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
        phone: '090-4567-8901',
        department: '品質管理部',
        position: '検査員',
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
        phone: '090-5678-9012',
        department: '栽培部',
        position: '新人作業員',
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
        const matchesDepartment = user.department?.toLowerCase().includes(query)
        const matchesPosition = user.position?.toLowerCase().includes(query)
        
        if (!matchesName && !matchesEmail && !matchesDepartment && !matchesPosition) {
          return false
        }
      }
      
      // ロールフィルター
      if (selectedRole !== 'all' && user.role !== selectedRole) {
        return false
      }
      
      // 部署フィルター
      if (selectedDepartment !== 'all' && user.department !== selectedDepartment) {
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
      phone: '',
      department: '',
      position: '',
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
          company_id: 'a1111111-1111-1111-1111-111111111111'
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
      console.error('作成エラー:', error)
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
      console.error('更新エラー:', error)
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
      console.error('削除エラー:', error)
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
      console.error(`${action}エラー:`, error)
      alert(`${action}に失敗しました`)
    }
  }

  const openEditModal = (user: User) => {
    setSelectedUser(user)
    setFormData({
      email: user.email,
      full_name: user.full_name || '',
      role: user.role,
      phone: user.phone || '',
      department: user.department || '',
      position: user.position || '',
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
      {/* ヘッダー */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ユーザー管理</h1>
          <p className="text-gray-600">
            企業内ユーザーの管理・権限設定 • {filteredAndSortedUsers.length}名のユーザー
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
          
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            CSVエクスポート
          </Button>
          
          <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={resetForm}>
                <UserPlus className="w-4 h-4 mr-2" />
                新規ユーザー
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>新規ユーザー作成</DialogTitle>
                <DialogDescription>
                  新しいユーザーアカウントを作成します
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
                
                <div className="space-y-2">
                  <Label>電話番号</Label>
                  <Input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="090-1234-5678"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>部署</Label>
                  <Select 
                    value={formData.department} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, department: value }))}
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
                    value={formData.position}
                    onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
                    placeholder="部長、課長、主任など"
                  />
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

      {/* 統計サマリー */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{users.filter(u => u.is_active).length}</div>
            <div className="text-sm text-gray-600">アクティブユーザー</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{users.filter(u => u.role === 'admin').length}</div>
            <div className="text-sm text-gray-600">管理者</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">{users.filter(u => !u.last_login_at).length}</div>
            <div className="text-sm text-gray-600">未ログイン</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-gray-600">{users.length}</div>
            <div className="text-sm text-gray-600">総ユーザー数</div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>検索</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="名前・メール・部署で検索"
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
              <Label>部署</Label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  {DEPARTMENTS.map(dept => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
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
                  <SelectItem value="never_logged_in">未ログイン</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>並び順</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">名前順</SelectItem>
                  <SelectItem value="email">メール順</SelectItem>
                  <SelectItem value="role">権限順</SelectItem>
                  <SelectItem value="last_login">最終ログイン順</SelectItem>
                  <SelectItem value="created">作成日順</SelectItem>
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
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200">
                          {user.profile_image_url ? (
                            <Image
                              src={user.profile_image_url}
                              alt={user.full_name || user.email}
                              width={48}
                              height={48}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-300">
                              <Users className="w-6 h-6 text-gray-600" />
                            </div>
                          )}
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
                          
                          {user.department && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              {user.department}
                              {user.position && ` • ${user.position}`}
                            </div>
                          )}
                          
                          {user.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="w-4 h-4" />
                              {user.phone}
                            </div>
                          )}
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
            
            <div className="space-y-2">
              <Label>電話番号</Label>
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label>部署</Label>
              <Select 
                value={formData.department} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, department: value }))}
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
                value={formData.position}
                onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
              />
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
                <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200">
                  {selectedUser.profile_image_url ? (
                    <Image
                      src={selectedUser.profile_image_url}
                      alt={selectedUser.full_name || selectedUser.email}
                      width={32}
                      height={32}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-300">
                      <Users className="w-4 h-4 text-gray-600" />
                    </div>
                  )}
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
                    {selectedUser.phone && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">電話:</span>
                        <span>{selectedUser.phone}</span>
                      </div>
                    )}
                    {selectedUser.department && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">部署:</span>
                        <span>{selectedUser.department}</span>
                      </div>
                    )}
                    {selectedUser.position && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">役職:</span>
                        <span>{selectedUser.position}</span>
                      </div>
                    )}
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
  )
}