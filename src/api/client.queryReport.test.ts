import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearAccessToken } from '../auth/tokenStorage'
import {
  ApiError,
  createReportExport,
  downloadReportExport,
  getCapabilityAccess,
  getReportExport,
  listReportExports,
  queryReport,
  retryReportExport,
} from './client'

/**
 * The Report Center suite stubs `queryReport` itself, so nothing there ever executes
 * this body — a typo in the path or the wrong verb would ship green. These cases pin
 * the wire contract instead of the caller.
 */
describe('queryReport', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    clearAccessToken()
  })

  it('POSTs the schema-1 payload to the definition-scoped query route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ definitionKey: 'LEAVE_USAGE', rows: [], total: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const payload = {
      schemaVersion: 1,
      timezone: 'America/New_York',
      from: '2026-08-01',
      to: '2026-08-24',
      sort: 'chargedDayCount',
      direction: 'DESC',
      page: 0,
    }

    await expect(queryReport('LEAVE_USAGE', payload)).resolves.toEqual(
      expect.objectContaining({ definitionKey: 'LEAVE_USAGE' }),
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/reports/LEAVE_USAGE/query',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    )
  })

  it('surfaces a validation-failed problem document as an ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 400,
            title: 'Bad Request',
            detail: 'Leave Usage requires both from and to',
          }),
          { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )

    await expect(
      queryReport('LEAVE_USAGE', { schemaVersion: 1, page: 0 }),
    ).rejects.toMatchObject({
      status: 400,
      problem: { detail: 'Leave Usage requires both from and to' },
    })
  })
})

describe('getCapabilityAccess', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    clearAccessToken()
  })

  it('GETs the catalog gate for the named capability', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          capability: 'ADVANCED_REPORTING',
          availability: 'AVAILABLE',
          allowed: true,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(getCapabilityAccess('ADVANCED_REPORTING')).resolves.toMatchObject({
      availability: 'AVAILABLE',
    })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/billing/capabilities/ADVANCED_REPORTING/access',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('rejects with a 403 ApiError when the catalog has not promoted the capability', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 403,
            title: 'Forbidden',
            detail: 'This capability is not available. Compare plans or contact Sales.',
          }),
          { status: 403, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )

    await expect(getCapabilityAccess('ADVANCED_REPORTING')).rejects.toBeInstanceOf(ApiError)
  })
})

describe('report export wire contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    clearAccessToken()
  })

  it('uses the definition-scoped create route and owned lifecycle routes', async () => {
    const response = {
      id: 'export-1',
      definitionKey: 'BALANCE_SNAPSHOT',
      status: 'QUEUED',
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(response), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify([response]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response('userName\r\nJordan Lee\r\n', {
        status: 200,
        headers: { 'Content-Type': 'text/csv' },
      }))
    vi.stubGlobal('fetch', fetchMock)
    const payload = {
      format: 'CSV' as const,
      query: { schemaVersion: 1, timezone: 'UTC', page: 0 },
    }

    await createReportExport('BALANCE_SNAPSHOT', payload)
    await listReportExports()
    await getReportExport('export-1')
    await retryReportExport('export-1')
    await expect(downloadReportExport('export-1')).resolves.toBeInstanceOf(Blob)

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/reports/BALANCE_SNAPSHOT/exports',
      '/api/v1/reports/exports',
      '/api/v1/reports/exports/export-1',
      '/api/v1/reports/exports/export-1/retry',
      '/api/v1/reports/exports/export-1/download',
    ])
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify(payload),
    })
  })
})
