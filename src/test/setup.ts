import '@testing-library/jest-dom/vitest'
import '../i18n/config'

// Vitest's jsdom environment can omit Storage when no document URL is configured.
// Story 9.5 intentionally exercises the pre-auth locale contract, so provide the
// browser-shaped API in that narrow environment.
if (typeof window !== 'undefined' && typeof window.localStorage === 'undefined') {
  const values = new Map<string, string>()
  const storage: Storage = {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  }
  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
}

// jsdom does not implement <dialog> showModal()/close() — minimal polyfill so the
// shared Modal component (src/components/ui/Modal.tsx) works in unit tests.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.show = function show(this: HTMLDialogElement) {
    this.open = true
  }
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function close(
    this: HTMLDialogElement,
    returnValue?: string,
  ) {
    if (returnValue !== undefined) {
      this.returnValue = returnValue
    }
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
}
