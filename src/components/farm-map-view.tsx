'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogFooter } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ProfessionalFarmEditor from './professional-farm-editor'
import { 
  X, 
  MapPin,
  Save,
  Eye,
  EyeOff,
  Download,
  Loader2,
  Calendar,
  Sprout,
  Activity,
  ExternalLink,
  BarChart3,
  Target,
  Menu,
  ChevronLeft,
  Info,
  Square,
  Trash2,
  Edit,
  Edit3,
  Palette
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { MeshCell } from '@/types/database'
import { useRealtimeSync } from '@/lib/realtime-sync'

interface FarmMapViewProps {
  onClose: () => void
}

interface PlotPolygon {
  id: string
  name: string
  description?: string
  coordinates: number[][]
  area: number
  perimeter: number
  isValid: boolean
  isVisible: boolean
  color: string
  createdAt: Date
}

export default function FarmMapView({ onClose }: FarmMapViewProps) {
  const [selectedCells, setSelectedCells] = useState<MeshCell[]>([])
  const [currentPlot, setCurrentPlot] = useState<PlotPolygon | null>(null)
  const [showStats, setShowStats] = useState(true)
  const [savedAreas, setSavedAreas] = useState<any[]>([])
  const [registeredVegetables, setRegisteredVegetables] = useState<any[]>([])
  const [isLoadingVegetables, setIsLoadingVegetables] = useState(false)
  const [selectedVegetable, setSelectedVegetable] = useState<any>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showNewVegetableModal, setShowNewVegetableModal] = useState(false) // 新規栽培情報入力モーダル
  const [newAreaData, setNewAreaData] = useState<any>(null) // 新規エリアデータ
  const [showSidebar, setShowSidebar] = useState(true)
  
  // 複数削除機能用の状態
  const [deleteMode, setDeleteMode] = useState(false)
  const [selectedVegetableIds, setSelectedVegetableIds] = useState<Set<string>>(new Set())
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false)
  
  // 編集機能用の状態
  const [isEditMode, setIsEditMode] = useState(false)
  const [editFormData, setEditFormData] = useState<any>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isPolygonEditMode, setIsPolygonEditMode] = useState(false)
  
  // 🆕 複数ポリゴン表示管理システム
  const [visiblePolygons, setVisiblePolygons] = useState<Set<string>>(new Set())
  const [polygonColors, setPolygonColors] = useState<Map<string, string>>(new Map())
  
  // 🆕 モバイル対応（タッチデバイス検出）
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  
  const router = useRouter()
  const { notifyVegetableChange, onDataChange } = useRealtimeSync()
  
  const mapEditorRef = useRef<{ 
    flyToLocation: (lng: number, lat: number, zoom?: number) => void; 
    fitBounds: (bounds: [[number, number], [number, number]]) => void;
    enablePolygonEditMode?: (vegetable: any) => void;
    saveEditedPolygon?: (vegetableId: string) => any;
    showVegetablePolygon?: (vegetable: any) => void;
    clearVegetablePolygons?: () => void;
    updatePolygonColor?: (vegetableId: string, newColor: string) => void;
    // 🆕 複数ポリゴン管理用の新しいメソッド
    showMultiplePolygons?: (vegetables: any[]) => void;
    hidePolygon?: (vegetableId: string) => void;
    showPolygon?: (vegetable: any) => void;
    clearAllPolygons?: () => void;
  }>(null)

  // 🆕 タッチデバイス検出とモバイル対応の初期化
  useEffect(() => {
    // タッチデバイス検出
    const checkTouchDevice = () => {
      setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0)
    }
    checkTouchDevice()
    
    // リサイズ時にも再チェック
    window.addEventListener('resize', checkTouchDevice)
    return () => window.removeEventListener('resize', checkTouchDevice)
  }, [])

  // サイドバー表示状態をセッションストレージから復元＋レスポンシブ対応
  useEffect(() => {
    const savedState = sessionStorage.getItem('farmMapSidebarVisible')
    const isMobile = window.innerWidth < 768
    
    if (savedState !== null && !isMobile) {
      setShowSidebar(JSON.parse(savedState))
    } else {
      // モバイルでは初期状態で非表示
      setShowSidebar(!isMobile)
    }
  }, [])

  // サイドバー切り替えハンドラー
  const toggleSidebar = useCallback(() => {
    const newState = !showSidebar
    setShowSidebar(newState)
    sessionStorage.setItem('farmMapSidebarVisible', JSON.stringify(newState))
    console.log('🔄 サイドバー表示切り替え:', newState ? '表示' : '非表示')
  }, [showSidebar])

  // 栽培野菜データ取得（プロフェッショナル版：リアルタイム対応）
  const loadRegisteredVegetables = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoadingVegetables(true)
    
    try {
      console.log('🔄 野菜データをリロード中...')
      // 現在のユーザー情報を取得
      const userResponse = await fetch('/api/auth/user')
      let companyId = 'a1111111-1111-1111-1111-111111111111' // デフォルト
      
      if (userResponse.ok) {
        const userData = await userResponse.json()
        if (userData.success && userData.user?.company_id) {
          companyId = userData.user.company_id
          console.log('✅ ユーザーのcompany_id:', companyId)
        }
      }
      
      const response = await fetch(`/api/vegetables?company_id=${companyId}`)
      
      if (response.ok) {
        const result = await response.json()
        
        if (result.success && result.data) {
          // 新しいAPIレスポンス形式に対応
          const processedVegetables = result.data
            .filter((vegetable: any) => {
              // 有効なIDを持つレコードのみ
              if (!vegetable.id) return false
              
              // deleted_atがあれば除外（ソフト削除済み）
              if (vegetable.deleted_at) {
                console.log('🗑️ 削除済みデータをスキップ:', vegetable.name)
                return false
              }
              
              return true
            })
            .map((vegetable: any) => ({
              ...vegetable,
              // 新しいスキーマから位置情報を復元
              farm_area_data: vegetable.spatial_data,
              has_spatial_data: vegetable.spatial_data !== null,
              polygon_color: vegetable.polygon_color || '#22c55e' // データベースから取得
            }))
          
          console.log(`✅ ${processedVegetables.length}件の野菜データを取得`)
          setRegisteredVegetables(processedVegetables)
          
          // 他のページにもデータ更新を通知
          window.dispatchEvent(new CustomEvent('vegetableDataUpdated', {
            detail: { vegetables: processedVegetables, source: 'farm-map-view' }
          }))
        } else {
          console.warn('⚠️ 野菜データが空です')
          setRegisteredVegetables([])
        }
      } else {
        console.error('❌ APIレスポンスエラー:', response.status)
        setRegisteredVegetables([])
      }
    } catch (error) {
      console.error('❌ 栽培野菜データの取得に失敗:', error)
      setRegisteredVegetables([])
    } finally {
      if (showLoading) setIsLoadingVegetables(false)
    }
  }, [])

  // セル選択ハンドラー
  const handleCellsSelected = useCallback((cells: MeshCell[]) => {
    setSelectedCells(cells)
  }, [])

  // 農地エリア保存完了ハンドラー
  const handleAreaSaved = useCallback((areaData: any) => {
    console.log('🎯 [FarmMapView] handleAreaSaved が呼び出されました')
    console.log('📊 受信したエリアデータ:', areaData)
    
    try {
      // 新規エリアデータを保存
      console.log('💾 新規エリアデータを保存中...')
      setNewAreaData(areaData)
      
      // 栽培情報入力モーダルを表示
      console.log('🚀 栽培情報入力モーダルを表示中...')
      setShowNewVegetableModal(true)
      
      console.log('✅ モーダル表示完了 - showNewVegetableModal = true')
    } catch (error) {
      console.error('❌ [FarmMapView] handleAreaSaved エラー:', error)
    }
    
    // 農地情報を表示用に更新
    if (areaData.geometry) {
      const mockPlot: PlotPolygon = {
        id: areaData.id || 'new-plot',
        name: areaData.name,
        description: areaData.description,
        coordinates: areaData.geometry.geometry.coordinates[0],
        area: areaData.area_square_meters,
        perimeter: 0, // 計算が必要
        isValid: true,
        isVisible: true,
        color: '#22c55e',
        createdAt: new Date()
      }
      setCurrentPlot(mockPlot)
    }
    
    // 農地エリアをリストに追加
    setSavedAreas(prev => [...prev, areaData])
  }, [loadRegisteredVegetables])

  // 新規栽培情報保存ハンドラー（プロフェッショナル版）
  const handleNewVegetableSave = useCallback(async (vegetableData: any) => {
    try {
      console.log('🌱 新規栽培情報を保存します:', vegetableData)
      console.log('🗺️ 紐づけるエリアデータ:', newAreaData)
      
      // 現在のユーザー情報を取得
      const userResponse = await fetch('/api/auth/user')
      let companyId = 'a1111111-1111-1111-1111-111111111111' // デフォルト
      let createdBy = null
      
      if (userResponse.ok) {
        const userData = await userResponse.json()
        if (userData.success && userData.user) {
          companyId = userData.user.company_id || companyId
          createdBy = userData.user.id
          console.log('✅ 保存用ユーザー情報:', { companyId, createdBy })
        }
      }

      // 農地ポリゴンデータと栽培情報を確実に紐づけ
      const completeData = {
        ...vegetableData,
        // 新しいスキーマに合わせてplot_sizeをarea_sizeに統一
        area_size: vegetableData.plot_size || newAreaData?.area_square_meters || 0,
        company_id: companyId,
        created_by: createdBy,
        // 農地エリアデータを明示的に追加
        farm_area_data: newAreaData
      }
      
      // plot_sizeフィールドを削除（新しいスキーマにはない）
      delete completeData.plot_size
      
      console.log('📤 完全なデータペイロード:', completeData)
      
      // API呼び出しで栽培情報を保存
      const response = await fetch('/api/vegetables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(completeData),
      })

      const result = await response.json()
      
      if (result.success) {
        console.log('✅ 栽培情報保存成功:', result.data)
        
        // リアルタイム同期通知を送信
        notifyVegetableChange('created', result.data)
        
        // リアルタイム更新：即座に一覧に反映
        setShowNewVegetableModal(false)
        setNewAreaData(null)
        
        // 野菜一覧を即座に更新
        await loadRegisteredVegetables()
        
        // 成功通知とデータ確認
        const savedVegetable = result.data
        console.log('💾 保存された野菜データ:', savedVegetable)
        
        // 新しく登録された野菜を地図上に表示（オプション）
        if (savedVegetable) {
          const vegetableToShow = {
            ...savedVegetable,
            farm_area_data: newAreaData,
            has_spatial_data: true
          }
          
          setTimeout(() => {
            if (mapEditorRef.current?.showPolygon) {
              mapEditorRef.current.showPolygon(vegetableToShow)
              console.log('🟢 新規野菜をポリゴン表示:', savedVegetable.name)
            } else if (mapEditorRef.current?.showVegetablePolygon) {
              mapEditorRef.current.showVegetablePolygon(vegetableToShow)
              console.log('🟢 (レガシー) 新規野菜をポリゴン表示:', savedVegetable.name)
            }
          }, 1000)
        }
        
        // カスタムイベントで他のページにも通知
        window.dispatchEvent(new CustomEvent('vegetableRegistered', {
          detail: savedVegetable
        }))
        
        alert(`栽培情報「${savedVegetable.name}」を登録しました！\n面積: ${(savedVegetable.area_size / 10000).toFixed(3)} ha`)
      } else {
        console.error('❌ API保存失敗:', result)
        throw new Error(result.error || '栽培情報の保存に失敗しました')
      }
    } catch (error) {
      console.error('❌ 栽培情報保存エラー:', error)
      alert(`栽培情報の保存に失敗しました: ${error.message}`)
    }
  }, [newAreaData, loadRegisteredVegetables])

  // 新規栽培情報入力モーダルを閉じる
  const handleCloseNewVegetableModal = useCallback(() => {
    setShowNewVegetableModal(false)
    setNewAreaData(null)
  }, [])

  // モーダル状態の変更を監視
  useEffect(() => {
    console.log('🔍 [useEffect] showNewVegetableModal が変更されました:', showNewVegetableModal)
    if (showNewVegetableModal) {
      console.log('✅ 栽培情報入力モーダルが表示されました')
      console.log('📊 表示中のエリアデータ:', newAreaData)
    } else {
      console.log('❌ 栽培情報入力モーダルが非表示です')
    }
  }, [showNewVegetableModal, newAreaData])

  // コンポーネントマウント時に野菜データを読み込み
  useEffect(() => {
    loadRegisteredVegetables()
  }, [loadRegisteredVegetables])

  // リアルタイム同期：他のページからの更新イベントを受信
  useEffect(() => {
    // 野菜データ変更イベントの監視
    const unsubscribeVegetableCreated = onDataChange('vegetable_created', () => {
      console.log('🔔 野菜作成イベント受信 - データを再読み込み')
      loadRegisteredVegetables(false)
    })

    const unsubscribeVegetableUpdated = onDataChange('vegetable_updated', () => {
      console.log('🔔 野菜更新イベント受信 - データを再読み込み')
      loadRegisteredVegetables(false)
    })

    const unsubscribeVegetableDeleted = onDataChange('vegetable_deleted', () => {
      console.log('🔔 野菜削除イベント受信 - データを再読み込み')
      loadRegisteredVegetables(false)
    })

    const unsubscribeVegetableArchived = onDataChange('vegetable_archived', () => {
      console.log('🔔 野菜アーカイブイベント受信 - データを再読み込み')
      loadRegisteredVegetables(false)
    })

    // 全体データ更新イベントの監視
    const unsubscribeAnalyticsUpdated = onDataChange('analytics_updated', () => {
      console.log('🔔 アナリティクス更新イベント受信 - データを再読み込み')
      loadRegisteredVegetables(false)
    })

    // クリーンアップ
    return () => {
      unsubscribeVegetableCreated()
      unsubscribeVegetableUpdated()
      unsubscribeVegetableDeleted()
      unsubscribeVegetableArchived()
      unsubscribeAnalyticsUpdated()
    }
  }, [onDataChange, loadRegisteredVegetables])

  // イベント監視：他のページからの更新通知を受信（プロフェッショナル版）
  useEffect(() => {
    const handleVegetableRegistered = (event: CustomEvent) => {
      console.log('🔔 野菜登録イベント受信:', event.detail)
      loadRegisteredVegetables(false) // ローディング表示なしで更新
    }

    const handleVegetableUpdated = (event: CustomEvent) => {
      console.log('🔔 野菜更新イベント受信:', event.detail)
      if (event.detail.source !== 'farm-map-view') {
        loadRegisteredVegetables(false)
      }
    }

    const handleDataRefresh = (event: CustomEvent) => {
      console.log('🔔 データ全体更新イベント受信:', event.detail)
      loadRegisteredVegetables(false)
    }

    // 各種イベントリスナーを登録
    window.addEventListener('vegetableRegistered', handleVegetableRegistered as EventListener)
    window.addEventListener('vegetableDataUpdated', handleVegetableUpdated as EventListener)
    window.addEventListener('globalDataRefresh', handleDataRefresh as EventListener)
    
    return () => {
      window.removeEventListener('vegetableRegistered', handleVegetableRegistered as EventListener)
      window.removeEventListener('vegetableDataUpdated', handleVegetableUpdated as EventListener)
      window.removeEventListener('globalDataRefresh', handleDataRefresh as EventListener)
    }
  }, [loadRegisteredVegetables])

  // 野菜エリアへの移動
  const handleCreateVegetable = useCallback(() => {
    // 選択されたセルを使った野菜登録の処理
    console.log('野菜登録画面へ移動:', selectedCells)
  }, [selectedCells])

  // 🆕 複数ポリゴン表示対応の野菜エリアクリックハンドラー
  const handleVegetableAreaClick = useCallback((vegetable: any) => {
    console.log('🥕 野菜エリアをクリック (複数表示モード):', vegetable)
    
    if (!vegetable.farm_area_data?.geometry || !mapEditorRef.current) {
      console.warn('⚠️ 野菜の位置情報が見つからません:', vegetable)
      alert('この野菜の位置情報が登録されていないため、地図に移動できません。')
      return
    }

    const vegetableId = vegetable.id
    
    // 既に表示されている場合はトグル動作（非表示にする）
    if (visiblePolygons.has(vegetableId)) {
      console.log('🔄 既に表示中のポリゴンを非表示にします:', vegetableId)
      
      // 表示リストから削除
      setVisiblePolygons(prev => {
        const newSet = new Set(prev)
        newSet.delete(vegetableId)
        return newSet
      })
      
      // 地図上から非表示
      if (mapEditorRef.current?.hidePolygon) {
        mapEditorRef.current.hidePolygon(vegetableId)
      } else {
        console.warn('⚠️ ポリゴン非表示メソッドが利用できません')
      }
      
      return
    }

    // 新しいポリゴンを表示リストに追加
    console.log('➕ 新しいポリゴンを表示リストに追加:', vegetableId)
    setVisiblePolygons(prev => new Set([...prev, vegetableId]))
    
    // ポリゴンの色を管理
    if (!polygonColors.has(vegetableId)) {
      const color = vegetable.polygon_color || '#22c55e'
      setPolygonColors(prev => new Map(prev).set(vegetableId, color))
    }

    // 地図上にポリゴンを表示（新しいメソッドを優先）
    if (mapEditorRef.current?.showPolygon) {
      mapEditorRef.current.showPolygon(vegetable)
      console.log('🟢 ポリゴンを表示しました:', vegetableId)
    } else if (mapEditorRef.current?.showVegetablePolygon) {
      // レガシーメソッドのフォールバック
      mapEditorRef.current.showVegetablePolygon(vegetable)
      console.log('🟢 (レガシー) ポリゴンを表示しました:', vegetableId)
    } else {
      console.warn('⚠️ ポリゴン表示メソッドが利用できません')
    }
    
    // ポリゴン表示後、該当位置に地図を移動
    moveMapToVegetable(vegetable)
    
    // 詳細情報を設定
    setSelectedVegetable(vegetable)
  }, [visiblePolygons, polygonColors, setSelectedVegetable])

  // 🆕 地図移動ヘルパー関数
  const moveMapToVegetable = useCallback((vegetable: any) => {
    if (!vegetable.farm_area_data?.geometry || !mapEditorRef.current) return
    
    const geometry = vegetable.farm_area_data.geometry
    if (geometry.geometry && geometry.geometry.coordinates) {
      const coordinates = geometry.geometry.coordinates[0]
      let centerLng = 0
      let centerLat = 0
      
      coordinates.forEach((coord: [number, number]) => {
        centerLng += coord[0]
        centerLat += coord[1]
      })
      
      centerLng /= coordinates.length
      centerLat /= coordinates.length
      
      mapEditorRef.current.flyToLocation(centerLng, centerLat, 18)
      console.log('📍 地図を野菜位置に移動しました:', centerLng, centerLat)
    }
  }, [])

  // 🆕 右クリックで全ポリゴン削除ハンドラー
  const handleMapRightClick = useCallback((event: any) => {
    event.preventDefault() // コンテキストメニューを無効化
    
    console.log('🖱️ 地図右クリック: 全ポリゴンを削除します')
    
    // 全てのポリゴンを非表示
    setVisiblePolygons(new Set())
    
    // 選択状態もリセット
    setSelectedVegetable(null)
    
    // 地図上のポリゴンをクリア
    if (mapEditorRef.current && (mapEditorRef.current as any).clearAllPolygons) {
      (mapEditorRef.current as any).clearAllPolygons()
    } else if (mapEditorRef.current && (mapEditorRef.current as any).clearVegetablePolygons) {
      // レガシーメソッドのフォールバック
      (mapEditorRef.current as any).clearVegetablePolygons()
    }
    
    console.log('✨ 全ポリゴンを削除しました')
  }, [])

  // 🆕 個別ポリゴンダブルクリック削除ハンドラー
  const handlePolygonDoubleClick = useCallback((vegetableId: string) => {
    console.log('🖱️ ポリゴンダブルクリック: 個別削除します:', vegetableId)
    
    // 表示リストから削除
    setVisiblePolygons(prev => {
      const newSet = new Set(prev)
      newSet.delete(vegetableId)
      return newSet
    })
    
    // 地図上から非表示
    if (mapEditorRef.current && (mapEditorRef.current as any).hidePolygon) {
      (mapEditorRef.current as any).hidePolygon(vegetableId)
    }
    
    console.log('✨ ポリゴンを個別削除しました:', vegetableId)
  }, [])

  // 🆕 全ポリゴン表示/非表示切り替えヘルパー
  const toggleAllPolygons = useCallback(() => {
    if (visiblePolygons.size > 0) {
      // 全て非表示
      setVisiblePolygons(new Set())
      if (mapEditorRef.current && (mapEditorRef.current as any).clearAllPolygons) {
        (mapEditorRef.current as any).clearAllPolygons()
      }
      console.log('👁️ 全ポリゴンを非表示にしました')
    } else {
      // 全て表示
      const allVegetableIds = registeredVegetables
        .filter(v => v.has_spatial_data)
        .map(v => v.id)
      
      setVisiblePolygons(new Set(allVegetableIds))
      
      if (mapEditorRef.current && (mapEditorRef.current as any).showMultiplePolygons) {
        (mapEditorRef.current as any).showMultiplePolygons(registeredVegetables.filter(v => v.has_spatial_data))
      }
      console.log('👁️ 全ポリゴンを表示しました')
    }
  }, [visiblePolygons.size, registeredVegetables])

  // 野菜詳細確認ハンドラー
  const handleVegetableDetailClick = useCallback((vegetable: any) => {
    console.log('📋 野菜詳細確認をクリック:', vegetable)
    setSelectedVegetable(vegetable)
    setShowDetailModal(true)
  }, [])

  // 詳細モーダルを閉じる
  const handleCloseDetailModal = useCallback(() => {
    setShowDetailModal(false)
    setSelectedVegetable(null)
    setIsEditMode(false)
    setEditFormData(null)
    setIsPolygonEditMode(false)
  }, [])

  // 編集モード開始
  const handleStartEdit = useCallback(() => {
    if (!selectedVegetable) return
    
    const formData = {
      name: selectedVegetable.name || '',
      variety_name: selectedVegetable.variety_name || '',
      plot_name: selectedVegetable.plot_name || '',
      area_size: selectedVegetable.area_size || 0,
      planting_date: selectedVegetable.planting_date ? selectedVegetable.planting_date.split('T')[0] : '',
      expected_harvest_start: selectedVegetable.expected_harvest_start ? selectedVegetable.expected_harvest_start.split('T')[0] : '',
      expected_harvest_end: selectedVegetable.expected_harvest_end ? selectedVegetable.expected_harvest_end.split('T')[0] : '',
      notes: selectedVegetable.notes || '',
      status: selectedVegetable.status || 'planning',
      polygon_color: selectedVegetable.polygon_color || '#22c55e'
    }
    
    console.log('📝 編集モード開始 - 選択された野菜:', selectedVegetable)
    console.log('📝 編集フォームデータ:', formData)
    
    setEditFormData(formData)
    setIsEditMode(true)
    
    // 編集対象の野菜ポリゴンを地図上に表示
    if (selectedVegetable.has_spatial_data) {
      if (mapEditorRef.current?.showPolygon) {
        mapEditorRef.current.showPolygon(selectedVegetable)
        console.log('🟢 編集対象をポリゴン表示:', selectedVegetable.name)
      } else if (mapEditorRef.current?.showVegetablePolygon) {
        mapEditorRef.current.showVegetablePolygon(selectedVegetable)
        console.log('🟢 (レガシー) 編集対象をポリゴン表示:', selectedVegetable.name)
      }
    }
    
    console.log('✏️ 編集モード開始:', selectedVegetable)
  }, [selectedVegetable])

  // 編集フォーム更新
  const handleEditFormChange = useCallback((field: string, value: any) => {
    setEditFormData((prev: any) => ({
      ...prev,
      [field]: value
    }))
    
    // ポリゴンカラーが変更された場合、地図上のポリゴンも即座に更新
    if (field === 'polygon_color' && selectedVegetable && mapEditorRef.current?.updatePolygonColor) {
      mapEditorRef.current.updatePolygonColor(selectedVegetable.id, value)
    }
  }, [selectedVegetable])

  // 編集保存
  const handleSaveEdit = useCallback(async () => {
    if (!selectedVegetable || !editFormData) return
    
    setIsSaving(true)
    try {
      console.log('💾 野菜データ更新中...', editFormData)
      
      const response = await fetch('/api/vegetables', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: selectedVegetable.id,
          name: editFormData.name,
          variety_name: editFormData.variety_name,
          plot_name: editFormData.plot_name,
          area_size: editFormData.area_size,
          planting_date: editFormData.planting_date || null,
          expected_harvest_start: editFormData.expected_harvest_start || null,
          expected_harvest_end: editFormData.expected_harvest_end || null,
          status: editFormData.status,
          notes: editFormData.notes || null,
          polygon_color: editFormData.polygon_color || '#22c55e'
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        console.log('✅ 野菜データ更新成功:', result)
        
        // リアルタイム同期通知を送信
        notifyVegetableChange('updated', result.data)
        
        // 野菜リストを更新
        await loadRegisteredVegetables()
        
        // 選択中の野菜データを更新
        setSelectedVegetable({
          ...selectedVegetable,
          ...editFormData
        })
        
        setIsEditMode(false)
        setEditFormData(null)
        
        // 地図上のポリゴンをクリーンアップ
        if (mapEditorRef.current?.clearVegetablePolygons) {
          mapEditorRef.current.clearVegetablePolygons()
        }
        
        alert('野菜データを更新しました！')
      } else {
        const error = await response.json()
        console.error('❌ 野菜データ更新失敗:', error)
        console.error('❌ レスポンスステータス:', response.status)
        console.error('❌ 送信データ:', {
          id: selectedVegetable.id,
          name: editFormData.name,
          variety_name: editFormData.variety_name,
          plot_name: editFormData.plot_name,
          area_size: editFormData.area_size,
          planting_date: editFormData.planting_date || null,
          expected_harvest_start: editFormData.expected_harvest_start || null,
          expected_harvest_end: editFormData.expected_harvest_end || null,
          status: editFormData.status
        })
        alert(`更新に失敗しました: ${error.message || error.error || '不明なエラー'}`)
      }
    } catch (error) {
      console.error('❌ 野菜データ更新エラー:', error)
      alert('更新中にエラーが発生しました')
    } finally {
      setIsSaving(false)
    }
  }, [selectedVegetable, editFormData, loadRegisteredVegetables])

  // 編集キャンセル
  const handleCancelEdit = useCallback(() => {
    setIsEditMode(false)
    setEditFormData(null)
    setIsPolygonEditMode(false)
    
    // 地図上のポリゴンをクリーンアップ
    if (mapEditorRef.current?.clearVegetablePolygons) {
      mapEditorRef.current.clearVegetablePolygons()
    }
  }, [])

  // ポリゴン編集モード開始
  const handleStartPolygonEdit = useCallback(() => {
    if (!selectedVegetable?.farm_area_data?.geometry) {
      alert('このデータには地図情報が含まれていません')
      return
    }
    
    setIsPolygonEditMode(true)
    setShowDetailModal(false) // モーダルを非表示にする
    
    // professional-farm-editorでポリゴン編集モードを有効化
    if (mapEditorRef.current && typeof mapEditorRef.current.enablePolygonEditMode === 'function') {
      mapEditorRef.current.enablePolygonEditMode(selectedVegetable)
    }
    
    console.log('🗺️ ポリゴン編集モード開始:', selectedVegetable.name)
  }, [selectedVegetable])

  // ポリゴン編集保存
  const handleSavePolygonEdit = useCallback(async () => {
    if (!selectedVegetable || !mapEditorRef.current) return
    
    try {
      // 編集されたポリゴンデータを取得
      const editedGeometry = mapEditorRef.current.saveEditedPolygon && 
                            mapEditorRef.current.saveEditedPolygon(selectedVegetable.id)
      
      if (!editedGeometry) {
        alert('ポリゴンの編集データを取得できませんでした')
        return
      }
      
      console.log('💾 ポリゴンデータ更新中...', editedGeometry)
      
      // データベースに保存
      const response = await fetch('/api/vegetables', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: selectedVegetable.id,
          custom_fields: {
            ...selectedVegetable.custom_fields,
            farm_area_data: {
              geometry: editedGeometry.features[0]
            }
          }
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        console.log('✅ ポリゴンデータ更新成功')
        
        // リアルタイム同期通知を送信
        notifyVegetableChange('updated', result.data)
        
        await loadRegisteredVegetables()
        setIsPolygonEditMode(false)
        setShowDetailModal(true) // モーダルを再表示
        alert('地図エリアを更新しました！')
      } else {
        throw new Error('ポリゴンデータの更新に失敗しました')
      }
    } catch (error) {
      console.error('❌ ポリゴン編集保存エラー:', error)
      alert('ポリゴン編集の保存に失敗しました')
    }
  }, [selectedVegetable, loadRegisteredVegetables])

  // ポリゴン編集キャンセル
  const handleCancelPolygonEdit = useCallback(() => {
    setIsPolygonEditMode(false)
    setShowDetailModal(true) // モーダルを再表示
  }, [])

  // 複数削除機能の関数群
  const handleEnterDeleteMode = useCallback(() => {
    setDeleteMode(true)
    setSelectedVegetableIds(new Set())
  }, [])

  const handleExitDeleteMode = useCallback(() => {
    setDeleteMode(false)
    setSelectedVegetableIds(new Set())
  }, [])

  const handleToggleVegetableSelection = useCallback((vegetableId: string) => {
    setSelectedVegetableIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(vegetableId)) {
        newSet.delete(vegetableId)
      } else {
        newSet.add(vegetableId)
      }
      return newSet
    })
  }, [])

  const handleConfirmMultipleDelete = useCallback(() => {
    if (selectedVegetableIds.size === 0) {
      alert('削除する野菜を選択してください')
      return
    }
    setShowDeleteConfirmDialog(true)
  }, [selectedVegetableIds.size])

  const handleExecuteMultipleDelete = useCallback(async () => {
    try {
      console.log('🗑️ 野菜削除処理を開始:', Array.from(selectedVegetableIds))
      
      // APIで各野菜を削除
      const deletePromises = Array.from(selectedVegetableIds).map(async (vegetableId) => {
        const response = await fetch(`/api/vegetables?id=${vegetableId}`, {
          method: 'DELETE',
        })
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `野菜ID ${vegetableId} の削除に失敗`)
        }
        
        const result = await response.json()
        console.log(`✅ 野菜削除成功:`, result)
        return result
      })
      
      // 全ての削除処理を並行実行
      const results = await Promise.all(deletePromises)
      
      // 時限ソフトデリート戦略：リアルタイム同期通知を送信
      Array.from(selectedVegetableIds).forEach(vegetableId => {
        // アーカイブ通知として送信（完全削除ではないため）
        notifyVegetableChange('updated', { 
          id: vegetableId, 
          action: 'archived',
          message: '6ヶ月間の時限アーカイブ' 
        })
      })
      
      // 時限ソフトデリート戦略：ローカル状態の即座更新を削除し、API再読み込みに統一
      console.log('🔄 削除完了 - 野菜データを再読み込み中...')
      
      // 削除後にAPI経由で最新データを取得（ソフトデリートされたデータは自動的に除外される）
      await loadRegisteredVegetables(false)
      
      setShowDeleteConfirmDialog(false)
      setDeleteMode(false)
      setSelectedVegetableIds(new Set())
      
      // 削除結果の詳細表示
      const deletedCount = results.filter(r => r.action === 'deleted').length
      const archivedCount = results.filter(r => r.action === 'archived').length
      
      // 時限ソフトデリート戦略：メッセージを統一
      const totalCount = selectedVegetableIds.size
      let message = `${totalCount}件の野菜を削除しました。\n`
      message += `アーカイブ済み: ${archivedCount}件 (6ヶ月後に自動完全削除)\n`
      message += `削除された野菜は一覧から非表示になりますが、6ヶ月間はデータが保持されます。`
      
      alert(message)
      
    } catch (error) {
      console.error('❌ 削除エラー:', error)
      alert(`削除に失敗しました: ${error.message}`)
    }
  }, [selectedVegetableIds, loadRegisteredVegetables])

  // 日付フォーマット関数
  const formatDate = (dateString: string) => {
    if (!dateString) return '未設定'
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* プロフェッショナルヘッダー */}
      <div className="bg-gradient-to-r from-white to-gray-50/50 border-b border-gray-200/60 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-green-600 to-green-700 rounded-xl flex items-center justify-center">
                <Sprout className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">栽培野菜登録/管理</h1>
                <div className="mt-1">
                  <button
                    onClick={toggleSidebar}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white/80 hover:bg-white border border-gray-200 rounded-lg transition-all duration-200 hover:shadow-md"
                  >
                    {showSidebar ? (
                      <>
                        <EyeOff className="w-4 h-4" />
                        非表示
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4" />
                        基本操作ガイド・栽培野菜一覧
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
            
          </div>
          
          <div className="flex items-center gap-4">
            {/* ステータス表示 */}
            {showStats && (
              <div className="flex items-center space-x-3 text-sm">
                {currentPlot && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 px-3 py-1">
                    <Save className="w-3 h-3 mr-1.5" />
                    農地設定済み
                  </Badge>
                )}
                {selectedCells.length > 0 && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 px-3 py-1">
                    <Square className="w-3 h-3 mr-1.5" />
                    {selectedCells.length}セル選択中
                  </Badge>
                )}
              </div>
            )}
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowStats(!showStats)}
              className="hover:bg-gray-100 border-gray-300"
            >
              <Eye className="w-4 h-4" />
            </Button>
            
            <Button 
              variant="outline" 
              onClick={onClose}
              className="hover:bg-red-50 hover:text-red-700 hover:border-red-300 border-gray-300"
            >
              <X className="w-4 h-4 mr-2" />
              閉じる
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex relative">
        {/* サイドバーオーバーレイ（モバイル用） */}
        {showSidebar && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-5 md:hidden"
            onClick={toggleSidebar}
          />
        )}
        
        {/* プロフェッショナル農地管理サイドバー */}
        <div className={`w-80 sm:w-80 md:w-80 lg:w-96 bg-gradient-to-b from-white to-gray-50/50 border-r border-gray-200/60 transition-transform duration-300 ease-in-out ${
          showSidebar ? 'translate-x-0' : '-translate-x-full'
        } ${showSidebar ? 'relative md:relative' : 'absolute'} z-10 h-full shadow-lg flex flex-col max-h-screen`}>
          
          {/* サイドバーヘッダー */}
          <div className="bg-gradient-to-r from-green-600 to-green-700 p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <Sprout className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-bold text-base">農地管理センター</h2>
                  <p className="text-xs text-green-100 opacity-90">Farm Management Hub</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 p-5 space-y-5 overflow-y-auto min-h-0 scroll-smooth scrollbar-thin scrollbar-thumb-green-300 scrollbar-track-gray-100 hover:scrollbar-thumb-green-400">
            {/* スクロール可能エリアのヒント */}
            <div className="sticky top-0 z-10 bg-gradient-to-b from-white/90 to-transparent pb-2 mb-2">
              <div className="w-full h-0.5 bg-gradient-to-r from-green-200 via-green-300 to-green-200 rounded-full opacity-30"></div>
            </div>
            <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-3 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Info className="w-3 h-3 text-blue-600" />
                  </div>
                  <CardTitle className="text-base font-semibold text-gray-800">操作ガイド</CardTitle>
                </div>
                <CardDescription className="text-xs text-gray-600">
                  効率的な農地管理のための基本操作
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-gradient-to-r from-blue-50 to-green-50/50 p-4 rounded-lg border border-blue-100">
                  <h4 className="font-medium text-sm text-blue-800 mb-3 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    基本操作
                  </h4>
                  <div className="space-y-3">
                    {/* 地図移動 */}
                    <div className="flex items-center gap-3 text-xs">
                      <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center">
                        <MapPin className="w-3 h-3 text-blue-600" />
                      </div>
                      <div>
                        <span className="font-medium text-gray-800">地図移動</span>
                        <p className="text-gray-600">ドラッグで移動・スクロールでズーム</p>
                      </div>
                    </div>
                    
                    {/* 農地描画（3ステップ） */}
                    <div className="flex items-start gap-3 text-xs">
                      <div className="w-6 h-6 bg-green-100 rounded flex items-center justify-center">
                        <Save className="w-3 h-3 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <span className="font-medium text-gray-800">農地描画</span>
                        <div className="mt-1 space-y-1">
                          <div className="flex items-center gap-2 text-gray-700">
                            <span className="w-4 h-4 bg-green-100 text-green-600 rounded-full text-center text-xs font-bold leading-4">1</span>
                            <span>農地境界頂点をクリックで追加</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-700">
                            <span className="w-4 h-4 bg-green-100 text-green-600 rounded-full text-center text-xs font-bold leading-4">2</span>
                            <span>ダブルクリックで完了</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-700">
                            <span className="w-4 h-4 bg-green-100 text-green-600 rounded-full text-center text-xs font-bold leading-4">3</span>
                            <span>栽培情報を入力・保存</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {currentPlot && (
              <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center">
                      <Save className="w-3 h-3 text-green-600" />
                    </div>
                    <CardTitle className="text-base font-semibold text-gray-800">保存された農地</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-gradient-to-r from-green-50 to-green-100/50 p-4 rounded-xl border border-green-200/50 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-green-200/30 rounded-full -translate-y-8 translate-x-8"></div>
                    <div className="relative">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-sm text-green-800">
                          {currentPlot.name}
                        </h3>
                        <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 text-xs px-2 py-0.5">
                          登録完了
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-green-700 font-medium">面積</span>
                          <span className="text-sm font-bold text-green-800">
                            {(currentPlot.area / 10000).toFixed(2)} ha
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-green-700 font-medium">平方メートル</span>
                          <span className="text-xs text-green-700">
                            {currentPlot.area.toLocaleString()} ㎡
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-green-600 mt-3 italic">
                        {currentPlot.description || '描画した農地エリア'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedCells.length > 0 && (
              <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Square className="w-3 h-3 text-blue-600" />
                    </div>
                    <CardTitle className="text-base font-semibold text-gray-800">選択中のセル</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100/50 p-4 rounded-xl border border-blue-200/50 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-blue-200/30 rounded-full -translate-y-8 translate-x-8"></div>
                    <div className="relative">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-blue-800">{selectedCells.length}</span>
                          <span className="text-sm text-blue-700 font-medium">セル選択中</span>
                        </div>
                        <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 text-xs px-2 py-0.5">
                          アクティブ
                        </Badge>
                      </div>
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-blue-700 font-medium">総面積</span>
                          <span className="text-sm font-bold text-blue-800">
                            {(selectedCells.length * 25 / 10000).toFixed(3)} ha
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-blue-700 font-medium">平方メートル</span>
                          <span className="text-xs text-blue-700">
                            {(selectedCells.length * 25).toLocaleString()} ㎡
                          </span>
                        </div>
                      </div>
                      <Button 
                        onClick={handleCreateVegetable}
                        className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-medium shadow-md hover:shadow-lg transition-all duration-200"
                        size="sm"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        野菜登録へ進む
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm flex flex-col flex-1 min-h-0 hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-3 flex-shrink-0">
                {/* 1行目: タイトルと件数 */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center">
                    <Sprout className="w-3 h-3 text-green-600" />
                  </div>
                  <CardTitle className="text-base font-semibold text-gray-800">登録野菜一覧</CardTitle>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs px-2 py-0.5">
                    {registeredVegetables.length}件
                  </Badge>
                </div>
                
                {/* 2行目: アクションボタンとステータス */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* 🆕 ポリゴン表示状態インジケーター */}
                    <Badge 
                      variant="outline" 
                      className={`text-xs px-2 py-0.5 ${
                        visiblePolygons.size > 0 
                          ? 'bg-blue-50 text-blue-700 border-blue-200' 
                          : 'bg-gray-50 text-gray-500 border-gray-200'
                      }`}
                    >
                      <Eye className="w-2.5 h-2.5 mr-1" />
                      {visiblePolygons.size}表示中
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* 🆕 全表示/非表示切り替えボタン */}
                    <Button
                      onClick={toggleAllPolygons}
                      variant="outline"
                      size="sm"
                      className={`text-xs h-6 px-2 ${
                        visiblePolygons.size > 0
                          ? 'text-blue-600 border-blue-200 hover:bg-blue-50'
                          : 'text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                      disabled={registeredVegetables.filter(v => v.has_spatial_data).length === 0}
                    >
                      {visiblePolygons.size > 0 ? (
                        <>
                          <EyeOff className="w-3 h-3 mr-1" />
                          全非表示
                        </>
                      ) : (
                        <>
                          <Eye className="w-3 h-3 mr-1" />
                          全表示
                        </>
                      )}
                    </Button>
                    {!deleteMode ? (
                      <Button
                        onClick={handleEnterDeleteMode}
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-200 hover:bg-red-50 text-xs h-6 px-2"
                        disabled={registeredVegetables.length === 0}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        削除
                      </Button>
                    ) : (
                      <div className="flex gap-1">
                        <Button
                          onClick={handleExitDeleteMode}
                          variant="outline"
                          size="sm"
                          className="text-xs h-6 px-2"
                        >
                          キャンセル
                        </Button>
                        <Button
                          onClick={handleConfirmMultipleDelete}
                          size="sm"
                          className="bg-red-600 hover:bg-red-700 text-white text-xs h-6 px-2"
                          disabled={selectedVegetableIds.size === 0}
                        >
                          確定 ({selectedVegetableIds.size})
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                <CardDescription className="text-xs text-gray-600">
                  登録済み野菜の位置確認・詳細管理
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col min-h-0">
                {/* セクション1: ローディング・空状態（固定エリア） */}
                {isLoadingVegetables ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="relative">
                      <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                      <div className="absolute inset-0 w-8 h-8 border-2 border-green-200 rounded-full"></div>
                    </div>
                    <span className="text-sm text-gray-600 mt-3">野菜データを読み込み中...</span>
                  </div>
                ) : registeredVegetables.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gradient-to-r from-green-100 to-green-200 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Sprout className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="font-medium text-gray-800 mb-2">野菜が未登録です</h3>
                    <p className="text-sm text-gray-500 mb-3">農地を描画して野菜登録を開始しましょう</p>
                    <div className="bg-gradient-to-r from-green-50 to-blue-50 p-3 rounded-lg border border-green-100">
                      <p className="text-xs text-gray-600">
                        💡 <span className="font-medium">手順：</span>地図上で農地描画 → ダブルクリック → 野菜情報入力
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* セクション2: 制限表示エリア（5件分の固定高さ） */}
                    <div 
                      className="space-y-3 overflow-y-auto pr-1 scroll-smooth scrollbar-thin scrollbar-thumb-green-300 scrollbar-track-gray-100 hover:scrollbar-thumb-green-400 relative overscroll-contain touch-pan-y"
                      style={{ 
                        maxHeight: (() => {
                          if (registeredVegetables.length <= 3) return 'auto'; // 3件以下は全表示
                          // レスポンシブ対応: モバイル3件, タブレット4件, デスクトップ5件
                          const maxVisible = window.innerWidth < 768 ? 3 : window.innerWidth < 1024 ? 4 : 5;
                          return registeredVegetables.length <= maxVisible ? 'auto' : `${maxVisible * 140}px`;
                        })(),
                        minHeight: registeredVegetables.length > 0 ? '140px' : 'auto'
                      }}
                    >
                      {/* 上部フェード効果とスクロールヒント（レスポンシブ） */}
                      {(() => {
                        const maxVisible = typeof window !== 'undefined' ? 
                          (window.innerWidth < 768 ? 3 : window.innerWidth < 1024 ? 4 : 5) : 5;
                        return registeredVegetables.length > maxVisible;
                      })() && (
                        <div className="sticky top-0 z-20 bg-gradient-to-b from-white via-green-50/80 to-transparent p-2 mx-1 rounded-lg">
                          <div className="text-center">
                            <p className="text-xs text-green-700 font-medium mb-1">↓ 他の野菜を確認（全{registeredVegetables.length}件）</p>
                            <div className="flex justify-center space-x-1">
                              <div className="w-1 h-1 bg-green-400 rounded-full animate-pulse"></div>
                              <div className="w-1 h-1 bg-green-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                              <div className="w-1 h-1 bg-green-400 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                            </div>
                          </div>
                        </div>
                      )}
                    {registeredVegetables.map((vegetable, index) => (
                      <div
                        key={vegetable.id || index}
                        onClick={() => !deleteMode && handleVegetableAreaClick(vegetable)}
                        className={`group relative bg-white/95 backdrop-blur-sm border border-gray-200/50 rounded-xl p-4 transition-all duration-200 overflow-hidden ${
                          deleteMode ? 'cursor-pointer hover:bg-blue-50/30' : 'cursor-pointer hover:shadow-lg hover:border-green-300/50 hover:-translate-y-0.5 hover:bg-white'
                        } ${selectedVegetableIds.has(vegetable.id) ? 'ring-2 ring-blue-500 bg-blue-50/50 shadow-md' : ''} flex-shrink-0`}
                        style={{ minHeight: '130px' }} // カード高さを統一
                      >
                        {/* 背景装飾 */}
                        <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-green-100/30 to-transparent rounded-full -translate-y-10 translate-x-10"></div>
                        
                        <div className="relative space-y-3">
                          {/* ヘッダー部分 */}
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              {deleteMode && (
                                <Checkbox
                                  checked={selectedVegetableIds.has(vegetable.id)}
                                  onCheckedChange={() => handleToggleVegetableSelection(vegetable.id)}
                                  className="mt-2"
                                />
                              )}
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm ${
                                vegetable.status === 'planning' ? 'bg-gradient-to-r from-blue-500 to-blue-600' :
                                vegetable.status === 'growing' ? 'bg-gradient-to-r from-green-500 to-green-600' :
                                vegetable.status === 'harvesting' ? 'bg-gradient-to-r from-orange-500 to-orange-600' :
                                'bg-gradient-to-r from-gray-500 to-gray-600'
                              }`}>
                                {vegetable.name?.charAt(0) || '?'}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-bold text-gray-800 text-sm leading-tight">
                                    {vegetable.name}
                                  </h4>
                                  {/* 🆕 表示状態インジケーター */}
                                  {visiblePolygons.has(vegetable.id) && vegetable.has_spatial_data && (
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" title="地図上に表示中" />
                                  )}
                                </div>
                                <p className="text-xs text-gray-600 mt-0.5">
                                  {vegetable.variety_name} • {vegetable.plot_name}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge 
                                variant="outline" 
                                className={`text-xs px-2 py-0.5 font-medium ${
                                  vegetable.status === 'planning' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                                  vegetable.status === 'growing' ? 'bg-green-50 border-green-200 text-green-700' :
                                  vegetable.status === 'harvesting' ? 'bg-orange-50 border-orange-200 text-orange-700' :
                                  'bg-gray-50 border-gray-200 text-gray-700'
                                }`}
                              >
                                {vegetable.status === 'planning' ? '計画中' : 
                                 vegetable.status === 'growing' ? '栽培中' : 
                                 vegetable.status === 'harvesting' ? '収穫中' : '完了'}
                              </Badge>
                              {vegetable.has_spatial_data ? (
                                <Badge variant="outline" className="text-xs bg-emerald-50 border-emerald-200 text-emerald-700 px-1.5 py-0">
                                  📍
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs bg-gray-50 border-gray-200 text-gray-500 px-1.5 py-0">
                                  📍
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* 詳細情報 */}
                          <div className="bg-gray-50/80 rounded-lg p-3">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-600 font-medium">栽培面積</span>
                              <span className="font-bold text-gray-800">
                                {vegetable.area_size?.toFixed(1) || '0'} ㎡
                              </span>
                            </div>
                            {vegetable.area_size && (
                              <div className="flex items-center justify-between text-xs mt-1">
                                <span className="text-gray-500">ヘクタール</span>
                                <span className="text-gray-600">
                                  {(vegetable.area_size / 10000).toFixed(3)} ha
                                </span>
                              </div>
                            )}
                          </div>

                          {/* アクションボタン */}
                          {!deleteMode && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className={`flex-1 text-xs h-8 font-medium transition-all duration-200 ${
                                  visiblePolygons.has(vegetable.id)
                                    ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
                                    : 'hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700'
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleVegetableAreaClick(vegetable)
                                }}
                                disabled={!vegetable.has_spatial_data}
                              >
                                {visiblePolygons.has(vegetable.id) ? (
                                  <>
                                    <EyeOff className="w-3 h-3 mr-1.5" />
                                    非表示
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-3 h-3 mr-1.5" />
                                    表示
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline" 
                                className="flex-1 text-xs h-8 font-medium hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleVegetableDetailClick(vegetable)
                                }}
                              >
                                <Eye className="w-3 h-3 mr-1.5" />
                                詳細確認
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {/* スクロール終端インジケーター（レスポンシブ表示制限超過時のみ） */}
                    {(() => {
                      const maxVisible = typeof window !== 'undefined' ? 
                        (window.innerWidth < 768 ? 3 : window.innerWidth < 1024 ? 4 : 5) : 5;
                      return registeredVegetables.length > maxVisible;
                    })() && (
                      <div className="text-center py-3 mt-2">
                        <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-green-300 to-transparent rounded-full opacity-30 mb-2"></div>
                        <p className="text-xs text-green-600 opacity-60">全 {registeredVegetables.length} 件を表示中</p>
                      </div>
                    )}
                    </div>
                    
                    {/* セクション3: ステータスフッター（固定） */}
                    <div className="mt-3 pt-3 border-t border-gray-100 flex-shrink-0 bg-gradient-to-r from-gray-50/50 to-green-50/30 rounded-lg p-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            <span className="text-gray-600 font-medium">
                              {(() => {
                                const maxVisible = typeof window !== 'undefined' ? 
                                  (window.innerWidth < 768 ? 3 : window.innerWidth < 1024 ? 4 : 5) : 5;
                                return registeredVegetables.length <= maxVisible 
                                  ? `全 ${registeredVegetables.length} 件表示` 
                                  : `${maxVisible}件表示中 / 全 ${registeredVegetables.length} 件`;
                              })()}
                            </span>
                          </div>
                          {(() => {
                            const maxVisible = typeof window !== 'undefined' ? 
                              (window.innerWidth < 768 ? 3 : window.innerWidth < 1024 ? 4 : 5) : 5;
                            return registeredVegetables.length > maxVisible;
                          })() && (
                            <div className="flex items-center gap-1 ml-2">
                              <div className="w-12 h-1 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-300"
                                  style={{ 
                                    width: `${Math.min(100, ((typeof window !== 'undefined' ? 
                                      (window.innerWidth < 768 ? 3 : window.innerWidth < 1024 ? 4 : 5) : 5) / registeredVegetables.length) * 100)}%` 
                                  }}
                                ></div>
                              </div>
                            </div>
                          )}
                        </div>
                        {(() => {
                          const maxVisible = typeof window !== 'undefined' ? 
                            (window.innerWidth < 768 ? 3 : window.innerWidth < 1024 ? 4 : 5) : 5;
                          return registeredVegetables.length > maxVisible;
                        })() && (
                          <div className="flex items-center gap-1 text-green-600">
                            <span className="font-medium text-xs">スクロール可能</span>
                            <div className="flex flex-col gap-0.5">
                              <div className="w-1 h-1 bg-green-500 rounded-full"></div>
                              <div className="w-1 h-1 bg-green-400 rounded-full"></div>
                              <div className="w-1 h-1 bg-green-300 rounded-full"></div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
                
                <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center">
                      <Info className="w-3 h-3 text-blue-600" />
                    </div>
                    <p className="text-xs text-blue-700 font-medium">
                      操作ヒント
                    </p>
                  </div>
                  <p className="text-xs text-blue-600 mt-1 leading-relaxed">
                    {isTouchDevice ? (
                      '🆕 複数表示対応：表示ボタンで重複表示 • 全削除ボタンでリセット • 長押しで個別削除'
                    ) : (
                      '🆕 複数表示対応：表示ボタンで重複表示 • 右クリックで全削除 • 全表示ボタンで一括管理'
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
            
            {/* サイドバー終端インジケーター */}
            <div className="text-center py-2 mt-2">
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-gray-300 to-transparent rounded-full opacity-20"></div>
            </div>
          </div>
        </div>

        {/* メイン地図エリア */}
        <div className={`${showSidebar ? 'flex-1' : 'w-full'} relative transition-all duration-300 ease-in-out`}>
          
          <ProfessionalFarmEditor
            ref={mapEditorRef}
            onCellsSelected={handleCellsSelected}
            onAreaSaved={handleAreaSaved}
            onMapRightClick={handleMapRightClick}
            onPolygonDoubleClick={handlePolygonDoubleClick}
            visiblePolygons={visiblePolygons}
            polygonColors={polygonColors}
            isTouchDevice={isTouchDevice}
            initialCenter={[139.6917, 35.6895]}
            initialZoom={16}
            height="100%"
          />

          {/* 🆕 モバイル専用：ポリゴンクリアボタン */}
          {isTouchDevice && visiblePolygons.size > 0 && (
            <div className="absolute top-4 right-4 z-50">
              <Button
                onClick={handleMapRightClick}
                size="sm"
                className="bg-red-500 hover:bg-red-600 text-white shadow-lg"
              >
                <X className="w-4 h-4 mr-1" />
                全削除
              </Button>
            </div>
          )}

          {/* ポリゴン編集モード制御パネル */}
          {isPolygonEditMode && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-white/95 backdrop-blur-md shadow-2xl border border-gray-200 rounded-xl p-4 min-w-[400px]">
              <div className="text-center">
                <div className="flex items-center justify-center mb-3">
                  <Edit3 className="w-6 h-6 text-blue-600 mr-2" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    「{selectedVegetable?.name}」のエリア編集中
                  </h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  地図上のエリア頂点をドラッグして形状を調整してください
                </p>
                <div className="flex justify-center space-x-3">
                  <Button
                    onClick={handleSavePolygonEdit}
                    disabled={isSaving}
                    className="bg-green-600 text-white hover:bg-green-700"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        変更を保存
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancelPolygonEdit}
                    disabled={isSaving}
                    className="border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    <X className="w-4 h-4 mr-2" />
                    キャンセル
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* フローティングアクション */}
          <div className="absolute bottom-6 right-6 z-10 space-y-2">
            <Button
              size="sm"
              className="shadow-lg"
              onClick={() => {/* エクスポート処理 */}}
            >
              <Download className="w-4 h-4 mr-2" />
              データ出力
            </Button>
          </div>
        </div>
      </div>

      {/* フッター（出典表示など） */}
      <div className="bg-white border-t border-gray-200 px-6 py-2">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div>
            地図データ: © <a href="https://www.gsi.go.jp/" target="_blank" rel="noopener noreferrer" className="underline">国土地理院</a>
          </div>
          <div className="flex items-center space-x-4">
            {currentPlot && (
              <span>農地面積: {(currentPlot.area / 10000).toFixed(2)} ha</span>
            )}
            {selectedCells.length > 0 && (
              <span>選択: {selectedCells.length} セル</span>
            )}
          </div>
        </div>
      </div>

      {/* 野菜詳細確認モーダル（シンプル版） */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal} modal={true}>
        <DialogContent className="w-full max-h-[90vh] overflow-y-auto bg-white mx-4 sm:max-w-[900px] sm:mx-auto md:max-w-[950px]"
          style={{ zIndex: 9999 }}
        >
          <DialogHeader className="border-b border-gray-200 pb-4 mb-6">
            <DialogTitle className="text-2xl font-bold flex items-center text-gray-900">
              🌱 {selectedVegetable?.name || '野菜詳細'}
              <Badge className="ml-4 text-sm px-3 py-1">
                {selectedVegetable?.status === 'planning' ? '計画中' : 
                 selectedVegetable?.status === 'growing' ? '栽培中' : 
                 selectedVegetable?.status === 'harvesting' ? '収穫中' : '完了'}
              </Badge>
            </DialogTitle>
            <p className="text-gray-600 mt-2">
              品種: {selectedVegetable?.variety_name} | 区画: {selectedVegetable?.plot_name}
            </p>
          </DialogHeader>

          {selectedVegetable && (
            <div className="space-y-6">
              {/* 基本情報 - 編集/表示切り替え */}
              {!isEditMode ? (
                // 表示モード
                <div className="grid md:grid-cols-3 gap-6">
                  <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-medium text-gray-700 flex items-center">
                        <MapPin className="w-5 h-5 mr-2 text-green-500" />
                        圃場・面積
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-semibold text-lg text-gray-900">{selectedVegetable.plot_name}</p>
                      <p className="text-3xl font-bold mt-2 text-green-600">
                        {selectedVegetable.area_size?.toFixed(1) || '0'} ㎡
                      </p>
                      <p className="text-sm text-gray-500 mt-2">
                        ({(selectedVegetable.area_size / 10000)?.toFixed(3) || '0'} ha)
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-medium text-gray-700 flex items-center">
                        <Sprout className="w-5 h-5 mr-2 text-blue-500" />
                        品種情報
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-semibold text-lg text-gray-900">{selectedVegetable.variety_name}</p>
                      <p className="text-sm text-gray-600 mt-2">野菜: {selectedVegetable.name}</p>
                      <div className="mt-3">
                        {selectedVegetable.has_spatial_data ? (
                          <Badge variant="outline" className="text-sm bg-blue-50 border-blue-300 text-blue-700 px-3 py-1">
                            📍 位置情報あり
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-sm bg-gray-50 border-gray-300 text-gray-500 px-3 py-1">
                            📍 位置情報なし
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-medium text-gray-700 flex items-center">
                        <Calendar className="w-5 h-5 mr-2 text-purple-500" />
                        栽培日程
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-600 font-medium">植付日</p>
                          <p className="font-semibold text-gray-900">{formatDate(selectedVegetable.planting_date)}</p>
                        </div>
                        {selectedVegetable.expected_harvest_start && (
                          <div>
                            <p className="text-sm text-gray-600 font-medium">収穫予定</p>
                            <p className="text-sm text-gray-900">{formatDate(selectedVegetable.expected_harvest_start)}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                // 編集モード
                <Card className="border-l-4 border-l-orange-500 shadow-lg">
                  <CardHeader className="border-b border-gray-200">
                    <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
                      <Edit className="w-5 h-5 mr-2 text-orange-500" />
                      基本データ編集
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* 基本情報 */}
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="name" className="text-sm font-medium text-gray-700">野菜名</Label>
                          <Input
                            id="name"
                            value={editFormData?.name || ''}
                            onChange={(e) => handleEditFormChange('name', e.target.value)}
                            className="mt-1"
                            placeholder="野菜名を入力"
                          />
                        </div>
                        <div>
                          <Label htmlFor="variety_name" className="text-sm font-medium text-gray-700">品種名</Label>
                          <Input
                            id="variety_name"
                            value={editFormData?.variety_name || ''}
                            onChange={(e) => handleEditFormChange('variety_name', e.target.value)}
                            className="mt-1"
                            placeholder="品種名を入力"
                          />
                        </div>
                        <div>
                          <Label htmlFor="plot_name" className="text-sm font-medium text-gray-700">区画名</Label>
                          <Input
                            id="plot_name"
                            value={editFormData?.plot_name || ''}
                            onChange={(e) => handleEditFormChange('plot_name', e.target.value)}
                            className="mt-1"
                            placeholder="区画名を入力"
                          />
                        </div>
                        <div>
                          <Label htmlFor="area_size" className="text-sm font-medium text-gray-700">面積 (㎡)</Label>
                          <Input
                            id="area_size"
                            type="number"
                            value={editFormData?.area_size || 0}
                            onChange={(e) => handleEditFormChange('area_size', parseFloat(e.target.value) || 0)}
                            className="mt-1"
                            placeholder="面積を入力"
                          />
                        </div>
                      </div>

                      {/* 栽培日程と設定 */}
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="planting_date" className="text-sm font-medium text-gray-700">植付日</Label>
                          <Input
                            id="planting_date"
                            type="date"
                            value={editFormData?.planting_date?.split('T')[0] || ''}
                            onChange={(e) => handleEditFormChange('planting_date', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="expected_harvest_start" className="text-sm font-medium text-gray-700">収穫予定開始日</Label>
                          <Input
                            id="expected_harvest_start"
                            type="date"
                            value={editFormData?.expected_harvest_start?.split('T')[0] || ''}
                            onChange={(e) => handleEditFormChange('expected_harvest_start', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="expected_harvest_end" className="text-sm font-medium text-gray-700">収穫予定終了日</Label>
                          <Input
                            id="expected_harvest_end"
                            type="date"
                            value={editFormData?.expected_harvest_end?.split('T')[0] || ''}
                            onChange={(e) => handleEditFormChange('expected_harvest_end', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="status" className="text-sm font-medium text-gray-700">ステータス</Label>
                          <select
                            id="status"
                            value={editFormData?.status || 'planning'}
                            onChange={(e) => {
                              console.log('📝 ステータス変更:', e.target.value)
                              handleEditFormChange('status', e.target.value)
                            }}
                            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          >
                            <option value="planning">計画中</option>
                            <option value="growing">栽培中</option>
                            <option value="harvesting">収穫中</option>
                            <option value="completed">完了</option>
                          </select>
                          <p className="text-xs text-gray-500 mt-1">現在の値: {editFormData?.status}</p>
                        </div>
                        <div>
                          <Label htmlFor="polygon_color" className="text-sm font-medium text-gray-700 flex items-center">
                            <Palette className="w-4 h-4 mr-1" />
                            地図表示色
                          </Label>
                          <div className="flex items-center space-x-2 mt-1">
                            <Input
                              id="polygon_color"
                              type="color"
                              value={editFormData?.polygon_color || '#22c55e'}
                              onChange={(e) => handleEditFormChange('polygon_color', e.target.value)}
                              className="w-16 h-10 p-1 border border-gray-300 rounded cursor-pointer"
                            />
                            <Input
                              value={editFormData?.polygon_color || '#22c55e'}
                              onChange={(e) => handleEditFormChange('polygon_color', e.target.value)}
                              className="flex-1"
                              placeholder="#22c55e"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ポリゴン編集ボタン */}
                    {selectedVegetable.has_spatial_data && (
                      <div className="border-t border-gray-200 pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 flex items-center">
                              <MapPin className="w-4 h-4 mr-1" />
                              地図上の描画エリア
                            </h4>
                            <p className="text-sm text-gray-500 mt-1">
                              地図上で描画されたエリアの形状を編集できます
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            onClick={handleStartPolygonEdit}
                            className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                          >
                            <Edit3 className="w-4 h-4 mr-2" />
                            エリア編集
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* タブコンテンツ */}
              <Tabs defaultValue="overview" className="space-y-6">
                <TabsList className="grid w-full grid-cols-3 h-12 p-1 bg-gray-100 rounded-lg">
                  <TabsTrigger value="overview" className="text-sm font-medium">概要</TabsTrigger>
                  <TabsTrigger value="progress-records" className="text-sm font-medium">進捗/記録</TabsTrigger>
                  <TabsTrigger value="analysis" className="text-sm font-medium">分析</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                  <Card className="shadow-sm">
                    <CardHeader className="bg-gradient-to-r from-green-50 to-blue-50 rounded-t-lg">
                      <CardTitle className="text-lg">栽培概要</CardTitle>
                      <CardDescription className="text-base">基本的な栽培情報と現在の状況</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 p-6">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <h4 className="font-semibold text-sm">基本データ</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">野菜名:</span>
                              <span className="font-medium">{selectedVegetable.name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">品種:</span>
                              <span className="font-medium">{selectedVegetable.variety_name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">区画:</span>
                              <span className="font-medium">{selectedVegetable.plot_name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">面積:</span>
                              <span className="font-medium">{selectedVegetable.area_size?.toFixed(1)} ㎡</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <h4 className="font-semibold text-sm">栽培日程</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">植付日:</span>
                              <span className="font-medium">{formatDate(selectedVegetable.planting_date)}</span>
                            </div>
                            {selectedVegetable.expected_harvest_start && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">収穫開始予定:</span>
                                <span className="font-medium">{formatDate(selectedVegetable.expected_harvest_start)}</span>
                              </div>
                            )}
                            {selectedVegetable.expected_harvest_end && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">収穫終了予定:</span>
                                <span className="font-medium">{formatDate(selectedVegetable.expected_harvest_end)}</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-gray-600">状態:</span>
                              <Badge variant="outline">
                                {selectedVegetable.status === 'planning' ? '計画中' : 
                                 selectedVegetable.status === 'growing' ? '栽培中' : 
                                 selectedVegetable.status === 'harvesting' ? '収穫中' : '完了'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 備考セクション */}
                      <div className="mt-6">
                        <h4 className="font-semibold text-sm mb-3">備考</h4>
                        {selectedVegetable.notes ? (
                          <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded border">
                            {selectedVegetable.notes}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400 italic">備考がありません</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="progress-records" className="space-y-4 mt-4">
                  <div className="text-center py-12 bg-gradient-to-br from-blue-50 to-green-50 rounded-lg border border-blue-100">
                    <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                      <Activity className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">作業記録・タスク管理</h3>
                    <p className="text-gray-600 mb-6 max-w-md mx-auto">
                      {selectedVegetable?.name}の詳細な作業履歴、スケジュール管理、進捗確認はガンチャートページで行えます。
                    </p>
                    <Button 
                      onClick={() => {
                        setShowDetailModal(false)
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

                <TabsContent value="analysis" className="space-y-4 mt-4">
                  <div className="text-center py-12 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-100">
                    <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                      <BarChart3 className="w-8 h-8 text-purple-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">データ分析・パフォーマンス</h3>
                    <p className="text-gray-600 mb-6 max-w-md mx-auto">
                      {selectedVegetable?.name}の収穫量、コスト分析、ROI、季節別パフォーマンスなどの詳細分析データをご覧いただけます。
                    </p>
                    <Button 
                      onClick={() => {
                        setShowDetailModal(false)
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

              {/* アクションボタン */}
              <div className="flex justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (selectedVegetable.has_spatial_data) {
                      handleVegetableAreaClick(selectedVegetable)
                    }
                  }}
                  disabled={!selectedVegetable.has_spatial_data}
                  className="flex items-center"
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  地図で位置確認
                </Button>
                
                <div className="flex space-x-2">
                  {!isEditMode ? (
                    <Button 
                      variant="outline"
                      onClick={handleStartEdit}
                      className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                    >
                      編集
                    </Button>
                  ) : (
                    <div className="flex space-x-2">
                      <Button 
                        onClick={handleSaveEdit}
                        disabled={isSaving}
                        className="bg-green-600 text-white hover:bg-green-700"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            保存中...
                          </>
                        ) : (
                          '保存'
                        )}
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                      >
                        キャンセル
                      </Button>
                    </div>
                  )}
                  <Button onClick={handleCloseDetailModal} variant="outline">
                    閉じる
                  </Button>
                </div>
              </div>
            </div>
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

      {/* 新規栽培情報入力モーダル */}
      <Dialog open={showNewVegetableModal} onOpenChange={setShowNewVegetableModal} modal={true}>
        <DialogContent className="w-full max-h-[90vh] overflow-y-auto bg-white mx-4 sm:max-w-[600px] sm:mx-auto"
          style={{ zIndex: 10000 }}
        >
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900 flex items-center">
              🌱 栽培情報を入力してください
            </DialogTitle>
          </DialogHeader>
          
          <NewVegetableForm 
            areaData={newAreaData}
            onSave={handleNewVegetableSave}
            onCancel={handleCloseNewVegetableModal}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

// 新規栽培情報入力フォームコンポーネント
interface NewVegetableFormProps {
  areaData: any
  onSave: (data: any) => void
  onCancel: () => void
}

function NewVegetableForm({ areaData, onSave, onCancel }: NewVegetableFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    variety_name: '',
    scientific_name: '',
    plot_name: areaData?.name || '',
    plot_size: areaData?.area_square_meters || 0,
    planting_date: new Date().toISOString().split('T')[0],
    expected_harvest_date: '',
    status: 'planning',
    growth_stage: 'seedling',
    notes: ''
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.name.trim()) newErrors.name = '野菜名を入力してください'
    if (!formData.variety_name.trim()) newErrors.variety_name = '品種名を入力してください'
    if (!formData.plot_name.trim()) newErrors.plot_name = '区画名を入力してください'
    if (!formData.planting_date) newErrors.planting_date = '植付日を選択してください'
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return
    
    setIsSaving(true)
    try {
      // 空の日付フィールドを除外してデータを準備
      const submitData = {
        ...formData,
        // 空文字列の日付フィールドをnullまたは除外
        expected_harvest_date: formData.expected_harvest_date.trim() || null,
        // plot_sizeを確実に数値に変換
        plot_size: parseFloat(formData.plot_size.toString()) || 0
      }
      
      console.log('📤 送信するデータ:', submitData)
      await onSave(submitData)
    } finally {
      setIsSaving(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-6">
      {/* 農地情報表示 */}
      {areaData && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-green-800 mb-2">📍 農地情報</h3>
          <div className="grid grid-cols-2 gap-4 text-sm text-green-700">
            <div>
              <span className="font-medium">農地名:</span> {areaData.name}
            </div>
            <div>
              <span className="font-medium">面積:</span> {(areaData.area_square_meters || 0).toFixed(0)}㎡
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 左列 */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              野菜名 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="例: トマト"
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="variety_name" className="text-sm font-medium">
              品種名 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="variety_name"
              value={formData.variety_name}
              onChange={(e) => handleInputChange('variety_name', e.target.value)}
              placeholder="例: 桃太郎"
              className={errors.variety_name ? 'border-red-500' : ''}
            />
            {errors.variety_name && <p className="text-xs text-red-500">{errors.variety_name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="scientific_name" className="text-sm font-medium">
              学名
            </Label>
            <Input
              id="scientific_name"
              value={formData.scientific_name}
              onChange={(e) => handleInputChange('scientific_name', e.target.value)}
              placeholder="例: Solanum lycopersicum"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="plot_name" className="text-sm font-medium">
              区画名 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="plot_name"
              value={formData.plot_name}
              onChange={(e) => handleInputChange('plot_name', e.target.value)}
              placeholder="例: A棟温室"
              className={errors.plot_name ? 'border-red-500' : ''}
            />
            {errors.plot_name && <p className="text-xs text-red-500">{errors.plot_name}</p>}
          </div>
        </div>

        {/* 右列 */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="status" className="text-sm font-medium">
              栽培状況
            </Label>
            <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
              <SelectTrigger>
                <SelectValue placeholder="🌱 栽培状況を選択してください" />
              </SelectTrigger>
              <SelectContent className="z-[10001]">
                <SelectItem value="planning">🌱 計画中</SelectItem>
                <SelectItem value="growing">🌿 栽培中</SelectItem>
                <SelectItem value="harvesting">🥕 収穫中</SelectItem>
                <SelectItem value="completed">✅ 完了</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="planting_date" className="text-sm font-medium">
              植付日 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="planting_date"
              type="date"
              value={formData.planting_date}
              onChange={(e) => handleInputChange('planting_date', e.target.value)}
              className={errors.planting_date ? 'border-red-500' : ''}
            />
            {errors.planting_date && <p className="text-xs text-red-500">{errors.planting_date}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="expected_harvest_date" className="text-sm font-medium">
              収穫予定日
            </Label>
            <Input
              id="expected_harvest_date"
              type="date"
              value={formData.expected_harvest_date}
              onChange={(e) => handleInputChange('expected_harvest_date', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="growth_stage" className="text-sm font-medium">
              生育段階
            </Label>
            <Select value={formData.growth_stage} onValueChange={(value) => handleInputChange('growth_stage', value)}>
              <SelectTrigger>
                <SelectValue placeholder="🌱 生育段階を選択してください" />
              </SelectTrigger>
              <SelectContent className="z-[10001]">
                <SelectItem value="seedling">🌱 苗期</SelectItem>
                <SelectItem value="vegetative">🌿 栄養生長期</SelectItem>
                <SelectItem value="flowering">🌸 開花期</SelectItem>
                <SelectItem value="fruiting">🍅 結実期</SelectItem>
                <SelectItem value="harvest">🥕 収穫期</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes" className="text-sm font-medium">
          備考
        </Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => handleInputChange('notes', e.target.value)}
          placeholder="特記事項があれば記入してください"
          rows={3}
        />
      </div>

      <DialogFooter className="gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          キャンセル
        </Button>
        <Button type="submit" disabled={isSaving} className="bg-green-600 hover:bg-green-700">
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              栽培情報を保存
            </>
          )}
        </Button>
      </DialogFooter>
    </form>
  )
}