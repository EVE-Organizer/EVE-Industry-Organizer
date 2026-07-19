import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { EveNavAuth } from '@/components/EveNavAuth'
import { NavbarHubSelect } from '@/components/NavbarHubSelect'
import { NavbarItemSearch } from '@/components/NavbarItemSearch'
import { NavbarMobileShell } from '@/components/NavbarMobileShell'

const links = [
  { to: '/', label: 'Blueprints' },
  { to: '/plan', label: 'Plan' },
  { to: '/jobs', label: 'Jobs' },
  { to: '/settings', label: 'Settings' },
]

function NavbarBrand() {
  return (
    <NavLink to="/" className="app-navbar__brand" title="EVE Industry Organizer">
      <span className="app-navbar__brand-mark">EVE</span>
      <span className="app-navbar__brand-rest hidden sm:inline"> Industry</span>
      <span className="app-navbar__brand-rest hidden xl:inline"> Organizer</span>
    </NavLink>
  )
}

function NavbarTools() {
  return (
    <div className="app-navbar__tools">
      <NavbarHubSelect />
      <span className="app-navbar__tool-sep" aria-hidden />
      <NavbarItemSearch />
    </div>
  )
}

function NavbarNav() {
  return (
    <nav className="app-navbar__nav" aria-label="Main">
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.to === '/'}
          className={({ isActive }) =>
            `app-navbar__nav-link ${isActive ? 'app-navbar__nav-link--active' : ''}`
          }
        >
          {l.label}
        </NavLink>
      ))}
    </nav>
  )
}

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="app-navbar">
        <div className="app-navbar__inner app-navbar__inner--desktop">
          <NavbarBrand />
          <NavbarTools />
          <div className="app-navbar__end">
            <NavbarNav />
            <span className="app-navbar__divider" aria-hidden />
            <div className="app-navbar__auth">
              <EveNavAuth />
            </div>
          </div>
        </div>

        <NavbarMobileShell links={links} />
      </header>

      <main className="flex-1 min-w-0 min-h-0 w-full max-w-7xl mx-auto p-3 sm:p-4 lg:p-8 flex flex-col">
        <Outlet />
      </main>
    </div>
  )
}

export function LastUpdated({ fetchedAt, source }: { fetchedAt?: number; source?: string }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  if (!fetchedAt) return null
  const ago = Math.round((now - fetchedAt) / 60000)
  return (
    <span className="text-xs opacity-60">
      Updated {ago < 1 ? 'just now' : `${ago}m ago`}
      {source ? ` · ${source}` : ''}
    </span>
  )
}

export function PageHeader({
  title,
  subtitle,
  action,
  icon,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  icon?: React.ReactNode
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        {icon ? <div className="shrink-0">{icon}</div> : null}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold truncate">{title}</h1>
          {subtitle && <p className="text-sm opacity-70 mt-1">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

export function LoadingState() {
  return (
    <div className="flex justify-center py-20">
      <span className="loading loading-spinner loading-lg text-primary" />
    </div>
  )
}

export { formatIsk } from '@/lib/profit'
