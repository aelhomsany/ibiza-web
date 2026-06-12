import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { DateField } from './DateField'

describe('DateField', () => {
  it('renders a native date input', () => {
    render(
      <DateField value="2026-06-06" onChange={vi.fn()} aria-label="Test date" />,
    )
    const input = screen.getByLabelText('Test date')
    expect(input).toHaveAttribute('type', 'date')
    expect(input).toHaveValue('2026-06-06')
  })

  it('blocks manual typing so dates can only come from the calendar', () => {
    render(<DateField value="" onChange={vi.fn()} aria-label="Test date" />)
    const input = screen.getByLabelText('Test date')
    // fireEvent returns false when the event's default was prevented.
    expect(fireEvent.keyDown(input, { key: '5' })).toBe(false)
    expect(fireEvent.keyDown(input, { key: 'a' })).toBe(false)
  })

  it('allows navigation keys (Tab / Escape)', () => {
    render(<DateField value="" onChange={vi.fn()} aria-label="Test date" />)
    const input = screen.getByLabelText('Test date')
    expect(fireEvent.keyDown(input, { key: 'Tab' })).toBe(true)
    expect(fireEvent.keyDown(input, { key: 'Escape' })).toBe(true)
  })

  it('emits the selected value via onChange', () => {
    const onChange = vi.fn()
    render(<DateField value="" onChange={onChange} aria-label="Test date" />)
    fireEvent.change(screen.getByLabelText('Test date'), {
      target: { value: '2026-07-04' },
    })
    expect(onChange).toHaveBeenCalledWith('2026-07-04')
  })
})
