'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { 
  Settings,
  Building2,
  Database,
  Shield,
  Users,
  Bell,
  Download,
  Upload,
  RefreshCw,
  Eye,
  EyeOff,
  Key,
  Globe,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Clock,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Trash2,
  Save,
  RotateCcw,
  ExternalLink
} from 'lucide-react'

interface CompanySettings {
  id: string
  name: string
  description: string
  address: string
  phone: string
  email: string
  website: string
  logo_url?: string
  timezone: string
  language: string
  currency: string
  business_type: string
}

interface SystemSettings {
  auto_backup: boolean
  backup_frequency: string
  data_retention_days: number
  email_notifications: boolean
  sms_notifications: boolean
  api_access: boolean
  debug_mode: boolean
  maintenance_mode: boolean
  max_file_size: number
  allowed_file_types: string[]
}

interface SecuritySettings {
  password_policy: {
    min_length: number
    require_uppercase: boolean
    require_lowercase: boolean
    require_numbers: boolean
    require_symbols: boolean
  }
  session_timeout: number
  two_factor_auth: boolean
  ip_whitelist: string[]
  api_rate_limit: number
}

interface BackupInfo {
  id: string
  created_at: string
  size: number
  type: 'auto' | 'manual'
  status: 'completed' | 'in_progress' | 'failed'
  description: string
}

interface SystemLog {
  id: string
  timestamp: string
  level: 'info' | 'warning' | 'error'
  category: string
  message: string
  user_id?: string
  ip_address?: string
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [showBackupDialog, setShowBackupDialog] = useState(false)
  const [showRestoreDialog, setShowRestoreDialog] = useState(false)
  
  // 設定データ
  const [companySettings, setCompanySettings] = useState<CompanySettings>({
    id: 'company1',
    name: '田中農業株式会社',
    description: '契約栽培による高品質野菜の生産・販売を行っています。',
    address: '〒123-4567 東京都練馬区農業町1-2-3',
    phone: '03-1234-5678',
    email: 'info@tanaka-farm.co.jp',
    website: 'https://tanaka-farm.co.jp',
    logo_url: '',
    timezone: 'Asia/Tokyo',
    language: 'ja',
    currency: 'JPY',
    business_type: 'agriculture'
  })

  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    auto_backup: true,
    backup_frequency: 'daily',
    data_retention_days: 365,
    email_notifications: true,
    sms_notifications: false,
    api_access: true,
    debug_mode: false,
    maintenance_mode: false,
    max_file_size: 50,
    allowed_file_types: ['jpg', 'jpeg', 'png', 'pdf', 'csv', 'xlsx']
  })

  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>({
    password_policy: {
      min_length: 8,
      require_uppercase: true,
      require_lowercase: true,
      require_numbers: true,
      require_symbols: false
    },
    session_timeout: 60,
    two_factor_auth: false,
    ip_whitelist: [],
    api_rate_limit: 1000
  })

  // サンプルデータ
  const [backupHistory, setBackupHistory] = useState<BackupInfo[]>([
    {
      id: '1',
      created_at: '2024-08-09T02:00:00Z',
      size: 1250000000,
      type: 'auto',
      status: 'completed',
      description: '自動バックアップ（日次）'
    },
    {
      id: '2',
      created_at: '2024-08-08T14:30:00Z',
      size: 1180000000,
      type: 'manual',
      status: 'completed',
      description: '手動バックアップ（メンテナンス前）'
    },
    {
      id: '3',
      created_at: '2024-08-08T02:00:00Z',
      size: 1160000000,
      type: 'auto',
      status: 'completed',
      description: '自動バックアップ（日次）'
    }
  ])

  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([
    {
      id: '1',
      timestamp: '2024-08-09T10:15:00Z',
      level: 'info',
      category: 'auth',
      message: 'ユーザーログイン: admin@company.com',
      user_id: 'user1',
      ip_address: '192.168.1.100'
    },
    {
      id: '2',
      timestamp: '2024-08-09T09:45:00Z',
      level: 'warning',
      category: 'system',
      message: 'ディスク使用量が80%を超えました',
      ip_address: 'system'
    },
    {
      id: '3',
      timestamp: '2024-08-09T02:00:00Z',
      level: 'info',
      category: 'backup',
      message: '自動バックアップが正常に完了しました',
      ip_address: 'system'
    }
  ])

  const [integrations] = useState([
    {
      name: 'OpenAI API',
      status: 'connected',
      description: 'AIチャットボット機能',
      last_sync: '2024-08-09T10:00:00Z'
    },
    {
      name: 'Supabase',
      status: 'connected',
      description: 'データベース・認証',
      last_sync: '2024-08-09T10:15:00Z'
    },
    {
      name: '天気API',
      status: 'disconnected',
      description: '気象情報の取得',
      last_sync: null
    },
    {
      name: 'SMS Gateway',
      status: 'connected',
      description: 'SMS通知サービス',
      last_sync: '2024-08-09T09:30:00Z'
    }
  ])

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      // 実際のAPIコール（現在は利用不可のためサンプルデータを使用）
      // const response = await fetch('/api/settings?company_id=company1')
      // const data = await response.json()
      
      setTimeout(() => {
        setLoading(false)
      }, 500)
      
    } catch (error) {
      console.error('設定データの取得エラー:', error)
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    try {
      setSaving(true)
      
      // 実際のAPIコール
      // const response = await fetch('/api/settings', {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ company: companySettings, system: systemSettings, security: securitySettings })
      // })
      
      setTimeout(() => {
        setSaving(false)
        alert('設定を保存しました')
      }, 1000)
      
    } catch (error) {
      console.error('設定保存エラー:', error)
      setSaving(false)
      alert('設定の保存に失敗しました')
    }
  }

  const createBackup = async () => {
    try {
      const newBackup: BackupInfo = {
        id: Date.now().toString(),
        created_at: new Date().toISOString(),
        size: Math.floor(Math.random() * 500000000) + 1000000000,
        type: 'manual',
        status: 'in_progress',
        description: '手動バックアップ'
      }
      
      setBackupHistory(prev => [newBackup, ...prev])
      
      // 実際のバックアップ処理をシミュレート
      setTimeout(() => {
        setBackupHistory(prev => 
          prev.map(backup => 
            backup.id === newBackup.id 
              ? { ...backup, status: 'completed' as const }
              : backup
          )
        )
        alert('バックアップが完了しました')
      }, 3000)
      
    } catch (error) {
      console.error('バックアップエラー:', error)
      alert('バックアップに失敗しました')
    }
  }

  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 B'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      completed: { label: '完了', color: 'bg-green-100 text-green-700' },
      in_progress: { label: '進行中', color: 'bg-blue-100 text-blue-700' },
      failed: { label: '失敗', color: 'bg-red-100 text-red-700' },
      connected: { label: '接続中', color: 'bg-green-100 text-green-700' },
      disconnected: { label: '未接続', color: 'bg-gray-100 text-gray-700' }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.disconnected
    return (
      <Badge className={`${config.color} border-none`}>
        {config.label}
      </Badge>
    )
  }

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />
      default: return <CheckCircle className="w-4 h-4 text-green-500" />
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">設定・システム管理</h1>
          <p className="text-gray-600">システムの設定とセキュリティを管理します</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={fetchSettings}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            更新
          </Button>
          
          <Button
            onClick={saveSettings}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? '保存中...' : '設定を保存'}
          </Button>
        </div>
      </div>

      {/* メインタブ */}
      <Tabs defaultValue="company" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="company">会社情報</TabsTrigger>
          <TabsTrigger value="system">システム</TabsTrigger>
          <TabsTrigger value="security">セキュリティ</TabsTrigger>
          <TabsTrigger value="backup">バックアップ</TabsTrigger>
          <TabsTrigger value="logs">システムログ</TabsTrigger>
          <TabsTrigger value="integrations">連携</TabsTrigger>
        </TabsList>

        {/* 会社情報タブ */}
        <TabsContent value="company" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                基本情報
              </CardTitle>
              <CardDescription>会社の基本的な情報を設定します</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company-name">会社名 *</Label>
                  <Input
                    id="company-name"
                    value={companySettings.name}
                    onChange={(e) => setCompanySettings(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="会社名を入力"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="business-type">事業種別</Label>
                  <Select
                    value={companySettings.business_type}
                    onValueChange={(value) => setCompanySettings(prev => ({ ...prev, business_type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agriculture">農業</SelectItem>
                      <SelectItem value="food_processing">食品加工</SelectItem>
                      <SelectItem value="distribution">流通・販売</SelectItem>
                      <SelectItem value="consulting">農業コンサルティング</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">会社説明</Label>
                <Textarea
                  id="description"
                  value={companySettings.description}
                  onChange={(e) => setCompanySettings(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="会社の概要を入力"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">住所</Label>
                <Input
                  id="address"
                  value={companySettings.address}
                  onChange={(e) => setCompanySettings(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="住所を入力"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">電話番号</Label>
                  <Input
                    id="phone"
                    value={companySettings.phone}
                    onChange={(e) => setCompanySettings(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="03-1234-5678"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">メールアドレス</Label>
                  <Input
                    id="email"
                    type="email"
                    value={companySettings.email}
                    onChange={(e) => setCompanySettings(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="info@company.com"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="website">ウェブサイト</Label>
                  <Input
                    id="website"
                    value={companySettings.website}
                    onChange={(e) => setCompanySettings(prev => ({ ...prev, website: e.target.value }))}
                    placeholder="https://company.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="timezone">タイムゾーン</Label>
                  <Select
                    value={companySettings.timezone}
                    onValueChange={(value) => setCompanySettings(prev => ({ ...prev, timezone: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Tokyo">Asia/Tokyo (JST)</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="language">言語</Label>
                  <Select
                    value={companySettings.language}
                    onValueChange={(value) => setCompanySettings(prev => ({ ...prev, language: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ja">日本語</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="zh">中文</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="currency">通貨</Label>
                  <Select
                    value={companySettings.currency}
                    onValueChange={(value) => setCompanySettings(prev => ({ ...prev, currency: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="JPY">日本円 (¥)</SelectItem>
                      <SelectItem value="USD">米ドル ($)</SelectItem>
                      <SelectItem value="EUR">ユーロ (€)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* システム設定タブ */}
        <TabsContent value="system" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  データ管理
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>自動バックアップ</Label>
                    <p className="text-sm text-gray-500">定期的にデータをバックアップします</p>
                  </div>
                  <Switch
                    checked={systemSettings.auto_backup}
                    onCheckedChange={(checked) => 
                      setSystemSettings(prev => ({ ...prev, auto_backup: checked }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>バックアップ頻度</Label>
                  <Select
                    value={systemSettings.backup_frequency}
                    onValueChange={(value) => 
                      setSystemSettings(prev => ({ ...prev, backup_frequency: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">1時間毎</SelectItem>
                      <SelectItem value="daily">日次</SelectItem>
                      <SelectItem value="weekly">週次</SelectItem>
                      <SelectItem value="monthly">月次</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>データ保持期間 (日)</Label>
                  <Input
                    type="number"
                    value={systemSettings.data_retention_days}
                    onChange={(e) => 
                      setSystemSettings(prev => ({ ...prev, data_retention_days: parseInt(e.target.value) || 365 }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>最大ファイルサイズ (MB)</Label>
                  <Input
                    type="number"
                    value={systemSettings.max_file_size}
                    onChange={(e) => 
                      setSystemSettings(prev => ({ ...prev, max_file_size: parseInt(e.target.value) || 50 }))
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  通知設定
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>メール通知</Label>
                    <p className="text-sm text-gray-500">重要な更新をメールで受信</p>
                  </div>
                  <Switch
                    checked={systemSettings.email_notifications}
                    onCheckedChange={(checked) => 
                      setSystemSettings(prev => ({ ...prev, email_notifications: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>SMS通知</Label>
                    <p className="text-sm text-gray-500">緊急時のSMS通知</p>
                  </div>
                  <Switch
                    checked={systemSettings.sms_notifications}
                    onCheckedChange={(checked) => 
                      setSystemSettings(prev => ({ ...prev, sms_notifications: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>API アクセス</Label>
                    <p className="text-sm text-gray-500">外部APIとの連携を許可</p>
                  </div>
                  <Switch
                    checked={systemSettings.api_access}
                    onCheckedChange={(checked) => 
                      setSystemSettings(prev => ({ ...prev, api_access: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>デバッグモード</Label>
                    <p className="text-sm text-gray-500">詳細なログを記録</p>
                  </div>
                  <Switch
                    checked={systemSettings.debug_mode}
                    onCheckedChange={(checked) => 
                      setSystemSettings(prev => ({ ...prev, debug_mode: checked }))
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* セキュリティタブ */}
        <TabsContent value="security" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  パスワードポリシー
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>最小文字数</Label>
                  <Input
                    type="number"
                    value={securitySettings.password_policy.min_length}
                    onChange={(e) => 
                      setSecuritySettings(prev => ({
                        ...prev,
                        password_policy: {
                          ...prev.password_policy,
                          min_length: parseInt(e.target.value) || 8
                        }
                      }))
                    }
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>大文字を含む</Label>
                    <Switch
                      checked={securitySettings.password_policy.require_uppercase}
                      onCheckedChange={(checked) => 
                        setSecuritySettings(prev => ({
                          ...prev,
                          password_policy: { ...prev.password_policy, require_uppercase: checked }
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>小文字を含む</Label>
                    <Switch
                      checked={securitySettings.password_policy.require_lowercase}
                      onCheckedChange={(checked) => 
                        setSecuritySettings(prev => ({
                          ...prev,
                          password_policy: { ...prev.password_policy, require_lowercase: checked }
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>数字を含む</Label>
                    <Switch
                      checked={securitySettings.password_policy.require_numbers}
                      onCheckedChange={(checked) => 
                        setSecuritySettings(prev => ({
                          ...prev,
                          password_policy: { ...prev.password_policy, require_numbers: checked }
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>記号を含む</Label>
                    <Switch
                      checked={securitySettings.password_policy.require_symbols}
                      onCheckedChange={(checked) => 
                        setSecuritySettings(prev => ({
                          ...prev,
                          password_policy: { ...prev.password_policy, require_symbols: checked }
                        }))
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  認証・アクセス制御
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>セッションタイムアウト (分)</Label>
                  <Input
                    type="number"
                    value={securitySettings.session_timeout}
                    onChange={(e) => 
                      setSecuritySettings(prev => ({ ...prev, session_timeout: parseInt(e.target.value) || 60 }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>2段階認証</Label>
                    <p className="text-sm text-gray-500">SMS/アプリ認証を有効化</p>
                  </div>
                  <Switch
                    checked={securitySettings.two_factor_auth}
                    onCheckedChange={(checked) => 
                      setSecuritySettings(prev => ({ ...prev, two_factor_auth: checked }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>API レート制限 (requests/hour)</Label>
                  <Input
                    type="number"
                    value={securitySettings.api_rate_limit}
                    onChange={(e) => 
                      setSecuritySettings(prev => ({ ...prev, api_rate_limit: parseInt(e.target.value) || 1000 }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>APIキー</Label>
                  <div className="flex gap-2">
                    <Input
                      type={showApiKey ? 'text' : 'password'}
                      value="••••••••••••••••••••"
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* バックアップタブ */}
        <TabsContent value="backup" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  バックアップ操作
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <Button onClick={createBackup} className="flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    バックアップ作成
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowRestoreDialog(true)}
                    className="flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    復元
                  </Button>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">自動バックアップ設定</h4>
                  <div className="space-y-2 text-sm text-blue-800">
                    <div className="flex justify-between">
                      <span>頻度:</span>
                      <span>{systemSettings.backup_frequency === 'daily' ? '日次' : systemSettings.backup_frequency}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>次回実行:</span>
                      <span>今日 02:00</span>
                    </div>
                    <div className="flex justify-between">
                      <span>保持期間:</span>
                      <span>{systemSettings.data_retention_days}日</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="font-medium text-green-900">システム状態</span>
                  </div>
                  <div className="space-y-1 text-sm text-green-800">
                    <div>データベース: 正常</div>
                    <div>ストレージ: 正常 (使用量: 75%)</div>
                    <div>最終バックアップ: 今日 02:00</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>バックアップ履歴</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {backupHistory.map((backup) => (
                    <div key={backup.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{backup.description}</span>
                          {getStatusBadge(backup.status)}
                        </div>
                        <div className="text-sm text-gray-600">
                          {formatDateTime(backup.created_at)} • {formatFileSize(backup.size)}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Download className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="outline">
                          <RotateCcw className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* システムログタブ */}
        <TabsContent value="logs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                システムログ
              </CardTitle>
              <CardDescription>システムの動作状況とエラーを監視します</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {systemLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 border rounded-lg">
                    <div className="flex-shrink-0 mt-0.5">
                      {getLogIcon(log.level)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{log.message}</span>
                        <span className="text-sm text-gray-500">{formatDateTime(log.timestamp)}</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        カテゴリ: {log.category} • IP: {log.ip_address}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 連携タブ */}
        <TabsContent value="integrations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                外部サービス連携
              </CardTitle>
              <CardDescription>システムと連携している外部サービスを管理します</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {integrations.map((integration, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div>
                        <h4 className="font-medium">{integration.name}</h4>
                        <p className="text-sm text-gray-600">{integration.description}</p>
                        {integration.last_sync && (
                          <p className="text-xs text-gray-500">
                            最終同期: {formatDateTime(integration.last_sync)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(integration.status)}
                      <Button size="sm" variant="outline">
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 復元ダイアログ */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>データ復元</DialogTitle>
            <DialogDescription>
              バックアップファイルからデータを復元します。この操作により現在のデータが置き換えられます。
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium mb-1">注意事項</p>
                  <p>復元を実行すると現在のデータが失われます。事前にバックアップを作成することを推奨します。</p>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowRestoreDialog(false)} className="flex-1">
                キャンセル
              </Button>
              <Button onClick={() => setShowRestoreDialog(false)} className="flex-1">
                復元を実行
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}