import { useEffect, useState } from 'react';
import { adminApi } from '../../api/axios.js';
import { getSocket } from '../../api/socket.js';
import { useAuth } from '../../context/AuthContext.jsx';
import StatusPill from '../../components/StatusPill.jsx';

function money(kobo) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(kobo);
}

export default function AdminDashboard() {
  const { adminLogout } = useAuth();
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [escrows, setEscrows] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [toast, setToast] = useState('');

  const refresh = async () => {
    const [o, u, e, t] = await Promise.all([
      adminApi.get('/overview'),
      adminApi.get('/users'),
      adminApi.get('/escrows'),
      adminApi.get('/tickets'),
    ]);
    setOverview(o.data);
    setUsers(u.data.users);
    setEscrows(e.data.escrows);
    setTickets(t.data.tickets);
  };

  useEffect(() => {
    refresh();
    const socket = getSocket();
    socket.connect();
    socket.on('support:new-ticket', (ticket) => {
      setTickets((prev) => [ticket, ...prev]);
      setToast(`New support ticket: ${ticket.subject}`);
      setTimeout(() => setToast(''), 5000);
    });
    socket.on('support:ticket-updated', (updated) => {
      setTickets((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));
    });
    return () => {
      socket.off('support:new-ticket');
      socket.off('support:ticket-updated');
    };
  }, []);

  const toggleUser = async (id) => {
    await adminApi.patch(`/users/${id}/toggle-active`);
    refresh();
  };

  const refund = async (id) => {
    if (!confirm('Refund the buyer for this escrow?')) return;
    await adminApi.post(`/escrows/${id}/refund`);
    refresh();
  };

  const approvePayout = async (id) => {
    if (!confirm('Release funds to the seller now?')) return;
    await adminApi.post(`/escrows/${id}/approve-payout`);
    refresh();
  };

  return (
    <div className="min-h-screen bg-navy-950 text-white">
      {toast && (
        <div className="fixed right-4 top-4 z-50 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium shadow-lg">{toast}</div>
      )}

      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <p className="font-mono text-sm text-slate-400">xcrow / control panel</p>
        <button onClick={adminLogout} className="text-sm text-slate-400 hover:text-white">Sign out</button>
      </header>

      <nav className="flex gap-1 border-b border-white/10 px-6">
        {['overview', 'users', 'escrows', 'tickets'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm capitalize ${tab === t ? 'border-b-2 border-emerald-500 text-white' : 'text-slate-400'}`}
          >
            {t}{t === 'tickets' && tickets.filter((x) => x.status === 'open').length > 0 && (
              <span className="ml-2 rounded-full bg-rose-500 px-1.5 py-0.5 text-xs">{tickets.filter((x) => x.status === 'open').length}</span>
            )}
          </button>
        ))}
      </nav>

      <main className="p-6">
        {tab === 'overview' && overview && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Users" value={overview.userCount} />
            <Stat label="Escrows" value={overview.escrowCount} />
            <Stat label="Open tickets" value={overview.openTickets} />
            <Stat label="Funds held" value={money(overview.fundsHeld)} />
          </div>
        )}

        {tab === 'users' && (
          <Table
            headers={['Name', 'Email', 'Status', '']}
            rows={users.map((u) => [
              u.name,
              u.email,
              <StatusBadge key="s" active={u.isActive} />,
              <button key="a" onClick={() => toggleUser(u._id)} className="text-xs text-emerald-400 hover:underline">
                {u.isActive ? 'Suspend' : 'Reactivate'}
              </button>,
            ])}
          />
        )}

        {tab === 'escrows' && (
          <Table
            headers={['Title', 'Amount', 'Buyer', 'Seller', 'Status', 'Actions']}
            rows={escrows.map((e) => [
              e.title,
              money(e.amount / 100),
              e.buyer?.email,
              e.seller?.email || '—',
              <StatusPill key="p" status={e.status} />,
              <div key="a" className="flex gap-3">
                {['funded', 'in_progress', 'delivered', 'disputed'].includes(e.status) && (
                  <button onClick={() => refund(e._id)} className="text-xs text-rose-400 hover:underline">Refund buyer</button>
                )}
                {e.status === 'completed' && e.payout?.status === 'pending' && (
                  <button onClick={() => approvePayout(e._id)} className="text-xs text-emerald-400 hover:underline">Approve payout</button>
                )}
              </div>,
            ])}
          />
        )}

        {tab === 'tickets' && (
          <div className="space-y-3">
            {tickets.map((t) => <TicketRow key={t._id} ticket={t} onReplied={refresh} />)}
            {tickets.length === 0 && <p className="text-sm text-slate-400">No support tickets yet.</p>}
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-navy-900 p-5">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}

function StatusBadge({ active }) {
  return (
    <span className={`badge ${active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
      {active ? 'Active' : 'Suspended'}
    </span>
  );
}

function Table({ headers, rows }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-400">
          <tr>{headers.map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-white/5">
              {row.map((cell, j) => <td key={j} className="px-4 py-3">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TicketRow({ ticket, onReplied }) {
  const [reply, setReply] = useState('');
  const [open, setOpen] = useState(false);

  const send = async (resolve = false) => {
    await adminApi.post(`/tickets/${ticket._id}/reply`, { message: reply, resolve });
    setReply('');
    onReplied();
  };

  return (
    <div className="rounded-xl border border-white/10 bg-navy-900 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">{ticket.subject}</p>
          <p className="text-xs text-slate-400">{ticket.raisedBy?.email} {ticket.escrow ? `· re: ${ticket.escrow.title}` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge ${ticket.status === 'open' ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
            {ticket.status}
          </span>
          <button onClick={() => setOpen(!open)} className="text-xs text-slate-400 hover:text-white">{open ? 'Hide' : 'View'}</button>
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
          {ticket.messages.map((m, i) => (
            <p key={i} className={`text-sm ${m.senderType === 'admin' ? 'text-emerald-400' : 'text-slate-300'}`}>
              <span className="font-medium">{m.senderType === 'admin' ? 'Support' : 'User'}:</span> {m.text}
            </p>
          ))}
          <div className="flex gap-2 pt-2">
            <input className="flex-1 rounded-lg border border-white/10 bg-navy-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              placeholder="Reply…" value={reply} onChange={(e) => setReply(e.target.value)} />
            <button onClick={() => send(false)} className="rounded-lg bg-emerald-500 px-3 py-2 text-sm hover:bg-emerald-600">Reply</button>
            <button onClick={() => send(true)} className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20">Resolve</button>
          </div>
        </div>
      )}
    </div>
  );
}
