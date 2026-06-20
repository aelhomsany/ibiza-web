import type { BalanceCardResponse } from '../../api/generated/types'
import { balanceCardSlug } from './balanceCardSlug'
import './balance-card.css'

type BalanceCardProps = {
  balance: BalanceCardResponse
}

export function BalanceCard({ balance }: BalanceCardProps) {
  const slug = balanceCardSlug(balance.name)
  const cardStyle = {
    backgroundColor: balance.backgroundColor,
    borderColor: balance.borderColor,
    color: balance.color,
  }

  if (!balance.capped) {
    return (
      <div
        className="balance-card"
        style={cardStyle}
        data-testid={`balance-card-${slug}`}
      >
        <div className="balance-icon">{balance.icon}</div>
        <div className="balance-label">{balance.name}</div>
        {balance.usedDays > 0 && (
          <div className="balance-used">{balance.usedDays} working days used</div>
        )}
      </div>
    )
  }

  const allocated = balance.allocatedDays ?? 0
  const remaining = balance.remainingDays ?? 0
  const used = balance.usedDays
  const isOverdraft = remaining < 0
  const pct = isOverdraft ? 100 : allocated > 0 ? Math.min(100, Math.round((used / allocated) * 100)) : 0

  return (
    <div
      className="balance-card"
      style={cardStyle}
      data-testid={`balance-card-${slug}`}
    >
      {isOverdraft ? (
        <span className="balance-tag balance-tag--overdraft" data-testid={`balance-tag-overdraft-${slug}`}>
          {Math.abs(remaining)} over limit
        </span>
      ) : (
        <span
          className="balance-tag"
          style={{ backgroundColor: `${balance.color}22`, color: balance.color }}
        >
          {remaining} left
        </span>
      )}
      <div className="balance-icon">{balance.icon}</div>
      <div className="balance-label">{balance.name}</div>
      <div className="balance-value">
        {isOverdraft ? used : remaining}
        <span className="balance-total">/{allocated}</span>
      </div>
      <div className="balance-bar-bg">
        <div
          className="balance-bar"
          style={{ width: `${pct}%`, backgroundColor: isOverdraft ? 'var(--color-danger)' : balance.color }}
          data-testid={`balance-bar-${slug}`}
        />
      </div>
      <div className="balance-used">{used} working days used</div>
    </div>
  )
}
