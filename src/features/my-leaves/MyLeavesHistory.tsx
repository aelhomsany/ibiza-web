import {
  Fragment,
  useEffect,
  useRef,
  type MutableRefObject,
} from 'react'
import { useTranslation } from 'react-i18next'
import { isolate } from '../../i18n/bidi'
import type { RecentRequestResponse } from '../../api/generated/types'
import { HorizontalScrollRegion } from '../../components/ui/HorizontalScrollRegion'
import { InboxIcon, PlusIcon } from '../../components/ui/icons'
import { LeaveStatusBadge } from '../../components/ui/LeaveStatusBadge'
import { WorkingDayExplainer } from '../../components/ui/WorkingDayExplainer'
import { AuditHistoryExpander } from '../approvals/AuditHistoryExpander'
import { ApprovalProgress } from '../approvals/ApprovalProgress'
import { LeaveTypeTag } from '../dashboard/LeaveTypeTag'
import {
  formatDateRange,
  localizedRequestStatusHint,
} from '../dashboard/leaveRequestFormatting'
import { cancelVariantFor } from './cancellation'

type RequestElementMap = MutableRefObject<Map<number, HTMLElement>>

type MyLeavesHistoryProps = {
  allRequestsCount: number
  requests: RecentRequestResponse[]
  showAuditHistory: boolean
  hasActiveFilters: boolean
  workforceGroupName?: string | null
  focusedRequestId: number | null
  expandedRequestId: number | null
  onClearFilters: () => void
  onRequestLeave: () => void
  onToggleDetails: (requestId: number) => void
  onCancelRequest: (request: RecentRequestResponse) => void
}

function requestId(request: RecentRequestResponse): number | null {
  return request.id ?? null
}

function detailsDomId(variant: 'row' | 'card', id: number): string {
  return variant === 'row'
    ? `my-leaves-request-details-${id}`
    : `my-leaves-request-card-details-${id}`
}

function RequestHint({ request }: { request: RecentRequestResponse }) {
  const { t } = useTranslation(['leaves', 'dashboard'])
  const localizedHint = localizedRequestStatusHint(request, t)

  return (
    <>
      {localizedHint ? <p className="status-hint my-leaves-request-hint">{localizedHint}</p> : null}
      {request.status === 'DECLINED' && request.declineReason ? (
        <p className="decline-reason my-leaves-request-hint" dir="auto">
          &quot;{request.declineReason}&quot;
        </p>
      ) : null}
    </>
  )
}

/**
 * Plan VUELTA Part 5. Two of the five `blockedReason` values are worth explaining to the person
 * looking at their own row; the other three (ALREADY_CANCELLED, DECLINED, NOT_REQUESTER) are
 * already obvious from the status badge or from whose page this is, so they render nothing.
 */
function CancellationNote({ request }: { request: RecentRequestResponse }) {
  const { t } = useTranslation('leaves')
  const blockedReason = request.cancellation?.blockedReason
  if (blockedReason === 'REVIEW_PENDING') {
    return (
      <p className="status-hint my-leaves-request-hint" data-testid="cancellation-pending-note">
        {t('cancel.pendingReview')}
      </p>
    )
  }
  // A closed balance year is refused by the API every time, so it gets an explanation and a
  // direction (HR / Balance Corrections) instead of a button that always 409s.
  if (blockedReason === 'PRIOR_BALANCE_YEAR') {
    return (
      <p className="status-hint my-leaves-request-hint" data-testid="cancellation-prior-year-note">
        {t('cancel.priorYear')}
      </p>
    )
  }
  return null
}

function CancelButton({
  request,
  onCancelRequest,
}: {
  request: RecentRequestResponse
  onCancelRequest: (request: RecentRequestResponse) => void
}) {
  const { t, i18n } = useTranslation('leaves')
  const id = requestId(request)
  const variant = cancelVariantFor(request)
  if (id == null || variant == null) {
    return null
  }
  const label =
    variant === 'WITHDRAW'
      ? t('cancel.confirmWithdraw')
      : variant === 'CANCEL'
        ? t('cancel.action')
        : t('cancel.reviewAction')

  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm my-leaves-cancel-button"
      data-testid={`my-leaves-cancel-button-${id}`}
      aria-label={t('cancel.actionFor', {
        type: request.leaveTypeName,
        dates: formatDateRange(
          request.dateFrom ?? '',
          request.dateTo ?? '',
          i18n.language,
        ),
      })}
      onClick={() => onCancelRequest(request)}
    >
      {label}
    </button>
  )
}

/**
 * In-place disclosure content (AC5 / UX-DR48). Presents the stored working-day
 * total as authoritative, the Workforce Group policy label from `/me`, and an
 * honest aggregate-only note. It never derives days or invents per-date chips.
 * Rendered as a sibling of the triggering row/card so `aria-controls` resolves.
 */
function RequestDetails({
  request,
  workforceGroupName,
  variant,
}: {
  request: RecentRequestResponse
  workforceGroupName?: string | null
  variant: 'row' | 'card'
}) {
  const { t } = useTranslation('leaves')
  const id = requestId(request)
  if (id == null) {
    return null
  }
  const domId = detailsDomId(variant, id)

  return (
    <div id={domId} data-testid={domId} className="my-leaves-request-details">
      <WorkingDayExplainer
        compact
        state="valid"
        stateMessage=""
        resultLabel={t('history.workingDays', { count: request.workingDays })}
        policyLabel={
          workforceGroupName
            ? t('explainer.policy', { group: isolate(workforceGroupName) })
            : t('explainer.policyFallback')
        }
        excludedSummary={t('explainer.aggregateOnly')}
      />
      <ApprovalProgress evidence={request.approvalEvidence} />
    </div>
  )
}

function DetailsButton({
  request,
  expanded,
  variant,
  onToggleDetails,
}: {
  request: RecentRequestResponse
  expanded: boolean
  variant: 'row' | 'card'
  onToggleDetails: (requestId: number) => void
}) {
  const { t, i18n } = useTranslation('leaves')
  const id = requestId(request)
  if (id == null) {
    return null
  }
  const dates = formatDateRange(
    request.dateFrom ?? '',
    request.dateTo ?? '',
    i18n.language,
  )

  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm my-leaves-details-button"
      data-testid={`my-leaves-${variant}-details-button-${id}`}
      aria-expanded={expanded}
      aria-controls={detailsDomId(variant, id)}
      aria-label={t('history.detailsFor', {
        type: request.leaveTypeName,
        dates,
      })}
      onClick={() => onToggleDetails(id)}
    >
      {expanded ? t('history.hideDetails') : t('history.details')}
    </button>
  )
}

function refFor(
  refs: RequestElementMap,
  id: number | null,
): (element: HTMLElement | null) => void {
  return (element) => {
    if (id == null) {
      return
    }
    if (element) {
      refs.current.set(id, element)
    } else {
      refs.current.delete(id)
    }
  }
}

export function MyLeavesHistory({
  allRequestsCount,
  requests,
  showAuditHistory,
  hasActiveFilters,
  workforceGroupName,
  focusedRequestId,
  expandedRequestId,
  onClearFilters,
  onRequestLeave,
  onToggleDetails,
  onCancelRequest,
}: MyLeavesHistoryProps) {
  const { t, i18n } = useTranslation('leaves')
  const desktopRequestRefs = useRef(new Map<number, HTMLElement>())
  const mobileRequestRefs = useRef(new Map<number, HTMLElement>())
  const columnCount = 6 + (showAuditHistory ? 1 : 0)

  // Move focus/scroll to a request only when the focused id actually changes —
  // NOT when the (re-derived) requests list changes, or typing in search while
  // a row is expanded would steal focus back to the row on every keystroke.
  useEffect(() => {
    if (focusedRequestId == null) {
      return
    }

    const useMobileCard =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 900px)').matches
    const target = (useMobileCard ? mobileRequestRefs : desktopRequestRefs).current.get(
      focusedRequestId,
    )
    target?.scrollIntoView?.({ block: 'center' })
    target?.focus({ preventScroll: true })
  }, [focusedRequestId])

  if (allRequestsCount === 0) {
    return (
      <div className="dashboard-empty-state" data-testid="my-leaves-empty-state" role="status">
        <span className="my-leaves-empty-icon" aria-hidden="true">
          <InboxIcon size={36} />
        </span>
        <p className="my-leaves-empty-title">{t('history.emptyTitle')}</p>
        <p>{t('history.empty')}</p>
        <div className="my-leaves-empty-actions">
          <button
            type="button"
            className="btn btn-outline my-leaves-empty-action"
            onClick={onRequestLeave}
          >
            <PlusIcon size={16} /> {t('actions.requestLeave')}
          </button>
          {hasActiveFilters ? (
            <button
              type="button"
              className="btn btn-ghost my-leaves-empty-action"
              data-testid="my-leaves-clear-filters"
              onClick={onClearFilters}
            >
              {t('filters.clear')}
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  if (requests.length === 0) {
    return (
      <div
        className="dashboard-empty-state my-leaves-filter-empty"
        data-testid="my-leaves-filter-empty"
      >
        <p className="my-leaves-empty-title">{t('filters.noMatch')}</p>
        <p>{t('filters.noMatchHint')}</p>
        <button
          type="button"
          className="btn btn-outline my-leaves-empty-action"
          data-testid="my-leaves-clear-filters"
          onClick={onClearFilters}
        >
          {t('filters.clear')}
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="my-leaves-desktop-history" data-testid="my-leaves-desktop-history">
        <HorizontalScrollRegion
          labelledBy="my-leaves-history-title"
          describedById="my-leaves-history-scroll-hint"
          testId="my-leaves-history-table"
        >
          <table className="dashboard-table table-compact">
            <thead>
              <tr>
                <th scope="col">{t('table.type')}</th>
                <th scope="col">{t('table.dates')}</th>
                <th scope="col">{t('table.days')}</th>
                <th scope="col">{t('table.status')}</th>
                <th scope="col">{t('table.details')}</th>
                <th scope="col">{t('table.actions')}</th>
                {showAuditHistory ? <th scope="col">{t('table.audit')}</th> : null}
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => {
                const id = requestId(request)
                const isFocused = id != null && focusedRequestId === id
                const isExpanded = id != null && expandedRequestId === id
                return (
                  <Fragment key={id}>
                    <tr
                      ref={refFor(desktopRequestRefs, id)}
                      className={request.status === 'PENDING' ? 'row-pending' : undefined}
                      data-testid={id == null ? undefined : `my-leaves-request-row-${id}`}
                      data-focused={isFocused ? 'true' : undefined}
                      tabIndex={isFocused ? -1 : undefined}
                    >
                      <td>
                        <LeaveTypeTag
                          icon={request.leaveTypeIcon ?? ''}
                          name={request.leaveTypeName ?? ''}
                          color={request.leaveTypeColor ?? 'inherit'}
                          backgroundColor={request.leaveTypeBackgroundColor ?? 'transparent'}
                          borderColor={request.leaveTypeBorderColor ?? 'transparent'}
                        />
                      </td>
                      <td>
                        <bdi>
                          {formatDateRange(
                            request.dateFrom ?? '',
                            request.dateTo ?? '',
                            i18n.language,
                          )}
                        </bdi>
                      </td>
                      <td>{t('history.workingDays', { count: request.workingDays })}</td>
                      <td>
                        <LeaveStatusBadge status={request.status} />
                        <RequestHint request={request} />
                        <CancellationNote request={request} />
                      </td>
                      <td>
                        <DetailsButton
                          request={request}
                          expanded={isExpanded}
                          variant="row"
                          onToggleDetails={onToggleDetails}
                        />
                      </td>
                      <td>
                        <CancelButton
                          request={request}
                          onCancelRequest={onCancelRequest}
                        />
                      </td>
                      {showAuditHistory ? (
                        <td>
                          {id != null ? <AuditHistoryExpander requestId={id} /> : null}
                        </td>
                      ) : null}
                    </tr>
                    {isExpanded ? (
                      <tr className="my-leaves-details-row">
                        <td colSpan={columnCount}>
                          <RequestDetails
                            request={request}
                            workforceGroupName={workforceGroupName}
                            variant="row"
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </HorizontalScrollRegion>
      </div>

      <ul className="my-leaves-mobile-history" data-testid="my-leaves-mobile-history">
        {requests.map((request) => {
          const id = requestId(request)
          const isFocused = id != null && focusedRequestId === id
          const isExpanded = id != null && expandedRequestId === id
          return (
            <li
              className="my-leaves-request-card"
              data-testid={id == null ? undefined : `my-leaves-request-card-${id}`}
              data-focused={isFocused ? 'true' : undefined}
              key={id}
              ref={refFor(mobileRequestRefs, id)}
              tabIndex={isFocused ? -1 : undefined}
            >
              <div className="my-leaves-request-card-heading">
                <LeaveTypeTag
                  icon={request.leaveTypeIcon ?? ''}
                  name={request.leaveTypeName ?? ''}
                  color={request.leaveTypeColor ?? 'inherit'}
                  backgroundColor={request.leaveTypeBackgroundColor ?? 'transparent'}
                  borderColor={request.leaveTypeBorderColor ?? 'transparent'}
                />
                <LeaveStatusBadge status={request.status} />
              </div>
              <p className="my-leaves-request-dates">
                <bdi>
                  {formatDateRange(
                    request.dateFrom ?? '',
                    request.dateTo ?? '',
                    i18n.language,
                  )}
                </bdi>
              </p>
              <p className="my-leaves-request-working-days">
                {t('history.workingDays', { count: request.workingDays })}
              </p>
              <RequestHint request={request} />
              <CancellationNote request={request} />
              <div className="my-leaves-request-card-actions">
                <DetailsButton
                  request={request}
                  expanded={isExpanded}
                  variant="card"
                  onToggleDetails={onToggleDetails}
                />
                <CancelButton request={request} onCancelRequest={onCancelRequest} />
              </div>
              {isExpanded ? (
                <RequestDetails
                  request={request}
                  workforceGroupName={workforceGroupName}
                  variant="card"
                />
              ) : null}
            </li>
          )
        })}
      </ul>
    </>
  )
}
