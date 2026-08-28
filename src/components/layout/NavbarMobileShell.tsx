import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation } from 'react-router-dom'
import { EveNavAuth } from '@/components/layout/EveNavAuth'
import { NavbarHubSelect } from '@/components/layout/NavbarHubSelect'
import { NavbarItemSearch } from '@/components/layout/NavbarItemSearch'
import type { MobileNavEntry } from '@/components/layout/NavbarNav'

function NavbarBrand() {
  return (
    <NavLink to="/" className="app-navbar__brand" title="EVE Industry Organizer">
      <span className="app-navbar__brand-mark">EVE</span>
      <span className="app-navbar__brand-rest"> Industry</span>
    </NavLink>
  )
}

export function NavbarMobileShell({ links }: { links: MobileNavEntry[] }) {
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
          {links.map((entry) =>
            entry.kind === 'section' ? (
              <p key={`section-${entry.label}`} className="app-navbar__mobile-menu-section">
                {entry.label}
              </p>
            ) : (
              <NavLink
                key={entry.to}
                to={entry.to}
                end={entry.end ?? false}
                className={({ isActive }) =>
                  `app-navbar__mobile-menu-link ${entry.indent ? 'app-navbar__mobile-menu-link--indent' : ''} ${isActive ? 'app-navbar__mobile-menu-link--active' : ''}`
                }
                onClick={() => setMenuOpen(false)}
              >
                {entry.label}
              </NavLink>
            ),
          )}
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
