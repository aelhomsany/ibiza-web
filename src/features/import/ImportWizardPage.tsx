import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  ApiError,
  cancelImportJob,
  commitImportJob,
  createImportJob,
  downloadImportArtifact,
  getImportJob,
  getImportRows,
  listImportJobs,
  uploadImportSource,
  type ImportTemplateKey,
} from '../../api/client'
import type {
  ImportJobResponse,
  ImportJobSummaryResponse,
  ImportRowResultPage,
} from '../../api/generated/types'
import { HorizontalScrollRegion } from '../../components/ui/HorizontalScrollRegion'
import { LoadingState } from '../../components/ui/LoadingState'
import { Modal } from '../../components/ui/Modal'
import { CloseIcon } from '../../components/ui/icons'
import { useToast } from '../../components/ui/useToast'

const TEMPLATE_KEYS: ImportTemplateKey[] = ['PEOPLE_AND_ASSIGNMENTS', 'ENTITLEMENTS_AND_OPENING_BALANCES']

/** Statuses the worker is still moving through — the poll keeps running for these. */
const IN_FLIGHT_STATUSES = new Set(['MAPPED', 'VALIDATING', 'COMMITTING', 'COMMITTED', 'RECONCILING'])

/**
 * Every non-terminal status. The server allows one active job per Organization, so exactly one
 * history row can match; it is the job the wizard resumes into after a reload (Story 15.5 D3).
 */
const ACTIVE_STATUSES = new Set([
  'UPLOADED',
  'MAPPED',
  'VALIDATING',
  'DRY_RUN_READY',
  'COMMITTING',
  'COMMITTED',
  'RECONCILING',
])

/** Statuses the server still accepts a cancel for — past COMMITTING the write is already landing. */
const CANCELLABLE_STATUSES = new Set(['UPLOADED', 'MAPPED', 'VALIDATING', 'DRY_RUN_READY'])

const POLL_INTERVAL_MS = 2_000
/** Ten minutes at the poll interval, mirroring `ReportCenterPage`'s `EXPORT_POLL_LIMIT`. */
const POLL_LIMIT = 300
const ROW_PAGE_SIZE = 50

/** Mirrors the server-side hint in `import:upload.hint`; the server stays authoritative. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

/**
 * `crypto.randomUUID` is undefined outside secure contexts and in older Safari, and this key is
 * minted during render — an unguarded call takes the whole page down rather than degrading.
 */
function newIdempotencyKey(): string {
  const webCrypto = globalThis.crypto as Crypto | undefined
  if (webCrypto && typeof webCrypto.randomUUID === 'function') {
    return webCrypto.randomUUID()
  }
  if (webCrypto && typeof webCrypto.getRandomValues === 'function') {
    const bytes = webCrypto.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`
}

type Phase =
  | 'start'
  | 'upload'
  | 'processing'
  | 'review'
  | 'committing'
  | 'result'
  | 'failed'
  | 'cancelled'
  | 'expired'

function phaseFor(job: ImportJobResponse | null): Phase {
  if (!job) return 'start'
  switch (job.status) {
    case 'UPLOADED':
      return 'upload'
    case 'MAPPED':
    case 'VALIDATING':
      return 'processing'
    case 'DRY_RUN_READY':
      return 'review'
    case 'COMMITTING':
    case 'COMMITTED':
    case 'RECONCILING':
      return 'committing'
    case 'RECONCILED':
      return 'result'
    case 'FAILED':
      return 'failed'
    case 'CANCELLED':
      return 'cancelled'
    case 'EXPIRED':
      return 'expired'
    default:
      return 'start'
  }
}

function isDeadLettered(job: { status?: string; workStatus?: string } | null | undefined): boolean {
  return job?.status === 'FAILED' && job?.workStatus === 'DEAD_LETTER'
}

export function ImportWizardPage() {
  const { t } = useTranslation(['import', 'common'])
  const { showToast } = useToast()
  const queryClient = useQueryClient()

  const [capabilityUnavailable, setCapabilityUnavailable] = useState(false)
  const [template, setTemplate] = useState<ImportTemplateKey>(TEMPLATE_KEYS[0])
  const [job, setJob] = useState<ImportJobResponse | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [startError, setStartError] = useState<string | null>(null)
  const [commitError, setCommitError] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [openError, setOpenError] = useState<string | null>(null)
  // Set when `POST /imports` answers 409 import-job-active: the start card then offers the
  // blocking job's resume/cancel controls instead of leaving the Organization at a dead end.
  const [activeJobConflict, setActiveJobConflict] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [rowPage, setRowPage] = useState(0)
  const [polls, setPolls] = useState(0)
  // The poll budget must be one counter: `refetchInterval` and the stall banner both read this.
  // Deriving the banner from a `useEffect` on `jobStatusQuery.data` never fired for the wedged
  // job it exists for, because structural sharing keeps deeply-equal data referentially identical.
  const pollsRef = useRef(0)
  const idempotencyKeyRef = useRef(newIdempotencyKey())
  const autoResumedRef = useRef(false)

  const phase = phaseFor(job)

  const historyQuery = useQuery({
    queryKey: ['import-jobs', 'history'],
    queryFn: () => listImportJobs(undefined, 0, 10),
    retry: false,
  })

  useEffect(() => {
    if (historyQuery.error instanceof ApiError && historyQuery.error.problem.code === 'capability-unavailable') {
      setCapabilityUnavailable(true)
    }
  }, [historyQuery.error])

  const activeHistoryJob: ImportJobSummaryResponse | undefined = (historyQuery.data?.items ?? []).find(
    (item) => item.status != null && ACTIVE_STATUSES.has(item.status),
  )

  const openJobMutation = useMutation({
    mutationFn: (publicId: string) => getImportJob(publicId),
    onSuccess: (opened) => {
      setJob(opened)
      setOpenError(null)
      setStartError(null)
      setActiveJobConflict(false)
      setRowPage(0)
    },
    onError: (cause) => {
      if (cause instanceof ApiError && cause.problem.code === 'capability-unavailable') {
        setCapabilityUnavailable(true)
        return
      }
      setOpenError(
        cause instanceof ApiError ? cause.problem.detail ?? t('import:errors.openFailed') : t('import:errors.openFailed'),
      )
    },
  })

  // Story 15.5 D3: server state, not component state, decides where the wizard starts. A reload
  // mid-job would otherwise land on `start`, where creating a job 409s forever.
  useEffect(() => {
    if (autoResumedRef.current || job || !activeHistoryJob?.publicId) return
    autoResumedRef.current = true
    openJobMutation.mutate(activeHistoryJob.publicId)
  }, [activeHistoryJob?.publicId, job, openJobMutation])

  const jobStatusQuery = useQuery({
    queryKey: ['import-job', job?.publicId],
    queryFn: async () => {
      const next = await getImportJob(job!.publicId!)
      pollsRef.current += 1
      setPolls(pollsRef.current)
      return next
    },
    enabled: Boolean(job?.publicId) && IN_FLIGHT_STATUSES.has(job?.status ?? ''),
    refetchInterval: (query) =>
      query.state.error || pollsRef.current >= POLL_LIMIT ? false : POLL_INTERVAL_MS,
    retry: false,
  })

  useEffect(() => {
    if (jobStatusQuery.data) {
      setJob(jobStatusQuery.data)
    }
  }, [jobStatusQuery.data])

  useEffect(() => {
    pollsRef.current = 0
    setPolls(0)
  }, [job?.publicId])

  const pollExhausted = polls >= POLL_LIMIT

  // Refresh the history list once a job settles into a terminal status the poll stops chasing.
  useEffect(() => {
    if (phase === 'result' || phase === 'failed') {
      void queryClient.invalidateQueries({ queryKey: ['import-jobs', 'history'] })
    }
  }, [phase, queryClient])

  const rowsQuery = useQuery({
    queryKey: ['import-job-rows', job?.publicId, rowPage],
    queryFn: () => getImportRows(job!.publicId!, rowPage, ROW_PAGE_SIZE),
    enabled: Boolean(job?.publicId) && phase === 'review',
  })

  const startMutation = useMutation({
    mutationFn: () => createImportJob(idempotencyKeyRef.current, template),
    onSuccess: (created) => {
      setJob(created)
      setStartError(null)
      setActiveJobConflict(false)
    },
    onError: (cause) => {
      if (cause instanceof ApiError && cause.problem.code === 'capability-unavailable') {
        setCapabilityUnavailable(true)
        return
      }
      if (cause instanceof ApiError && cause.problem.code === 'import-job-active') {
        // The blocking job is discoverable from the list endpoint; refetch so the recovery
        // controls below render against a fresh row rather than a stale one.
        setActiveJobConflict(true)
        setStartError(null)
        void queryClient.invalidateQueries({ queryKey: ['import-jobs', 'history'] })
        return
      }
      setStartError(
        cause instanceof ApiError ? cause.problem.detail ?? t('import:errors.startFailed') : t('import:errors.startFailed'),
      )
    },
  })

  const uploadMutation = useMutation({
    mutationFn: (selected: File) => uploadImportSource(job!.publicId!, selected),
    onSuccess: (updated) => {
      setJob(updated)
      setUploadError(null)
      setFile(null)
    },
    onError: (cause) => {
      setUploadError(
        cause instanceof ApiError ? cause.problem.detail ?? t('import:errors.uploadFailed') : t('import:errors.uploadFailed'),
      )
    },
  })

  const commitMutation = useMutation({
    mutationFn: () => commitImportJob(job!.publicId!),
    onSuccess: (updated) => {
      setJob(updated)
      setConfirmOpen(false)
      setCommitError(null)
      showToast(t('import:actions.commit'))
    },
    onError: (cause) => {
      setConfirmOpen(false)
      setCommitError(
        cause instanceof ApiError ? cause.problem.detail ?? t('import:errors.commitFailed') : t('import:errors.commitFailed'),
      )
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (publicId: string) => cancelImportJob(publicId),
    onSuccess: (updated, publicId) => {
      // Cancelling from a history row must not hijack the wizard onto a job the user never opened.
      if (!job || job.publicId === publicId) setJob(updated)
      setCancelError(null)
      setActiveJobConflict(false)
      void queryClient.invalidateQueries({ queryKey: ['import-jobs', 'history'] })
    },
    onError: (cause) => {
      if (cause instanceof ApiError && cause.problem.code === 'capability-unavailable') {
        setCapabilityUnavailable(true)
        return
      }
      setCancelError(
        cause instanceof ApiError ? cause.problem.detail ?? t('import:errors.cancelFailed') : t('import:errors.cancelFailed'),
      )
    },
  })

  const chooseFile = (selected: File | null) => {
    setUploadError(null)
    if (!selected) {
      setFile(null)
      return
    }
    // SPA-only UX guard for the promise in `import:upload.hint` — a 200 MB file would otherwise
    // upload in full before the server rejected it. Row count stays server-side.
    const looksLikeCsv =
      selected.name.toLowerCase().endsWith('.csv') ||
      selected.type === 'text/csv' ||
      selected.type === 'application/csv' ||
      selected.type === ''
    if (!looksLikeCsv) {
      setFile(null)
      setUploadError(t('import:upload.wrongType'))
      return
    }
    if (selected.size > MAX_UPLOAD_BYTES) {
      setFile(null)
      setUploadError(t('import:upload.tooLarge'))
      return
    }
    setFile(selected)
  }

  const handleDownload = async () => {
    if (!job?.publicId) return
    setDownloadError(null)
    try {
      const artifact = await downloadImportArtifact(job.publicId)
      const url = URL.createObjectURL(artifact)
      const link = document.createElement('a')
      link.href = url
      link.download = job.fileName ?? 'import.csv'
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch (cause) {
      if (cause instanceof ApiError && cause.problem.code === 'capability-unavailable') {
        setCapabilityUnavailable(true)
        return
      }
      setDownloadError(
        cause instanceof ApiError && cause.status === 410
          ? t('import:errors.evidenceExpired')
          : cause instanceof ApiError
            ? cause.problem.detail ?? t('import:errors.downloadFailed')
            : t('import:errors.downloadFailed'),
      )
    }
  }

  const startAnother = () => {
    setJob(null)
    setFile(null)
    setRowPage(0)
    setStartError(null)
    setUploadError(null)
    setCommitError(null)
    setCancelError(null)
    setDownloadError(null)
    setOpenError(null)
    setActiveJobConflict(false)
    idempotencyKeyRef.current = newIdempotencyKey()
    void queryClient.invalidateQueries({ queryKey: ['import-jobs', 'history'] })
  }

  if (capabilityUnavailable) {
    return (
      <div className="page page-wide" data-testid="import-page">
        <header className="page-header">
          <h1 className="page-title">{t('import:title')}</h1>
        </header>
        <section className="card" role="alert" data-testid="import-capability-unavailable">
          <h2>{t('import:capabilityUnavailable.title')}</h2>
          <p>{t('import:capabilityUnavailable.body')}</p>
        </section>
      </div>
    )
  }

  const rows: ImportRowResultPage | undefined = rowsQuery.data
  const rowTotal = rows?.total ?? 0
  const rowSize = rows?.size && rows.size > 0 ? rows.size : ROW_PAGE_SIZE
  const rowTotalPages = Math.max(1, Math.ceil(rowTotal / rowSize))

  const historySummary = (historyQuery.data?.items ?? []).find((item) => item.publicId === job?.publicId)
  const reconciliationEntries = Object.entries(job?.reconciliation ?? {})
  // `cancelled` purges nothing yet but has no artifact to fetch, and for `expired` the artifact is
  // purged by definition — rendering the control there guarantees a 410. The job's own
  // `artifactAvailable` is authoritative; the history row is only a fallback for a job we are
  // showing before its detail has loaded.
  const evidenceDownloadable =
    (phase === 'result' || phase === 'failed') &&
    (job?.artifactAvailable ?? historySummary?.artifactAvailable ?? false)

  return (
    <div className="page page-wide" data-testid="import-page">
      <header className="page-header">
        <div>
          <p className="reports-eyebrow">{t('import:eyebrow')}</p>
          <h1 className="page-title">{t('import:title')}</h1>
          <p className="page-sub">{t('import:subtitle')}</p>
        </div>
      </header>

      {phase === 'start' && (
        <section className="card" aria-labelledby="import-start-title" data-testid="import-start">
          <h2 id="import-start-title">{t('import:templates.label')}</h2>
          <div className="form-group">
            <label htmlFor="import-template">{t('import:templates.label')}</label>
            <select
              id="import-template"
              value={template}
              disabled={startMutation.isPending}
              onChange={(event) => setTemplate(event.target.value as ImportTemplateKey)}
            >
              {TEMPLATE_KEYS.map((key) => (
                <option key={key} value={key}>
                  {t(`import:templates.${key}`)}
                </option>
              ))}
            </select>
          </div>
          {startError && (
            <p className="field-error" role="alert">
              {startError}
            </p>
          )}
          {activeJobConflict && (
            <div className="field-error" role="alert" data-testid="import-active-conflict">
              <p>{t('import:activeJob.body')}</p>
              {activeHistoryJob?.publicId ? (
                <div className="reports-filter-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={openJobMutation.isPending}
                    data-testid="import-active-conflict-resume"
                    onClick={() => openJobMutation.mutate(activeHistoryJob.publicId!)}
                  >
                    {t('import:actions.resume')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={cancelMutation.isPending}
                    data-testid="import-active-conflict-cancel"
                    onClick={() => cancelMutation.mutate(activeHistoryJob.publicId!)}
                  >
                    {t('import:actions.cancelImport')}
                  </button>
                </div>
              ) : (
                <p>{t('import:activeJob.notFound')}</p>
              )}
            </div>
          )}
          {openError && (
            <p className="field-error" role="alert">
              {openError}
            </p>
          )}
          <button
            type="button"
            className="btn btn-primary"
            disabled={startMutation.isPending}
            onClick={() => startMutation.mutate()}
          >
            {startMutation.isPending ? t('import:actions.starting') : t('import:actions.start')}
          </button>
        </section>
      )}

      {phase === 'upload' && job && (
        <section className="card" aria-labelledby="import-upload-title" data-testid="import-upload">
          <h2 id="import-upload-title">{t('import:upload.title')}</h2>
          <p>{t('import:upload.hint')}</p>
          <div className="form-group">
            <label htmlFor="import-file">{t('import:actions.chooseFile')}</label>
            <input
              id="import-file"
              type="file"
              accept=".csv,text/csv"
              disabled={uploadMutation.isPending}
              onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
            />
          </div>
          {uploadError && (
            <p className="field-error" role="alert">
              {uploadError}
            </p>
          )}
          <div className="reports-filter-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!file || uploadMutation.isPending}
              onClick={() => {
                if (!file) {
                  setUploadError(t('import:upload.noFile'))
                  return
                }
                uploadMutation.mutate(file)
              }}
            >
              {uploadMutation.isPending ? t('import:actions.uploading') : t('import:actions.upload')}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              disabled={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate(job.publicId!)}
            >
              {cancelMutation.isPending ? t('import:actions.cancelling') : t('import:actions.cancelImport')}
            </button>
          </div>
          {cancelError && (
            <p className="field-error" role="alert">
              {cancelError}
            </p>
          )}
        </section>
      )}

      {phase === 'processing' && (
        <LoadingState label={t('import:processing.title')} variant="block" testId="import-processing">
          <p>{t('import:processing.body')}</p>
          {jobStatusQuery.isError && (
            <p role="alert" data-testid="import-status-error">
              {t('import:errors.statusFailed')}
            </p>
          )}
          {pollExhausted && <p role="alert">{t('import:stalled')}</p>}
        </LoadingState>
      )}

      {phase === 'review' && job && (
        <section className="card" aria-labelledby="import-review-title" data-testid="import-review">
          <div className="card-header">
            <div>
              <h2 className="card-title" id="import-review-title">
                {t('import:review.title')}
              </h2>
              <p className="reports-card-subtitle">
                {t('import:review.summary', {
                  accepted: job.acceptedCount ?? 0,
                  rejected: job.rejectedCount ?? 0,
                  warnings: job.warningCount ?? 0,
                })}
              </p>
            </div>
          </div>

          {(job.rejectedCount ?? 0) > 0 && (
            <p className="field-error" role="alert" data-testid="import-review-blocked">
              {t('import:review.blockedByRejections')}
            </p>
          )}

          {rowsQuery.isError ? (
            <p className="field-error" role="alert" data-testid="import-rows-error">
              {t('import:errors.rowsFailed')}
            </p>
          ) : (rows?.items?.length ?? 0) === 0 ? (
            <div className="dashboard-empty-state" data-testid="import-review-empty">
              <p>{t('import:review.empty')}</p>
            </div>
          ) : (
            <HorizontalScrollRegion
              labelledBy="import-review-title"
              describedById="import-review-scroll-hint"
              testId="import-review-region"
            >
              <table className="dashboard-table table-compact">
                <thead>
                  <tr>
                    <th scope="col">{t('import:review.columns.row')}</th>
                    <th scope="col">{t('import:review.columns.line')}</th>
                    <th scope="col">{t('import:review.columns.status')}</th>
                    <th scope="col">{t('import:review.columns.errors')}</th>
                    <th scope="col">{t('import:review.columns.warnings')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(rows?.items ?? []).map((row, index) => (
                    <tr key={`${row.rowIndex}-${index}`} data-testid={`import-row-${row.rowIndex}`}>
                      <td>{row.rowIndex}</td>
                      <td>{row.sourceLine}</td>
                      <td>
                        {row.status && i18nHasRowStatus(row.status)
                          ? t(`import:rowStatus.${row.status}`)
                          : row.status}
                      </td>
                      <td dir="auto">{(row.errorCodes ?? []).join(', ')}</td>
                      <td dir="auto">{(row.warnings ?? []).join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </HorizontalScrollRegion>
          )}

          <div className="reports-pagination">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={rowPage === 0}
              onClick={() => setRowPage((page) => Math.max(0, page - 1))}
            >
              {t('import:review.pagination.previous')}
            </button>
            <p role="status" aria-live="polite" data-testid="import-review-pagination-status">
              {t('import:review.pagination.status', {
                page: rowPage + 1,
                totalPages: rowTotalPages,
                total: rowTotal,
              })}
            </p>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={rowPage + 1 >= rowTotalPages}
              onClick={() => setRowPage((page) => page + 1)}
            >
              {t('import:review.pagination.next')}
            </button>
          </div>

          <div className="reports-filter-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={(job.rejectedCount ?? 0) > 0 || commitMutation.isPending}
              onClick={() => setConfirmOpen(true)}
            >
              {t('import:actions.commit')}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              disabled={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate(job.publicId!)}
            >
              {cancelMutation.isPending ? t('import:actions.cancelling') : t('import:actions.cancelImport')}
            </button>
          </div>
          {commitError && (
            <p className="field-error" role="alert">
              {commitError}
            </p>
          )}
          {cancelError && (
            <p className="field-error" role="alert">
              {cancelError}
            </p>
          )}
        </section>
      )}

      {phase === 'committing' && (
        <LoadingState label={t('import:committing.title')} variant="block" testId="import-committing">
          <p>{t('import:committing.body')}</p>
          {jobStatusQuery.isError && (
            <p role="alert" data-testid="import-status-error">
              {t('import:errors.statusFailed')}
            </p>
          )}
          {pollExhausted && <p role="alert">{t('import:stalled')}</p>}
        </LoadingState>
      )}

      {(phase === 'result' || phase === 'failed' || phase === 'cancelled' || phase === 'expired') && job && (
        <section className="card" aria-labelledby="import-result-title" data-testid="import-result">
          <h2 id="import-result-title">
            {phase === 'result'
              ? t('import:result.title')
              : isDeadLettered(job)
                ? t('import:status.DEAD_LETTER')
                : t(`import:status.${job.status}`)}
          </h2>
          {phase === 'result' && (
            <>
              <p>{t('import:result.reconciledBody', { committed: job.committedCount ?? 0 })}</p>
              {reconciliationEntries.length > 0 && (
                <dl data-testid="import-reconciliation">
                  {reconciliationEntries.map(([key, value]) => (
                    <div key={key}>
                      <dt>{i18nHasReconciliationKey(key) ? t(`import:result.reconciliationKeys.${key}`) : key}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </>
          )}
          {phase === 'failed' && (
            <>
              {isDeadLettered(job) && (
                <p className="field-error" role="alert" data-testid="import-dead-letter">
                  {t('import:result.deadLetterBody')}
                </p>
              )}
              <p role="alert">
                {job.failureReason
                  ? t('import:result.failureReason', { reason: job.failureReason })
                  : t('import:result.failedBody')}
              </p>
            </>
          )}
          <div className="reports-filter-actions">
            {evidenceDownloadable && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => void handleDownload()}
              >
                {t('import:actions.downloadEvidence')}
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={startAnother}>
              {t('import:actions.startAnother')}
            </button>
          </div>
          {!evidenceDownloadable && (
            <p data-testid="import-evidence-unavailable">{t('import:result.evidenceUnavailable')}</p>
          )}
          {downloadError && (
            <p className="field-error" role="alert">
              {downloadError}
            </p>
          )}
        </section>
      )}

      <section className="card" aria-labelledby="import-history-title" data-testid="import-history">
        <h2 id="import-history-title">{t('import:history.title')}</h2>
        {historyQuery.isError && !capabilityUnavailable && (
          <p className="field-error" role="alert">
            {t('import:errors.historyFailed')}
          </p>
        )}
        {(historyQuery.data?.items?.length ?? 0) === 0 ? (
          <div className="dashboard-empty-state" data-testid="import-history-empty">
            <p>{t('import:history.empty')}</p>
          </div>
        ) : (
          <HorizontalScrollRegion
            labelledBy="import-history-title"
            describedById="import-history-scroll-hint"
            testId="import-history-region"
          >
            <table className="dashboard-table table-compact">
              <thead>
                <tr>
                  <th scope="col">{t('import:history.columns.fileName')}</th>
                  <th scope="col">{t('import:history.columns.template')}</th>
                  <th scope="col">{t('import:history.columns.status')}</th>
                  <th scope="col">{t('import:history.columns.counts')}</th>
                  <th scope="col">{t('import:history.columns.updatedAt')}</th>
                  <th scope="col">{t('import:history.columns.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {(historyQuery.data?.items ?? []).map((item) => {
                  const active = item.status != null && ACTIVE_STATUSES.has(item.status)
                  const cancellable = item.status != null && CANCELLABLE_STATUSES.has(item.status)
                  return (
                    <tr key={item.publicId} data-testid={`import-history-row-${item.publicId}`}>
                      <td dir="auto">{item.fileName ?? '—'}</td>
                      <td>{item.templateKey}</td>
                      <td>
                        {isDeadLettered(item) ? (
                          <span className="field-error" data-testid={`import-history-dead-letter-${item.publicId}`}>
                            {t('import:status.DEAD_LETTER')}
                          </span>
                        ) : item.status && i18nHasStatus(item.status) ? (
                          t(`import:status.${item.status}`)
                        ) : (
                          item.status
                        )}
                        {item.failureReason ? (
                          <span
                            className="reports-filter-hint"
                            dir="auto"
                            data-testid={`import-history-failure-${item.publicId}`}
                          >
                            {item.failureReason}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        {item.acceptedCount ?? 0} / {item.rejectedCount ?? 0}
                      </td>
                      <td>
                        {item.updatedAt ? (
                          <time dateTime={item.updatedAt}>{item.updatedAt}</time>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {item.publicId && (active || item.status === 'RECONCILED' || item.status === 'FAILED') && (
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            disabled={openJobMutation.isPending}
                            data-testid={`import-history-open-${item.publicId}`}
                            onClick={() => openJobMutation.mutate(item.publicId!)}
                          >
                            {active ? t('import:actions.resume') : t('import:actions.open')}
                          </button>
                        )}
                        {item.publicId && cancellable && (
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            disabled={cancelMutation.isPending}
                            data-testid={`import-history-cancel-${item.publicId}`}
                            onClick={() => cancelMutation.mutate(item.publicId!)}
                          >
                            {t('import:actions.cancelImport')}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </HorizontalScrollRegion>
        )}
        {/* Only errors from the row actions land here. The start card owns `openError`, and the
            upload/review cards own `cancelError`, so neither is ever rendered twice. */}
        {phase !== 'start' && openError && (
          <p className="field-error" role="alert">
            {openError}
          </p>
        )}
        {phase !== 'start' && phase !== 'upload' && phase !== 'review' && cancelError && (
          <p className="field-error" role="alert">
            {cancelError}
          </p>
        )}
      </section>

      {confirmOpen && job && (
        <Modal labelledBy="import-confirm-title" onClose={() => setConfirmOpen(false)} closeOnBackdrop={false}>
          <div className="modal-header">
            <h2 className="modal-title" id="import-confirm-title">
              {t('import:confirm.title')}
            </h2>
            <button
              type="button"
              className="modal-close"
              aria-label={t('import:actions.close')}
              onClick={() => setConfirmOpen(false)}
            >
              <CloseIcon size={18} />
            </button>
          </div>
          <div className="modal-body">
            <p>{t('import:confirm.body', { accepted: job.acceptedCount ?? 0 })}</p>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => setConfirmOpen(false)}>
              {t('common:actions.cancel')}
            </button>
            <button
              type="button"
              className="btn btn-success"
              disabled={commitMutation.isPending}
              onClick={() => commitMutation.mutate()}
            >
              {t('import:actions.confirmCommit')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

/** `i18n.exists` needs the instance; these guards stay inline so the row/status/reconciliation
 * maps never render a raw un-translated server key when the server adds one this page does not
 * know yet. */
const KNOWN_ROW_STATUSES = new Set(['ACCEPTED', 'REJECTED', 'WARNING'])
const KNOWN_JOB_STATUSES = new Set([
  'UPLOADED', 'MAPPED', 'VALIDATING', 'DRY_RUN_READY', 'COMMITTING', 'COMMITTED',
  'RECONCILING', 'RECONCILED', 'FAILED', 'CANCELLED', 'EXPIRED',
])
/** The union of both committers' `Difference.evidence()` maps. */
const KNOWN_RECONCILIATION_KEYS = new Set([
  'expectedRows', 'committedRows', 'effectRows', 'expectedUsers', 'actualUsers',
  'expectedInvitations', 'actualInvitations', 'expectedPolicyAssignments',
  'actualPolicyAssignments', 'actualLedgerEntries', 'difference',
])
function i18nHasRowStatus(status: string): boolean {
  return KNOWN_ROW_STATUSES.has(status)
}
function i18nHasStatus(status: string): boolean {
  return KNOWN_JOB_STATUSES.has(status)
}
function i18nHasReconciliationKey(key: string): boolean {
  return KNOWN_RECONCILIATION_KEYS.has(key)
}
