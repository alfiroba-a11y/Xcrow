import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import ShieldStatus from '../components/ShieldStatus.jsx';
import StatusPill from '../components/StatusPill.jsx';
import CopyButton from '../components/CopyButton.jsx';
import LockCodeBadge from '../components/LockCodeBadge.jsx';
import { api } from '../api/axios.js';
import { getSocket } from '../api/socket.js';
import { useAuth } from '../context/AuthContext.jsx';

function formatMoney(cents, currency) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: currency || 'KES' }).format(cents / 100);
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
  const [inviteOpen, setInviteOpen] = useState(false);
  const [fundTab, setFundTab] = useState('paystack');
  const bottomRef = useRef(null);

  const isBuyer = escrow && escrow.buyer && String(escrow.buyer._id || escrow.buyer) === String(user.id);
  const isSeller = escrow && escrow.seller && String(escrow.seller._id || escrow.seller) === String(user.id);
  const isMainParty = isBuyer || isSeller;
  const isThirdParty = escrow && !isMainParty && (escrow.thirdParties || []).some(
    (tp) => String(tp._id || tp) === String(user.id)
  );

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

  const handleFundPaystack = async () => {
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

  const thirdParties = escrow.thirdParties || [];
  const others = [
    escrow.buyer && !isBuyer ? { ...escrow.buyer, tag: 'Buyer' } : null,
    escrow.seller && !isSeller ? { ...escrow.seller, tag: 'Seller' } : null,
    ...thirdParties.filter((tp) => String(tp._id || tp) !== String(user.id)).map((tp) => ({ ...tp, tag: 'Observer' })),
  ].filter(Boolean);

  return (
    <div>
      <Navbar />
      <div className="mx-auto grid max-w-6xl gap-6 px-6 py-8 md:grid-cols-[1fr_320px]">
        <div className="card flex h-[70vh] flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <div>
              <p className="font-display font-semibold text-navy-900">
                {escrow.title}
                {escrow.mode === 'ai' && <span className="ml-2 badge bg-emerald-500/10 text-emerald-600">🤖 AI-Assisted</span>}
              </p>
              <p className="text-xs text-slate-500">
                {others.length
                  ? others.map((o) => `${o.name} (${o.tag})`).join(' · ')
                  : 'Waiting for the other side to join'}
              </p>
            </div>
            <StatusPill status={escrow.status} payoutStatus={escrow.payout?.status} />
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m) => {
              const isAI = !m.sender && m.senderLabel;
              const mine = (m.sender?._id || m.sender) === user.id;
              return (
                <div key={m._id} className={m.isSystem ? 'text-center' : mine ? 'flex justify-end' : 'flex justify-start'}>
                  {m.isSystem ? (
                    <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">{m.text}</span>
                  ) : isAI ? (
                    <div className="max-w-xs rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-navy-900">
                      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">🤖 {m.senderLabel}</p>
                      {m.text}
                    </div>
                  ) : (
                    <div className={`max-w-xs rounded-2xl px-4 py-2 text-sm ${mine ? 'bg-navy-700 text-white' : 'bg-slate-100 text-navy-900'}`}>
                      {!mine && m.sender?.name && (
                        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-60">{m.sender.name}</p>
                      )}
                      {m.text}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={sendMessage} className="flex gap-2 border-t border-slate-100 p-3">
            <input
              className="input"
              placeholder={
                !(escrow.buyer && escrow.seller)
                  ? 'Chat unlocks once both sides have joined'
                  : escrow.mode === 'ai'
                  ? 'Type a message, or "/ai" + a question…'
                  : 'Type a message…'
              }
              disabled={!(escrow.buyer && escrow.seller)}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            {escrow.mode === 'ai' && escrow.buyer && escrow.seller && (
              <button type="button" onClick={() => setText('/ai ')} className="btn-ghost whitespace-nowrap" title="Ask the AI assistant">
                🤖 Ask AI
              </button>
            )}
            <button className="btn-accent" disabled={!(escrow.buyer && escrow.seller)}>Send</button>
          </form>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <ShieldStatus status={escrow.status} />
            <p className="mt-4 text-2xl font-bold text-navy-900">{formatMoney(escrow.amount, escrow.currency)}</p>
            {escrow.description && <p className="mt-1 text-sm text-slate-500">{escrow.description}</p>}

            <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
              <span>ID: {escrow._id}</span>
              <CopyButton value={escrow._id} label="Copy ID" />
            </div>

            {error && <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-500">{error}</p>}

            <div className="mt-4 space-y-2">
              {isBuyer && escrow.status === 'awaiting_payment' && (
                <FundingPanel
                  fundTab={fundTab} setFundTab={setFundTab}
                  onPaystack={handleFundPaystack} busy={busy}
                  escrowId={id} escrow={escrow} onUpdated={setEscrow} setError={setError}
                />
              )}
              {isSeller && ['funded', 'in_progress'].includes(escrow.status) && (
                <button onClick={() => handleAction('deliver')} disabled={busy} className="btn-primary w-full">Mark as delivered</button>
              )}
              {isBuyer && escrow.status === 'delivered' && (
                <button onClick={() => handleAction('confirm')} disabled={busy} className="btn-accent w-full">Confirm receipt & release funds</button>
              )}
              {escrow.status === 'completed' && (escrow.payout?.status === 'pending' || escrow.payout?.status === 'processing') && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-700">
                  <span className="h-2 w-2 flex-none animate-pulse rounded-full bg-emerald-500" />
                  Your payout is being processed.
                </div>
              )}
              {escrow.status === 'completed' && escrow.payout?.status === 'paid' && (
                <p className="rounded-lg bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-700">✅ Payout sent.</p>
              )}
              {isMainParty && ['awaiting_seller', 'awaiting_buyer', 'awaiting_payment'].includes(escrow.status) && (
                <button onClick={() => handleAction('cancel')} disabled={busy} className="btn-ghost w-full text-rose-500">Cancel escrow</button>
              )}
            </div>
          </div>

          {isSeller && <BankDetailsCard />}

          {isMainParty && (
            <div className="card p-5">
              <p className="font-display text-sm font-semibold text-navy-900">Add someone to watch</p>
              <p className="mt-1 text-xs text-slate-500">Invite a mediator or inspector into the chat. They can't touch funds.</p>
              <button onClick={() => setInviteOpen(true)} className="btn-ghost mt-3 w-full">Invite a third party</button>
            </div>
          )}

          <div className="card p-5">
            <p className="font-display text-sm font-semibold text-navy-900">Something wrong?</p>
            <p className="mt-1 text-xs text-slate-500">Escalate to a human — this reaches our support team directly.</p>
            <button onClick={() => setSupportOpen(true)} className="btn-ghost mt-3 w-full">Contact support</button>
          </div>
        </div>
      </div>

      {supportOpen && <SupportModal escrowId={id} onClose={() => setSupportOpen(false)} />}
      {inviteOpen && <InviteThirdPartyModal escrowId={id} onClose={() => setInviteOpen(false)} />}
    </div>
  );
}

function FundingPanel({ escrowId, escrow, onUpdated, setError, busy, onPaystack, fundTab, setFundTab }) {
  const [usdt, setUsdt] = useState(null);
  const [txHash, setTxHash] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [phone, setPhone] = useState('');
  const [mpesaStatus, setMpesaStatus] = useState(null); // null | 'sending' | 'waiting' | 'error'
  const [mpesaMessage, setMpesaMessage] = useState('');

  useEffect(() => {
    if (fundTab !== 'usdt' || usdt) return;
    api.get('/payments/usdt-address').then(({ data }) => setUsdt(data)).catch(() => setUsdt(false));
  }, [fundTab, usdt]);

  // While waiting for the STK push to be completed, poll the escrow itself —
  // the webhook is what actually marks it funded, this just notices when
  // that's happened so the UI can move on without a manual refresh.
  useEffect(() => {
    if (mpesaStatus !== 'waiting') return;
    let cancelled = false;
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts += 1;
      try {
        const { data } = await api.get(`/escrows/${escrowId}`);
        if (cancelled) return;
        if (data.escrow.status !== 'awaiting_payment') {
          onUpdated(data.escrow);
          setMpesaStatus(null);
          clearInterval(interval);
        } else if (attempts > 40) { // ~2 minutes at 3s intervals
          setMpesaStatus('error');
          setMpesaMessage('Still waiting on confirmation — check your phone, or try again.');
          clearInterval(interval);
        }
      } catch {
        // transient errors are fine, just keep polling
      }
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [mpesaStatus, escrowId, onUpdated]);

  const submitClaim = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const { data } = await api.post(`/payments/${escrowId}/submit-crypto`, { txHash });
      onUpdated(data.escrow);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit that reference');
    } finally {
      setSubmitting(false);
    }
  };

  const startMpesa = async (e) => {
    e.preventDefault();
    setMpesaStatus('sending');
    setError('');
    try {
      const { data } = await api.post(`/payments/${escrowId}/charge-mpesa`, { phone });
      setMpesaMessage(data.displayText);
      setMpesaStatus('waiting');
    } catch (err) {
      setMpesaStatus('error');
      setMpesaMessage(err.response?.data?.message || 'Could not start the M-Pesa prompt');
    }
  };

  if (escrow.usdtClaim?.txHash && !escrow.usdtClaim.confirmedAt) {
    return (
      <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
        USDT reference submitted — waiting for an admin to confirm it on-chain. This can take a little while.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-2 flex gap-1 rounded-lg bg-slate-100 p-1 text-xs font-medium">
        <button type="button" onClick={() => setFundTab('mpesa')}
          className={`flex-1 rounded-md py-1.5 ${fundTab === 'mpesa' ? 'bg-white shadow-sm text-navy-900' : 'text-slate-500'}`}>
          M-Pesa
        </button>
        <button type="button" onClick={() => setFundTab('paystack')}
          className={`flex-1 rounded-md py-1.5 ${fundTab === 'paystack' ? 'bg-white shadow-sm text-navy-900' : 'text-slate-500'}`}>
          Card
        </button>
        <button type="button" onClick={() => setFundTab('usdt')}
          className={`flex-1 rounded-md py-1.5 ${fundTab === 'usdt' ? 'bg-white shadow-sm text-navy-900' : 'text-slate-500'}`}>
          USDT
        </button>
      </div>

      {fundTab === 'mpesa' ? (
        mpesaStatus === 'waiting' ? (
          <div className="space-y-2 rounded-lg bg-emerald-500/10 px-3 py-3 text-center">
            <span className="mx-auto block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            <p className="text-sm text-emerald-700">{mpesaMessage}</p>
            <p className="text-xs text-slate-500">This page updates itself once you confirm on your phone.</p>
          </div>
        ) : (
          <form onSubmit={startMpesa} className="space-y-2">
            {mpesaStatus === 'error' && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-500">{mpesaMessage}</p>}
            <input required className="input text-sm" placeholder="+254712345678"
              value={phone} onChange={(e) => setPhone(e.target.value)} />
            <button disabled={mpesaStatus === 'sending'} className="btn-accent w-full text-sm">
              {mpesaStatus === 'sending' ? 'Sending prompt…' : 'Pay with M-Pesa'}
            </button>
            <p className="text-center text-[11px] text-slate-400">You'll get a prompt on your phone — enter your PIN to complete it.</p>
          </form>
        )
      ) : fundTab === 'paystack' ? (
        <button onClick={onPaystack} disabled={busy} className="btn-accent w-full">Pay by card</button>
      ) : usdt === false ? (
        <p className="text-xs text-slate-400">USDT payments aren't set up for this escrow.</p>
      ) : !usdt ? (
        <p className="text-xs text-slate-400">Loading…</p>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-center">
            <img
              alt="USDT deposit address QR code"
              className="h-36 w-36 rounded-lg border border-slate-100"
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(usdt.address)}`}
            />
          </div>
          <p className="text-center text-xs text-slate-500">Send exactly this escrow's amount in USDT ({usdt.network}) to:</p>
          <div className="flex items-center gap-2">
            <input readOnly className="input font-mono text-xs" value={usdt.address} />
            <CopyButton value={usdt.address} />
          </div>
          <form onSubmit={submitClaim} className="space-y-2">
            <input required className="input text-sm" placeholder="Paste your transaction hash after sending"
              value={txHash} onChange={(e) => setTxHash(e.target.value)} />
            <button disabled={submitting} className="btn-primary w-full text-sm">
              {submitting ? 'Submitting…' : "I've sent it"}
            </button>
          </form>
          <p className="text-center text-[11px] text-slate-400">
            An admin verifies every USDT payment on-chain by hand before it's marked funded — this isn't automatic.
          </p>
        </div>
      )}
    </div>
  );
}

function InviteThirdPartyModal({ escrowId, onClose }) {
  const [label, setLabel] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post(`/escrows/${escrowId}/invite-third-party`, { label });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create the invite');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-navy-950/40 p-6">
      <div className="card w-full max-w-md p-6">
        {result ? (
          <>
            <p className="font-display font-semibold text-navy-900">Invite ready</p>
            <p className="mt-1 text-sm text-slate-500">Send the link and lock code separately, just like the main invite.</p>
            <div className="mt-4 space-y-2">
              <div className="flex gap-2">
                <input readOnly className="input font-mono text-sm" value={result.inviteUrl} />
                <CopyButton value={result.inviteUrl} />
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <LockCodeBadge code={result.lockCode} />
                <CopyButton value={result.lockCode} label="Copy code" />
              </div>
            </div>
            <button onClick={onClose} className="btn-primary mt-6 w-full">Done</button>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <p className="font-display font-semibold text-navy-900">Invite a third party</p>
            {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}
            <div>
              <label className="label">Label (optional)</label>
              <input className="input" placeholder="e.g. Mediator, Inspector" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
              <button disabled={loading} className="btn-accent flex-1">{loading ? 'Creating…' : 'Create invite'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function BankDetailsCard() {
  const { user } = useAuth();
  const [method, setMethod] = useState('mobile_money');
  const [banks, setBanks] = useState([]);
  const [form, setForm] = useState({ bankCode: '', accountNumber: '' });
  const [saved, setSaved] = useState(user?.hasBankDetails);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (saved) return;
    api.get(`/payments/banks?method=${method}`).then(({ data }) => setBanks(data.banks)).catch(() => {});
  }, [saved, method]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/payments/bank-details', { ...form, method });
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

      <div className="mt-3 mb-2 flex gap-1 rounded-lg bg-slate-100 p-1 text-xs font-medium">
        <button type="button" onClick={() => setMethod('mobile_money')}
          className={`flex-1 rounded-md py-1.5 ${method === 'mobile_money' ? 'bg-white shadow-sm text-navy-900' : 'text-slate-500'}`}>
          M-Pesa
        </button>
        <button type="button" onClick={() => setMethod('bank')}
          className={`flex-1 rounded-md py-1.5 ${method === 'bank' ? 'bg-white shadow-sm text-navy-900' : 'text-slate-500'}`}>
          Bank account
        </button>
      </div>

      <form onSubmit={submit} className="space-y-2">
        {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-500">{error}</p>}
        <select required className="input text-sm" value={form.bankCode}
          onChange={(e) => setForm({ ...form, bankCode: e.target.value })}>
          <option value="">{method === 'mobile_money' ? 'Select provider' : 'Select bank'}</option>
          {banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
        </select>
        <input required className="input text-sm" placeholder={method === 'mobile_money' ? 'M-Pesa phone number' : 'Account number'}
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
