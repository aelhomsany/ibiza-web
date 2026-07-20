import { afterEach, describe, expect, it } from 'vitest'
import i18n from './config'
import { DEFAULT_LOCALE } from './documentLanguage'

describe('calendar namespace — plural form coverage', () => {
  afterEach(() => {
    void i18n.changeLanguage(DEFAULT_LOCALE)
  })

  it('[P1] agenda:dayLabel resolves the correct Arabic CLDR category for zero/one/two/few/many/other', async () => {
    await i18n.changeLanguage('ar')
    const cases: Array<[number, string]> = [
      [0, 'June 1، لا توجد غيابات'],
      [1, 'June 1، غياب واحد'],
      [2, 'June 1، غيابان'],
      [3, 'June 1، 3 غيابات'],
      [11, 'June 1، 11 غيابًا'],
      [100, 'June 1، 100 غياب'],
    ]
    for (const [count, expected] of cases) {
      expect(i18n.t('calendar:agenda.dayLabel', { date: 'June 1', count }), `count=${count}`).toBe(
        expected,
      )
    }
  })

  it('[P1] agenda:holidayCount resolves the correct Arabic CLDR category for zero/one/two/few/many/other', async () => {
    await i18n.changeLanguage('ar')
    const cases: Array<[number, string]> = [
      [0, 'لا توجد عطلات'],
      [1, 'عطلة واحدة'],
      [2, 'عطلتان'],
      [3, '3 عطلات'],
      [11, '11 عطلة'],
      [100, '100 عطلة'],
    ]
    for (const [count, expected] of cases) {
      expect(i18n.t('calendar:agenda.holidayCount', { count }), `count=${count}`).toBe(expected)
    }
  })

  it('[P1] agenda:workingDays resolves the correct Arabic CLDR category for zero/one/two/few/many/other', async () => {
    await i18n.changeLanguage('ar')
    const cases: Array<[number, string]> = [
      [0, 'لا توجد أيام عمل'],
      [1, 'يوم عمل واحد'],
      [2, 'يوما عمل'],
      [3, '3 أيام عمل'],
      [11, '11 يوم عمل'],
      [100, '100 يوم عمل'],
    ]
    for (const [count, expected] of cases) {
      expect(i18n.t('calendar:agenda.workingDays', { count }), `count=${count}`).toBe(expected)
    }
  })

  it('[P1] timeline:bar / barShort / coverage resolve distinct values per Arabic CLDR category', async () => {
    await i18n.changeLanguage('ar')
    const cases = [0, 1, 2, 3, 11, 100]

    const bar = cases.map((count) => i18n.t('calendar:timeline.bar', { type: 'Leave', count }))
    expect(new Set(bar).size, bar.join(' | ')).toBe(cases.length)

    const barShort = cases.map((count) => i18n.t('calendar:timeline.barShort', { count }))
    expect(new Set(barShort).size, barShort.join(' | ')).toBe(cases.length)

    const coverage = cases.map((count) =>
      i18n.t('calendar:timeline.coverage', { count, days: 'Mon, Tue' }),
    )
    expect(new Set(coverage).size, coverage.join(' | ')).toBe(cases.length)
  })

  it('[P1] English dayLabel uses the _zero override for count 0, singular for 1, plural otherwise', async () => {
    await i18n.changeLanguage('en')
    expect(i18n.t('calendar:agenda.dayLabel', { date: 'June 1', count: 0 })).toBe(
      'June 1, no absences',
    )
    expect(i18n.t('calendar:agenda.dayLabel', { date: 'June 1', count: 1 })).toBe(
      'June 1, 1 absence',
    )
    expect(i18n.t('calendar:agenda.dayLabel', { date: 'June 1', count: 2 })).toBe(
      'June 1, 2 absences',
    )
  })
})
