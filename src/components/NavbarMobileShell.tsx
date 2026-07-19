import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation } from 'react-router-dom'
import { EveNavAuth } from '@/components/EveNavAuth'
import { NavbarHubSelect } from '@/components/NavbarHubSelect'
import { NavbarItemSearch } from '@/components/NavbarItemSearch'

type NavLinkItem = { to: string; label: string }

function NavbarBrand() {
  return (
    <NavLink to="/" className="app-navbar__brand" title="EVE Industry Organizer">
      <span className="app-navbar__brand-mark">EVE</span>
      <span className="app-navbar__brand-rest"> Industry</span>
    </NavLink>
  )
}

export function NavbarMobileShell({ links }: { links: NavLinkItem[] }) {
  const shellRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!menuOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  useEffect(() => {
    const el = shellRef.current?.closest('.app-navbar')
    if (!(el instanceof HTMLElement)) return
    const header: HTMLElement = el

    function syncMenuTop() {
      header.style.setProperty('--mobile-menu-top', `${header.getBoundingClientRect().height}px`)
    }

    if (menuOpen) {
      header.classList.add('app-navbar--menu-open')
      syncMenuTop()
      const observer = new ResizeObserver(syncMenuTop)
      observer.observe(header)
      const prevOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        header.classList.remove('app-navbar--menu-open')
        header.style.removeProperty('--mobile-menu-top')
        observer.disconnect()
        document.body.style.overflow = prevOverflow
      }
    }

    header.classList.remove('app-navbar--menu-open')
    header.style.removeProperty('--mobile-menu-top')
  }, [menuOpen])

  const menuOverlay =
    menuOpen &&
    createPortal(
      <>
        <button
          type="button"
          className="app-navbar__mobile-backdrop"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
        <nav id="app-mobile-nav-menu" className="app-navbar__mobile-menu" aria-label="Main">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) =>
                `app-navbar__mobile-menu-link ${isActive ? 'app-navbar__mobile-menu-link--active' : ''}`
              }
              onClick={() => setMenuOpen(false)}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </>,
      document.body,
    )

  return (
    <div ref={shellRef} className="app-navbar__mobile-shell">
      <div className="app-navbar__inner app-navbar__inner--mobile">
        <NavbarBrand />
        <div className="app-navbar__mobile-actions">
          <div className="app-navbar__auth">
            <EveNavAuth />
          </div>
          <button
            type="button"
            className="app-navbar__menu-btn"
            aria-expanded={menuOpen}
            aria-controls="app-mobile-nav-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span
              className={`app-navbar__menu-icon ${menuOpen ? 'app-navbar__menu-icon--open' : ''}`}
              aria-hidden
            >
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>
      </div>

      <div className="app-navbar__tools app-navbar__tools--mobile">
        <NavbarHubSelect />
        <span className="app-navbar__tool-sep" aria-hidden />
        <NavbarItemSearch />
      </div>

      {menuOverlay}
    </div>
  )
}
