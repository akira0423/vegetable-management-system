import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createServiceClient()
    
    // 各テーブルのデータ数と最初の数件を取得
    const [companiesResult, vegetablesResult, workReportsResult] = await Promise.all([
      supabase
        .from('companies')
        .select('id, name')
        .limit(10),
      supabase
        .from('vegetables')
        .select('*')
        .limit(5),
      supabase
        .from('work_reports')
        .select('*')
        .limit(5)
    ])

    // company_id別のwork_reports分布も確認
    const companyDistribution = await supabase
      .from('work_reports')
      .select('company_id')
      .then(result => {
        const counts: { [key: string]: number } = {}
        result.data?.forEach((row: any) => {
          counts[row.company_id] = (counts[row.company_id] || 0) + 1
        })
        return counts
      })

    // 各テーブルの総数を取得
    const [companiesCount, vegetablesCount, workReportsCount] = await Promise.all([
      supabase
        .from('companies')
        .select('*', { count: 'exact', head: true }),
      supabase
        .from('vegetables')
        .select('*', { count: 'exact', head: true }),
      supabase
        .from('work_reports')
        .select('*', { count: 'exact', head: true })
    ])

    return NextResponse.json({
      success: true,
      debug_info: {
        company_distribution: companyDistribution,
        tables: {
          companies: {
            count: companiesCount.count,
            sample_data: companiesResult.data,
            error: companiesResult.error
          },
          vegetables: {
            count: vegetablesCount.count,
            sample_data: vegetablesResult.data,
            error: vegetablesResult.error
          },
          work_reports: {
            count: workReportsCount.count,
            sample_data: workReportsResult.data,
            error: workReportsResult.error
          }
        }
      }
    })

  } catch (error) {
    console.error('Debug API error:', error)
    return NextResponse.json(
      { error: 'Debug API failed', details: error.message },
      { status: 500 }
    )
  }
}