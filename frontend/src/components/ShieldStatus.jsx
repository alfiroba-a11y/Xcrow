const STEPS = ['awaiting_payment', 'funded', 'in_progress', 'delivered', 'completed'];

const LABELS = {
  awaiting_seller: 'Waiting for seller',
  awaiting_buyer: 'Waiting for buyer',
  awaiting_payment: 'Waiting for payment',
  funded: 'Funds held',
  in_progress: 'In progress',
  delivered: 'Delivered',
  completed: 'Completed',
  disputed: 'In dispute',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

const TERMINAL_COLORS = {
  disputed: '#E8A33D',
  cancelled: '#8A9AAE',
  refunded: '#E0524F',
};

// Renders the escrow's progress as a shield filling from outline to full
// color, the same two-tone (navy -> emerald) sweep as the Xcrow mark.
export default function ShieldStatus({ status, size = 72 }) {
  const isTerminalOdd = TERMINAL_COLORS[status];
  const isPreLink = status === 'awaiting_seller' || status === 'awaiting_buyer';
  const stepIndex = STEPS.indexOf(status);
  const pct = isTerminalOdd || isPreLink ? 6 : Math.max(6, ((stepIndex + 1) / STEPS.length) * 100);
  const fillColor = isTerminalOdd || 'url(#xcrow-shield-gradient)';
  const clipHeight = 100 - pct;

  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size} viewBox="0 0 100 110" aria-hidden="true">
        <defs>
          <linearGradient id="xcrow-shield-gradient" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#1B3A63" />
            <stop offset="100%" stopColor="#2FA968" />
          </linearGradient>
          <clipPath id="xcrow-shield-clip">
            <path d="M50 4 L90 20 V52 C90 78 72 96 50 106 C28 96 10 78 10 52 V20 Z" />
          </clipPath>
        </defs>

        <path
          d="M50 4 L90 20 V52 C90 78 72 96 50 106 C28 96 10 78 10 52 V20 Z"
          fill="none"
          stroke="#E9EEF3"
          strokeWidth="3"
        />
        <g clipPath="url(#xcrow-shield-clip)">
          <rect x="0" y={clipHeight} width="100" height="110" fill={fillColor} style={{ transition: 'y 500ms ease' }} />
        </g>
        {(status === 'funded' || status === 'in_progress' || status === 'delivered' || status === 'completed') && (
          <rect x="42" y="48" width="16" height="14" rx="2" fill="white" opacity="0.9" />
        )}
      </svg>
      <div>
        <p className="font-display text-sm font-semibold text-navy-900">{LABELS[status] || status}</p>
        <p className="text-xs text-slate-500">
          {isTerminalOdd || isPreLink ? '—' : `Step ${stepIndex + 1} of ${STEPS.length}`}
        </p>
      </div>
    </div>
  );
}
