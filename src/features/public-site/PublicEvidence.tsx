import ar from '../../i18n/locales/ar/public.json'
import en from '../../i18n/locales/en/public.json'

export type PublicLocale = 'en' | 'ar'

type PublicEvidenceProps = {
  locale?: PublicLocale
  proofType?: 'working-day' | 'distributed-team'
}

export function PublicEvidence({
  locale = 'en',
  proofType = 'working-day',
}: PublicEvidenceProps) {
  const copy = locale === 'ar' ? ar.proof : en.proof

  return (
    <section
      className="public-proof"
      aria-label={copy.label}
      data-proof-type={proofType}
      data-testid="working-day-proof"
    >
      <div className="public-proof__result" data-testid="proof-result">
        <p className="public-eyebrow">{copy.eyebrow}</p>
        <h2>{copy.result}</h2>
        <p>{copy.range}</p>
      </div>

      <ol
        className="public-proof__dates"
        aria-label={copy.datesLabel}
        data-testid="proof-dates"
      >
        {copy.days.map((day) => (
          <li
            key={`${day.weekday}-${day.date}`}
            className={`public-proof__day public-proof__day--${day.status}`}
          >
            <span className="public-proof__weekday">{day.weekday}</span>
            <bdi className="public-proof__date">{day.date}</bdi>
            <span className="public-proof__status">
              {day.status === 'charged' ? copy.charged : copy.excluded}
            </span>
            <span className="public-proof__reason">{day.reason}</span>
          </li>
        ))}
      </ol>

      <div className="public-proof__policy" data-testid="proof-policy">
        <h3>{copy.policyTitle}</h3>
        <p>{copy.policy}</p>
      </div>

      <div className="public-proof__consequence" data-testid="proof-consequence">
        <h3>{copy.consequenceTitle}</h3>
        <p>{copy.consequence}</p>
        <p className="public-proof__curation">{copy.curationNote}</p>
      </div>
    </section>
  )
}
