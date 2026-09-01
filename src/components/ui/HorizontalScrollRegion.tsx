import type { KeyboardEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

const KEYBOARD_SCROLL_STEP = 96

type HorizontalScrollRegionProps = {
  children: ReactNode
  className?: string
  describedById: string
  labelledBy: string
  testId?: string
  /* Every caller but one wraps a table. The settings category rail does not, and a
     screen reader announcing "scroll this table" for a list of tabs is simply wrong,
     so a caller can name a different `layout` key for the hint. */
  hintKey?: string
}

export function HorizontalScrollRegion({
  children,
  className = 'table-wrap',
  describedById,
  labelledBy,
  testId,
  hintKey = 'tableRegion.scrollHint',
}: HorizontalScrollRegionProps) {
  const { t } = useTranslation('layout')

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      event.target !== event.currentTarget ||
      (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
    ) {
      return
    }

    const region = event.currentTarget
    if (region.scrollWidth <= region.clientWidth) {
      return
    }

    event.preventDefault()
    // Physical mapping: ArrowRight always moves the view right. The standardized
    // scrollLeft model (negative range in RTL) makes this correct in both directions.
    const physicalDirection = event.key === 'ArrowRight' ? 1 : -1
    region.scrollLeft += physicalDirection * KEYBOARD_SCROLL_STEP
  }

  return (
    <div
      className={className}
      data-testid={testId}
      role="region"
      tabIndex={0}
      aria-labelledby={labelledBy}
      aria-describedby={describedById}
      onKeyDown={handleKeyDown}
    >
      {children}
      <span id={describedById} className="sr-only">
        {t(hintKey)}
      </span>
    </div>
  )
}
