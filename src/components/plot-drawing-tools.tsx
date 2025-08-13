'use client'

import { useState, useCallback, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  Square, 
  Edit, 
  Trash2, 
  Save, 
  Undo2,
  MapPin,
  Ruler,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react'
import * as turf from '@turf/turf'
import type { Feature, Polygon, Position } from 'geojson'

interface PlotDrawingState {
  isDrawing: boolean
  currentPoints: Position[]
  completedPolygons: PlotPolygon[]
  selectedPolygon: PlotPolygon | null
}

interface PlotPolygon {
  id: string
  name: string
  description?: string
  coordinates: Position[]
  area: number // 面積（㎡）
  perimeter: number // 周囲長（m）
  isValid: boolean
  isVisible: boolean
  color: string
  createdAt: Date
}

interface PlotDrawingToolsProps {
  onPolygonComplete: (polygon: PlotPolygon) => void
  onPolygonUpdate: (polygon: PlotPolygon) => void
  onPolygonDelete: (polygonId: string) => void
  isActive: boolean
  mapInstance?: any
}

const PLOT_COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'
]

export default function PlotDrawingTools({
  onPolygonComplete,
  onPolygonUpdate,
  onPolygonDelete,
  isActive,
  mapInstance
}: PlotDrawingToolsProps) {
  const [drawingState, setDrawingState] = useState<PlotDrawingState>({
    isDrawing: false,
    currentPoints: [],
    completedPolygons: [],
    selectedPolygon: null
  })
  
  const [showDetails, setShowDetails] = useState(false)
  const [editingPolygon, setEditingPolygon] = useState<PlotPolygon | null>(null)
  const [polygonForm, setPolygonForm] = useState({
    name: '',
    description: ''
  })

  // 描画開始
  const startDrawing = useCallback(() => {
    setDrawingState(prev => ({
      ...prev,
      isDrawing: true,
      currentPoints: []
    }))
  }, [])

  // ポイント追加
  const addPoint = useCallback((lng: number, lat: number) => {
    if (!drawingState.isDrawing) return

    setDrawingState(prev => ({
      ...prev,
      currentPoints: [...prev.currentPoints, [lng, lat]]
    }))
  }, [drawingState.isDrawing])

  // ポリゴン完成
  const completePolygon = useCallback(() => {
    if (drawingState.currentPoints.length < 3) {
      alert('ポリゴンを完成させるには最低3点が必要です')
      return
    }

    // 最初の点と最後の点を結んでポリゴンを閉じる
    const closedCoordinates = [
      ...drawingState.currentPoints,
      drawingState.currentPoints[0]
    ]

    try {
      // GeoJSONポリゴン作成
      const polygon: Feature<Polygon> = turf.polygon([closedCoordinates])
      
      // 面積計算（㎡）
      const area = turf.area(polygon)
      
      // 周囲長計算（m）
      const perimeter = turf.length(polygon, { units: 'meters' })
      
      // ポリゴンの有効性チェック
      const isValid = validatePolygon(polygon)
      
      const newPolygon: PlotPolygon = {
        id: `plot_${Date.now()}`,
        name: `農地 ${drawingState.completedPolygons.length + 1}`,
        description: '',
        coordinates: closedCoordinates,
        area: Math.round(area * 100) / 100,
        perimeter: Math.round(perimeter * 100) / 100,
        isValid,
        isVisible: true,
        color: PLOT_COLORS[drawingState.completedPolygons.length % PLOT_COLORS.length],
        createdAt: new Date()
      }

      setDrawingState(prev => ({
        ...prev,
        isDrawing: false,
        currentPoints: [],
        completedPolygons: [...prev.completedPolygons, newPolygon],
        selectedPolygon: newPolygon
      }))

      // 名前設定ダイアログを開く
      setEditingPolygon(newPolygon)
      setPolygonForm({
        name: newPolygon.name,
        description: newPolygon.description || ''
      })
      setShowDetails(true)

      onPolygonComplete(newPolygon)
    } catch (error) {
      console.error('ポリゴン作成エラー:', error)
      alert('ポリゴンの作成に失敗しました')
    }
  }, [drawingState.currentPoints, drawingState.completedPolygons.length, onPolygonComplete])

  // ポリゴンの有効性検証
  const validatePolygon = useCallback((polygon: Feature<Polygon>): boolean => {
    try {
      // 自己交差チェック
      const selfIntersects = turf.kinks(polygon)
      if (selfIntersects.features.length > 0) {
        console.warn('ポリゴンに自己交差があります')
        return false
      }

      // 面積チェック（最小面積: 1㎡）
      const area = turf.area(polygon)
      if (area < 1) {
        console.warn('ポリゴンの面積が小さすぎます')
        return false
      }

      return true
    } catch (error) {
      console.error('ポリゴン検証エラー:', error)
      return false
    }
  }, [])

  // 描画キャンセル
  const cancelDrawing = useCallback(() => {
    setDrawingState(prev => ({
      ...prev,
      isDrawing: false,
      currentPoints: []
    }))
  }, [])

  // 最後のポイントを削除
  const undoLastPoint = useCallback(() => {
    if (drawingState.currentPoints.length === 0) return
    
    setDrawingState(prev => ({
      ...prev,
      currentPoints: prev.currentPoints.slice(0, -1)
    }))
  }, [drawingState.currentPoints.length])

  // ポリゴン選択
  const selectPolygon = useCallback((polygon: PlotPolygon) => {
    setDrawingState(prev => ({
      ...prev,
      selectedPolygon: polygon
    }))
  }, [])

  // ポリゴン削除
  const deletePolygon = useCallback((polygonId: string) => {
    if (!confirm('この農地を削除しますか？')) return

    setDrawingState(prev => ({
      ...prev,
      completedPolygons: prev.completedPolygons.filter(p => p.id !== polygonId),
      selectedPolygon: prev.selectedPolygon?.id === polygonId ? null : prev.selectedPolygon
    }))

    onPolygonDelete(polygonId)
  }, [onPolygonDelete])

  // ポリゴン表示/非表示切り替え
  const togglePolygonVisibility = useCallback((polygonId: string) => {
    setDrawingState(prev => ({
      ...prev,
      completedPolygons: prev.completedPolygons.map(polygon =>
        polygon.id === polygonId
          ? { ...polygon, isVisible: !polygon.isVisible }
          : polygon
      )
    }))
  }, [])

  // ポリゴン情報更新
  const updatePolygonInfo = useCallback(() => {
    if (!editingPolygon) return

    const updatedPolygon = {
      ...editingPolygon,
      name: polygonForm.name,
      description: polygonForm.description
    }

    setDrawingState(prev => ({
      ...prev,
      completedPolygons: prev.completedPolygons.map(polygon =>
        polygon.id === editingPolygon.id ? updatedPolygon : polygon
      ),
      selectedPolygon: prev.selectedPolygon?.id === editingPolygon.id ? updatedPolygon : prev.selectedPolygon
    }))

    onPolygonUpdate(updatedPolygon)
    setShowDetails(false)
    setEditingPolygon(null)
  }, [editingPolygon, polygonForm, onPolygonUpdate])

  // 面積の単位変換
  const formatArea = useCallback((areaSqm: number): string => {
    if (areaSqm >= 10000) {
      return `${(areaSqm / 10000).toFixed(2)} ha`
    } else {
      return `${areaSqm.toFixed(1)} ㎡`
    }
  }, [])

  if (!isActive) {
    return null
  }

  return (
    <div className="space-y-4">
      {/* 描画コントロール */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Square className="w-5 h-5 mr-2" />
            農地描画ツール
          </CardTitle>
          <CardDescription>
            地図上をクリックして農地の境界を描画してください
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!drawingState.isDrawing ? (
            <Button
              onClick={startDrawing}
              className="w-full"
              size="lg"
            >
              <Square className="w-4 h-4 mr-2" />
              農地描画を開始
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div>
                  <p className="font-medium text-blue-800">描画中</p>
                  <p className="text-sm text-blue-600">
                    {drawingState.currentPoints.length} 点設定済み
                  </p>
                </div>
                <Badge variant="outline" className="bg-blue-100 text-blue-700">
                  アクティブ
                </Badge>
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={completePolygon}
                  disabled={drawingState.currentPoints.length < 3}
                  className="flex-1"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  完成
                </Button>
                <Button
                  onClick={undoLastPoint}
                  disabled={drawingState.currentPoints.length === 0}
                  variant="outline"
                >
                  <Undo2 className="w-4 h-4" />
                </Button>
                <Button
                  onClick={cancelDrawing}
                  variant="outline"
                >
                  キャンセル
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 完成した農地一覧 */}
      {drawingState.completedPolygons.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">描画済み農地</CardTitle>
            <CardDescription>
              {drawingState.completedPolygons.length} 個の農地が設定されています
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {drawingState.completedPolygons.map((polygon) => (
                <div
                  key={polygon.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    drawingState.selectedPolygon?.id === polygon.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => selectPolygon(polygon)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: polygon.color }}
                        />
                        <span className="font-medium">{polygon.name}</span>
                        {!polygon.isValid && (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                      
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>面積: {formatArea(polygon.area)}</div>
                        <div>周囲: {polygon.perimeter.toFixed(1)} m</div>
                        {polygon.description && (
                          <div className="text-xs">{polygon.description}</div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          togglePolygonVisibility(polygon.id)
                        }}
                        title={polygon.isVisible ? '非表示にする' : '表示する'}
                      >
                        {polygon.isVisible ? (
                          <Eye className="w-4 h-4" />
                        ) : (
                          <EyeOff className="w-4 h-4" />
                        )}
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingPolygon(polygon)
                          setPolygonForm({
                            name: polygon.name,
                            description: polygon.description || ''
                          })
                          setShowDetails(true)
                        }}
                        title="編集"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          deletePolygon(polygon.id)
                        }}
                        title="削除"
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 農地詳細編集ダイアログ */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>農地情報の設定</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="plotName">農地名</Label>
              <Input
                id="plotName"
                value={polygonForm.name}
                onChange={(e) => setPolygonForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="例: 第1圃場"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="plotDescription">説明</Label>
              <Textarea
                id="plotDescription"
                value={polygonForm.description}
                onChange={(e) => setPolygonForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="農地の特徴や用途などを入力"
                rows={3}
              />
            </div>
            
            {editingPolygon && (
              <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                <div className="text-sm">
                  <span className="text-gray-600">面積:</span>
                  <span className="ml-2 font-medium">{formatArea(editingPolygon.area)}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-600">周囲:</span>
                  <span className="ml-2 font-medium">{editingPolygon.perimeter.toFixed(1)} m</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-600">頂点数:</span>
                  <span className="ml-2 font-medium">{editingPolygon.coordinates.length - 1}</span>
                </div>
              </div>
            )}
            
            <div className="flex gap-2 pt-4">
              <Button
                onClick={() => setShowDetails(false)}
                variant="outline"
                className="flex-1"
              >
                キャンセル
              </Button>
              <Button
                onClick={updatePolygonInfo}
                className="flex-1"
              >
                <Save className="w-4 h-4 mr-2" />
                保存
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}