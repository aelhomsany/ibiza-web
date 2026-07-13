export const tags = {
  smoke: '@smoke',
  regression: '@regression',
  api: '@api',
  uiOnly: '@ui-only',
  a11y: '@a11y',
  keyboard: '@keyboard',
  story: (id: string) => `@story-${id}`,
} as const
