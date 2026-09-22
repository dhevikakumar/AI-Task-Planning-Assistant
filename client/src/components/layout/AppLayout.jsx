import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import Logo from '../Logo.jsx'

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/plan', label: 'Daily Plan' },
  { to: '/insights', label: 'Insights' },
]

function NavList({ onNavigate }) {
  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `rounded-lg px-3 py-2 text-sm font-medium ${
              isActive
                ? 'bg-accent-soft text-accent'
                : 'text-muted hover:bg-canvas hover:text-ink'
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

export default function AppLayout() {
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-screen bg-canvas md:flex">
      <aside className="hidden w-60 shrink-0 border-r border-line bg-surface md:flex md:flex-col">
        <div className="border-b border-line px-5 py-5">
          <Logo />
        </div>
        <div className="flex-1 px-3 py-4">
          <NavList />
        </div>
        <p className="px-5 py-4 text-xs text-muted">Stage 2 task management</p>
      </aside>

      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/20"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <aside className="relative z-50 flex h-full w-64 flex-col bg-surface">
            <div className="flex items-center justify-between border-b border-line px-4 py-4">
              <Logo />
              <button
                type="button"
                className="rounded-md px-2 py-1 text-sm text-muted"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="px-3 py-4">
              <NavList onNavigate={() => setOpen(false)} />
            </div>
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 md:hidden">
          <Logo />
          <button
            type="button"
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink"
            onClick={() => setOpen(true)}
          >
            Menu
          </button>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
