const mongoose = require('mongoose');

const ticketMessageSchema = new mongoose.Schema(
  {
    senderType: { type: String, enum: ['user', 'admin'], required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    text: { type: String, required: true, trim: true, maxlength: 4000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const supportTicketSchema = new mongoose.Schema(
  {
    escrow: { type: mongoose.Schema.Types.ObjectId, ref: 'Escrow', default: null },
    raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    status: { type: String, enum: ['open', 'resolved'], default: 'open' },
    messages: [ticketMessageSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
