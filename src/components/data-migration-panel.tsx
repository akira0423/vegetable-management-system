'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Database, AlertTriangle, CheckCircle } from 'lucide-react'

interface MigrationResult {
  success: boolean
  dry_run: boolean
  summary: {
    total_reports_checked: number
    cost_data_found: number
    target_accounting_item?: string
    existing_data_skipped?: number
    new_data_inserted?: number
    sample_conversion?: any[]
    sample_accounting_data?: any[]
  }
  message: string
  error?: string
  details?: any
}

export default function DataMigrationPanel() {
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<MigrationResult | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  const runMigration = async (dryRun: boolean = true) => {
    setIsRunning(true)
    setResult(null)
    
    try {
      const response = await fetch('/api/migrate-cost-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          company_id: '4cb3e254-9d73-4d67-b9ae-433bf249fe38', // 実際のcompany_idを使用
          dry_run: dryRun
        })
      })

      const data = await response.json()
      
      if (response.ok) {
        setResult(data)
      } else {
        setResult({
          success: false,
          dry_run: dryRun,
          summary: {
            total_reports_checked: 0,
            cost_data_found: 0
          },
          message: 'Migration failed',
          error: data.error,
          details: data.details
        })
      }
    } catch (error) {
      setResult({
        success: false,
        dry_run: dryRun,
        summary: {
          total_reports_checked: 0,
          cost_data_found: 0
        },
        message: 'Network error',
        error: error.message
      })
    }
    
    setIsRunning(false)
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="w-5 h-5" />
          データマイグレーション: コスト情報 → 会計システム
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            既存の「コスト情報」を新しい「会計・コスト記録」システムに移行します。
            まずプレビューを実行して内容を確認してから、本番移行を実行してください。
          </AlertDescription>
        </Alert>

        <div className="flex gap-4">
          <Button
            onClick={() => runMigration(true)}
            disabled={isRunning}
            variant="outline"
          >
            {isRunning ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Database className="w-4 h-4 mr-2" />
            )}
            プレビュー実行
          </Button>
          
          <Button
            onClick={() => runMigration(false)}
            disabled={isRunning || !result?.success || !result?.dry_run}
            variant="default"
          >
            {isRunning ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4 mr-2" />
            )}
            本番移行実行
          </Button>
        </div>

        {result && (
          <div className="space-y-4">
            <Alert className={result.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
              <div className="flex items-center gap-2">
                {result.success ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                )}
                <AlertDescription className={result.success ? "text-green-800" : "text-red-800"}>
                  {result.message}
                  {result.dry_run ? " (プレビューモード)" : " (本番実行)"}
                </AlertDescription>
              </div>
            </Alert>

            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold mb-3">マイグレーション結果サマリー</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-gray-600">確認したレポート数</div>
                  <div className="font-medium">{result.summary.total_reports_checked}</div>
                </div>
                <div>
                  <div className="text-gray-600">コストデータ発見数</div>
                  <div className="font-medium">{result.summary.cost_data_found}</div>
                </div>
                {result.summary.target_accounting_item && (
                  <div>
                    <div className="text-gray-600">変換先会計項目</div>
                    <div className="font-medium">{result.summary.target_accounting_item}</div>
                  </div>
                )}
                {result.summary.new_data_inserted !== undefined && (
                  <div>
                    <div className="text-gray-600">新規挿入データ数</div>
                    <div className="font-medium">{result.summary.new_data_inserted}</div>
                  </div>
                )}
              </div>
            </div>

            {result.error && (
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <strong>エラー:</strong> {result.error}
                  {result.details && (
                    <details className="mt-2">
                      <summary className="cursor-pointer">詳細を表示</summary>
                      <pre className="mt-2 text-xs bg-white p-2 rounded border overflow-auto">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {result.success && result.dry_run && result.summary.sample_conversion && (
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDetails(!showDetails)}
                >
                  {showDetails ? "詳細を隠す" : "サンプルデータを表示"}
                </Button>
                
                {showDetails && (
                  <div className="mt-3 space-y-3">
                    <div>
                      <h4 className="font-medium mb-2">変換前サンプル (上位3件)</h4>
                      <pre className="text-xs bg-white p-3 rounded border overflow-auto">
                        {JSON.stringify(result.summary.sample_conversion, null, 2)}
                      </pre>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-2">変換後サンプル (上位3件)</h4>
                      <pre className="text-xs bg-white p-3 rounded border overflow-auto">
                        {JSON.stringify(result.summary.sample_accounting_data, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}