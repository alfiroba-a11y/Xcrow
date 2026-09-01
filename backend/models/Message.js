const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    escrow: { type: mongoose.Schema.Types.ObjectId, ref: 'Escrow', required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    senderLabel: { type: String, default: null }, // e.g. "Xcrow AI" — used when sender is null but it's not a plain system notice
    isSystem: { type: Boolean, default: false },
    text: { type: String, required: true, trim: true, maxlength: 4000 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Message', messageSchema);
