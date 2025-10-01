/**
 * 検索クエリ解析ユーティリティ
 * 高度な検索構文をパース
 */

export interface ParsedQuery {
  terms: string[];        // 通常の検索語
  phrases: string[];      // 完全一致フレーズ
  excludes: string[];     // 除外語
  tags: string[];         // タグ
  filters: {
    crop?: string;
    disease?: string;
    region?: string;
    season?: string;
    bountyMin?: number;
    bountyMax?: number;
  };
}

/**
 * 検索クエリを解析
 * @param query 検索クエリ文字列
 * @returns パース済みクエリオブジェクト
 */
export function parseSearchQuery(query: string): ParsedQuery {
  const result: ParsedQuery = {
    terms: [],
    phrases: [],
    excludes: [],
    tags: [],
    filters: {}
  };

  let processedQuery = query;

  // 1. 完全一致フレーズの抽出 ("phrase")
  const phraseRegex = /"([^"]+)"/g;
  let phraseMatch;
  while ((phraseMatch = phraseRegex.exec(query)) !== null) {
    result.phrases.push(phraseMatch[1]);
  }
  processedQuery = processedQuery.replace(phraseRegex, '');

  // 2. タグの抽出 (#tag)
  const tagRegex = /#([\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+)/g;
  let tagMatch;
  while ((tagMatch = tagRegex.exec(processedQuery)) !== null) {
    result.tags.push(tagMatch[1]);
  }
  processedQuery = processedQuery.replace(tagRegex, '');

  // 3. 除外語の抽出 (-word)
  const excludeRegex = /-([\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+)/g;
  let excludeMatch;
  while ((excludeMatch = excludeRegex.exec(processedQuery)) !== null) {
    result.excludes.push(excludeMatch[1]);
  }
  processedQuery = processedQuery.replace(excludeRegex, '');

  // 4. 特殊フィルターの抽出
  // 作物フィルター (crop:tomato)
  const cropRegex = /crop:([\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+)/i;
  const cropMatch = processedQuery.match(cropRegex);
  if (cropMatch) {
    result.filters.crop = cropMatch[1];
    processedQuery = processedQuery.replace(cropRegex, '');
  }

  // 病害フィルター (disease:powdery_mildew)
  const diseaseRegex = /disease:([\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+)/i;
  const diseaseMatch = processedQuery.match(diseaseRegex);
  if (diseaseMatch) {
    result.filters.disease = diseaseMatch[1];
    processedQuery = processedQuery.replace(diseaseRegex, '');
  }

  // 地域フィルター (region:kanto)
  const regionRegex = /region:([\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+)/i;
  const regionMatch = processedQuery.match(regionRegex);
  if (regionMatch) {
    result.filters.region = regionMatch[1];
    processedQuery = processedQuery.replace(regionRegex, '');
  }

  // 報酬額フィルター (bounty:1000-5000 or bounty:>3000)
  const bountyRangeRegex = /bounty:(\d+)-(\d+)/i;
  const bountyMinRegex = /bounty:>(\d+)/i;
  const bountyMaxRegex = /bounty:<(\d+)/i;

  const bountyRangeMatch = processedQuery.match(bountyRangeRegex);
  const bountyMinMatch = processedQuery.match(bountyMinRegex);
  const bountyMaxMatch = processedQuery.match(bountyMaxRegex);

  if (bountyRangeMatch) {
    result.filters.bountyMin = parseInt(bountyRangeMatch[1]);
    result.filters.bountyMax = parseInt(bountyRangeMatch[2]);
    processedQuery = processedQuery.replace(bountyRangeRegex, '');
  } else if (bountyMinMatch) {
    result.filters.bountyMin = parseInt(bountyMinMatch[1]);
    processedQuery = processedQuery.replace(bountyMinRegex, '');
  } else if (bountyMaxMatch) {
    result.filters.bountyMax = parseInt(bountyMaxMatch[1]);
    processedQuery = processedQuery.replace(bountyMaxRegex, '');
  }

  // 5. 残りの通常検索語を抽出
  const terms = processedQuery
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  result.terms = terms;

  return result;
}

/**
 * パースされたクエリをSQL条件に変換
 * @param parsed パース済みクエリ
 * @returns SQL WHERE句の条件配列とパラメータ
 */
export function buildSQLConditions(parsed: ParsedQuery): {
  conditions: string[];
  params: any[];
} {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // 全文検索条件
  const searchTerms = [
    ...parsed.terms,
    ...parsed.phrases
  ];

  if (searchTerms.length > 0) {
    const searchQuery = searchTerms.join(' & ');
    conditions.push(`search_vector @@ plainto_tsquery('japanese', $${paramIndex})`);
    params.push(searchQuery);
    paramIndex++;
  }

  // 除外条件
  parsed.excludes.forEach(exclude => {
    conditions.push(`NOT (title ILIKE $${paramIndex} OR body ILIKE $${paramIndex})`);
    params.push(`%${exclude}%`);
    paramIndex++;
  });

  // タグ条件
  if (parsed.tags.length > 0) {
    conditions.push(`tags && $${paramIndex}::text[]`);
    params.push(parsed.tags);
    paramIndex++;
  }

  // フィルター条件
  if (parsed.filters.crop) {
    conditions.push(`crop = $${paramIndex}`);
    params.push(parsed.filters.crop);
    paramIndex++;
  }

  if (parsed.filters.disease) {
    conditions.push(`disease = $${paramIndex}`);
    params.push(parsed.filters.disease);
    paramIndex++;
  }

  if (parsed.filters.region) {
    conditions.push(`region = $${paramIndex}`);
    params.push(parsed.filters.region);
    paramIndex++;
  }

  if (parsed.filters.bountyMin !== undefined) {
    conditions.push(`bounty_amount >= $${paramIndex}`);
    params.push(parsed.filters.bountyMin);
    paramIndex++;
  }

  if (parsed.filters.bountyMax !== undefined) {
    conditions.push(`bounty_amount <= $${paramIndex}`);
    params.push(parsed.filters.bountyMax);
    paramIndex++;
  }

  return { conditions, params };
}

/**
 * 検索クエリのバリデーション
 * @param query 検索クエリ
 * @returns エラーメッセージ（なければnull）
 */
export function validateSearchQuery(query: string): string | null {
  if (query.length > 500) {
    return '検索クエリが長すぎます（500文字以内）';
  }

  // 引用符の整合性チェック
  const quoteCount = (query.match(/"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    return '引用符が閉じられていません';
  }

  // SQLインジェクション対策
  const dangerousPatterns = [
    /;\s*DROP/i,
    /;\s*DELETE/i,
    /;\s*UPDATE/i,
    /;\s*INSERT/i,
    /--/,
    /\/\*/,
    /\*\//
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(query)) {
      return '不正な文字が含まれています';
    }
  }

  return null;
}