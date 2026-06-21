import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/blueprints', label: 'Blueprints' },
  { to: '/stations', label: 'Stations' },
  { to: '/accounts', label: 'Accounts' },
  { to: '/progression', label: 'Progression' },
  { to: '/settings', label: 'Settings' },
]

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="navbar bg-base-200 border-b border-eve-border px-4 lg:px-8">
        <div className="flex-1">
          <NavLink to="/" className="text-xl font-bold text-primary">
            EVE Industry Organizer
          </NavLink>
        </div>
        <nav className="flex-none hidden md:flex gap-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) =>
                `btn btn-ghost btn-sm ${isActive ? 'text-primary' : ''}`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <div className="md:hidden bg-base-200 border-b border-eve-border overflow-x-auto">
        <div className="flex gap-1 p-2">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) =>
                `btn btn-xs ${isActive ? 'btn-primary' : 'btn-ghost'}`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>
      </div>

      <main className="flex-1 min-w-0 min-h-0 w-full max-w-7xl mx-auto p-4 lg:p-8 flex flex-col">
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
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-sm opacity-70 mt-1">{subtitle}</p>}
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
