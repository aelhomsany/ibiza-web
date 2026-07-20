import type { KeyboardEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

const KEYBOARD_SCROLL_STEP = 96

type HorizontalScrollRegionProps = {
  children: ReactNode
  className?: string
  describedById: string
  labelledBy: string
  testId?: string
}

export function HorizontalScrollRegion({
  children,
  className = 'table-wrap',
  describedById,
  labelledBy,
  testId,
}: HorizontalScrollRegionProps) {
  const { t, i18n } = useTranslation('layout')

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
    const physicalDirection = event.key === 'ArrowRight' ? 1 : -1
    const logicalDirection = i18n.dir() === 'rtl' ? -physicalDirection : physicalDirection
    region.scrollLeft += logicalDirection * KEYBOARD_SCROLL_STEP
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
        {t('tableRegion.scrollHint')}
      </span>
    </div>
  )
}
