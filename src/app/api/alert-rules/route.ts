import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // URLクエリパラメータを取得
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')
    const enabled = searchParams.get('enabled')

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 })
    }

    let query = supabase
      .from('alert_rules')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (enabled !== null) {
      query = query.eq('enabled', enabled === 'true')
    }

    const { data: alertRules, error } = await query

    if (error) {
      
      return NextResponse.json({ error: 'Failed to fetch alert rules' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: alertRules || []
    })

  } catch (error) {
    
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
      name,
      description,
      condition,
      actions,
      enabled = true,
      cooldown_minutes = 60,
      company_id,
      created_by
    } = body

    // 必須フィールドのバリデーション
    if (!name || !description || !condition || !actions || !company_id) {
      return NextResponse.json({ 
        error: 'Missing required fields: name, description, condition, actions, company_id' 
      }, { status: 400 })
    }

    // 条件のバリデーション
    if (!condition.metric || !condition.operator || condition.value === undefined) {
      return NextResponse.json({ 
        error: 'Invalid condition. Must include metric, operator, and value' 
      }, { status: 400 })
    }

    const validOperators = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte']
    if (!validOperators.includes(condition.operator)) {
      return NextResponse.json({ 
        error: 'Invalid operator. Must be one of: eq, ne, gt, gte, lt, lte' 
      }, { status: 400 })
    }

    // アクションのバリデーション
    if (!actions.email && !actions.sms && !actions.push && !actions.webhook) {
      return NextResponse.json({ 
        error: 'At least one action method must be enabled' 
      }, { status: 400 })
    }

    // 新しいアラートルールを作成
    const { data: alertRule, error } = await supabase
      .from('alert_rules')
      .insert({
        name,
        description,
        condition,
        actions,
        enabled,
        cooldown_minutes,
        company_id,
        created_by
      })
      .select()
      .single()

    if (error) {
      
      return NextResponse.json({ error: 'Failed to create alert rule' }, { status: 500 })
    }

    // システムログに記録
    await supabase
      .from('system_logs')
      .insert({
        company_id,
        level: 'info',
        category: 'alert_rules',
        message: `新しいアラートルール「${name}」が作成されました`,
        user_id: created_by
      })

    return NextResponse.json({
      success: true,
      data: alertRule,
      message: 'Alert rule created successfully'
    })

  } catch (error) {
    
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
    
    const { 
      id, 
      name, 
      description, 
      condition, 
      actions, 
      enabled, 
      cooldown_minutes 
    } = body

    if (!id) {
      return NextResponse.json({ error: 'Alert rule ID is required' }, { status: 400 })
    }

    // 存在チェック
    const { data: existingRule, error: fetchError } = await supabase
      .from('alert_rules')
      .select('id, company_id, name')
      .eq('id', id)
      .single()

    if (fetchError || !existingRule) {
      return NextResponse.json({ error: 'Alert rule not found' }, { status: 404 })
    }

    // 更新データの準備
    const updateData: any = { updated_at: new Date().toISOString() }
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (condition !== undefined) updateData.condition = condition
    if (actions !== undefined) updateData.actions = actions
    if (enabled !== undefined) updateData.enabled = enabled
    if (cooldown_minutes !== undefined) updateData.cooldown_minutes = cooldown_minutes

    const { data: alertRule, error } = await supabase
      .from('alert_rules')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      
      return NextResponse.json({ error: 'Failed to update alert rule' }, { status: 500 })
    }

    // システムログに記録
    await supabase
      .from('system_logs')
      .insert({
        company_id: existingRule.company_id,
        level: 'info',
        category: 'alert_rules',
        message: `アラートルール「${existingRule.name}」が更新されました`
      })

    return NextResponse.json({
      success: true,
      data: alertRule,
      message: 'Alert rule updated successfully'
    })

  } catch (error) {
    
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const ruleId = searchParams.get('id')

    if (!ruleId) {
      return NextResponse.json({ 
        error: 'Alert rule ID is required' 
      }, { status: 400 })
    }

    // アラートルールが存在するかチェック
    const { data: existingRule, error: fetchError } = await supabase
      .from('alert_rules')
      .select('id, company_id, name')
      .eq('id', ruleId)
      .single()

    if (fetchError || !existingRule) {
      return NextResponse.json({ error: 'Alert rule not found' }, { status: 404 })
    }

    // アラートルールを削除
    const { error: deleteError } = await supabase
      .from('alert_rules')
      .delete()
      .eq('id', ruleId)

    if (deleteError) {
      
      return NextResponse.json({ error: 'Failed to delete alert rule' }, { status: 500 })
    }

    // システムログに記録
    await supabase
      .from('system_logs')
      .insert({
        company_id: existingRule.company_id,
        level: 'info',
        category: 'alert_rules',
        message: `アラートルール「${existingRule.name}」が削除されました`
      })

    return NextResponse.json({
      success: true,
      message: `Alert rule "${existingRule.name}" deleted successfully`,
      deleted_rule: {
        id: existingRule.id,
        name: existingRule.name
      }
    })

  } catch (error) {
    
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

// アラートルールの実行・トリガーチェック
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { action, company_id } = body

    if (!company_id) {
      return NextResponse.json({ 
        error: 'Company ID is required' 
      }, { status: 400 })
    }

    switch (action) {
      case 'check_triggers':
        return await checkAndTriggerAlerts(supabase, company_id)
      
      case 'test_rule':
        const { rule_id } = body
        if (!rule_id) {
          return NextResponse.json({ error: 'Rule ID is required for test' }, { status: 400 })
        }
        return await testAlertRule(supabase, rule_id)
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

// アラート条件をチェックしてトリガー
async function checkAndTriggerAlerts(supabase: any, companyId: string) {
  try {
    // 有効なアラートルールを取得
    const { data: alertRules } = await supabase
      .from('alert_rules')
      .select('*')
      .eq('company_id', companyId)
      .eq('enabled', true)

    if (!alertRules || alertRules.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active alert rules found',
        triggered: 0
      })
    }

    let triggeredCount = 0

    for (const rule of alertRules) {
      const shouldTrigger = await evaluateAlertCondition(supabase, rule, companyId)
      
      if (shouldTrigger) {
        // クールダウンチェック
        const canTrigger = await checkCooldown(supabase, rule)
        
        if (canTrigger) {
          await triggerAlert(supabase, rule, companyId)
          triggeredCount++
          
          // 最終トリガー時刻を更新
          await supabase
            .from('alert_rules')
            .update({ last_triggered: new Date().toISOString() })
            .eq('id', rule.id)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Checked ${alertRules.length} rules, triggered ${triggeredCount} alerts`,
      checked: alertRules.length,
      triggered: triggeredCount
    })

  } catch (error) {
    
    return NextResponse.json({ error: 'Failed to check alert triggers' }, { status: 500 })
  }
}

// アラート条件の評価
async function evaluateAlertCondition(supabase: any, rule: any, companyId: string): Promise<boolean> {
  try {
    const { condition } = rule
    const { metric, operator, value } = condition

    let currentValue: number

    // メトリクスに基づいて現在の値を取得
    switch (metric) {
      case 'days_since_planting':
        // 栽培日数が閾値を超える野菜があるかチェック
        const { data: vegetables } = await supabase
          .from('vegetables')
          .select('id, planting_date')
          .eq('company_id', companyId)
          .eq('status', 'growing')

        if (!vegetables) return false

        for (const vegetable of vegetables) {
          const plantingDate = new Date(vegetable.planting_date)
          const daysSincePlanting = Math.floor(
            (Date.now() - plantingDate.getTime()) / (1000 * 60 * 60 * 24)
          )
          
          if (evaluateCondition(daysSincePlanting, operator, value)) {
            return true
          }
        }
        return false

      case 'weather_risk_level':
        // 天候リスクレベルのチェック（実際の実装では気象APIから取得）
        currentValue = Math.floor(Math.random() * 5) + 1 // 1-5のランダム値（サンプル）
        break

      case 'storage_usage_percent':
        // ストレージ使用率のチェック（実際の実装ではシステム情報から取得）
        currentValue = Math.floor(Math.random() * 100) // 0-100のランダム値（サンプル）
        break

      case 'task_deadline_hours':
        // タスク期限までの時間をチェック
        const { data: tasks } = await supabase
          .from('gantt_tasks')
          .select('id, end_date')
          .eq('company_id', companyId)
          .eq('status', 'in_progress')

        if (!tasks) return false

        for (const task of tasks) {
          const endDate = new Date(task.end_date)
          const hoursUntilDeadline = (endDate.getTime() - Date.now()) / (1000 * 60 * 60)
          
          if (evaluateCondition(hoursUntilDeadline, operator, value)) {
            return true
          }
        }
        return false

      default:
        
        return false
    }

    return evaluateCondition(currentValue, operator, value)

  } catch (error) {
    
    return false
  }
}

// 条件演算子の評価
function evaluateCondition(currentValue: number, operator: string, targetValue: number): boolean {
  switch (operator) {
    case 'eq': return currentValue === targetValue
    case 'ne': return currentValue !== targetValue
    case 'gt': return currentValue > targetValue
    case 'gte': return currentValue >= targetValue
    case 'lt': return currentValue < targetValue
    case 'lte': return currentValue <= targetValue
    default: return false
  }
}

// クールダウンチェック
async function checkCooldown(supabase: any, rule: any): Promise<boolean> {
  if (!rule.last_triggered) return true

  const lastTriggered = new Date(rule.last_triggered)
  const cooldownMs = rule.cooldown_minutes * 60 * 1000
  const timeSinceLastTrigger = Date.now() - lastTriggered.getTime()

  return timeSinceLastTrigger >= cooldownMs
}

// アラートをトリガー
async function triggerAlert(supabase: any, rule: any, companyId: string) {
  try {
    // 通知を作成
    const notification = {
      title: `アラート: ${rule.name}`,
      message: rule.description,
      type: 'warning',
      priority: 'high',
      category: 'alert',
      company_id: companyId,
      sender_name: 'アラートシステム',
      metadata: {
        alert_rule_id: rule.id,
        condition: rule.condition
      }
    }

    await supabase
      .from('notifications')
      .insert(notification)

    // 通知配信処理（メール、SMS、プッシュなど）
    if (rule.actions.email || rule.actions.sms || rule.actions.push) {
      // 実際の配信処理を実行
      
    }

    // Webhook通知
    if (rule.actions.webhook) {
      await sendWebhookAlert(rule.actions.webhook, rule, notification)
    }

  } catch (error) {
    
  }
}

// Webhook通知送信
async function sendWebhookAlert(webhookUrl: string, rule: any, notification: any) {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        alert_rule: rule,
        notification: notification,
        timestamp: new Date().toISOString()
      })
    })

    if (!response.ok) {
      
    }

  } catch (error) {
    
  }
}

// アラートルールのテスト実行
async function testAlertRule(supabase: any, ruleId: string) {
  try {
    const { data: rule, error } = await supabase
      .from('alert_rules')
      .select('*')
      .eq('id', ruleId)
      .single()

    if (error || !rule) {
      return NextResponse.json({ error: 'Alert rule not found' }, { status: 404 })
    }

    // テスト通知を作成
    const testNotification = {
      title: `[テスト] ${rule.name}`,
      message: `これは「${rule.name}」のテスト通知です。`,
      type: 'info',
      priority: 'low',
      category: 'test',
      company_id: rule.company_id,
      sender_name: 'テストシステム',
      metadata: {
        test: true,
        alert_rule_id: rule.id
      }
    }

    await supabase
      .from('notifications')
      .insert(testNotification)

    return NextResponse.json({
      success: true,
      message: 'Test alert sent successfully',
      test_notification: testNotification
    })

  } catch (error) {
    
    return NextResponse.json({ error: 'Failed to send test alert' }, { status: 500 })
  }
}