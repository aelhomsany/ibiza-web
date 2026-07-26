import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import type { RecentRequestResponse } from '../../api/generated/types'
import { useAuth } from '../../auth/useAuth'
import { LeaveStatusBadge } from '../../components/ui/LeaveStatusBadge'
import { LoadingState } from '../../components/ui/LoadingState'
import { WorkingDayExplainer } from '../../components/ui/WorkingDayExplainer'
import { PlusIcon } from '../../components/ui/icons'
import { useToast } from '../../components/ui/useToast'
import { BalanceCard } from '../dashboard/BalanceCard'
import { RequestLeaveModal } from '../dashboard/RequestLeaveModal'
import {
  formatDateRange,
  localizedRequestStatusHint,
} from '../dashboard/leaveRequestFormatting'
import { useDashboardBalances } from '../dashboard/useDashboardBalances'
import { MyLeavesFilters } from './MyLeavesFilters'
import { MyLeavesHistory } from './MyLeavesHistory'
import { STATUS_FILTERS, type MyLeavesStatusFilter } from './statusFilters'
import { useMyLeaveRequests } from './useMyLeaveRequests'
import './my-leaves.css'

const SEARCH_INPUT_ID = 'my-leaves-search'
const QUERY_COMMIT_DELAY_MS = 500

function statusFilterFrom(value: string | null): MyLeavesStatusFilter {
  return STATUS_FILTERS.includes(value as MyLeavesStatusFilter)
    ? (value as MyLeavesStatusFilter)
    : 'ALL'
}

function numericRequestId(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) {
    return null
  }
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

function RequestExplainer({
  request,
}: {
  request?: RecentRequestResponse
}) {
  const { t, i18n } = useTranslation(['leaves', 'dashboard'])

  if (!request) {
    return (
      <section
        className="my-leaves-request-explainer"
        aria-labelledby="my-leaves-explainer-title"
        data-testid="my-leaves-request-explainer"
      >
        <p className="my-leaves-eyebrow">{t('leaves:explainer.eyebrow')}</p>
        <h2 id="my-leaves-explainer-title" className="my-leaves-explainer-title">
          {t('leaves:explainer.title')}
        </h2>
        <WorkingDayExplainer
          compact
          state="before-dates"
          stateMessage={t('leaves:explainer.empty')}
        />
      </section>
    )
  }

  const localizedHint =
    request.declineReason ?? localizedRequestStatusHint(request, t)
  const requestContext = localizedHint
    ? t('leaves:explainer.requestContextWithHint', {
        type: request.leaveTypeName,
        dates: formatDateRange(
          request.dateFrom ?? '',
          request.dateTo ?? '',
          i18n.language,
        ),
        hint: localizedHint,
      })
    : t('leaves:explainer.requestContext', {
        type: request.leaveTypeName,
        dates: formatDateRange(
          request.dateFrom ?? '',
          request.dateTo ?? '',
          i18n.language,
        ),
      })

  return (
    <section
      className="my-leaves-request-explainer"
      aria-labelledby="my-leaves-explainer-title"
      data-testid="my-leaves-request-explainer"
    >
      <p className="my-leaves-eyebrow">{t('leaves:explainer.eyebrow')}</p>
      <h2 id="my-leaves-explainer-title" className="my-leaves-explainer-title">
        {t('leaves:explainer.title')}
      </h2>
      <p className="my-leaves-explainer-context" dir="auto">
        {requestContext}
      </p>
      <WorkingDayExplainer
        compact
        state="valid"
        stateMessage=""
        resultLabel={t('leaves:history.workingDays', {
          count: request.workingDays,
        })}
        footer={
          <div className="my-leaves-explainer-status">
            <LeaveStatusBadge status={request.status} />
            {localizedHint ? <span dir="auto">{localizedHint}</span> : null}
          </div>
        }
      />
    </section>
  )
}

export function MyLeavesPage() {
  const { t, i18n } = useTranslation(['leaves', 'layout', 'dashboard', 'common'])
  const { user } = useAuth()
  const isHrAdmin = user?.role === 'HR_ADMIN'
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null)
  const [expandedRequestId, setExpandedRequestId] = useState<number | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const { showToast } = useToast()
  const balancesQuery = useDashboardBalances()
  const historyQuery = useMyLeaveRequests()

  const urlQuery = searchParams.get('q') ?? ''
  const statusFilter = statusFilterFrom(searchParams.get('status'))
  const requestIdParam = searchParams.get('requestId')
  const requestedId = numericRequestId(requestIdParam)

  // Live query drives filtering immediately; the URL is updated on a debounced
  // commit so Back/Forward restores prior searches without a per-keystroke flood.
  const [liveQuery, setLiveQuery] = useState(urlQuery)
  useEffect(() => {
    setLiveQuery(urlQuery)
  }, [urlQuery])

  useEffect(() => {
    if (liveQuery === urlQuery) {
      return
    }
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams)
      if (liveQuery.trim()) {
        next.set('q', liveQuery)
      } else {
        next.delete('q')
      }
      setSearchParams(next)
    }, QUERY_COMMIT_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [liveQuery, urlQuery, searchParams, setSearchParams])

  // Strip URL params that cannot be honored so a shared link never keeps a
  // silently-ignored status or whitespace-only search around forever.
  useEffect(() => {
    const rawStatus = searchParams.get('status')
    const rawQuery = searchParams.get('q')
    const invalidStatus =
      rawStatus != null &&
      !STATUS_FILTERS.includes(rawStatus as MyLeavesStatusFilter)
    const blankQuery = rawQuery != null && rawQuery.trim() === ''
    if (!invalidStatus && !blankQuery) {
      return
    }
    const next = new URLSearchParams(searchParams)
    if (invalidStatus) {
      next.delete('status')
    }
    if (blankQuery) {
      next.delete('q')
    }
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const filteredRequests = useMemo(() => {
    if (!historyQuery.data) {
      return []
    }
    const normalizedQuery = liveQuery.trim().toLocaleLowerCase(i18n.language)

    return historyQuery.data.filter((request) => {
      if (statusFilter !== 'ALL' && request.status !== statusFilter) {
        return false
      }
      if (!normalizedQuery) {
        return true
      }

      const localizedHint = localizedRequestStatusHint(request, t)
      const statusLabel = request.status
        ? t(`common:status.${request.status.toLowerCase()}`)
        : ''
      const searchableText = [
        request.leaveTypeName,
        formatDateRange(
          request.dateFrom ?? '',
          request.dateTo ?? '',
          i18n.language,
        ),
        statusLabel,
        localizedHint,
        request.approverFirstName,
        request.declineReason,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase(i18n.language)

      return searchableText.includes(normalizedQuery)
    })
  }, [historyQuery.data, i18n.language, liveQuery, statusFilter, t])

  // Summarize the selected/next request from what is actually on screen so the
  // compact explainer never describes a request the active filter hid.
  const selectedRequest = useMemo(() => {
    if (!filteredRequests.length) {
      return undefined
    }
    return (
      filteredRequests.find((request) => request.id === selectedRequestId) ??
      filteredRequests[0]
    )
  }, [filteredRequests, selectedRequestId])

  const hasActiveFilters = liveQuery.trim() !== '' || statusFilter !== 'ALL'

  const deepLinkMissing =
    historyQuery.isSuccess &&
    requestIdParam != null &&
    (requestedId == null ||
      !historyQuery.data.some((request) => request.id === requestedId))

  useEffect(() => {
    if (!historyQuery.isSuccess) {
      return
    }

    const deepLinkedRequest =
      requestedId == null
        ? undefined
        : historyQuery.data.find((request) => request.id === requestedId)

    if (requestIdParam != null && deepLinkedRequest?.id != null) {
      setSelectedRequestId(deepLinkedRequest.id)
      setExpandedRequestId(deepLinkedRequest.id)
      return
    }

    setExpandedRequestId(null)
    setSelectedRequestId((current) => {
      if (historyQuery.data.some((request) => request.id === current)) {
        return current
      }
      return historyQuery.data[0]?.id ?? null
    })
  }, [historyQuery.data, historyQuery.isSuccess, requestIdParam, requestedId])

  const showSubmitSuccessToast = useCallback(() => {
    showToast(t('dashboard:request.success'))
  }, [showToast, t])

  const openRequestLeave = useCallback(() => {
    setModalOpen(true)
  }, [])

  const setStatusFilter = useCallback(
    (status: MyLeavesStatusFilter) => {
      const next = new URLSearchParams(searchParams)
      if (status === 'ALL') {
        next.delete('status')
      } else {
        next.set('status', status)
      }
      setSearchParams(next)
    },
    [searchParams, setSearchParams],
  )

  const clearFilters = useCallback(() => {
    const next = new URLSearchParams(searchParams)
    next.delete('q')
    next.delete('status')
    next.delete('requestId')
    setLiveQuery('')
    setSearchParams(next)
    // Clear Filters lives inside the branch it removes; re-home focus to the
    // still-mounted search input so keyboard/SR users are not dropped to <body>.
    document.getElementById(SEARCH_INPUT_ID)?.focus()
  }, [searchParams, setSearchParams])

  const dismissMissingDeepLink = useCallback(() => {
    const next = new URLSearchParams(searchParams)
    next.delete('requestId')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const toggleDetails = useCallback(
    (id: number) => {
      const next = new URLSearchParams(searchParams)
      setSelectedRequestId(id)
      if (expandedRequestId === id) {
        setExpandedRequestId(null)
        next.delete('requestId')
      } else {
        setExpandedRequestId(id)
        next.set('requestId', String(id))
      }
      // A local disclosure toggle is not a navigation — replace so Back does
      // not walk through expand/collapse history entries.
      setSearchParams(next, { replace: true })
    },
    [expandedRequestId, searchParams, setSearchParams],
  )

  return (
    <div className="page page-wide my-leaves-page" data-testid="my-leaves-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{t('leaves:title')}</h1>
          <p className="page-sub">{t('leaves:subtitle')}</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          data-testid="request-leave-btn"
          onClick={openRequestLeave}
        >
          <PlusIcon size={16} /> {t('leaves:actions.requestLeave')}
        </button>
      </header>

      <div className="my-leaves-summary">
        <section className="my-leaves-balances" aria-labelledby="my-leaves-balances-title">
          <h2 id="my-leaves-balances-title" className="my-leaves-section-title">
            {t('leaves:balances')}
          </h2>
          {balancesQuery.isPending && (
            <LoadingState
              label={t('layout:loading.leaveBalances')}
              variant="skeleton"
              testId="my-leaves-balance-grid-loading"
            >
              <div className="balance-grid">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="dashboard-skeleton-card" />
                ))}
              </div>
            </LoadingState>
          )}

          {balancesQuery.isError && (
            <div className="my-leaves-region-error" data-testid="my-leaves-balances-error">
              <p role="alert">{t('leaves:errors.balances')}</p>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => void balancesQuery.refetch()}
              >
                {t('common:actions.retry')}
              </button>
            </div>
          )}

          {balancesQuery.isSuccess && (
            <div className="balance-grid" data-testid="my-leaves-balance-grid">
              {balancesQuery.data.map((balance) => (
                <BalanceCard key={balance.leaveTypeId} balance={balance} />
              ))}
            </div>
          )}
        </section>

        {historyQuery.isPending ? (
          <section
            className="my-leaves-request-explainer"
            aria-labelledby="my-leaves-explainer-title"
            data-testid="my-leaves-request-explainer"
          >
            <p className="my-leaves-eyebrow">{t('leaves:explainer.eyebrow')}</p>
            <h2 id="my-leaves-explainer-title" className="my-leaves-explainer-title">
              {t('leaves:explainer.title')}
            </h2>
            <WorkingDayExplainer
              compact
              state="loading"
              stateMessage={t('leaves:explainer.loading')}
            />
          </section>
        ) : historyQuery.isSuccess ? (
          <RequestExplainer request={selectedRequest} />
        ) : null}
      </div>

      <MyLeavesFilters
        query={liveQuery}
        status={statusFilter}
        resultCount={historyQuery.isSuccess ? filteredRequests.length : null}
        onQueryChange={setLiveQuery}
        onStatusChange={setStatusFilter}
      />

      {deepLinkMissing ? (
        <div
          className="my-leaves-deep-link-not-found"
          data-testid="my-leaves-request-not-found"
          role="status"
        >
          <div>
            <p className="my-leaves-empty-title">{t('leaves:deepLink.notFoundTitle')}</p>
            <p>{t('leaves:deepLink.notFound')}</p>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={dismissMissingDeepLink}
          >
            {t('leaves:deepLink.viewHistory')}
          </button>
        </div>
      ) : null}

      <section className="card my-leaves-history" data-testid="my-leaves-history">
        <div className="card-header">
          <h2 id="my-leaves-history-title" className="card-title">
            {t('leaves:history.title')}
          </h2>
        </div>

        {historyQuery.isPending && (
          <LoadingState
            label={t('layout:loading.leaveHistory')}
            variant="block"
            testId="my-leaves-history-loading"
          />
        )}

        {historyQuery.isError && (
          <div className="my-leaves-region-error" data-testid="my-leaves-history-error">
            <p role="alert">{t('leaves:errors.history')}</p>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => void historyQuery.refetch()}
            >
              {t('common:actions.retry')}
            </button>
          </div>
        )}

        {historyQuery.isSuccess && (
          <MyLeavesHistory
            allRequestsCount={historyQuery.data.length}
            requests={filteredRequests}
            showAuditHistory={isHrAdmin}
            hasActiveFilters={hasActiveFilters}
            workforceGroupName={user?.workforceGroupName}
            focusedRequestId={
              filteredRequests.some((request) => request.id === expandedRequestId)
                ? expandedRequestId
                : null
            }
            expandedRequestId={expandedRequestId}
            onClearFilters={clearFilters}
            onRequestLeave={openRequestLeave}
            onToggleDetails={toggleDetails}
          />
        )}
      </section>

      <RequestLeaveModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={showSubmitSuccessToast}
      />
    </div>
  )
}
