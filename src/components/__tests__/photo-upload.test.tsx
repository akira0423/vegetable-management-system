import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PhotoUpload from '../photo-upload'

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, ...props }: any) => (
    <img src={src} alt={alt} {...props} />
  ),
}))

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(),
        getPublicUrl: jest.fn(() => ({
          data: { publicUrl: 'https://example.com/photo.jpg' }
        })),
        remove: jest.fn()
      }))
    },
    from: jest.fn(() => ({
      insert: jest.fn(() => ({ error: null }))
    }))
  }
}))

describe('PhotoUpload', () => {
  const defaultProps = {
    vegetableId: 'test-vegetable-id',
    operationLogId: 'test-operation-log-id'
  }

  beforeEach(() => {
    jest.clearAllMocks()
    // Mock alert
    window.alert = jest.fn()
    
    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = jest.fn(() => 'mock-object-url')
    global.URL.revokeObjectURL = jest.fn()
  })

  it('renders trigger button', () => {
    render(<PhotoUpload {...defaultProps} />)
    
    expect(screen.getByRole('button', { name: /写真追加/ })).toBeInTheDocument()
  })

  it('opens dialog when trigger button is clicked', async () => {
    const user = userEvent.setup()
    render(<PhotoUpload {...defaultProps} />)
    
    const triggerButton = screen.getByRole('button', { name: /写真追加/ })
    await user.click(triggerButton)
    
    expect(screen.getByText('写真をアップロード')).toBeInTheDocument()
    expect(screen.getByText('栽培の様子を写真で記録しましょう（最大10MB、複数選択可）')).toBeInTheDocument()
  })

  it('handles file selection', async () => {
    const user = userEvent.setup()
    render(<PhotoUpload {...defaultProps} />)
    
    // ダイアログを開く
    const triggerButton = screen.getByRole('button', { name: /写真追加/ })
    await user.click(triggerButton)
    
    // ファイル入力要素を取得
    const fileInput = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement
    
    // テスト用のファイルを作成
    const testFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    
    // ファイルを選択
    await user.upload(fileInput, testFile)
    
    await waitFor(() => {
      expect(screen.getByText('選択された写真')).toBeInTheDocument()
      expect(screen.getByText('test.jpg')).toBeInTheDocument()
    })
  })

  it('validates file types', async () => {
    const user = userEvent.setup()
    render(<PhotoUpload {...defaultProps} />)
    
    await user.click(screen.getByRole('button', { name: /写真追加/ }))
    
    const fileInput = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement
    const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' })
    
    await user.upload(fileInput, invalidFile)
    
    expect(window.alert).toHaveBeenCalledWith('test.txt は画像ファイルではありません')
  })

  it('validates file size', async () => {
    const user = userEvent.setup()
    render(<PhotoUpload {...defaultProps} />)
    
    await user.click(screen.getByRole('button', { name: /写真追加/ }))
    
    const fileInput = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement
    
    // 11MB のファイルを作成（10MB制限を超える）
    const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' })
    
    await user.upload(fileInput, largeFile)
    
    expect(window.alert).toHaveBeenCalledWith('large.jpg のサイズが大きすぎます（10MB以下にしてください）')
  })

  it('allows removing selected files', async () => {
    const user = userEvent.setup()
    render(<PhotoUpload {...defaultProps} />)
    
    await user.click(screen.getByRole('button', { name: /写真追加/ }))
    
    const fileInput = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement
    const testFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    
    await user.upload(fileInput, testFile)
    
    await waitFor(() => {
      expect(screen.getByText('test.jpg')).toBeInTheDocument()
    })
    
    // 削除ボタンをクリック
    const removeButton = screen.getByRole('button', { name: '' }) // X button
    await user.click(removeButton)
    
    await waitFor(() => {
      expect(screen.queryByText('test.jpg')).not.toBeInTheDocument()
      expect(screen.queryByText('選択された写真')).not.toBeInTheDocument()
    })
  })

  it('handles description and tags input', async () => {
    const user = userEvent.setup()
    render(<PhotoUpload {...defaultProps} />)
    
    await user.click(screen.getByRole('button', { name: /写真追加/ }))
    
    const descriptionTextarea = screen.getByLabelText('説明（任意）')
    const tagsInput = screen.getByLabelText('タグ（任意）')
    
    await user.type(descriptionTextarea, 'テスト写真の説明')
    await user.type(tagsInput, '花, 葉, 成長')
    
    expect(descriptionTextarea).toHaveValue('テスト写真の説明')
    expect(tagsInput).toHaveValue('花, 葉, 成長')
  })

  it('uploads files successfully', async () => {
    const user = userEvent.setup()
    const mockOnUploadSuccess = jest.fn()
    
    // Mock successful upload - get the module reference
    const { supabase } = require('@/lib/supabase')
    const mockUpload = supabase.storage.from().upload as jest.Mock
    mockUpload.mockResolvedValue({ data: { path: 'test-path' }, error: null })
    
    const mockInsert = supabase.from().insert as jest.Mock
    mockInsert.mockResolvedValue({ error: null })
    
    render(<PhotoUpload {...defaultProps} onUploadSuccess={mockOnUploadSuccess} />)
    
    await user.click(screen.getByRole('button', { name: /写真追加/ }))
    
    // ファイルを選択
    const fileInput = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement
    const testFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    await user.upload(fileInput, testFile)
    
    await waitFor(() => {
      expect(screen.getByText('1枚をアップロード')).toBeInTheDocument()
    })
    
    // アップロードボタンをクリック
    const uploadButton = screen.getByRole('button', { name: /1枚をアップロード/ })
    await user.click(uploadButton)
    
    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalled()
      expect(mockInsert).toHaveBeenCalled()
      expect(window.alert).toHaveBeenCalledWith('1枚の写真をアップロードしました！')
      expect(mockOnUploadSuccess).toHaveBeenCalled()
    })
  })

  it('handles upload errors gracefully', async () => {
    const user = userEvent.setup()
    
    // Mock failed upload
    const { supabase } = require('@/lib/supabase')
    const mockUpload = supabase.storage.from().upload as jest.Mock
    mockUpload.mockRejectedValue(new Error('Upload failed'))
    
    render(<PhotoUpload {...defaultProps} />)
    
    await user.click(screen.getByRole('button', { name: /写真追加/ }))
    
    const fileInput = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement
    const testFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    await user.upload(fileInput, testFile)
    
    const uploadButton = screen.getByRole('button', { name: /1枚をアップロード/ })
    await user.click(uploadButton)
    
    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('アップロードに失敗しました。もう一度お試しください。')
    })
  })

  it('shows uploading state', async () => {
    const user = userEvent.setup()
    
    // Mock slow upload
    const { supabase } = require('@/lib/supabase')
    const mockUpload = supabase.storage.from().upload as jest.Mock
    mockUpload.mockImplementation(() => new Promise(resolve => 
      setTimeout(() => resolve({ data: { path: 'test-path' }, error: null }), 1000)
    ))
    
    render(<PhotoUpload {...defaultProps} />)
    
    await user.click(screen.getByRole('button', { name: /写真追加/ }))
    
    const fileInput = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement
    const testFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    await user.upload(fileInput, testFile)
    
    const uploadButton = screen.getByRole('button', { name: /1枚をアップロード/ })
    await user.click(uploadButton)
    
    // アップロード中の表示をチェック
    expect(screen.getByText('アップロード中...')).toBeInTheDocument()
    expect(uploadButton).toBeDisabled()
  })

  it('handles drag and drop', async () => {
    render(<PhotoUpload {...defaultProps} />)
    
    await userEvent.click(screen.getByRole('button', { name: /写真追加/ }))
    
    const dropZone = screen.getByText('クリックまたはドラッグ＆ドロップで写真を追加').closest('div')
    
    const testFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    const dataTransfer = {
      files: [testFile]
    }
    
    fireEvent.dragOver(dropZone!, { dataTransfer })
    fireEvent.drop(dropZone!, { dataTransfer })
    
    await waitFor(() => {
      expect(screen.getByText('選択された写真')).toBeInTheDocument()
      expect(screen.getByText('test.jpg')).toBeInTheDocument()
    })
  })

  it('closes dialog when cancel is clicked', async () => {
    const user = userEvent.setup()
    render(<PhotoUpload {...defaultProps} />)
    
    await user.click(screen.getByRole('button', { name: /写真追加/ }))
    
    const cancelButton = screen.getByRole('button', { name: 'キャンセル' })
    await user.click(cancelButton)
    
    await waitFor(() => {
      expect(screen.queryByText('写真をアップロード')).not.toBeInTheDocument()
    })
  })

  it('disables upload button when no files selected', async () => {
    const user = userEvent.setup()
    render(<PhotoUpload {...defaultProps} />)
    
    await user.click(screen.getByRole('button', { name: /写真追加/ }))
    
    const uploadButton = screen.getByRole('button', { name: /0枚をアップロード/ })
    expect(uploadButton).toBeDisabled()
  })
})