'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useRouter } from 'next/navigation'
import { 
  Sprout, 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Calendar,
  MapPin,
  TrendingUp,
  Droplets,
  Sun,
  Thermometer,
  BarChart3,
  Camera,
  FileText,
  Eye,
  Archive,
  ExternalLink,
  Activity,
  Target,
  Clock
} from 'lucide-react'

interface Vegetable {
  id: string
  name: string
  variety_name: string
  scientific_name?: string
  plot_name: string
  plot_size: number
  planting_date: string
  expected_harvest_date?: string
  actual_harvest_date?: string
  status: 'planning' | 'growing' | 'harvesting' | 'completed'
  growth_stage: string
  notes?: string
  created_at: string
  updated_at: string
  created_by: string
  company_id: string
  stats?: {
    total_tasks: number
    completed_tasks: number
    photos_count: number
    reports_count: number
    days_since_planting: number
    estimated_days_to_harvest: number
  }
}

export default function VegetablesPage() {
  const router = useRouter()
  const [vegetables, setVegetables] = useState<Vegetable[]>([])
  const [filteredVegetables, setFilteredVegetables] = useState<Vegetable[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [selectedVegetable, setSelectedVegetable] = useState<Vegetable | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  
  // 複数削除機能用の状態
  const [deleteMode, setDeleteMode] = useState(false)
  const [selectedVegetableIds, setSelectedVegetableIds] = useState<Set<string>>(new Set())
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false)

  // フォームデータ
  const [formData, setFormData] = useState({
    name: '',
    variety_name: '',
    scientific_name: '',
    plot_name: '',
    plot_size: '',
    planting_date: '',
    expected_harvest_date: '',
    growth_stage: 'seedling',
    notes: ''
  })

  // サンプルデータ（実際のAPIが利用できない場合の代替）
  const sampleVegetables: Vegetable[] = [
    {
      id: '1',
      name: 'トマト',
      variety_name: '桃太郎',
      scientific_name: 'Solanum lycopersicum',
      plot_name: 'A区画-1',
      plot_size: 100,
      planting_date: '2024-07-15',
      expected_harvest_date: '2024-10-15',
      status: 'growing',
      growth_stage: '開花期',
      notes: '順調に成長中。水やりは毎日実施。',
      created_at: '2024-07-15T09:00:00Z',
      updated_at: '2024-08-01T10:30:00Z',
      created_by: '田中太郎',
      company_id: 'company1',
      stats: {
        total_tasks: 15,
        completed_tasks: 8,
        photos_count: 24,
        reports_count: 8,
        days_since_planting: 25,
        estimated_days_to_harvest: 67
      }
    },
    {
      id: '2',
      name: 'レタス',
      variety_name: 'グリーンリーフ',
      scientific_name: 'Lactuca sativa',
      plot_name: 'B区画-2',
      plot_size: 50,
      planting_date: '2024-08-01',
      expected_harvest_date: '2024-09-15',
      status: 'growing',
      growth_stage: '結球期',
      notes: '虫害対策を強化中。',
      created_at: '2024-08-01T08:00:00Z',
      updated_at: '2024-08-08T14:20:00Z',
      created_by: '佐藤花子',
      company_id: 'company1',
      stats: {
        total_tasks: 10,
        completed_tasks: 6,
        photos_count: 12,
        reports_count: 6,
        days_since_planting: 8,
        estimated_days_to_harvest: 37
      }
    },
    {
      id: '3',
      name: 'キュウリ',
      variety_name: '夏すずみ',
      scientific_name: 'Cucumis sativus',
      plot_name: 'C区画-1',
      plot_size: 80,
      planting_date: '2024-06-20',
      expected_harvest_date: '2024-09-01',
      actual_harvest_date: '2024-08-28',
      status: 'completed',
      growth_stage: '収穫完了',
      notes: '豊作でした！来年も同じ品種で栽培予定。',
      created_at: '2024-06-20T10:00:00Z',
      updated_at: '2024-08-28T16:45:00Z',
      created_by: '山田一郎',
      company_id: 'company1',
      stats: {
        total_tasks: 20,
        completed_tasks: 20,
        photos_count: 45,
        reports_count: 15,
        days_since_planting: 69,
        estimated_days_to_harvest: 0
      }
    }
  ]

  useEffect(() => {
    fetchVegetables()
  }, [])

  useEffect(() => {
    filterVegetables()
  }, [vegetables, searchQuery, statusFilter])

  const fetchVegetables = async () => {
    try {
      setLoading(true)
      // 実際のAPIコール（現在は利用不可のためサンプルデータを使用）
      // const response = await fetch('/api/vegetables?company_id=company1')
      // const data = await response.json()
      
      // サンプルデータで代替
      setTimeout(() => {
        setVegetables(sampleVegetables)
        setLoading(false)
      }, 500)
      
    } catch (error) {
      console.error('野菜データの取得エラー:', error)
      setVegetables(sampleVegetables)
      setLoading(false)
    }
  }

  const filterVegetables = () => {
    let filtered = vegetables

    if (searchQuery) {
      filtered = filtered.filter(vegetable =>
        vegetable.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vegetable.variety_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vegetable.plot_name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    if (statusFilter && statusFilter !== 'all') {
      filtered = filtered.filter(vegetable => vegetable.status === statusFilter)
    }

    setFilteredVegetables(filtered)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (selectedVegetable) {
        // 編集処理
        const updatedVegetable = {
          ...selectedVegetable,
          ...formData,
          plot_size: parseFloat(formData.plot_size),
          updated_at: new Date().toISOString()
        }
        
        setVegetables(prev => prev.map(v => 
          v.id === selectedVegetable.id ? updatedVegetable : v
        ))
        setShowEditDialog(false)
      } else {
        // 新規作成処理
        const newVegetable: Vegetable = {
          id: Date.now().toString(),
          ...formData,
          plot_size: parseFloat(formData.plot_size),
          status: 'planning',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          created_by: '現在のユーザー',
          company_id: 'company1',
          stats: {
            total_tasks: 0,
            completed_tasks: 0,
            photos_count: 0,
            reports_count: 0,
            days_since_planting: 0,
            estimated_days_to_harvest: 90
          }
        }
        
        setVegetables(prev => [...prev, newVegetable])
        setShowAddDialog(false)
      }
      
      // フォームリセット
      setFormData({
        name: '',
        variety_name: '',
        scientific_name: '',
        plot_name: '',
        plot_size: '',
        planting_date: '',
        expected_harvest_date: '',
        growth_stage: 'seedling',
        notes: ''
      })
      setSelectedVegetable(null)
      
    } catch (error) {
      console.error('保存エラー:', error)
      alert('保存に失敗しました。もう一度お試しください。')
    }
  }

  const handleEdit = (vegetable: Vegetable) => {
    setSelectedVegetable(vegetable)
    setFormData({
      name: vegetable.name,
      variety_name: vegetable.variety_name,
      scientific_name: vegetable.scientific_name || '',
      plot_name: vegetable.plot_name,
      plot_size: vegetable.plot_size.toString(),
      planting_date: vegetable.planting_date,
      expected_harvest_date: vegetable.expected_harvest_date || '',
      growth_stage: vegetable.growth_stage,
      notes: vegetable.notes || ''
    })
    setShowEditDialog(true)
  }

  const handleDelete = async (vegetable: Vegetable) => {
    if (!confirm(`「${vegetable.name} (${vegetable.variety_name})」を削除しますか？\n関連するタスクや記録も削除されます。`)) {
      return
    }

    try {
      setVegetables(prev => prev.filter(v => v.id !== vegetable.id))
      alert('野菜データを削除しました')
    } catch (error) {
      console.error('削除エラー:', error)
      alert('削除に失敗しました')
    }
  }

  // 複数削除機能の関数群
  const handleEnterDeleteMode = () => {
    setDeleteMode(true)
    setSelectedVegetableIds(new Set())
  }

  const handleExitDeleteMode = () => {
    setDeleteMode(false)
    setSelectedVegetableIds(new Set())
  }

  const handleToggleVegetableSelection = (vegetableId: string) => {
    setSelectedVegetableIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(vegetableId)) {
        newSet.delete(vegetableId)
      } else {
        newSet.add(vegetableId)
      }
      return newSet
    })
  }

  const handleConfirmMultipleDelete = () => {
    if (selectedVegetableIds.size === 0) {
      alert('削除する野菜を選択してください')
      return
    }
    setShowDeleteConfirmDialog(true)
  }

  const handleExecuteMultipleDelete = async () => {
    try {
      setVegetables(prev => prev.filter(v => !selectedVegetableIds.has(v.id)))
      setShowDeleteConfirmDialog(false)
      setDeleteMode(false)
      setSelectedVegetableIds(new Set())
      alert(`${selectedVegetableIds.size}件の野菜データを削除しました`)
    } catch (error) {
      console.error('削除エラー:', error)
      alert('削除に失敗しました')
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      planning: { label: '計画中', color: 'bg-gray-100 text-gray-700' },
      growing: { label: '栽培中', color: 'bg-green-100 text-green-700' },
      harvesting: { label: '収穫中', color: 'bg-yellow-100 text-yellow-700' },
      completed: { label: '完了', color: 'bg-blue-100 text-blue-700' }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.planning
    return (
      <Badge className={`${config.color} border-none`}>
        {config.label}
      </Badge>
    )
  }

  const calculateProgress = (vegetable: Vegetable) => {
    if (!vegetable.stats) return 0
    return vegetable.stats.total_tasks > 0 
      ? Math.round((vegetable.stats.completed_tasks / vegetable.stats.total_tasks) * 100)
      : 0
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">野菜管理</h1>
          <p className="text-gray-600">栽培中の野菜を管理し、成長を記録しましょう</p>
        </div>
        <Button
          onClick={() => setShowAddDialog(true)}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          新しい野菜を追加
        </Button>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">管理中野菜</p>
                <p className="text-2xl font-bold">{vegetables.filter(v => v.status === 'growing').length}</p>
              </div>
              <Sprout className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">総栽培面積</p>
                <p className="text-2xl font-bold">{vegetables.reduce((sum, v) => sum + v.plot_size, 0)}㎡</p>
              </div>
              <MapPin className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">収穫予定</p>
                <p className="text-2xl font-bold">{vegetables.filter(v => v.status === 'harvesting').length}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">完了済み</p>
                <p className="text-2xl font-bold">{vegetables.filter(v => v.status === 'completed').length}</p>
              </div>
              <Archive className="w-8 h-8 text-gray-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 検索・フィルター */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="野菜名、品種、区画で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="ステータス" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            <SelectItem value="planning">計画中</SelectItem>
            <SelectItem value="growing">栽培中</SelectItem>
            <SelectItem value="harvesting">収穫中</SelectItem>
            <SelectItem value="completed">完了</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <BarChart3 className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <FileText className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 登録済み野菜一覧 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">登録済み野菜一覧</h2>
        <div className="flex gap-2">
          {!deleteMode ? (
            <Button
              onClick={handleEnterDeleteMode}
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              disabled={filteredVegetables.length === 0}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              削除
            </Button>
          ) : (
            <>
              <Button
                onClick={handleExitDeleteMode}
                variant="outline"
              >
                キャンセル
              </Button>
              <Button
                onClick={handleConfirmMultipleDelete}
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={selectedVegetableIds.size === 0}
              >
                確定 ({selectedVegetableIds.size}件選択中)
              </Button>
            </>
          )}
        </div>
      </div>

      {filteredVegetables.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Sprout className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">野菜が見つかりません</h3>
            <p className="text-gray-600 mb-4">検索条件を変更するか、新しい野菜を追加してください</p>
            <Button
              onClick={() => setShowAddDialog(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              野菜を追加
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className={viewMode === 'grid' 
          ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          : "space-y-4"
        }>
          {filteredVegetables.map((vegetable) => (
            <Card key={vegetable.id} className={`hover:shadow-lg transition-shadow ${deleteMode ? 'cursor-pointer' : ''} ${selectedVegetableIds.has(vegetable.id) ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {deleteMode && (
                      <Checkbox
                        checked={selectedVegetableIds.has(vegetable.id)}
                        onCheckedChange={() => handleToggleVegetableSelection(vegetable.id)}
                        className="mt-1"
                      />
                    )}
                    <div>
                      <CardTitle className="text-lg">{vegetable.name}</CardTitle>
                      <CardDescription className="font-medium text-gray-600">
                        {vegetable.variety_name}
                      </CardDescription>
                    </div>
                  </div>
                  {getStatusBadge(vegetable.status)}
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {/* 基本情報 */}
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span>{vegetable.plot_name} ({vegetable.plot_size}㎡)</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>植付: {formatDate(vegetable.planting_date)}</span>
                  </div>
                  
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">成長段階:</span> {vegetable.growth_stage}
                  </div>

                  {/* 進捗バー */}
                  {vegetable.stats && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>進捗</span>
                        <span>{calculateProgress(vegetable)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full transition-all"
                          style={{ width: `${calculateProgress(vegetable)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* 統計 */}
                  {vegetable.stats && (
                    <div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
                      <div className="text-center">
                        <div className="font-medium">{vegetable.stats.photos_count}</div>
                        <div>写真</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium">{vegetable.stats.reports_count}</div>
                        <div>報告</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium">{vegetable.stats.days_since_planting}</div>
                        <div>栽培日</div>
                      </div>
                    </div>
                  )}

                  {/* アクション */}
                  {!deleteMode && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedVegetable(vegetable)
                          setShowDetailDialog(true)
                        }}
                        className="flex-1"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        詳細
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(vegetable)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(vegetable)}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 野菜追加ダイアログ */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle>新しい野菜を追加</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">野菜名 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="例: トマト"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="variety_name">品種名 *</Label>
                <Input
                  id="variety_name"
                  value={formData.variety_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, variety_name: e.target.value }))}
                  placeholder="例: 桃太郎"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scientific_name">学名</Label>
              <Input
                id="scientific_name"
                value={formData.scientific_name}
                onChange={(e) => setFormData(prev => ({ ...prev, scientific_name: e.target.value }))}
                placeholder="例: Solanum lycopersicum"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plot_name">区画名 *</Label>
                <Input
                  id="plot_name"
                  value={formData.plot_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, plot_name: e.target.value }))}
                  placeholder="例: A区画-1"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="plot_size">栽培面積 (㎡) *</Label>
                <Input
                  id="plot_size"
                  type="number"
                  step="0.1"
                  value={formData.plot_size}
                  onChange={(e) => setFormData(prev => ({ ...prev, plot_size: e.target.value }))}
                  placeholder="100"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="planting_date">植付日 *</Label>
                <Input
                  id="planting_date"
                  type="date"
                  value={formData.planting_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, planting_date: e.target.value }))}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="expected_harvest_date">収穫予定日</Label>
                <Input
                  id="expected_harvest_date"
                  type="date"
                  value={formData.expected_harvest_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, expected_harvest_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="growth_stage">成長段階</Label>
              <Select
                value={formData.growth_stage}
                onValueChange={(value) => setFormData(prev => ({ ...prev, growth_stage: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="seedling">苗植え期</SelectItem>
                  <SelectItem value="growing">生育期</SelectItem>
                  <SelectItem value="flowering">開花期</SelectItem>
                  <SelectItem value="fruiting">結実期</SelectItem>
                  <SelectItem value="harvesting">収穫期</SelectItem>
                  <SelectItem value="completed">栽培完了</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">備考</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="栽培に関する特記事項があれば記入してください"
                rows={3}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddDialog(false)}
                className="flex-1"
              >
                キャンセル
              </Button>
              <Button type="submit" className="flex-1 bg-green-600 hover:bg-green-700">
                追加
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 野菜編集ダイアログ */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle>野菜情報を編集</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* フォーム内容は追加ダイアログと同じ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">野菜名 *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="例: トマト"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-variety_name">品種名 *</Label>
                <Input
                  id="edit-variety_name"
                  value={formData.variety_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, variety_name: e.target.value }))}
                  placeholder="例: 桃太郎"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-scientific_name">学名</Label>
              <Input
                id="edit-scientific_name"
                value={formData.scientific_name}
                onChange={(e) => setFormData(prev => ({ ...prev, scientific_name: e.target.value }))}
                placeholder="例: Solanum lycopersicum"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-plot_name">区画名 *</Label>
                <Input
                  id="edit-plot_name"
                  value={formData.plot_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, plot_name: e.target.value }))}
                  placeholder="例: A区画-1"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-plot_size">栽培面積 (㎡) *</Label>
                <Input
                  id="edit-plot_size"
                  type="number"
                  step="0.1"
                  value={formData.plot_size}
                  onChange={(e) => setFormData(prev => ({ ...prev, plot_size: e.target.value }))}
                  placeholder="100"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-planting_date">植付日 *</Label>
                <Input
                  id="edit-planting_date"
                  type="date"
                  value={formData.planting_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, planting_date: e.target.value }))}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-expected_harvest_date">収穫予定日</Label>
                <Input
                  id="edit-expected_harvest_date"
                  type="date"
                  value={formData.expected_harvest_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, expected_harvest_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-growth_stage">成長段階</Label>
              <Select
                value={formData.growth_stage}
                onValueChange={(value) => setFormData(prev => ({ ...prev, growth_stage: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="seedling">苗植え期</SelectItem>
                  <SelectItem value="growing">生育期</SelectItem>
                  <SelectItem value="flowering">開花期</SelectItem>
                  <SelectItem value="fruiting">結実期</SelectItem>
                  <SelectItem value="harvesting">収穫期</SelectItem>
                  <SelectItem value="completed">栽培完了</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-notes">備考</Label>
              <Textarea
                id="edit-notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="栽培に関する特記事項があれば記入してください"
                rows={3}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditDialog(false)}
                className="flex-1"
              >
                キャンセル
              </Button>
              <Button type="submit" className="flex-1 bg-green-600 hover:bg-green-700">
                保存
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 野菜詳細ダイアログ */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="w-full max-h-[90vh] overflow-y-auto bg-white mx-4 sm:max-w-[720px] sm:mx-auto md:max-w-[960px]">
          {selectedVegetable && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">
                  {selectedVegetable.name} ({selectedVegetable.variety_name})
                </DialogTitle>
              </DialogHeader>
              
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">概要</TabsTrigger>
                  <TabsTrigger value="progress">進捗</TabsTrigger>
                  <TabsTrigger value="records">記録</TabsTrigger>
                  <TabsTrigger value="analytics">分析</TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">基本情報</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="space-y-2">
                          <div className="flex items-baseline">
                            <span className="text-gray-600 w-40 flex-shrink-0">野菜名</span>
                            <span className="font-medium break-words">{selectedVegetable.name}</span>
                          </div>
                          <div className="flex items-baseline">
                            <span className="text-gray-600 w-40 flex-shrink-0">品種</span>
                            <span className="font-medium break-words">{selectedVegetable.variety_name}</span>
                          </div>
                          {selectedVegetable.scientific_name && (
                            <div className="flex items-baseline">
                              <span className="text-gray-600 w-40 flex-shrink-0">学名</span>
                              <span className="font-medium italic break-words">{selectedVegetable.scientific_name}</span>
                            </div>
                          )}
                          <div className="flex items-baseline">
                            <span className="text-gray-600 w-40 flex-shrink-0">区画</span>
                            <span className="font-medium break-words">{selectedVegetable.plot_name}</span>
                          </div>
                          <div className="flex items-baseline">
                            <span className="text-gray-600 w-40 flex-shrink-0">面積</span>
                            <span className="font-medium">{selectedVegetable.plot_size} ㎡</span>
                          </div>
                          <div className="flex items-baseline">
                            <span className="text-gray-600 w-40 flex-shrink-0">ステータス</span>
                            <div>{getStatusBadge(selectedVegetable.status)}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">栽培スケジュール</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="space-y-2">
                          <div className="flex items-baseline">
                            <span className="text-gray-600 w-40 flex-shrink-0">植付日</span>
                            <span className="font-medium">{formatDate(selectedVegetable.planting_date)}</span>
                          </div>
                          {selectedVegetable.expected_harvest_date && (
                            <div className="flex items-baseline">
                              <span className="text-gray-600 w-40 flex-shrink-0">収穫予定</span>
                              <span className="font-medium">{formatDate(selectedVegetable.expected_harvest_date)}</span>
                            </div>
                          )}
                          {selectedVegetable.actual_harvest_date && (
                            <div className="flex items-baseline">
                              <span className="text-gray-600 w-40 flex-shrink-0">実際の収穫</span>
                              <span className="font-medium">{formatDate(selectedVegetable.actual_harvest_date)}</span>
                            </div>
                          )}
                          <div className="flex items-baseline">
                            <span className="text-gray-600 w-40 flex-shrink-0">成長段階</span>
                            <span className="font-medium break-words">{selectedVegetable.growth_stage}</span>
                          </div>
                          {selectedVegetable.stats && (
                            <div className="flex items-baseline">
                              <span className="text-gray-600 w-40 flex-shrink-0">栽培日数</span>
                              <span className="font-medium">{selectedVegetable.stats.days_since_planting} 日</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  
                  {selectedVegetable.notes && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">備考</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4">
                        <p className="text-gray-700 break-words leading-relaxed">{selectedVegetable.notes}</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
                
                <TabsContent value="progress" className="space-y-4 mt-4">
                  {selectedVegetable.stats && (
                    <>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">作業進捗</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="flex justify-between text-sm">
                              <span>作業完了率</span>
                              <span className="font-medium">{calculateProgress(selectedVegetable)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                              <div 
                                className="bg-green-600 h-3 rounded-full transition-all"
                                style={{ width: `${calculateProgress(selectedVegetable)}%` }}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-gray-600">完了タスク:</span>
                                <span className="font-medium ml-2">{selectedVegetable.stats.completed_tasks}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">総タスク数:</span>
                                <span className="font-medium ml-2">{selectedVegetable.stats.total_tasks}</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Card>
                          <CardContent className="p-4 text-center">
                            <Camera className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                            <div className="text-2xl font-bold">{selectedVegetable.stats.photos_count}</div>
                            <div className="text-sm text-gray-600">記録写真</div>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardContent className="p-4 text-center">
                            <FileText className="w-8 h-8 mx-auto mb-2 text-green-600" />
                            <div className="text-2xl font-bold">{selectedVegetable.stats.reports_count}</div>
                            <div className="text-sm text-gray-600">作業報告</div>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardContent className="p-4 text-center">
                            <Calendar className="w-8 h-8 mx-auto mb-2 text-yellow-600" />
                            <div className="text-2xl font-bold">{selectedVegetable.stats.estimated_days_to_harvest}</div>
                            <div className="text-sm text-gray-600">収穫まで（予定）</div>
                          </CardContent>
                        </Card>
                      </div>
                    </>
                  )}
                </TabsContent>
                
                <TabsContent value="records" className="space-y-4 mt-4">
                  <div className="text-center py-12 bg-gradient-to-br from-blue-50 to-green-50 rounded-lg border border-blue-100">
                    <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                      <Activity className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">作業記録・タスク管理</h3>
                    <p className="text-gray-600 mb-6 max-w-md mx-auto">
                      {selectedVegetable.name}の詳細な作業履歴、スケジュール管理、進捗確認はガンチャートページで行えます。
                    </p>
                    <Button 
                      onClick={() => {
                        setShowDetailDialog(false)
                        router.push('/dashboard/gantt')
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      ガンチャートページを開く
                    </Button>
                    <div className="mt-4 text-xs text-gray-500">
                      作業進捗の可視化・タスクスケジューリング・チーム協働
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="analytics" className="space-y-4 mt-4">
                  <div className="text-center py-12 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-100">
                    <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                      <BarChart3 className="w-8 h-8 text-purple-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">データ分析・パフォーマンス</h3>
                    <p className="text-gray-600 mb-6 max-w-md mx-auto">
                      {selectedVegetable.name}の収穫量、コスト分析、ROI、季節別パフォーマンスなどの詳細分析データをご覧いただけます。
                    </p>
                    <Button 
                      onClick={() => {
                        setShowDetailDialog(false)
                        router.push('/dashboard/analytics')
                      }}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5"
                    >
                      <Target className="w-4 h-4 mr-2" />
                      データ分析ページを開く
                    </Button>
                    <div className="mt-4 text-xs text-gray-500">
                      収益性分析・効率性評価・品質トレンド・コスト最適化
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
              
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => handleEdit(selectedVegetable)}
                  className="flex-1"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  編集
                </Button>
                <Button
                  onClick={() => setShowDetailDialog(false)}
                  className="flex-1"
                >
                  閉じる
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900">
              野菜データを削除
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <p className="text-gray-600 mb-4">
              選択した {selectedVegetableIds.size} 件の野菜データを削除しますか？
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                <strong>注意:</strong> 削除されたデータは復元できません。関連するタスクや記録も全て削除されます。
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirmDialog(false)}
              className="flex-1"
            >
              削除キャンセル
            </Button>
            <Button
              onClick={handleExecuteMultipleDelete}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              削除実行
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}