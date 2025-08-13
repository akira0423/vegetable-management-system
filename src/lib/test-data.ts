// テスト用のダミーデータとヘルパー関数

export const testVegetables = [
  {
    id: 'test-1',
    name: 'A棟トマト（桃太郎）',
    variety_name: '桃太郎',
    plot_name: 'A棟温室',
    area_size: 100.0,
    plant_count: 50,
    planting_date: '2024-03-01',
    expected_harvest_start: '2024-06-10',
    expected_harvest_end: '2024-08-31',
    status: 'growing',
    variety: {
      name: 'トマト',
      variety: '桃太郎',
      category: '果菜類'
    }
  },
  {
    id: 'test-2',
    name: 'B棟キュウリ（四葉）',
    variety_name: '四葉',
    plot_name: 'B棟温室',
    area_size: 80.0,
    plant_count: 40,
    planting_date: '2024-03-15',
    expected_harvest_start: '2024-05-20',
    expected_harvest_end: '2024-07-15',
    status: 'growing',
    variety: {
      name: 'キュウリ',
      variety: '四葉',
      category: '果菜類'
    }
  }
]

export const useTestMode = () => {
  const isTestMode = process.env.NODE_ENV === 'development'
  return { isTestMode, testVegetables }
}