# 月次キャッシュフローと収支構造分析グラフの比較分析

## 📊 両グラフの根本的な違い

### 1. データ取得方法の違い

#### 収支構造分析グラフ（financial-performance-chart.tsx）
```typescript
// 直接Supabaseから work_report_accounting テーブルを取得
const { data: accountingData } = await supabase
  .from('work_report_accounting')
  .select(`
    amount,
    accounting_items!inner (
      cost_type
    )
  `)
```
- **直接データベースアクセス**
- **会計データに特化**
- **全ての会計項目を確実に取得**

#### 月次キャッシュフローグラフ（monthly-cashflow-chart.tsx）
```typescript
// APIエンドポイント経由でwork_reportsを取得
fetch('/api/reports?company_id=...')
// work_reportsに紐づくwork_report_accountingを取得
```
- **APIエンドポイント経由**
- **作業レポート中心のデータ取得**
- **作業種別（work_type）でグループ化**

### 2. データ表示方法の違い

#### 収支構造分析グラフ
```typescript
// 会計項目ごとに個別の棒グラフを生成
datasets.push({
  type: 'bar',
  label: `${itemInfo.category}: ${itemInfo.name}`,
  data: dataKeysByIndex.map(dataKey => {
    const value = item?.value || 0
    // 費用項目はマイナス表示
    return categoryKey === 'income' ? value : -value
  })
})
```
- **会計項目ごとに独立した棒グラフ**
- **収入はプラス、支出はマイナスで表示**
- **全ての項目を積み上げ表示**

#### 月次キャッシュフローグラフ
```typescript
// 作業種別ごとに純損益（収入-支出）を計算
const netData = cashflowData.map(d => {
  const income = d.work_types[workType]?.income || 0
  const expense = d.work_types[workType]?.expense || 0
  return income + expense // 差額のみを表示
})
```
- **作業種別ごとに収支の差額（ネット）を表示**
- **収入と支出を相殺した結果のみ**
- **各作業種別で1本の棒グラフ**

### 3. 問題の核心：作業種別との紐付け

#### なぜ1000億円が表示されないのか？

**月次キャッシュフローの問題点：**
```typescript
// 作業種別ごとにフィルタリング
Object.keys(WORK_TYPE_COLORS).forEach(workType => {
  const typeReports = monthReports.filter((r: any) =>
    r.work_type === workType  // ← 作業種別でフィルタ
  )
  // ...
})
```

**1000億円のコストが表示されない理由：**
1. **作業種別に紐付かないコスト**
   - 管理費、固定費などは特定の作業に紐付かない
   - work_typeがnullまたは未定義の場合、どの作業種別にも集計されない

2. **ネット表示による相殺**
   - 同じ作業種別に収入と支出がある場合、相殺される
   - 1000億円の支出があっても、同額の収入があれば表示は0

3. **作業レポートがない会計データ**
   - work_reportsテーブルにレコードがない
   - 直接work_report_accountingに登録されたデータ

### 4. データフローの違い

#### 収支構造分析（正しく表示される）
```
work_report_accounting
    ↓ 直接取得
accounting_items (cost_type判定)
    ↓
月別・項目別に集計
    ↓
個別の棒グラフとして表示
```

#### 月次キャッシュフロー（表示されない）
```
work_reports (APIで取得)
    ↓
work_typeでフィルタリング  ← ここで漏れる
    ↓
work_report_accounting
    ↓
作業種別ごとに収支を相殺  ← ここで消える
    ↓
ネット値のみ表示
```

## 🔧 改善案

### 1. 即時対応案
月次キャッシュフローに「その他」カテゴリを追加：
```typescript
// work_typeがない会計データ用のカテゴリ
const otherExpenses = monthReports.filter((r: any) =>
  !r.work_type || r.work_type === 'other'
)
```

### 2. 根本的改善案
収支構造分析と同じデータ取得方法を採用：
- work_report_accountingを直接取得
- 会計項目ベースで集計
- 作業種別は補助情報として使用

### 3. ハイブリッド表示案
- 作業種別の棒グラフ（現状）
- ＋ 作業に紐付かない固定費の棒グラフ
- ＋ 総計ライン

## 📌 結論

**収支構造分析グラフ**は会計データを直接取得・表示するため、全てのコストが確実に表示されます。

**月次キャッシュフローグラフ**は作業種別でグループ化し、収支を相殺表示するため、以下の場合にデータが表示されません：
1. 作業種別に紐付かないコスト
2. 収入と相殺されるコスト
3. work_reportsテーブルに存在しないコスト

これが12月の1000億円が月次キャッシュフローに表示されない理由です。