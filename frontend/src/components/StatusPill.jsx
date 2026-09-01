const STYLES = {
  awaiting_seller: 'bg-slate-100 text-slate-700',
  awaiting_buyer: 'bg-slate-100 text-slate-700',
  awaiting_payment: 'bg-amber-500/10 text-amber-500',
  funded: 'bg-navy-700/10 text-navy-700',
  in_progress: 'bg-navy-700/10 text-navy-700',
  delivered: 'bg-emerald-500/10 text-emerald-600',
  completed: 'bg-emerald-500/15 text-emerald-600',
  processing: 'bg-emerald-500/15 text-emerald-600',
  disputed: 'bg-amber-500/15 text-amber-500',
  cancelled: 'bg-slate-100 text-slate-500',
  refunded: 'bg-rose-500/10 text-rose-500',
};

const LABELS = {
  awaiting_seller: 'Awaiting seller',
  awaiting_buyer: 'Awaiting buyer',
  awaiting_payment: 'Awaiting payment',
  funded: 'Funded',
  in_progress: 'In progress',
  delivered: 'Delivered',
  completed: 'Completed',
  disputed: 'Disputed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

// payoutStatus lets the "completed" state read as "Payout processing" /
// "Payout sent" instead of a flat "Completed" once the buyer has confirmed —
// makes the flow feel continuous instead of stalling on one static label.
export default function StatusPill({ status, payoutStatus }) {
  let label = LABELS[status] || status;
  let style = STYLES[status] || 'bg-slate-100 text-slate-600';

  if (status === 'completed' && (payoutStatus === 'pending' || payoutStatus === 'processing')) {
    label = 'Payout processing';
    style = STYLES.processing;
  } else if (status === 'completed' && payoutStatus === 'paid') {
    label = 'Payout sent';
  }

  return <span className={`badge ${style}`}>{label}</span>;
}
