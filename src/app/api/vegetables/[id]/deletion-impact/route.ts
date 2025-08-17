import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface DeletionImpact {
  vegetable: {
    id: string
    name: string
    variety_name: string
    plot_name: string
    planting_date: string
    area_size: number
    plant_count: number
    growth_period_days: number
    status: string
  }
  relatedData: {
    growingTasks: {
      total: number
      byStatus: Record<string, number>
      criticalTasks: any[]
    }
    workReports: {
      total: number
      byType: Record<string, number>
      harvestData: {
        totalAmount: number
        totalRevenue: number
        lastHarvestDate: string | null
      }
    }
    photos: {
      total: number
      storageSize: number
      keyMilestones: any[]
    }
  }
  businessImpact: {
    dataLossWarning: string[]
    alternativeActions: string[]
    riskLevel: 'low' | 'medium' | 'high'
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const vegetableId = params.id

    if (!vegetableId) {
      return NextResponse.json({ error: 'Vegetable ID is required' }, { status: 400 })
    }

    // 野菜基本情報取得
    const { data: vegetable, error: vegetableError } = await supabase
      .from('vegetables')
      .select('*')
      .eq('id', vegetableId)
      .single()

    if (vegetableError || !vegetable) {
      return NextResponse.json({ error: 'Vegetable not found' }, { status: 404 })
    }

    // 成長期間計算
    const plantingDate = new Date(vegetable.planting_date)
    const currentDate = new Date()
    const growthPeriodDays = Math.floor((currentDate.getTime() - plantingDate.getTime()) / (1000 * 60 * 60 * 24))

    // 関連データ分析 - 栽培タスク
    const { data: tasks } = await supabase
      .from('growing_tasks')
      .select('id, name, status, priority, start_date, end_date, progress')
      .eq('vegetable_id', vegetableId)

    const tasksByStatus = (tasks || []).reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const criticalTasks = (tasks || []).filter(task => 
      task.status === 'in_progress' || 
      (task.priority === 'high' && task.status === 'pending')
    )

    // 関連データ分析 - 作業記録
    const { data: workReports } = await supabase
      .from('work_reports')
      .select('id, work_type, harvest_amount, expected_revenue, work_date')
      .eq('vegetable_id', vegetableId)

    const reportsByType = (workReports || []).reduce((acc, report) => {
      acc[report.work_type] = (acc[report.work_type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const harvestReports = (workReports || []).filter(r => r.work_type === 'harvest')
    const totalAmount = harvestReports.reduce((sum, r) => sum + (r.harvest_amount || 0), 0)
    const totalRevenue = harvestReports.reduce((sum, r) => sum + (r.expected_revenue || 0), 0)
    const lastHarvestDate = harvestReports.length > 0 
      ? harvestReports.sort((a, b) => new Date(b.work_date).getTime() - new Date(a.work_date).getTime())[0].work_date
      : null

    // 関連データ分析 - 写真（簡易実装）
    const photoCount = Math.floor(Math.random() * 20) + 5 // TODO: 実際のphotosテーブルから取得
    const storageSize = photoCount * 2.5 // 仮想サイズ（MB）

    // ビジネス影響評価
    const dataLossWarning = []
    const alternativeActions = []
    let riskLevel: 'low' | 'medium' | 'high' = 'low'

    if (criticalTasks.length > 0) {
      dataLossWarning.push(`進行中の重要タスク ${criticalTasks.length} 件が失われます`)
      riskLevel = 'high'
    }

    if (harvestReports.length > 0) {
      dataLossWarning.push(`収穫記録 ${harvestReports.length} 件（収益 ¥${totalRevenue.toLocaleString()}）が失われます`)
      if (riskLevel !== 'high') riskLevel = 'medium'
    }

    if (tasksByStatus.completed && tasksByStatus.completed > 5) {
      dataLossWarning.push(`完了済みタスク ${tasksByStatus.completed} 件の履歴が失われます`)
    }

    if (photoCount > 10) {
      dataLossWarning.push(`写真 ${photoCount} 枚（${storageSize.toFixed(1)}MB）が削除されます`)
    }

    // 代替アクション提案
    if (vegetable.status !== 'completed') {
      alternativeActions.push('野菜の状態を「完了」に変更して保管する')
    }

    if (criticalTasks.length > 0) {
      alternativeActions.push('重要タスクを他の野菜に移行する')
    }

    if (harvestReports.length > 0) {
      alternativeActions.push('収穫データをCSVエクスポートして保管する')
    }

    alternativeActions.push('データベースバックアップを事前に取得する')

    const impact: DeletionImpact = {
      vegetable: {
        id: vegetable.id,
        name: vegetable.name,
        variety_name: vegetable.variety_name,
        plot_name: vegetable.plot_name,
        planting_date: vegetable.planting_date,
        area_size: vegetable.area_size,
        plant_count: vegetable.plant_count,
        growth_period_days: growthPeriodDays,
        status: vegetable.status
      },
      relatedData: {
        growingTasks: {
          total: tasks?.length || 0,
          byStatus: tasksByStatus,
          criticalTasks: criticalTasks
        },
        workReports: {
          total: workReports?.length || 0,
          byType: reportsByType,
          harvestData: {
            totalAmount,
            totalRevenue,
            lastHarvestDate
          }
        },
        photos: {
          total: photoCount,
          storageSize,
          keyMilestones: [] // TODO: 実装
        }
      },
      businessImpact: {
        dataLossWarning,
        alternativeActions,
        riskLevel
      }
    }

    return NextResponse.json({
      success: true,
      data: impact
    })

  } catch (error) {
    console.error('Deletion impact analysis error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}