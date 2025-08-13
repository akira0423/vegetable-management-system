import { NextRequest, NextResponse } from 'next/server'
import { generateAgriculturalAdvice } from '@/lib/openai/client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, context } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ 
        error: 'Message is required and must be a string' 
      }, { status: 400 })
    }

    // メッセージの長さチェック
    if (message.length > 2000) {
      return NextResponse.json({ 
        error: 'Message is too long (max 2000 characters)' 
      }, { status: 400 })
    }

    // 不適切な内容のフィルタリング
    const inappropriateKeywords = ['危険', '有害', '違法', '毒', '農薬過剰']
    const lowerMessage = message.toLowerCase()
    const hasInappropriateContent = inappropriateKeywords.some(keyword => 
      lowerMessage.includes(keyword.toLowerCase())
    )

    if (hasInappropriateContent) {
      return NextResponse.json({
        success: true,
        advice: '申し訳ございませんが、安全な農業実践に関するアドバイスのみ提供しております。\n\n環境に優しく、安全な栽培方法について別の質問がございましたら、お気軽にお聞かせください。'
      })
    }

    // コンテキストの処理
    let processedContext = null
    if (context) {
      processedContext = {
        vegetableName: context.vegetableName || undefined,
        currentStage: context.currentStage || undefined,
        soilData: context.soilData ? {
          ph: typeof context.soilData.ph === 'number' ? context.soilData.ph : undefined,
          moisture: typeof context.soilData.moisture === 'number' ? context.soilData.moisture : undefined
        } : undefined,
        recentLogs: Array.isArray(context.recentLogs) ? context.recentLogs.slice(0, 5) : undefined
      }
    }

    // OpenAI APIを使用してアドバイスを生成
    const advice = await generateAgriculturalAdvice(message, processedContext)

    // 回答の後処理（安全性チェックと形式整理）
    const processedAdvice = postProcessAdvice(advice)

    return NextResponse.json({
      success: true,
      advice: processedAdvice,
      context: processedContext
    })

  } catch (error: any) {
    console.error('AI advice API error:', error)

    // OpenAI API特有のエラーハンドリング
    if (error.message?.includes('rate limit')) {
      return NextResponse.json({
        success: false,
        error: 'APIの使用制限に達しました。しばらく経ってから再度お試しください。'
      }, { status: 429 })
    }

    if (error.message?.includes('insufficient_quota')) {
      return NextResponse.json({
        success: false,
        error: 'AI機能が一時的に利用できません。管理者にお問い合わせください。'
      }, { status: 503 })
    }

    // 一般的なエラー
    return NextResponse.json({
      success: false,
      error: 'AI回答の生成中にエラーが発生しました。しばらく経ってから再度お試しください。'
    }, { status: 500 })
  }
}

// 回答の後処理関数
function postProcessAdvice(advice: string): string {
  // 基本的な形式整理
  let processed = advice.trim()

  // 長すぎる回答を制限
  if (processed.length > 2000) {
    processed = processed.substring(0, 1997) + '...'
  }

  // 不適切な推奨事項を除去
  const inappropriatePatterns = [
    /違法.*農薬/gi,
    /過剰.*使用/gi,
    /危険.*方法/gi
  ]

  inappropriatePatterns.forEach(pattern => {
    if (pattern.test(processed)) {
      processed = '安全で環境に配慮した栽培方法についてのアドバイスをご希望の場合は、より具体的な質問をお聞かせください。\n\n有機農法や減農薬栽培、土壌改良などについてお答えできます。'
    }
  })

  // 農業知識の品質向上
  if (processed.includes('申し訳')) {
    processed += '\n\n💡 より具体的なアドバイスをお求めの場合は、以下の情報を教えてください：\n• 具体的な野菜の種類\n• 現在の成長段階\n• 栽培環境（露地・ハウスなど）\n• 直面している問題'
  }

  return processed
}

// GET エンドポイント（ヘルスチェック用）
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'AI Advice API is running',
    features: [
      'Agricultural expert advice',
      'Context-aware recommendations',
      'Safety filtering',
      'Multi-language support (Japanese)'
    ]
  })
}