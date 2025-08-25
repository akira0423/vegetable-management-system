import DataMigrationPanel from '@/components/data-migration-panel'

export default function MigrationAdminPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">システム管理: データマイグレーション</h1>
        <p className="text-gray-600">
          コスト情報システムから新しい会計システムへのデータ移行を実行します。
        </p>
      </div>
      
      <DataMigrationPanel />
      
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-3 text-blue-800">移行について</h2>
        <div className="space-y-2 text-sm text-blue-700">
          <p>• 既存の「コスト情報」(work_reports.notes内のJSON)を新しい「会計・コスト記録」テーブルに移行します</p>
          <p>• 移行されたデータは支出項目として「その他費用」カテゴリに分類されます</p>
          <p>• 既存データは保持され、新しいシステムのデータとして追加されます</p>
          <p>• 移行後は分析ページで新しい会計データが使用されます</p>
        </div>
      </div>
    </div>
  )
}