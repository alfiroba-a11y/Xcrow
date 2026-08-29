import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import StatusPill from '../components/StatusPill.jsx';
import { api } from '../api/axios.js';
import { useAuth } from '../context/AuthContext.jsx';

function formatMoney(cents, currency) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: currency || 'KES' }).format(cents / 100);
}

export default function Dashboard() {
  const { user } = useAuth();
  const [escrows, setEscrows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/escrows');
        setEscrows(data.escrows);
      } catch (err) {
        setError(err.response?.data?.message || 'Could not load your escrows');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <Navbar />
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-navy-900">Hi {user?.name?.split(' ')[0]}</h1>
            <p className="text-sm text-slate-500">Everything you're buying, selling, or overseeing through Xcrow.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/join" className="btn-ghost">Have a link?</Link>
            <Link to="/escrow/new" className="btn-accent">New escrow</Link>
          </div>
        </div>

        {error && <p className="mt-6 rounded-lg bg-rose-500/10 px-4 py-3 text-sm text-rose-500">{error}</p>}

        {loading ? (
          <p className="mt-10 text-sm text-slate-400">Loading…</p>
        ) : escrows.length === 0 ? (
          <div className="card mt-8 p-10 text-center">
            <p className="font-display font-semibold text-navy-900">No escrows yet</p>
            <p className="mt-1 text-sm text-slate-500">Start one, or ask whoever's trading with you for their link.</p>
            <Link to="/escrow/new" className="btn-accent mt-4 inline-flex">Start an escrow</Link>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {escrows.map((e) => {
              const isBuyer = e.buyer && String(e.buyer._id || e.buyer) === String(user.id);
              const isSeller = e.seller && String(e.seller._id || e.seller) === String(user.id);
              const role = isBuyer ? 'Buying' : isSeller ? 'Selling' : 'Observing';
              const other = isBuyer ? e.seller : isSeller ? e.buyer : [e.buyer, e.seller].filter(Boolean);
              const otherLabel = Array.isArray(other)
                ? other.map((p) => p.name).join(' & ') || 'no one yet'
                : other?.name || 'waiting for them to join';

              return (
                <Link
                  key={e._id}
                  to={`/escrow/${e._id}`}
                  className="card flex items-center justify-between p-5 transition hover:border-emerald-500/40"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="badge bg-navy-700/5 text-navy-700">{role}</span>
                      <p className="font-display font-semibold text-navy-900">{e.title}</p>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatMoney(e.amount, e.currency)} · with {otherLabel}
                    </p>
                  </div>
                  <StatusPill status={e.status} />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
