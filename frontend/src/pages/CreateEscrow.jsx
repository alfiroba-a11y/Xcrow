import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import LockCodeBadge from '../components/LockCodeBadge.jsx';
import { api } from '../api/axios.js';

export default function CreateEscrow() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', description: '', amount: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/escrows', form);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create the escrow');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(result.inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <Navbar />
      <div className="mx-auto max-w-xl px-6 py-12">
        {!result ? (
          <>
            <h1 className="font-display text-2xl font-bold text-navy-900">Start an escrow</h1>
            <p className="mt-1 text-sm text-slate-500">You're registering as the buyer for this trade.</p>

            <form onSubmit={handleSubmit} className="card mt-6 space-y-4 p-6">
              {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}
              <div>
                <label className="label">What are you buying?</label>
                <input required className="input" placeholder="e.g. iPhone 13 Pro, 128GB"
                  value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="label">Details (optional)</label>
                <textarea className="input" rows={3} placeholder="Condition, delivery expectations, anything the seller should know"
                  value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <label className="label">Amount (NGN)</label>
                <input type="number" min="1" step="0.01" required className="input" placeholder="50000"
                  value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <button className="btn-accent w-full" disabled={loading}>
                {loading ? 'Creating…' : 'Create escrow'}
              </button>
            </form>
          </>
        ) : (
          <div className="card p-8 text-center">
            <p className="badge bg-emerald-500/10 text-emerald-600">Escrow created</p>
            <h1 className="mt-3 font-display text-xl font-bold text-navy-900">Send these to the seller</h1>
            <p className="mt-1 text-sm text-slate-500">
              Send the link and the lock code <span className="font-medium">separately</span> — a text and a call, for example —
              so the link alone can never be used to hijack this trade.
            </p>

            <div className="mt-6 space-y-2 text-left">
              <label className="label">Escrow link</label>
              <div className="flex gap-2">
                <input readOnly className="input font-mono text-sm" value={result.inviteUrl} />
                <button onClick={copyLink} className="btn-ghost whitespace-nowrap">{copied ? 'Copied' : 'Copy'}</button>
              </div>
            </div>

            <div className="mt-6">
              <label className="label text-left">Lock code</label>
              <div className="flex justify-center">
                <LockCodeBadge code={result.lockCode} />
              </div>
              <p className="mt-2 text-xs text-slate-400">This is shown once. Write it down before you leave this page.</p>
            </div>

            <button onClick={() => navigate(`/escrow/${result.escrow._id}`)} className="btn-primary mt-8 w-full">
              Go to escrow room
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
