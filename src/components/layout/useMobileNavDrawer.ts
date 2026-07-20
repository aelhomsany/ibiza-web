import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

export function useMobileNavDrawer() {
  const [navOpen, setNavOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const shouldRestoreFocusRef = useRef(false)

  const closeNav = useCallback(() => {
    shouldRestoreFocusRef.current = true
    setNavOpen(false)
  }, [])

  const toggleNav = useCallback(() => {
    if (navOpen) {
      closeNav()
      return
    }
    setNavOpen(true)
  }, [navOpen, closeNav])

  useEffect(() => {
    function closeOnDesktopResize() {
      if (window.innerWidth > 900) {
        setNavOpen(false)
      }
    }

    window.addEventListener('resize', closeOnDesktopResize)
    return () => window.removeEventListener('resize', closeOnDesktopResize)
  }, [])

  useLayoutEffect(() => {
    if (!navOpen && shouldRestoreFocusRef.current) {
      menuButtonRef.current?.focus()
      shouldRestoreFocusRef.current = false
    }
  }, [navOpen])

  useEffect(() => {
    if (!navOpen) {
      return undefined
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeNav()
        return
      }

      if (event.key === 'Tab') {
        const sidebarControls = Array.from(
          document.querySelectorAll<HTMLElement>(
            '#app-sidebar a[href], #app-sidebar button:not(:disabled), #app-sidebar [tabindex]:not([tabindex="-1"])',
          ),
        )
        const backdrop = document.querySelector<HTMLElement>('[data-testid="sidebar-backdrop"]')
        const focusable = [
          ...sidebarControls,
          ...(backdrop ? [backdrop] : []),
          ...(menuButtonRef.current ? [menuButtonRef.current] : []),
        ]

        if (focusable.length === 0) {
          return
        }

        event.preventDefault()
        const currentIndex = focusable.indexOf(document.activeElement as HTMLElement)
        const nextIndex = event.shiftKey
          ? currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1
          : currentIndex < 0 || currentIndex === focusable.length - 1 ? 0 : currentIndex + 1
        focusable[nextIndex].focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    const focusFrame = requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('#app-sidebar .sidebar-nav-item')?.focus()
    })

    return () => {
      cancelAnimationFrame(focusFrame)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [navOpen, closeNav])

  return {
    navOpen,
    menuButtonRef,
    closeNav,
    toggleNav,
    onNavigate: closeNav,
  }
}
