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
