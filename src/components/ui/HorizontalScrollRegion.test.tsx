import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HorizontalScrollRegion } from './HorizontalScrollRegion'

/**
 * Story 10.9 UXA-04 floor + Story 10.10 keyboard scrolling, re-homed here by the
 * Dashboard merge (2026-09-01). These three assertions used to live in
 * RecentRequestsCard.containment.atdd.test.tsx; that card dissolved into the My
 * Leaves history, and the guarantee belongs to the shared region component
 * rather than to whichever feature happens to host it — every table-wrap caller
 * (My Leaves history, Approvals recent decisions, the settings rail) inherits it
 * from here. Covers FRONTEND-VAL-055 and FRONTEND-VAL-065.
 */
function renderRegion(props: Partial<Parameters<typeof HorizontalScrollRegion>[0]> = {}) {
  return render(
    <>
      <h2 id="region-title">Leave History</h2>
      <HorizontalScrollRegion
        labelledBy="region-title"
        describedById="region-hint"
        testId="scroll-region"
        {...props}
      >
        <table>
          <tbody>
            <tr>
              <td>Annual Leave</td>
            </tr>
          </tbody>
        </table>
      </HorizontalScrollRegion>
    </>,
  )
}

/** jsdom reports every element as 0×0, so overflow has to be declared. */
function setOverflow(region: HTMLElement, scrollWidth: number, clientWidth: number) {
  Object.defineProperty(region, 'scrollWidth', { configurable: true, value: scrollWidth })
  Object.defineProperty(region, 'clientWidth', { configurable: true, value: clientWidth })
  region.scrollLeft = 0
}

describe('HorizontalScrollRegion', () => {
  it('[P1] is a focusable labelled region (role=region, tabIndex=0)', () => {
    renderRegion()

    const region = screen.getByRole('region', { name: 'Leave History' })
    expect(region).toBe(screen.getByTestId('scroll-region'))
    expect(region).toHaveClass('table-wrap')
    expect(region).toHaveAttribute('tabindex', '0')
  })

  it('[P1] scrolls on ArrowRight and back on ArrowLeft when horizontal overflow exists', () => {
    renderRegion()

    const region = screen.getByRole('region', { name: 'Leave History' })
    setOverflow(region, 640, 320)

    region.focus()
    fireEvent.keyDown(region, { key: 'ArrowRight' })
    const scrolled = region.scrollLeft
    expect(scrolled).toBeGreaterThan(0)

    fireEvent.keyDown(region, { key: 'ArrowLeft' })
    expect(region.scrollLeft).toBeLessThan(scrolled)
  })

  it('[P1] leaves the arrow keys alone when there is nothing to scroll', () => {
    // Without this the region would swallow ArrowLeft/ArrowRight from a caret or
    // a roving tabindex inside it on every non-overflowing table.
    renderRegion()

    const region = screen.getByRole('region', { name: 'Leave History' })
    setOverflow(region, 320, 320)

    region.focus()
    const event = fireEvent.keyDown(region, { key: 'ArrowRight' })

    expect(region.scrollLeft).toBe(0)
    expect(event).toBe(true) // not preventDefault()ed
  })

  it('[P1] exposes an accessible scroll hint via aria-describedby', () => {
    renderRegion()

    const region = screen.getByRole('region', { name: 'Leave History' })
    const describedBy = region.getAttribute('aria-describedby')
    expect(describedBy).toBe('region-hint')

    const hint = document.getElementById(describedBy!)
    expect(hint).toHaveTextContent(/arrow keys to scroll this table/i)
  })

  it('[P2] lets a non-table caller name its own hint string', () => {
    // The settings category rail is a list of tabs; announcing "scroll this
    // table" for it would be wrong.
    renderRegion({ hintKey: 'categoryRail.scrollHint', className: 'settings-category-rail' })

    const region = screen.getByRole('region', { name: 'Leave History' })
    expect(region).toHaveClass('settings-category-rail')
    expect(document.getElementById('region-hint')).not.toHaveTextContent(/this table/i)
  })
})
