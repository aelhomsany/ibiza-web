import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as apiClient from '../../api/client'
import { ApiError } from '../../api/client'
import type { ImportJobResponse, ImportRowResultPage } from '../../api/generated/types'
import { ToastProvider } from '../../components/ui/ToastProvider'
import '../../i18n/config'
import { AuthTestProvider, createMockAuthForRole } from '../../test/authTestUtils'
import { ImportWizardPage } from './ImportWizardPage'

function job(overrides: Partial<ImportJobResponse> = {}): ImportJobResponse {
  return {
    publicId: 'job-1',
    templateKey: 'PEOPLE_AND_ASSIGNMENTS',
    status: 'UPLOADED',
    fileName: undefined,
    byteSize: 0,
    rowCount: 0,
    headerColumns: [],
    acceptedCount: 0,
    rejectedCount: 0,
    warningCount: 0,
    committedCount: 0,
    validationRevision: 1,
    reconciliation: {},
    failureReason: undefined,
    // Always present on the wire (primitive boolean); the download control gates on it, and an
    // EXPIRED job's purged artifact is exactly the case it exists to hide.
    artifactAvailable: true,
    createdAt: '2026-08-27T00:00:00Z',
    updatedAt: '2026-08-27T00:00:00Z',
    ...overrides,
  } as ImportJobResponse
}

function emptyRows(): ImportRowResultPage {
  return { items: [], page: 0, size: 100, total: 0 } as ImportRowResultPage
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <AuthTestProvider value={createMockAuthForRole('HR_ADMIN')}>
            <ImportWizardPage />
          </AuthTestProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('ImportWizardPage', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'listImportJobs').mockResolvedValue({ items: [], page: 0, size: 10, total: 0 })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // IMPORT-UI-VAL-001: wizard phase transitions (start -> upload -> review), never representing
  // UPLOADED/MAPPED as migration-complete (UX-DR71).
  it('moves from the template picker through upload into row review', async () => {
    const user = userEvent.setup()
    vi.spyOn(apiClient, 'createImportJob').mockResolvedValue(job({ status: 'UPLOADED' }))
    vi.spyOn(apiClient, 'uploadImportSource').mockResolvedValue(
      job({ status: 'DRY_RUN_READY', fileName: 'people.csv', acceptedCount: 2, rejectedCount: 0, rowCount: 2 }),
    )
    vi.spyOn(apiClient, 'getImportRows').mockResolvedValue(emptyRows())

    renderPage()

    await screen.findByTestId('import-start')
    await user.click(screen.getByRole('button', { name: /start import/i }))

    const uploadSection = await screen.findByTestId('import-upload')
    const fileInput = within(uploadSection).getByLabelText(/choose csv file/i)
    const file = new File(['a,b\n1,2'], 'people.csv', { type: 'text/csv' })
    await user.upload(fileInput, file)
    await user.click(within(uploadSection).getByRole('button', { name: /^upload$/i }))

    await screen.findByTestId('import-review')
    // Never rendered as complete: UPLOADED/MAPPED never reach this assertion, and the review
    // screen itself is a distinct phase from the terminal result screen.
    expect(screen.queryByTestId('import-result')).not.toBeInTheDocument()
  })

  // IMPORT-UI-VAL-002: row-error review table renders server-provided row evidence and blocks
  // commit while any row is rejected.
  it('renders row errors and warnings without raw cell content, and blocks commit on rejects', async () => {
    vi.spyOn(apiClient, 'createImportJob').mockResolvedValue(
      job({ status: 'DRY_RUN_READY', acceptedCount: 1, rejectedCount: 1, warningCount: 0 }),
    )
    vi.spyOn(apiClient, 'getImportRows').mockResolvedValue({
      items: [
        { rowIndex: 0, sourceLine: 2, status: 'ACCEPTED', errorCodes: [], warnings: [] },
        { rowIndex: 1, sourceLine: 3, status: 'REJECTED', errorCodes: ['INVALID_ROLE'], warnings: [] },
      ],
      page: 0,
      size: 100,
      total: 2,
    } as ImportRowResultPage)

    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('import-start')
    await user.click(screen.getByRole('button', { name: /start import/i }))

    const review = await screen.findByTestId('import-review')
    expect(within(review).getByText('INVALID_ROLE')).toBeInTheDocument()
    expect(screen.getByTestId('import-review-blocked')).toBeInTheDocument()
    expect(within(review).getByRole('button', { name: /commit import/i })).toBeDisabled()
  })

  // IMPORT-UI-VAL-003: bounded poll reaches the terminal result, and download calls the artifact
  // endpoint.
  it('polls a committing job to RECONCILED and downloads the evidence', async () => {
    vi.spyOn(apiClient, 'createImportJob').mockResolvedValue(
      job({ status: 'DRY_RUN_READY', acceptedCount: 1, rejectedCount: 0 }),
    )
    vi.spyOn(apiClient, 'getImportRows').mockResolvedValue(emptyRows())
    vi.spyOn(apiClient, 'commitImportJob').mockResolvedValue(job({ status: 'COMMITTING' }))
    vi.spyOn(apiClient, 'getImportJob').mockResolvedValue(
      job({ status: 'RECONCILED', committedCount: 1, reconciliation: { committedRows: 1 } }),
    )
    const downloadSpy = vi.spyOn(apiClient, 'downloadImportArtifact').mockResolvedValue(new Blob(['csv']))
    URL.createObjectURL = vi.fn(() => 'blob:mock')
    URL.revokeObjectURL = vi.fn()

    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('import-start')
    await user.click(screen.getByRole('button', { name: /start import/i }))
    const review = await screen.findByTestId('import-review')
    await user.click(within(review).getByRole('button', { name: /commit import/i }))
    await user.click(screen.getByRole('button', { name: /confirm commit/i }))

    const result = await screen.findByTestId('import-result', {}, { timeout: 5000 })
    expect(within(result).getByTestId('import-reconciliation')).toBeInTheDocument()

    await user.click(within(result).getByRole('button', { name: /download source evidence/i }))
    await waitFor(() => expect(downloadSpy).toHaveBeenCalledWith('job-1'))
  })

  // IMPORT-UI-VAL-004: capability-unavailable renders distinct copy with no dead retry control.
  it('shows a capability-unavailable banner with no retry when DATA_IMPORT is denied', async () => {
    vi.spyOn(apiClient, 'listImportJobs').mockRejectedValue(
      new ApiError(403, { status: 403, code: 'capability-unavailable', title: 'Forbidden', detail: 'nope' }),
    )

    renderPage()

    const banner = await screen.findByTestId('import-capability-unavailable')
    expect(within(banner).queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByTestId('import-start')).not.toBeInTheDocument()
  })

  // IMPORT-UI-VAL-005 (Story 15.5 D3): a reload mid-job resumes from SERVER state. The wizard
  // must open the organization's active job rather than landing on `start`, where every create
  // 409s under the one-active-job-per-Organization guard.
  it('resumes the organization active job on mount instead of starting at the template picker', async () => {
    vi.spyOn(apiClient, 'listImportJobs').mockResolvedValue({
      items: [
        {
          publicId: 'job-7',
          templateKey: 'PEOPLE_AND_ASSIGNMENTS',
          status: 'DRY_RUN_READY',
          fileName: 'people.csv',
          rowCount: 2,
          acceptedCount: 2,
          rejectedCount: 0,
          warningCount: 0,
          artifactAvailable: true,
          createdAt: '2026-08-27T00:00:00Z',
          updatedAt: '2026-08-27T00:05:00Z',
        },
      ],
      page: 0,
      size: 10,
      total: 1,
    })
    const getSpy = vi
      .spyOn(apiClient, 'getImportJob')
      .mockResolvedValue(job({ publicId: 'job-7', status: 'DRY_RUN_READY', acceptedCount: 2 }))
    vi.spyOn(apiClient, 'getImportRows').mockResolvedValue(emptyRows())

    renderPage()

    await screen.findByTestId('import-review')
    expect(getSpy).toHaveBeenCalledWith('job-7')
    expect(screen.queryByTestId('import-start')).not.toBeInTheDocument()
  })

  // IMPORT-UI-VAL-006 (Story 15.5 D3): 409 import-job-active is never a dead end — the start
  // card surfaces the blocking job with resume and cancel controls.
  it('offers resume and cancel when creating a job returns 409 import-job-active', async () => {
    vi.spyOn(apiClient, 'listImportJobs').mockResolvedValue({
      items: [
        {
          publicId: 'job-9',
          templateKey: 'PEOPLE_AND_ASSIGNMENTS',
          status: 'COMMITTING',
          fileName: 'people.csv',
          rowCount: 2,
          acceptedCount: 2,
          rejectedCount: 0,
          warningCount: 0,
          artifactAvailable: true,
          createdAt: '2026-08-27T00:00:00Z',
          updatedAt: '2026-08-27T00:05:00Z',
        },
      ],
      page: 0,
      size: 10,
      total: 1,
    })
    // A COMMITTING job is active but not resumable-on-mount into an interactive phase; force the
    // conflict path by having the auto-resume read fail, then create.
    vi.spyOn(apiClient, 'getImportJob').mockRejectedValue(
      new ApiError(404, { status: 404, code: 'not-found', title: 'Not Found', detail: 'gone' }),
    )
    vi.spyOn(apiClient, 'createImportJob').mockRejectedValue(
      new ApiError(409, {
        status: 409,
        code: 'import-job-active',
        title: 'Conflict',
        detail: 'Organization already has an active import job',
      }),
    )
    const cancelSpy = vi
      .spyOn(apiClient, 'cancelImportJob')
      .mockResolvedValue(job({ publicId: 'job-9', status: 'CANCELLED' }))

    const user = userEvent.setup()
    renderPage()

    await screen.findByTestId('import-start')
    await user.click(screen.getByRole('button', { name: /start import/i }))

    const conflict = await screen.findByTestId('import-active-conflict')
    expect(within(conflict).getByTestId('import-active-conflict-resume')).toBeInTheDocument()
    await user.click(within(conflict).getByTestId('import-active-conflict-cancel'))
    await waitFor(() => expect(cancelSpy).toHaveBeenCalledWith('job-9'))
  })

  // IMPORT-UI-VAL-007 (Story 15.5 D4): a dead-lettered job reads differently from an ordinary
  // failure, and its failure reason is shown.
  it('distinguishes a dead-lettered job from an ordinary failure in the history table', async () => {
    vi.spyOn(apiClient, 'listImportJobs').mockResolvedValue({
      items: [
        {
          publicId: 'job-dead',
          templateKey: 'PEOPLE_AND_ASSIGNMENTS',
          status: 'FAILED',
          workStatus: 'DEAD_LETTER',
          failureReason: 'Worker exceeded the retry ceiling',
          fileName: 'people.csv',
          rowCount: 2,
          acceptedCount: 0,
          rejectedCount: 2,
          warningCount: 0,
          artifactAvailable: false,
          createdAt: '2026-08-27T00:00:00Z',
          updatedAt: '2026-08-27T00:05:00Z',
        },
        {
          publicId: 'job-failed',
          templateKey: 'PEOPLE_AND_ASSIGNMENTS',
          status: 'FAILED',
          workStatus: 'IDLE',
          failureReason: undefined,
          fileName: 'other.csv',
          rowCount: 1,
          acceptedCount: 0,
          rejectedCount: 1,
          warningCount: 0,
          artifactAvailable: true,
          createdAt: '2026-08-26T00:00:00Z',
          updatedAt: '2026-08-26T00:05:00Z',
        },
      ],
      page: 0,
      size: 10,
      total: 2,
    })

    renderPage()

    await screen.findByTestId('import-history-row-job-dead')
    expect(screen.getByTestId('import-history-dead-letter-job-dead')).toHaveTextContent(/retired/i)
    expect(screen.getByTestId('import-history-failure-job-dead')).toHaveTextContent(
      'Worker exceeded the retry ceiling',
    )
    // The ordinary failure keeps the plain status label, with no dead-letter marker.
    expect(screen.queryByTestId('import-history-dead-letter-job-failed')).not.toBeInTheDocument()
    expect(
      within(screen.getByTestId('import-history-row-job-failed')).getByText('Failed'),
    ).toBeInTheDocument()
  })

  // IMPORT-UI-VAL-008: the evidence download is gated on a terminal state that still has an
  // artifact — for an EXPIRED job the artifact is purged by definition, so the control would be
  // guaranteed to 410.
  it('hides the evidence download for an expired job', async () => {
    vi.spyOn(apiClient, 'createImportJob').mockResolvedValue(job({ status: 'EXPIRED' }))

    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('import-start')
    await user.click(screen.getByRole('button', { name: /start import/i }))

    const result = await screen.findByTestId('import-result')
    expect(within(result).queryByRole('button', { name: /download source evidence/i })).not.toBeInTheDocument()
    expect(screen.getByTestId('import-evidence-unavailable')).toBeInTheDocument()
  })

  // IMPORT-UI-VAL-009: SPA-only guard for the "up to 10 MB" promise in the upload hint. This is
  // a UX rule with no server mirror in Vitest — the server stays authoritative on the real limit.
  it('rejects an oversized file client-side without calling the upload endpoint', async () => {
    vi.spyOn(apiClient, 'createImportJob').mockResolvedValue(job({ status: 'UPLOADED' }))
    const uploadSpy = vi.spyOn(apiClient, 'uploadImportSource')

    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('import-start')
    await user.click(screen.getByRole('button', { name: /start import/i }))

    const uploadSection = await screen.findByTestId('import-upload')
    const oversized = new File(['x'], 'huge.csv', { type: 'text/csv' })
    Object.defineProperty(oversized, 'size', { value: 11 * 1024 * 1024 })
    await user.upload(within(uploadSection).getByLabelText(/choose csv file/i), oversized)

    expect(await within(uploadSection).findByText(/larger than 10 MB/i)).toBeInTheDocument()
    expect(within(uploadSection).getByRole('button', { name: /^upload$/i })).toBeDisabled()
    expect(uploadSpy).not.toHaveBeenCalled()
  })

  // IMPORT-UI-VAL-010: a failed rows load must not read as "no rows to review" — the user would
  // otherwise commit blind.
  it('surfaces a rows-load failure instead of the empty-review state', async () => {
    vi.spyOn(apiClient, 'createImportJob').mockResolvedValue(
      job({ status: 'DRY_RUN_READY', acceptedCount: 2, rejectedCount: 0 }),
    )
    vi.spyOn(apiClient, 'getImportRows').mockRejectedValue(
      new ApiError(500, { status: 500, code: 'internal', title: 'Error', detail: 'boom' }),
    )

    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('import-start')
    await user.click(screen.getByRole('button', { name: /start import/i }))

    expect(await screen.findByTestId('import-rows-error')).toBeInTheDocument()
    expect(screen.queryByTestId('import-review-empty')).not.toBeInTheDocument()
  })
})
