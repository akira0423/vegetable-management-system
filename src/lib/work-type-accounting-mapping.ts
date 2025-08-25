/**
 * 作業種類⇔会計項目マッピングシステム
 * 想定コストを削除し、会計項目との直接リンクを実現
 */

export interface WorkTypeAccountingMapping {
  work_type: string           // 作業種類
  accounting_item_id: string  // デフォルト会計項目ID
  accounting_item_name: string // 会計項目名
  category: string            // 会計カテゴリ
  type: 'income' | 'expense'  // 収入・支出区分
  is_default: boolean         // デフォルト項目か
  priority: number            // 優先度
  is_ai_recommended: boolean  // AI推奨項目か
}

/**
 * 作業種類別デフォルト会計項目マッピング
 * 既存のAIレコメンデーションシステムと統合
 */
export class WorkTypeAccountingMapper {
  
  /**
   * 作業種類から推奨会計項目を取得
   */
  static getDefaultAccountingItems(workType: string): WorkTypeAccountingMapping[] {
    const mappings: { [key: string]: WorkTypeAccountingMapping[] } = {
      // 収穫作業 → 売上系項目
      'harvesting': [
        {
          work_type: 'harvesting',
          accounting_item_id: 'harvest_sales',
          accounting_item_name: '農産物売上',
          category: 'sales',
          type: 'income',
          is_default: true,
          priority: 1,
          is_ai_recommended: true
        }
      ],

      // 施肥作業 → 肥料費
      'fertilizing': [
        {
          work_type: 'fertilizing',
          accounting_item_id: 'fertilizer_cost',
          accounting_item_name: '肥料費',
          category: 'materials',
          type: 'expense',
          is_default: true,
          priority: 1,
          is_ai_recommended: true
        },
        {
          work_type: 'fertilizing',
          accounting_item_id: 'labor_cost',
          accounting_item_name: '人件費',
          category: 'labor',
          type: 'expense',
          is_default: false,
          priority: 2,
          is_ai_recommended: true
        }
      ],

      // 除草作業 → 農薬費・人件費
      'weeding': [
        {
          work_type: 'weeding',
          accounting_item_id: 'pesticide_cost',
          accounting_item_name: '農薬費',
          category: 'materials',
          type: 'expense',
          is_default: true,
          priority: 1,
          is_ai_recommended: true
        },
        {
          work_type: 'weeding',
          accounting_item_id: 'labor_cost',
          accounting_item_name: '人件費',
          category: 'labor',
          type: 'expense',
          is_default: false,
          priority: 2,
          is_ai_recommended: true
        }
      ],

      // 定植作業 → 種苗費・人件費
      'planting': [
        {
          work_type: 'planting',
          accounting_item_id: 'seed_cost',
          accounting_item_name: '種苗費',
          category: 'materials',
          type: 'expense',
          is_default: true,
          priority: 1,
          is_ai_recommended: true
        },
        {
          work_type: 'planting',
          accounting_item_id: 'labor_cost',
          accounting_item_name: '人件費',
          category: 'labor',
          type: 'expense',
          is_default: false,
          priority: 2,
          is_ai_recommended: true
        }
      ],

      // 整枝・剪定 → 人件費・資材費
      'pruning': [
        {
          work_type: 'pruning',
          accounting_item_id: 'labor_cost',
          accounting_item_name: '人件費',
          category: 'labor',
          type: 'expense',
          is_default: true,
          priority: 1,
          is_ai_recommended: true
        },
        {
          work_type: 'pruning',
          accounting_item_id: 'materials_cost',
          accounting_item_name: '資材費',
          category: 'materials',
          type: 'expense',
          is_default: false,
          priority: 2,
          is_ai_recommended: false
        }
      ],

      // 播種作業 → 種苗費・人件費
      'seeding': [
        {
          work_type: 'seeding',
          accounting_item_id: 'seed_cost',
          accounting_item_name: '種苗費',
          category: 'materials',
          type: 'expense',
          is_default: true,
          priority: 1,
          is_ai_recommended: true
        },
        {
          work_type: 'seeding',
          accounting_item_id: 'labor_cost',
          accounting_item_name: '人件費',
          category: 'labor',
          type: 'expense',
          is_default: false,
          priority: 2,
          is_ai_recommended: true
        }
      ],

      // 灌水作業 → 光熱水費・人件費
      'watering': [
        {
          work_type: 'watering',
          accounting_item_id: 'utility_cost',
          accounting_item_name: '光熱水費',
          category: 'utilities',
          type: 'expense',
          is_default: true,
          priority: 1,
          is_ai_recommended: true
        },
        {
          work_type: 'watering',
          accounting_item_id: 'labor_cost',
          accounting_item_name: '人件費',
          category: 'labor',
          type: 'expense',
          is_default: false,
          priority: 2,
          is_ai_recommended: true
        }
      ]
    }

    return mappings[workType] || [
      // デフォルト：人件費のみ
      {
        work_type: workType,
        accounting_item_id: 'labor_cost',
        accounting_item_name: '人件費',
        category: 'labor',
        type: 'expense',
        is_default: true,
        priority: 1,
        is_ai_recommended: false
      }
    ]
  }

  /**
   * 作業種類から主要な会計項目IDを取得（デフォルト項目）
   */
  static getPrimaryAccountingItemId(workType: string): string {
    const mappings = this.getDefaultAccountingItems(workType)
    const primaryMapping = mappings.find(m => m.is_default) || mappings[0]
    return primaryMapping?.accounting_item_id || 'labor_cost'
  }

  /**
   * 作業種類から収入・支出区分を取得
   */
  static getWorkTypeCategory(workType: string): 'income' | 'expense' {
    return workType === 'harvesting' ? 'income' : 'expense'
  }

  /**
   * 労働コスト計算（フォールバック用）
   */
  static calculateLaborCost(
    durationHours: number, 
    workerCount: number, 
    hourlyRate: number
  ): number {
    return durationHours * workerCount * hourlyRate
  }

  /**
   * 作業レポートから会計データを自動生成
   */
  static generateAccountingFromWorkReport(workReport: {
    work_type: string
    duration_hours?: number
    worker_count?: number
    harvest_amount?: number
    expected_price?: number
  }, hourlyRate: number = 1000): {
    accounting_item_id: string
    amount: number
    custom_item_name: string
    is_ai_recommended: boolean
  }[] {
    const mappings = this.getDefaultAccountingItems(workReport.work_type)
    const results = []

    for (const mapping of mappings) {
      let amount = 0

      if (mapping.type === 'income' && workReport.work_type === 'harvesting') {
        // 収穫売上の計算
        amount = (workReport.harvest_amount || 0) * (workReport.expected_price || 0)
      } else if (mapping.category === 'labor') {
        // 労働コストの計算
        amount = this.calculateLaborCost(
          workReport.duration_hours || 0,
          workReport.worker_count || 1,
          hourlyRate
        )
      }
      // 材料費などはユーザーが手動入力（会計記録で）

      if (amount > 0 || mapping.is_default) {
        results.push({
          accounting_item_id: mapping.accounting_item_id,
          amount: mapping.type === 'expense' ? -Math.abs(amount) : amount,
          custom_item_name: mapping.accounting_item_name,
          is_ai_recommended: mapping.is_ai_recommended
        })
      }
    }

    return results
  }
}

/**
 * 作業種類の日本語名マッピング
 */
export const WORK_TYPE_JAPANESE_NAMES = {
  'harvesting': '収穫',
  'fertilizing': '施肥',
  'weeding': '除草',
  'planting': '定植',
  'pruning': '整枝・剪定',
  'seeding': '播種',
  'watering': '灌水'
} as const

/**
 * 作業種類の色設定（UI用）
 */
export const WORK_TYPE_COLORS = {
  'harvesting': '#10b981',  // エメラルド（収入）
  'fertilizing': '#2563eb', // ブルー
  'weeding': '#d97706',     // アンバー
  'planting': '#7c3aed',    // バイオレット
  'pruning': '#dc2626',     // レッド
  'seeding': '#0891b2',     // シアン
  'watering': '#65a30d'     // ライム
} as const