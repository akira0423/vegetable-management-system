import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceClient()
    
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'income', 'expense', 'both', or null for all
    
    
    
    let query = supabase
      .from('accounting_items')
      .select('id, code, name, type, category, cost_type, is_active, sort_order')
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
      
      return NextResponse.json(
        { error: 'Failed to fetch accounting items', details: error },
        { status: 500 }
      )
    }
    
    
    
    return NextResponse.json({
      success: true,
      data: data || [],
      count: data?.length || 0
    })

  } catch (error) {
    
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}