'use server'

import { NextResponse } from 'next/server'

// POST /api/create-test-vegetable - テスト用野菜レコード作成
export async function POST() {
  try {
    console.log('🌱 テスト用野菜レコードを作成します...')
    
    const testVegetableData = {
      name: 'テスト用トマト（編集可能）',
      variety_name: '桃太郎',
      plot_name: 'A区画',
      area_size: 100.5,
      planting_date: '2025-01-15',
      expected_harvest_start: '2025-04-15',
      expected_harvest_end: '2025-06-30',
      status: 'planning',
      notes: '編集機能テスト用のレコードです。自由に編集してください。',
      company_id: 'a1111111-1111-1111-1111-111111111111'
    }

    // シンプルAPIを使用してテスト野菜を作成
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const createResponse = await fetch(`${baseUrl}/api/vegetables-simple`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testVegetableData)
    })
    
    const createResult = await createResponse.json()
    
    if (!createResponse.ok || !createResult.success) {
      throw new Error(createResult.error || 'テスト野菜作成APIエラー')
    }

    console.log('✅ テスト用野菜レコードの作成成功:', createResult.data.id)

    return NextResponse.json({
      success: true,
      data: createResult.data,
      message: 'テスト用野菜レコードを作成しました',
      instructions: [
        '1. 農地編集ページをリロード',
        '2. 「栽培野菜確認」リストでこの野菜を見つける',
        '3. 「詳細確認」→「編集」→データを変更→「保存」', 
        '4. 正常に保存されることを確認'
      ]
    })

  } catch (error) {
    console.error('💥 予期しないエラー:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '予期しないエラーが発生しました'
      },
      { status: 500 }
    )
  }
}