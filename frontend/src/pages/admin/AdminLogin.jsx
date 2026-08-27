import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

const adminPath = import.meta.env.VITE_ADMIN_PATH;

// Intentionally bare — no Xcrow branding, no link back to the public site,
// nothing that would make this page interesting to stumble onto.
export default function AdminLogin() {
  const { adminLogin } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await adminLogin(form.email, form.password);
      navigate(`/${adminPath}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 px-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border border-white/10 bg-navy-900 p-6">
        <p className="text-center font-mono text-sm text-slate-400">restricted access</p>
        {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-400">{error}</p>}
        <input type="email" required placeholder="Email" className="w-full rounded-lg border border-white/10 bg-navy-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
          value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input type="password" required placeholder="Password" className="w-full rounded-lg border border-white/10 bg-navy-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
          value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button disabled={loading} className="w-full rounded-lg bg-emerald-500 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50">
          {loading ? 'Checking…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
