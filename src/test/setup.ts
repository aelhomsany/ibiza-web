import '@testing-library/jest-dom/vitest'

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
