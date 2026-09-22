import { Link, Outlet } from 'react-router-dom'
import Logo from '../Logo.jsx'

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" aria-label="AItasks home">
            <Logo />
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-accent-soft hover:text-ink"
            >
              Log in
            </Link>
            <Link
              to="/register"
              className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
