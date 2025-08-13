import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VegetableForm, VegetableVariety } from '@/components/forms/VegetableForm'
import PhotoUpload from '@/components/photo-upload'

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, ...props }: any) => (
    <img src={src} alt={alt} {...props} />
  ),
}))

// Mock fetch for API calls
global.fetch = jest.fn()

const mockVarieties: VegetableVariety[] = [
  {
    id: '1',
    name: 'トマト',
    variety: '桃太郎',
    category: '果菜類',
    standard_growth_days: 90
  },
  {
    id: '2',
    name: 'キュウリ',
    variety: '夏すずみ',
    category: '果菜類',
    standard_growth_days: 60
  }
]

describe('Vegetable Management Workflow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.alert = jest.fn()
    global.URL.createObjectURL = jest.fn(() => 'mock-object-url')
    global.URL.revokeObjectURL = jest.fn()
    ;(global.fetch as jest.Mock).mockClear()
  })

  it('completes full vegetable registration workflow', async () => {
    const user = userEvent.setup()
    
    // Mock successful API response
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          id: 'new-vegetable-id',
          name: 'テスト野菜',
          variety_name: '桃太郎',
          plot_name: 'テスト圃場'
        }
      })
    })

    const mockOnSubmit = jest.fn().mockImplementation(async (data) => {
      const response = await fetch('/api/vegetables', {
        method: 'POST',
        body: JSON.stringify(data)
      })
      const result = await response.json()
      return result
    })

    const mockOnCancel = jest.fn()

    render(
      <VegetableForm
        varieties={mockVarieties}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    )

    // Step 1: Fill out the form
    await user.type(screen.getByTestId('name-input'), 'テスト野菜')
    await user.type(screen.getByTestId('plot-name-input'), 'テスト圃場')
    
    // Select variety
    const varietySelect = screen.getByTestId('variety-select')
    await user.click(varietySelect)
    const tomatoOption = screen.getByText('トマト - 桃太郎 (果菜類)')
    await user.click(tomatoOption)
    
    // Set planting date
    await user.type(screen.getByTestId('planting-date-input'), '2024-03-01')
    
    // Add optional data
    await user.type(screen.getByTestId('area-size-input'), '100')
    await user.type(screen.getByTestId('plant-count-input'), '50')
    await user.type(screen.getByTestId('notes-textarea'), '統合テスト用の野菜')

    // Step 2: Submit the form
    const submitButton = screen.getByTestId('submit-button')
    await user.click(submitButton)

    // Verify API call was made with correct data
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'テスト野菜',
          variety_id: '1',
          variety_name: '桃太郎',
          plot_name: 'テスト圃場',
          area_size: '100',
          plant_count: '50',
          planting_date: '2024-03-01',
          notes: '統合テスト用の野菜',
          status: 'planning'
        })
      )
    })

    expect(global.fetch).toHaveBeenCalledWith('/api/vegetables', {
      method: 'POST',
      body: expect.stringContaining('"name":"テスト野菜"')
    })
  })

  it('handles form validation and error states', async () => {
    const user = userEvent.setup()
    const mockOnSubmit = jest.fn()
    const mockOnCancel = jest.fn()

    render(
      <VegetableForm
        varieties={mockVarieties}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    )

    // Try to submit without required fields
    const submitButton = screen.getByTestId('submit-button')
    await user.click(submitButton)

    expect(window.alert).toHaveBeenCalledWith('必須項目を入力してください')
    expect(mockOnSubmit).not.toHaveBeenCalled()

    // Fill required fields and try again
    await user.type(screen.getByTestId('name-input'), 'テスト野菜')
    await user.type(screen.getByTestId('plot-name-input'), 'テスト圃場')
    await user.type(screen.getByTestId('planting-date-input'), '2024-03-01')
    
    const varietySelect = screen.getByTestId('variety-select')
    await user.click(varietySelect)
    const tomatoOption = screen.getByText('トマト - 桃太郎 (果菜類)')
    await user.click(tomatoOption)

    await user.click(submitButton)

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled()
    })
  })

  it('integrates photo upload with vegetable management', async () => {
    const user = userEvent.setup()
    
    // Mock Supabase responses
    const mockSupabase = {
      storage: {
        from: () => ({
          upload: jest.fn().mockResolvedValue({ 
            data: { path: 'test-path' }, 
            error: null 
          }),
          getPublicUrl: () => ({
            data: { publicUrl: 'https://example.com/photo.jpg' }
          })
        })
      },
      from: () => ({
        insert: jest.fn().mockResolvedValue({ error: null })
      })
    }

    // Mock the Supabase module
    jest.doMock('@/lib/supabase', () => ({
      supabase: mockSupabase
    }))

    const mockOnUploadSuccess = jest.fn()

    render(<PhotoUpload vegetableId="test-veggie-id" onUploadSuccess={mockOnUploadSuccess} />)

    // Open the photo upload dialog
    const triggerButton = screen.getByRole('button', { name: /写真追加/ })
    await user.click(triggerButton)

    // Create a test file
    const testFile = new File(['test image content'], 'test.jpg', { type: 'image/jpeg' })
    
    // Upload file
    const fileInput = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement
    await user.upload(fileInput, testFile)

    await waitFor(() => {
      expect(screen.getByText('選択された写真')).toBeInTheDocument()
      expect(screen.getByText('test.jpg')).toBeInTheDocument()
    })

    // Add description and tags
    const descriptionTextarea = screen.getByLabelText('説明（任意）')
    const tagsInput = screen.getByLabelText('タグ（任意）')
    
    await user.type(descriptionTextarea, '統合テスト用の写真')
    await user.type(tagsInput, 'テスト, 統合テスト')

    // Upload the file
    const uploadButton = screen.getByRole('button', { name: /1枚をアップロード/ })
    await user.click(uploadButton)

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('1枚の写真をアップロードしました！')
      expect(mockOnUploadSuccess).toHaveBeenCalled()
    })
  })

  it('handles API error scenarios gracefully', async () => {
    const user = userEvent.setup()
    
    // Mock API error response
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: 'Plot name already in use for active cultivation'
      })
    })

    const mockOnSubmit = jest.fn().mockImplementation(async (data) => {
      const response = await fetch('/api/vegetables', {
        method: 'POST',
        body: JSON.stringify(data)
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error)
      }
      return result
    })

    render(
      <VegetableForm
        varieties={mockVarieties}
        onSubmit={mockOnSubmit}
        onCancel={jest.fn()}
      />
    )

    // Fill form with data that will cause a conflict
    await user.type(screen.getByTestId('name-input'), 'テスト野菜')
    await user.type(screen.getByTestId('plot-name-input'), '重複圃場')
    await user.type(screen.getByTestId('planting-date-input'), '2024-03-01')
    
    const varietySelect = screen.getByTestId('variety-select')
    await user.click(varietySelect)
    const tomatoOption = screen.getByText('トマト - 桃太郎 (果菜類)')
    await user.click(tomatoOption)

    // Submit and expect error handling
    const submitButton = screen.getByTestId('submit-button')
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled()
      // The form should handle the error gracefully
      expect(submitButton).not.toBeDisabled()
    })
  })

  it('validates form data consistency', async () => {
    const user = userEvent.setup()
    const mockOnSubmit = jest.fn()

    render(
      <VegetableForm
        varieties={mockVarieties}
        onSubmit={mockOnSubmit}
        onCancel={jest.fn()}
      />
    )

    // Select a variety first
    const varietySelect = screen.getByTestId('variety-select')
    await user.click(varietySelect)
    const cucumberOption = screen.getByText('キュウリ - 夏すずみ (果菜類)')
    await user.click(cucumberOption)

    // Set planting date
    await user.type(screen.getByTestId('planting-date-input'), '2024-04-01')

    // Check that harvest dates are auto-calculated based on growth days (60 days for cucumber)
    await waitFor(() => {
      const harvestStartInput = screen.getByTestId('harvest-start-input')
      const harvestEndInput = screen.getByTestId('harvest-end-input')
      
      // Cucumber: 60 days growth, so harvest start should be around 2024-05-22 (60-10 days)
      // and harvest end around 2024-06-20 (60+20 days)
      expect(harvestStartInput).toHaveValue('2024-05-22')
      expect(harvestEndInput).toHaveValue('2024-06-20')
    })

    // Complete the form
    await user.type(screen.getByTestId('name-input'), 'キュウリテスト')
    await user.type(screen.getByTestId('plot-name-input'), 'B棟温室')

    const submitButton = screen.getByTestId('submit-button')
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          variety_id: '2',
          variety_name: '夏すずみ',
          expected_harvest_start: '2024-05-22',
          expected_harvest_end: '2024-06-20'
        })
      )
    })
  })

  it('maintains form state during user interactions', async () => {
    const user = userEvent.setup()

    render(
      <VegetableForm
        varieties={mockVarieties}
        onSubmit={jest.fn()}
        onCancel={jest.fn()}
      />
    )

    // Fill out multiple fields
    await user.type(screen.getByTestId('name-input'), '状態維持テスト')
    await user.type(screen.getByTestId('plot-name-input'), 'C棟温室')
    await user.type(screen.getByTestId('area-size-input'), '150.5')
    await user.type(screen.getByTestId('plant-count-input'), '75')

    // Change status
    const statusSelect = screen.getByTestId('status-select')
    await user.click(statusSelect)
    const growingOption = screen.getByText('栽培中')
    await user.click(growingOption)

    // Add notes
    await user.type(screen.getByTestId('notes-textarea'), 'フォーム状態のテスト用野菜')

    // Verify all values are maintained
    expect(screen.getByTestId('name-input')).toHaveValue('状態維持テスト')
    expect(screen.getByTestId('plot-name-input')).toHaveValue('C棟温室')
    expect(screen.getByTestId('area-size-input')).toHaveValue('150.5')
    expect(screen.getByTestId('plant-count-input')).toHaveValue('75')
    expect(screen.getByTestId('notes-textarea')).toHaveValue('フォーム状態のテスト用野菜')

    // Select a variety and verify all previous values are still there
    const varietySelect = screen.getByTestId('variety-select')
    await user.click(varietySelect)
    const tomatoOption = screen.getByText('トマト - 桃太郎 (果菜類)')
    await user.click(tomatoOption)

    expect(screen.getByTestId('name-input')).toHaveValue('状態維持テスト')
    expect(screen.getByTestId('plot-name-input')).toHaveValue('C棟温室')
    expect(screen.getByTestId('area-size-input')).toHaveValue('150.5')
    expect(screen.getByTestId('plant-count-input')).toHaveValue('75')
    expect(screen.getByTestId('notes-textarea')).toHaveValue('フォーム状態のテスト用野菜')
  })
})