import { NextRequest } from 'next/server'

export function createMockRequest(
  url: string, 
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    body?: any
    headers?: Record<string, string>
  } = {}
): NextRequest {
  const { method = 'GET', body, headers = {} } = options

  const requestInit: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  }

  if (body && (method === 'POST' || method === 'PUT')) {
    requestInit.body = JSON.stringify(body)
  }

  // Create a full URL for the request
  const fullUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`
  
  return new NextRequest(fullUrl, requestInit)
}

export async function parseJsonResponse(response: Response) {
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

export interface MockSupabaseQueryBuilder {
  select: jest.Mock
  insert: jest.Mock
  update: jest.Mock
  delete: jest.Mock
  eq: jest.Mock
  neq: jest.Mock
  or: jest.Mock
  ilike: jest.Mock
  order: jest.Mock
  range: jest.Mock
  single: jest.Mock
  head: jest.Mock
}

export function createMockSupabase() {
  const mockQueryBuilder: MockSupabaseQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    head: jest.fn().mockReturnThis()
  }

  return {
    from: jest.fn(() => mockQueryBuilder),
    queryBuilder: mockQueryBuilder
  }
}