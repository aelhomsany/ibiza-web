export function groupPillClass(groupName: string): string {
  const normalized = groupName.trim().toLowerCase()
  if (normalized === 'us') {
    return 'group-pill group-pill-us'
  }
  if (normalized === 'egypt') {
    return 'group-pill group-pill-egypt'
  }
  return 'group-pill'
}
