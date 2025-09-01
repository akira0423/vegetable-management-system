import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // 環境変数確認
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const nodeEnv = process.env.NODE_ENV

    console.log('Environment check:', {
      hasUrl: !!supabaseUrl,
      hasAnonKey: !!supabaseAnonKey,
      nodeEnv,
      urlPrefix: supabaseUrl?.substring(0, 20)
    })

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({
        success: false,
        error: 'Missing environment variables',
        details: {
          hasUrl: !!supabaseUrl,
          hasAnonKey: !!supabaseAnonKey,
          nodeEnv
        }
      }, { status: 500 })
    }

    // Supabaseクライアント動的インポート
    const { createClient } = await import('@supabase/supabase-js')
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // 基本的な接続テスト
    const { data, error } = await supabase
      .from('vegetables')
      .select('id, name')
      .limit(5)

    if (error) {
      console.error('Supabase query error:', error)
      return NextResponse.json({
        success: false,
        error: 'Database query failed',
        details: error,
        environment: {
          nodeEnv,
          hasUrl: !!supabaseUrl,
          hasAnonKey: !!supabaseAnonKey
        }
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      dataCount: data?.length || 0,
      sampleData: data,
      environment: {
        nodeEnv,
        supabaseUrlPrefix: supabaseUrl.substring(0, 30)
      }
    })

  } catch (error) {
    console.error('Test connection error:', error)
    return NextResponse.json({
      success: false,
      error: 'Connection test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}