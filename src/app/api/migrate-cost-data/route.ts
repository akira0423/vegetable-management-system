import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServiceClient()
    const body = await request.json()
    const { company_id, dry_run = true } = body

    console.log('🔄 コストデータマイグレーション開始:', { company_id, dry_run })

    // Step 1: 既存のwork_reportsからコスト情報を取得
    const { data: workReports, error: reportsError } = await supabase
      .from('work_reports')
      .select('id, notes, work_type, work_date, created_at')
      .eq('company_id', company_id)
      .not('notes', 'is', null)

    if (reportsError) {
      console.error('❌ 作業レポート取得エラー:', reportsError)
      return NextResponse.json(
        { error: 'Failed to fetch work reports', details: reportsError },
        { status: 500 }
      )
    }

    console.log(`📊 取得した作業レポート数: ${workReports?.length || 0}`)

    // Step 2: notesからコスト情報を抽出
    const costDataToMigrate = []
    for (const report of workReports || []) {
      try {
        const notes = typeof report.notes === 'string' ? JSON.parse(report.notes) : report.notes
        if (notes?.estimated_cost && notes.estimated_cost > 0) {
          costDataToMigrate.push({
            work_report_id: report.id,
            original_cost: notes.estimated_cost,
            work_type: report.work_type,
            work_date: report.work_date,
            created_at: report.created_at
          })
        }
      } catch (parseError) {
        console.warn(`⚠️ JSON解析失敗 (report_id: ${report.id}):`, parseError)
      }
    }

    console.log(`💰 変換対象のコストデータ数: ${costDataToMigrate.length}`)

    // Step 3: 会計項目マスタから適切な支出項目を取得
    const { data: accountingItems, error: itemsError } = await supabase
      .from('accounting_items')
      .select('id, code, name, type')
      .eq('type', 'expense')

    if (itemsError) {
      console.error('❌ 会計項目取得エラー:', itemsError)
      return NextResponse.json(
        { error: 'Failed to fetch accounting items', details: itemsError },
        { status: 500 }
      )
    }

    // デフォルト支出項目を決定（「その他費用」または最初の支出項目）
    const defaultExpenseItem = accountingItems?.find(item => 
      item.name.includes('その他') || item.name.includes('費用')
    ) || accountingItems?.[0]

    if (!defaultExpenseItem) {
      return NextResponse.json(
        { error: 'No expense accounting items found' },
        { status: 400 }
      )
    }

    console.log(`📝 使用する会計項目: ${defaultExpenseItem.name} (${defaultExpenseItem.code})`)

    // Step 4: 会計データへの変換準備
    const accountingDataToInsert = costDataToMigrate.map(cost => ({
      work_report_id: cost.work_report_id,
      accounting_item_id: defaultExpenseItem.id,
      amount: cost.original_cost,
      custom_item_name: `レガシーコスト (${cost.work_type})`,
      notes: `旧コスト情報から自動移行 (${cost.work_date})`,
      is_ai_recommended: false
    }))

    // Step 5: Dry Run または実際の実行
    if (dry_run) {
      console.log('🧪 DRY RUN モード - 実際のデータ変更は行いません')
      return NextResponse.json({
        success: true,
        dry_run: true,
        summary: {
          total_reports_checked: workReports?.length || 0,
          cost_data_found: costDataToMigrate.length,
          target_accounting_item: defaultExpenseItem.name,
          sample_conversion: costDataToMigrate.slice(0, 3),
          sample_accounting_data: accountingDataToInsert.slice(0, 3)
        },
        message: 'Migration preview completed successfully'
      })
    }

    // 実際のマイグレーション実行
    console.log('🔥 実際のマイグレーション実行中...')

    // 既存の変換済みデータをチェック
    const { data: existingData } = await supabase
      .from('work_report_accounting')
      .select('work_report_id')
      .in('work_report_id', costDataToMigrate.map(c => c.work_report_id))

    const existingReportIds = existingData?.map(d => d.work_report_id) || []
    const newDataToInsert = accountingDataToInsert.filter(
      item => !existingReportIds.includes(item.work_report_id)
    )

    console.log(`✨ 新規挿入データ数: ${newDataToInsert.length}`)

    if (newDataToInsert.length > 0) {
      const { data: insertedData, error: insertError } = await supabase
        .from('work_report_accounting')
        .insert(newDataToInsert)
        .select()

      if (insertError) {
        console.error('❌ 会計データ挿入エラー:', insertError)
        return NextResponse.json(
          { error: 'Failed to insert accounting data', details: insertError },
          { status: 500 }
        )
      }

      console.log(`✅ ${insertedData?.length || 0}件の会計データを挿入完了`)
    }

    return NextResponse.json({
      success: true,
      dry_run: false,
      summary: {
        total_reports_checked: workReports?.length || 0,
        cost_data_found: costDataToMigrate.length,
        existing_data_skipped: existingReportIds.length,
        new_data_inserted: newDataToInsert.length,
        target_accounting_item: defaultExpenseItem.name
      },
      message: 'Migration completed successfully'
    })

  } catch (error) {
    console.error('❌ マイグレーションエラー:', error)
    return NextResponse.json(
      { error: 'Migration failed', details: error.message },
      { status: 500 }
    )
  }
}