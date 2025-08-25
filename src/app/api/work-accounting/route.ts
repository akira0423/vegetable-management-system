import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceClient()
    
    const { searchParams } = new URL(request.url)
    const workReportId = searchParams.get('work_report_id')
    
    if (!workReportId) {
      return NextResponse.json(
        { error: 'Work report ID is required' },
        { status: 400 }
      )
    }
    
    console.log('📊 作業会計データ取得API - ID:', workReportId)
    
    const { data, error } = await supabase
      .from('work_report_accounting')
      .select(`
        *,
        accounting_items:accounting_item_id (
          id, code, name, type, category
        )
      `)
      .eq('work_report_id', workReportId)
      .order('created_at')
    
    if (error) {
      console.error('❌ 作業会計データ取得エラー:', error)
      return NextResponse.json(
        { error: 'Failed to fetch work accounting data', details: error },
        { status: 500 }
      )
    }
    
    // 収入・支出に分類
    const incomeItems = data?.filter(item => 
      item.accounting_items?.type === 'income' || 
      (item.accounting_items?.type === 'both' && item.amount > 0)
    ) || []
    
    const expenseItems = data?.filter(item => 
      item.accounting_items?.type === 'expense' || 
      (item.accounting_items?.type === 'both' && item.amount < 0)
    ) || []
    
    const incomeTotal = incomeItems.reduce((sum, item) => sum + (item.amount || 0), 0)
    const expenseTotal = Math.abs(expenseItems.reduce((sum, item) => sum + Math.abs(item.amount || 0), 0))
    
    console.log('✅ 作業会計データ取得完了:', {
      収入項目: incomeItems.length,
      支出項目: expenseItems.length,
      収入合計: incomeTotal,
      支出合計: expenseTotal
    })
    
    return NextResponse.json({
      success: true,
      data: {
        income_items: incomeItems,
        expense_items: expenseItems,
        income_total: incomeTotal,
        expense_total: expenseTotal,
        net_income: incomeTotal - expenseTotal
      }
    })

  } catch (error) {
    console.error('❌ 作業会計データAPI内部エラー:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServiceClient()
    const body = await request.json()
    
    const {
      work_report_id,
      company_id,
      work_type,
      income_items = [],
      expense_items = []
    } = body
    
    if (!work_report_id) {
      return NextResponse.json(
        { error: 'Work report ID is required' },
        { status: 400 }
      )
    }
    
    console.log('💾 作業会計データ保存API:', {
      work_report_id,
      収入項目数: income_items.length,
      支出項目数: expense_items.length,
      収入項目詳細: income_items,
      支出項目詳細: expense_items
    })
    
    // 既存の会計データを削除
    const { error: deleteError } = await supabase
      .from('work_report_accounting')
      .delete()
      .eq('work_report_id', work_report_id)
    
    if (deleteError) {
      console.error('❌ 既存データ削除エラー:', deleteError)
    }
    
    // 新しい会計データを挿入
    const allItems = [...income_items, ...expense_items]
    
    if (allItems.length > 0) {
      const insertData = allItems.map(item => ({
        work_report_id,
        accounting_item_id: item.accounting_item_id && item.accounting_item_id.trim() !== '' ? item.accounting_item_id : null,
        amount: item.amount || 0,
        custom_item_name: item.custom_item_name && item.custom_item_name.trim() !== '' ? item.custom_item_name : null,
        notes: item.notes && item.notes.trim() !== '' ? item.notes : null,
        is_ai_recommended: item.is_ai_recommended || false
      })).filter(item => 
        // accounting_item_id が存在するか、custom_item_name が存在する場合のみ挿入
        item.accounting_item_id || item.custom_item_name
      )
      
      console.log('📝 挿入データ準備完了:', {
        挿入予定件数: insertData.length,
        挿入データ詳細: insertData
      })
      
      const { data: insertedData, error: insertError } = await supabase
        .from('work_report_accounting')
        .insert(insertData)
        .select()
      
      if (insertError) {
        console.error('❌ 会計データ挿入エラー:', insertError)
        return NextResponse.json(
          { error: 'Failed to save accounting data', details: insertError },
          { status: 500 }
        )
      }
      
      // AI推奨学習データを更新
      if (company_id && work_type) {
        await updateRecommendations(supabase, company_id, work_type, allItems)
      }
      
      console.log('✅ 会計データ保存完了:', {
        保存件数: insertedData?.length || 0
      })
    }
    
    return NextResponse.json({
      success: true,
      message: 'Work accounting data saved successfully',
      count: allItems.length
    })

  } catch (error) {
    console.error('❌ 作業会計データ保存API内部エラー:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// AI推奨学習データを更新する関数
async function updateRecommendations(supabase: any, companyId: string, workType: string, items: any[]) {
  try {
    for (const item of items) {
      if (item.accounting_item_id && item.amount && item.amount !== 0) {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/accounting-recommendations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            company_id: companyId,
            work_type: workType,
            accounting_item_id: item.accounting_item_id,
            amount: Math.abs(item.amount),
            confidence_score: item.is_ai_recommended ? 0.8 : 0.6
          })
        })
        
        if (!response.ok) {
          console.warn('⚠️ AI推奨学習データ更新に失敗:', item.accounting_item_id)
        }
      }
    }
  } catch (error) {
    console.error('❌ AI推奨学習データ更新エラー:', error)
  }
}