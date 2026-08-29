import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import { api } from '../api/axios.js';
import { useAuth } from '../context/AuthContext.jsx';

function extractToken(input) {
  const trimmed = input.trim();
  const parts = trimmed.split('/join/');
  return parts.length > 1 ? parts[1].split(/[?#]/)[0] : trimmed;
}

function money(amount, currency) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: currency || 'KES' }).format(amount);
}

export default function JoinEscrow() {
  const { token } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [linkInput, setLinkInput] = useState('');
  const [preview, setPreview] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const { data } = await api.get(`/escrows/preview/${token}`);
        setPreview(data);
      } catch (err) {
        setError(err.response?.data?.message || 'This escrow link is invalid or has expired');
      }
    })();
  }, [token]);

  const handleLinkSubmit = (e) => {
    e.preventDefault();
    navigate(`/join/${extractToken(linkInput)}`);
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setError('');
    if (!user) {
      return navigate('/login', { state: { from: `/join/${token}` } });
    }
    setLoading(true);
    try {
      const endpoint = preview.kind === 'third_party'
        ? `/escrows/third-party/join/${token}`
        : `/escrows/join/${token}`;
      const { data } = await api.post(endpoint, { code: code.trim() });
      navigate(`/escrow/${data.escrow._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not join this escrow');
    } finally {
      setLoading(false);
    }
  };

  const alreadyTaken = preview && (preview.kind === 'main' ? preview.alreadyLocked : preview.alreadyUsed);

  return (
    <div>
      <Navbar />
      <div className="mx-auto max-w-md px-6 py-16">
        {!token ? (
          <>
            <h1 className="font-display text-2xl font-bold text-navy-900">Join an escrow</h1>
            <p className="mt-1 text-sm text-slate-500">Paste the link someone sent you.</p>
            <form onSubmit={handleLinkSubmit} className="card mt-6 space-y-4 p-6">
              <input required className="input" placeholder="https://xcrow.app/join/..."
                value={linkInput} onChange={(e) => setLinkInput(e.target.value)} />
              <button className="btn-accent w-full">Continue</button>
            </form>
          </>
        ) : (
          <div className="card p-6">
            {error && !preview ? (
              <p className="text-sm text-rose-500">{error}</p>
            ) : !preview ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : alreadyTaken ? (
              <p className="text-sm text-rose-500">
                {preview.kind === 'main' ? 'This escrow has already been locked to a buyer and seller.' : 'This invite has already been used.'}
              </p>
            ) : (
              <>
                <h1 className="font-display text-xl font-bold text-navy-900">{preview.title}</h1>
                <p className="mt-1 text-sm text-slate-500">
                  {money(preview.amount, preview.currency)}
                  {preview.kind === 'main'
                    ? ` · from ${preview.creatorName} (${preview.creatorRole})`
                    : ` · between ${preview.buyerName || 'the buyer'} and ${preview.sellerName || 'the seller'}`}
                </p>
                {preview.kind === 'main' && (
                  <p className="mt-1 text-xs text-slate-400">You'll join as the {preview.youWouldJoinAs}.</p>
                )}
                {preview.kind === 'third_party' && (
                  <p className="mt-1 text-xs text-slate-400">
                    You're being invited to observe this trade{preview.label ? ` as ${preview.label}` : ''}. You won't handle any funds.
                  </p>
                )}

                {!user && (
                  <p className="mt-4 rounded-lg bg-navy-700/5 px-3 py-2 text-sm text-navy-700">
                    You'll need to <Link to="/login" state={{ from: `/join/${token}` }} className="font-medium underline">log in</Link> or{' '}
                    <Link to="/register" className="font-medium underline">create an account</Link> to continue.
                  </p>
                )}

                <form onSubmit={handleJoin} className="mt-4 space-y-4">
                  {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}
                  <div>
                    <label className="label">Lock code</label>
                    <input required className="input font-mono uppercase tracking-widest" maxLength={8}
                      placeholder="Ask whoever sent this link"
                      value={code} onChange={(e) => setCode(e.target.value)} />
                  </div>
                  <button className="btn-accent w-full" disabled={loading}>
                    {loading ? 'Unlocking…' : user ? 'Unlock & join' : 'Continue'}
                  </button>
                </form>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
