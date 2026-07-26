import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { BalanceCardResponse } from '../../api/generated/types'
import { balanceCardSlug } from './balanceCardSlug'
import './balance-card.css'

type BalanceCardProps = {
  balance: BalanceCardResponse
}

export function BalanceCard({ balance }: BalanceCardProps) {
  const { t } = useTranslation('dashboard')
  const slug = balanceCardSlug(balance.name)
  const cardStyle = {
    backgroundColor: balance.backgroundColor,
    borderColor: balance.borderColor,
    color: balance.color,
    '--balance-accent': balance.color,
    '--balance-tag-fg': balance.color,
  } as CSSProperties

  if (!balance.capped) {
    return (
      <div
        className="balance-card"
        style={cardStyle}
        data-testid={`balance-card-${slug}`}
      >
        <div className="balance-icon">{balance.icon}</div>
        <div className="balance-label">{balance.name}</div>
        <div className="balance-uncapped">{t('balance.uncapped')}</div>
        <div className="balance-used">
          {t('balance.daysUsed', { count: balance.usedDays })}
        </div>
      </div>
    )
  }

  const allocated = balance.allocatedDays ?? 0
  const remaining = balance.remainingDays ?? 0
  const used = balance.usedDays
  const isOverdraft = remaining < 0
  const hasProgressRange = allocated > 0
  const pct = isOverdraft
    ? 100
    : hasProgressRange
      ? Math.min(100, Math.round((used / allocated) * 100))
      : 0

  return (
    <div
      className="balance-card"
      style={cardStyle}
      data-testid={`balance-card-${slug}`}
    >
      {isOverdraft ? (
        <span className="balance-tag balance-tag--overdraft" data-testid={`balance-tag-overdraft-${slug}`}>
          {t('balance.overLimit', { count: Math.abs(remaining) })}
        </span>
      ) : (
        <span className="balance-tag balance-tag--remaining" data-testid={`balance-tag-remaining-${slug}`}>
          {t('balance.left', { count: remaining })}
        </span>
      )}
      <div className="balance-icon">{balance.icon}</div>
      <div className="balance-label">{balance.name}</div>
      <div className="balance-value">
        <span className="sr-only">
          {t('balance.allocationLabel', {
            remaining,
            allocated,
          })}
        </span>
        <span className="balance-value-copy" aria-hidden="true">
          {isOverdraft ? used : remaining}
          <span className="balance-total">/{allocated}</span>
        </span>
      </div>
      {hasProgressRange ? (
        <div
          className="balance-bar-bg"
          role="progressbar"
          aria-label={t('balance.usageLabel', { used, allocated })}
          aria-valuemin={0}
          aria-valuemax={allocated}
          aria-valuenow={Math.max(0, Math.min(used, allocated))}
        >
          <div
            className={`balance-bar${isOverdraft ? ' balance-bar--overdraft' : ''}`}
            style={{ width: `${pct}%` }}
            data-testid={`balance-bar-${slug}`}
          />
        </div>
      ) : null}
      <div className="balance-used">{t('balance.daysUsed', { count: used })}</div>
    </div>
  )
}
