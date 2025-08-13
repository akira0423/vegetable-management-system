import '@testing-library/jest-dom'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
    getAll: jest.fn(),
    has: jest.fn(),
    keys: jest.fn(),
    values: jest.fn(),
    entries: jest.fn(),
    toString: jest.fn(),
  }),
  usePathname: () => '/dashboard',
  useParams: () => ({}),
}))

// Mock Supabase client - conditional mock to avoid path issues
const mockSupabase = {
  createClient: () => ({
    auth: {
      getUser: jest.fn(),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
          order: jest.fn(),
          limit: jest.fn(),
        })),
        order: jest.fn(),
        limit: jest.fn(),
      })),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
    })),
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(),
        download: jest.fn(),
        remove: jest.fn(),
        list: jest.fn(),
        getPublicUrl: jest.fn(),
      })),
    },
  }),
}

// Mock Supabase modules
jest.mock('@/lib/supabase', () => ({
  supabase: mockSupabase.createClient()
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase.createClient()))
}))

// Mock OpenAI client
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
      images: {
        analyze: jest.fn(),
      },
    })),
  }
})

// Mock file upload
Object.defineProperty(window, 'FileReader', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    readAsDataURL: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    result: 'data:image/png;base64,mock-base64-data',
  })),
})

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock hasPointerCapture for Radix UI components
Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
  writable: true,
  value: jest.fn().mockReturnValue(false),
})

// Mock setPointerCapture and releasePointerCapture
Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
  writable: true,
  value: jest.fn(),
})

Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
  writable: true,
  value: jest.fn(),
})

// Mock scrollIntoView for Radix UI Select
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  writable: true,
  value: jest.fn(),
})

// Mock getBoundingClientRect
Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
  writable: true,
  value: jest.fn(() => ({
    bottom: 0,
    height: 0,
    left: 0,
    right: 0,
    top: 0,
    width: 0,
    x: 0,
    y: 0,
  })),
})

// Mock Web APIs for Next.js
if (typeof global.Request === 'undefined') {
  global.Request = class Request {
    constructor(input, init) {
      Object.defineProperty(this, 'url', {
        value: typeof input === 'string' ? input : input.url,
        writable: false
      })
      this.method = init?.method || 'GET'
      this.headers = new Headers(init?.headers || {})
      this.body = init?.body || null
    }
    
    async json() {
      return JSON.parse(this.body || '{}')
    }
  }
}

global.Response = class Response {
  constructor(body, init) {
    this.body = body
    this.status = init?.status || 200
    this.statusText = init?.statusText || 'OK'
    this.headers = new Headers(init?.headers || {})
  }
  
  async json() {
    return JSON.parse(this.body || '{}')
  }
  
  async text() {
    return this.body || ''
  }
}

global.Headers = class Headers {
  constructor(init) {
    this.map = new Map()
    if (init) {
      Object.entries(init).forEach(([key, value]) => {
        this.map.set(key.toLowerCase(), value)
      })
    }
  }
  
  get(name) {
    return this.map.get(name.toLowerCase())
  }
  
  set(name, value) {
    this.map.set(name.toLowerCase(), value)
  }
}

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks()
})