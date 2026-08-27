import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';

export default function Landing() {
  return (
    <div>
      <Navbar />

      <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <span className="badge bg-emerald-500/10 text-emerald-600">Secured by Paystack</span>
            <h1 className="mt-4 font-display text-4xl font-bold leading-tight text-navy-900 md:text-5xl">
              Neither of you moves first.
            </h1>
            <p className="mt-4 max-w-md text-lg text-slate-500">
              Xcrow holds the payment until the seller delivers and the buyer confirms —
              locked to just the two of you, from a link only they can unlock.
            </p>
            <div className="mt-8 flex gap-3">
              <Link to="/register" className="btn-primary text-base">Start an escrow</Link>
              <Link to="/login" className="btn-ghost text-base">Log in</Link>
            </div>
          </div>

          <div className="card p-8">
            <ol className="space-y-6">
              <Step n="1" title="Buyer opens an escrow" desc="Set the item and amount. Xcrow generates a private link and a lock code." />
              <Step n="2" title="Seller unlocks it" desc="They open the link and enter the lock code — now it's sealed to just these two." />
              <Step n="3" title="Buyer funds it" desc="Payment goes through Paystack straight into escrow, not to the seller." />
              <Step n="4" title="Funds release on confirmation" desc="Seller delivers, buyer confirms, and the payout is reviewed and released." />
            </ol>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-100 bg-white py-16">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 md:grid-cols-3">
          <Feature title="Locked, not just linked" desc="A shareable link plus a separate lock code — a leaked link alone can never hijack a trade." />
          <Feature title="Real support, on standby" desc="Either side can escalate to a human from inside the chat, any time something feels off." />
          <Feature title="Payments you can trust" desc="Every transaction is processed and verified through Paystack — no cash, no side deals." />
        </div>
      </section>
    </div>
  );
}

function Step({ n, title, desc }) {
  return (
    <li className="flex gap-4">
      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-xcrow-gradient font-display text-sm font-bold text-white">
        {n}
      </span>
      <div>
        <p className="font-display font-semibold text-navy-900">{title}</p>
        <p className="text-sm text-slate-500">{desc}</p>
      </div>
    </li>
  );
}

function Feature({ title, desc }) {
  return (
    <div>
      <p className="font-display font-semibold text-navy-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{desc}</p>
    </div>
  );
}
