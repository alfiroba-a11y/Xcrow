const mongoose = require('mongoose');

const STATUSES = [
  'awaiting_seller', // created by buyer, waiting for seller to join via link + lock code
  'awaiting_payment', // seller joined, waiting for buyer to fund
  'funded', // Paystack payment verified, funds held
  'in_progress', // seller working / shipping
  'delivered', // seller marked as delivered
  'completed', // buyer confirmed, funds released
  'disputed', // support ticket open on this escrow
  'cancelled', // cancelled before funding
  'refunded', // funds returned to buyer
];

const escrowSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000 },
    amount: { type: Number, required: true, min: 100 }, // in the smallest currency unit (kobo)
    currency: { type: String, default: 'NGN' },

    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Shareable invite: the token goes in the URL, the lock code is told to the
    // other party out-of-band so a leaked link alone can't hijack the escrow.
    inviteToken: { type: String, required: true, unique: true, index: true },
    lockCode: { type: String, required: true },
    lockCodeAttempts: { type: Number, default: 0 },

    status: { type: String, enum: STATUSES, default: 'awaiting_seller' },

    paystackReference: String,
    paystackVerifiedAt: Date,

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
  delete obj.lockCode; // never sent back once the seller has joined
  return obj;
};

module.exports = mongoose.model('Escrow', escrowSchema);
module.exports.STATUSES = STATUSES;
