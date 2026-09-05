const HEADER_MENU_OPENED_EVENT = 'leaveo:header-menu-opened'

export function announceHeaderMenuOpen(id: string) {
  window.dispatchEvent(new CustomEvent<string>(HEADER_MENU_OPENED_EVENT, { detail: id }))
}

export function onOtherHeaderMenuOpen(id: string, onOtherOpen: (openedId: string) => void) {
  function handleOpen(event: Event) {
    const openedId = (event as CustomEvent<string>).detail
    if (openedId !== id) {
      onOtherOpen(openedId)
    }
  }

  window.addEventListener(HEADER_MENU_OPENED_EVENT, handleOpen)
  return () => window.removeEventListener(HEADER_MENU_OPENED_EVENT, handleOpen)
}
