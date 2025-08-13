# データベース本番環境設定

## 1. Supabase本番設定

### 1.1 本番データベース設定
```sql
-- 本番環境用PostgreSQL設定の最適化
-- postgresql.conf相当の設定

-- 接続設定
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '512MB';
ALTER SYSTEM SET effective_cache_size = '2GB';

-- WAL設定（バックアップ・レプリケーション用）
ALTER SYSTEM SET wal_level = 'replica';
ALTER SYSTEM SET max_wal_senders = 10;
ALTER SYSTEM SET max_replication_slots = 10;
ALTER SYSTEM SET wal_keep_segments = 100;

-- チェックポイント設定
ALTER SYSTEM SET checkpoint_segments = 32;
ALTER SYSTEM SET checkpoint_completion_target = 0.9;

-- ログ設定
ALTER SYSTEM SET log_statement = 'mod'; -- INSERT, UPDATE, DELETE, TRUNCATE
ALTER SYSTEM SET log_duration = on;
ALTER SYSTEM SET log_min_duration_statement = 1000; -- 1秒以上のクエリをログ

-- 統計情報収集
ALTER SYSTEM SET track_activities = on;
ALTER SYSTEM SET track_counts = on;
ALTER SYSTEM SET track_io_timing = on;
ALTER SYSTEM SET track_functions = 'all';

-- 設定反映
SELECT pg_reload_conf();
```

### 1.2 本番用テーブル設計
```sql
-- 1. パーティショニング（大容量データ対応）
-- 写真テーブルを月単位でパーティション分割
CREATE TABLE photos_partitioned (
    id UUID DEFAULT gen_random_uuid(),
    vegetable_id UUID NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(50) NOT NULL,
    taken_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    description TEXT,
    tags TEXT[],
    is_primary BOOLEAN DEFAULT FALSE,
    created_by UUID,
    company_id UUID NOT NULL
) PARTITION BY RANGE (created_at);

-- パーティション作成（自動化）
DO $$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
BEGIN
    start_date := DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month');
    
    FOR i IN 0..12 LOOP -- 1年分のパーティション作成
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'photos_y' || EXTRACT(YEAR FROM start_date) || 
                         'm' || LPAD(EXTRACT(MONTH FROM start_date)::TEXT, 2, '0');
        
        EXECUTE format('CREATE TABLE %I PARTITION OF photos_partitioned 
                       FOR VALUES FROM (%L) TO (%L)', 
                       partition_name, start_date, end_date);
        
        start_date := end_date;
    END LOOP;
END $$;

-- 2. 監査テーブル（データ変更履歴）
CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    table_name VARCHAR(64) NOT NULL,
    operation VARCHAR(10) NOT NULL, -- INSERT, UPDATE, DELETE
    old_values JSONB,
    new_values JSONB,
    user_id UUID,
    session_id UUID,
    ip_address INET,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 監査トリガー関数
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (table_name, operation, old_values, user_id, ip_address)
        VALUES (TG_TABLE_NAME, TG_OP, to_jsonb(OLD), 
                auth.uid(), inet_client_addr());
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (table_name, operation, old_values, new_values, user_id, ip_address)
        VALUES (TG_TABLE_NAME, TG_OP, to_jsonb(OLD), to_jsonb(NEW),
                auth.uid(), inet_client_addr());
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (table_name, operation, new_values, user_id, ip_address)
        VALUES (TG_TABLE_NAME, TG_OP, to_jsonb(NEW),
                auth.uid(), inet_client_addr());
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 主要テーブルに監査トリガー設定
CREATE TRIGGER audit_vegetables_trigger
    AFTER INSERT OR UPDATE OR DELETE ON vegetables
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_photos_trigger
    AFTER INSERT OR UPDATE OR DELETE ON photos_partitioned
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
```

### 1.3 データ保持ポリシー
```sql
-- データ保持ポリシー設定
-- 1. ログデータの自動削除（90日経過後）
SELECT cron.schedule(
    'cleanup-audit-logs',
    '0 2 * * 0',  -- 毎週日曜日2時実行
    $$
    DELETE FROM audit_log 
    WHERE timestamp < NOW() - INTERVAL '90 days';
    $$
);

-- 2. セッションデータの自動削除（30日経過後）
SELECT cron.schedule(
    'cleanup-sessions',
    '0 3 * * *',  -- 毎日3時実行
    $$
    DELETE FROM auth.sessions 
    WHERE created_at < NOW() - INTERVAL '30 days';
    $$
);

-- 3. 削除済みデータの完全削除（1年経過後）
SELECT cron.schedule(
    'cleanup-soft-deleted',
    '0 4 1 * *',  -- 毎月1日4時実行
    $$
    DELETE FROM vegetables 
    WHERE status = 'deleted' 
      AND updated_at < NOW() - INTERVAL '1 year';
    $$
);
```

## 2. バックアップ戦略

### 2.1 自動バックアップ設定
```sql
-- 1. 毎日の増分バックアップ
SELECT cron.schedule(
    'daily-incremental-backup',
    '0 1 * * *',  -- 毎日1時実行
    $$
    SELECT pg_start_backup('daily_backup_' || to_char(now(), 'YYYY_MM_DD'));
    -- バックアップ処理はSupabaseが自動実行
    SELECT pg_stop_backup();
    $$
);

-- 2. 週次フルバックアップ
SELECT cron.schedule(
    'weekly-full-backup',
    '0 2 * * 0',  -- 毎週日曜日2時実行
    $$
    -- カスタムバックアップスクリプト実行
    SELECT extensions.pg_net_http_post(
        url := 'https://your-backup-service.com/api/backup',
        headers := '{"Authorization": "Bearer ' || current_setting('app.backup_token') || '"}',
        body := '{"type": "full", "timestamp": "' || now() || '"}'
    );
    $$
);
```

### 2.2 バックアップ検証・復旧手順
```bash
#!/bin/bash
# backup-validation.sh - バックアップ検証スクリプト

set -e

BACKUP_DATE=${1:-$(date +%Y-%m-%d)}
VALIDATION_DB="validation_db_$(date +%s)"

echo "🔍 バックアップ検証開始: $BACKUP_DATE"

# 1. バックアップファイルの整合性チェック
pg_verifybackup /backups/daily_backup_$BACKUP_DATE

# 2. テスト環境での復旧テスト
createdb $VALIDATION_DB
pg_restore -d $VALIDATION_DB /backups/daily_backup_$BACKUP_DATE

# 3. データ整合性チェック
psql -d $VALIDATION_DB -c "
  -- レコード数チェック
  SELECT 'vegetables' as table_name, count(*) as record_count FROM vegetables
  UNION ALL
  SELECT 'photos' as table_name, count(*) as record_count FROM photos
  UNION ALL  
  SELECT 'users' as table_name, count(*) as record_count FROM auth.users;
  
  -- 制約チェック
  SELECT conname, contype FROM pg_constraint 
  WHERE contype IN ('f', 'c', 'u');  -- 外部キー、制約、ユニーク制約
"

# 4. アプリケーションテスト
echo "🧪 アプリケーションテスト実行"
DATABASE_URL="postgresql://localhost/$VALIDATION_DB" npm test

# 5. クリーンアップ
dropdb $VALIDATION_DB

echo "✅ バックアップ検証完了: $BACKUP_DATE"
```

### 2.3 災害復旧手順（DR: Disaster Recovery）
```markdown
# 災害復旧マニュアル

## RPO/RTO目標
- **RPO (Recovery Point Objective)**: 1時間（最大1時間分のデータ損失許容）
- **RTO (Recovery Time Objective)**: 4時間（4時間以内のサービス復旧）

## Phase 1: 緊急事態の検出・評価 (15分)
1. **監視アラートの確認**
   - Supabase ダッシュボード確認
   - アプリケーション監視ツール確認
   - ユーザーからの障害報告確認

2. **影響範囲の特定**
   ```bash
   # データベース接続テスト
   psql $DATABASE_URL -c "SELECT NOW();"
   
   # アプリケーション正常性テスト  
   curl -f https://your-app.com/api/health
   ```

## Phase 2: 初期対応 (30分)
1. **サービス停止判断**
   ```bash
   # メンテナンスページの表示
   vercel --prod --build-env MAINTENANCE_MODE=true
   ```

2. **ステークホルダーへの連絡**
   - 経営陣への報告
   - 顧客への障害通知
   - 開発チームの招集

## Phase 3: 復旧作業 (最大3時間)
1. **バックアップからの復旧**
   ```bash
   # 最新の検証済みバックアップを特定
   LATEST_BACKUP=$(ls -t /backups/ | head -n1)
   
   # 新しいデータベースインスタンス作成
   supabase projects create disaster-recovery-$(date +%s)
   
   # データ復旧
   pg_restore -d $NEW_DATABASE_URL /backups/$LATEST_BACKUP
   ```

2. **アプリケーション設定更新**
   ```bash
   # 環境変数更新
   vercel env rm DATABASE_URL production
   vercel env add DATABASE_URL $NEW_DATABASE_URL production
   
   # デプロイ実行
   vercel --prod
   ```

3. **データ整合性チェック**
   ```sql
   -- 復旧後の基本チェック
   SELECT table_name, n_tup_ins, n_tup_upd, n_tup_del 
   FROM pg_stat_user_tables 
   ORDER BY schemaname, tablename;
   
   -- ビジネスクリティカルデータの検証
   SELECT COUNT(*) as total_vegetables FROM vegetables;
   SELECT COUNT(*) as total_photos FROM photos;
   SELECT COUNT(*) as active_users FROM auth.users WHERE deleted_at IS NULL;
   ```

## Phase 4: サービス復旧・監視 (1時間)
1. **段階的サービス復旧**
   ```bash
   # 読み取り専用モードでサービス再開
   vercel env add READ_ONLY_MODE=true production
   vercel --prod
   
   # 監視強化
   # 30分後、全機能復旧
   vercel env rm READ_ONLY_MODE production
   vercel --prod
   ```

2. **復旧後検証**
   - ユーザー認証テスト
   - 主要機能動作テスト  
   - データ整合性最終確認
   - パフォーマンス確認

## Phase 5: 事後対応
1. **根本原因分析**
2. **再発防止策の策定**
3. **DR手順の改善**
4. **関係者への報告書作成**
```

## 3. データベース監視・アラート

### 3.1 パフォーマンス監視
```sql
-- 1. スロークエリ監視ビュー
CREATE VIEW slow_queries AS
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements 
WHERE mean_time > 100  -- 100ms以上のクエリ
ORDER BY mean_time DESC
LIMIT 20;

-- 2. データベース接続監視
CREATE VIEW connection_status AS  
SELECT 
    state,
    COUNT(*) as connection_count,
    MAX(now() - query_start) as longest_query_time,
    MAX(now() - state_change) as longest_idle_time
FROM pg_stat_activity 
WHERE state IS NOT NULL
GROUP BY state;

-- 3. テーブルサイズ監視
CREATE VIEW table_sizes AS
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    n_tup_ins + n_tup_upd + n_tup_del as total_operations
FROM pg_tables
JOIN pg_stat_user_tables ON pg_tables.tablename = pg_stat_user_tables.relname
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### 3.2 自動アラート設定
```sql
-- アラート関数
CREATE OR REPLACE FUNCTION check_database_health()
RETURNS void AS $$
DECLARE
    connection_count INTEGER;
    slow_query_count INTEGER;
    disk_usage_percent FLOAT;
BEGIN
    -- 接続数チェック
    SELECT COUNT(*) INTO connection_count 
    FROM pg_stat_activity;
    
    IF connection_count > 150 THEN
        PERFORM send_alert('connection_limit', 'High connection count: ' || connection_count);
    END IF;
    
    -- スロークエリチェック
    SELECT COUNT(*) INTO slow_query_count 
    FROM pg_stat_statements 
    WHERE mean_time > 1000; -- 1秒以上
    
    IF slow_query_count > 10 THEN
        PERFORM send_alert('slow_queries', 'Multiple slow queries detected: ' || slow_query_count);
    END IF;
    
    -- ディスク使用量チェック（概算）
    SELECT (pg_database_size(current_database()) / (1024^3))::FLOAT INTO disk_usage_percent;
    
    IF disk_usage_percent > 80 THEN
        PERFORM send_alert('disk_space', 'High disk usage: ' || disk_usage_percent || 'GB');
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 定期実行設定
SELECT cron.schedule(
    'database-health-check',
    '*/10 * * * *',  -- 10分毎
    'SELECT check_database_health();'
);
```

## 4. セキュリティ強化

### 4.1 Row Level Security (RLS) 本番設定
```sql
-- 厳格なRLS設定
-- 1. 基本ポリシー
ALTER TABLE vegetables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_vegetables_policy" ON vegetables
    FOR ALL USING (
        company_id = (auth.jwt() ->> 'company_id')::UUID
        AND (
            created_by = auth.uid() OR
            EXISTS (
                SELECT 1 FROM user_permissions 
                WHERE user_id = auth.uid() 
                  AND company_id = vegetables.company_id
                  AND permission IN ('admin', 'read', 'write')
            )
        )
    );

-- 2. 写真テーブルの高度なRLS
CREATE POLICY "photos_access_policy" ON photos_partitioned
    FOR ALL USING (
        -- 同じ会社のユーザーのみアクセス可能
        EXISTS (
            SELECT 1 FROM vegetables v 
            WHERE v.id = photos_partitioned.vegetable_id 
              AND v.company_id = (auth.jwt() ->> 'company_id')::UUID
        )
    );

-- 3. 管理者専用テーブル
CREATE POLICY "admin_only_policy" ON audit_log
    FOR SELECT USING (
        auth.jwt() ->> 'role' = 'admin' OR
        auth.jwt() ->> 'role' = 'super_admin'
    );
```

### 4.2 データ暗号化
```sql
-- 1. 機密データの暗号化
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 暗号化関数
CREATE OR REPLACE FUNCTION encrypt_sensitive_data(data TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN encode(
        encrypt(
            data::bytea, 
            current_setting('app.encryption_key')::bytea, 
            'aes'
        ), 
        'base64'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 復号化関数  
CREATE OR REPLACE FUNCTION decrypt_sensitive_data(encrypted_data TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN convert_from(
        decrypt(
            decode(encrypted_data, 'base64'),
            current_setting('app.encryption_key')::bytea,
            'aes'
        ),
        'UTF8'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 使用例
UPDATE users SET 
    email = encrypt_sensitive_data(email),
    phone = encrypt_sensitive_data(phone)
WHERE encrypted = false;
```