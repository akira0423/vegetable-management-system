'use client'

import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react'
import maplibregl from 'maplibre-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import 'maplibre-gl/dist/maplibre-gl.css'
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { generateMesh, cellsToGeoJSON } from '@/lib/mesh-generator'
import SearchBox from '@/components/search-box'
import {
  Map as MapIcon,
  Square,
  Grid3X3,
  Save,
  Trash2,
  Edit3,
  Eye,
  EyeOff,
  RotateCcw,
  Info,
  Settings,
  Layers,
  Search,
  MousePointer,
  Hand,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Camera
} from 'lucide-react'
import type { MeshCell } from '@/types/database'
import type { Feature, Polygon } from 'geojson'

interface FarmAreaData {
  id?: string
  name: string
  description: string
  geometry: Feature<Polygon>
  meshCells: MeshCell[]
  area_hectares: number
  area_square_meters: number
  estimated_cell_count: number
}

interface ProfessionalFarmEditorProps {
  onAreaSaved?: (areaData: FarmAreaData) => void
  onCellsSelected?: (cells: MeshCell[]) => void
  initialCenter?: [number, number]
  initialZoom?: number
  height?: string
  // 🆕 複数ポリゴン表示対応
  onMapRightClick?: (event: any) => void
  onPolygonDoubleClick?: (vegetableId: string) => void
  visiblePolygons?: Set<string>
  polygonColors?: Map<string, string>
  isTouchDevice?: boolean
}

interface ProfessionalFarmEditorRef {
  flyToLocation: (lng: number, lat: number, zoom?: number) => void
  fitBounds: (bounds: [[number, number], [number, number]]) => void
  // 🆕 複数ポリゴン管理用メソッド
  showPolygon?: (vegetable: any) => void
  hidePolygon?: (vegetableId: string) => void
  showMultiplePolygons?: (vegetables: any[]) => void
  clearAllPolygons?: () => void
  // レガシーサポート
  showVegetablePolygon?: (vegetable: any) => void
  clearVegetablePolygons?: () => void
  enablePolygonEditMode?: (vegetable: any) => void
  saveEditedPolygon?: (vegetableId: string) => any
  updatePolygonColor?: (vegetableId: string, newColor: string) => void
}

const ProfessionalFarmEditor = forwardRef<ProfessionalFarmEditorRef, ProfessionalFarmEditorProps>(({
  onAreaSaved,
  onCellsSelected,
  initialCenter = [139.6917, 35.6895],
  initialZoom = 16,
  height = '100vh',
  // 🆕 複数ポリゴン表示対応props
  onMapRightClick,
  onPolygonDoubleClick,
  visiblePolygons = new Set(),
  polygonColors = new Map(),
  isTouchDevice = false
}, ref) => {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const draw = useRef<MapboxDraw | null>(null)
  
  // 状態管理
  const [isMapLoaded, setIsMapLoaded] = useState(false)
  const [currentMode, setCurrentMode] = useState<'pan' | 'draw'>('pan')
  const [currentArea, setCurrentArea] = useState<FarmAreaData | null>(null)
  const [meshCells, setMeshCells] = useState<MeshCell[]>([])
  const [selectedCells, setSelectedCells] = useState<MeshCell[]>([])
  const [showMesh, setShowMesh] = useState(true)
  const [isGeneratingMesh, setIsGeneratingMesh] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [meshSize, setMeshSize] = useState(5)
  const [mapStyle, setMapStyle] = useState<'standard' | 'pale' | 'photo'>('photo')
  
  // フォーム状態
  const [areaName, setAreaName] = useState('')
  const [areaDescription, setAreaDescription] = useState('')
  
  // シンプルな処理フラグ
  const processingRef = useRef(false)
  
  // 🆕 複数ポリゴン表示管理
  const [vegetablePolygons, setVegetablePolygons] = useState<Map<string, any>>(new Map())
  const vegetableLayersRef = useRef<Map<string, string>>(new Map()) // vegetableId -> layerId
  const isHandlingCreateRef = useRef(false)
  
  // 地図初期化
  useEffect(() => {
    if (!mapContainer.current || map.current) return

    // 地図スタイルを取得
    const getMapStyle = (styleType: 'standard' | 'pale' | 'photo') => {
      const styles = {
        standard: {
          source: 'gsi-standard',
          tiles: ['https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png'],
          attribution: '<a href="https://www.gsi.go.jp/" target="_blank">国土地理院 標準地図</a>'
        },
        pale: {
          source: 'gsi-pale',
          tiles: ['https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'],
          attribution: '<a href="https://www.gsi.go.jp/" target="_blank">国土地理院 淡色地図</a>'
        },
        photo: {
          source: 'gsi-photo',
          tiles: ['https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg'],
          attribution: '<a href="https://www.gsi.go.jp/" target="_blank">国土地理院 航空写真</a>'
        }
      }
      return styles[styleType]
    }

    const currentStyle = getMapStyle(mapStyle)

    // MapLibre GL JS初期化
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          [currentStyle.source]: {
            type: 'raster',
            tiles: currentStyle.tiles,
            tileSize: 256,
            attribution: currentStyle.attribution
          }
        },
        layers: [
          {
            id: currentStyle.source,
            type: 'raster',
            source: currentStyle.source
          }
        ]
      },
      center: initialCenter,
      zoom: initialZoom,
      attributionControl: true
    })

    // Mapbox Draw初期化
    draw.current = new MapboxDraw({
      displayControlsDefault: false,
      controls: {},
      styles: [
        // ポリゴン塗りつぶし（プロフェッショナル緑ベースデザイン）
        {
          id: 'gl-draw-polygon-fill-inactive',
          type: 'fill',
          filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
          paint: {
            'fill-color': '#22c55e', // 美しい緑
            'fill-opacity': 0.25
          }
        },
        {
          id: 'gl-draw-polygon-fill-active',
          type: 'fill',
          filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
          paint: {
            'fill-color': '#16a34a', // より深い緑
            'fill-opacity': 0.35
          }
        },
        // 外側の白いハロー効果（視認性向上）
        {
          id: 'gl-draw-polygon-stroke-halo',
          type: 'line',
          filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
          layout: {
            'line-cap': 'round',
            'line-join': 'round'
          },
          paint: {
            'line-color': '#ffffff',
            'line-width': 6,
            'line-opacity': 0.8,
            'line-blur': 1
          }
        },
        // メインの緑の境界線（非アクティブ）
        {
          id: 'gl-draw-polygon-stroke-inactive',
          type: 'line',
          filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
          layout: {
            'line-cap': 'round',
            'line-join': 'round'
          },
          paint: {
            'line-color': '#15803d', // 濃い緑
            'line-width': 3,
            'line-opacity': 0.9
          }
        },
        // メインの緑の境界線（アクティブ）
        {
          id: 'gl-draw-polygon-stroke-active',
          type: 'line',
          filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
          layout: {
            'line-cap': 'round',
            'line-join': 'round'
          },
          paint: {
            'line-color': '#166534', // より濃い緑
            'line-width': 4,
            'line-opacity': 1.0
          }
        },
        // 内側のアクセントライン
        {
          id: 'gl-draw-polygon-stroke-accent',
          type: 'line',
          filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
          layout: {
            'line-cap': 'round',
            'line-join': 'round'
          },
          paint: {
            'line-color': '#84cc16', // ライムグリーン
            'line-width': 1.5,
            'line-opacity': 0.7,
            'line-offset': -1
          }
        },
        // 描画中のライン（進行中の線）
        {
          id: 'gl-draw-line',
          type: 'line',
          filter: ['all', ['==', '$type', 'LineString'], ['!=', 'mode', 'static']],
          layout: {
            'line-cap': 'round',
            'line-join': 'round'
          },
          paint: {
            'line-color': '#22c55e',
            'line-width': 3,
            'line-opacity': 0.8,
            'line-dasharray': [3, 2] // 上品な点線効果
          }
        },
        // 描画中ラインのハロー効果
        {
          id: 'gl-draw-line-halo',
          type: 'line',
          filter: ['all', ['==', '$type', 'LineString'], ['!=', 'mode', 'static']],
          layout: {
            'line-cap': 'round',
            'line-join': 'round'
          },
          paint: {
            'line-color': '#ffffff',
            'line-width': 5,
            'line-opacity': 0.6,
            'line-blur': 1
          }
        },
        // 頂点の外側リング（視認性向上）
        {
          id: 'gl-draw-polygon-and-line-vertex-halo',
          type: 'circle',
          filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['!=', 'mode', 'static']],
          paint: {
            'circle-radius': 9,
            'circle-color': '#ffffff',
            'circle-opacity': 0.8,
            'circle-stroke-color': '#e5e7eb',
            'circle-stroke-width': 1
          }
        },
        // 通常の頂点
        {
          id: 'gl-draw-polygon-and-line-vertex-inactive',
          type: 'circle',
          filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['!=', 'mode', 'static'], ['!=', 'active', 'true']],
          paint: {
            'circle-radius': 5,
            'circle-color': '#22c55e',
            'circle-stroke-color': '#166534',
            'circle-stroke-width': 2
          }
        },
        // アクティブな頂点（より大きく目立つ）
        {
          id: 'gl-draw-polygon-and-line-vertex-active',
          type: 'circle',
          filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['==', 'active', 'true']],
          paint: {
            'circle-radius': 7,
            'circle-color': '#84cc16',
            'circle-stroke-color': '#166534',
            'circle-stroke-width': 3
          }
        },
        // 中間点（必要に応じて表示）
        {
          id: 'gl-draw-polygon-midpoint',
          type: 'circle',
          filter: ['all', ['==', 'meta', 'midpoint'], ['==', '$type', 'Point']],
          paint: {
            'circle-radius': 3,
            'circle-color': '#a3a3a3',
            'circle-opacity': 0.6
          }
        }
      ]
    })

    map.current.addControl(draw.current, 'top-left')

    // マップ読み込み完了イベント
    map.current.on('load', () => {
      setIsMapLoaded(true)
      
      // メッシュレイヤー追加
      if (map.current) {
        addMeshLayers()
      }
    })

    // 描画イベント
    map.current.on('draw.create', handleDrawCreate)
    map.current.on('draw.update', handleDrawUpdate)
    map.current.on('draw.delete', handleDrawDelete)
    map.current.on('click', handleMapClick)
    map.current.on('contextmenu', handleRightClick)
    map.current.on('dblclick', handleMapDoubleClick)
    

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  // メッシュレイヤー追加
  const addMeshLayers = useCallback(() => {
    if (!map.current) return

    map.current.addSource('mesh-cells', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
    })

    // メッシュセル塗りつぶし（改善された色分け）
    map.current.addLayer({
      id: 'mesh-cells-fill',
      type: 'fill',
      source: 'mesh-cells',
      paint: {
        'fill-color': [
          'case',
          ['get', 'isSelected'], '#2563eb', // 選択中: 鮮やかな青
          ['get', 'isOccupied'], '#f59e0b', // 使用中: オレンジ
          '#f3f4f6' // 未使用: 薄いグレー
        ],
        'fill-opacity': [
          'case',
          ['get', 'isSelected'], 0.85, // 選択中はより不透明
          ['get', 'isOccupied'], 0.7,
          0.3 // 未使用はより透明
        ]
      },
      layout: {
        'visibility': showMesh ? 'visible' : 'none'
      }
    })

    // メッシュセル枠線（改善された視認性）
    map.current.addLayer({
      id: 'mesh-cells-stroke',
      type: 'line',
      source: 'mesh-cells',
      paint: {
        'line-color': [
          'case',
          ['get', 'isSelected'], '#1d4ed8', // 選択中: 濃い青
          ['get', 'isOccupied'], '#d97706', // 使用中: 濃いオレンジ
          '#d1d5db' // 未使用: グレー
        ],
        'line-width': [
          'case',
          ['get', 'isSelected'], 3, // 選択中は太い線
          ['get', 'isOccupied'], 2,
          1
        ],
        'line-opacity': [
          'case',
          ['get', 'isSelected'], 1.0, // 選択中は完全不透明
          ['get', 'isOccupied'], 0.9,
          0.6
        ]
      },
      layout: {
        'visibility': showMesh ? 'visible' : 'none'
      }
    })

    // 選択セルのハイライトレイヤー（アニメーション効果）
    map.current.addLayer({
      id: 'mesh-cells-highlight',
      type: 'line',
      source: 'mesh-cells',
      paint: {
        'line-color': '#ffffff',
        'line-width': [
          'case',
          ['get', 'isSelected'], 4,
          0
        ],
        'line-opacity': [
          'case',
          ['get', 'isSelected'], 0.8,
          0
        ],
        'line-blur': 2
      },
      layout: {
        'visibility': showMesh ? 'visible' : 'none'
      }
    })
  }, [showMesh])

  // ポリゴン面積計算（簡易版）
  const calculatePolygonArea = (feature: Feature<Polygon>): number => {
    const coords = feature.geometry.coordinates[0]
    let area = 0
    
    for (let i = 0; i < coords.length - 1; i++) {
      const [x1, y1] = coords[i]
      const [x2, y2] = coords[i + 1]
      area += (x2 - x1) * (y2 + y1) / 2
    }
    
    return Math.abs(area) * 111000 * 111000 * Math.cos((coords[0][1] * Math.PI) / 180)
  }

  // シンプルなエリア処理（依存関係なし）
  const handlePolygonComplete = (feature: Feature<Polygon>) => {
    // 重複実行防止
    if (processingRef.current) return
    processingRef.current = true

    try {
      const area_square_meters = calculatePolygonArea(feature)
      const area_hectares = area_square_meters / 10000
      const estimated_cell_count = Math.ceil(area_square_meters / 25)

      const areaData: FarmAreaData = {
        name: areaName || `農地_${Date.now()}`,
        description: areaDescription || '',
        geometry: feature,
        meshCells: [],
        area_hectares,
        area_square_meters,
        estimated_cell_count
      }

      setCurrentArea(areaData)
      
      // モーダル表示（即座実行）
      if (onAreaSaved) {
        // 次のフレームで実行してスタックオーバーフローを防止
        requestAnimationFrame(() => {
          onAreaSaved(areaData)
          processingRef.current = false
        })
      } else {
        processingRef.current = false
      }
    } catch (error) {
      
      processingRef.current = false
    }
  }

  // シンプルな描画完了イベント（依存関係なし）
  const handleDrawCreate = (e: any) => {
    // 重複処理防止
    if (isHandlingCreateRef.current) {
      
      return
    }
    
    const feature = e.features?.[0]
    
    if (feature?.geometry?.type === 'Polygon') {
      isHandlingCreateRef.current = true
      
      
      // ポリゴン完成処理（モード変更前に実行）
      handlePolygonComplete(feature)
      
      // 安全なモード変更とフラグリセット（非同期で実行）
      setTimeout(() => {
        if (draw.current) {
          try {
            draw.current.changeMode('simple_select')
            
          } catch (error) {
            
          }
        }
        // フラグをリセット
        isHandlingCreateRef.current = false
      }, 100)
    }
  }

  // 描画更新イベント（シンプル版）
  const handleDrawUpdate = () => {
    // 更新時は何もしない（完成時のみモーダル表示）
  }

  // メッシュレイヤー更新
  const updateMeshLayer = useCallback((cells: MeshCell[]) => {
    if (!map.current) return

    const geoJSON = cellsToGeoJSON(cells)
    const source = map.current.getSource('mesh-cells') as maplibregl.GeoJSONSource
    if (source) {
      source.setData(geoJSON)
    }
  }, [])

  // 描画削除イベント（シンプル版）
  const handleDrawDelete = () => {
    setCurrentArea(null)
    setMeshCells([])
    setSelectedCells([])
    if (map.current) {
      const source = map.current.getSource('mesh-cells') as maplibregl.GeoJSONSource
      if (source) {
        source.setData({ type: 'FeatureCollection', features: [] })
      }
    }
    processingRef.current = false
  }


  // メッシュ生成
  const generateAreaMesh = useCallback(async () => {
    if (!currentArea) {
      alert('先に農地を描画してください')
      return
    }

    setIsGeneratingMesh(true)
    
    try {
      const result = await generateMesh(currentArea.geometry, {
        cellSize: meshSize,
        units: 'meters',
        cropToPolygon: true,
        generateStatistics: true
      })
      
      setMeshCells(result.cells)
      updateMeshLayer(result.cells)
      
      // エリアデータ更新
      const updatedArea = {
        ...currentArea,
        meshCells: result.cells,
        estimated_cell_count: result.totalCells
      }
      setCurrentArea(updatedArea)
      
    } catch (error) {
      
      alert('メッシュ生成に失敗しました')
    } finally {
      setIsGeneratingMesh(false)
    }
  }, [currentArea, meshSize, updateMeshLayer])

  // 地図クリック処理（セル選択機能を削除）
  const handleMapClick = useCallback((e: maplibregl.MapMouseEvent) => {
    // 通常のマップクリック処理（必要に応じて拡張）
  }, [])

  // 右クリック処理（描画取り消し - 継続描画対応版）
  const handleRightClick = useCallback((e: maplibregl.MapMouseEvent) => {
    e.preventDefault() // デフォルトのコンテキストメニューを無効化
    
    // 描画中の判定を強化：UIボタンの状態も確認
    const isDrawingMode = currentMode === 'draw'
    const hasDrawnFeatures = draw.current ? draw.current.getAll().features.length > 0 : false
    
    if ((isDrawingMode || hasDrawnFeatures) && draw.current) {
      // 現在の描画をキャンセル
      const features = draw.current.getAll()
      
      if (features.features.length > 0) {
        draw.current.deleteAll()
        
        // 現在のエリアとメッシュをリセット
        setCurrentArea(null)
        setMeshCells([])
        setSelectedCells([])
        updateMeshLayer([])
      }
      
      // 右クリック後は地図移動モードに戻す
      setTimeout(() => {
        setCurrentMode('pan')
        if (draw.current) {
          try {
            draw.current.changeMode('simple_select')
            if (map.current) {
              map.current.getCanvas().style.cursor = 'grab'
            }
          } catch (error) {
            
          }
        }
      }, 50)
    }
  }, [currentMode, updateMeshLayer])

  // ダブルクリック処理（農地描画完了時は自動でモーダル表示されるため簡素化）
  const handleMapDoubleClick = useCallback((e: maplibregl.MapMouseEvent) => {
    e.preventDefault()
  }, [])

  // モード切り替え
  const setMode = useCallback((mode: 'pan' | 'draw') => {
    setCurrentMode(mode)
    
    if (!draw.current) {
      return
    }
    
    try {
      switch (mode) {
        case 'draw':
          draw.current.changeMode('draw_polygon')
          
          if (map.current) {
            map.current.getCanvas().style.cursor = 'crosshair'
          }
          break
        default: // pan
          draw.current.changeMode('simple_select')
          if (map.current) {
            map.current.getCanvas().style.cursor = 'grab'
          }
      }
    } catch (error) {
      // エラーをスキップ
    }
  }, [currentMode])

  // エリア保存
  const saveArea = useCallback(async () => {
    if (!currentArea || !areaName.trim()) {
      alert('農地名を入力してください')
      return
    }

    setIsSaving(true)
    
    try {
      const areaToSave = {
        name: areaName,
        description: areaDescription,
        geometry: currentArea.geometry,
        mesh_size_meters: 5,
        tags: ['手描き', '新規作成']
      }
      
      
      const response = await fetch('/api/farm-areas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(areaToSave)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save farm area')
      }
      
      const result = await response.json()
      
      // 保存されたデータでコールバック実行
      if (onAreaSaved) {
        onAreaSaved({
          ...currentArea,
          id: result.data.id,
          name: areaName,
          description: areaDescription
        })
      }
      
      alert('農地エリアを保存しました！')
      
      // フォームをリセット
      setAreaName('')
      setAreaDescription('')
      setCurrentArea(null)
      setMeshCells([])
      setSelectedCells([])
      
      // 描画をクリア
      if (draw.current) {
        draw.current.deleteAll()
      }
      
    } catch (error) {
      
      alert(`保存に失敗しました: ${error.message}`)
    } finally {
      setIsSaving(false)
    }
  }, [currentArea, areaName, areaDescription, onAreaSaved])

  // メッシュ表示切り替え
  const toggleMeshVisibility = useCallback(() => {
    setShowMesh(!showMesh)
    
    if (map.current) {
      const visibility = !showMesh ? 'visible' : 'none'
      const meshLayers = ['mesh-cells-fill', 'mesh-cells-stroke', 'mesh-cells-highlight']
      
      meshLayers.forEach(layerId => {
        if (map.current.getLayer(layerId)) {
          map.current.setLayoutProperty(layerId, 'visibility', visibility)
        }
      })
      
    }
  }, [showMesh])

  // 地図スタイル切り替え（デバッグ強化版）
  const changeMapStyle = useCallback((newStyle: 'standard' | 'pale' | 'photo') => {
    if (!map.current || newStyle === mapStyle) return
    
    
    
    const getMapStyle = (styleType: 'standard' | 'pale' | 'photo') => {
      const styles = {
        standard: {
          source: 'gsi-standard',
          tiles: ['https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png'],
          attribution: '<a href="https://www.gsi.go.jp/" target="_blank">国土地理院 標準地図</a>'
        },
        pale: {
          source: 'gsi-pale',
          tiles: ['https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'],
          attribution: '<a href="https://www.gsi.go.jp/" target="_blank">国土地理院 淡色地図</a>'
        },
        photo: {
          source: 'gsi-photo',
          tiles: ['https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg'],
          attribution: '<a href="https://www.gsi.go.jp/" target="_blank">国土地理院 航空写真</a>'
        }
      }
      return styles[styleType]
    }
    
    const newStyleConfig = getMapStyle(newStyle)
    
    try {
      // 変更前の描画状態を保存
      const currentDrawings = draw.current ? draw.current.getAll() : null
      
      
      // 既存のレイヤー一覧をログ出力
      const allLayers = map.current.getStyle().layers
      
      // 既存の背景レイヤーとソースを削除
      const currentStyleConfig = getMapStyle(mapStyle)
      if (map.current.getLayer(currentStyleConfig.source)) {
        map.current.removeLayer(currentStyleConfig.source)
        
      }
      if (map.current.getSource(currentStyleConfig.source)) {
        map.current.removeSource(currentStyleConfig.source)
        
      }
      
      // 新しいソースを追加
      map.current.addSource(newStyleConfig.source, {
        type: 'raster',
        tiles: newStyleConfig.tiles,
        tileSize: 256,
        attribution: newStyleConfig.attribution
      })
      
      
      // 新しい背景レイヤーを一番下に追加
      map.current.addLayer({
        id: newStyleConfig.source,
        type: 'raster',
        source: newStyleConfig.source
      })
      
      
      // 描画データを復元
      if (currentDrawings && currentDrawings.features.length > 0) {
        draw.current?.set(currentDrawings)
        
      }
      
      // レイヤーの現在の順序を確認
      const layersAfterAdd = map.current.getStyle().layers
      
      // 実際に存在するレイヤーをすべて取得して、描画レイヤーを特定
      const currentLayers = map.current.getStyle().layers
      const drawLayers = currentLayers.filter(layer => 
        layer.id.startsWith('gl-draw-') || 
        layer.id === 'mesh-cells-fill' || 
        layer.id === 'mesh-cells-stroke' || 
        layer.id === 'mesh-cells-highlight'
      )
      
      // 描画レイヤーとメッシュレイヤーを最上位に移動
      drawLayers.forEach((layer) => {
        try {
          map.current?.moveLayer(layer.id)
          
        } catch (error) {
          
        }
      })
      
      // 最終的なレイヤー順序を確認
      setTimeout(() => {
        if (map.current) {
          const finalLayers = map.current.getStyle().layers
          
          // 描画データの存在を再確認
          const finalDrawings = draw.current ? draw.current.getAll() : null
          
        }
      }, 200)
      
      setMapStyle(newStyle)
      
      
    } catch (error) {
      
    }
  }, [mapStyle])

  // 全選択解除
  const clearSelection = useCallback(() => {
    setSelectedCells([])
    const clearedCells = meshCells.map(cell => ({ ...cell, isSelected: false }))
    setMeshCells(clearedCells)
    updateMeshLayer(clearedCells)
  }, [meshCells, updateMeshLayer])

  // 全ての描画をリセット
  const resetAllDrawings = useCallback(() => {
    if (window.confirm('描画したエリアとメッシュをすべて削除しますか？')) {
      // 描画を削除
      if (draw.current) {
        draw.current.deleteAll()
      }
      
      // 状態をリセット
      setCurrentArea(null)
      setMeshCells([])
      setSelectedCells([])
      setAreaName('')
      setAreaDescription('')
      updateMeshLayer([])
      
      // panモードに切り替え
      setCurrentMode('pan')
      if (draw.current) {
        draw.current.changeMode('simple_select')
      }
      if (map.current) {
        map.current.getCanvas().style.cursor = 'grab'
      }
      
      
    }
  }, [updateMeshLayer])

  // 場所検索処理
  const handleLocationSelect = useCallback((result: any) => {
    if (map.current) {
      map.current.flyTo({
        center: [result.longitude, result.latitude],
        zoom: 16
      })
    }
  }, [])

  // 外部からマップ操作を可能にする
  useImperativeHandle(ref, () => ({
    flyToLocation: (lng: number, lat: number, zoom = 16) => {
      if (map.current) {
        map.current.flyTo({
          center: [lng, lat],
          zoom
        })
      }
    },
    fitBounds: (bounds: [[number, number], [number, number]]) => {
      if (map.current) {
        map.current.fitBounds(bounds, { padding: 50 })
      }
    },
    // 野菜エリアのポリゴンを表示する機能
    showVegetablePolygon: (vegetable: any) => {
      if (!map.current || !vegetable.farm_area_data?.geometry) {
        
        return
      }

      
      
      // まず全ての既存ポリゴンをクリーンアップ
      try {
        const style = map.current.getStyle()
        if (style && style.layers) {
          const layersToRemove = style.layers
            .filter(layer => layer.id.startsWith('vegetable-polygon-'))
            .map(layer => layer.id)
          
          layersToRemove.forEach(layerId => {
            try {
              if (map.current.getLayer(layerId)) {
                map.current.removeLayer(layerId)
              }
            } catch (error) {
              
            }
          })
          
          const sourcesToRemove = Object.keys(style.sources || {})
            .filter(sourceId => sourceId.startsWith('vegetable-polygon-'))
          
          sourcesToRemove.forEach(sourceId => {
            try {
              if (map.current.getSource(sourceId)) {
                map.current.removeSource(sourceId)
              }
            } catch (error) {
              
            }
          })
        }
      } catch (error) {
        
      }
      
      const geometry = vegetable.farm_area_data.geometry
      const sourceId = `vegetable-polygon-${vegetable.id}`
      const layerId = `vegetable-polygon-layer-${vegetable.id}`

      // 当該野菜の既存レイヤーとソースを確実に削除
      try {
        [`${layerId}`, `${layerId}-stroke`, `${layerId}-label`].forEach(id => {
          if (map.current.getLayer(id)) {
            map.current.removeLayer(id)
            
          }
        });
        
        [`${sourceId}`, `${sourceId}-label`].forEach(id => {
          if (map.current.getSource(id)) {
            map.current.removeSource(id)
            
          }
        })
      } catch (error) {
        
      }

      // 新しいソースとレイヤーを追加
      map.current.addSource(sourceId, {
        type: 'geojson',
        data: geometry
      })

      // 塗りつぶしレイヤー（カスタムカラー対応）
      const polygonColor = vegetable.polygon_color || vegetable.custom_fields?.polygon_color || '#22c55e'
      map.current.addLayer({
        id: layerId,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': polygonColor,
          'fill-opacity': 0.3
        }
      })

      // 境界線レイヤー（動的に色を決定）
      const strokeColor = (() => {
        const hex = polygonColor.replace('#', '')
        const r = Math.max(0, parseInt(hex.substring(0, 2), 16) - 32)
        const g = Math.max(0, parseInt(hex.substring(2, 4), 16) - 32)  
        const b = Math.max(0, parseInt(hex.substring(4, 6), 16) - 32)
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
      })()
      
      map.current.addLayer({
        id: `${layerId}-stroke`,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': strokeColor,
          'line-width': 2,
          'line-opacity': 0.8
        }
      })

      // ラベルは表示しない（フォント設定の問題を回避）

      // ポリゴンの範囲に地図をフィット
      const coordinates = geometry.geometry.coordinates[0]
      const bounds = coordinates.reduce((bounds: any, coord: [number, number]) => {
        return bounds.extend(coord)
      }, new maplibregl.LngLatBounds(coordinates[0], coordinates[0]))

      map.current.fitBounds(bounds, { 
        padding: 50,
        maxZoom: 18 
      })
    },
    // 全ての野菜ポリゴンを削除
    clearVegetablePolygons: () => {
      if (!map.current) return
      
      
      
      try {
        const style = map.current.getStyle()
        if (!style.layers) return
        
        // vegetable-polygon で始まるレイヤーを全て削除（ラベル、ストローク含む）
        const layersToRemove = style.layers
          .filter(layer => layer.id.startsWith('vegetable-polygon-'))
          .map(layer => layer.id)
        
        layersToRemove.forEach(layerId => {
          try {
            if (map.current.getLayer(layerId)) {
              map.current.removeLayer(layerId)
              
            }
          } catch (error) {
            
          }
        })
        
        // vegetable-polygon で始まるソースを全て削除
        const sourcesToRemove = Object.keys(style.sources || {})
          .filter(sourceId => sourceId.startsWith('vegetable-polygon-'))
        
        sourcesToRemove.forEach(sourceId => {
          try {
            if (map.current.getSource(sourceId)) {
              map.current.removeSource(sourceId)
              
            }
          } catch (error) {
            
          }
        })
        
        
        
      } catch (error) {
        
      }
    },
    
    // ポリゴンの色をリアルタイムで更新
    updatePolygonColor: (vegetableId: string, newColor: string) => {
      if (!map.current) return
      
      const layerId = `vegetable-polygon-layer-${vegetableId}`
      const strokeLayerId = `${layerId}-stroke`
      
      // 塗りつぶし色を更新
      if (map.current.getLayer(layerId)) {
        map.current.setPaintProperty(layerId, 'fill-color', newColor)
        
      }
      
      // 境界線色も更新（少し濃い色に）
      if (map.current.getLayer(strokeLayerId)) {
        // 色を少し濃くする（RGB値を減らす）
        const hex = newColor.replace('#', '')
        const r = Math.max(0, parseInt(hex.substring(0, 2), 16) - 32)
        const g = Math.max(0, parseInt(hex.substring(2, 4), 16) - 32)  
        const b = Math.max(0, parseInt(hex.substring(4, 6), 16) - 32)
        const darkerColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
        map.current.setPaintProperty(strokeLayerId, 'line-color', darkerColor)
      }
    },
    
    // ポリゴン編集モードを有効化
    enablePolygonEditMode: (vegetable: any) => {
      if (!map.current || !draw.current || !vegetable.farm_area_data?.geometry) {
        
        return
      }
      
      
      
      // 既存の描画をクリア
      draw.current.deleteAll()
      
      // 既存のvegetable-polygonレイヤーを一時非表示
      const layerId = `vegetable-polygon-layer-${vegetable.id}`
      if (map.current.getLayer(layerId)) {
        map.current.setLayoutProperty(layerId, 'visibility', 'none')
      }
      if (map.current.getLayer(`${layerId}-stroke`)) {
        map.current.setLayoutProperty(`${layerId}-stroke`, 'visibility', 'none')
      }
      
      // 編集可能なフィーチャーとして追加
      const feature = {
        id: vegetable.id,
        type: 'Feature' as const,
        properties: {
          vegetableId: vegetable.id,
          name: vegetable.name
        },
        geometry: vegetable.farm_area_data.geometry.geometry
      }
      
      draw.current.add(feature)
      
      // direct_selectモードに切り替え（頂点を編集可能に）
      setTimeout(() => {
        if (draw.current) {
          draw.current.changeMode('direct_select', { featureId: vegetable.id })
          
        }
      }, 100)
    },
    
    // 編集中のポリゴンを保存
    saveEditedPolygon: (vegetableId: string) => {
      if (!draw.current) {
        
        return null
      }
      
      const features = draw.current.getAll()
      const editedFeature = features.features.find((f: any) => f.id === vegetableId)
      
      if (!editedFeature) {
        
        return null
      }
      
      
      
      // 編集を終了してsimple_selectモードに戻る
      draw.current.changeMode('simple_select')
      
      // フィーチャーを削除（編集完了）
      draw.current.delete(vegetableId)
      
      return {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: editedFeature.properties,
          geometry: editedFeature.geometry
        }]
      }
    },
    
    // 🆕 複数ポリゴン表示対応メソッド
    showPolygon: (vegetable: any) => {
      if (!map.current || !vegetable.farm_area_data?.geometry) {
        
        return
      }

      
      
      const vegetableId = vegetable.id
      const geometry = vegetable.farm_area_data.geometry
      const sourceId = `vegetable-polygon-${vegetableId}`
      const layerId = `vegetable-polygon-layer-${vegetableId}`

      // 既存のレイヤーとソースがあれば削除
      try {
        [`${layerId}`, `${layerId}-stroke`].forEach(id => {
          if (map.current.getLayer(id)) {
            map.current.removeLayer(id)
          }
        });
        
        if (map.current.getSource(sourceId)) {
          map.current.removeSource(sourceId)
        }
      } catch (error) {
        // エラーは無視（まだ存在しない場合）
      }

      // ソースを追加
      map.current.addSource(sourceId, {
        type: 'geojson',
        data: geometry
      })

      // 色を決定（polygonColors Mapまたはデフォルト）
      const polygonColor = polygonColors?.get(vegetableId) || 
                          vegetable.polygon_color || 
                          '#22c55e'

      // 塗りつぶしレイヤー
      map.current.addLayer({
        id: layerId,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': polygonColor,
          'fill-opacity': 0.4
        }
      })

      // 境界線レイヤー
      const strokeColor = (() => {
        const hex = polygonColor.replace('#', '')
        const r = Math.max(0, parseInt(hex.substring(0, 2), 16) - 32)
        const g = Math.max(0, parseInt(hex.substring(2, 4), 16) - 32)  
        const b = Math.max(0, parseInt(hex.substring(4, 6), 16) - 32)
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
      })()
      
      map.current.addLayer({
        id: `${layerId}-stroke`,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': strokeColor,
          'line-width': 2,
          'line-opacity': 0.8
        }
      })

      // レイヤーIDを記録
      vegetableLayersRef.current.set(vegetableId, layerId)
      
      
    },

    hidePolygon: (vegetableId: string) => {
      if (!map.current) return
      
      
      
      const layerId = `vegetable-polygon-layer-${vegetableId}`
      const sourceId = `vegetable-polygon-${vegetableId}`
      
      try {
        // レイヤーを削除
        [`${layerId}`, `${layerId}-stroke`].forEach(id => {
          if (map.current.getLayer(id)) {
            map.current.removeLayer(id)
            
          }
        });
        
        // ソースを削除
        if (map.current.getSource(sourceId)) {
          map.current.removeSource(sourceId)
          
        }
        
        // 記録を削除
        vegetableLayersRef.current.delete(vegetableId)
        
      } catch (error) {
        
      }
    },

    showMultiplePolygons: (vegetables: any[]) => {
      
      vegetables.forEach(vegetable => {
        if (vegetable.farm_area_data?.geometry) {
          // showPolygonメソッドを再利用
          ref.current?.showPolygon?.(vegetable)
        }
      })
    },

    clearAllPolygons: () => {
      if (!map.current) return
      
      
      
      try {
        const style = map.current.getStyle()
        if (!style.layers) return
        
        // vegetable-polygon で始まるレイヤーを全て削除
        const layersToRemove = style.layers
          .filter(layer => layer.id.startsWith('vegetable-polygon-'))
          .map(layer => layer.id)
        
        layersToRemove.forEach(layerId => {
          try {
            if (map.current.getLayer(layerId)) {
              map.current.removeLayer(layerId)
            }
          } catch (error) {
            
          }
        })
        
        // vegetable-polygon で始まるソースを全て削除
        const sourcesToRemove = Object.keys(style.sources || {})
          .filter(sourceId => sourceId.startsWith('vegetable-polygon-'))
        
        sourcesToRemove.forEach(sourceId => {
          try {
            if (map.current.getSource(sourceId)) {
              map.current.removeSource(sourceId)
            }
          } catch (error) {
            
          }
        })
        
        // 記録をクリア
        vegetableLayersRef.current.clear()
        
        
        
      } catch (error) {
        
      }
    }
  }), [polygonColors])

  return (
    <div className="relative w-full" style={{ height }}>
      {/* 検索ボックス */}
      <div className="absolute top-4 left-4 z-10">
        <div className="bg-white/95 backdrop-blur-md shadow-lg border border-gray-200/50 rounded-xl p-3">
          <div className="flex items-center space-x-2 mb-2">
            <Search className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">場所を検索</span>
          </div>
          <SearchBox
            onLocationSelect={handleLocationSelect}
            onLocationMove={(lat, lng, zoom) => {
              if (map.current) {
                map.current.flyTo({ center: [lng, lat], zoom: zoom || 16 })
              }
            }}
            placeholder="住所・座標を入力してください"
            className="w-80"
          />
        </div>
      </div>

      {/* メイン操作パネル */}
      <div className="absolute top-4 right-4 z-10 space-y-3">
        {/* モード選択 */}
        <div className="bg-white/95 backdrop-blur-md shadow-lg border border-gray-200/50 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">操作モード</span>
            <Settings className="w-3 h-3 text-gray-500" />
          </div>
          <div className="space-y-1">
            <Button
              size="sm"
              variant={currentMode === 'pan' ? 'default' : 'ghost'}
              onClick={() => setMode('pan')}
              className={`w-full justify-start text-xs h-8 ${
                currentMode === 'pan' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'
              }`}
            >
              <Hand className="w-3 h-3 mr-2" />
              地図移動
            </Button>
            <Button
              size="sm"
              variant={currentMode === 'draw' ? 'default' : 'ghost'}
              onClick={() => setMode('draw')}
              className={`w-full justify-start text-xs h-8 ${
                currentMode === 'draw' ? 'bg-green-600 text-white' : 'hover:bg-gray-100'
              }`}
            >
              <Edit3 className="w-3 h-3 mr-2" />
              農地描画
            </Button>
          </div>
        </div>

        {/* メッシュサイズ選択 */}
        <div className="bg-white/95 backdrop-blur-md shadow-lg border border-gray-200/50 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">メッシュサイズ</span>
            <Grid3X3 className="w-3 h-3 text-gray-500" />
          </div>
          <div className="grid grid-cols-2 gap-1 mb-2">
            {[5, 10, 50, 100].map((size) => (
              <Button
                key={size}
                size="sm"
                variant={meshSize === size ? "default" : "ghost"}
                onClick={() => setMeshSize(size)}
                className={`text-xs h-7 ${
                  meshSize === size 
                    ? 'bg-blue-600 text-white' 
                    : 'hover:bg-gray-100'
                }`}
              >
                {size}m
              </Button>
            ))}
          </div>
        </div>

        {/* メッシュ操作 */}
        <div className="bg-white/95 backdrop-blur-md shadow-lg border border-gray-200/50 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{meshSize}mメッシュ</span>
            <Grid3X3 className="w-3 h-3 text-gray-500" />
          </div>
          <div className="space-y-1">
            <Button
              size="sm"
              onClick={generateAreaMesh}
              disabled={!currentArea || isGeneratingMesh}
              className={`w-full justify-start text-xs h-8 ${
                !currentArea || isGeneratingMesh
                  ? 'opacity-50 cursor-not-allowed'
                  : 'bg-orange-600 hover:bg-orange-700 text-white'
              }`}
            >
              {isGeneratingMesh ? (
                <>
                  <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Grid3X3 className="w-3 h-3 mr-2" />
                  {meshSize}mメッシュ生成
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={toggleMeshVisibility}
              className="w-full justify-start text-xs h-8 hover:bg-gray-100"
            >
              {showMesh ? (
                <>
                  <EyeOff className="w-3 h-3 mr-2" />
                  メッシュ非表示
                </>
              ) : (
                <>
                  <Eye className="w-3 h-3 mr-2" />
                  メッシュ表示
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={clearSelection}
              disabled={selectedCells.length === 0}
              className="w-full justify-start text-xs h-8 hover:bg-orange-50 text-orange-600"
            >
              <RotateCcw className="w-3 h-3 mr-2" />
              選択解除
            </Button>
          </div>
        </div>

        {/* リセット機能 */}
        <div className="bg-white/95 backdrop-blur-md shadow-lg border border-gray-200/50 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">描画リセット</span>
            <Trash2 className="w-3 h-3 text-gray-500" />
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={resetAllDrawings}
            disabled={!currentArea && meshCells.length === 0}
            className="w-full justify-start text-xs h-8 hover:bg-red-50 text-red-600"
          >
            <Trash2 className="w-3 h-3 mr-2" />
            全てリセット
          </Button>
        </div>

        {/* 地図スタイル切り替え */}
        <div className="bg-white/95 backdrop-blur-md shadow-lg border border-gray-200/50 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">地図スタイル</span>
            <Layers className="w-3 h-3 text-gray-500" />
          </div>
          <div className="space-y-1">
            <Button
              size="sm"
              variant={mapStyle === 'standard' ? "default" : "ghost"}
              onClick={() => changeMapStyle('standard')}
              className={`w-full justify-start text-xs h-8 ${
                mapStyle === 'standard' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'
              }`}
            >
              <MapIcon className="w-3 h-3 mr-2" />
              標準地図
            </Button>
            <Button
              size="sm"
              variant={mapStyle === 'pale' ? "default" : "ghost"}
              onClick={() => changeMapStyle('pale')}
              className={`w-full justify-start text-xs h-8 ${
                mapStyle === 'pale' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'
              }`}
            >
              <Square className="w-3 h-3 mr-2" />
              淡色地図
            </Button>
            <Button
              size="sm"
              variant={mapStyle === 'photo' ? "default" : "ghost"}
              onClick={() => changeMapStyle('photo')}
              className={`w-full justify-start text-xs h-8 ${
                mapStyle === 'photo' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'
              }`}
            >
              <Camera className="w-3 h-3 mr-2" />
              航空写真
            </Button>
          </div>
        </div>
      </div>


      {/* ステータス表示 */}
      <div className="absolute bottom-4 right-4 z-10">
        <div className="bg-white/95 backdrop-blur-md shadow-lg border border-gray-200/50 rounded-xl p-3">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isMapLoaded ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
            <span className="text-xs text-gray-600">
              {isMapLoaded ? '準備完了' : '読み込み中...'}
            </span>
          </div>
        </div>
      </div>

      {/* マップコンテナ */}
      <div
        ref={mapContainer}
        className="w-full h-full bg-gray-100"
        style={{ height }}
      />

    </div>
  )
})

ProfessionalFarmEditor.displayName = 'ProfessionalFarmEditor'

export default ProfessionalFarmEditor