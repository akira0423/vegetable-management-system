// 編集機能テスト用の野菜レコードを作成
const fetch = require('node-fetch')

async function createTestVegetable() {
  console.log('🌱 テスト用野菜レコードを作成します...')
  
  const testVegetableData = {
    name: 'テスト用トマト',
    variety_name: '桃太郎',
    plot_name: 'A区画',
    area_size: 100.5,
    planting_date: '2025-01-15',
    expected_harvest_start: '2025-04-15',
    expected_harvest_end: '2025-06-30',
    status: 'planning',
    notes: '編集機能テスト用のレコードです',
    company_id: 'a1111111-1111-1111-1111-111111111111',
    created_by: '11111111-1111-1111-1111-111111111111'
  }

  try {
    const response = await fetch('http://localhost:3000/api/vegetables', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testVegetableData)
    })

    const result = await response.json()
    
    if (response.ok && result.success) {
      console.log('✅ テスト用野菜レコードの作成成功!')
      console.log('作成されたID:', result.data.id)
      console.log('野菜名:', result.data.name)
      console.log('この野菜で編集機能をテストしてください。')
      
      return result.data
    } else {
      console.error('❌ 作成失敗:', result.error)
      return null
    }
    
  } catch (error) {
    console.error('💥 リクエストエラー:', error.message)
    return null
  }
}

// 実行
createTestVegetable()
  .then(data => {
    if (data) {
      console.log('\n🎯 次の手順で編集機能をテストしてください:')
      console.log('1. ブラウザで農地編集ページを開く')
      console.log('2. 「栽培野菜確認」リストでこの野菜を見つける')
      console.log('3. 「詳細確認」→「編集」→データを変更→「保存」')
      console.log('4. 正常に保存されることを確認')
    }
    process.exit(data ? 0 : 1)
  })
  .catch(error => {
    console.error('予期しないエラー:', error)
    process.exit(1)
  })