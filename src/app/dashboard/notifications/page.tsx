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
  Bell,
  AlertTriangle,
  CheckCircle,
  Info,
  XCircle,
  Clock,
  User,
  Settings,
  Mail,
  MessageSquare,
  Smartphone,
  Globe,
  Filter,
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Calendar,
  Target,
  Zap,
  Activity,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Download,
  Archive,
  Star,
  AlertCircle
} from 'lucide-react'

interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error' | 'system'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  category: string
  read: boolean
  dismissed: boolean
  created_at: string
  expires_at?: string
  action_url?: string
  action_label?: string
  sender_id?: string
  sender_name?: string
  metadata?: any
}

interface AlertRule {
  id: string
  name: string
  description: string
  condition: {
    metric: string
    operator: string
    value: number
    unit?: string
  }
  actions: {
    email: boolean
    sms: boolean
    push: boolean
    webhook?: string
  }
  enabled: boolean
  cooldown_minutes: number
  last_triggered?: string
  created_at: string
}

interface NotificationSettings {
  email_notifications: boolean
  sms_notifications: boolean
  push_notifications: boolean
  browser_notifications: boolean
  notification_sound: boolean
  quiet_hours_enabled: boolean
  quiet_hours_start: string
  quiet_hours_end: string
  categories: {
    [key: string]: {
      enabled: boolean
      email: boolean
      sms: boolean
      push: boolean
    }
  }
}

export default function NotificationsPage() {
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([])
  const [alertRules, setAlertRules] = useState<AlertRule[]>([])
  const [settings, setSettings] = useState<NotificationSettings>({
    email_notifications: true,
    sms_notifications: false,
    push_notifications: true,
    browser_notifications: true,
    notification_sound: true,
    quiet_hours_enabled: false,
    quiet_hours_start: '22:00',
    quiet_hours_end: '08:00',
    categories: {
      'system': { enabled: true, email: true, sms: false, push: true },
      'harvest': { enabled: true, email: true, sms: true, push: true },
      'maintenance': { enabled: true, email: true, sms: false, push: true },
      'weather': { enabled: true, email: false, sms: true, push: true },
      'security': { enabled: true, email: true, sms: true, push: true }
    }
  })
  
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const [showRuleDialog, setShowRuleDialog] = useState(false)
  const [selectedRule, setSelectedRule] = useState<AlertRule | null>(null)

  // サンプルデータ
  const sampleNotifications: Notification[] = [
    {
      id: '1',
      title: '収穫期到来のお知らせ',
      message: 'A区画-1のトマト（桃太郎）が収穫適期を迎えました。3日以内の収穫をお勧めします。',
      type: 'warning',
      priority: 'high',
      category: 'harvest',
      read: false,
      dismissed: false,
      created_at: '2024-08-09T10:30:00Z',
      expires_at: '2024-08-12T10:30:00Z',
      action_url: '/dashboard/gantt',
      action_label: '詳細を確認',
      sender_name: 'システム自動通知'
    },
    {
      id: '2',
      title: 'システムメンテナンス完了',
      message: '予定されていたシステムメンテナンスが正常に完了しました。すべての機能が利用可能です。',
      type: 'success',
      priority: 'medium',
      category: 'system',
      read: true,
      dismissed: false,
      created_at: '2024-08-09T02:15:00Z',
      sender_name: 'システム管理者'
    },
    {
      id: '3',
      title: '天候警報',
      message: '今日の午後から強い雨が予想されます。露地栽培の作物に注意してください。',
      type: 'error',
      priority: 'urgent',
      category: 'weather',
      read: false,
      dismissed: false,
      created_at: '2024-08-09T08:00:00Z',
      expires_at: '2024-08-09T20:00:00Z',
      action_url: '/dashboard/weather',
      action_label: '天気情報を確認',
      sender_name: '気象情報システム'
    },
    {
      id: '4',
      title: 'タスク期限間近',
      message: 'B区画-2のレタスの施肥作業が明日期限となります。作業スケジュールをご確認ください。',
      type: 'warning',
      priority: 'medium',
      category: 'maintenance',
      read: false,
      dismissed: false,
      created_at: '2024-08-08T16:45:00Z',
      expires_at: '2024-08-10T00:00:00Z',
      action_url: '/dashboard/gantt',
      action_label: 'タスクを確認',
      sender_name: 'タスク管理システム'
    },
    {
      id: '5',
      title: 'データバックアップ完了',
      message: '日次自動バックアップが正常に完了しました。データサイズ: 1.25GB',
      type: 'info',
      priority: 'low',
      category: 'system',
      read: true,
      dismissed: false,
      created_at: '2024-08-09T02:00:00Z',
      sender_name: 'バックアップシステム'
    }
  ]

  const sampleAlertRules: AlertRule[] = [
    {
      id: '1',
      name: '収穫適期アラート',
      description: '野菜が収穫適期に達した場合に通知',
      condition: {
        metric: 'days_since_planting',
        operator: 'gte',
        value: 90,
        unit: 'days'
      },
      actions: {
        email: true,
        sms: true,
        push: true
      },
      enabled: true,
      cooldown_minutes: 1440, // 24時間
      last_triggered: '2024-08-09T10:30:00Z',
      created_at: '2024-07-01T10:00:00Z'
    },
    {
      id: '2',
      name: '天候警報',
      description: '悪天候が予測される場合に通知',
      condition: {
        metric: 'weather_risk_level',
        operator: 'gte',
        value: 3,
        unit: 'level'
      },
      actions: {
        email: true,
        sms: true,
        push: true
      },
      enabled: true,
      cooldown_minutes: 360, // 6時間
      last_triggered: '2024-08-09T08:00:00Z',
      created_at: '2024-07-01T10:00:00Z'
    },
    {
      id: '3',
      name: 'システム容量警告',
      description: 'ストレージ使用量が閾値を超えた場合に通知',
      condition: {
        metric: 'storage_usage_percent',
        operator: 'gte',
        value: 80,
        unit: 'percent'
      },
      actions: {
        email: true,
        sms: false,
        push: true
      },
      enabled: true,
      cooldown_minutes: 720, // 12時間
      created_at: '2024-07-01T10:00:00Z'
    }
  ]

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    filterNotifications()
  }, [notifications, searchQuery, filterType, filterPriority, showUnreadOnly])

  const fetchData = async () => {
    try {
      setLoading(true)
      // 実際のAPIコール
      setTimeout(() => {
        setNotifications(sampleNotifications)
        setAlertRules(sampleAlertRules)
        setLoading(false)
      }, 800)
    } catch (error) {
      console.error('通知データ取得エラー:', error)
      setLoading(false)
    }
  }

  const filterNotifications = () => {
    let filtered = notifications

    if (searchQuery) {
      filtered = filtered.filter(notification =>
        notification.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        notification.message.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    if (filterType !== 'all') {
      filtered = filtered.filter(notification => notification.type === filterType)
    }

    if (filterPriority !== 'all') {
      filtered = filtered.filter(notification => notification.priority === filterPriority)
    }

    if (showUnreadOnly) {
      filtered = filtered.filter(notification => !notification.read)
    }

    setFilteredNotifications(filtered)
  }

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id ? { ...notification, read: true } : notification
      )
    )
  }

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, read: true }))
    )
  }

  const dismissNotification = (id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id ? { ...notification, dismissed: true } : notification
      )
    )
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />
      case 'error': return <XCircle className="w-5 h-5 text-red-500" />
      case 'system': return <Settings className="w-5 h-5 text-blue-500" />
      default: return <Info className="w-5 h-5 text-gray-500" />
    }
  }

  const getPriorityBadge = (priority: string) => {
    const priorityConfig = {
      urgent: { label: '緊急', color: 'bg-red-100 text-red-700 border-red-200' },
      high: { label: '高', color: 'bg-orange-100 text-orange-700 border-orange-200' },
      medium: { label: '中', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
      low: { label: '低', color: 'bg-gray-100 text-gray-700 border-gray-200' }
    }
    
    const config = priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.low
    return (
      <Badge className={`${config.color} text-xs`}>
        {config.label}
      </Badge>
    )
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getUnreadCount = () => {
    return notifications.filter(n => !n.read && !n.dismissed).length
  }

  const saveSettings = async () => {
    try {
      // 実際のAPIコール
      alert('通知設定を保存しました')
    } catch (error) {
      console.error('設定保存エラー:', error)
      alert('設定の保存に失敗しました')
    }
  }

  const testNotification = async (type: 'email' | 'sms' | 'push') => {
    try {
      // テスト通知の送信
      alert(`${type}通知のテストを送信しました`)
    } catch (error) {
      console.error('テスト通知エラー:', error)
      alert('テスト通知の送信に失敗しました')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 rounded-lg animate-pulse" />
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
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="w-7 h-7" />
            通知・アラート
            {getUnreadCount() > 0 && (
              <Badge className="bg-red-500 text-white ml-2">
                {getUnreadCount()}
              </Badge>
            )}
          </h1>
          <p className="text-gray-600">システム通知とカスタムアラートを管理します</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={fetchData}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            更新
          </Button>
          
          <Button
            onClick={markAllAsRead}
            variant="outline"
            className="flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            すべて既読
          </Button>
        </div>
      </div>

      {/* メインタブ */}
      <Tabs defaultValue="notifications" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="notifications">通知一覧</TabsTrigger>
          <TabsTrigger value="alerts">アラート設定</TabsTrigger>
          <TabsTrigger value="settings">通知設定</TabsTrigger>
          <TabsTrigger value="analytics">分析</TabsTrigger>
        </TabsList>

        {/* 通知一覧タブ */}
        <TabsContent value="notifications" className="space-y-6">
          {/* フィルター */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="通知を検索..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-full sm:w-32">
                    <SelectValue placeholder="種類" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべて</SelectItem>
                    <SelectItem value="info">情報</SelectItem>
                    <SelectItem value="success">成功</SelectItem>
                    <SelectItem value="warning">警告</SelectItem>
                    <SelectItem value="error">エラー</SelectItem>
                    <SelectItem value="system">システム</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger className="w-full sm:w-32">
                    <SelectValue placeholder="優先度" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべて</SelectItem>
                    <SelectItem value="urgent">緊急</SelectItem>
                    <SelectItem value="high">高</SelectItem>
                    <SelectItem value="medium">中</SelectItem>
                    <SelectItem value="low">低</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={showUnreadOnly}
                    onCheckedChange={setShowUnreadOnly}
                  />
                  <Label className="text-sm">未読のみ</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 通知リスト */}
          <div className="space-y-3">
            {filteredNotifications.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">通知がありません</h3>
                  <p className="text-gray-600">条件に一致する通知は見つかりませんでした。</p>
                </CardContent>
              </Card>
            ) : (
              filteredNotifications.map((notification) => (
                <Card 
                  key={notification.id} 
                  className={`transition-all hover:shadow-md ${
                    !notification.read ? 'border-l-4 border-l-blue-500 bg-blue-50/30' : ''
                  } ${notification.dismissed ? 'opacity-50' : ''}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900">
                              {notification.title}
                            </h4>
                            {getPriorityBadge(notification.priority)}
                            {!notification.read && (
                              <Badge className="bg-blue-100 text-blue-700 text-xs">
                                未読
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => markAsRead(notification.id)}
                              className="p-1"
                            >
                              {notification.read ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => dismissNotification(notification.id)}
                              className="p-1"
                            >
                              <Archive className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <p className="text-gray-700 text-sm mb-3">
                          {notification.message}
                        </p>
                        
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDateTime(notification.created_at)}
                            </span>
                            {notification.sender_name && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {notification.sender_name}
                              </span>
                            )}
                            <Badge variant="secondary" className="text-xs">
                              {notification.category}
                            </Badge>
                          </div>
                          
                          {notification.action_url && notification.action_label && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-6"
                            >
                              {notification.action_label}
                            </Button>
                          )}
                        </div>
                        
                        {notification.expires_at && (
                          <div className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            有効期限: {formatDateTime(notification.expires_at)}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* アラート設定タブ */}
        <TabsContent value="alerts" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium">アラートルール</h3>
              <p className="text-gray-600 text-sm">条件に基づいて自動通知を設定します</p>
            </div>
            <Button
              onClick={() => {
                setSelectedRule(null)
                setShowRuleDialog(true)
              }}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              新しいルール
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {alertRules.map((rule) => (
              <Card key={rule.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <h4 className="font-medium">{rule.name}</h4>
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={(checked) => 
                          setAlertRules(prev => 
                            prev.map(r => r.id === rule.id ? { ...r, enabled: checked } : r)
                          )
                        }
                      />
                      {rule.enabled ? (
                        <Badge className="bg-green-100 text-green-700">有効</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-700">無効</Badge>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedRule(rule)
                          setShowRuleDialog(true)
                        }}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-3">{rule.description}</p>
                  
                  <div className="bg-gray-50 rounded p-3 mb-3">
                    <div className="text-sm font-medium mb-1">条件:</div>
                    <div className="text-sm text-gray-700">
                      {rule.condition.metric} {rule.condition.operator} {rule.condition.value} {rule.condition.unit}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span>通知方法:</span>
                        {rule.actions.email && <Mail className="w-3 h-3" />}
                        {rule.actions.sms && <MessageSquare className="w-3 h-3" />}
                        {rule.actions.push && <Smartphone className="w-3 h-3" />}
                      </div>
                      <span>クールダウン: {rule.cooldown_minutes}分</span>
                    </div>
                    
                    {rule.last_triggered && (
                      <span>最終発動: {formatDateTime(rule.last_triggered)}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* 通知設定タブ */}
        <TabsContent value="settings" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  基本設定
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>メール通知</Label>
                    <p className="text-sm text-gray-500">重要な通知をメールで受信</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={settings.email_notifications}
                      onCheckedChange={(checked) => 
                        setSettings(prev => ({ ...prev, email_notifications: checked }))
                      }
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testNotification('email')}
                    >
                      テスト
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>SMS通知</Label>
                    <p className="text-sm text-gray-500">緊急時のSMS通知</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={settings.sms_notifications}
                      onCheckedChange={(checked) => 
                        setSettings(prev => ({ ...prev, sms_notifications: checked }))
                      }
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testNotification('sms')}
                    >
                      テスト
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>プッシュ通知</Label>
                    <p className="text-sm text-gray-500">リアルタイム通知</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={settings.push_notifications}
                      onCheckedChange={(checked) => 
                        setSettings(prev => ({ ...prev, push_notifications: checked }))
                      }
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testNotification('push')}
                    >
                      テスト
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>ブラウザ通知</Label>
                    <p className="text-sm text-gray-500">ブラウザでの通知表示</p>
                  </div>
                  <Switch
                    checked={settings.browser_notifications}
                    onCheckedChange={(checked) => 
                      setSettings(prev => ({ ...prev, browser_notifications: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>通知音</Label>
                    <p className="text-sm text-gray-500">音声による通知</p>
                  </div>
                  <Switch
                    checked={settings.notification_sound}
                    onCheckedChange={(checked) => 
                      setSettings(prev => ({ ...prev, notification_sound: checked }))
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  サイレント時間
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>サイレント時間を有効化</Label>
                    <p className="text-sm text-gray-500">指定時間は通知を停止</p>
                  </div>
                  <Switch
                    checked={settings.quiet_hours_enabled}
                    onCheckedChange={(checked) => 
                      setSettings(prev => ({ ...prev, quiet_hours_enabled: checked }))
                    }
                  />
                </div>

                {settings.quiet_hours_enabled && (
                  <>
                    <div className="space-y-2">
                      <Label>開始時刻</Label>
                      <Input
                        type="time"
                        value={settings.quiet_hours_start}
                        onChange={(e) => 
                          setSettings(prev => ({ ...prev, quiet_hours_start: e.target.value }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>終了時刻</Label>
                      <Input
                        type="time"
                        value={settings.quiet_hours_end}
                        onChange={(e) => 
                          setSettings(prev => ({ ...prev, quiet_hours_end: e.target.value }))
                        }
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* カテゴリ別設定 */}
          <Card>
            <CardHeader>
              <CardTitle>カテゴリ別通知設定</CardTitle>
              <CardDescription>通知カテゴリごとに詳細な設定を行います</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(settings.categories).map(([category, config]) => (
                  <div key={category} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium capitalize">{category}</h4>
                        <p className="text-sm text-gray-500">
                          {category === 'system' && 'システム関連の通知'}
                          {category === 'harvest' && '収穫・栽培関連の通知'}
                          {category === 'maintenance' && 'メンテナンス・作業関連の通知'}
                          {category === 'weather' && '天候・気象関連の通知'}
                          {category === 'security' && 'セキュリティ関連の通知'}
                        </p>
                      </div>
                      <Switch
                        checked={config.enabled}
                        onCheckedChange={(checked) => 
                          setSettings(prev => ({
                            ...prev,
                            categories: {
                              ...prev.categories,
                              [category]: { ...config, enabled: checked }
                            }
                          }))
                        }
                      />
                    </div>
                    
                    {config.enabled && (
                      <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          <Switch
                            checked={config.email}
                            onCheckedChange={(checked) => 
                              setSettings(prev => ({
                                ...prev,
                                categories: {
                                  ...prev.categories,
                                  [category]: { ...config, email: checked }
                                }
                              }))
                            }
                            size="sm"
                          />
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4" />
                          <Switch
                            checked={config.sms}
                            onCheckedChange={(checked) => 
                              setSettings(prev => ({
                                ...prev,
                                categories: {
                                  ...prev.categories,
                                  [category]: { ...config, sms: checked }
                                }
                              }))
                            }
                            size="sm"
                          />
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Smartphone className="w-4 h-4" />
                          <Switch
                            checked={config.push}
                            onCheckedChange={(checked) => 
                              setSettings(prev => ({
                                ...prev,
                                categories: {
                                  ...prev.categories,
                                  [category]: { ...config, push: checked }
                                }
                              }))
                            }
                            size="sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={saveSettings} className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              設定を保存
            </Button>
          </div>
        </TabsContent>

        {/* 分析タブ */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">総通知数</p>
                    <p className="text-2xl font-bold">{notifications.length}</p>
                  </div>
                  <Bell className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">未読通知</p>
                    <p className="text-2xl font-bold">{getUnreadCount()}</p>
                  </div>
                  <Eye className="w-8 h-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">緊急通知</p>
                    <p className="text-2xl font-bold">
                      {notifications.filter(n => n.priority === 'urgent').length}
                    </p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">有効ルール</p>
                    <p className="text-2xl font-bold">
                      {alertRules.filter(r => r.enabled).length}
                    </p>
                  </div>
                  <Target className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>通知統計</CardTitle>
              <CardDescription>過去30日間の通知データ</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Activity className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="font-medium">通知統計</p>
                <p className="text-sm">詳細な統計データは今後実装予定です</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* アラートルール作成/編集ダイアログ */}
      <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedRule ? 'アラートルール編集' : '新しいアラートルール'}
            </DialogTitle>
            <DialogDescription>
              条件に基づいて自動通知を送信するルールを設定します
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>ルール名</Label>
              <Input placeholder="例: 収穫適期アラート" />
            </div>
            
            <div className="space-y-2">
              <Label>説明</Label>
              <Textarea placeholder="このルールの説明を入力" />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>監視項目</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="days_since_planting">栽培日数</SelectItem>
                    <SelectItem value="weather_risk">天候リスク</SelectItem>
                    <SelectItem value="storage_usage">ストレージ使用量</SelectItem>
                    <SelectItem value="task_deadline">タスク期限</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>条件</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gte">以上</SelectItem>
                    <SelectItem value="lte">以下</SelectItem>
                    <SelectItem value="eq">等しい</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>閾値</Label>
                <Input type="number" placeholder="90" />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>通知方法</Label>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch />
                  <Mail className="w-4 h-4" />
                  <span className="text-sm">メール</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch />
                  <MessageSquare className="w-4 h-4" />
                  <span className="text-sm">SMS</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch />
                  <Smartphone className="w-4 h-4" />
                  <span className="text-sm">プッシュ</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>クールダウン時間 (分)</Label>
              <Input type="number" placeholder="60" />
            </div>
          </div>
          
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowRuleDialog(false)}
              className="flex-1"
            >
              キャンセル
            </Button>
            <Button onClick={() => setShowRuleDialog(false)} className="flex-1">
              {selectedRule ? '更新' : '作成'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}