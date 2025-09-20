'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Trash2, Plus, Star, Sparkles, TrendingUp, TrendingDown } from 'lucide-react'

interface AccountingItem {
  id: string
  code: string
  name: string
  type: 'income' | 'expense' | 'both'
  category: string
}

interface AccountingEntry {
  id: string
  accounting_item_id: string
  amount: number
  custom_item_name?: string
  notes?: string
  is_ai_recommended?: boolean
}

interface AIRecommendation {
  id: string
  accounting_item: AccountingItem
  confidence: number
  avg_amount: number
  usage_count: number
  is_high_confidence: boolean
  stars: number
  is_default?: boolean
}

interface WorkAccountingInputProps {
  workType: string
  companyId: string
  workReportId?: string
  onDataChange?: (data: {
    income_items: AccountingEntry[]
    expense_items: AccountingEntry[]
    income_total: number
    expense_total: number
    net_income: number
  }) => void
  // 手動反映機能のための関数
  onManualReflect?: (reflectFunction: (amount: number, itemName: string) => void) => void
}

export default function WorkAccountingInput({
  workType,
  companyId,
  workReportId,
  onDataChange,
  onManualReflect
}: WorkAccountingInputProps) {
  // State管理
  const [accountingItems, setAccountingItems] = useState<AccountingItem[]>([])
  const [aiRecommendations, setAIRecommendations] = useState<AIRecommendation[]>([])
  const [incomeItems, setIncomeItems] = useState<AccountingEntry[]>([])
  const [expenseItems, setExpenseItems] = useState<AccountingEntry[]>([])
  const [loading, setLoading] = useState(true)

  // 計算値
  const incomeTotal = incomeItems.reduce((sum, item) => sum + (item.amount || 0), 0)
  const expenseTotal = expenseItems.reduce((sum, item) => sum + (item.amount || 0), 0)
  const netIncome = incomeTotal - expenseTotal

  // 初期データ読み込み
  useEffect(() => {
    loadInitialData()
  }, [workType, companyId, workReportId])

  // データ変更時のコールバック
  useEffect(() => {
    if (onDataChange) {
      onDataChange({
        income_items: incomeItems,
        expense_items: expenseItems,
        income_total: incomeTotal,
        expense_total: expenseTotal,
        net_income: netIncome
      })
    }
  }, [incomeItems, expenseItems, incomeTotal, expenseTotal, netIncome, onDataChange])

  // 手動反映機能
  const manualReflectToAccounting = useCallback((amount: number, itemName: string) => {
    
    
    if (amount > 0 && accountingItems.length > 0) {
      // デバッグ: 全会計項目を確認
      )
      )
      
      // 販売金額の会計項目を探す（複数のパターンで検索）
      let salesItem = accountingItems.find(item => item.code === '101' && item.type === 'income')
      
      // コード101が見つからない場合、他の販売関連項目を探す
      if (!salesItem) {
        salesItem = accountingItems.find(item => 
          item.type === 'income' && 
          (item.name.includes('販売') || item.name.includes('売上') || item.name.includes('収入'))
        )
      }
      
      // それでも見つからない場合、最初の収入項目を使用
      if (!salesItem) {
        salesItem = accountingItems.find(item => item.type === 'income')
      }
      
      
      
      if (salesItem) {
        // 既存の販売金額項目があるかチェック
        const existingSalesEntry = incomeItems.find(item => item.accounting_item_id === salesItem.id)
        
        
        if (!existingSalesEntry) {
          // 新しい販売金額エントリを追加
          const newIncomeEntry: AccountingEntry = {
            id: `manual-${Date.now()}`,
            accounting_item_id: salesItem.id,
            amount: amount,
            custom_item_name: itemName || '収穫売上',
            notes: '収穫情報から手動反映',
            is_ai_recommended: false
          }
          
          
          setIncomeItems(prev => [newIncomeEntry, ...prev])
        } else {
          // 既存の項目の金額を更新
          
          setIncomeItems(prev => prev.map(item => 
            item.accounting_item_id === salesItem.id 
              ? { ...item, amount: amount, notes: '収穫情報から手動更新' }
              : item
          ))
        }
      } else {
        
      }
    } else {
      
    }
  }, [accountingItems, incomeItems])

  // 手動反映機能を親に渡す
  useEffect(() => {
    if (onManualReflect && accountingItems.length > 0) {
      
      onManualReflect(manualReflectToAccounting)
    }
  }, [onManualReflect, manualReflectToAccounting, accountingItems.length])

  const loadInitialData = async () => {
    try {
      setLoading(true)
      
      // 会計項目マスタの取得
      const itemsResponse = await fetch('/api/accounting-items')
      const itemsData = await itemsResponse.json()
      
      if (itemsData.success) {
        setAccountingItems(itemsData.data)
      }

      // AI推奨の取得
      const recommendationsResponse = await fetch(
        `/api/accounting-recommendations?company_id=${companyId}&work_type=${workType}`
      )
      const recommendationsData = await recommendationsResponse.json()
      
      if (recommendationsData.success) {
        setAIRecommendations(recommendationsData.data)
      }

      // 既存の作業会計データの取得（編集時）
      if (workReportId) {
        const accountingResponse = await fetch(`/api/work-accounting?work_report_id=${workReportId}`)
        const accountingData = await accountingResponse.json()
        
        if (accountingData.success) {
          setIncomeItems(accountingData.data.income_items.map((item: any) => ({
            id: item.id,
            accounting_item_id: item.accounting_item_id,
            amount: item.amount,
            custom_item_name: item.custom_item_name,
            notes: item.notes,
            is_ai_recommended: item.is_ai_recommended
          })))
          
          setExpenseItems(accountingData.data.expense_items.map((item: any) => ({
            id: item.id,
            accounting_item_id: item.accounting_item_id,
            amount: Math.abs(item.amount), // 支出は正の値で表示
            custom_item_name: item.custom_item_name,
            notes: item.notes,
            is_ai_recommended: item.is_ai_recommended
          })))
        }
      }
      
    } catch (error) {
      
    } finally {
      setLoading(false)
    }
  }

  // AI推奨項目を追加
  const addRecommendation = (recommendation: AIRecommendation) => {
    const newEntry: AccountingEntry = {
      id: `temp-${Date.now()}`,
      accounting_item_id: recommendation.accounting_item.id,
      amount: recommendation.avg_amount || 0,
      is_ai_recommended: true
    }

    if (recommendation.accounting_item.type === 'income' || 
        (recommendation.accounting_item.type === 'both' && recommendation.avg_amount > 0)) {
      setIncomeItems(prev => [...prev, newEntry])
    } else {
      setExpenseItems(prev => [...prev, newEntry])
    }
  }

  // 収入項目を追加
  const addIncomeItem = () => {
    const newItem: AccountingEntry = {
      id: `temp-${Date.now()}`,
      accounting_item_id: '',
      amount: 0
    }
    setIncomeItems(prev => [...prev, newItem])
  }

  // 支出項目を追加
  const addExpenseItem = () => {
    const newItem: AccountingEntry = {
      id: `temp-${Date.now()}`,
      accounting_item_id: '',
      amount: 0
    }
    setExpenseItems(prev => [...prev, newItem])
  }

  // 項目を削除
  const removeItem = (id: string, type: 'income' | 'expense') => {
    if (type === 'income') {
      setIncomeItems(prev => prev.filter(item => item.id !== id))
    } else {
      setExpenseItems(prev => prev.filter(item => item.id !== id))
    }
  }

  // 項目を更新
  const updateItem = (id: string, type: 'income' | 'expense', field: string, value: any) => {
    const updateFunction = (items: AccountingEntry[]) =>
      items.map(item => item.id === id ? { ...item, [field]: value } : item)
    
    if (type === 'income') {
      setIncomeItems(updateFunction)
    } else {
      setExpenseItems(updateFunction)
    }
  }

  // 星の表示
  const renderStars = (count: number) => {
    return Array.from({ length: 3 }, (_, i) => (
      <Star
        key={i}
        className={`w-3 h-3 ${i < count ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
      />
    ))
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-48 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-48 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* AI推奨セクション */}
      {aiRecommendations.length > 0 && (
        <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-purple-800">AI コスト推奨</h3>
            <Badge className="bg-purple-100 text-purple-700">クリックで簡単追加</Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {aiRecommendations.map((rec) => (
              <div
                key={rec.id}
                className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => addRecommendation(rec)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-600">{rec.accounting_item.code}</span>
                    <span className="font-semibold text-gray-800">{rec.accounting_item.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {renderStars(rec.stars)}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-blue-600">
                    {rec.avg_amount > 0 ? `¥${rec.avg_amount.toLocaleString()}` : '金額入力'}
                  </span>
                  <Button size="sm" className="h-6 px-2">
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 収入セクション */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold text-green-800">収入項目</h3>
            <Badge className="bg-green-100 text-green-700">+</Badge>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-green-700">¥{incomeTotal.toLocaleString()}</p>
            <p className="text-xs text-green-600">収入合計</p>
          </div>
        </div>

        <div className="space-y-3">
          {incomeItems.map((item, index) => (
            <div key={item.id} className="flex items-center gap-3 bg-white rounded-lg p-3">
              <Select
                value={item.accounting_item_id}
                onValueChange={(value) => updateItem(item.id, 'income', 'accounting_item_id', value)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="収入項目を選択" />
                </SelectTrigger>
                <SelectContent>
                  {accountingItems
                    .filter(ai => ai.type === 'income' || ai.type === 'both')
                    .map(ai => (
                      <SelectItem key={ai.id} value={ai.id}>
                        {ai.code} {ai.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <Input
                type="number"
                placeholder="金額"
                className="w-32"
                value={item.amount || ''}
                onChange={(e) => updateItem(item.id, 'income', 'amount', parseFloat(e.target.value) || 0)}
              />

              {item.accounting_item_id === accountingItems.find(ai => ai.code === 'その他')?.id && (
                <Input
                  placeholder="項目名"
                  className="w-32"
                  value={item.custom_item_name || ''}
                  onChange={(e) => updateItem(item.id, 'income', 'custom_item_name', e.target.value)}
                />
              )}

              <Input
                placeholder="備考"
                className="flex-1"
                value={item.notes || ''}
                onChange={(e) => updateItem(item.id, 'income', 'notes', e.target.value)}
              />

              {item.is_ai_recommended && (
                <Badge className="bg-purple-100 text-purple-600">AI推奨</Badge>
              )}

              <Button
                size="sm"
                variant="outline"
                onClick={() => removeItem(item.id, 'income')}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}

          <Button onClick={addIncomeItem} variant="outline" className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            収入項目を追加
          </Button>
        </div>
      </div>

      {/* 支出セクション */}
      <div className="bg-gradient-to-r from-red-50 to-pink-50 border-l-4 border-red-500 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-red-600" />
            <h3 className="text-lg font-semibold text-red-800">支出項目</h3>
            <Badge className="bg-red-100 text-red-700">-</Badge>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-red-700">¥{expenseTotal.toLocaleString()}</p>
            <p className="text-xs text-red-600">支出合計</p>
          </div>
        </div>

        <div className="space-y-3">
          {expenseItems.map((item, index) => (
            <div key={item.id} className="flex items-center gap-3 bg-white rounded-lg p-3">
              <Select
                value={item.accounting_item_id}
                onValueChange={(value) => updateItem(item.id, 'expense', 'accounting_item_id', value)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="支出項目を選択" />
                </SelectTrigger>
                <SelectContent>
                  {accountingItems
                    .filter(ai => ai.type === 'expense' || ai.type === 'both')
                    .map(ai => (
                      <SelectItem key={ai.id} value={ai.id}>
                        {ai.code} {ai.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <Input
                type="number"
                placeholder="金額"
                className="w-32"
                value={item.amount || ''}
                onChange={(e) => updateItem(item.id, 'expense', 'amount', parseFloat(e.target.value) || 0)}
              />

              {item.accounting_item_id === accountingItems.find(ai => ai.code === 'その他')?.id && (
                <Input
                  placeholder="項目名"
                  className="w-32"
                  value={item.custom_item_name || ''}
                  onChange={(e) => updateItem(item.id, 'expense', 'custom_item_name', e.target.value)}
                />
              )}

              <Input
                placeholder="備考"
                className="flex-1"
                value={item.notes || ''}
                onChange={(e) => updateItem(item.id, 'expense', 'notes', e.target.value)}
              />

              {item.is_ai_recommended && (
                <Badge className="bg-purple-100 text-purple-600">AI推奨</Badge>
              )}

              <Button
                size="sm"
                variant="outline"
                onClick={() => removeItem(item.id, 'expense')}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}

          <Button onClick={addExpenseItem} variant="outline" className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            支出項目を追加
          </Button>
        </div>
      </div>

      {/* 収支サマリー */}
      <div className="bg-gradient-to-r from-slate-50 to-gray-100 rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          📊 収支サマリー
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-sm text-gray-600">💚 収入</p>
            <p className="text-xl font-bold text-green-600">¥{incomeTotal.toLocaleString()}</p>
          </div>
          
          <div className="text-center">
            <p className="text-sm text-gray-600">🔴 支出</p>
            <p className="text-xl font-bold text-red-600">¥{expenseTotal.toLocaleString()}</p>
          </div>
          
          <div className="text-center">
            <p className="text-sm text-gray-600">📊 純損益</p>
            <p className={`text-2xl font-bold ${netIncome >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {netIncome >= 0 ? '+' : ''}¥{netIncome.toLocaleString()}
            </p>
          </div>
          
          <div className="text-center">
            <p className="text-sm text-gray-600">📈 損益率</p>
            <p className={`text-lg font-bold ${netIncome >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {expenseTotal > 0 ? `${((netIncome / expenseTotal) * 100).toFixed(1)}%` : '-%'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}