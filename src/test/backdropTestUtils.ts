import { vi } from 'vitest'

export function mockBackdropGeometry(dialog: HTMLElement) {
  vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({
    x: 100,
    y: 100,
    top: 100,
    left: 100,
    right: 500,
    bottom: 500,
    width: 400,
    height: 400,
    toJSON: () => ({}),
  })
}
