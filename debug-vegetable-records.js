// Supabaseの野菜レコードを確認するデバッグスクリプト
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://zlmgovfdxqebiuslqifq.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsbWdvdmZkeHFlYml1c2xxaWZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQzMzkzNTgsImV4cCI6MjA0OTkxNTM1OH0.w4vJWIagtHLNZjNfLXMXLxJv3fLCu6fVQ8WZ_uRz8-M'

const supabase = createClient(supabaseUrl, supabaseKey)

async function debugVegetableRecords() {
  console.log('🔍 野菜レコードの調査を開始...')
  
  try {
    // 1. 全ての野菜レコードを取得
    console.log('\n📊 全野菜レコードを確認:')
    const { data: allVegetables, error: allError } = await supabase
      .from('vegetables')
      .select('id, name, variety_name, plot_name, created_at')
      .order('created_at', { ascending: false })

    if (allError) {
      console.error('❌ 全レコード取得エラー:', allError)
    } else {
      console.log(`✅ 総レコード数: ${allVegetables.length}`)
      allVegetables.forEach((veg, index) => {
        console.log(`${index + 1}. ID: ${veg.id}`)
        console.log(`   名前: ${veg.name}`)
        console.log(`   品種: ${veg.variety_name}`)
        console.log(`   区画: ${veg.plot_name}`)
        console.log(`   作成日: ${veg.created_at}`)
        console.log('')
      })
    }

    // 2. 問題のIDを直接検索
    const problemId = 'eb03336c-1a80-4b32-85e0-7ce8a5605238'
    console.log(`\n🎯 問題のID「${problemId}」を直接検索:`)
    
    const { data: specificVeg, error: specificError } = await supabase
      .from('vegetables')
      .select('*')
      .eq('id', problemId)
      .maybeSingle()

    if (specificError) {
      console.error('❌ 特定ID検索エラー:', specificError)
    } else if (specificVeg) {
      console.log('✅ レコードが見つかりました:')
      console.log(JSON.stringify(specificVeg, null, 2))
    } else {
      console.log('❌ 指定されたIDのレコードは存在しません')
    }

    // 3. 最近作成された野菜レコードを確認
    console.log('\n📅 最近作成された野菜レコード (上位5件):')
    const { data: recentVegs, error: recentError } = await supabase
      .from('vegetables')
      .select('id, name, variety_name, created_at, custom_fields')
      .order('created_at', { ascending: false })
      .limit(5)

    if (recentError) {
      console.error('❌ 最近のレコード取得エラー:', recentError)
    } else {
      recentVegs.forEach((veg, index) => {
        console.log(`${index + 1}. ID: ${veg.id}`)
        console.log(`   名前: ${veg.name}`)
        console.log(`   作成日: ${veg.created_at}`)
        console.log(`   空間データ有無: ${veg.custom_fields?.has_spatial_data || false}`)
        console.log('')
      })
    }

    // 4. 会社IDでフィルタリングしたレコード確認
    console.log('\n🏢 company_id で絞り込んだレコード:')
    const { data: companyVegs, error: companyError } = await supabase
      .from('vegetables')
      .select('id, name, variety_name, company_id')
      .eq('company_id', 'a1111111-1111-1111-1111-111111111111')

    if (companyError) {
      console.error('❌ 会社IDフィルタエラー:', companyError)
    } else {
      console.log(`✅ 該当する会社の野菜レコード数: ${companyVegs.length}`)
      companyVegs.forEach((veg, index) => {
        console.log(`${index + 1}. ID: ${veg.id}, 名前: ${veg.name}`)
      })
    }

  } catch (error) {
    console.error('💥 予期しないエラー:', error)
  }
}

// 実行
debugVegetableRecords()
  .then(() => {
    console.log('\n✅ デバッグ調査完了')
    process.exit(0)
  })
  .catch(error => {
    console.error('💥 デバッグスクリプト実行エラー:', error)
    process.exit(1)
  })