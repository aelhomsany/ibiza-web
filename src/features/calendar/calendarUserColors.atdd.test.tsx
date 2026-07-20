import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CalendarAgenda } from './CalendarAgenda'
import { CalendarTimeline } from './CalendarTimeline'
import { mockCalendarMonth } from './calendarTestFixtures'

function renderTimeline(calendar = mockCalendarMonth, weekStart = '2026-06-07') {
  return render(
    <MemoryRouter>
      <CalendarTimeline
        calendar={calendar}
        weekStart={weekStart}
        weekendDays={calendar.viewerWeekendDays}
        locale="en-US"
      />
    </MemoryRouter>,
  )
}

function renderAgenda(calendar = mockCalendarMonth) {
  return render(
    <MemoryRouter>
      <CalendarAgenda
        calendar={calendar}
        month="2026-06"
        weekendDays={calendar.viewerWeekendDays}
        selectedDate={null}
        onSelectedDateChange={() => undefined}
        locale="en-US"
      />
    </MemoryRouter>,
  )
}

function withSingleAbsence(overrides: Partial<(typeof mockCalendarMonth.absences)[number]>) {
  return {
    ...mockCalendarMonth,
    absences: [
      {
        ...mockCalendarMonth.absences[0],
        requestId: 99,
        userId: 99,
        userInitials: 'ZZ',
        dateFrom: '2026-06-05',
        dateTo: '2026-06-05',
        ...overrides,
      },
    ],
  }
}

function withBothPresencesInOneWeek() {
  return {
    ...mockCalendarMonth,
    absences: [
      mockCalendarMonth.absences[0],
      {
        ...mockCalendarMonth.absences[1],
        dateFrom: '2026-06-12',
        dateTo: '2026-06-12',
      },
    ],
  }
}

describe('calendar user colors ATDD — Story 10.5', () => {
  it('[P0] timeline bars carry hash CSS variables instead of legacy palette classes', () => {
    renderTimeline()

    const bar = screen.getByTestId('calendar-event-10')
    expect(bar.style.getPropertyValue('--chip-bg')).toBeTruthy()
    expect(bar.style.getPropertyValue('--chip-fg')).toBeTruthy()
    expect(bar.className).not.toMatch(/cal-event--user-\d/)
  })

  it('[P0] an agenda user beyond the legacy 8-color palette gets a hash style', () => {
    renderAgenda(withSingleAbsence({ userColorKey: 'user-11' }))

    const card = screen.getByTestId('calendar-event-99')
    expect(card.className).not.toMatch(/cal-event--user-\d/)
    expect(card.style.getPropertyValue('--chip-bg')).toBeTruthy()
    expect(card.style.getPropertyValue('--chip-fg')).toBeTruthy()
  })

  it('[P0] users that collided under the legacy modulo palette render distinct backgrounds', () => {
    const calendar = {
      ...mockCalendarMonth,
      absences: [
        withSingleAbsence({ requestId: 98, userId: 3, userInitials: 'AA', userColorKey: 'user-3' })
          .absences[0],
        withSingleAbsence({ requestId: 99, userId: 11, userInitials: 'ZZ', userColorKey: 'user-11' })
          .absences[0],
      ],
    }
    renderAgenda(calendar)

    const cardA = screen.getByTestId('calendar-event-98')
    const cardB = screen.getByTestId('calendar-event-99')
    expect(cardA.style.getPropertyValue('--chip-bg')).toBeTruthy()
    expect(cardA.style.getPropertyValue('--chip-bg')).not.toBe(
      cardB.style.getPropertyValue('--chip-bg'),
    )
  })

  it('[P0] timeline bars retain solid OFF and dashed WFH presence selectors', () => {
    renderTimeline(withBothPresencesInOneWeek())

    const offBar = screen.getByTestId('calendar-event-10')
    const wfhBar = screen.getByTestId('calendar-event-11')

    expect(offBar).toHaveClass('calendar-timeline-bar', 'cal-event--off')
    expect(offBar).not.toHaveClass('cal-event--wfh')
    expect(wfhBar).toHaveClass('calendar-timeline-bar', 'cal-event--wfh')
    expect(wfhBar).not.toHaveClass('cal-event--off')
  })

  it('[P0] timeline avatars and bars use the same hash color for the same user', () => {
    renderTimeline()

    const bar = screen.getByTestId('calendar-event-10')
    const avatar = screen
      .getByTestId('calendar-person-2')
      .querySelector<HTMLElement>('.calendar-person-avatar')

    expect(avatar).not.toBeNull()
    expect(avatar?.style.getPropertyValue('--chip-bg')).toBe(
      bar.style.getPropertyValue('--chip-bg'),
    )
  })

  it('[P0] agenda cards and mini-month markers share the same userId hash color', () => {
    renderAgenda()

    const card = screen.getByTestId('calendar-event-10')
    const absenceDay = screen.getByTestId('calendar-day-2026-06-10')

    expect(absenceDay.style.getPropertyValue('--chip-bg')).toBe(
      card.style.getPropertyValue('--chip-bg'),
    )
  })
})
