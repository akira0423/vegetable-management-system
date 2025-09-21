// ====================================================
// Phase 1: 財務パフォーマンスAPI
// 目的: RLSを回避してServer側でデータ取得
// ====================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const { workReportIds, companyId, dateRange } = await request.json()

    // サーバー側のSupabaseクライアントを作成
    const cookieStore = cookies()
    const supabase = await createClient(cookieStore)

    // ユーザー認証確認
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // work_report_accountingデータを取得（RLSは有効だがサーバー側で実行）
    const { data: accountingData, error } = await supabase
      .from('work_report_accounting')
      .select(`
        id,
        work_report_id,
        accounting_item_id,
        amount,
        custom_item_name,
        notes,
        is_ai_recommended,
        work_reports!inner (
          id,
          work_date,
          company_id,
          vegetable_id
        ),
        accounting_items!inner (
          id,
          name,
          code,
          cost_type,
          category
        )
      `)
      .in('work_report_id', workReportIds)

    if (error) {
      console.error('API Error:', error)

      // エラー時は代替データを返す
      return NextResponse.json({
        success: false,
        data: [],
        fallback: true,
        message: 'Using fallback data'
      })
    }

    // データ整形
    const formattedData = formatAccountingData(accountingData || [])

    return NextResponse.json({
      success: true,
      data: formattedData,
      count: accountingData?.length || 0
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// データ整形関数
function formatAccountingData(data: any[]) {
  const monthlyData: { [key: string]: any } = {}

  data.forEach(record => {
    if (!record.work_reports?.work_date) return

    const date = new Date(record.work_reports.work_date)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        month: monthKey,
        income: [],
        variable_costs: [],
        fixed_costs: []
      }
    }

    const costType = record.accounting_items?.cost_type
    const category = costType === 'income' ? 'income' :
                    costType === 'variable_cost' ? 'variable_costs' : 'fixed_costs'

    // 既存の項目を探す
    const existingItem = monthlyData[monthKey][category].find(
      (item: any) => item.id === record.accounting_items.id
    )

    if (existingItem) {
      existingItem.value += record.amount
    } else {
      monthlyData[monthKey][category].push({
        id: record.accounting_items.id,
        name: record.accounting_items.name || record.custom_item_name,
        value: record.amount,
        category: category
      })
    }
  })

  return monthlyData
}