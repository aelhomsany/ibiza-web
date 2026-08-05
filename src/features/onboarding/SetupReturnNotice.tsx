import { useTranslation } from 'react-i18next'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { ChevronLeftIcon, ChevronRightIcon } from '../../components/ui/icons'
import './setup-return.css'

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

  const cameFromSetup = searchParams.get('from') === 'onboarding'
  // A non-HR Admin is bounced off /onboarding by the route guard, so offering them the trip back
  // would only lose their place — the marker can be pasted into any URL.
  const canReturn = user?.role === 'HR_ADMIN'
  if (!cameFromSetup || !canReturn || location.pathname === '/onboarding') {
    return null
  }

  const BackIcon = i18n.dir() === 'rtl' ? ChevronRightIcon : ChevronLeftIcon
  return (
    <aside className="setup-return-notice" data-testid="setup-return-notice" role="status">
      <div>
        <strong>{t('returnNotice.title')}</strong>
        <p>{t('returnNotice.body')}</p>
      </div>
      <Link
        className="btn btn-outline btn-sm setup-return-action"
        data-testid="setup-return-action"
        to="/onboarding"
      >
        <BackIcon size={16} aria-hidden="true" />
        {t('returnNotice.action')}
      </Link>
    </aside>
  )
}
