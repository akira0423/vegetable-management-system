'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function AccountingAPITestPage() {
  const [testResults, setTestResults] = useState<any>({})
  const [loading, setLoading] = useState(false)

  const runAllTests = async () => {
    setLoading(true)
    const results: any = {}

    try {
      // Test 1: 会計項目取得
      console.log('🧪 Test 1: 会計項目取得API')
      const itemsResponse = await fetch('/api/accounting-items')
      const itemsData = await itemsResponse.json()
      results.accountingItems = {
        status: itemsResponse.status,
        success: itemsData.success,
        count: itemsData.count,
        data: itemsData.data?.slice(0, 5) // 最初の5件のみ表示
      }

      // Test 2: 収入項目のみ取得
      console.log('🧪 Test 2: 収入項目取得API')
      const incomeResponse = await fetch('/api/accounting-items?type=income')
      const incomeData = await incomeResponse.json()
      results.incomeItems = {
        status: incomeResponse.status,
        success: incomeData.success,
        count: incomeData.count,
        data: incomeData.data
      }

      // Test 3: 支出項目のみ取得
      console.log('🧪 Test 3: 支出項目取得API')
      const expenseResponse = await fetch('/api/accounting-items?type=expense')
      const expenseData = await expenseResponse.json()
      results.expenseItems = {
        status: expenseResponse.status,
        success: expenseData.success,
        count: expenseData.count,
        data: expenseData.data?.slice(0, 10) // 最初の10件のみ表示
      }

      // Test 4: AI推奨取得（ダミーパラメータ）
      console.log('🧪 Test 4: AI推奨取得API')
      try {
        const recommendationsResponse = await fetch('/api/accounting-recommendations?company_id=4cb3e254-9d73-4d67-b9ae-433bf249fe38&work_type=fertilizing')
        const recommendationsData = await recommendationsResponse.json()
        results.recommendations = {
          status: recommendationsResponse.status,
          success: recommendationsData.success,
          data: recommendationsData.data
        }
      } catch (error) {
        results.recommendations = {
          status: 'error',
          error: error.message
        }
      }

      // Test 5: 作業会計データ取得（存在しないIDでテスト）
      console.log('🧪 Test 5: 作業会計データ取得API')
      try {
        const workAccountingResponse = await fetch('/api/work-accounting?work_report_id=test-id')
        const workAccountingData = await workAccountingResponse.json()
        results.workAccounting = {
          status: workAccountingResponse.status,
          success: workAccountingData.success,
          data: workAccountingData.data
        }
      } catch (error) {
        results.workAccounting = {
          status: 'error',
          error: error.message
        }
      }

    } catch (error) {
      console.error('❌ テスト実行エラー:', error)
      results.error = error.message
    }

    setTestResults(results)
    setLoading(false)
    console.log('✅ 全テスト完了:', results)
  }

  const renderTestResult = (testName: string, result: any) => {
    if (!result) return null

    const isSuccess = result.status === 200 || result.success
    const statusColor = isSuccess ? 'text-green-600' : 'text-red-600'
    const badgeVariant = isSuccess ? 'default' : 'destructive'

    return (
      <Card key={testName} className="mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{testName}</CardTitle>
            <Badge variant={badgeVariant as any}>
              {result.status === 'error' ? 'ERROR' : `Status: ${result.status}`}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {result.success !== undefined && (
              <p className={statusColor}>
                <strong>Success:</strong> {result.success ? '✅' : '❌'}
              </p>
            )}
            
            {result.count !== undefined && (
              <p>
                <strong>Count:</strong> {result.count}
              </p>
            )}

            {result.error && (
              <p className="text-red-600">
                <strong>Error:</strong> {result.error}
              </p>
            )}

            {result.data && (
              <div>
                <strong>Data (preview):</strong>
                <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-x-auto">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">会計API テスト</h1>
        <p className="text-gray-600">農業会計機能のAPIエンドポイントをテストします</p>
      </div>

      <div className="mb-6">
        <Button 
          onClick={runAllTests} 
          disabled={loading}
          className="mr-4"
        >
          {loading ? '🧪 テスト実行中...' : '🧪 全APIテスト実行'}
        </Button>
        
        <Button 
          onClick={() => setTestResults({})} 
          variant="outline"
        >
          結果をクリア
        </Button>
      </div>

      <div className="space-y-4">
        {renderTestResult('1. 会計項目取得API', testResults.accountingItems)}
        {renderTestResult('2. 収入項目取得API', testResults.incomeItems)}
        {renderTestResult('3. 支出項目取得API', testResults.expenseItems)}
        {renderTestResult('4. AI推奨取得API', testResults.recommendations)}
        {renderTestResult('5. 作業会計データ取得API', testResults.workAccounting)}
      </div>

      {Object.keys(testResults).length === 0 && !loading && (
        <Card>
          <CardContent className="p-6 text-center text-gray-500">
            「全APIテスト実行」ボタンをクリックしてテストを開始してください
          </CardContent>
        </Card>
      )}
    </div>
  )
}