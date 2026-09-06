export const SETTINGS_CATEGORIES = [
  'organization',
  'working-calendars',
  'calendar-privacy',
  'leave-policies',
  'people',
  'integrations',
] as const

export type SettingsCategory = (typeof SETTINGS_CATEGORIES)[number]
