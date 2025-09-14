# 収支構造分析グラフ Y軸動的スケール制御アーキテクチャ

## 📍 ファイル位置
`C:\work\my-app\src\components\charts\financial-performance-chart.tsx`

## 🏗️ システムアーキテクチャ

### 1. ステート管理構造

```typescript
// 累積損益線の制御状態（line 201-202）
const [showCumulativeLine, setShowCumulativeLine] = useState(true)
const [cumulativeType, setCumulativeType] = useState<'profit' | 'income' | 'expense'>('profit')
```

**状態の役割：**
- `showCumulativeLine`: 累積線グラフの表示/非表示を制御
- `cumulativeType`: 表示する累積データの種類（損益/収入/支出）を管理

### 2. Y軸スケール計算フロー

#### 2.1 左側Y軸（月次データ用）
```typescript
// line 1046-1047
const yAxisRange = useMemo(() => calculateYAxisRange(categoryData), [categoryData, calculateYAxisRange])
```

**処理フロー：**
1. `categoryData`から最大値・最小値を抽出
2. 上下対称の範囲を計算（ゼロを中心に）
3. 11個の目盛りに合わせてstepSizeを決定
4. キリの良い値に丸める

#### 2.2 右側Y軸（累積データ用）
```typescript
// line 1050-1222
const cumulativeRange = useMemo(() => {
  // cumulativeTypeに応じて動的に範囲を計算
}, [showCumulativeLine, categoryData, cumulativeType, calculateCumulativeData, yAxisRange])
```

**処理フロー：**

1. **データタイプ判定** (line 1059-1063)
   - `profit`: 累積損益データを使用
   - `income`: 累積収入データを使用
   - `expense`: 累積支出データを使用（マイナス値として扱う）

2. **プリセット設定の適用** (line 1069-1091)
   ```typescript
   const presets = {
     profit: {
       minMargin: 0.15,   // 下部15%マージン
       maxMargin: 0.15,   // 上部15%マージン
       zeroPosition: 0.5, // ゼロを中央に
       forceZero: true
     },
     income: {
       minMargin: 0,      // 下部マージンなし
       maxMargin: 0.2,    // 上部20%マージン
       forceZero: true,
       zeroPosition: 0    // ゼロを下端に
     },
     expense: {
       minMargin: 0.2,    // 下部20%マージン
       maxMargin: 0,      // 上部マージンなし
       forceZero: true,
       zeroPosition: 1    // ゼロを上端に
     }
   }
   ```

3. **範囲の最適化** (line 1093-1120)
   - プリセットマージンの適用
   - ゼロ位置の調整
   - 最小範囲の保証（データが小さい場合）

4. **キリの良い値への丸め** (line 1131-1171)
   - 値の大きさに応じた単位選択
   - 500円〜1000万円単位での丸め処理

5. **11目盛り固定の対称範囲設定** (line 1177-1221)
   - ゼロを中心に上下5目盛りずつ
   - stepSizeの自動調整

### 3. Chart.js設定への反映

#### 3.1 左側Y軸設定 (line 1289-1342)
```typescript
y: {
  min: yAxisRange.min,
  max: yAxisRange.max,
  ticks: {
    stepSize: yAxisRange.stepSize,
    callback: function(value) {
      // 日本円表記への変換
    }
  }
}
```

#### 3.2 右側Y軸設定 (line 1344-1404)
```typescript
y1: {
  display: showCumulativeLine,
  min: cumulativeRange.min,
  max: cumulativeRange.max,
  ticks: {
    stepSize: cumulativeRange.stepSize,
    callback: function(value) {
      // 短縮形表記への変換
    }
  }
}
```

## 🔄 データ切り替え時の処理フロー

### ユーザー操作から表示更新までのフロー

1. **ユーザー操作**
   - 累積タイプ切り替えボタンをクリック
   - `setCumulativeType('profit' | 'income' | 'expense')`が呼ばれる

2. **状態更新**
   - ReactのuseStateが新しい値を設定
   - コンポーネントの再レンダリングがトリガー

3. **メモ化された計算の実行**
   - `cumulativeRange`のuseMemoが依存配列を検知
   - 新しいcumulativeTypeに基づいて範囲を再計算

4. **Chart.js設定の更新**
   - `chartOptions`のuseMemoが更新
   - 新しいcumulativeRangeを使用してy1軸設定を更新

5. **グラフの再描画**
   - react-chartjs-2がoptions変更を検知
   - Chart.jsが新しい軸範囲でグラフを再描画

## 🎯 重要な設計ポイント

### 1. 動的スケール調整の利点
- データの種類に応じた最適な表示範囲
- 視認性の向上（データが小さすぎず大きすぎない）
- プロフェッショナルな見た目（キリの良い目盛り）

### 2. プリセット方式の採用理由
- 金融業界標準の表示方法に準拠
- データタイプごとの特性を考慮
- ユーザーの期待に沿った表示

### 3. 11目盛り固定の理由
- 一貫性のある表示
- 読みやすい目盛り間隔
- ゼロラインを中心とした対称性

## 📊 表示例

### 損益モード（profit）
- ゼロを中央に配置
- プラスマイナス均等な範囲
- 緑色の軸とライン

### 収入モード（income）
- ゼロを下端に配置
- プラス方向のみ強調
- 青色の軸とライン

### 支出モード（expense）
- ゼロを上端に配置
- マイナス方向のみ強調
- 赤色の軸とライン