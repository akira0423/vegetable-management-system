import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '../button'

describe('Button', () => {
  it('renders correctly', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('handles click events', async () => {
    const user = userEvent.setup()
    const handleClick = jest.fn()
    
    render(<Button onClick={handleClick}>Click me</Button>)
    
    await user.click(screen.getByRole('button', { name: 'Click me' }))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('can be disabled', () => {
    const handleClick = jest.fn()
    
    render(
      <Button disabled onClick={handleClick}>
        Disabled button
      </Button>
    )
    
    const button = screen.getByRole('button', { name: 'Disabled button' })
    expect(button).toBeDisabled()
    
    fireEvent.click(button)
    expect(handleClick).not.toHaveBeenCalled()
  })

  describe('variants', () => {
    it('applies default variant styling', () => {
      render(<Button>Default</Button>)
      const button = screen.getByRole('button', { name: 'Default' })
      expect(button).toHaveClass('bg-primary', 'text-primary-foreground')
    })

    it('applies destructive variant styling', () => {
      render(<Button variant="destructive">Delete</Button>)
      const button = screen.getByRole('button', { name: 'Delete' })
      expect(button).toHaveClass('bg-destructive', 'text-destructive-foreground')
    })

    it('applies outline variant styling', () => {
      render(<Button variant="outline">Outline</Button>)
      const button = screen.getByRole('button', { name: 'Outline' })
      expect(button).toHaveClass('border', 'border-input', 'bg-background')
    })

    it('applies secondary variant styling', () => {
      render(<Button variant="secondary">Secondary</Button>)
      const button = screen.getByRole('button', { name: 'Secondary' })
      expect(button).toHaveClass('bg-secondary', 'text-secondary-foreground')
    })

    it('applies ghost variant styling', () => {
      render(<Button variant="ghost">Ghost</Button>)
      const button = screen.getByRole('button', { name: 'Ghost' })
      expect(button).toHaveClass('hover:bg-accent', 'hover:text-accent-foreground')
    })

    it('applies link variant styling', () => {
      render(<Button variant="link">Link</Button>)
      const button = screen.getByRole('button', { name: 'Link' })
      expect(button).toHaveClass('text-primary', 'underline-offset-4')
    })
  })

  describe('sizes', () => {
    it('applies default size styling', () => {
      render(<Button>Default size</Button>)
      const button = screen.getByRole('button', { name: 'Default size' })
      expect(button).toHaveClass('h-10', 'px-4', 'py-2')
    })

    it('applies small size styling', () => {
      render(<Button size="sm">Small</Button>)
      const button = screen.getByRole('button', { name: 'Small' })
      expect(button).toHaveClass('h-9', 'px-3')
    })

    it('applies large size styling', () => {
      render(<Button size="lg">Large</Button>)
      const button = screen.getByRole('button', { name: 'Large' })
      expect(button).toHaveClass('h-11', 'px-8')
    })

    it('applies icon size styling', () => {
      render(<Button size="icon" aria-label="icon button">Icon</Button>)
      const button = screen.getByRole('button', { name: 'icon button' })
      expect(button).toHaveClass('h-10', 'w-10')
    })
  })

  it('applies custom className', () => {
    render(<Button className="custom-class">Custom</Button>)
    const button = screen.getByRole('button', { name: 'Custom' })
    expect(button).toHaveClass('custom-class')
  })

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLButtonElement>()
    render(<Button ref={ref}>Ref test</Button>)
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
  })

  it('spreads additional props', () => {
    render(
      <Button type="submit" data-testid="submit-button">
        Submit
      </Button>
    )
    const button = screen.getByTestId('submit-button')
    expect(button).toHaveAttribute('type', 'submit')
  })

  it('renders as child component when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/test">Link button</a>
      </Button>
    )
    const link = screen.getByRole('link', { name: 'Link button' })
    expect(link).toBeInTheDocument()
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', '/test')
  })
})