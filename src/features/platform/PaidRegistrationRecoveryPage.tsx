import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCwIcon } from '../../components/ui/icons'
import { useToast } from '../../components/ui/useToast'
import {
  getRecoverablePaidRegistrations,
  recoverPaidRegistration,
  type RecoverablePaidRegistration,
} from '../platform-auth/platformApiClient'
import './organizations-page.css'

export function PaidRegistrationRecoveryPage() {
  const { t } = useTranslation('platform')
  const { showToast } = useToast()
  const [items, setItems] = useState<RecoverablePaidRegistration[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState<string | null>(null)

  useEffect(() => {
    void getRecoverablePaidRegistrations().then(setItems).catch(() => showToast(t('recovery.errors.load'), 'warning')).finally(() => setLoading(false))
  }, [showToast, t])

  async function recover(item: RecoverablePaidRegistration) {
    if (working) return
    setWorking(item.registrationId)
    try {
      await recoverPaidRegistration(item.registrationId)
      setItems((current) => current.filter((value) => value.registrationId !== item.registrationId))
      showToast(t('recovery.success'), 'success')
    } catch {
      showToast(t('recovery.errors.submit'), 'warning')
    } finally {
      setWorking(null)
    }
  }

  return (
    <div className="page page-wide organizations-page" data-testid="platform-paid-recovery-page">
      <header className="page-header"><div><h1 className="page-title">{t('recovery.title')}</h1><p className="page-sub">{t('recovery.subtitle')}</p></div></header>
      {loading ? <p aria-live="polite">{t('recovery.loading')}</p> : items.length === 0 ? (
        <section className="card organizations-page__empty"><h2>{t('recovery.empty')}</h2></section>
      ) : (
        <section className="card table-wrap" aria-labelledby="paid-recovery-table-title">
          <h2 id="paid-recovery-table-title" className="sr-only">{t('recovery.title')}</h2>
          <table className="organizations-table"><thead><tr><th>{t('recovery.table.organization')}</th><th>{t('recovery.table.plan')}</th><th>{t('recovery.table.status')}</th><th>{t('recovery.table.reference')}</th><th>{t('recovery.table.action')}</th></tr></thead>
            <tbody>{items.map((item) => <tr key={item.registrationId}>
              <td><strong>{item.organizationName}</strong><br /><bdi>{item.maskedAdministratorEmail}</bdi></td>
              <td><bdi>{item.plan}</bdi></td><td>{item.status}</td><td><bdi>{item.registrationId}</bdi></td>
              <td><button className="btn btn-admin btn-sm" disabled={working !== null} onClick={() => void recover(item)}><RefreshCwIcon size={14} /> {t('recovery.action')}</button></td>
            </tr>)}</tbody>
          </table>
        </section>
      )}
    </div>
  )
}
