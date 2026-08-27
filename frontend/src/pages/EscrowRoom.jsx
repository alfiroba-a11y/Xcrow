import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import ShieldStatus from '../components/ShieldStatus.jsx';
import StatusPill from '../components/StatusPill.jsx';
import { api } from '../api/axios.js';
import { getSocket } from '../api/socket.js';
import { useAuth } from '../context/AuthContext.jsx';

function formatMoney(kobo, currency) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: currency || 'NGN' }).format(kobo / 100);
}

export default function EscrowRoom() {
  const { id } = useParams();
  const { user } = useAuth();

  const [escrow, setEscrow] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const bottomRef = useRef(null);

  const isBuyer = escrow && String(escrow.buyer._id || escrow.buyer) === String(user.id);
  const isSeller = escrow && escrow.seller && String(escrow.seller._id || escrow.seller) === String(user.id);

  const loadEscrow = async () => {
    const { data } = await api.get(`/escrows/${id}`);
    setEscrow(data.escrow);
  };

  useEffect(() => {
    (async () => {
      try {
        await loadEscrow();
        const { data } = await api.get(`/escrows/${id}/messages`);
        setMessages(data.messages);
      } catch (err) {
        setError(err.response?.data?.message || 'Could not load this escrow');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const socket = getSocket();
    socket.connect();
    socket.emit('escrow:join', id);
    socket.on('escrow:message', (msg) => setMessages((prev) => [...prev, msg]));
    return () => {
      socket.off('escrow:message');
    };
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    getSocket().emit('escrow:message', { escrowId: id, text });
    setText('');
  };

  const handleAction = async (action) => {
    setError('');
    setBusy(true);
    try {
      const { data } = await api.post(`/escrows/${id}/${action}`);
      setEscrow(data.escrow);
    } catch (err) {
      setError(err.response?.data?.message || 'That action failed');
    } finally {
      setBusy(false);
    }
  };

  const handleFund = async () => {
    setError('');
    setBusy(true);
    try {
      const { data } = await api.post(`/payments/${id}/initialize`);
      const popup = new window.PaystackPop();
      popup.resumeTransaction(data.accessCode, {
        onSuccess: async (transaction) => {
          try {
            const res = await api.post(`/payments/${id}/verify`, { reference: transaction.reference });
            setEscrow(res.data.escrow);
          } catch (err) {
            setError(err.response?.data?.message || 'Payment made but verification failed — contact support.');
          }
        },
        onCancel: () => {},
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not start payment');
    } finally {
      setBusy(false);
    }
  };

  if (error && !escrow) {
    return (
      <div>
        <Navbar />
        <p className="mx-auto mt-10 max-w-md rounded-lg bg-rose-500/10 px-4 py-3 text-center text-sm text-rose-500">{error}</p>
      </div>
    );
  }
  if (!escrow) return <div><Navbar /><p className="mt-10 text-center text-sm text-slate-400">Loading…</p></div>;

  const other = isBuyer ? escrow.seller : escrow.buyer;

  return (
    <div>
      <Navbar />
      <div className="mx-auto grid max-w-6xl gap-6 px-6 py-8 md:grid-cols-[1fr_320px]">
        <div className="card flex h-[70vh] flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <div>
              <p className="font-display font-semibold text-navy-900">{escrow.title}</p>
              <p className="text-xs text-slate-500">
                {other ? `Chatting with ${other.name}` : 'Waiting for the seller to join'}
              </p>
            </div>
            <StatusPill status={escrow.status} />
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m) => (
              <div key={m._id} className={m.isSystem ? 'text-center' : (m.sender?._id || m.sender) === user.id ? 'flex justify-end' : 'flex justify-start'}>
                {m.isSystem ? (
                  <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">{m.text}</span>
                ) : (
                  <div className={`max-w-xs rounded-2xl px-4 py-2 text-sm ${
                    (m.sender?._id || m.sender) === user.id ? 'bg-navy-700 text-white' : 'bg-slate-100 text-navy-900'
                  }`}>
                    {m.text}
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={sendMessage} className="flex gap-2 border-t border-slate-100 p-3">
            <input
              className="input"
              placeholder={escrow.seller ? 'Type a message…' : 'Chat unlocks once the seller joins'}
              disabled={!escrow.seller}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button className="btn-accent" disabled={!escrow.seller}>Send</button>
          </form>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <ShieldStatus status={escrow.status} />
            <p className="mt-4 text-2xl font-bold text-navy-900">{formatMoney(escrow.amount, escrow.currency)}</p>
            {escrow.description && <p className="mt-1 text-sm text-slate-500">{escrow.description}</p>}

            {error && <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-500">{error}</p>}

            <div className="mt-4 space-y-2">
              {isBuyer && escrow.status === 'awaiting_payment' && (
                <button onClick={handleFund} disabled={busy} className="btn-accent w-full">Fund escrow with Paystack</button>
              )}
              {isSeller && ['funded', 'in_progress'].includes(escrow.status) && (
                <button onClick={() => handleAction('deliver')} disabled={busy} className="btn-primary w-full">Mark as delivered</button>
              )}
              {isBuyer && escrow.status === 'delivered' && (
                <button onClick={() => handleAction('confirm')} disabled={busy} className="btn-accent w-full">Confirm receipt & release funds</button>
              )}
              {isBuyer && ['awaiting_seller', 'awaiting_payment'].includes(escrow.status) && (
                <button onClick={() => handleAction('cancel')} disabled={busy} className="btn-ghost w-full text-rose-500">Cancel escrow</button>
              )}
            </div>
          </div>

          {isSeller && <BankDetailsCard />}

          <div className="card p-5">
            <p className="font-display text-sm font-semibold text-navy-900">Something wrong?</p>
            <p className="mt-1 text-xs text-slate-500">Escalate to a human — this reaches our support team directly.</p>
            <button onClick={() => setSupportOpen(true)} className="btn-ghost mt-3 w-full">Contact support</button>
          </div>
        </div>
      </div>

      {supportOpen && <SupportModal escrowId={id} onClose={() => setSupportOpen(false)} />}
    </div>
  );
}

function BankDetailsCard() {
  const { user } = useAuth();
  const [banks, setBanks] = useState([]);
  const [form, setForm] = useState({ bankCode: '', accountNumber: '' });
  const [saved, setSaved] = useState(user?.hasBankDetails);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (saved) return;
    api.get('/payments/banks').then(({ data }) => setBanks(data.banks)).catch(() => {});
  }, [saved]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/payments/bank-details', form);
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not verify that account');
    } finally {
      setLoading(false);
    }
  };

  if (saved) {
    return (
      <div className="card p-5">
        <p className="font-display text-sm font-semibold text-navy-900">Payout account</p>
        <p className="mt-1 text-xs text-emerald-600">Linked — you're ready to receive payouts.</p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <p className="font-display text-sm font-semibold text-navy-900">Add your payout account</p>
      <p className="mt-1 text-xs text-slate-500">Needed before funds can be released to you.</p>
      <form onSubmit={submit} className="mt-3 space-y-2">
        {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-500">{error}</p>}
        <select required className="input text-sm" value={form.bankCode}
          onChange={(e) => setForm({ ...form, bankCode: e.target.value })}>
          <option value="">Select bank</option>
          {banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
        </select>
        <input required className="input text-sm" placeholder="Account number"
          value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} />
        <button disabled={loading} className="btn-primary w-full text-sm">{loading ? 'Verifying…' : 'Save account'}</button>
      </form>
    </div>
  );
}

function SupportModal({ escrowId, onClose }) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/support', { escrowId, subject, message });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send your message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-navy-950/40 p-6">
      <div className="card w-full max-w-md p-6">
        {sent ? (
          <>
            <p className="font-display font-semibold text-navy-900">Support has been notified</p>
            <p className="mt-1 text-sm text-slate-500">We'll follow up here in the chat and by email.</p>
            <button onClick={onClose} className="btn-primary mt-4 w-full">Close</button>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <p className="font-display font-semibold text-navy-900">Contact support</p>
            {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}
            <div>
              <label className="label">Subject</label>
              <input required className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <label className="label">What's going on?</label>
              <textarea required rows={4} className="input" value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
              <button disabled={loading} className="btn-accent flex-1">{loading ? 'Sending…' : 'Send'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
