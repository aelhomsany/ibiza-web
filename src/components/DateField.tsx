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
 * Shared native date picker. The calendar opens when the user clicks anywhere in
 * the box (not just the icon), and manual keyboard entry is blocked so a date can
 * only be chosen from the calendar popup. Use this for EVERY date picker in the app.
 */
export const DateField = forwardRef<HTMLInputElement, DateFieldProps>(
  function DateField(
    { value, onChange, onClick, onFocus, onKeyDown, className, ...rest },
    ref,
  ) {
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
        onFocus={(e) => {
          openPicker(e.currentTarget)
          onFocus?.(e)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openPicker(e.currentTarget)
          } else if (e.key !== 'Tab' && e.key !== 'Escape') {
            // Block manual typing — dates come from the calendar only.
            e.preventDefault()
          }
          onKeyDown?.(e)
        }}
      />
    )
  },
)
