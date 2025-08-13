import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // URLクエリパラメータを取得
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')
    const userId = searchParams.get('user_id')
    const type = searchParams.get('type')
    const priority = searchParams.get('priority')
    const category = searchParams.get('category')
    const unreadOnly = searchParams.get('unread_only') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 })
    }

    // ベースクエリ
    let query = supabase
      .from('notifications')
      .select(`
        id,
        title,
        message,
        type,
        priority,
        category,
        read,
        dismissed,
        created_at,
        expires_at,
        action_url,
        action_label,
        sender_id,
        sender_name,
        metadata
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // フィルター条件を追加
    if (userId) {
      query = query.eq('user_id', userId)
    }

    if (type && type !== 'all') {
      query = query.eq('type', type)
    }

    if (priority && priority !== 'all') {
      query = query.eq('priority', priority)
    }

    if (category && category !== 'all') {
      query = query.eq('category', category)
    }

    if (unreadOnly) {
      query = query.eq('read', false).eq('dismissed', false)
    }

    const { data: notifications, error } = await query

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
    }

    // 統計情報も取得
    const { count: totalNotifications } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)

    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('read', false)
      .eq('dismissed', false)

    return NextResponse.json({
      success: true,
      data: notifications || [],
      pagination: {
        total: totalNotifications || 0,
        unread: unreadCount || 0,
        offset,
        limit,
        hasMore: (notifications?.length || 0) === limit
      }
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const {
      title,
      message,
      type = 'info',
      priority = 'medium',
      category = 'system',
      company_id,
      user_id,
      sender_id,
      sender_name,
      expires_at,
      action_url,
      action_label,
      metadata
    } = body

    // 必須フィールドのバリデーション
    if (!title || !message || !company_id) {
      return NextResponse.json({ 
        error: 'Missing required fields: title, message, company_id' 
      }, { status: 400 })
    }

    // タイプのバリデーション
    const validTypes = ['info', 'success', 'warning', 'error', 'system']
    if (!validTypes.includes(type)) {
      return NextResponse.json({ 
        error: 'Invalid type. Must be one of: info, success, warning, error, system' 
      }, { status: 400 })
    }

    // 優先度のバリデーション
    const validPriorities = ['low', 'medium', 'high', 'urgent']
    if (!validPriorities.includes(priority)) {
      return NextResponse.json({ 
        error: 'Invalid priority. Must be one of: low, medium, high, urgent' 
      }, { status: 400 })
    }

    // 新しい通知を作成
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        title,
        message,
        type,
        priority,
        category,
        company_id,
        user_id,
        sender_id,
        sender_name,
        expires_at,
        action_url,
        action_label,
        metadata,
        read: false,
        dismissed: false
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 })
    }

    // 通知設定に基づいて配信処理
    await processNotificationDelivery(supabase, notification, company_id, user_id)

    return NextResponse.json({
      success: true,
      data: notification,
      message: 'Notification created successfully'
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { id, read, dismissed, action } = body

    if (!id) {
      return NextResponse.json({ error: 'Notification ID is required' }, { status: 400 })
    }

    const updateData: any = { updated_at: new Date().toISOString() }
    
    if (action === 'mark_read') {
      updateData.read = true
    } else if (action === 'mark_unread') {
      updateData.read = false
    } else if (action === 'dismiss') {
      updateData.dismissed = true
    } else if (action === 'restore') {
      updateData.dismissed = false
    } else {
      if (read !== undefined) updateData.read = read
      if (dismissed !== undefined) updateData.dismissed = dismissed
    }

    const { data: notification, error } = await supabase
      .from('notifications')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: notification,
      message: 'Notification updated successfully'
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

// 一括操作用のエンドポイント
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { action, notification_ids, company_id } = body

    if (!action || !company_id) {
      return NextResponse.json({ 
        error: 'Action and company_id are required' 
      }, { status: 400 })
    }

    let query = supabase.from('notifications').eq('company_id', company_id)

    if (notification_ids && notification_ids.length > 0) {
      query = query.in('id', notification_ids)
    }

    const updateData: any = { updated_at: new Date().toISOString() }

    switch (action) {
      case 'mark_all_read':
        updateData.read = true
        break
      case 'dismiss_all':
        updateData.dismissed = true
        break
      case 'mark_all_unread':
        updateData.read = false
        break
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const { data: notifications, error } = await query
      .update(updateData)
      .select()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: notifications,
      message: `${action} completed for ${notifications?.length || 0} notifications`
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

// 通知配信処理
async function processNotificationDelivery(supabase: any, notification: any, companyId: string, userId?: string) {
  try {
    // 通知設定を取得
    const { data: settings } = await supabase
      .from('notification_settings')
      .select('*')
      .eq('company_id', companyId)
      .eq('user_id', userId || 'default')
      .single()

    if (!settings) {
      console.log('No notification settings found, using defaults')
      return
    }

    // カテゴリ設定を確認
    const categorySettings = settings.categories?.[notification.category]
    if (!categorySettings?.enabled) {
      console.log(`Notifications disabled for category: ${notification.category}`)
      return
    }

    // メール通知
    if (settings.email_notifications && categorySettings.email) {
      await sendEmailNotification(notification, companyId, userId)
    }

    // SMS通知
    if (settings.sms_notifications && categorySettings.sms) {
      await sendSMSNotification(notification, companyId, userId)
    }

    // プッシュ通知
    if (settings.push_notifications && categorySettings.push) {
      await sendPushNotification(notification, companyId, userId)
    }

  } catch (error) {
    console.error('Notification delivery error:', error)
  }
}

// メール通知送信
async function sendEmailNotification(notification: any, companyId: string, userId?: string) {
  try {
    // 実際の実装では適切なメールサービスを使用
    console.log('Sending email notification:', notification.title)
    
    // メール送信ログを記録
    // await supabase.from('notification_delivery_logs').insert({
    //   notification_id: notification.id,
    //   delivery_method: 'email',
    //   status: 'sent',
    //   company_id: companyId,
    //   user_id: userId
    // })

  } catch (error) {
    console.error('Email notification error:', error)
  }
}

// SMS通知送信
async function sendSMSNotification(notification: any, companyId: string, userId?: string) {
  try {
    // 実際の実装では適切なSMSサービスを使用
    console.log('Sending SMS notification:', notification.title)
    
    // SMS送信ログを記録
    // await supabase.from('notification_delivery_logs').insert({
    //   notification_id: notification.id,
    //   delivery_method: 'sms',
    //   status: 'sent',
    //   company_id: companyId,
    //   user_id: userId
    // })

  } catch (error) {
    console.error('SMS notification error:', error)
  }
}

// プッシュ通知送信
async function sendPushNotification(notification: any, companyId: string, userId?: string) {
  try {
    // 実際の実装では適切なプッシュ通知サービスを使用
    console.log('Sending push notification:', notification.title)
    
    // WebSocket経由でリアルタイム通知を送信
    // await broadcastNotification(notification, companyId, userId)
    
    // プッシュ送信ログを記録
    // await supabase.from('notification_delivery_logs').insert({
    //   notification_id: notification.id,
    //   delivery_method: 'push',
    //   status: 'sent',
    //   company_id: companyId,
    //   user_id: userId
    // })

  } catch (error) {
    console.error('Push notification error:', error)
  }
}