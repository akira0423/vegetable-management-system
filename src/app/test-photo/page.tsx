'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import PhotoUpload from '@/components/photo-upload'
import PhotoGallery from '@/components/photo-gallery'
import TaskManagement from '@/components/task-management'
import WorkLog from '@/components/work-log'

export default function TestPhotoPage() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedVegetable, setSelectedVegetable] = useState('d1111111-1111-1111-1111-111111111111')
  const [tasks, setTasks] = useState([])
  const [taskRefreshKey, setTaskRefreshKey] = useState(0)
  
  const vegetables = [
    { id: 'd1111111-1111-1111-1111-111111111111', name: 'A棟トマト（桃太郎）' },
    { id: 'd2222222-2222-2222-2222-222222222222', name: 'B棟キュウリ（四葉）' },
    { id: 'd3333333-3333-3333-3333-333333333333', name: '露地レタス（春作）' }
  ]

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>作業記録・タスク管理機能テストページ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 mb-6">
            <p className="text-gray-600">
              写真管理・タスク管理・作業記録機能をテストできます
            </p>
            <div className="flex items-center gap-4">
              <label className="font-medium">野菜選択:</label>
              <select 
                value={selectedVegetable}
                onChange={(e) => setSelectedVegetable(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1"
              >
                {vegetables.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          <Tabs defaultValue="photos" className="space-y-6">
            <TabsList>
              <TabsTrigger value="photos">写真</TabsTrigger>
              <TabsTrigger value="tasks">タスク管理</TabsTrigger>
              <TabsTrigger value="work">作業記録</TabsTrigger>
              <TabsTrigger value="info">情報</TabsTrigger>
            </TabsList>

            <TabsContent value="photos" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">写真</h3>
                <PhotoUpload 
                  vegetableId={selectedVegetable}
                  onUploadSuccess={() => {
                    setRefreshKey(prev => prev + 1)
                  }}
                />
              </div>
              
              <PhotoGallery 
                key={`${selectedVegetable}-${refreshKey}`}
                vegetableId={selectedVegetable}
                onPhotoDeleted={() => {
                  setRefreshKey(prev => prev + 1)
                }}
              />
            </TabsContent>

            <TabsContent value="tasks" className="space-y-4">
              <TaskManagement 
                key={`tasks-${selectedVegetable}-${taskRefreshKey}`}
                vegetableId={selectedVegetable}
                onTaskUpdated={() => {
                  setTaskRefreshKey(prev => prev + 1)
                }}
              />
            </TabsContent>

            <TabsContent value="work" className="space-y-4">
              <WorkLog 
                key={`work-${selectedVegetable}-${taskRefreshKey}`}
                vegetableId={selectedVegetable}
                tasks={tasks}
                onLogUpdated={() => {
                  setTaskRefreshKey(prev => prev + 1)
                }}
              />
            </TabsContent>

            <TabsContent value="info" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">選択中の野菜情報</h4>
                  <p className="text-sm text-gray-600">
                    野菜ID: {selectedVegetable}
                  </p>
                  <p className="text-sm text-gray-600">
                    野菜名: {vegetables.find(v => v.id === selectedVegetable)?.name}
                  </p>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">機能</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• 写真のドラッグ&ドロップアップロード</li>
                    <li>• 複数ファイル同時アップロード</li>
                    <li>• 写真の詳細表示・ダウンロード・削除</li>
                    <li>• 説明・タグ機能</li>
                    <li>• タスク管理（作成・編集・削除・進捗管理）</li>
                    <li>• 作業記録（日次作業ログ・時間管理・天候記録）</li>
                  </ul>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}