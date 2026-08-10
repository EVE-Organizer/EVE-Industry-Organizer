import { useEffect, useId, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { TOOLS_NAV_ITEMS, isToolsPath } from '@/lib/toolsNav'

export type NavItem =
  | { kind: 'link'; to: string; label: string }
  | { kind: 'menu'; id: string; label: string; children: { to: string; label: string }[] }

export const NAV_ITEMS: NavItem[] = [
  { kind: 'link', to: '/', label: 'Blueprints' },
  { kind: 'link', to: '/plan', label: 'Plan' },
  { kind: 'link', to: '/map', label: 'Map' },
  { kind: 'link', to: '/jobs', label: 'Jobs' },
  {
    kind: 'menu',
    id: 'tools',
    label: 'Tools',
    children: TOOLS_NAV_ITEMS.map((item) => ({ to: item.to, label: item.label })),
  },
  { kind: 'link', to: '/settings', label: 'Settings' },
]

/** Flat links for mobile shell (parent label + indented children). */
export type MobileNavEntry =
  | { kind: 'link'; to: string; label: string; indent?: boolean; end?: boolean }
  | { kind: 'section'; label: string }

export function flattenNavForMobile(items: NavItem[]): MobileNavEntry[] {
  const out: MobileNavEntry[] = []
  for (const item of items) {
    if (item.kind === 'link') {
      out.push({ kind: 'link', to: item.to, label: item.label, end: item.to === '/' })
      continue
    }
    out.push({ kind: 'section', label: item.label })
    for (const child of item.children) {
      out.push({ kind: 'link', to: child.to, label: child.label, indent: true })
    }
  }
  return out
}

function NavbarDropdown({ item }: { item: Extract<NavItem, { kind: 'menu' }> }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const location = useLocation()
  const parentActive = item.id === 'tools' ? isToolsPath(location.pathname) : false

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div
      ref={rootRef}
      className={`app-navbar__nav-menu ${open ? 'app-navbar__nav-menu--open' : ''}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className={`app-navbar__nav-link ${parentActive ? 'app-navbar__nav-link--active' : ''}`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        {item.label}
        <span className="app-navbar__nav-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div id={menuId} className="app-navbar__nav-dropdown" role="menu">
          <div className="app-navbar__nav-dropdown-panel">
            {item.children.map((child) => (
              <NavLink
                key={child.to}
                to={child.to}
                role="menuitem"
                className={({ isActive }) =>
                  `app-navbar__nav-dropdown-link ${isActive ? 'app-navbar__nav-dropdown-link--active' : ''}`
                }
                onClick={() => setOpen(false)}
              >
                {child.label}
              </NavLink>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function NavbarNav() {
  return (
    <nav className="app-navbar__nav" aria-label="Main">
      {NAV_ITEMS.map((item) =>
        item.kind === 'link' ? (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `app-navbar__nav-link ${isActive ? 'app-navbar__nav-link--active' : ''}`
            }
          >
            {item.label}
          </NavLink>
        ) : (
          <NavbarDropdown key={item.id} item={item} />
        ),
      )}
    </nav>
  )
}
