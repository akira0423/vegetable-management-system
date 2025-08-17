'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { 
  Bell, 
  BellRing, 
  AlertTriangle, 
  Clock, 
  Sprout, 
  TrendingUp, 
  Cloud, 
  CheckCircle2, 
  X, 
  Trash2,
  ExternalLink,
  RefreshCw
} from 'lucide-react'
import { useNotifications } from '@/lib/notification-system'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

interface NotificationCenterProps {
  className?: string
}

export default function NotificationCenter({ className }: NotificationCenterProps) {
  const {
    getAllNotifications,
    getUnreadNotifications,
    onNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    getStats,
    checkNow
  } = useNotifications()

  const [notifications, setNotifications] = useState(getAllNotifications())
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // 通知リスナー登録
    const unsubscribe = onNotification((newNotification) => {
      setNotifications(getAllNotifications())
    })

    // 初期データ読み込み
    setNotifications(getAllNotifications())

    return unsubscribe
  }, [])

  const stats = getStats()
  const unreadNotifications = getUnreadNotifications()

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'task_deadline':
        return <Clock className="w-4 h-4 text-orange-600" />
      case 'harvest_alert':
        return <Sprout className="w-4 h-4 text-green-600" />
      case 'weather_warning':
        return <Cloud className="w-4 h-4 text-blue-600" />
      case 'work_reminder':
        return <TrendingUp className="w-4 h-4 text-purple-600" />
      default:
        return <Bell className="w-4 h-4 text-gray-600" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '緊急'
      case 'high':
        return '重要'
      case 'medium':
        return '中'
      case 'low':
        return '低'
      default:
        return '通常'
    }
  }

  const handleMarkAsRead = (notificationId: string) => {
    markAsRead(notificationId)
    setNotifications(getAllNotifications())
  }

  const handleMarkAllAsRead = () => {
    markAllAsRead()
    setNotifications(getAllNotifications())
  }

  const handleDelete = (notificationId: string) => {
    deleteNotification(notificationId)
    setNotifications(getAllNotifications())
  }

  const handleCheckNow = async () => {
    setLoading(true)
    try {
      await checkNow()
      setNotifications(getAllNotifications())
    } catch (error) {
      console.error('通知チェックエラー:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleNotificationClick = (notification: any) => {
    if (!notification.read) {
      handleMarkAsRead(notification.id)
    }
    
    if (notification.action_url) {
      window.open(notification.action_url, '_blank')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={`relative ${className}`}>
          {stats.unread > 0 ? (
            <BellRing className="w-4 h-4" />
          ) : (
            <Bell className="w-4 h-4" />
          )}
          {stats.unread > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 px-1 min-w-[1.2rem] h-5 flex items-center justify-center text-xs"
            >
              {stats.unread > 99 ? '99+' : stats.unread}
            </Badge>
          )}
          <span className="ml-2 hidden sm:inline">通知</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[85vh] p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            通知センター
          </DialogTitle>
          <DialogDescription>
            タスクの期限、収穫時期、重要なアラートを確認できます
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 border-b bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-600">
                総通知数: <span className="font-semibold">{stats.total}</span>
              </span>
              <span className="text-orange-600">
                未読: <span className="font-semibold">{stats.unread}</span>
              </span>
              <span className="text-red-600">
                緊急: <span className="font-semibold">{stats.critical}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCheckNow}
              disabled={loading}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  チェック中...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  今すぐチェック
                </>
              )}
            </Button>

            {stats.unread > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllAsRead}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                全て既読
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1 max-h-[50vh]">
          <div className="px-6 py-4">
            {notifications.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500 text-lg font-medium mb-2">
                  通知はありません
                </p>
                <p className="text-gray-400 text-sm">
                  タスクの期限や収穫時期が近づくと通知が表示されます
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <Card 
                    key={notification.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      !notification.read 
                        ? 'border-l-4 border-l-blue-500 bg-blue-50' 
                        : 'bg-white'
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">
                          {getNotificationIcon(notification.type)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h4 className={`font-medium text-sm ${
                              !notification.read ? 'text-gray-900' : 'text-gray-700'
                            }`}>
                              {notification.title}
                            </h4>
                            
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${getSeverityColor(notification.severity)}`}
                              >
                                {getSeverityLabel(notification.severity)}
                              </Badge>
                              
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 hover:bg-red-100"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDelete(notification.id)
                                }}
                              >
                                <X className="w-3 h-3 text-gray-400" />
                              </Button>
                            </div>
                          </div>

                          <p className="text-sm text-gray-600 mb-2 whitespace-pre-line">
                            {notification.message}
                          </p>

                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400">
                              {format(new Date(notification.created_at), 'MM月dd日 HH:mm', { locale: ja })}
                            </span>

                            <div className="flex items-center gap-2">
                              {notification.action_url && (
                                <ExternalLink className="w-3 h-3 text-gray-400" />
                              )}
                              
                              {!notification.read && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {notifications.length > 0 && (
          <div className="px-6 py-4 border-t bg-gray-50">
            <div className="text-xs text-gray-500 space-y-1">
              <p>💡 <strong>使い方:</strong></p>
              <p>• 通知をクリックすると関連ページに移動します</p>
              <p>• 緊急・重要な通知は優先的に対応してください</p>
              <p>• 古い通知は30日後に自動削除されます</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}