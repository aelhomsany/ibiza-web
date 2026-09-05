import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from '../../components/ui/icons'
import './setup-return.css'

const DISMISS_KEY = 'leaveo.onboarding.setupReturnDismissed'

// Tab-scoped rather than component state: the shell survives route changes but not a reload, and a
// banner that reappeared on every refresh would not read as dismissed.
function readDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === '1'
  }
  catch {
    return false
  }
}

/**
 * Closes the guided-setup loop. `/onboarding` sends the user to the Settings surface that owns the
 * change and tells them to "return here afterward" — but onboarding has no sidebar entry, so the
 * only ways back were browser Back and the dashboard cue. This renders the missing affordance on
 * the destination, keyed off the `?from=onboarding` marker the Continue action carries.
 *
 * Shell-mounted rather than added per feature: the next safe action targets Settings, My Leaves,
 * Approvals, and the Team Calendar, and every one of them needs the same way back.
 */
export function SetupReturnNotice() {
  const { t, i18n } = useTranslation('onboarding')
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const location = useLocation()

  const [dismissed, setDismissed] = useState(readDismissed)

  const cameFromSetup = searchParams.get('from') === 'onboarding'
  // A non-HR Admin is bounced off /onboarding by the route guard, so offering them the trip back
  // would only lose their place — the marker can be pasted into any URL.
  const canReturn = user?.role === 'HR_ADMIN'
  if (!cameFromSetup || !canReturn || dismissed || location.pathname === '/onboarding') {
    return null
  }

  const BackIcon = i18n.dir() === 'rtl' ? ChevronRightIcon : ChevronLeftIcon
  return (
    <aside className="setup-return-notice" data-testid="setup-return-notice" role="status">
      <div>
        <strong>{t('returnNotice.title')}</strong>
        <p>{t('returnNotice.body')}</p>
      </div>
      <div className="setup-return-actions">
        <Link
          className="btn btn-outline btn-sm setup-return-action"
          data-testid="setup-return-action"
          to="/onboarding"
        >
          <BackIcon size={16} aria-hidden="true" />
          {t('returnNotice.action')}
        </Link>
        {/*
          The marker rides in the URL, so a bookmarked or shared link kept re-showing this banner
          with no way to silence it — and role="status" re-announced it on every navigation that
          preserved the query string.
        */}
        <button
          type="button"
          className="btn btn-ghost btn-sm setup-return-dismiss"
          data-testid="setup-return-dismiss"
          aria-label={t('returnNotice.dismiss')}
          onClick={() => {
            setDismissed(true)
            try {
              window.sessionStorage.setItem(DISMISS_KEY, '1')
            }
            catch {
              // Best-effort: the banner still closes for this render tree.
            }
          }}
        >
          <CloseIcon size={16} aria-hidden="true" />
        </button>
      </div>
    </aside>
  )
}
