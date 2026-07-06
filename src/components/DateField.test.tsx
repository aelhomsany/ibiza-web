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

  it('keeps native keyboard editing (typed digits and arrow keys)', () => {
    render(<DateField value="" onChange={vi.fn()} aria-label="Test date" />)
    const input = screen.getByLabelText('Test date')
    // fireEvent returns false when the event's default was prevented.
    expect(fireEvent.keyDown(input, { key: '5' })).toBe(true)
    expect(fireEvent.keyDown(input, { key: 'ArrowUp' })).toBe(true)
    expect(fireEvent.keyDown(input, { key: 'Tab' })).toBe(true)
    expect(fireEvent.keyDown(input, { key: 'Escape' })).toBe(true)
  })

  it('opens the calendar popup on Enter/Space instead of submitting', () => {
    const showPicker = vi.fn()
    render(<DateField value="" onChange={vi.fn()} aria-label="Test date" />)
    const input = screen.getByLabelText<HTMLInputElement>('Test date')
    input.showPicker = showPicker
    expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(false)
    expect(fireEvent.keyDown(input, { key: ' ' })).toBe(false)
    expect(showPicker).toHaveBeenCalledTimes(2)
  })

  it('opens the calendar popup on click anywhere in the box', () => {
    const showPicker = vi.fn()
    render(<DateField value="" onChange={vi.fn()} aria-label="Test date" />)
    const input = screen.getByLabelText<HTMLInputElement>('Test date')
    input.showPicker = showPicker
    fireEvent.click(input)
    expect(showPicker).toHaveBeenCalledTimes(1)
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
