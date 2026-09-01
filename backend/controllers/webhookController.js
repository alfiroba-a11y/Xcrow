const crypto = require('crypto');
const Escrow = require('../models/Escrow');
const { addSystemMessage } = require('./escrowController');
const { notifyAdmins } = require('../utils/adminBus');

// Paystack signs every webhook with your secret key so you can verify it
// really came from them and wasn't spoofed by someone hitting this URL
// directly to fake a "payment succeeded" event.
function isValidSignature(req) {
  if (!req.rawBody) return false;
  const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(req.rawBody).digest('hex');
  return hash === req.headers['x-paystack-signature'];
}

exports.paystackWebhook = async (req, res) => {
  if (!isValidSignature(req)) {
    return res.sendStatus(401);
  }

  // Acknowledge immediately — Paystack retries aggressively if we're slow
  // or if we error after this point, and we don't want duplicate retries
  // piling up while we do the actual database work.
  res.sendStatus(200);

  const event = req.body;
  if (event.event !== 'charge.success') return;

  try {
    const { reference, amount, metadata, status } = event.data;
    const escrowId = metadata?.escrowId;
    if (!escrowId || status !== 'success') return;

    const escrow = await Escrow.findById(escrowId);
    if (!escrow) return;
    if (escrow.status === 'funded') return; // already processed — webhooks can fire more than once
    if (escrow.status !== 'awaiting_payment') return;
    if (amount !== escrow.amount) return; // never fund on a mismatched amount

    escrow.status = 'funded';
    escrow.fundingMethod = 'paystack';
    escrow.paystackReference = reference;
    escrow.paystackVerifiedAt = new Date();
    await escrow.save();
    await addSystemMessage(escrow._id, 'M-Pesa payment confirmed. Funds are now held in escrow.');
    notifyAdmins('admin:refresh');
  } catch (err) {
    console.error('Webhook processing error:', err.message);
  }
};
