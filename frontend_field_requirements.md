# フロントエンド入力フィールドの要件定義

## 📊 各フィールドの実用的な値の範囲

### 1. 作業時間・人数
| フィールド | 実用範囲 | 推奨DB型 | 説明 |
|---------|---------|----------|------|
| work_duration | 1〜10,000分 | INTEGER | 1日最大16時間×30日=28,800分まで対応 |
| worker_count | 1〜1,000人 | INTEGER | 大規模農場の収穫時期も考慮 |
| duration_hours | 0.01〜10,000時間 | NUMERIC(8,2) | 年間総作業時間も記録可能 |

### 2. 気象データ
| フィールド | 実用範囲 | 推奨DB型 | 説明 |
|---------|---------|----------|------|
| temperature | -50.0〜50.0℃ | NUMERIC(5,1) | 極端な気候も記録可能 |
| humidity | 0〜100% | INTEGER | パーセント値 |

### 3. 土壌基本データ
| フィールド | 実用範囲 | 推奨DB型 | 説明 |
|---------|---------|----------|------|
| soil_ph | 3.0〜10.0 | NUMERIC(3,1) | 一般的な土壌pH範囲 |
| soil_ec | 0.01〜10.00 dS/m | NUMERIC(6,2) | 電気伝導度 |
| phosphorus_absorption | 100〜3,000 | INTEGER | リン酸吸収係数 |
| cec | 1.0〜50.0 me/100g | NUMERIC(6,2) | 陽イオン交換容量 |

### 4. 交換性塩基類
| フィールド | 実用範囲 | 推奨DB型 | 説明 |
|---------|---------|----------|------|
| exchangeable_calcium | 0〜10,000 mg/100g | INTEGER | 交換性石灰 |
| exchangeable_magnesium | 0〜1,000 mg/100g | INTEGER | 交換性苦土 |
| exchangeable_potassium | 0〜1,000 mg/100g | INTEGER | 交換性加里 |
| base_saturation | 0.00〜100.00% | NUMERIC(5,2) | 塩基飽和度 |

### 5. 塩基バランス
| フィールド | 実用範囲 | 推奨DB型 | 説明 |
|---------|---------|----------|------|
| calcium_magnesium_ratio | 0.1〜20.0 | NUMERIC(6,2) | 石灰苦土比 |
| magnesium_potassium_ratio | 0.1〜20.0 | NUMERIC(6,2) | 苦土加里比 |

### 6. 養分・有機物
| フィールド | 実用範囲 | 推奨DB型 | 説明 |
|---------|---------|----------|------|
| available_phosphorus | 0.1〜1,000.0 mg/100g | NUMERIC(8,2) | 有効態りん酸 |
| available_silica | 0.1〜1,000.0 mg/100g | NUMERIC(8,2) | 有効態けい酸 |
| humus_content | 0.0〜20.0% | NUMERIC(5,2) | 腐植含量 |

### 7. 窒素形態
| フィールド | 実用範囲 | 推奨DB型 | 説明 |
|---------|---------|----------|------|
| ammonium_nitrogen | 0.0〜100.0 mg/100g | NUMERIC(8,2) | アンモニア態窒素 |
| nitrate_nitrogen | 0.0〜100.0 mg/100g | NUMERIC(8,2) | 硝酸態窒素 |

### 8. 微量要素
| フィールド | 実用範囲 | 推奨DB型 | 説明 |
|---------|---------|----------|------|
| manganese | 0.0〜100.0 mg/100g | NUMERIC(8,2) | マンガン |
| boron | 0.0〜10.0 mg/100g | NUMERIC(8,2) | ホウ素 |
| free_iron_oxide | 0.0〜1,000.0 mg/100g | NUMERIC(8,2) | 遊離酸化鉄 |

### 9. 収穫・価格データ
| フィールド | 実用範囲 | 推奨DB型 | 説明 |
|---------|---------|----------|------|
| harvest_amount | 0.01〜10,000,000,000.99 | NUMERIC(13,2) | 収穫量（100億まで対応） |
| expected_price | 0.01〜1,000,000,000,000.99円 | NUMERIC(15,2) | 単価（1兆円まで対応） |
| expected_revenue | 0.01〜10,000,000,000,000.99円 | NUMERIC(16,2) | 売上予想（10兆円まで対応） |

### 10. 肥料データ
| フィールド | 実用範囲 | 推奨DB型 | 説明 |
|---------|---------|----------|------|
| fertilizer_amount | 0.01〜99,999,999.99 | NUMERIC(10,2) | 肥料量（kg、Lなど） |

### 11. 収支データ
| フィールド | 実用範囲 | 推奨DB型 | 説明 |
|---------|---------|----------|------|
| income_total | 0〜10,000,000,000,000.99円 | NUMERIC(16,2) | 総収入（10兆円まで対応） |
| expense_total | 0〜10,000,000,000,000.99円 | NUMERIC(16,2) | 総支出（10兆円まで対応） |
| net_income | ±10,000,000,000,000.99円 | NUMERIC(16,2) | 純利益（±10兆円まで対応） |

## 🔧 フロントエンド実装の推奨事項

### バリデーション実装例
```typescript
// 作業時間のバリデーション
const validateWorkDuration = (value: number): boolean => {
  return value >= 1 && value <= 10000;
}

// 土壌pHのバリデーション
const validateSoilPH = (value: number): boolean => {
  return value >= 3.0 && value <= 10.0;
}

// リン酸吸収係数のバリデーション
const validatePhosphorusAbsorption = (value: number): boolean => {
  return value >= 100 && value <= 3000;
}
```

### 入力フィールドの設定例
```tsx
<Input
  type="number"
  min="100"
  max="3000"
  step="1"
  placeholder="例: 1500"
  onChange={(e) => {
    const value = parseFloat(e.target.value);
    if (validatePhosphorusAbsorption(value)) {
      handleInputChange('phosphorus_absorption', value);
    }
  }}
/>
```