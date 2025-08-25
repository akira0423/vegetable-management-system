import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceClient()
    
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'income', 'expense', 'both', or null for all
    
    console.log('🔍 会計項目API - リクエストパラメータ:', { type })
    
    let query = supabase
      .from('accounting_items')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
    
    if (type && type !== 'all') {
      if (type === 'income' || type === 'expense') {
        query = query.or(`type.eq.${type},type.eq.both`)
      } else {
        query = query.eq('type', type)
      }
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('❌ 会計項目取得エラー:', error)
      return NextResponse.json(
        { error: 'Failed to fetch accounting items', details: error },
        { status: 500 }
      )
    }
    
    console.log('✅ 会計項目取得成功:', { 
      取得件数: data?.length,
      フィルタ: type || 'all'
    })
    
    return NextResponse.json({
      success: true,
      data: data || [],
      count: data?.length || 0
    })

  } catch (error) {
    console.error('❌ 会計項目API内部エラー:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}