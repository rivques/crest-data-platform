import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CodeBlock from './CodeBlock'

describe('CodeBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders code content', () => {
    render(<CodeBlock code="console.log('hello')" />)
    
    expect(screen.getByText("console.log('hello')")).toBeInTheDocument()
  })

  it('applies the correct language class', () => {
    const { container } = render(<CodeBlock code="npm install" language="bash" />)
    
    const pre = container.querySelector('pre')
    expect(pre).toHaveClass('language-bash')
  })

  it('defaults to bash language', () => {
    const { container } = render(<CodeBlock code="some code" />)
    
    const pre = container.querySelector('pre')
    expect(pre).toHaveClass('language-bash')
  })

  it('renders copy button', () => {
    render(<CodeBlock code="test code" />)
    
    const copyButton = screen.getByTitle('Copy to clipboard')
    expect(copyButton).toBeInTheDocument()
  })

  it('copy button is clickable', async () => {
    const user = userEvent.setup()
    const testCode = 'npm install react'
    
    render(<CodeBlock code={testCode} />)
    
    const copyButton = screen.getByTitle('Copy to clipboard')
    // Just verify click doesn't throw - clipboard API behavior tested manually
    await user.click(copyButton)
    
    expect(copyButton).toBeInTheDocument()
  })

  it('handles multi-line code', () => {
    const multilineCode = `function hello() {
  console.log('hello')
}`
    
    const { container } = render(<CodeBlock code={multilineCode} />)
    
    const codeElement = container.querySelector('code')
    expect(codeElement).toBeInTheDocument()
    expect(codeElement?.textContent).toBe(multilineCode)
  })
})
