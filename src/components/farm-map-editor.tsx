'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import SearchBox from './search-box'
import CityCodeSearch from './city-code-search'
import { generateMesh, updateCellSelection, selectCellAtPoint, selectCellsInBounds, cellsToGeoJSON } from '@/lib/mesh-generator'
import type { MeshCell, GeoJSONFeature } from '@/types/database'
import type { Feature, Polygon, LineString, Point } from 'geojson'
import {
  Map,
  Layers,
  Square,
  Hand,
  MousePointer,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize,
  Info,
  Settings,
  Search,
  Keyboard,
  MapPin,
  Building2
} from 'lucide-react'

interface FarmMapEditorProps {
  onCellsSelected?: (cells: MeshCell[]) => void
  onPlotSelected?: (plotData: any) => void
  initialCenter?: [number, number]
  initialZoom?: number
  height?: string
  showControls?: boolean
}

interface MapState {
  isLoaded: boolean
  currentTool: 'select' | 'draw' | 'pan'
  selectedCells: MeshCell[]
  currentPlot: Feature<Polygon> | null
  meshGenerated: boolean
  isGeneratingMesh: boolean
}

// 地理院タイルの設定
const GSI_TILE_LAYERS = {
  standard: {
    id: 'gsi-standard',
    name: '標準地図',
    url: 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png',
    attribution: '<a href="https://www.gsi.go.jp/" target="_blank">国土地理院</a>'
  },
  pale: {
    id: 'gsi-pale',
    name: '淡色地図',
    url: 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png',
    attribution: '<a href="https://www.gsi.go.jp/" target="_blank">国土地理院</a>'
  },
  photo: {
    id: 'gsi-photo',
    name: '航空写真',
    url: 'https://cyberjapandata.gsi.go.jp/xyz/ort/{z}/{x}/{y}.jpg',
    attribution: '<a href="https://www.gsi.go.jp/" target="_blank">国土地理院</a>'
  }
}

export default function FarmMapEditor({
  onCellsSelected,
  onPlotSelected,
  initialCenter = [139.6917, 35.6895], // 東京都新宿区
  initialZoom = 16,
  height = '600px',
  showControls = true
}: FarmMapEditorProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  
  const [mapState, setMapState] = useState<MapState>({
    isLoaded: false,
    currentTool: 'select',
    selectedCells: [],
    currentPlot: null,
    meshGenerated: false,
    isGeneratingMesh: false
  })
  
  const [activeLayer, setActiveLayer] = useState('gsi-standard')
  const [meshCells, setMeshCells] = useState<MeshCell[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<[number, number] | null>(null)
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [wagriFarmPins, setWagriFarmPins] = useState<any[]>([])
  const [wagriPolygons, setWagriPolygons] = useState<any[]>([])
  const [selectedCityCode, setSelectedCityCode] = useState<string>('')
  const [showWagriData, setShowWagriData] = useState(true)

  // マップ初期化
  useEffect(() => {
    if (!mapContainer.current || map.current) return

    // MapLibre GL JSマップ初期化
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'gsi-standard': {
            type: 'raster',
            tiles: [GSI_TILE_LAYERS.standard.url],
            tileSize: 256,
            attribution: GSI_TILE_LAYERS.standard.attribution
          },
          'gsi-pale': {
            type: 'raster',
            tiles: [GSI_TILE_LAYERS.pale.url],
            tileSize: 256,
            attribution: GSI_TILE_LAYERS.pale.attribution
          },
          'gsi-photo': {
            type: 'raster',
            tiles: [GSI_TILE_LAYERS.photo.url],
            tileSize: 256,
            attribution: GSI_TILE_LAYERS.photo.attribution
          }
        },
        layers: [
          {
            id: 'gsi-standard',
            type: 'raster',
            source: 'gsi-standard'
          }
        ]
      },
      center: initialCenter,
      zoom: initialZoom,
      attributionControl: true
    })

    // マップ読み込み完了
    map.current.on('load', () => {
      setMapState(prev => ({ ...prev, isLoaded: true }))
      
      // 農地プロット用レイヤー追加
      if (map.current) {
        // 農地境界レイヤー
        map.current.addSource('farm-plots', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        })
        
        map.current.addLayer({
          id: 'farm-plots-fill',
          type: 'fill',
          source: 'farm-plots',
          paint: {
            'fill-color': '#22c55e',
            'fill-opacity': 0.2
          }
        })
        
        map.current.addLayer({
          id: 'farm-plots-stroke',
          type: 'line',
          source: 'farm-plots',
          paint: {
            'line-color': '#16a34a',
            'line-width': 2
          }
        })

        // メッシュセル用レイヤー
        map.current.addSource('mesh-cells', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        })
        
        map.current.addLayer({
          id: 'mesh-cells-fill',
          type: 'fill',
          source: 'mesh-cells',
          paint: {
            'fill-color': [
              'case',
              ['get', 'isSelected'], '#3b82f6',
              ['get', 'isOccupied'], '#f59e0b',
              '#e5e7eb'
            ],
            'fill-opacity': [
              'case',
              ['get', 'isSelected'], 0.8,
              ['get', 'isOccupied'], 0.6,
              0.4  // より見えやすくするため不透明度を上げる
            ]
          },
          layout: {
            'visibility': 'visible'
          }
        })
        
        map.current.addLayer({
          id: 'mesh-cells-stroke',
          type: 'line',
          source: 'mesh-cells',
          paint: {
            'line-color': [
              'case',
              ['get', 'isSelected'], '#1d4ed8',
              ['get', 'isOccupied'], '#d97706',
              '#6b7280'  // より見えやすい色に変更
            ],
            'line-width': [
              'case',
              ['get', 'isSelected'], 2,
              1
            ]
          },
          layout: {
            'visibility': 'visible'
          }
        })

        // WAGRIレイヤーを追加
        addWagriLayers()

        // クリックイベント
        map.current.on('click', handleMapClick)
        map.current.on('mousedown', handleMouseDown)
        map.current.on('mousemove', handleMouseMove)
        map.current.on('mouseup', handleMouseUp)
      }
    })

    // クリーンアップ
    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [initialCenter, initialZoom])

  // レイヤー切り替え
  const switchLayer = useCallback((layerId: string) => {
    if (!map.current) return
    
    try {
      // 全てのレイヤーを非表示にする
      Object.keys(GSI_TILE_LAYERS).forEach(key => {
        const id = GSI_TILE_LAYERS[key as keyof typeof GSI_TILE_LAYERS].id
        if (map.current?.getLayer(id)) {
          map.current.setLayoutProperty(id, 'visibility', 'none')
        }
      })

      // 選択されたレイヤーが存在しない場合は追加
      if (!map.current.getLayer(layerId)) {
        // ソース名はハイフンで統一されている
        const sourceName = layerId
        map.current.addLayer({
          id: layerId,
          type: 'raster',
          source: sourceName
        })
      }

      // 選択されたレイヤーのみ表示
      map.current.setLayoutProperty(layerId, 'visibility', 'visible')
      
      setActiveLayer(layerId)
      
    } catch (error) {
      
    }
  }, [])

  // 地図クリック処理
  const handleMapClick = useCallback((e: maplibregl.MapMouseEvent) => {
    const { lng, lat } = e.lngLat
    
    // WAGRIピンクリック検出
    if (showWagriData) {
      const wagriFeatures = map.current?.queryRenderedFeatures(e.point, {
        layers: ['wagri-pins']
      })
      
      if (wagriFeatures && wagriFeatures.length > 0) {
        const feature = wagriFeatures[0]
        showWagriPinInfo(feature.properties)
        return
      }
      
      // WAGRIポリゴンクリック検出
      const wagriPolygonFeatures = map.current?.queryRenderedFeatures(e.point, {
        layers: ['wagri-polygons-fill']
      })
      
      if (wagriPolygonFeatures && wagriPolygonFeatures.length > 0) {
        const feature = wagriPolygonFeatures[0]
        showWagriPolygonInfo(feature.properties)
        return
      }
    }
    
    if (mapState.currentTool === 'select' && mapState.meshGenerated) {
      // セル選択
      const updatedCells = selectCellAtPoint(meshCells, lng, lat)
      setMeshCells(updatedCells)
      setMapState(prev => ({ ...prev, selectedCells: updatedCells.filter(c => c.isSelected) }))
      
      // メッシュレイヤー更新
      updateMeshLayer(updatedCells)
      
      // コールバック実行
      if (onCellsSelected) {
        onCellsSelected(updatedCells.filter(c => c.isSelected))
      }
    } else if (mapState.currentTool === 'draw') {
      // 農地描画モード
      const newPoint: [number, number] = [lng, lat]
      
      if (!isDrawing) {
        // 描画開始
        setIsDrawing(true)
        setDrawingPoints([newPoint])
      } else {
        // 点を追加
        const updatedPoints = [...drawingPoints, newPoint]
        setDrawingPoints(updatedPoints)
        
        // 最初の点と近い場合は描画完了
        if (updatedPoints.length >= 3) {
          const firstPoint = updatedPoints[0]
          const distance = Math.sqrt(
            Math.pow((newPoint[0] - firstPoint[0]) * 111320, 2) + 
            Math.pow((newPoint[1] - firstPoint[1]) * 110540, 2)
          )
          
          if (distance < 50) { // 50m以内なら完了
            finishDrawing(updatedPoints)
          }
        }
      }
      
      // 描画中の表示更新
      updateDrawingLayer(drawingPoints)
    }
  }, [mapState.currentTool, mapState.meshGenerated, meshCells, onCellsSelected, isDrawing, drawingPoints, showWagriData])

  // マウスドラッグ開始
  const handleMouseDown = useCallback((e: maplibregl.MapMouseEvent) => {
    if (mapState.currentTool === 'select') {
      setIsDragging(true)
      setDragStart([e.lngLat.lng, e.lngLat.lat])
    }
  }, [mapState.currentTool])

  // マウス移動
  const handleMouseMove = useCallback((e: maplibregl.MapMouseEvent) => {
    if (isDragging && dragStart && mapState.currentTool === 'select') {
      // 範囲選択表示の実装
      // 簡略化のため省略
    }
  }, [isDragging, dragStart, mapState.currentTool])

  // マウスドラッグ終了
  const handleMouseUp = useCallback((e: maplibregl.MapMouseEvent) => {
    if (isDragging && dragStart && mapState.currentTool === 'select' && mapState.meshGenerated) {
      const bounds: [number, number, number, number] = [
        Math.min(dragStart[0], e.lngLat.lng),
        Math.min(dragStart[1], e.lngLat.lat),
        Math.max(dragStart[0], e.lngLat.lng),
        Math.max(dragStart[1], e.lngLat.lat)
      ]
      
      // 範囲選択
      const updatedCells = selectCellsInBounds(meshCells, bounds)
      setMeshCells(updatedCells)
      setMapState(prev => ({ ...prev, selectedCells: updatedCells.filter(c => c.isSelected) }))
      
      updateMeshLayer(updatedCells)
      
      if (onCellsSelected) {
        onCellsSelected(updatedCells.filter(c => c.isSelected))
      }
    }
    
    setIsDragging(false)
    setDragStart(null)
  }, [isDragging, dragStart, mapState.currentTool, mapState.meshGenerated, meshCells, onCellsSelected])

  // メッシュレイヤー更新
  const updateMeshLayer = useCallback((cells: MeshCell[]) => {
    if (!map.current) return
    
    const geoJSON = cellsToGeoJSON(cells)
    const source = map.current.getSource('mesh-cells') as maplibregl.GeoJSONSource
    if (source) {
      source.setData(geoJSON)
    }
  }, [])

  // 描画中のレイヤー更新
  const updateDrawingLayer = useCallback((points: [number, number][]) => {
    if (!map.current || points.length === 0) return
    
    // 描画中のレイヤーが存在しない場合は作成
    if (!map.current.getSource('drawing-temp')) {
      map.current.addSource('drawing-temp', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      })
      
      map.current.addLayer({
        id: 'drawing-temp-stroke',
        type: 'line',
        source: 'drawing-temp',
        paint: {
          'line-color': '#ef4444',
          'line-width': 3,
          'line-dasharray': [5, 5]
        }
      })
      
      map.current.addLayer({
        id: 'drawing-temp-points',
        type: 'circle',
        source: 'drawing-temp',
        paint: {
          'circle-radius': 6,
          'circle-color': '#ef4444',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      })
    }
    
    const features = []
    
    // ラインフィーチャー（3点以上の場合）
    if (points.length >= 2) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: points
        },
        properties: {}
      })
    }
    
    // ポイントフィーチャー
    points.forEach((point, index) => {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: point
        },
        properties: { index }
      })
    })
    
    const source = map.current.getSource('drawing-temp') as maplibregl.GeoJSONSource
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features
      })
    }
  }, [])

  // 農地プロット追加（finishDrawingより先に定義）
  const addFarmPlot = useCallback((plotFeature: Feature<Polygon>) => {
    if (!map.current) return
    
    setMapState(prev => ({ ...prev, currentPlot: plotFeature }))
    
    // 農地レイヤー更新
    const source = map.current.getSource('farm-plots') as maplibregl.GeoJSONSource
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: [plotFeature]
      })
    }
  }, [])

  // 描画完了
  const finishDrawing = useCallback((points: [number, number][]) => {
    if (points.length < 3) return
    
    // 最後の点を最初の点と同じにしてポリゴンを閉じる
    const closedPoints = [...points, points[0]]
    
    const plotFeature: Feature<Polygon> = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [closedPoints]
      },
      properties: {
        name: `農地_${new Date().getTime()}`
      }
    }
    
    // 農地プロット追加
    addFarmPlot(plotFeature)
    
    // 描画状態リセット
    setIsDrawing(false)
    setDrawingPoints([])
    
    // 描画中のレイヤークリア
    if (map.current?.getSource('drawing-temp')) {
      const source = map.current.getSource('drawing-temp') as maplibregl.GeoJSONSource
      source.setData({
        type: 'FeatureCollection',
        features: []
      })
    }
    
    
  }, [addFarmPlot])

  // WAGRIレイヤー追加
  const addWagriLayers = useCallback(() => {
    if (!map.current) return

    // WAGRI農地ピンレイヤー
    map.current.addSource('wagri-pins', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
    })

    map.current.addLayer({
      id: 'wagri-pins',
      type: 'circle',
      source: 'wagri-pins',
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          10, 6,
          16, 12
        ],
        'circle-color': [
          'case',
          ['==', ['get', 'farmType'], '田'], '#4CAF50',
          ['==', ['get', 'farmType'], '畑'], '#FF9800', 
          ['==', ['get', 'farmType'], '樹園地'], '#8BC34A',
          '#FF6B35'
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#FFFFFF',
        'circle-opacity': 0.8
      }
    })

    // WAGRI農地ポリゴンレイヤー
    map.current.addSource('wagri-polygons', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
    })

    map.current.addLayer({
      id: 'wagri-polygons-fill',
      type: 'fill',
      source: 'wagri-polygons',
      paint: {
        'fill-color': [
          'case',
          ['==', ['get', 'farmType'], '田'], '#4CAF50',
          ['==', ['get', 'farmType'], '畑'], '#FF9800',
          ['==', ['get', 'farmType'], '樹園地'], '#8BC34A', 
          '#2196F3'
        ],
        'fill-opacity': 0.4
      }
    })

    map.current.addLayer({
      id: 'wagri-polygons-stroke',
      type: 'line',
      source: 'wagri-polygons',
      paint: {
        'line-color': [
          'case',
          ['==', ['get', 'farmType'], '田'], '#2E7D32',
          ['==', ['get', 'farmType'], '畑'], '#F57C00',
          ['==', ['get', 'farmType'], '樹園地'], '#558B2F',
          '#1976D2'
        ],
        'line-width': 2,
        'line-opacity': 0.8
      }
    })

    
  }, [])

  // WAGRI農地ピンを読み込み
  const loadWagriFarmPins = useCallback(async (cityCode: string) => {
    if (!cityCode) return

    
    
    try {
      const response = await fetch(`/api/wagri/farm-pins?cityCode=${cityCode}&limit=500`)
      
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const result = await response.json()
      

      if (result.success) {
        setWagriFarmPins(result.data)
        updateWagriPinsLayer(result.data)
        
      } else {
        
      }
    } catch (error) {
      
    }
  }, [])

  // WAGRI農地ポリゴンを読み込み
  const loadWagriPolygons = useCallback(async (cityCode: string) => {
    if (!cityCode) return

    
    
    try {
      const response = await fetch(`/api/wagri/polygons?cityCode=${cityCode}`)
      
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const result = await response.json()
      

      if (result.success) {
        setWagriPolygons(result.data)
        updateWagriPolygonsLayer(result.data)
        
      } else {
        
      }
    } catch (error) {
      
    }
  }, [])

  // WAGRIピンレイヤー更新
  const updateWagriPinsLayer = useCallback((pins: any[]) => {
    
    
    if (!map.current) {
      
      return
    }

    const features = pins.map(pin => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [pin.longitude, pin.latitude]
      },
      properties: {
        id: pin.id,
        farmId: pin.farmId,
        farmType: pin.farmType,
        ownerType: pin.ownerType,
        cropType: pin.cropType,
        area: pin.area,
        attributes: pin.attributes
      }
    }))

    

    const source = map.current.getSource('wagri-pins') as maplibregl.GeoJSONSource
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: features
      })
      
    } else {
      
    }
  }, [])

  // WAGRIポリゴンレイヤー更新
  const updateWagriPolygonsLayer = useCallback((polygons: any[]) => {
    if (!map.current) return

    const features = polygons.map(polygon => ({
      type: 'Feature',
      geometry: polygon.geometry,
      properties: {
        id: polygon.id,
        farmId: polygon.farmId,
        farmType: polygon.properties?.farmType || polygon.farm_type,
        cropType: polygon.properties?.cropType || polygon.crop_type,
        area: polygon.properties?.area || polygon.area_sqm,
        ownerInfo: polygon.properties?.ownerInfo || polygon.owner_info
      }
    }))

    const source = map.current.getSource('wagri-polygons') as maplibregl.GeoJSONSource
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: features
      })
    }
  }, [])

  // WAGRIデータ表示切り替え
  const toggleWagriData = useCallback((show: boolean) => {
    if (!map.current) return

    const visibility = show ? 'visible' : 'none'
    
    if (map.current.getLayer('wagri-pins')) {
      map.current.setLayoutProperty('wagri-pins', 'visibility', visibility)
    }
    if (map.current.getLayer('wagri-polygons-fill')) {
      map.current.setLayoutProperty('wagri-polygons-fill', 'visibility', visibility)
    }
    if (map.current.getLayer('wagri-polygons-stroke')) {
      map.current.setLayoutProperty('wagri-polygons-stroke', 'visibility', visibility)
    }

    setShowWagriData(show)
  }, [])

  // WAGRI農地ピン情報表示
  const showWagriPinInfo = useCallback((properties: any) => {
    const info = `
=== WAGRI農地ピン情報 ===
農地ID: ${properties.farmId}
農地区分: ${properties.farmType}
所有者区分: ${properties.ownerType}
作物: ${properties.cropType || '未設定'}
面積: ${properties.area}㎡
${properties.attributes ? JSON.stringify(properties.attributes, null, 2) : ''}
    `
    alert(info)
  }, [])

  // WAGRIポリゴン情報表示
  const showWagriPolygonInfo = useCallback((properties: any) => {
    const info = `
=== WAGRI農地ポリゴン情報 ===
農地ID: ${properties.farmId}
農地区分: ${properties.farmType}
作物: ${properties.cropType || '未設定'}
面積: ${properties.area}㎡
所有者情報: ${properties.ownerInfo || '未設定'}
    `
    alert(info)
  }, [])

  // 市区町村コードでWAGRIデータを読み込み
  const loadWagriDataByCityCode = useCallback(async (cityCode: string) => {
    setSelectedCityCode(cityCode)
    await Promise.all([
      loadWagriFarmPins(cityCode),
      loadWagriPolygons(cityCode)
    ])
  }, [loadWagriFarmPins, loadWagriPolygons])

  // メッシュ生成
  const generatePlotMesh = useCallback(async () => {
    if (!mapState.currentPlot) {
      alert('先に農地を選択または描画してください')
      return
    }

    setMapState(prev => ({ ...prev, isGeneratingMesh: true }))
    
    try {
      const result = await generateMesh(mapState.currentPlot, {
        cellSize: 5,
        units: 'meters',
        cropToPolygon: true
      })
      
      
      
      setMeshCells(result.cells)
      
      // メッシュレイヤーを必ず更新
      setTimeout(() => {
        updateMeshLayer(result.cells)
      }, 100)
      
      setMapState(prev => ({ 
        ...prev, 
        meshGenerated: true,
        isGeneratingMesh: false
      }))
      
      // セルが表示されているかデバッグログ
      if (map.current) {
        const source = map.current.getSource('mesh-cells') as maplibregl.GeoJSONSource
        if (source) {
          const geoJSON = cellsToGeoJSON(result.cells)
          source.setData(geoJSON)
          
          
          // レイヤー表示確認
          const layer = map.current.getLayer('mesh-cells-fill')
          if (layer) {
            
          } else {
            
          }
        }
      }
      
    } catch (error) {
      
      alert('メッシュ生成に失敗しました')
      setMapState(prev => ({ ...prev, isGeneratingMesh: false }))
    }
  }, [mapState.currentPlot, updateMeshLayer])

  // ツール切り替え
  const setTool = useCallback((tool: 'select' | 'draw' | 'pan') => {
    // 描画中の場合はリセット
    if (isDrawing) {
      setIsDrawing(false)
      setDrawingPoints([])
      if (map.current?.getSource('drawing-temp')) {
        const source = map.current.getSource('drawing-temp') as maplibregl.GeoJSONSource
        source.setData({
          type: 'FeatureCollection',
          features: []
        })
      }
    }
    
    setMapState(prev => ({ ...prev, currentTool: tool }))
    
    if (map.current) {
      // カーソル変更とマップインタラクション設定
      if (tool === 'draw') {
        map.current.getCanvas().style.cursor = 'crosshair'
        map.current.dragPan.disable()
        map.current.scrollZoom.disable()
      } else {
        map.current.getCanvas().style.cursor = 'grab'
        map.current.dragPan.enable()
        map.current.scrollZoom.enable()
      }
    }
  }, [isDrawing])

  // 選択解除
  const clearSelection = useCallback(() => {
    const clearedCells = meshCells.map(cell => ({ ...cell, isSelected: false }))
    setMeshCells(clearedCells)
    setMapState(prev => ({ ...prev, selectedCells: [] }))
    updateMeshLayer(clearedCells)
    
    if (onCellsSelected) {
      onCellsSelected([])
    }
  }, [meshCells, updateMeshLayer, onCellsSelected])

  // 検索結果への移動
  const handleLocationSelect = useCallback((result: any) => {
    if (map.current) {
      map.current.flyTo({
        center: [result.longitude, result.latitude],
        zoom: 16
      })
    }
  }, [])

  return (
    <div className="relative w-full" style={{ height }}>
      {/* プロフェッショナルな検索ボックス */}
      <div className="absolute top-4 left-4 z-10 space-y-3">
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

        {/* WAGRI農地データ検索 */}
        <CityCodeSearch
          onCityCodeSelect={(cityCode, cityName) => {
            `)
            loadWagriDataByCityCode(cityCode)
          }}
          className="w-80"
        />
      </div>

      {/* 地図コントロール（モダンUI） */}
      {showControls && (
        <div className="absolute top-4 right-4 z-10 space-y-3">
          {/* レイヤー切り替え */}
          <div className="bg-white/95 backdrop-blur-md shadow-lg border border-gray-200/50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">地図レイヤー</span>
              <Layers className="w-3 h-3 text-gray-500" />
            </div>
            <div className="space-y-1">
              <Button
                size="sm"
                variant={activeLayer === 'gsi-standard' ? 'default' : 'ghost'}
                onClick={() => switchLayer('gsi-standard')}
                className={`w-full justify-start text-xs h-8 transition-all ${
                  activeLayer === 'gsi-standard' 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
                title="国土地理院の標準地図を表示"
              >
                <Map className="w-3 h-3 mr-2" />
                標準地図
              </Button>
              <Button
                size="sm"
                variant={activeLayer === 'gsi-pale' ? 'default' : 'ghost'}
                onClick={() => switchLayer('gsi-pale')}
                className={`w-full justify-start text-xs h-8 transition-all ${
                  activeLayer === 'gsi-pale' 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
                title="読みやすい淡色地図を表示"
              >
                <Layers className="w-3 h-3 mr-2" />
                淡色地図
              </Button>
              <Button
                size="sm"
                variant={activeLayer === 'gsi-photo' ? 'default' : 'ghost'}
                onClick={() => switchLayer('gsi-photo')}
                className={`w-full justify-start text-xs h-8 transition-all ${
                  activeLayer === 'gsi-photo' 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
                title="航空写真を表示"
              >
                <ZoomIn className="w-3 h-3 mr-2" />
                航空写真
              </Button>
            </div>
          </div>

          {/* ツールバー */}
          <div className="bg-white/95 backdrop-blur-md shadow-lg border border-gray-200/50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">操作ツール</span>
              <Settings className="w-3 h-3 text-gray-500" />
            </div>
            <div className="space-y-1">
              <Button
                size="sm"
                variant={mapState.currentTool === 'pan' ? 'default' : 'ghost'}
                onClick={() => setTool('pan')}
                className={`w-full justify-start text-xs h-8 transition-all ${
                  mapState.currentTool === 'pan' 
                    ? 'bg-green-600 text-white shadow-sm' 
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
                title="地図を移動・拡大縮小"
              >
                <Hand className="w-3 h-3 mr-2" />
                パン・移動
              </Button>
              <Button
                size="sm"
                variant={mapState.currentTool === 'select' ? 'default' : 'ghost'}
                onClick={() => setTool('select')}
                className={`w-full justify-start text-xs h-8 transition-all ${
                  mapState.currentTool === 'select' 
                    ? 'bg-green-600 text-white shadow-sm' 
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
                title="メッシュセルを選択"
              >
                <MousePointer className="w-3 h-3 mr-2" />
                セル選択
              </Button>
              <Button
                size="sm"
                variant={mapState.currentTool === 'draw' ? 'default' : 'ghost'}
                onClick={() => setTool('draw')}
                className={`w-full justify-start text-xs h-8 transition-all ${
                  mapState.currentTool === 'draw' 
                    ? 'bg-green-600 text-white shadow-sm' 
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
                title="農地境界を描画"
              >
                <Square className="w-3 h-3 mr-2" />
                農地描画
              </Button>
            </div>
          </div>

          {/* アクションメニュー */}
          <div className="bg-white/95 backdrop-blur-md shadow-lg border border-gray-200/50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">アクション</span>
              <Info className="w-3 h-3 text-gray-500" />
            </div>
            <div className="space-y-1">
              <Button
                size="sm"
                onClick={generatePlotMesh}
                disabled={!mapState.currentPlot || mapState.isGeneratingMesh}
                className={`w-full justify-start text-xs h-8 transition-all ${
                  !mapState.currentPlot || mapState.isGeneratingMesh
                    ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-400'
                    : 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm'
                }`}
              >
                {mapState.isGeneratingMesh ? (
                  <>
                    <div className="w-3 h-3 mr-2 animate-spin border border-white border-t-transparent rounded-full"></div>
                    生成中...
                  </>
                ) : (
                  <>
                    <Square className="w-3 h-3 mr-2" />
                    メッシュ生成
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={clearSelection}
                disabled={mapState.selectedCells.length === 0}
                className={`w-full justify-start text-xs h-8 transition-all ${
                  mapState.selectedCells.length === 0
                    ? 'opacity-50 cursor-not-allowed text-gray-400'
                    : 'hover:bg-orange-50 text-orange-600 hover:text-orange-700'
                }`}
              >
                <RotateCcw className="w-3 h-3 mr-2" />
                選択解除
              </Button>
            </div>
          </div>

          {/* WAGRIデータ表示切り替え */}
          <div className="bg-white/95 backdrop-blur-md shadow-lg border border-gray-200/50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">WAGRIデータ</span>
              <Building2 className="w-3 h-3 text-gray-500" />
            </div>
            <div className="space-y-1">
              <Button
                size="sm"
                variant={showWagriData ? 'default' : 'ghost'}
                onClick={() => toggleWagriData(!showWagriData)}
                className={`w-full justify-start text-xs h-8 transition-all ${
                  showWagriData 
                    ? 'bg-orange-600 text-white shadow-sm' 
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
                title="WAGRI農地データの表示/非表示を切り替え"
              >
                <MapPin className="w-3 h-3 mr-2" />
                農地データ表示
              </Button>
              {selectedCityCode && (
                <div className="text-xs text-gray-600 mt-2">
                  <div className="flex items-center space-x-1">
                    <span>🌾</span>
                    <span>農地ピン: {wagriFarmPins.length}件</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span>🗺️</span>
                    <span>ポリゴン: {wagriPolygons.length}件</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* キーボードショートカットヘルプ */}
          <div className="bg-white/95 backdrop-blur-md shadow-lg border border-gray-200/50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">ショートカット</span>
              <Keyboard className="w-3 h-3 text-gray-500" />
            </div>
            <div className="space-y-1 text-xs text-gray-600">
              <div className="flex justify-between items-center">
                <span>地図移動</span>
                <Badge variant="outline" className="text-[10px] px-1 py-0">P</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>セル選択</span>
                <Badge variant="outline" className="text-[10px] px-1 py-0">S</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>農地描画</span>
                <Badge variant="outline" className="text-[10px] px-1 py-0">D</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>選択解除</span>
                <Badge variant="outline" className="text-[10px] px-1 py-0">ESC</Badge>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* プロフェッショナルなステータス表示 */}
      <div className="absolute bottom-4 left-4 z-10">
        <div className="bg-white/95 backdrop-blur-md shadow-lg border border-gray-200/50 rounded-xl p-4 min-w-[320px]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">ステータス情報</span>
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${
                mapState.isLoaded ? 'bg-green-500' : 'bg-yellow-500'
              }`}></div>
              <span className="text-xs text-gray-600">
                {mapState.isLoaded ? '接続中' : '読み込み中'}
              </span>
            </div>
          </div>
          
          <div className="space-y-2">
            {/* 現在のモード */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">操作モード:</span>
              <Badge 
                variant="outline" 
                className={`text-xs ${
                  mapState.currentTool === 'select' ? 'bg-green-50 text-green-700 border-green-200' :
                  mapState.currentTool === 'draw' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                  'bg-gray-50 text-gray-700 border-gray-200'
                }`}
              >
                {mapState.currentTool === 'select' ? '🎯 セル選択' :
                 mapState.currentTool === 'draw' ? '✏️ 農地描画' : '👋 地図移動'}
              </Badge>
            </div>

            {/* メッシュ情報 */}
            {mapState.meshGenerated && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">生成済みメッシュ:</span>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                    🔲 {meshCells.length}セル
                  </Badge>
                  <span className="text-xs text-gray-500">
                    ({(meshCells.length * 25).toLocaleString()}㎡)
                  </span>
                </div>
              </div>
            )}
            
            {/* 選択セル情報 */}
            {mapState.selectedCells.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">選択中:</span>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    📍 {mapState.selectedCells.length}セル
                  </Badge>
                  <span className="text-xs text-gray-500">
                    ({(mapState.selectedCells.length * 25).toLocaleString()}㎡)
                  </span>
                </div>
              </div>
            )}

            {/* 農地情報 */}
            {mapState.currentPlot && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">農地設定:</span>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  🌾 設定完了
                </Badge>
              </div>
            )}
          </div>

          {/* プログレスインジケーター */}
          {mapState.isGeneratingMesh && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-3 h-3 animate-spin border border-purple-600 border-t-transparent rounded-full"></div>
                <span className="text-sm text-purple-600 font-medium">メッシュ生成中...</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div className="bg-purple-600 h-1.5 rounded-full animate-pulse" style={{width: '65%'}}></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* プロフェッショナルな出典表示 */}
      <div className="absolute bottom-2 right-2 z-10">
        <div className="bg-black/75 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-lg flex items-center space-x-2">
          <span>出典:</span>
          <a 
            href="https://www.gsi.go.jp/" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="underline hover:text-blue-300 transition-colors"
          >
            国土地理院
          </a>
          <span className="text-white/70">|</span>
          <a 
            href="https://www.gsi.go.jp/kikaku/kikaku40014.html" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="underline hover:text-blue-300 transition-colors"
          >
            利用規約
          </a>
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
}