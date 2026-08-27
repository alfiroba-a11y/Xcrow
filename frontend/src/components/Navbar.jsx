import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="border-b border-slate-100 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="h-8 w-8 rounded-lg bg-xcrow-gradient" aria-hidden="true" />
          <span className="font-display text-xl font-bold tracking-tight text-navy-900">
            Xcrow
          </span>
        </Link>

        <nav className="flex items-center gap-3">
          {user ? (
            <>
              <Link to="/dashboard" className="btn-ghost">Dashboard</Link>
              <Link to="/escrow/new" className="btn-accent">New escrow</Link>
              <button
                onClick={() => { logout(); navigate('/'); }}
                className="btn-ghost"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-ghost">Log in</Link>
              <Link to="/register" className="btn-primary">Create account</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
