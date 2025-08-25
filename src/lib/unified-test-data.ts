/**
 * 統合テストデータセット
 * 全ページで整合性の取れたサンプルデータを提供
 */

export interface UnifiedTestData {
  vegetables: Vegetable[]
  workReports: WorkReport[]
  tasks: GanttTask[]
  users: User[]
}

export interface Vegetable {
  id: string
  name: string
  variety: string
  plot_name: string
  plot_size: number // m²
  status: string
  planting_date: string
}

export interface WorkReport {
  id: string
  work_date: string
  work_type: 'seeding' | 'planting' | 'fertilizing' | 'watering' | 'weeding' | 'pruning' | 'harvesting' | 'other'
  vegetable_id: string
  work_notes: string
  
  // 量・単位
  work_amount?: number
  work_unit?: string
  
  
  // 肥料情報
  fertilizer_type?: string
  fertilizer_amount?: number
  fertilizer_unit?: string
  
  // 収穫情報
  harvest_amount?: number
  harvest_unit?: string
  harvest_quality?: 'excellent' | 'good' | 'average' | 'poor'
  expected_price?: number
  expected_revenue?: number
  
  // 天候・環境
  weather?: 'sunny' | 'cloudy' | 'rainy' | 'windy'
  temperature_morning?: number
  temperature_afternoon?: number
  
  // 作業情報
  work_duration?: number // 分
  worker_count?: number
  created_by: string
}

export interface GanttTask {
  id: string
  name: string
  start: string
  end: string
  progress: number
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high'
  vegetable: {
    id: string
    name: string
    variety: string
  }
  assignedUser: {
    id: string
    name: string
  }
  description?: string
  color?: string
}

export interface User {
  id: string
  name: string
  role: string
}

// 統合テストデータ（整合性を保証）
export const unifiedTestData: UnifiedTestData = {
  // 野菜マスターデータ（UUID形式のIDで本格運用対応）
  vegetables: [
    {
      id: '11111111-2222-3333-4444-555555555501', // v1のUUID版
      name: 'A棟トマト（桃太郎）',
      variety: '桃太郎',
      plot_name: 'A棟温室',
      plot_size: 120, // m²
      status: 'growing',
      planting_date: '2024-03-16'
    },
    {
      id: '11111111-2222-3333-4444-555555555502', // v2のUUID版
      name: 'B棟キュウリ（四葉）',
      variety: '四葉',
      plot_name: 'B棟温室',
      plot_size: 100, // m²
      status: 'growing',
      planting_date: '2024-04-01'
    },
    {
      id: '11111111-2222-3333-4444-555555555503', // v3のUUID版
      name: '露地レタス（春作）',
      variety: 'グリーンリーフ', 
      plot_name: '露地第1圃場',
      plot_size: 80, // m²
      status: 'planning',
      planting_date: '2024-09-01'
    }
  ],

  // ユーザーマスターデータ（UUID形式のIDで本格運用対応）
  users: [
    { id: '22222222-3333-4444-5555-666666666601', name: '田中太郎', role: '作業主任' }, // u1のUUID版
    { id: '22222222-3333-4444-5555-666666666602', name: '佐藤花子', role: '栽培技術者' }, // u2のUUID版
    { id: '22222222-3333-4444-5555-666666666603', name: '山田次郎', role: '作業員' } // u3のUUID版
  ],

  // 作業レポートデータ（実際の作業に基づく）
  workReports: [
    // === トマト（v1）の作業履歴 ===
    {
      id: 'wr1',
      work_date: '2024-03-01',
      work_type: 'seeding',
      vegetable_id: '11111111-2222-3333-4444-555555555501', // v1のUUID版
      work_notes: 'トマトの播種作業。種子200粒使用。',
      work_amount: 0.2,
      work_unit: 'kg',
      : 3200,
      work_duration: 180,
      worker_count: 2,
      weather: 'sunny',
      temperature_morning: 15,
      temperature_afternoon: 22,
      created_by: '22222222-3333-4444-5555-666666666601' // u1のUUID版
    },
    {
      id: 'wr2',
      work_date: '2024-03-16',
      work_type: 'planting',
      vegetable_id: '11111111-2222-3333-4444-555555555501', // v1のUUID版
      work_notes: 'トマト苗の定植作業。120株定植完了。',
      work_amount: 120,
      work_unit: '株',
      : 8400,
      work_duration: 240,
      worker_count: 3,
      weather: 'cloudy',
      temperature_morning: 18,
      temperature_afternoon: 24,
      created_by: '22222222-3333-4444-5555-666666666602' // u2のUUID版
    },
    {
      id: 'wr3',
      work_date: '2024-04-15',
      work_type: 'fertilizing',
      vegetable_id: '11111111-2222-3333-4444-555555555501', // v1のUUID版
      work_notes: 'トマト追肥作業。化成肥料散布。',
      fertilizer_type: '化成肥料8-8-8',
      fertilizer_amount: 15,
      fertilizer_unit: 'kg',
      : 4500,
      work_duration: 90,
      worker_count: 1,
      weather: 'sunny',
      created_by: '22222222-3333-4444-5555-666666666603' // u3のUUID版
    },
    {
      id: 'wr4',
      work_date: '2024-05-20',
      work_type: 'pruning',
      vegetable_id: '11111111-2222-3333-4444-555555555501', // v1のUUID版
      work_notes: 'トマト整枝・摘芽作業。わき芽除去。',
      : 2800,
      work_duration: 150,
      worker_count: 2,
      weather: 'sunny',
      temperature_morning: 20,
      temperature_afternoon: 28,
      created_by: '22222222-3333-4444-5555-666666666602' // u2のUUID版
    },
    {
      id: 'wr5',
      work_date: '2024-06-25',
      work_type: 'harvesting',
      vegetable_id: '11111111-2222-3333-4444-555555555501', // v1のUUID版
      work_notes: 'トマト初回収穫。品質良好。',
      harvest_amount: 45.2,
      harvest_unit: 'kg',
      harvest_quality: 'excellent',
      expected_price: 350,
      expected_revenue: 15820,
      work_duration: 120,
      worker_count: 2,
      weather: 'sunny',
      temperature_morning: 22,
      temperature_afternoon: 30,
      created_by: '22222222-3333-4444-5555-666666666601' // u1のUUID版
    },
    {
      id: 'wr6',
      work_date: '2024-07-10',
      work_type: 'harvesting',
      vegetable_id: '11111111-2222-3333-4444-555555555501', // v1のUUID版
      work_notes: 'トマト2回目収穫。収量安定。',
      harvest_amount: 52.8,
      harvest_unit: 'kg',
      harvest_quality: 'excellent',
      expected_price: 350,
      expected_revenue: 18480,
      work_duration: 135,
      worker_count: 2,
      weather: 'cloudy',
      temperature_morning: 24,
      temperature_afternoon: 32,
      created_by: '22222222-3333-4444-5555-666666666601' // u1のUUID版
    },
    {
      id: 'wr7',
      work_date: '2024-08-05',
      work_type: 'harvesting',
      vegetable_id: '11111111-2222-3333-4444-555555555501', // v1のUUID版
      work_notes: 'トマト3回目収穫。最盛期。',
      harvest_amount: 68.5,
      harvest_unit: 'kg',
      harvest_quality: 'good',
      expected_price: 320,
      expected_revenue: 21920,
      work_duration: 150,
      worker_count: 2,
      weather: 'sunny',
      temperature_morning: 26,
      temperature_afternoon: 35,
      created_by: '22222222-3333-4444-5555-666666666601' // u1のUUID版
    },

    // === キュウリ（v2）の作業履歴 ===
    {
      id: 'wr8',
      work_date: '2024-03-15',
      work_type: 'seeding',
      vegetable_id: '11111111-2222-3333-4444-555555555502', // v2のUUID版
      work_notes: 'キュウリの播種作業。',
      work_amount: 0.15,
      work_unit: 'kg',
      : 2800,
      work_duration: 120,
      worker_count: 1,
      weather: 'sunny',
      created_by: '22222222-3333-4444-5555-666666666603' // u3のUUID版
    },
    {
      id: 'wr9',
      work_date: '2024-04-01',
      work_type: 'planting',
      vegetable_id: '11111111-2222-3333-4444-555555555502', // v2のUUID版
      work_notes: 'キュウリ苗の定植作業。100株定植。',
      work_amount: 100,
      work_unit: '株',
      : 6800,
      work_duration: 200,
      worker_count: 2,
      weather: 'cloudy',
      created_by: '22222222-3333-4444-5555-666666666602' // u2のUUID版
    },
    {
      id: 'wr10',
      work_date: '2024-05-10',
      work_type: 'fertilizing',
      vegetable_id: '11111111-2222-3333-4444-555555555502', // v2のUUID版
      work_notes: 'キュウリ追肥作業。液肥散布。',
      fertilizer_type: 'ハイポネックス液肥',
      fertilizer_amount: 8,
      fertilizer_unit: 'L',
      : 3200,
      work_duration: 75,
      worker_count: 1,
      weather: 'sunny',
      created_by: '22222222-3333-4444-5555-666666666603' // u3のUUID版
    },
    {
      id: 'wr11',
      work_date: '2024-06-01',
      work_type: 'pruning',
      vegetable_id: '11111111-2222-3333-4444-555555555502', // v2のUUID版
      work_notes: 'キュウリ整枝・誘引作業。',
      : 2400,
      work_duration: 130,
      worker_count: 2,
      weather: 'sunny',
      created_by: '22222222-3333-4444-5555-666666666602' // u2のUUID版
    },
    {
      id: 'wr12',
      work_date: '2024-06-20',
      work_type: 'harvesting',
      vegetable_id: '11111111-2222-3333-4444-555555555502', // v2のUUID版
      work_notes: 'キュウリ初回収穫。形状良好。',
      harvest_amount: 38.6,
      harvest_unit: 'kg',
      harvest_quality: 'good',
      expected_price: 280,
      expected_revenue: 10808,
      work_duration: 100,
      worker_count: 2,
      weather: 'sunny',
      created_by: '22222222-3333-4444-5555-666666666601' // u1のUUID版
    },
    {
      id: 'wr13',
      work_date: '2024-07-05',
      work_type: 'harvesting',
      vegetable_id: '11111111-2222-3333-4444-555555555502', // v2のUUID版
      work_notes: 'キュウリ2回目収穫。',
      harvest_amount: 42.3,
      harvest_unit: 'kg',
      harvest_quality: 'good',
      expected_price: 280,
      expected_revenue: 11844,
      work_duration: 110,
      worker_count: 2,
      weather: 'cloudy',
      created_by: '22222222-3333-4444-5555-666666666601' // u1のUUID版
    },

    // === レタス（v3）の作業履歴（少量・計画中） ===
    {
      id: 'wr14',
      work_date: '2024-08-20',
      work_type: 'fertilizing',
      vegetable_id: '11111111-2222-3333-4444-555555555503', // v3のUUID版
      work_notes: 'レタス圃場の土壌改良。堆肥投入。',
      fertilizer_type: '完熟堆肥',
      fertilizer_amount: 200,
      fertilizer_unit: 'kg',
      : 5200,
      work_duration: 180,
      worker_count: 2,
      weather: 'sunny',
      created_by: '22222222-3333-4444-5555-666666666603' // u3のUUID版
    }
  ],

  // ガントチャートタスク（UUID形式のIDで作業レポートと連動）
  tasks: [
    // === トマト（v1）のタスク ===
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: '播種・育苗',
      start: '2024-03-01',
      end: '2024-03-15',
      progress: 100,
      status: 'completed',
      priority: 'high',
      vegetable: { id: '11111111-2222-3333-4444-555555555501', name: 'A棟トマト（桃太郎）', variety: '桃太郎' },
      assignedUser: { id: '22222222-3333-4444-5555-666666666601', name: '田中太郎' },
      color: '#10b981'
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440002',
      name: '定植',
      start: '2024-03-16',
      end: '2024-03-20',
      progress: 100,
      status: 'completed', 
      priority: 'high',
      vegetable: { id: '11111111-2222-3333-4444-555555555501', name: 'A棟トマト（桃太郎）', variety: '桃太郎' },
      assignedUser: { id: '22222222-3333-4444-5555-666666666602', name: '佐藤花子' },
      color: '#10b981'
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440003',
      name: '整枝・摘芽',
      start: '2024-03-21',
      end: '2024-08-31',
      progress: 85,
      status: 'in_progress',
      priority: 'medium',
      vegetable: { id: '11111111-2222-3333-4444-555555555501', name: 'A棟トマト（桃太郎）', variety: '桃太郎' },
      assignedUser: { id: '22222222-3333-4444-5555-666666666602', name: '佐藤花子' },
      color: '#3b82f6'
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440004',
      name: '収穫',
      start: '2024-06-25',
      end: '2024-09-30',
      progress: 60,
      status: 'in_progress',
      priority: 'high',
      vegetable: { id: '11111111-2222-3333-4444-555555555501', name: 'A棟トマト（桃太郎）', variety: '桃太郎' },
      assignedUser: { id: '22222222-3333-4444-5555-666666666601', name: '田中太郎' },
      color: '#3b82f6'
    },

    // === キュウリ（v2）のタスク ===
    {
      id: '550e8400-e29b-41d4-a716-446655440005',
      name: '播種・育苗',
      start: '2024-03-15',
      end: '2024-03-31',
      progress: 100,
      status: 'completed',
      priority: 'medium',
      vegetable: { id: '11111111-2222-3333-4444-555555555502', name: 'B棟キュウリ（四葉）', variety: '四葉' },
      assignedUser: { id: '22222222-3333-4444-5555-666666666603', name: '山田次郎' },
      color: '#10b981'
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440006',
      name: '定植',
      start: '2024-04-01',
      end: '2024-04-05',
      progress: 100,
      status: 'completed',
      priority: 'high',
      vegetable: { id: '11111111-2222-3333-4444-555555555502', name: 'B棟キュウリ（四葉）', variety: '四葉' },
      assignedUser: { id: '22222222-3333-4444-5555-666666666602', name: '佐藤花子' },
      color: '#10b981'
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440007',
      name: '整枝・摘芽',
      start: '2024-04-06',
      end: '2024-07-31',
      progress: 90,
      status: 'in_progress',
      priority: 'medium',
      vegetable: { id: '11111111-2222-3333-4444-555555555502', name: 'B棟キュウリ（四葉）', variety: '四葉' },
      assignedUser: { id: '22222222-3333-4444-5555-666666666602', name: '佐藤花子' },
      color: '#3b82f6'
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440008',
      name: '収穫',
      start: '2024-06-20',
      end: '2024-08-31',
      progress: 70,
      status: 'in_progress',
      priority: 'high',
      vegetable: { id: '11111111-2222-3333-4444-555555555502', name: 'B棟キュウリ（四葉）', variety: '四葉' },
      assignedUser: { id: '22222222-3333-4444-5555-666666666601', name: '田中太郎' },
      color: '#3b82f6'
    },

    // === レタス（v3）のタスク ===
    {
      id: '550e8400-e29b-41d4-a716-446655440009',
      name: '施肥',
      start: '2024-08-20',
      end: '2024-08-25',
      progress: 100,
      status: 'completed',
      priority: 'low',
      vegetable: { id: '11111111-2222-3333-4444-555555555503', name: '露地レタス（春作）', variety: 'グリーンリーフ' },
      assignedUser: { id: '22222222-3333-4444-5555-666666666603', name: '山田次郎' },
      color: '#10b981'
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440010',
      name: '播種・育苗',
      start: '2024-09-01',
      end: '2024-09-15',
      progress: 0,
      status: 'pending',
      priority: 'medium',
      vegetable: { id: '11111111-2222-3333-4444-555555555503', name: '露地レタス（春作）', variety: 'グリーンリーフ' },
      assignedUser: { id: '22222222-3333-4444-5555-666666666601', name: '田中太郎' },
      color: '#6b7280'
    }
  ]
}

// 統計計算ユーティリティ
export const calculateUnifiedStats = () => {
  const { vegetables, workReports } = unifiedTestData

  // 野菜別統計計算
  const vegetableStats = vegetables.map(vegetable => {
    const vegReports = workReports.filter(r => r.vegetable_id === vegetable.id)
    
    // 会計データからコスト計算（会計記録がない場合は0）
    const totalCost = 0 // TODO: 会計データベースから取得
    
    const totalRevenue = vegReports
      .filter(r => r.expected_revenue)
      .reduce((sum, r) => sum + r.expected_revenue!, 0)
    
    const totalHarvest = vegReports
      .filter(r => r.harvest_amount)
      .reduce((sum, r) => sum + r.harvest_amount!, 0)
    
    const profit = totalRevenue - totalCost
    const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0
    const yieldPerSqm = totalHarvest / vegetable.plot_size

    return {
      vegetable,
      totalCost,
      totalRevenue, 
      totalHarvest,
      profit,
      roi,
      yieldPerSqm
    }
  })

  // 全体統計
  const totalStats = {
    totalArea: vegetables.reduce((sum, v) => sum + v.plot_size, 0),
    totalCost: vegetableStats.reduce((sum, v) => sum + v.totalCost, 0),
    totalRevenue: vegetableStats.reduce((sum, v) => sum + v.totalRevenue, 0),
    totalHarvest: vegetableStats.reduce((sum, v) => sum + v.totalHarvest, 0),
    totalProfit: vegetableStats.reduce((sum, v) => sum + v.profit, 0),
    averageROI: vegetableStats.reduce((sum, v) => sum + v.roi, 0) / vegetableStats.length,
    averageYield: vegetableStats.reduce((sum, v) => sum + v.yieldPerSqm, 0) / vegetableStats.length
  }

  return { vegetableStats, totalStats }
}

// データ検証ユーティリティ
export const validateDataIntegrity = (): boolean => {
  const { vegetables, workReports, tasks } = unifiedTestData
  
  // 全ての作業レポートが有効な野菜IDを参照しているか
  const vegetableIds = new Set(vegetables.map(v => v.id))
  const reportsValid = workReports.every(r => vegetableIds.has(r.vegetable_id))
  
  // 全てのタスクが有効な野菜IDを参照しているか  
  const tasksValid = tasks.every(t => vegetableIds.has(t.vegetable.id))
  
  console.log('データ整合性検証:', {
    野菜数: vegetables.length,
    作業レポート数: workReports.length,
    タスク数: tasks.length,
    レポート参照整合性: reportsValid,
    タスク参照整合性: tasksValid
  })
  
  return reportsValid && tasksValid
}