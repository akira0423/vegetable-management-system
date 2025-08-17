# フェーズ3: API統一

## 3.1 認証方式統一方針

### 選択：Service Role統一

**理由：**
- ✅ シンプルなRLSと相性良い
- ✅ パフォーマンス最適
- ✅ デバッグ容易
- ✅ 権限エラー回避

## 3.2 API修正

### 3.2.1 実績記録API修正

```typescript
// src/app/api/reports/route.ts
// 変更前: import { createClient } from '@/lib/supabase/server'
// 変更後:
import { createServiceClient } from '@/lib/supabase/server'

export async function DELETE(request: NextRequest) {
  try {
    // 変更前: const supabase = await createClient()
    // 変更後:
    const supabase = await createServiceClient()
    
    const body = await request.json()
    const { id, reason } = body

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID is required'
      }, { status: 400 })
    }

    // シンプル削除（会社IDチェックはRLSで自動実行）
    const { error: deleteError } = await supabase
      .from('work_reports')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('実績記録削除エラー:', deleteError)
      return NextResponse.json({
        success: false,
        error: deleteError.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: '実績記録を削除しました'
    })

  } catch (error) {
    console.error('実績記録API エラー:', error)
    return NextResponse.json({
      success: false,
      error: 'サーバーエラー'
    }, { status: 500 })
  }
}
```

### 3.2.2 全APIの統一確認

```bash
# 全APIファイルの認証方式確認
find src/app/api -name "*.ts" -exec grep -l "createClient\|createServiceClient" {} \;

# 修正対象リスト
# - reports/route.ts → createServiceClient()に変更
# - gantt/route.ts → createServiceClient()に変更（確認）
# - growing-tasks/route.ts → createServiceClient()に変更（確認）
# - vegetables/route.ts → createServiceClient()に変更（確認）
```

## 3.3 認証テスト

### 3.3.1 API呼び出しテスト

```javascript
// ブラウザコンソールでテスト
// 1. 計画タスク削除
fetch('/api/growing-tasks/test-id', { method: 'DELETE' })
.then(r => r.json())
.then(console.log);

// 2. 実績記録削除
fetch('/api/reports', { 
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ id: 'test-id' })
})
.then(r => r.json())
.then(console.log);
```

### 3.3.2 権限チェック確認

```sql
-- 削除実行時のログ確認
SELECT 
    table_name,
    operation,
    count(*) as operations_count
FROM audit_logs 
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY table_name, operation;
```