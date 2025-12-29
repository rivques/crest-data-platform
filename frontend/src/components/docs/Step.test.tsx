import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Step from './Step'

describe('Step', () => {
  it('renders step number', () => {
    render(
      <Step number={1} title="Test Step">
        <p>Step content</p>
      </Step>
    )
    
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('renders step title', () => {
    render(
      <Step number={1} title="Install Dependencies">
        <p>Content</p>
      </Step>
    )
    
    expect(screen.getByText('Install Dependencies')).toBeInTheDocument()
  })

  it('renders children content', () => {
    render(
      <Step number={1} title="Test">
        <p>This is the step content</p>
      </Step>
    )
    
    expect(screen.getByText('This is the step content')).toBeInTheDocument()
  })

  it('applies primary variant by default', () => {
    const { container } = render(
      <Step number={1} title="Test">
        <p>Content</p>
      </Step>
    )
    
    const numberBadge = container.querySelector('.bg-primary-100')
    expect(numberBadge).toBeInTheDocument()
  })

  it('applies orange variant when specified', () => {
    const { container } = render(
      <Step number={1} title="Test" variant="orange">
        <p>Content</p>
      </Step>
    )
    
    const numberBadge = container.querySelector('.bg-orange-100')
    expect(numberBadge).toBeInTheDocument()
  })

  it('renders complex children', () => {
    render(
      <Step number={3} title="Complex Step">
        <div>
          <p>Paragraph one</p>
          <ul>
            <li>Item one</li>
            <li>Item two</li>
          </ul>
        </div>
      </Step>
    )
    
    expect(screen.getByText('Paragraph one')).toBeInTheDocument()
    expect(screen.getByText('Item one')).toBeInTheDocument()
    expect(screen.getByText('Item two')).toBeInTheDocument()
  })

  it('handles large step numbers', () => {
    render(
      <Step number={99} title="Final Step">
        <p>Last step content</p>
      </Step>
    )
    
    expect(screen.getByText('99')).toBeInTheDocument()
  })
})
