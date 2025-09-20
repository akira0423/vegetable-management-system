'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { 
  Download, 
  FileSpreadsheet, 
  Calendar, 
  Filter, 
  Database,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { useDataExport } from '@/lib/data-export'
import { format } from 'date-fns'

interface DataExportDialogProps {
  className?: string
}

const EXPORT_FORMATS = [
  { value: 'csv', label: 'CSV形式', icon: FileSpreadsheet, description: 'Excel等で開けるCSV形式' },
  { value: 'excel', label: 'Excel形式', icon: FileSpreadsheet, description: 'Microsoft Excel形式（今後対応予定）' }
]

const DATA_TYPES = [
  { 
    value: 'vegetables', 
    label: '野菜管理データ', 
    description: '登録済み野菜の情報（品種、圃場、ステータス等）',
    icon: '🌱'
  },
  { 
    value: 'work_reports', 
    label: '作業報告データ', 
    description: '日々の作業記録（作業種類、時間、収穫量等）',
    icon: '📋'
  },
  { 
    value: 'analytics', 
    label: '分析データ', 
    description: '月別集計・生産性分析レポート',
    icon: '📊'
  },
  { 
    value: 'all_data', 
    label: '全データ', 
    description: '上記すべてのデータを一括エクスポート',
    icon: '💾'
  }
]

const WORK_TYPES = [
  { value: 'seeding', label: '播種・育苗' },
  { value: 'planting', label: '定植' },
  { value: 'fertilizing', label: '施肥' },
  { value: 'watering', label: '灌水' },
  { value: 'weeding', label: '除草' },
  { value: 'pruning', label: '整枝・摘芽' },
  { value: 'harvesting', label: '収穫' },
  { value: 'other', label: 'その他' }
]

export default function DataExportDialog({ className }: DataExportDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel'>('csv')
  const [dataType, setDataType] = useState<'vegetables' | 'work_reports' | 'analytics' | 'all_data'>('vegetables')
  const [dateRange, setDateRange] = useState({
    start: format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'), // 30日前
    end: format(new Date(), 'yyyy-MM-dd') // 今日
  })
  const [filters, setFilters] = useState({
    work_type: '',
    vegetable_id: '',
    plot_name: ''
  })
  const [includePhotos, setIncludePhotos] = useState(false)

  const { exportVegetables, exportWorkReports, exportAnalytics, exportAllData } = useDataExport()

  const handleExport = async () => {
    setLoading(true)
    try {
      
      
      const exportOptions = {
        format: exportFormat,
        dateRange: {
          start: dateRange.start,
          end: dateRange.end
        },
        filters: {
          work_type: filters.work_type || undefined,
          vegetable_id: filters.vegetable_id || undefined,
          plot_name: filters.plot_name || undefined
        },
        includePhotos
      }

      switch (dataType) {
        case 'vegetables':
          await exportVegetables(exportOptions)
          break
        case 'work_reports':
          await exportWorkReports(exportOptions)
          break
        case 'analytics':
          await exportAnalytics(exportOptions)
          break
        case 'all_data':
          await exportAllData(exportOptions)
          break
      }

      // 成功通知
      const selectedDataType = DATA_TYPES.find(t => t.value === dataType)
      alert(`${selectedDataType?.label}のエクスポートが完了しました！\n\nファイルがダウンロードされます。`)
      
      // モーダルを閉じる
      setOpen(false)
      
    } catch (error) {
      
      alert('エクスポートに失敗しました。もう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  const selectedDataType = DATA_TYPES.find(t => t.value === dataType)
  const selectedFormat = EXPORT_FORMATS.find(f => f.value === exportFormat)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className={`${className}`}>
          <Download className="w-4 h-4 mr-2" />
          データエクスポート
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            データエクスポート
          </DialogTitle>
          <DialogDescription>
            農業データをCSV・Excel形式でエクスポートできます
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* データ種類選択 */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">エクスポートするデータ</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {DATA_TYPES.map(type => (
                <Card 
                  key={type.value}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    dataType === type.value 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200'
                  }`}
                  onClick={() => setDataType(type.value as any)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{type.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{type.label}</span>
                          {dataType === type.value && (
                            <CheckCircle2 className="w-4 h-4 text-blue-600" />
                          )}
                        </div>
                        <p className="text-xs text-gray-600">{type.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* フォーマット選択 */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">エクスポート形式</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {EXPORT_FORMATS.map(format => (
                <Card 
                  key={format.value}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    exportFormat === format.value 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-gray-200'
                  }`}
                  onClick={() => setExportFormat(format.value as any)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <format.icon className="w-5 h-5 text-green-600" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{format.label}</span>
                          {exportFormat === format.value && (
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                          )}
                        </div>
                        <p className="text-xs text-gray-600">{format.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* 日付範囲選択 */}
          {(dataType === 'work_reports' || dataType === 'analytics' || dataType === 'all_data') && (
            <div className="space-y-3">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                期間設定
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">開始日</Label>
                  <Input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">終了日</Label>
                  <Input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}

          {/* フィルター設定 */}
          {dataType === 'work_reports' && (
            <div className="space-y-3">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Filter className="w-4 h-4" />
                フィルター設定
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">作業種類</Label>
                  <Select value={filters.work_type} onValueChange={(value) => setFilters(prev => ({ ...prev, work_type: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="すべて" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">すべて</SelectItem>
                      {WORK_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm">圃場名</Label>
                  <Input
                    value={filters.plot_name}
                    onChange={(e) => setFilters(prev => ({ ...prev, plot_name: e.target.value }))}
                    placeholder="圃場名で絞り込み"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 追加オプション */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">追加オプション</Label>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="include-photos" 
                  checked={includePhotos}
                  onCheckedChange={(checked) => setIncludePhotos(checked as boolean)}
                />
                <Label htmlFor="include-photos" className="text-sm">
                  写真URLを含める（今後対応予定）
                </Label>
              </div>
            </div>
          </div>

          {/* プレビュー情報 */}
          {selectedDataType && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                エクスポート予定
              </h4>
              <div className="text-sm text-blue-700 space-y-1">
                <p>📊 <strong>データ種類:</strong> {selectedDataType.label}</p>
                <p>📄 <strong>形式:</strong> {selectedFormat?.label}</p>
                {(dataType === 'work_reports' || dataType === 'analytics' || dataType === 'all_data') && (
                  <p>📅 <strong>期間:</strong> {dateRange.start} ～ {dateRange.end}</p>
                )}
                {filters.work_type && (
                  <p>🔍 <strong>作業種類:</strong> {WORK_TYPES.find(t => t.value === filters.work_type)?.label}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* アクションボタン */}
        <div className="flex items-center justify-between pt-6 border-t">
          <div className="text-xs text-gray-500">
            💡 エクスポートしたデータはExcel等で開いて分析できます
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              キャンセル
            </Button>
            
            <Button 
              onClick={handleExport}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 mr-2 animate-spin border-2 border-white border-t-transparent rounded-full"></div>
                  エクスポート中...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  エクスポート実行
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}