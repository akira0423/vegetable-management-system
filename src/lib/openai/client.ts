import { OpenAI } from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

export { openai }

export const SYSTEM_PROMPT = `
あなたは野菜栽培管理システムの専門AIアシスタントです。
日本の農業環境に特化した、実践的で安全な栽培アドバイスを提供してください。

## 専門知識分野：
### 🌱 栽培技術
- 野菜別の詳細な栽培方法（播種〜収穫まで）
- 品種選択のアドバイス
- 成長段階別の管理ポイント
- 栽培環境の最適化（温度・湿度・光量）

### 🧪 土壌・施肥管理
- 土壌pH調整（6.0-7.0が適正な野菜が多い）
- 土壌水分管理（50-70%が一般的）
- 有機質肥料vs化学肥料の使い分け
- NPK比率の最適化
- 微量要素の管理

### 🐛 病害虫対策
- 早期発見のポイント
- 総合防除（IPM）の実践
- 生物農薬・天敵利用
- 耐病性品種の選択
- 予防的管理手法

### 📅 作業計画・スケジュール
- 季節別作業カレンダー
- 適期播種・定植時期
- 収穫のタイミング判断
- 作業効率化の提案

## 回答方針：
- 具体的な数値・期間を明示
- 段階的な手順を提供
- 安全で持続可能な方法を優先
- 日本の気候・土壌に適した内容
- コスト効率も考慮
- 失敗を防ぐ注意点も併記

## 避けるべき内容：
- 過度な農薬使用の推奨
- 環境負荷の高い方法
- 法規制に抵触する内容
- 根拠のない民間療法

常に「なぜそうするのか」の理由も説明し、初心者から上級者まで理解できる内容にしてください。
`

export async function generateAgriculturalAdvice(
  userMessage: string,
  context?: {
    vegetableName?: string
    currentStage?: string
    soilData?: {
      ph?: number
      moisture?: number
    }
    recentLogs?: string[]
  }
) {
  // 現在の季節と時期を取得
  const currentDate = new Date()
  const currentSeason = getSeason(currentDate)
  const currentMonth = currentDate.getMonth() + 1

  // コンテキスト情報の整理
  let contextMessage = `
## 現在の状況（${currentDate.toLocaleDateString('ja-JP')}）
- 時期: ${currentMonth}月（${currentSeason}）
- 気象: 日本の${currentSeason}の一般的な気候を考慮`

  if (context) {
    contextMessage += `

## 栽培情報
- 対象野菜: ${context.vegetableName || '指定なし（一般的なアドバイス）'}
- 現在の段階: ${getStageDescription(context.currentStage) || '不明'}
- 土壌pH: ${context.soilData?.ph ? `${context.soilData.ph}（${getPhAdvice(context.soilData.ph)}）` : '測定データなし'}
- 土壌水分: ${context.soilData?.moisture ? `${context.soilData.moisture}%（${getMoistureAdvice(context.soilData.moisture)}）` : '測定データなし'}

## 最近の作業履歴
${context.recentLogs && context.recentLogs.length > 0 
  ? context.recentLogs.map(log => `- ${log}`).join('\n')
  : '- 作業記録なし'}
`
  }

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `${contextMessage}\n\n## 質問・相談内容\n${userMessage}` },
      ],
      model: 'gpt-4o-mini',
      max_tokens: 1200,
      temperature: 0.3, // より一貫した専門的回答のために低めに設定
    })

    return completion.choices[0]?.message?.content || 'すみません、回答を生成できませんでした。もう一度お試しください。'
  } catch (error) {
    console.error('OpenAI API Error:', error)
    throw error // 上位でより詳細なエラーハンドリング
  }
}

// 季節判定関数
function getSeason(date: Date): string {
  const month = date.getMonth() + 1
  if (month >= 3 && month <= 5) return '春'
  if (month >= 6 && month <= 8) return '夏'
  if (month >= 9 && month <= 11) return '秋'
  return '冬'
}

// 成長段階の説明
function getStageDescription(stage?: string): string {
  const stages: { [key: string]: string } = {
    'planning': '栽培計画中',
    'growing': '生育期',
    'harvesting': '収穫期',
    'completed': '栽培完了'
  }
  return stages[stage || ''] || stage || ''
}

// pH値のアドバイス
function getPhAdvice(ph: number): string {
  if (ph < 6.0) return '酸性よりで石灰が必要'
  if (ph > 7.5) return 'アルカリ性よりで硫黄などで調整必要'
  if (ph >= 6.0 && ph <= 7.0) return '適正範囲'
  return '若干アルカリ性'
}

// 土壌水分のアドバイス
function getMoistureAdvice(moisture: number): string {
  if (moisture < 40) return '乾燥気味・水やり検討'
  if (moisture > 80) return '過湿・排水改善必要'
  if (moisture >= 50 && moisture <= 70) return '適正範囲'
  return moisture < 50 ? 'やや乾燥' : 'やや湿潤'
}