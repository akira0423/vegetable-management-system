/**
 * 農地メッシュ生成ユーティリティ
 * Turf.jsを使用して5m×5mメッシュを生成
 */

import * as turf from '@turf/turf'
import { bbox, squareGrid } from '@turf/turf'
import type { 
  Feature, 
  Polygon, 
  FeatureCollection, 
  MultiPolygon,
  Point
} from 'geojson'
import type { MeshCell } from '@/types/database'

export interface MeshGenerationOptions {
  cellSize: number // セルサイズ（メートル）
  units: 'meters' | 'kilometers' | 'degrees'
  cropToPolygon: boolean // ポリゴンに合わせてクロップするか
  generateStatistics: boolean // 統計情報を生成するか
  bufferDistance?: number // バッファ距離（オプション）
}

export interface MeshGenerationResult {
  cells: MeshCell[]
  totalCells: number
  coveredAreaSqm: number
  statistics?: {
    totalGridCells: number
    intersectingCells: number
    coveragePercentage: number
    averageCellArea: number
  }
}

export interface CoordinateTransformOptions {
  sourceEPSG: number
  targetEPSG: number
  region: 'kanto' | 'kansai' | 'kyushu' | 'tohoku' | 'hokkaido' | 'other'
}

/**
 * JGD2011平面直角座標系のEPSGコード取得
 */
export function getJGD2011EPSG(region: string, longitude: number): number {
  // 関東地方の場合（例）
  if (region === 'kanto' || (longitude >= 138.5 && longitude <= 140.5)) {
    return 6677 // 第IX系
  }
  // 関西地方の場合
  if (region === 'kansai' || (longitude >= 134.0 && longitude <= 136.5)) {
    return 6674 // 第VI系
  }
  // その他の地域は適切なEPSGコードを返す
  // ここでは簡略化のため関東を使用
  return 6677
}

/**
 * WGS84座標をJGD2011平面直角座標系に変換（簡易版）
 * 実運用では proj4js を使用することを推奨
 */
export function transformToJGD2011(
  coordinates: [number, number],
  options: Partial<CoordinateTransformOptions> = {}
): [number, number] {
  // 実際の座標変換は複雑なため、ここでは簡易的な変換を実装
  // 実運用では proj4js ライブラリの使用を推奨
  const [lng, lat] = coordinates
  
  // 簡易的な変換（関東地方を想定）
  // 実際には正確な変換パラメータが必要
  const x = (lng - 139.833333) * 111320 * Math.cos(lat * Math.PI / 180)
  const y = (lat - 36.0) * 110540
  
  return [x, y]
}

/**
 * JGD2011平面直角座標系からWGS84に変換（簡易版）
 */
export function transformFromJGD2011(
  coordinates: [number, number],
  options: Partial<CoordinateTransformOptions> = {}
): [number, number] {
  const [x, y] = coordinates
  
  // 簡易的な逆変換
  const lat = (y / 110540) + 36.0
  const lng = (x / (111320 * Math.cos(lat * Math.PI / 180))) + 139.833333
  
  return [lng, lat]
}

/**
 * 高精度5mメッシュ生成システム
 * Turf.jsを使用してポリゴン内に5m×5mのメッシュグリッドを生成
 */
export async function generateMesh(
  polygonFeature: Feature<Polygon>,
  options: MeshGenerationOptions = {
    cellSize: 5,
    units: 'meters',
    cropToPolygon: true,
    generateStatistics: true
  }
): Promise<MeshGenerationResult> {
  try {
    
    
    if (!polygonFeature?.geometry?.coordinates) {
      throw new Error('Invalid polygon feature provided')
    }

    const { cellSize, units, cropToPolygon, generateStatistics, bufferDistance } = options

    // ポリゴンの境界ボックスを取得
    const boundingBox = turf.bbox(polygonFeature)
    

    // バッファを適用（オプション）
    let workingPolygon = polygonFeature
    if (bufferDistance && bufferDistance > 0) {
      workingPolygon = turf.buffer(polygonFeature, bufferDistance, { units }) as Feature<Polygon>
      
    }

    // グリッドを生成
    const grid = turf.squareGrid(boundingBox, cellSize, { units })
    

    let intersectingCells: Feature<Polygon>[] = []

    if (cropToPolygon) {
      // ポリゴンと交差するセルのみを抽出
      intersectingCells = grid.features.filter(cell => {
        try {
          // セルがポリゴンと交差または含まれるかチェック
          return turf.booleanIntersects(cell, workingPolygon) || turf.booleanWithin(cell, workingPolygon)
        } catch (error) {
          
          return false
        }
      })
      
    } else {
      intersectingCells = grid.features
    }

    // MeshCellオブジェクトに変換
    const meshCells: MeshCell[] = intersectingCells.map((cell, index) => {
      const cellBbox = turf.bbox(cell)
      const centroid = turf.centroid(cell)
      const area = turf.area(cell) // 平方メートル

      // セルの行・列番号を計算
      const rowCol = calculateRowCol(centroid.geometry.coordinates, boundingBox, cellSize, units)

      // 安定したセルIDを生成
      const cellId = `cell_${rowCol.row}_${rowCol.col}_${cellSize}m`

      return {
        id: cellId,
        row: rowCol.row,
        col: rowCol.col,
        bounds: cellBbox as [number, number, number, number], // [west, south, east, north]
        center: [centroid.geometry.coordinates[0], centroid.geometry.coordinates[1]] as [number, number],
        area_square_meters: area,
        geometry: {
          type: 'Feature',
          geometry: cell.geometry,
          properties: cell.properties || {}
        },
        isSelected: false,
        isOccupied: false,
        vegetable_id: null,
        plant_count: 0,
        growth_stage: 'planned' as const,
        health_status: 'healthy' as const
      }
    })

    // 統計情報を計算
    let statistics = undefined
    if (generateStatistics) {
      const totalGridCells = grid.features.length
      const intersectingCellsCount = meshCells.length
      const coveragePercentage = (intersectingCellsCount / totalGridCells) * 100
      const averageCellArea = meshCells.length > 0 
        ? meshCells.reduce((sum, cell) => sum + cell.area_square_meters, 0) / meshCells.length
        : 0

      statistics = {
        totalGridCells,
        intersectingCells: intersectingCellsCount,
        coveragePercentage,
        averageCellArea
      }

      
    }

    const result: MeshGenerationResult = {
      cells: meshCells,
      totalCells: meshCells.length,
      coveredAreaSqm: meshCells.reduce((sum, cell) => sum + cell.area_square_meters, 0),
      statistics
    }

    
    return result

  } catch (error) {
    
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`Mesh generation failed: ${errorMessage}`)
  }
}

/**
 * セルの行・列番号を計算
 */
function calculateRowCol(
  coordinates: [number, number],
  bbox: [number, number, number, number],
  cellSize: number,
  units: string
): { row: number; col: number } {
  const [lng, lat] = coordinates
  const [west, south, east, north] = bbox

  // セルサイズを度に変換（概算）
  const cellSizeDeg = units === 'meters' ? cellSize / 111000 : cellSize

  const col = Math.floor((lng - west) / cellSizeDeg)
  const row = Math.floor((north - lat) / cellSizeDeg) // 北から南へ

  return { row, col }
}

/**
 * 選択されたセルのポリゴン情報を取得
 */
export function getSelectedCellsPolygons(
  cells: MeshCell[],
  gridFeatures: FeatureCollection<Polygon>
): Feature<Polygon>[] {
  const selectedCells = cells.filter(cell => cell.isSelected)
  
  return gridFeatures.features.filter((feature, index) => {
    const cell = cells[index]
    return cell && cell.isSelected
  })
}

/**
 * セル選択状態を更新
 */
export function updateCellSelection(
  cells: MeshCell[],
  selectedCellIds: string[],
  isSelected: boolean = true
): MeshCell[] {
  return cells.map(cell => ({
    ...cell,
    isSelected: isSelected ? selectedCellIds.includes(cell.id) : cell.isSelected
  }))
}

/**
 * 範囲選択でセルを選択
 */
export function selectCellsInBounds(
  cells: MeshCell[],
  bounds: [number, number, number, number] // [west, south, east, north]
): MeshCell[] {
  const [west, south, east, north] = bounds
  
  return cells.map(cell => ({
    ...cell,
    isSelected: (
      (cell.centerLng || cell.center[0]) >= west &&
      (cell.centerLng || cell.center[0]) <= east &&
      (cell.centerLat || cell.center[1]) >= south &&
      (cell.centerLat || cell.center[1]) <= north
    )
  }))
}

/**
 * 指定されたポイントが含まれるセルを検索
 */
export function findCellAtPoint(
  cells: MeshCell[],
  longitude: number,
  latitude: number
): MeshCell | null {
  for (const cell of cells) {
    const [west, south, east, north] = cell.bounds
    if (longitude >= west && longitude <= east && latitude >= south && latitude <= north) {
      return cell
    }
  }
  return null
}

/**
 * 選択されたセルの統計情報を計算
 */
export function calculateCellStatistics(cells: MeshCell[]) {
  const selectedCells = cells.filter(cell => cell.isSelected)
  const occupiedCells = cells.filter(cell => cell.isOccupied)
  
  const totalArea = cells.reduce((sum, cell) => sum + cell.area_square_meters, 0)
  const selectedArea = selectedCells.reduce((sum, cell) => sum + cell.area_square_meters, 0)
  const occupiedArea = occupiedCells.reduce((sum, cell) => sum + cell.area_square_meters, 0)

  return {
    totalCells: cells.length,
    selectedCells: selectedCells.length,
    occupiedCells: occupiedCells.length,
    totalAreaSqm: totalArea,
    selectedAreaSqm: selectedArea,
    occupiedAreaSqm: occupiedArea,
    utilizationRate: totalArea > 0 ? (occupiedArea / totalArea) * 100 : 0
  }
}

/**
 * メッシュセルをバッチで選択/選択解除
 */
export function updateCellSelectionBatch(
  cells: MeshCell[],
  cellIds: string[],
  selected: boolean
): MeshCell[] {
  return cells.map(cell => ({
    ...cell,
    isSelected: cellIds.includes(cell.id) ? selected : cell.isSelected
  }))
}

/**
 * 矩形選択でセルを選択
 */
export function selectCellsInBoundsAdvanced(
  cells: MeshCell[],
  bounds: [number, number, number, number] // [west, south, east, north]
): MeshCell[] {
  const [west, south, east, north] = bounds
  
  return cells.filter(cell => {
    const [cellWest, cellSouth, cellEast, cellNorth] = cell.bounds
    
    // セルの中心が選択範囲内にあるかチェック
    const [centerLng, centerLat] = cell.center
    return centerLng >= west && centerLng <= east && 
           centerLat >= south && centerLat <= north
  })
}

/**
 * MeshCellの配列をGeoJSON FeatureCollectionに変換
 */
export function cellsToGeoJSON(cells: MeshCell[]): FeatureCollection {
  const features = cells.map(cell => ({
    type: 'Feature' as const,
    geometry: cell.geometry.geometry,
    properties: {
      id: cell.id,
      row: cell.row,
      col: cell.col,
      area_square_meters: cell.area_square_meters,
      isSelected: cell.isSelected,
      isOccupied: cell.isOccupied,
      vegetable_id: cell.vegetable_id,
      plant_count: cell.plant_count,
      growth_stage: cell.growth_stage,
      health_status: cell.health_status
    }
  }))

  return {
    type: 'FeatureCollection',
    features
  }
}

/**
 * Web Worker用のメッシュ生成関数
 */
export function generateMeshInWorker(
  polygonData: string,
  options: Partial<MeshGenerationOptions>
): Promise<MeshGenerationResult> {
  return new Promise((resolve, reject) => {
    // Web Worker実装は後続のタスクで対応
    // 現在は同期実行
    try {
      const polygon = JSON.parse(polygonData) as Feature<Polygon | MultiPolygon>
      generateMesh(polygon, options).then(resolve).catch(reject)
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * デバッグ用：メッシュ生成結果をログ出力
 */
export function debugMeshResult(result: MeshGenerationResult) {
  // デバッグログは削除済み
}