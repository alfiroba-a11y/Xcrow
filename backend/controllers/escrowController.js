const Escrow = require('../models/Escrow');
const Message = require('../models/Message');
const { generateInviteToken, generateLockCode } = require('../utils/generateCode');

function isParticipant(escrow, userId) {
  const uid = String(userId);
  // escrow.buyer/seller may be a plain ObjectId, or a full populated user
  // document (when the query used .populate()) — handle both so this check
  // works no matter which form the caller fetched.
  const buyerId = escrow.buyer && (escrow.buyer._id || escrow.buyer);
  const sellerId = escrow.seller && (escrow.seller._id || escrow.seller);
  return (buyerId && String(buyerId) === uid) || (sellerId && String(sellerId) === uid);
}

async function addSystemMessage(escrowId, text) {
  return Message.create({ escrow: escrowId, isSystem: true, text });
}

// Buyer creates a new escrow. A shareable link + a separate lock code are
// generated: the link alone is not enough to join, so a leaked/forwarded
// link can't be hijacked by a third party.
exports.createEscrow = async (req, res) => {
  const { title, description, amount, currency } = req.body;

  if (!title || !amount) {
    return res.status(400).json({ message: 'Title and amount are required' });
  }
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount < 1) {
    return res.status(400).json({ message: 'Enter a valid amount' });
  }

  const escrow = await Escrow.create({
    title: title.trim(),
    description: (description || '').trim(),
    amount: Math.round(numericAmount * 100), // store in kobo
    currency: currency || 'NGN',
    buyer: req.user._id,
    inviteToken: generateInviteToken(),
    lockCode: generateLockCode(),
  });

  await addSystemMessage(escrow._id, `${req.user.name} created this escrow as the buyer. Waiting for the seller to join.`);

  const inviteUrl = `${process.env.CLIENT_URL}/join/${escrow.inviteToken}`;
  res.status(201).json({
    escrow: escrow.toClientJSON(),
    lockCode: escrow.lockCode, // shown once to the creator to share out-of-band
    inviteUrl,
  });
};

// List escrows the current user is party to (as buyer or seller).
exports.listMyEscrows = async (req, res) => {
  const escrows = await Escrow.find({
    $or: [{ buyer: req.user._id }, { seller: req.user._id }],
  })
    .sort({ createdAt: -1 })
    .populate('buyer', 'name email')
    .populate('seller', 'name email');

  res.json({ escrows: escrows.map((e) => e.toClientJSON()) });
};

// Preview an escrow from its invite link before the lock code is entered —
// enough to show "Escrow: iPhone 13, ₦50,000 — enter the code you were given",
// without exposing anything sensitive.
exports.previewByToken = async (req, res) => {
  const escrow = await Escrow.findOne({ inviteToken: req.params.token }).populate('buyer', 'name');
  if (!escrow) return res.status(404).json({ message: 'This escrow link is invalid or has expired' });

  res.json({
    title: escrow.title,
    amount: escrow.amount / 100,
    currency: escrow.currency,
    buyerName: escrow.buyer.name,
    status: escrow.status,
    alreadyLocked: !!escrow.seller,
  });
};

// Seller joins using the link token + the out-of-band lock code.
exports.joinEscrow = async (req, res) => {
  const { code } = req.body;
  const escrow = await Escrow.findOne({ inviteToken: req.params.token });
  if (!escrow) return res.status(404).json({ message: 'This escrow link is invalid or has expired' });

  if (escrow.seller) {
    return res.status(409).json({ message: 'This escrow has already been locked to a seller' });
  }
  if (String(escrow.buyer) === String(req.user._id)) {
    return res.status(400).json({ message: "You can't join your own escrow as the seller" });
  }
  if (escrow.lockCodeAttempts >= 5) {
    return res.status(429).json({ message: 'Too many incorrect attempts. Ask the buyer for a new link.' });
  }
  if (!code || code.toUpperCase() !== escrow.lockCode) {
    escrow.lockCodeAttempts += 1;
    await escrow.save();
    return res.status(401).json({ message: 'Incorrect lock code' });
  }

  escrow.seller = req.user._id;
  escrow.status = 'awaiting_payment';
  await escrow.save();

  await addSystemMessage(
    escrow._id,
    `${req.user.name} joined as the seller. This escrow is now locked to these two participants only.`
  );

  res.json({ escrow: escrow.toClientJSON() });
};

exports.getEscrow = async (req, res) => {
  const escrow = await Escrow.findById(req.params.id)
    .populate('buyer', 'name email')
    .populate('seller', 'name email');
  if (!escrow) return res.status(404).json({ message: 'Escrow not found' });
  if (!isParticipant(escrow, req.user._id)) {
    return res.status(403).json({ message: 'You are not part of this escrow' });
  }
  res.json({ escrow: escrow.toClientJSON() });
};

exports.markDelivered = async (req, res) => {
  const escrow = await Escrow.findById(req.params.id);
  if (!escrow) return res.status(404).json({ message: 'Escrow not found' });
  if (String(escrow.seller) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Only the seller can mark this as delivered' });
  }
  if (escrow.status !== 'funded' && escrow.status !== 'in_progress') {
    return res.status(400).json({ message: 'This escrow is not in a state that can be marked delivered' });
  }

  escrow.status = 'delivered';
  escrow.deliveredAt = new Date();
  await escrow.save();
  await addSystemMessage(escrow._id, 'The seller marked this order as delivered. Buyer: please confirm once you have received it.');

  res.json({ escrow: escrow.toClientJSON() });
};

exports.confirmAndRelease = async (req, res) => {
  const escrow = await Escrow.findById(req.params.id);
  if (!escrow) return res.status(404).json({ message: 'Escrow not found' });
  if (String(escrow.buyer) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Only the buyer can confirm receipt' });
  }
  if (escrow.status !== 'delivered') {
    return res.status(400).json({ message: 'Escrow must be marked delivered before it can be confirmed' });
  }

  escrow.status = 'completed';
  escrow.completedAt = new Date();
  escrow.payout.status = 'pending';
  await escrow.save();
  await addSystemMessage(
    escrow._id,
    'The buyer confirmed receipt. Funds are queued for release to the seller — our team reviews every payout before it goes out.'
  );

  res.json({ escrow: escrow.toClientJSON() });
};

exports.cancelEscrow = async (req, res) => {
  const escrow = await Escrow.findById(req.params.id);
  if (!escrow) return res.status(404).json({ message: 'Escrow not found' });
  if (!isParticipant(escrow, req.user._id)) {
    return res.status(403).json({ message: 'You are not part of this escrow' });
  }
  if (!['awaiting_seller', 'awaiting_payment'].includes(escrow.status)) {
    return res.status(400).json({ message: 'Funded or completed escrows can only be cancelled by support' });
  }

  escrow.status = 'cancelled';
  escrow.cancelledAt = new Date();
  await escrow.save();
  await addSystemMessage(escrow._id, `${req.user.name} cancelled this escrow.`);

  res.json({ escrow: escrow.toClientJSON() });
};

exports.isParticipant = isParticipant;
exports.addSystemMessage = addSystemMessage;
