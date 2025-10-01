/**
 * 検索結果キャッシュユーティリティ
 * パフォーマンス最適化のためのインメモリキャッシュ
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class SearchCache {
  private cache: Map<string, CacheEntry<any>>;
  private maxSize: number;
  private defaultTTL: number;

  constructor(maxSize = 100, defaultTTL = 30000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  /**
   * キャッシュキーを生成
   */
  generateKey(params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        if (params[key] !== undefined && params[key] !== null) {
          acc[key] = params[key];
        }
        return acc;
      }, {} as Record<string, any>);

    return JSON.stringify(sortedParams);
  }

  /**
   * キャッシュから取得
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // TTLチェック
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    // LRU: 最後にアクセスしたエントリを最後に移動
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data as T;
  }

  /**
   * キャッシュに保存
   */
  set<T>(key: string, data: T, ttl?: number): void {
    // キャッシュサイズ制限
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      // 最も古いエントリを削除（FIFO）
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    });
  }

  /**
   * キャッシュをクリア
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 特定のプレフィックスを持つキーをクリア
   */
  clearByPrefix(prefix: string): void {
    const keysToDelete: string[] = [];
    this.cache.forEach((_, key) => {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * キャッシュ統計を取得
   */
  getStats() {
    let totalSize = 0;
    let expiredCount = 0;
    const now = Date.now();

    this.cache.forEach(entry => {
      totalSize += JSON.stringify(entry.data).length;
      if (now - entry.timestamp > entry.ttl) {
        expiredCount++;
      }
    });

    return {
      entryCount: this.cache.size,
      totalSize,
      expiredCount,
      hitRate: 0 // 実際の実装では、ヒット/ミスをトラッキング
    };
  }
}

// シングルトンインスタンス
export const searchCache = new SearchCache();

/**
 * キャッシュ付き非同期関数ラッパー
 */
export function withCache<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: {
    ttl?: number;
    keyGenerator?: (...args: Parameters<T>) => string;
  } = {}
): T {
  return (async (...args: Parameters<T>) => {
    const key = options.keyGenerator
      ? options.keyGenerator(...args)
      : searchCache.generateKey(args[0] || {});

    // キャッシュチェック
    const cached = searchCache.get(key);
    if (cached !== null) {
      console.log('[Cache Hit]', key.substring(0, 50));
      return cached;
    }

    // 実関数実行
    console.log('[Cache Miss]', key.substring(0, 50));
    const result = await fn(...args);

    // キャッシュに保存
    searchCache.set(key, result, options.ttl);

    return result;
  }) as T;
}

/**
 * 検索履歴管理
 */
class SearchHistory {
  private history: string[] = [];
  private maxHistory = 50;
  private storageKey = 'qa_search_history';

  constructor() {
    if (typeof window !== 'undefined') {
      this.load();
    }
  }

  add(query: string): void {
    if (!query || query.trim().length === 0) return;

    // 重複を削除
    this.history = this.history.filter(q => q !== query);

    // 新しいクエリを先頭に追加
    this.history.unshift(query);

    // サイズ制限
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(0, this.maxHistory);
    }

    this.save();
  }

  get(limit = 10): string[] {
    return this.history.slice(0, limit);
  }

  clear(): void {
    this.history = [];
    this.save();
  }

  private save(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.storageKey, JSON.stringify(this.history));
    }
  }

  private load(): void {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
          this.history = JSON.parse(saved);
        }
      } catch (error) {
        console.error('Failed to load search history:', error);
      }
    }
  }
}

export const searchHistory = new SearchHistory();

/**
 * 検索パフォーマンス計測
 */
export class PerformanceTracker {
  private metrics: Map<string, number[]> = new Map();

  start(key: string): () => void {
    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;
      this.record(key, duration);
    };
  }

  record(key: string, duration: number): void {
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    const values = this.metrics.get(key)!;
    values.push(duration);

    // 最新100件のみ保持
    if (values.length > 100) {
      values.shift();
    }
  }

  getStats(key: string) {
    const values = this.metrics.get(key);
    if (!values || values.length === 0) {
      return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count: values.length,
      mean: sum / values.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      min: sorted[0],
      max: sorted[sorted.length - 1]
    };
  }

  clear(): void {
    this.metrics.clear();
  }
}

export const performanceTracker = new PerformanceTracker();