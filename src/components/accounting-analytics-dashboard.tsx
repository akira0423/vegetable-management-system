'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import DataSourceBadge, { AIRecommendationBadge, VarianceBadge } from '@/components/ui/data-source-badge'
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  PieChart, 
  BarChart3, 
  Bot, 
  AlertTriangle,
  CheckCircle,
  Calendar,
  RefreshCw,
  Filter
} from 'lucide-react'

interface AccountingAnalyticsDashboardProps {
  companyId: string
}

export default function AccountingAnalyticsDashboard({ companyId }: AccountingAnalyticsDashboardProps) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 過去3ヶ月
    end: new Date().toISOString().split('T')[0]
  })
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // データ取得
  const fetchAccountingData = async () => {
    setLoading(true)
    try {
      
      
      const response = await fetch(
        `/api/analytics/accounting-summary?company_id=${companyId}&start_date=${dateRange.start}&end_date=${dateRange.end}`
      )
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const result = await response.json()
      
      if (result.success) {
        setData(result)
        setLastUpdated(new Date())
        
      } else {
        throw new Error(result.error || 'データ取得に失敗しました')
      }
    } catch (error) {
      
      alert(`データの取得に失敗しました: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (companyId) {
      fetchAccountingData()
    }
  }, [companyId])

  // 日付範囲変更時の処理
  const handleDateRangeChange = () => {
    fetchAccountingData()
  }

  // フォーマット関数
  const formatCurrency = (amount: number) => {
    return `¥${amount.toLocaleString()}`
  }

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="py-8">
          <div className="flex items-center justify-center space-x-2">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-lg">会計データを分析中...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card className="w-full">
        <CardContent className="py-8 text-center">
          <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">会計データを取得できませんでした</p>
          <Button onClick={fetchAccountingData} className="mt-4">
            再試行
          </Button>
        </CardContent>
      </Card>
    )
  }

  const { accountingSummary, categoryAnalysis, aiAnalysis, monthlyCostData } = data

  return (
    <div className="space-y-6">
      {/* ヘッダー・フィルター */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="w-5 h-5" />
                プロフェッショナル会計分析ダッシュボード
              </CardTitle>
              <CardDescription>
                実績データに基づく詳細な経営分析・AI活用状況・予実差異分析
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <DataSourceBadge 
                source="accounting" 
                reliability="high" 
                badge="統合済み" 
                showTooltip={false}
              />
              {lastUpdated && (
                <Badge variant="outline" className="text-xs">
                  更新: {lastUpdated.toLocaleTimeString()}
                </Badge>
              )}
            </div>
          </div>
          
          {/* 日付フィルター */}
          <div className="flex items-center gap-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-600" />
              <Label className="text-sm font-medium">分析期間:</Label>
            </div>
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="w-36 h-8 text-xs"
            />
            <span className="text-gray-500">〜</span>
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="w-36 h-8 text-xs"
            />
            <Button onClick={handleDateRangeChange} size="sm" variant="outline">
              <Filter className="w-4 h-4 mr-1" />
              更新
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* サマリーカード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 実収入 */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">実収入</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(accountingSummary.actualIncome)}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <DataSourceBadge 
                source="accounting" 
                reliability="high" 
                badge="実績"
                amount={accountingSummary.actualIncome}
              />
            </div>
          </CardContent>
        </Card>

        {/* 実支出 */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">実支出</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(accountingSummary.actualExpense)}
                </p>
              </div>
              <TrendingDown className="w-8 h-8 text-red-600" />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <DataSourceBadge 
                source="accounting" 
                reliability="high" 
                badge="実績"
                amount={accountingSummary.actualExpense}
              />
            </div>
          </CardContent>
        </Card>

        {/* 純利益 */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">純利益</p>
                <p className={`text-2xl font-bold ${accountingSummary.netIncome >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  {formatCurrency(accountingSummary.netIncome)}
                </p>
              </div>
              <DollarSign className={`w-8 h-8 ${accountingSummary.netIncome >= 0 ? 'text-blue-600' : 'text-red-600'}`} />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <DataSourceBadge 
                source="accounting" 
                reliability="high" 
                badge="算出値"
                amount={Math.abs(accountingSummary.netIncome)}
              />
              {accountingSummary.variance.variancePercentage !== 0 && (
                <VarianceBadge 
                  variance={accountingSummary.variance.variance}
                  variancePercentage={accountingSummary.variance.variancePercentage}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* AI活用率 */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">AI活用率</p>
                <p className="text-2xl font-bold text-purple-600">
                  {formatPercentage(accountingSummary.aiUsageRate)}
                </p>
              </div>
              <Bot className="w-8 h-8 text-purple-600" />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Badge className="bg-purple-100 text-purple-800 border-purple-300 text-xs">
                {accountingSummary.recordCount}件中 {Math.round(accountingSummary.recordCount * accountingSummary.aiUsageRate / 100)}件
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* データ品質メトリクス */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            データ品質メトリクス
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">会計データ完全性</span>
                <span className="font-medium">{formatPercentage(accountingSummary.dataQuality.completenessRate)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full" 
                  style={{width: `${accountingSummary.dataQuality.completenessRate}%`}}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">推定値フォールバック率</span>
                <span className="font-medium">{formatPercentage(accountingSummary.dataQuality.estimationFallbackRate)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-amber-500 h-2 rounded-full" 
                  style={{width: `${accountingSummary.dataQuality.estimationFallbackRate}%`}}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">データ不整合</span>
                <span className="font-medium">{accountingSummary.dataQuality.inconsistencyCount}件</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                推定値と実績値が同時に存在するケース
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* カテゴリ別詳細分析 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            カテゴリ別詳細分析
          </CardTitle>
          <CardDescription>
            会計項目カテゴリごとの詳細な支出・収入分析
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {categoryAnalysis.slice(0, 8).map((category: any, index: number) => (
              <div key={category.category} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{backgroundColor: `hsl(${index * 45}, 60%, 60%)`}}
                      />
                      <span className="font-semibold">{category.category}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {category.entryCount}件
                    </Badge>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">
                      {formatCurrency(category.totalAmount)}
                    </div>
                    <div className="text-sm text-gray-600">
                      平均 {formatCurrency(category.averageAmount)}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-gray-600">収入</div>
                    <div className="font-medium text-green-600">
                      {formatCurrency(category.incomeAmount)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600">支出</div>
                    <div className="font-medium text-red-600">
                      {formatCurrency(category.expenseAmount)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600 flex items-center gap-1">
                      <Bot className="w-3 h-3" />
                      AI活用率
                    </div>
                    <div className="font-medium text-purple-600">
                      {formatPercentage(category.aiUsageRate)}
                    </div>
                  </div>
                </div>
                
                {category.aiUsageRate > 0 && (
                  <div className="mt-2">
                    <AIRecommendationBadge isAIRecommended={true} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 予実差異分析 */}
      {accountingSummary.variance.significantVariances.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              予実差異分析
            </CardTitle>
            <CardDescription>
              見積もりと実績の大きな差異（20%以上）を分析
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {accountingSummary.variance.significantVariances.map((variance: any, index: number) => (
                <div key={variance.workType} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-semibold">{variance.workType}</div>
                    <div className="text-sm text-gray-600">
                      {variance.reportCount}件のレポート
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-600">推定</div>
                        <div>{formatCurrency(variance.estimated)}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">実績</div>
                        <div>{formatCurrency(variance.actual)}</div>
                      </div>
                    </div>
                    <VarianceBadge 
                      variance={variance.variance}
                      variancePercentage={variance.variancePercentage}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI分析サマリー */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            AI推奨分析サマリー
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{aiAnalysis.totalEntries}</div>
              <div className="text-sm text-gray-600">総エントリ数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{aiAnalysis.aiRecommendedEntries}</div>
              <div className="text-sm text-gray-600">AI推奨</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">{aiAnalysis.manualEntries}</div>
              <div className="text-sm text-gray-600">手動入力</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {aiAnalysis.accuracyMetrics.consistencyScore.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">一貫性スコア</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}