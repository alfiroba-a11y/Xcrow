const mongoose = require('mongoose');

const STATUSES = [
  'awaiting_seller', // buyer created it, waiting for a seller to join via link + lock code
  'awaiting_buyer', // seller created it, waiting for a buyer to join via link + lock code
  'awaiting_payment', // both sides present, waiting for the buyer to fund
  'funded', // payment verified (Paystack or admin-confirmed USDT), funds held
  'in_progress', // seller working / shipping
  'delivered', // seller marked as delivered
  'completed', // buyer confirmed, funds released
  'disputed', // support ticket open on this escrow
  'cancelled', // cancelled before funding
  'refunded', // funds returned to buyer
];

// A third party is added by the buyer or seller via their own invite link +
// lock code, same trust model as the main invite. They can see and post in
// the chat, but never hold funds and can't fund/release/cancel.
const thirdPartyInviteSchema = new mongoose.Schema(
  {
    inviteToken: { type: String, required: true, unique: true, sparse: true },
    lockCode: { type: String, required: true },
    lockCodeAttempts: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    usedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    label: { type: String, trim: true, maxlength: 60 }, // e.g. "Mediator", "Inspector"
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const escrowSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000 },
    amount: { type: Number, required: true, min: 100 }, // in the smallest currency unit (cents for KES)
    currency: { type: String, default: 'KES' },

    // Exactly one of these is set at creation (whichever role the creator
    // picked); the other fills in once someone joins via the invite link.
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    thirdParties: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    thirdPartyInvites: [thirdPartyInviteSchema],

    // Shareable invite for the missing buyer/seller role: the token goes in
    // the URL, the lock code is told to the other party out-of-band so a
    // leaked link alone can't hijack the escrow.
    inviteToken: { type: String, required: true, unique: true, index: true },
    lockCode: { type: String, required: true },
    lockCodeAttempts: { type: Number, default: 0 },

    status: { type: String, enum: STATUSES, default: 'awaiting_seller' },

    fundingMethod: { type: String, enum: ['paystack', 'usdt', null], default: null },
    paystackReference: String,
    paystackVerifiedAt: Date,

    // USDT is never auto-verified on-chain here — this just records the
    // buyer's claim and, once an admin has manually checked the blockchain
    // explorer and agrees, their confirmation.
    usdtClaim: {
      txHash: String,
      claimedAt: Date,
      confirmedAt: Date,
      confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },

    deliveredAt: Date,
    completedAt: Date,
    cancelledAt: Date,

    payout: {
      status: { type: String, enum: ['none', 'pending', 'processing', 'paid', 'failed'], default: 'none' },
      transferCode: String,
      paidAt: Date,
    },
  },
  { timestamps: true }
);

escrowSchema.methods.toClientJSON = function () {
  const obj = this.toObject();
  delete obj.lockCode; // never sent back once the other main party has joined
  if (obj.thirdPartyInvites) {
    obj.thirdPartyInvites = obj.thirdPartyInvites.map((inv) => {
      const { lockCode, ...rest } = inv;
      return rest;
    });
  }
  return obj;
};

module.exports = mongoose.model('Escrow', escrowSchema);
module.exports.STATUSES = STATUSES;
