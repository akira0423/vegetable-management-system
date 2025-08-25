import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceClient()
    
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')
    const workType = searchParams.get('work_type')
    
    if (!companyId || !workType) {
      return NextResponse.json(
        { error: 'Company ID and work type are required' },
        { status: 400 }
      )
    }
    
    console.log('🤖 AI推奨API - パラメータ:', { companyId, workType })
    
    // AI推奨ロジック: 過去の作業記録から推奨項目を算出
    const { data: recommendations, error } = await supabase
      .from('accounting_recommendations')
      .select(`
        *,
        accounting_items:accounting_item_id (
          id, code, name, type, category
        )
      `)
      .eq('company_id', companyId)
      .eq('work_type', workType)
      .gte('confidence_score', 0.3) // 信頼度30%以上
      .order('confidence_score', { ascending: false })
      .limit(6) // 上位6件まで
    
    if (error) {
      console.error('❌ AI推奨取得エラー:', error)
      return NextResponse.json(
        { error: 'Failed to fetch recommendations', details: error },
        { status: 500 }
      )
    }
    
    // デフォルト推奨項目（データが少ない場合）
    const defaultRecommendations = await getDefaultRecommendations(supabase, workType)
    
    const processedRecommendations = recommendations?.map(rec => ({
      id: rec.id,
      accounting_item: rec.accounting_items,
      confidence: rec.confidence_score,
      avg_amount: rec.avg_amount,
      usage_count: rec.usage_count,
      is_high_confidence: rec.confidence_score >= 0.7,
      stars: rec.confidence_score >= 0.7 ? 3 : rec.confidence_score >= 0.5 ? 2 : 1
    })) || []
    
    // データが少ない場合はデフォルト推奨を追加
    const finalRecommendations = processedRecommendations.length < 3 
      ? [...processedRecommendations, ...defaultRecommendations.slice(0, 4 - processedRecommendations.length)]
      : processedRecommendations
    
    console.log('✅ AI推奨生成完了:', {
      推奨件数: finalRecommendations.length,
      高信頼度: finalRecommendations.filter(r => r.is_high_confidence).length
    })
    
    return NextResponse.json({
      success: true,
      data: finalRecommendations,
      work_type: workType
    })

  } catch (error) {
    console.error('❌ AI推奨API内部エラー:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// デフォルト推奨項目を取得（作業種別に基づく）
async function getDefaultRecommendations(supabase: any, workType: string) {
  const workTypeMapping: { [key: string]: string[] } = {
    'fertilizing': ['⑦', '⑬'], // 肥料費、動力光熱費
    'weeding': ['⑬', '⑱'], // 動力光熱費、雇人費
    'harvesting': ['①', '⑰'], // 販売金額、荷造運賃手数料
    'planting': ['⑤', '⑬'], // 種苗費、動力光熱費
    'pruning': ['⑨', '⑬'], // 農具費、動力光熱費
    'watering': ['⑬'], // 動力光熱費
    'seeding': ['⑤', '⑬'] // 種苗費、動力光熱費
  }
  
  const recommendedCodes = workTypeMapping[workType] || ['⑬', '㉓'] // デフォルト: 動力光熱費、雑費
  
  const { data: defaultItems } = await supabase
    .from('accounting_items')
    .select('id, code, name, type, category')
    .in('code', recommendedCodes)
    .eq('is_active', true)
  
  return defaultItems?.map((item: any) => ({
    id: `default-${item.id}`,
    accounting_item: item,
    confidence: 0.5,
    avg_amount: 0,
    usage_count: 0,
    is_high_confidence: false,
    stars: 2,
    is_default: true
  })) || []
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServiceClient()
    const body = await request.json()
    
    const { 
      company_id, 
      work_type, 
      accounting_item_id, 
      amount,
      confidence_score = 0.5 
    } = body
    
    if (!company_id || !work_type || !accounting_item_id) {
      return NextResponse.json(
        { error: 'Required fields missing' },
        { status: 400 }
      )
    }
    
    // 既存の推奨データを更新または新規作成
    const { data: existing } = await supabase
      .from('accounting_recommendations')
      .select('*')
      .eq('company_id', company_id)
      .eq('work_type', work_type)
      .eq('accounting_item_id', accounting_item_id)
      .single()
    
    if (existing) {
      // 既存データの更新（使用回数と平均金額を更新）
      const newUsageCount = existing.usage_count + 1
      const newAvgAmount = ((existing.avg_amount * existing.usage_count) + amount) / newUsageCount
      const newConfidence = Math.min(existing.confidence_score + 0.1, 1.0) // 信頼度を少し上げる
      
      const { error } = await supabase
        .from('accounting_recommendations')
        .update({
          usage_count: newUsageCount,
          avg_amount: newAvgAmount,
          confidence_score: newConfidence,
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
      
      if (error) {
        console.error('❌ 推奨データ更新エラー:', error)
      }
    } else {
      // 新規作成
      const { error } = await supabase
        .from('accounting_recommendations')
        .insert({
          company_id,
          work_type,
          accounting_item_id,
          confidence_score,
          usage_count: 1,
          avg_amount: amount,
          last_used_at: new Date().toISOString()
        })
      
      if (error) {
        console.error('❌ 推奨データ作成エラー:', error)
      }
    }
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('❌ AI推奨学習API内部エラー:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}