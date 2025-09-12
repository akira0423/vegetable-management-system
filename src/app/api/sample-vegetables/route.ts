import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Sample vegetables API - 開始')
    const supabase = await createClient()
    
    // 認証確認（サンプルデータなので認証エラーでも継続）
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.log('⚠️ サンプル野菜API: 未認証アクセス (継続)')
    } else {
      console.log('✅ サンプル野菜API: 認証済みユーザー', user.email)
    }
    
    console.log('✅ Supabaseクライアント作成完了')

    // サンプル野菜一覧を取得
    const { data: sampleVegetables, error } = await supabase
      .from('sample_vegetables')
      .select(`
        id,
        name,
        display_name,
        sample_category,
        variety_name,
        area_size,
        plant_count,
        planting_date,
        status,
        description
      `)
      .order('sample_category')

    if (error) {
      console.error('Sample vegetables fetch error:', error)
      return NextResponse.json({ error: 'データの取得に失敗しました' }, { status: 500 })
    }

    console.log(`🌱 Sample vegetables API: 取得成功 ${sampleVegetables?.length || 0}件`)

    return NextResponse.json({
      success: true,
      data: sampleVegetables || [],
      count: sampleVegetables?.length || 0
    })

  } catch (error) {
    console.error('Sample vegetables API error:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}