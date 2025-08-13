import { NextRequest } from 'next/server'
import { GET, POST, PUT, DELETE } from '../route'
import { createMockRequest, parseJsonResponse, createMockSupabase } from '@/lib/test-utils/api-helpers'

// Mock the Supabase server client
const mockSupabase = createMockSupabase()
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase))
}))

describe('/api/vegetables', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/vegetables', () => {
    it('returns 400 if company_id is missing', async () => {
      const request = createMockRequest('/api/vegetables')
      const response = await GET(request)
      const data = await parseJsonResponse(response)

      expect(response.status).toBe(400)
      expect(data.error).toBe('Company ID is required')
    })

    it('fetches vegetables successfully', async () => {
      const mockVegetables = [
        {
          id: '1',
          name: 'トマト A棟',
          variety_name: '桃太郎',
          plot_name: 'A棟温室',
          plot_size: 100,
          planting_date: '2024-03-01',
          expected_harvest_date: '2024-05-30',
          status: 'growing',
          created_at: '2024-03-01T00:00:00Z',
          created_by_user: { id: 'user1', full_name: '田中太郎' }
        }
      ]

      // Mock the main query
      mockSupabase.queryBuilder.single.mockResolvedValueOnce({ data: mockVegetables, error: null })

      // Mock count queries
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'gantt_tasks') {
          return {
            ...mockSupabase.queryBuilder,
            single: jest.fn().mockResolvedValue({ data: [{ id: '1', status: 'completed' }], error: null })
          }
        }
        if (table === 'photos' || table === 'operation_logs') {
          return {
            ...mockSupabase.queryBuilder,
            head: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ count: 5, error: null })
          }
        }
        if (table === 'vegetables') {
          return {
            ...mockSupabase.queryBuilder,
            single: jest.fn()
              .mockResolvedValueOnce({ count: 10, error: null }) // total count
              .mockResolvedValueOnce({ data: [{ status: 'growing' }], error: null }) // status stats
          }
        }
        return mockSupabase.queryBuilder
      })

      const request = createMockRequest('/api/vegetables?company_id=test-company')
      const response = await GET(request)
      const data = await parseJsonResponse(response)

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toBeDefined()
      expect(data.pagination).toBeDefined()
      expect(data.summary).toBeDefined()
    })

    it('handles search parameters correctly', async () => {
      mockSupabase.queryBuilder.single.mockResolvedValue({ data: [], error: null })
      
      const request = createMockRequest('/api/vegetables?company_id=test-company&search=トマト&status=growing&plot_name=A棟&limit=20&offset=10')
      await GET(request)

      expect(mockSupabase.queryBuilder.or).toHaveBeenCalledWith('name.ilike.%トマト%,variety_name.ilike.%トマト%,plot_name.ilike.%トマト%')
      expect(mockSupabase.queryBuilder.eq).toHaveBeenCalledWith('status', 'growing')
      expect(mockSupabase.queryBuilder.ilike).toHaveBeenCalledWith('plot_name', '%A棟%')
      expect(mockSupabase.queryBuilder.range).toHaveBeenCalledWith(10, 29)
    })

    it('handles database errors', async () => {
      mockSupabase.queryBuilder.single.mockResolvedValue({ 
        data: null, 
        error: { message: 'Database connection failed' } 
      })

      const request = createMockRequest('/api/vegetables?company_id=test-company')
      const response = await GET(request)
      const data = await parseJsonResponse(response)

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch vegetables')
    })
  })

  describe('POST /api/vegetables', () => {
    const validVegetableData = {
      name: 'トマト A棟',
      variety_name: '桃太郎',
      plot_name: 'A棟温室',
      plot_size: 100,
      planting_date: '2024-03-01',
      expected_harvest_date: '2024-05-30',
      company_id: 'test-company',
      created_by: 'user1'
    }

    it('creates vegetable successfully', async () => {
      const mockCreatedVegetable = {
        id: 'new-veggie-id',
        ...validVegetableData,
        status: 'planning',
        growth_stage: 'seedling',
        created_at: '2024-03-01T00:00:00Z'
      }

      // Mock duplicate check (no existing plot)
      mockSupabase.queryBuilder.single
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } }) // No duplicate plot
        .mockResolvedValueOnce({ data: mockCreatedVegetable, error: null }) // Successful creation

      const request = createMockRequest('/api/vegetables', {
        method: 'POST',
        body: validVegetableData
      })

      const response = await POST(request)
      const data = await parseJsonResponse(response)

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.id).toBe('new-veggie-id')
      expect(data.message).toBe('Vegetable created successfully')
    })

    it('validates required fields', async () => {
      const incompleteData = {
        name: 'トマト A棟',
        variety_name: '桃太郎'
        // missing required fields
      }

      const request = createMockRequest('/api/vegetables', {
        method: 'POST',
        body: incompleteData
      })

      const response = await POST(request)
      const data = await parseJsonResponse(response)

      expect(response.status).toBe(400)
      expect(data.error).toContain('Missing required fields')
    })

    it('validates status values', async () => {
      const invalidStatusData = {
        ...validVegetableData,
        status: 'invalid-status'
      }

      const request = createMockRequest('/api/vegetables', {
        method: 'POST',
        body: invalidStatusData
      })

      const response = await POST(request)
      const data = await parseJsonResponse(response)

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid status')
    })

    it('validates date formats', async () => {
      const invalidDateData = {
        ...validVegetableData,
        planting_date: 'invalid-date'
      }

      const request = createMockRequest('/api/vegetables', {
        method: 'POST',
        body: invalidDateData
      })

      const response = await POST(request)
      const data = await parseJsonResponse(response)

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid planting_date format')
    })

    it('validates harvest date is after planting date', async () => {
      const invalidDateRangeData = {
        ...validVegetableData,
        planting_date: '2024-05-01',
        expected_harvest_date: '2024-04-01' // before planting
      }

      const request = createMockRequest('/api/vegetables', {
        method: 'POST',
        body: invalidDateRangeData
      })

      const response = await POST(request)
      const data = await parseJsonResponse(response)

      expect(response.status).toBe(400)
      expect(data.error).toContain('Must be after planting_date')
    })

    it('prevents duplicate plot names', async () => {
      // Mock existing plot found
      mockSupabase.queryBuilder.single.mockResolvedValue({ 
        data: { id: 'existing-id' }, 
        error: null 
      })

      const request = createMockRequest('/api/vegetables', {
        method: 'POST',
        body: validVegetableData
      })

      const response = await POST(request)
      const data = await parseJsonResponse(response)

      expect(response.status).toBe(400)
      expect(data.error).toBe('Plot name already in use for active cultivation')
    })

    it('handles database insertion errors', async () => {
      // Mock no duplicate plot
      mockSupabase.queryBuilder.single
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
        .mockResolvedValueOnce({ data: null, error: { message: 'Database error' } })

      const request = createMockRequest('/api/vegetables', {
        method: 'POST',
        body: validVegetableData
      })

      const response = await POST(request)
      const data = await parseJsonResponse(response)

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to create vegetable')
    })
  })

  describe('PUT /api/vegetables', () => {
    const updateData = {
      id: 'veggie-1',
      name: 'Updated Tomato',
      status: 'harvesting'
    }

    it('updates vegetable successfully', async () => {
      const mockExisting = {
        id: 'veggie-1',
        company_id: 'test-company',
        plot_name: 'A棟',
        status: 'growing'
      }

      const mockUpdated = {
        id: 'veggie-1',
        name: 'Updated Tomato',
        status: 'harvesting',
        updated_at: '2024-03-02T00:00:00Z'
      }

      mockSupabase.queryBuilder.single
        .mockResolvedValueOnce({ data: mockExisting, error: null }) // Existing vegetable
        .mockResolvedValueOnce({ data: mockUpdated, error: null }) // Updated vegetable

      const request = createMockRequest('/api/vegetables', {
        method: 'PUT',
        body: updateData
      })

      const response = await PUT(request)
      const data = await parseJsonResponse(response)

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.name).toBe('Updated Tomato')
      expect(data.message).toBe('Vegetable updated successfully')
    })

    it('returns 400 if ID is missing', async () => {
      const request = createMockRequest('/api/vegetables', {
        method: 'PUT',
        body: { name: 'Updated Tomato' }
      })

      const response = await PUT(request)
      const data = await parseJsonResponse(response)

      expect(response.status).toBe(400)
      expect(data.error).toBe('Vegetable ID is required')
    })

    it('returns 404 if vegetable not found', async () => {
      mockSupabase.queryBuilder.single.mockResolvedValue({ 
        data: null, 
        error: { code: 'PGRST116' } 
      })

      const request = createMockRequest('/api/vegetables', {
        method: 'PUT',
        body: updateData
      })

      const response = await PUT(request)
      const data = await parseJsonResponse(response)

      expect(response.status).toBe(404)
      expect(data.error).toBe('Vegetable not found')
    })

    it('validates status on update', async () => {
      const mockExisting = {
        id: 'veggie-1',
        company_id: 'test-company',
        plot_name: 'A棟',
        status: 'growing'
      }

      mockSupabase.queryBuilder.single.mockResolvedValue({ 
        data: mockExisting, 
        error: null 
      })

      const request = createMockRequest('/api/vegetables', {
        method: 'PUT',
        body: { id: 'veggie-1', status: 'invalid-status' }
      })

      const response = await PUT(request)
      const data = await parseJsonResponse(response)

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid status')
    })
  })

  describe('DELETE /api/vegetables', () => {
    it('performs soft delete when related data exists', async () => {
      const mockExisting = {
        id: 'veggie-1',
        name: 'トマト A棟',
        variety_name: '桃太郎'
      }

      mockSupabase.queryBuilder.single.mockResolvedValue({ 
        data: mockExisting, 
        error: null 
      })

      // Mock related data exists
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'gantt_tasks') {
          return {
            ...mockSupabase.queryBuilder,
            single: jest.fn().mockResolvedValue({ data: [{ id: 'task-1' }], error: null })
          }
        }
        if (table === 'photos') {
          return {
            ...mockSupabase.queryBuilder,
            single: jest.fn().mockResolvedValue({ data: [{ id: 'photo-1' }], error: null })
          }
        }
        if (table === 'operation_logs') {
          return {
            ...mockSupabase.queryBuilder,
            single: jest.fn().mockResolvedValue({ data: [], error: null })
          }
        }
        if (table === 'vegetables') {
          return {
            ...mockSupabase.queryBuilder,
            update: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ error: null })
          }
        }
        return mockSupabase.queryBuilder
      })

      const request = createMockRequest('/api/vegetables?id=veggie-1', {
        method: 'DELETE'
      })

      const response = await DELETE(request)
      const data = await parseJsonResponse(response)

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.action).toBe('archived')
      expect(data.related_data.tasks).toBe(1)
      expect(data.related_data.photos).toBe(1)
    })

    it('performs hard delete when no related data exists', async () => {
      const mockExisting = {
        id: 'veggie-1',
        name: 'トマト A棟',
        variety_name: '桃太郎'
      }

      mockSupabase.queryBuilder.single
        .mockResolvedValueOnce({ data: mockExisting, error: null }) // Existing vegetable
        .mockResolvedValue({ data: [], error: null }) // No related data

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'vegetables') {
          if (mockSupabase.queryBuilder.delete.mock.calls.length > 0) {
            return {
              ...mockSupabase.queryBuilder,
              delete: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ error: null })
            }
          }
          return mockSupabase.queryBuilder
        }
        return {
          ...mockSupabase.queryBuilder,
          single: jest.fn().mockResolvedValue({ data: [], error: null })
        }
      })

      const request = createMockRequest('/api/vegetables?id=veggie-1', {
        method: 'DELETE'
      })

      const response = await DELETE(request)
      const data = await parseJsonResponse(response)

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.action).toBe('deleted')
      expect(data.deleted_vegetable.id).toBe('veggie-1')
    })

    it('returns 400 if ID is missing', async () => {
      const request = createMockRequest('/api/vegetables', {
        method: 'DELETE'
      })

      const response = await DELETE(request)
      const data = await parseJsonResponse(response)

      expect(response.status).toBe(400)
      expect(data.error).toBe('Vegetable ID is required')
    })

    it('returns 404 if vegetable not found', async () => {
      mockSupabase.queryBuilder.single.mockResolvedValue({ 
        data: null, 
        error: { code: 'PGRST116' } 
      })

      const request = createMockRequest('/api/vegetables?id=nonexistent', {
        method: 'DELETE'
      })

      const response = await DELETE(request)
      const data = await parseJsonResponse(response)

      expect(response.status).toBe(404)
      expect(data.error).toBe('Vegetable not found')
    })
  })

  describe('Error handling', () => {
    it('handles unexpected errors', async () => {
      // Mock createClient to throw an error
      const { createClient } = require('@/lib/supabase/server')
      createClient.mockRejectedValue(new Error('Connection failed'))

      const request = createMockRequest('/api/vegetables?company_id=test-company')
      const response = await GET(request)
      const data = await parseJsonResponse(response)

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })
})