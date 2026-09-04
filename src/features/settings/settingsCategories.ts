export const SETTINGS_CATEGORIES = [
  'organization',
  'working-calendars',
  'schedules-locations',
  'calendar-privacy',
  'leave-policies',
  'people',
  'integrations',
] as const

export type SettingsCategory = (typeof SETTINGS_CATEGORIES)[number]
