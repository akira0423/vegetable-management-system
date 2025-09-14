# ユーザーアクションとデータ保存フロー詳細

## 1. データベース構造の全体像

```
┌─────────────┐
│  companies  │ ← 企業マスタ（ルート）
└──────┬──────┘
       │
       ├────────────────────┬────────────────┬───────────────┐
       ↓                    ↓                ↓               ↓
┌─────────────┐      ┌──────────────┐ ┌──────────┐  ┌──────────────┐
│    users    │      │  vegetables  │ │companies │  │ accounting_  │
└──────┬──────┘      └──────┬───────┘ │ _settings│  │    items     │
       │                     │         └──────────┘  └──────┬───────┘
       │              ┌──────┴────────┬────────┐            │
       │              ↓               ↓        ↓            │
       │       ┌──────────────┐ ┌──────────┐ ┌────────┐    │
       │       │growing_tasks │ │  photos  │ │ work_  │    │
       │       └──────────────┘ └──────────┘ │reports │    │
       │                                      └────┬───┘    │
       │                                           │         │
       └───────────────────────────────────────────┼─────────┤
                                                   ↓         ↓
                                          ┌──────────────────┐
                                          │ work_report_     │
                                          │   accounting     │
                                          └──────────────────┘
```

## 2. 主要なユーザーアクションと保存フロー

### 2.1 新規ユーザー登録・ログイン

**画面**: `/login`, `/signup`

**アクション**: ユーザー登録・ログイン

**データフロー**:
```
1. Supabase Auth でユーザー作成
   └→ auth.users テーブルに保存

2. ユーザープロファイル作成
   └→ users テーブルに挿入
      - id (auth.users.id と同じ)
      - company_id (ドメインまたはデフォルト企業)
      - email
      - full_name
      - is_active: true
      - settings: {}
```

### 2.2 野菜（栽培）登録

**画面**: `/vegetables/new`, ダッシュボードの新規登録ボタン

**アクション**: 野菜の新規登録

**データフロー**:
```
1. フォーム入力
   - 基本情報（名前、品種、圃場名、面積）
   - 栽培期間（植付日、収穫予定日）
   - 空間データ（オプション）

2. バリデーション
   - 必須項目チェック
   - 圃場名重複チェック（同一企業内）
   - 日付の妥当性確認

3. vegetables テーブルへ保存
   INSERT INTO vegetables (
     id: UUID自動生成,
     company_id: ユーザーの所属企業,
     name: 入力値,
     variety_name: 入力値,
     plot_name: 入力値,
     area_size: 入力値,
     planting_date: 入力値,
     expected_harvest_start/end: 計算値,
     status: 'planning',
     created_by: ユーザーID,
     created_at: 現在時刻,
     spatial_data: 地図データ（オプション）,
     polygon_coordinates: 座標データ（オプション）
   )

4. 初期タスクの自動生成（オプション）
   └→ growing_tasks テーブルに標準タスクを挿入
```

### 2.3 作業記録の登録

**画面**: `/dashboard`, 作業記録フォーム

**アクション**: 日々の作業記録登録

**データフロー**:
```
1. フォーム入力（複数セクション）
   ├─ 基本情報セクション
   │  - 対象野菜選択
   │  - 作業日時
   │  - 作業種類
   │  - 作業人数
   │
   ├─ 環境データセクション
   │  - 天気、気温、湿度
   │
   ├─ 収穫データセクション（作業種類=収穫の場合）
   │  - 収穫量、単位、品質
   │  - 予想単価
   │
   ├─ 土壌データセクション（オプション）
   │  - pH、EC、各種成分
   │
   └─ 会計データセクション
      - 収入項目（売上等）
      - 支出項目（資材費、人件費等）

2. work_reports テーブルへ保存
   INSERT INTO work_reports (
     id: UUID自動生成,
     company_id: 企業ID,
     vegetable_id: 選択した野菜ID,
     work_type: 作業種類,
     work_date: 作業日,
     start_time/end_time: 作業時間,
     duration_hours: 計算値,
     worker_count: 作業人数,
     weather/temperature/humidity: 環境データ,
     harvest_amount/unit/quality: 収穫データ,
     soil_ph/soil_ec: 土壌基本データ,
     notes: メモ,
     created_by: ユーザーID,
     created_at: 現在時刻
   )

3. 会計データの保存（work_report_accounting テーブル）
   収入項目ごとに:
   INSERT INTO work_report_accounting (
     work_report_id: 上記で作成したID,
     accounting_item_id: 会計項目ID,
     amount: 金額,
     is_ai_recommended: false
   )

   支出項目ごとに:
   INSERT INTO work_report_accounting (
     work_report_id: 上記で作成したID,
     accounting_item_id: 会計項目ID,
     amount: 金額（負の値）,
     is_ai_recommended: false
   )

4. AI推奨の学習（非同期）
   └→ accounting_recommendations テーブル更新
      - work_type と accounting_item の関連性を学習
      - 使用頻度と信頼度スコアを更新
```

### 2.4 栽培タスクの管理

**画面**: `/dashboard/gantt`, タスク管理画面

**アクション**: タスクの作成・更新

**データフロー**:
```
1. 新規タスク作成
   INSERT INTO growing_tasks (
     id: UUID自動生成,
     company_id: vegetables経由で取得,
     vegetable_id: 対象野菜ID,
     name: タスク名,
     task_type: タスク種類,
     start_date/end_date: 期間,
     priority: 優先度,
     status: 'pending',
     progress: 0,
     created_by: ユーザーID
   )

2. タスク進捗更新
   UPDATE growing_tasks SET
     progress = 更新値,
     status = 新ステータス,
     actual_hours = 実績時間,
     updated_at = 現在時刻
   WHERE id = タスクID
```

### 2.5 写真のアップロード

**画面**: `/dashboard/photos`, 作業記録フォーム内

**アクション**: 写真のアップロード

**データフロー**:
```
1. ファイルアップロード
   └→ Supabase Storage へ保存
      パス: photos/{company_id}/{vegetable_id}/{filename}

2. メタデータ保存
   INSERT INTO photos (
     id: UUID自動生成,
     vegetable_id: 対象野菜ID,
     storage_path: Storageのパス,
     original_filename: 元ファイル名,
     file_size: ファイルサイズ,
     mime_type: ファイルタイプ,
     taken_at: 撮影日時,
     description: 説明,
     tags: タグ配列,
     is_primary: メイン写真フラグ,
     created_by: ユーザーID
   )

3. Storage URLの生成
   └→ 公開URLまたは署名付きURLを生成
```

### 2.6 データ分析・レポート参照

**画面**: `/dashboard/analytics`

**アクション**: 分析データの参照（読み取りのみ）

**データフロー**:
```
1. 集計クエリの実行（READ ONLY）
   ├─ 月次収支集計
   │  SELECT SUM(amount) FROM work_report_accounting
   │  GROUP BY DATE_TRUNC('month', work_date)
   │
   ├─ 作業時間集計
   │  SELECT SUM(duration_hours) FROM work_reports
   │  GROUP BY work_type, DATE_TRUNC('month', work_date)
   │
   ├─ 収穫量推移
   │  SELECT SUM(harvest_amount) FROM work_reports
   │  WHERE work_type = '収穫'
   │  GROUP BY vegetable_id, DATE_TRUNC('week', work_date)
   │
   └─ 土壌データ推移
      SELECT soil_ph, soil_ec FROM work_reports
      WHERE soil_ph IS NOT NULL
      ORDER BY work_date

2. データ変換・可視化
   └→ フロントエンドでグラフ描画（Chart.js）
```

## 3. データの削除フロー

### 3.1 ソフトデリート（論理削除）

**対象テーブル**: vegetables, work_reports, growing_tasks

**フロー**:
```
UPDATE テーブル名 SET
  deleted_at = 現在時刻
WHERE id = 対象ID

※ 物理削除は行わない
※ 全てのクエリで deleted_at IS NULL を条件に含める
```

### 3.2 削除の影響分析

**野菜削除時の影響**:
```
1. 削除影響の事前確認
   - 関連する growing_tasks の数
   - 関連する work_reports の数
   - 関連する photos の数
   - 会計データへの影響額

2. リスクレベルの判定
   - LOW: 関連データが少ない
   - MEDIUM: 関連データが中程度
   - HIGH: 重要な会計データが存在

3. 削除実行（確認後）
   - vegetables.deleted_at = 現在時刻
   - 関連データは保持（参照は可能）
```

## 4. データの整合性維持

### 4.1 外部キー制約

```sql
-- 主要な外部キー関係
vegetables.company_id → companies.id
vegetables.created_by → users.id
work_reports.vegetable_id → vegetables.id
work_reports.company_id → companies.id
growing_tasks.vegetable_id → vegetables.id
photos.vegetable_id → vegetables.id
work_report_accounting.work_report_id → work_reports.id
work_report_accounting.accounting_item_id → accounting_items.id
```

### 4.2 カスケード動作

- **CASCADE DELETE**: なし（ソフトデリートを使用）
- **CASCADE UPDATE**: 基本的になし
- **SET NULL**: created_by フィールド（ユーザー削除時）

### 4.3 トランザクション処理

**明示的トランザクション使用箇所**:
- 会計データの更新（DELETE + INSERT）
- 複数テーブルの同時更新が必要な場合

**暗黙的トランザクション**:
- 各INSERT/UPDATE/DELETE文は自動的にトランザクション内で実行

## 5. パフォーマンス最適化

### 5.1 インデックス

**現在のインデックス**:
- PRIMARY KEY による自動インデックス
- UNIQUE 制約による自動インデックス

**推奨追加インデックス**:
```sql
-- 頻繁な検索条件
CREATE INDEX idx_vegetables_company_status ON vegetables(company_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_work_reports_company_date ON work_reports(company_id, work_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_growing_tasks_vegetable ON growing_tasks(vegetable_id, status);
CREATE INDEX idx_photos_vegetable ON photos(vegetable_id);
```

### 5.2 クエリ最適化

**N+1問題の回避**:
- JOINを使用した一括取得
- selectで必要なカラムのみ指定

**ページネーション**:
- limit/offset による取得件数制限
- 無限スクロール対応

## まとめ

このシステムのデータフローは以下の特徴を持ちます：

1. **階層構造**: companies → vegetables → work_reports/tasks/photos
2. **ソフトデリート**: データの完全削除を避け、履歴を保持
3. **リレーション管理**: 外部キー制約による整合性維持
4. **会計連携**: 作業記録と会計データの紐付け
5. **AI学習**: 使用パターンから推奨を生成
6. **監査対応**: 全操作の追跡が可能（created_by, created_at）