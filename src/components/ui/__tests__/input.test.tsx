import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from '../input'

describe('Input', () => {
  it('renders correctly', () => {
    render(<Input data-testid="test-input" />)
    expect(screen.getByTestId('test-input')).toBeInTheDocument()
  })

  it('accepts and displays value', async () => {
    const user = userEvent.setup()
    render(<Input data-testid="test-input" />)
    
    const input = screen.getByTestId('test-input')
    await user.type(input, 'Hello World')
    
    expect(input).toHaveValue('Hello World')
  })

  it('handles onChange events', async () => {
    const user = userEvent.setup()
    const handleChange = jest.fn()
    
    render(<Input data-testid="test-input" onChange={handleChange} />)
    
    const input = screen.getByTestId('test-input')
    await user.type(input, 'test')
    
    expect(handleChange).toHaveBeenCalledTimes(4) // Called for each character
  })

  it('can be disabled', () => {
    render(<Input data-testid="test-input" disabled />)
    
    const input = screen.getByTestId('test-input')
    expect(input).toBeDisabled()
    expect(input).toHaveClass('disabled:pointer-events-none', 'disabled:cursor-not-allowed', 'disabled:opacity-50')
  })

  it('applies different input types', () => {
    const { rerender } = render(<Input data-testid="test-input" type="email" />)
    expect(screen.getByTestId('test-input')).toHaveAttribute('type', 'email')

    rerender(<Input data-testid="test-input" type="password" />)
    expect(screen.getByTestId('test-input')).toHaveAttribute('type', 'password')

    rerender(<Input data-testid="test-input" type="number" />)
    expect(screen.getByTestId('test-input')).toHaveAttribute('type', 'number')
  })

  it('applies placeholder text', () => {
    render(<Input data-testid="test-input" placeholder="Enter your name" />)
    expect(screen.getByPlaceholderText('Enter your name')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<Input data-testid="test-input" className="custom-class" />)
    const input = screen.getByTestId('test-input')
    expect(input).toHaveClass('custom-class')
  })

  it('applies default styling classes', () => {
    render(<Input data-testid="test-input" />)
    const input = screen.getByTestId('test-input')
    
    expect(input).toHaveClass(
      'flex',
      'h-9',
      'w-full',
      'rounded-md',
      'border',
      'bg-transparent',
      'px-3',
      'py-1'
    )
  })

  it('applies focus styling', () => {
    render(<Input data-testid="test-input" />)
    const input = screen.getByTestId('test-input')
    
    expect(input).toHaveClass(
      'focus-visible:border-ring',
      'focus-visible:ring-ring/50',
      'focus-visible:ring-[3px]'
    )
  })

  it('applies invalid state styling', () => {
    render(<Input data-testid="test-input" aria-invalid />)
    const input = screen.getByTestId('test-input')
    
    expect(input).toHaveClass(
      'aria-invalid:ring-destructive/20',
      'aria-invalid:border-destructive'
    )
  })

  it('handles controlled input', async () => {
    const user = userEvent.setup()
    const ControlledInput = () => {
      const [value, setValue] = React.useState('')
      return (
        <Input
          data-testid="controlled-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      )
    }

    render(<ControlledInput />)
    const input = screen.getByTestId('controlled-input')
    
    await user.type(input, 'controlled')
    expect(input).toHaveValue('controlled')
  })

  it('handles file input type', () => {
    render(<Input data-testid="file-input" type="file" />)
    const input = screen.getByTestId('file-input')
    
    expect(input).toHaveAttribute('type', 'file')
    expect(input).toHaveClass('file:inline-flex', 'file:h-7', 'file:border-0')
  })

  it('spreads additional props', () => {
    render(
      <Input
        data-testid="test-input"
        name="username"
        required
        minLength={3}
        maxLength={50}
      />
    )
    
    const input = screen.getByTestId('test-input')
    expect(input).toHaveAttribute('name', 'username')
    expect(input).toBeRequired()
    expect(input).toHaveAttribute('minLength', '3')
    expect(input).toHaveAttribute('maxLength', '50')
  })

  it('has correct data-slot attribute', () => {
    render(<Input data-testid="test-input" />)
    expect(screen.getByTestId('test-input')).toHaveAttribute('data-slot', 'input')
  })
})