import { describe, expect, it } from 'vitest'
import i18n from '../../i18n/config'
import { summaryBreakdown, type ReportFormatContext } from './reportFormat'

const context: ReportFormatContext = { t: i18n.t, i18n, timeZone: 'UTC' }

describe('summaryBreakdown', () => {
  it('[P1] leads each nested group with an unlabelled count, wherever the server put it', () => {
    // rowCount deliberately last: the headline position must not depend on server key order.
    const rows = summaryBreakdown(context, {
      OFF: { allocation: 240, approvedUsage: 1, rowCount: 8 },
    })!

    expect(rows).toHaveLength(1)
    expect(rows[0].presence).toBe('OFF')
    expect(rows[0].parts[0]).toEqual({ key: 'rowCount', label: '', value: '8' })
    // The remaining metrics keep their labels and their server order.
    expect(rows[0].parts.slice(1)).toEqual([
      { key: 'allocation', label: 'Allocation', value: '240' },
      { key: 'approvedUsage', label: 'Used', value: '1' },
    ])
  })

  it('[P1] keeps a flat map as one unlabelled value part named by its row', () => {
    const rows = summaryBreakdown(context, { APPROVED: 5 })!

    expect(rows).toHaveLength(1)
    expect(rows[0].parts).toEqual([{ key: '', label: '', value: '5' }])
  })

  it('[P1] returns null for scalars and empty maps, which are not breakdowns', () => {
    expect(summaryBreakdown(context, 7)).toBeNull()
    expect(summaryBreakdown(context, {})).toBeNull()
  })
})
