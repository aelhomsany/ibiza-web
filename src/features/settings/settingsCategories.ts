export const SETTINGS_CATEGORIES = [
  'organization',
  'working-calendars',
  'leave-policies',
  'people',
  'notifications',
  'integrations',
] as const

export type SettingsCategory = (typeof SETTINGS_CATEGORIES)[number]
