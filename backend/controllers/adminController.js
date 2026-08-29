const User = require('../models/User');
const Escrow = require('../models/Escrow');
const SupportTicket = require('../models/SupportTicket');
const Message = require('../models/Message');
const { addSystemMessage } = require('./escrowController');
const paystack = require('../utils/paystack');

exports.getOverview = async (req, res) => {
  const [userCount, escrowCount, openTickets, fundsHeld] = await Promise.all([
    User.countDocuments({ role: 'user' }),
    Escrow.countDocuments(),
    SupportTicket.countDocuments({ status: 'open' }),
    Escrow.aggregate([
      { $match: { status: { $in: ['funded', 'in_progress', 'delivered'] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  res.json({
    userCount,
    escrowCount,
    openTickets,
    fundsHeld: (fundsHeld[0]?.total || 0) / 100,
  });
};

exports.listUsers = async (req, res) => {
  const users = await User.find({ role: 'user' }).sort({ createdAt: -1 }).select('-passwordHash');
  res.json({ users });
};

exports.toggleUserActive = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  user.isActive = !user.isActive;
  await user.save();
  res.json({ user: user.toSafeJSON() });
};

exports.listEscrows = async (req, res) => {
  const escrows = await Escrow.find()
    .sort({ createdAt: -1 })
    .populate('buyer', 'name email')
    .populate('seller', 'name email')
    .populate('thirdParties', 'name email');
  res.json({ escrows });
};

exports.listTickets = async (req, res) => {
  const tickets = await SupportTicket.find()
    .sort({ createdAt: -1 })
    .populate('raisedBy', 'name email')
    .populate('escrow', 'title amount status');
  res.json({ tickets });
};

exports.replyToTicketAsAdmin = async (req, res) => {
  const { message, resolve } = req.body;
  const ticket = await SupportTicket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

  if (message) {
    ticket.messages.push({ senderType: 'admin', sender: req.user._id, text: message.trim() });
  }
  if (resolve) ticket.status = 'resolved';
  await ticket.save();

  res.json({ ticket });
};

// Admin can cancel any escrow that hasn't been funded yet (nothing to
// refund). Once money is actually held, use refundEscrow or forceRelease
// instead — cancelling funded money doesn't make sense on its own.
exports.cancelEscrow = async (req, res) => {
  const escrow = await Escrow.findById(req.params.id);
  if (!escrow) return res.status(404).json({ message: 'Escrow not found' });
  if (!['awaiting_seller', 'awaiting_buyer', 'awaiting_payment'].includes(escrow.status)) {
    return res.status(400).json({ message: 'This escrow already has funds involved — use refund or force-release instead' });
  }

  escrow.status = 'cancelled';
  escrow.cancelledAt = new Date();
  await escrow.save();
  await addSystemMessage(escrow._id, 'An admin cancelled this escrow.');
  notifyAdmins(req);

  res.json({ escrow });
};

// Dispute resolution: skip the buyer's normal confirm-and-release step and
// send funds straight to the seller. Same downstream payout-approval safety
// net still applies afterward (approvePayout does the actual transfer).
exports.forceRelease = async (req, res) => {
  const escrow = await Escrow.findById(req.params.id);
  if (!escrow) return res.status(404).json({ message: 'Escrow not found' });
  if (!['funded', 'in_progress', 'delivered'].includes(escrow.status)) {
    return res.status(400).json({ message: 'This escrow is not in a fundable state to release' });
  }

  escrow.status = 'completed';
  escrow.completedAt = new Date();
  escrow.payout.status = 'pending';
  await escrow.save();
  await addSystemMessage(escrow._id, 'An admin reviewed this case and released the funds to the seller for payout.');
  notifyAdmins(req);

  res.json({ escrow });
};

exports.getEscrowMessages = async (req, res) => {
  const messages = await Message.find({ escrow: req.params.id }).sort({ createdAt: 1 }).populate('sender', 'name email');
  res.json({ messages });
};

function notifyAdmins(req) {
  req.app.get('io').to('admin-room').emit('admin:refresh');
}

// Manual dispute resolution: refund the buyer instead of paying the seller.
exports.refundEscrow = async (req, res) => {
  const escrow = await Escrow.findById(req.params.id);
  if (!escrow) return res.status(404).json({ message: 'Escrow not found' });
  if (!['funded', 'in_progress', 'delivered', 'disputed'].includes(escrow.status)) {
    return res.status(400).json({ message: 'This escrow cannot be refunded from its current state' });
  }

  // Paystack refunds go back to the original payment instrument.
  escrow.status = 'refunded';
  escrow.payout.status = 'none';
  await escrow.save();
  await addSystemMessage(escrow._id, 'An admin reviewed this case and refunded the buyer.');
  notifyAdmins(req);

  res.json({ escrow });
};

// Every payout is reviewed here before money moves — the "elite" safety net
// on top of the buyer's own release confirmation.
exports.approvePayout = async (req, res) => {
  const escrow = await Escrow.findById(req.params.id).populate('seller');
  if (!escrow) return res.status(404).json({ message: 'Escrow not found' });
  if (escrow.status !== 'completed' || escrow.payout.status !== 'pending') {
    return res.status(400).json({ message: 'This escrow is not awaiting payout approval' });
  }
  if (!escrow.seller?.bankDetails?.recipientCode) {
    return res.status(400).json({ message: 'Seller has not linked a payout account yet' });
  }

  try {
    escrow.payout.status = 'processing';
    await escrow.save();

    const transfer = await paystack.initiateTransfer({
      amount: escrow.amount,
      recipientCode: escrow.seller.bankDetails.recipientCode,
      reason: `Xcrow escrow payout: ${escrow.title}`,
    });

    escrow.payout.status = 'paid';
    escrow.payout.transferCode = transfer.transfer_code;
    escrow.payout.paidAt = new Date();
    await escrow.save();
    await addSystemMessage(escrow._id, 'Funds have been released to the seller.');
    notifyAdmins(req);

    res.json({ escrow });
  } catch (err) {
    escrow.payout.status = 'failed';
    await escrow.save();
    console.error('Payout error:', err.response?.data || err.message);
    res.status(502).json({ message: 'Transfer failed. Check the Paystack balance and try again.' });
  }
};

// Admin has manually checked the transaction hash on a block explorer and
// confirms the USDT payment really landed — this is the only thing that
// marks a crypto-funded escrow as "funded". Never automatic.
exports.confirmCryptoPayment = async (req, res) => {
  const escrow = await Escrow.findById(req.params.id);
  if (!escrow) return res.status(404).json({ message: 'Escrow not found' });
  if (escrow.status !== 'awaiting_payment' || !escrow.usdtClaim?.txHash) {
    return res.status(400).json({ message: 'This escrow has no pending USDT claim to confirm' });
  }

  escrow.status = 'funded';
  escrow.usdtClaim.confirmedAt = new Date();
  escrow.usdtClaim.confirmedBy = req.user._id;
  await escrow.save();
  await addSystemMessage(escrow._id, 'An admin confirmed the USDT payment on-chain. Funds are now held in escrow.');
  notifyAdmins(req);

  res.json({ escrow });
};
