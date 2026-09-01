import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from 'react'

import { MoreHorizontalIcon } from './icons'
import './row-actions-menu.css'

export type RowAction = {
  id: string
  label: string
  /**
   * Accessible name, when the visible label needs the row's subject to stand on
   * its own ("Deactivate Annual Leave" rather than "Deactivate").
   */
  ariaLabel?: string
  onSelect: () => void
  disabled?: boolean
  /** Renders in the error colour — for actions that take something away. */
  destructive?: boolean
  testId?: string
}

type Props = {
  /** Accessible name of the trigger. Name the row, not just the verb. */
  label: string
  actions: RowAction[]
  /** Accessible name of the panel; falls back to the trigger's label. */
  menuLabel?: string
  testId?: string
}

/**
 * Secondary row actions behind one "…" trigger.
 *
 * Settings lists put every action on every row, so a five-row list shipped
 * twenty-five buttons and the primary action had nothing to stand out against.
 * The frequent actions stay in the row; the rest live here.
 *
 * Keyboard and focus behaviour mirrors the header's UserMenu, which is the
 * house pattern but too header-specific to reuse directly.
 */
export function RowActionsMenu({ label, actions, menuLabel, testId }: Props) {
  const [open, setOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [pendingFocus, setPendingFocus] = useState<number | null>(null)
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({})
  const containerRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const panelId = useId()

  const close = useCallback((returnFocus = true) => {
    setOpen(false)
    setFocusedIndex(-1)
    if (returnFocus) {
      triggerRef.current?.focus()
    }
  }, [])

  const focusItem = useCallback(
    (index: number) => {
      const total = actions.length
      if (total === 0) {
        return
      }
      const nextIndex = ((index % total) + total) % total
      setFocusedIndex(nextIndex)
      itemRefs.current[nextIndex]?.focus()
    },
    [actions.length],
  )

  /**
   * The panel is positioned against the viewport rather than the trigger, because
   * a row menu inside a horizontally scrolling table would otherwise be clipped by
   * that region: `overflow-x: auto` clips the block axis too. Fixed positioning
   * escapes the ancestor, so the offsets have to be measured here.
   */
  const positionPanel = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) {
      return
    }
    const rect = trigger.getBoundingClientRect()
    const gap = 4
    // Enough to decide whether the panel fits below; the real height only matters
    // for the flip, and one item is 44px with 8px of panel padding either side.
    const estimatedHeight = Math.min(actions.length * 44 + 16, 320)
    const spaceBelow = window.innerHeight - rect.bottom
    const flipUp = spaceBelow < estimatedHeight + gap && rect.top > spaceBelow
    const rtl = getComputedStyle(trigger).direction === 'rtl'
    setPanelStyle({
      ...(flipUp
        ? { bottom: window.innerHeight - rect.top + gap }
        : { top: rect.bottom + gap }),
      // The panel's inline-end lines up with the trigger's, whichever side that is.
      ...(rtl ? { left: rect.left } : { right: window.innerWidth - rect.right }),
    })
  }, [actions.length])

  /**
   * Open, optionally focusing an item. The items do not exist until the panel
   * renders, so the focus is deferred to an effect rather than attempted here.
   */
  const openMenu = useCallback(
    (focusIndex: number | null = 0) => {
      positionPanel()
      setOpen(true)
      setFocusedIndex(focusIndex ?? -1)
      setPendingFocus(focusIndex)
    },
    [positionPanel],
  )

  useEffect(() => {
    if (!open || pendingFocus === null) {
      return
    }
    focusItem(pendingFocus)
    setPendingFocus(null)
  }, [open, pendingFocus, focusItem])

  useEffect(() => {
    if (!open) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        // A click elsewhere is not a request to come back here, so the trigger
        // does not steal focus from whatever was clicked.
        close(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
      }
    }

    // The offsets are measured against the viewport, so anything that moves the
    // trigger makes them stale. Re-measure rather than close: clicking the trigger
    // can itself scroll it into view, and a menu that shuts on its own opening
    // click is worse than one that follows its row.
    function handleViewportChange() {
      positionPanel()
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [open, close, positionPanel])

  function handleBlur(event: React.FocusEvent<HTMLDivElement>) {
    if (!open) {
      return
    }
    const nextTarget = event.relatedTarget as Node | null
    if (!nextTarget || !containerRef.current?.contains(nextTarget)) {
      setOpen(false)
      setFocusedIndex(-1)
    }
  }

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (open) {
        close()
      } else {
        openMenu()
      }
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (open) {
        focusItem(focusedIndex + 1)
      } else {
        openMenu()
      }
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (open) {
        focusItem(focusedIndex - 1)
      } else {
        // Opening upward lands on the last item, matching the arrow's direction.
        openMenu(actions.length - 1)
      }
    }
  }

  function handleItemKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusItem(index + 1)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusItem(index - 1)
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      focusItem(0)
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      focusItem(actions.length - 1)
    }
  }

  function handleSelect(action: RowAction) {
    close()
    action.onSelect()
  }

  if (actions.length === 0) {
    return null
  }

  return (
    <div className="row-actions" ref={containerRef} onBlur={handleBlur}>
      <button
        ref={triggerRef}
        type="button"
        className="row-actions-trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        data-testid={testId}
        onClick={() => (open ? close() : openMenu(null))}
        onKeyDown={handleTriggerKeyDown}
      >
        <MoreHorizontalIcon size={18} />
      </button>

      {open ? (
        <div
          id={panelId}
          className="row-actions-panel"
          style={panelStyle}
          role="menu"
          aria-label={menuLabel ?? label}
          data-testid={testId ? `${testId}-panel` : undefined}
        >
          {actions.map((action, index) => (
            <button
              key={action.id}
              ref={(node) => {
                itemRefs.current[index] = node
              }}
              type="button"
              role="menuitem"
              className={
                action.destructive
                  ? 'row-actions-item is-destructive'
                  : 'row-actions-item'
              }
              aria-label={action.ariaLabel}
              tabIndex={focusedIndex === index ? 0 : -1}
              disabled={action.disabled}
              data-testid={action.testId}
              onClick={() => handleSelect(action)}
              onKeyDown={(event) => handleItemKeyDown(event, index)}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
