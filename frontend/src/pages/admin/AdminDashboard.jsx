import { useEffect, useState } from 'react';
import { adminApi } from '../../api/axios.js';
import { getSocket } from '../../api/socket.js';
import { useAuth } from '../../context/AuthContext.jsx';
import StatusPill from '../../components/StatusPill.jsx';

function money(amount) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount);
}

export default function AdminDashboard() {
  const { adminLogout } = useAuth();
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [escrows, setEscrows] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [toast, setToast] = useState('');
  const [live, setLive] = useState(false);
  const [selectedEscrow, setSelectedEscrow] = useState(null);

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

  const flashLive = () => {
    setLive(true);
    setTimeout(() => setLive(false), 1200);
  };

  useEffect(() => {
    refresh();
    const socket = getSocket();
    socket.connect();
    socket.on('support:new-ticket', (ticket) => {
      setTickets((prev) => [ticket, ...prev]);
      setToast(`New support ticket: ${ticket.subject}`);
      setTimeout(() => setToast(''), 5000);
      flashLive();
    });
    socket.on('support:ticket-updated', (updated) => {
      setTickets((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));
      flashLive();
    });
    socket.on('admin:refresh', () => {
      refresh();
      flashLive();
    });
    return () => {
      socket.off('support:new-ticket');
      socket.off('support:ticket-updated');
      socket.off('admin:refresh');
    };
  }, []);

  const toggleUser = async (id) => {
    await adminApi.patch(`/users/${id}/toggle-active`);
    refresh();
  };

  const cancelEscrow = async (id) => {
    if (!confirm('Cancel this escrow? Only possible before any funds are involved.')) return;
    await adminApi.post(`/escrows/${id}/cancel`);
    refresh();
  };

  const refund = async (id) => {
    if (!confirm('Refund the buyer for this escrow?')) return;
    await adminApi.post(`/escrows/${id}/refund`);
    refresh();
  };

  const forceRelease = async (id) => {
    if (!confirm('Force-release these funds to the seller now, skipping buyer confirmation?')) return;
    await adminApi.post(`/escrows/${id}/force-release`);
    refresh();
  };

  const approvePayout = async (id) => {
    if (!confirm('Release funds to the seller now?')) return;
    await adminApi.post(`/escrows/${id}/approve-payout`);
    refresh();
  };

  const confirmCrypto = async (id, txHash) => {
    if (!confirm(`Confirm you've verified this USDT transaction on-chain?\n\nTx: ${txHash}`)) return;
    await adminApi.post(`/escrows/${id}/confirm-crypto`);
    refresh();
  };

  return (
    <div className="min-h-screen bg-navy-950 text-white">
      {toast && (
        <div className="fixed right-4 top-4 z-50 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium shadow-lg">{toast}</div>
      )}

      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-2">
          <p className="font-mono text-sm text-slate-400">xcrow / control panel</p>
          <span className={`h-2 w-2 rounded-full ${live ? 'bg-emerald-400' : 'bg-white/20'}`} title="Live connection" />
        </div>
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
              <button key="t" onClick={() => setSelectedEscrow(e)} className="text-left font-medium text-white hover:underline">
                {e.title}
              </button>,
              money(e.amount / 100),
              e.buyer?.email || '—',
              e.seller?.email || '—',
              <StatusPill key="p" status={e.status} />,
              <div key="a" className="flex flex-col gap-1">
                {e.usdtClaim?.txHash && !e.usdtClaim.confirmedAt && (
                  <button onClick={() => confirmCrypto(e._id, e.usdtClaim.txHash)} className="text-left text-xs text-emerald-400 hover:underline">
                    Confirm USDT ({e.usdtClaim.txHash.slice(0, 10)}…)
                  </button>
                )}
                <div className="flex flex-wrap gap-3">
                  {['awaiting_seller', 'awaiting_buyer', 'awaiting_payment'].includes(e.status) && (
                    <button onClick={() => cancelEscrow(e._id)} className="text-xs text-slate-400 hover:underline">Cancel</button>
                  )}
                  {['funded', 'in_progress', 'delivered', 'disputed'].includes(e.status) && (
                    <>
                      <button onClick={() => refund(e._id)} className="text-xs text-rose-400 hover:underline">Refund buyer</button>
                      <button onClick={() => forceRelease(e._id)} className="text-xs text-emerald-400 hover:underline">Force release</button>
                    </>
                  )}
                  {e.status === 'completed' && e.payout?.status === 'pending' && (
                    <button onClick={() => approvePayout(e._id)} className="text-xs text-emerald-400 hover:underline">Approve payout</button>
                  )}
                </div>
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

      {selectedEscrow && (
        <EscrowDetailDrawer
          escrow={escrows.find((e) => e._id === selectedEscrow._id) || selectedEscrow}
          onClose={() => setSelectedEscrow(null)}
        />
      )}
    </div>
  );
}

function EscrowDetailDrawer({ escrow, onClose }) {
  const [messages, setMessages] = useState(null);

  useEffect(() => {
    adminApi.get(`/escrows/${escrow._id}/messages`).then(({ data }) => setMessages(data.messages)).catch(() => setMessages([]));
  }, [escrow._id]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
      <div className="h-full w-full max-w-lg overflow-y-auto bg-navy-900 p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-display text-lg font-bold">{escrow.title}</p>
            <p className="text-xs text-slate-400 font-mono">{escrow._id}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <Field label="Amount" value={money(escrow.amount / 100)} />
          <Field label="Status" value={<StatusPill status={escrow.status} />} />
          <Field label="Buyer" value={escrow.buyer?.email || '—'} />
          <Field label="Seller" value={escrow.seller?.email || '—'} />
          <Field label="Payout status" value={escrow.payout?.status || 'none'} />
          <Field label="Funding method" value={escrow.fundingMethod || 'paystack'} />
          {escrow.thirdParties?.length > 0 && (
            <Field label="Third parties" value={escrow.thirdParties.map((tp) => tp.email).join(', ')} />
          )}
          {escrow.usdtClaim?.txHash && (
            <Field label="USDT tx hash" value={<span className="break-all font-mono text-xs">{escrow.usdtClaim.txHash}</span>} />
          )}
        </div>

        {escrow.description && (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Description</p>
            <p className="mt-1 text-sm text-slate-200">{escrow.description}</p>
          </div>
        )}

        <div className="mt-6">
          <p className="text-xs uppercase tracking-wide text-slate-400">Chat transcript</p>
          <div className="mt-2 max-h-80 space-y-2 overflow-y-auto rounded-lg border border-white/10 bg-navy-950 p-3">
            {messages === null ? (
              <p className="text-xs text-slate-500">Loading…</p>
            ) : messages.length === 0 ? (
              <p className="text-xs text-slate-500">No messages yet.</p>
            ) : (
              messages.map((m) => (
                <p key={m._id} className={`text-xs ${m.isSystem ? 'text-slate-500 italic' : 'text-slate-200'}`}>
                  {!m.isSystem && <span className="font-semibold text-emerald-400">{m.sender?.name}: </span>}
                  {m.text}
                </p>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-0.5 text-slate-100">{value}</div>
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
