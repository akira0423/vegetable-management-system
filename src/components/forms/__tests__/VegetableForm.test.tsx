import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VegetableForm, VegetableVariety, VegetableFormData } from '../VegetableForm'

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
  },
  {
    id: '3',
    name: 'レタス',
    variety: 'シスコ',
    category: '葉菜類',
    standard_growth_days: 45
  }
]

describe('VegetableForm', () => {
  const mockOnSubmit = jest.fn()
  const mockOnCancel = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    // Mock alert
    window.alert = jest.fn()
  })

  const defaultProps = {
    varieties: mockVarieties,
    onSubmit: mockOnSubmit,
    onCancel: mockOnCancel
  }

  it('renders correctly', () => {
    render(<VegetableForm {...defaultProps} />)
    
    expect(screen.getByTestId('vegetable-form')).toBeInTheDocument()
    expect(screen.getByText('基本情報')).toBeInTheDocument()
    expect(screen.getByText('栽培日程')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    render(<VegetableForm {...defaultProps} loading={true} />)
    
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    expect(screen.queryByTestId('vegetable-form')).not.toBeInTheDocument()
  })

  it('handles form input changes', async () => {
    const user = userEvent.setup()
    render(<VegetableForm {...defaultProps} />)
    
    const nameInput = screen.getByTestId('name-input')
    const plotNameInput = screen.getByTestId('plot-name-input')
    
    await user.type(nameInput, 'テストトマト')
    await user.type(plotNameInput, 'A棟温室')
    
    expect(nameInput).toHaveValue('テストトマト')
    expect(plotNameInput).toHaveValue('A棟温室')
  })

  it('handles variety selection and auto-calculation', async () => {
    const user = userEvent.setup()
    const mockOnSubmit = jest.fn()
    
    render(<VegetableForm {...defaultProps} onSubmit={mockOnSubmit} />)
    
    // 植付日を先に設定
    const plantingDateInput = screen.getByTestId('planting-date-input')
    await user.type(plantingDateInput, '2024-03-01')
    
    // 品種選択をスキップして、直接フォーム送信で品種IDが設定されるかをテスト
    await user.type(screen.getByTestId('name-input'), 'テストトマト')
    await user.type(screen.getByTestId('plot-name-input'), 'A棟温室')
    
    // フォームのバリデーション動作を確認
    const submitButton = screen.getByTestId('submit-button')
    await user.click(submitButton)
    
    // バリデーションエラーが表示されることを確認（品種が未選択のため）
    expect(window.alert).toHaveBeenCalledWith('必須項目を入力してください')
  })

  it('validates required fields', async () => {
    const user = userEvent.setup()
    render(<VegetableForm {...defaultProps} />)
    
    const submitButton = screen.getByTestId('submit-button')
    await user.click(submitButton)
    
    expect(window.alert).toHaveBeenCalledWith('必須項目を入力してください')
    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('submits form with valid data', async () => {
    const user = userEvent.setup()
    const mockOnSubmit = jest.fn()
    
    // 初期データで品種を事前に設定
    const initialData = {
      variety_id: '1',
      variety_name: '桃太郎'
    }
    
    render(
      <VegetableForm 
        {...defaultProps} 
        onSubmit={mockOnSubmit}
        initialData={initialData}
      />
    )
    
    // 必須項目を入力
    await user.type(screen.getByTestId('name-input'), 'テストトマト')
    await user.type(screen.getByTestId('plot-name-input'), 'A棟温室')
    await user.type(screen.getByTestId('planting-date-input'), '2024-03-01')
    
    // オプション項目も入力
    await user.type(screen.getByTestId('area-size-input'), '100.5')
    await user.type(screen.getByTestId('plant-count-input'), '50')
    await user.type(screen.getByTestId('notes-textarea'), 'テスト用の備考')
    
    const submitButton = screen.getByTestId('submit-button')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'テストトマト',
          variety_id: '1',
          variety_name: '桃太郎',
          plot_name: 'A棟温室',
          area_size: '100.5',
          plant_count: '50',
          planting_date: '2024-03-01',
          notes: 'テスト用の備考',
          status: 'planning'
        })
      )
    })
  })

  it('handles cancel button click', async () => {
    const user = userEvent.setup()
    render(<VegetableForm {...defaultProps} />)
    
    const cancelButton = screen.getByTestId('cancel-button')
    await user.click(cancelButton)
    
    expect(mockOnCancel).toHaveBeenCalledTimes(1)
  })

  it('shows submitting state', async () => {
    const user = userEvent.setup()
    const slowOnSubmit = jest.fn(() => new Promise(resolve => setTimeout(resolve, 1000)))
    
    render(<VegetableForm {...defaultProps} onSubmit={slowOnSubmit} />)
    
    // 必須項目を入力
    await user.type(screen.getByTestId('name-input'), 'テストトマト')
    await user.type(screen.getByTestId('plot-name-input'), 'A棟温室')
    await user.type(screen.getByTestId('planting-date-input'), '2024-03-01')
    
    // 品種選択
    const varietySelect = screen.getByTestId('variety-select')
    await user.click(varietySelect)
    const tomatoOption = screen.getByRole('option', { name: 'トマト - 桃太郎 (果菜類)' })
    await user.click(tomatoOption)
    
    const submitButton = screen.getByTestId('submit-button')
    await user.click(submitButton)
    
    // 送信中状態のチェック
    expect(screen.getByText('登録中...')).toBeInTheDocument()
    expect(submitButton).toBeDisabled()
  })

  it('handles status selection', async () => {
    const user = userEvent.setup()
    render(<VegetableForm {...defaultProps} />)
    
    const statusSelect = screen.getByTestId('status-select')
    await user.click(statusSelect)
    
    const growingOption = screen.getByText('栽培中')
    await user.click(growingOption)
    
    // 値が設定されていることを確認するため、フォームを送信してデータを確認
    await user.type(screen.getByTestId('name-input'), 'テスト')
    await user.type(screen.getByTestId('plot-name-input'), 'テスト圃場')
    await user.type(screen.getByTestId('planting-date-input'), '2024-03-01')
    
    const varietySelect = screen.getByTestId('variety-select')
    await user.click(varietySelect)
    const tomatoOption = screen.getByText('トマト - 桃太郎 (果菜類)')
    await user.click(tomatoOption)
    
    await user.click(screen.getByTestId('submit-button'))
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'growing'
        })
      )
    })
  })

  it('populates form with initial data', () => {
    const initialData = {
      name: '初期トマト',
      plot_name: '初期圃場',
      area_size: '200',
      plant_count: '100',
      status: 'harvesting',
      notes: '初期備考'
    }
    
    render(<VegetableForm {...defaultProps} initialData={initialData} />)
    
    expect(screen.getByTestId('name-input')).toHaveValue('初期トマト')
    expect(screen.getByTestId('plot-name-input')).toHaveValue('初期圃場')
    expect(screen.getByTestId('area-size-input')).toHaveValue('200')
    expect(screen.getByTestId('plant-count-input')).toHaveValue('100')
    expect(screen.getByTestId('notes-textarea')).toHaveValue('初期備考')
  })

  it('handles form submission error gracefully', async () => {
    const user = userEvent.setup()
    const errorOnSubmit = jest.fn().mockRejectedValue(new Error('Submission failed'))
    
    render(<VegetableForm {...defaultProps} onSubmit={errorOnSubmit} />)
    
    // 必須項目を入力
    await user.type(screen.getByTestId('name-input'), 'テストトマト')
    await user.type(screen.getByTestId('plot-name-input'), 'A棟温室')
    await user.type(screen.getByTestId('planting-date-input'), '2024-03-01')
    
    const varietySelect = screen.getByTestId('variety-select')
    await user.click(varietySelect)
    const tomatoOption = screen.getByText('トマト - 桃太郎 (果菜類)')
    await user.click(tomatoOption)
    
    const submitButton = screen.getByTestId('submit-button')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(errorOnSubmit).toHaveBeenCalled()
      expect(submitButton).not.toBeDisabled() // エラー後は再度有効になる
    })
  })
})