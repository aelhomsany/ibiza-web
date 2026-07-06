import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import './date-field.css'

type DateFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'onChange' | 'value'
> & {
  value: string
  onChange: (value: string) => void
}

function openPicker(el: HTMLInputElement | null) {
  try {
    // showPicker opens the native calendar; only valid under a user gesture and
    // unsupported in some environments (e.g. jsdom) — ignore failures.
    el?.showPicker?.()
  } catch {
    /* no-op */
  }
}

/**
 * Shared native date picker. Clicking anywhere in the box opens the calendar
 * popup, and the input keeps the browser's native keyboard editing (arrow keys
 * per date segment, typed digits) so keyboard and assistive-tech users are not
 * forced through the picker. Use this for EVERY date picker in the app.
 */
export const DateField = forwardRef<HTMLInputElement, DateFieldProps>(
  function DateField({ value, onChange, onClick, onKeyDown, className, ...rest }, ref) {
    return (
      <input
        {...rest}
        ref={ref}
        type="date"
        value={value}
        className={['date-field', className].filter(Boolean).join(' ')}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => {
          openPicker(e.currentTarget)
          onClick?.(e)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            // Enter/Space opens the calendar instead of submitting the form.
            e.preventDefault()
            openPicker(e.currentTarget)
          }
          onKeyDown?.(e)
        }}
      />
    )
  },
)
