import { useTranslation } from 'react-i18next'
import {
  CalendarIcon,
  CheckCircleIcon,
  GlobeIcon,
} from '../../components/ui/icons'

const PROOF_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const

export function AuthProofPanel() {
  const { t } = useTranslation('auth')

  return (
    <section
      className="auth-proof-panel"
      data-testid="auth-proof-panel"
      aria-labelledby="auth-proof-title"
    >
      <div className="auth-proof-content">
        <p className="auth-proof-eyebrow">{t('proof.eyebrow')}</p>
        <h2 id="auth-proof-title" className="display-lg auth-proof-title">
          {t('proof.title')}
        </h2>
        <p className="auth-proof-summary">{t('proof.summary')}</p>

        <div
          className="auth-proof-example"
          role="group"
          aria-label={t('proof.exampleLabel')}
        >
          <div className="auth-proof-example-heading">
            <span className="auth-proof-example-icon" aria-hidden="true">
              <CalendarIcon size={20} />
            </span>
            <div>
              <p className="auth-proof-example-label">{t('proof.exampleEyebrow')}</p>
              <p className="auth-proof-date">
                {/* No forced dir: unlike the bare-numeral bdi runs below,
                    this string mixes digits with an Arabic month name, so
                    it must resolve its own (often RTL) reading order. */}
                <bdi>{t('proof.dateRange')}</bdi>
              </p>
            </div>
            <div className="auth-proof-result">
              <strong>
                <bdi dir="ltr">{t('proof.result')}</bdi>
              </strong>
              <span>{t('proof.resultLabel')}</span>
            </div>
          </div>

          <ol className="auth-proof-days" aria-label={t('proof.timelineLabel')}>
            {PROOF_DAYS.map((day) => {
              const excluded = day === 'friday'
              return (
                <li
                  key={day}
                  className={
                    excluded
                      ? 'auth-proof-day auth-proof-day-excluded'
                      : 'auth-proof-day'
                  }
                >
                  <span>{t(`proof.days.${day}.label`)}</span>
                  <bdi dir="ltr">{t(`proof.days.${day}.date`)}</bdi>
                  <span className="auth-proof-day-status">
                    {excluded ? t('proof.excluded') : t('proof.counted')}
                  </span>
                </li>
              )
            })}
          </ol>
        </div>

        <div className="auth-proof-trust">
          <GlobeIcon size={20} aria-hidden="true" />
          <div>
            <p>{t('proof.trustTitle')}</p>
            <ul>
              <li>
                <CheckCircleIcon size={16} aria-hidden="true" />
                <span>{t('proof.egyptCue')}</span>
              </li>
              <li>
                <CheckCircleIcon size={16} aria-hidden="true" />
                <span>{t('proof.usCue')}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
