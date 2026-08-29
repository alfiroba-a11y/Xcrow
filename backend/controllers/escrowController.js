const Escrow = require('../models/Escrow');
const Message = require('../models/Message');
const { generateInviteToken, generateLockCode } = require('../utils/generateCode');
const { notifyAdmins } = require('../utils/adminBus');

function isParticipant(escrow, userId) {
  const uid = String(userId);
  const buyerId = escrow.buyer && (escrow.buyer._id || escrow.buyer);
  const sellerId = escrow.seller && (escrow.seller._id || escrow.seller);
  if (buyerId && String(buyerId) === uid) return true;
  if (sellerId && String(sellerId) === uid) return true;
  if (escrow.thirdParties && escrow.thirdParties.length) {
    return escrow.thirdParties.some((tp) => String(tp._id || tp) === uid);
  }
  return false;
}

function isMainParty(escrow, userId) {
  const uid = String(userId);
  const buyerId = escrow.buyer && (escrow.buyer._id || escrow.buyer);
  const sellerId = escrow.seller && (escrow.seller._id || escrow.seller);
  return (buyerId && String(buyerId) === uid) || (sellerId && String(sellerId) === uid);
}

async function addSystemMessage(escrowId, text) {
  const message = await Message.create({ escrow: escrowId, isSystem: true, text });
  // Every meaningful escrow transition posts one of these, so this single
  // hook is enough to keep the admin dashboard live without touching every
  // controller that changes escrow state.
  notifyAdmins('admin:refresh');
  return message;
}

// Either the buyer or the seller can start an escrow and invite the other
// side — pass role: 'buyer' or 'seller' to say which one you are.
exports.createEscrow = async (req, res) => {
  const { title, description, amount, currency, role } = req.body;

  if (!title || !amount) {
    return res.status(400).json({ message: 'Title and amount are required' });
  }
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount < 1) {
    return res.status(400).json({ message: 'Enter a valid amount' });
  }
  const creatorRole = role === 'seller' ? 'seller' : 'buyer';

  const escrow = await Escrow.create({
    title: title.trim(),
    description: (description || '').trim(),
    amount: Math.round(numericAmount * 100), // store in the smallest currency unit
    currency: currency || 'KES',
    buyer: creatorRole === 'buyer' ? req.user._id : null,
    seller: creatorRole === 'seller' ? req.user._id : null,
    status: creatorRole === 'buyer' ? 'awaiting_seller' : 'awaiting_buyer',
    inviteToken: generateInviteToken(),
    lockCode: generateLockCode(),
  });

  await addSystemMessage(
    escrow._id,
    `${req.user.name} created this escrow as the ${creatorRole}. Waiting for the ${creatorRole === 'buyer' ? 'seller' : 'buyer'} to join.`
  );

  const inviteUrl = `${process.env.CLIENT_URL}/join/${escrow.inviteToken}`;
  res.status(201).json({
    escrow: escrow.toClientJSON(),
    lockCode: escrow.lockCode, // shown once to the creator to share out-of-band
    inviteUrl,
  });
};

// List escrows the current user is party to (buyer, seller, or third party).
exports.listMyEscrows = async (req, res) => {
  const escrows = await Escrow.find({
    $or: [{ buyer: req.user._id }, { seller: req.user._id }, { thirdParties: req.user._id }],
  })
    .sort({ createdAt: -1 })
    .populate('buyer', 'name email')
    .populate('seller', 'name email');

  res.json({ escrows: escrows.map((e) => e.toClientJSON()) });
};

// Preview an escrow from ANY of its links (the main buyer/seller invite, or
// a third-party invite) before a code is entered.
exports.previewByToken = async (req, res) => {
  const { token } = req.params;
  const escrow = await Escrow.findOne({ inviteToken: token })
    .populate('buyer', 'name')
    .populate('seller', 'name');

  if (escrow) {
    const needsRole = escrow.buyer ? 'seller' : 'buyer';
    const creator = escrow.buyer || escrow.seller;
    return res.json({
      kind: 'main',
      title: escrow.title,
      amount: escrow.amount / 100,
      currency: escrow.currency,
      creatorName: creator.name,
      creatorRole: escrow.buyer ? 'buyer' : 'seller',
      youWouldJoinAs: needsRole,
      status: escrow.status,
      alreadyLocked: !!(escrow.buyer && escrow.seller),
    });
  }

  const withThirdParty = await Escrow.findOne({ 'thirdPartyInvites.inviteToken': token })
    .populate('buyer', 'name')
    .populate('seller', 'name');
  if (withThirdParty) {
    const invite = withThirdParty.thirdPartyInvites.find((inv) => inv.inviteToken === token);
    return res.json({
      kind: 'third_party',
      title: withThirdParty.title,
      amount: withThirdParty.amount / 100,
      currency: withThirdParty.currency,
      buyerName: withThirdParty.buyer?.name,
      sellerName: withThirdParty.seller?.name,
      label: invite.label || null,
      status: withThirdParty.status,
      alreadyUsed: !!invite.usedBy,
    });
  }

  res.status(404).json({ message: 'This escrow link is invalid or has expired' });
};

// Join via the main invite link — fills whichever of buyer/seller is missing.
exports.joinEscrow = async (req, res) => {
  const { code } = req.body;
  const escrow = await Escrow.findOne({ inviteToken: req.params.token });
  if (!escrow) return res.status(404).json({ message: 'This escrow link is invalid or has expired' });

  if (escrow.buyer && escrow.seller) {
    return res.status(409).json({ message: 'This escrow has already been locked to a buyer and seller' });
  }
  const joiningRole = escrow.buyer ? 'seller' : 'buyer';
  const creatorId = escrow.buyer || escrow.seller;
  if (String(creatorId) === String(req.user._id)) {
    return res.status(400).json({ message: `You can't join your own escrow as the ${joiningRole}` });
  }
  if (escrow.lockCodeAttempts >= 5) {
    return res.status(429).json({ message: 'Too many incorrect attempts. Ask for a new link.' });
  }
  if (!code || code.toUpperCase() !== escrow.lockCode) {
    escrow.lockCodeAttempts += 1;
    await escrow.save();
    return res.status(401).json({ message: 'Incorrect lock code' });
  }

  escrow[joiningRole] = req.user._id;
  escrow.status = 'awaiting_payment';
  await escrow.save();

  await addSystemMessage(
    escrow._id,
    `${req.user.name} joined as the ${joiningRole}. This escrow is now locked to these two participants (plus any third parties added later).`
  );

  res.json({ escrow: escrow.toClientJSON() });
};

// Buyer or seller generates a link + lock code for a third party (mediator,
// inspector, etc.) to join the chat. Third parties never touch funds.
exports.inviteThirdParty = async (req, res) => {
  const escrow = await Escrow.findById(req.params.id);
  if (!escrow) return res.status(404).json({ message: 'Escrow not found' });
  if (!isMainParty(escrow, req.user._id)) {
    return res.status(403).json({ message: 'Only the buyer or seller can add a third party' });
  }

  const invite = {
    inviteToken: generateInviteToken(),
    lockCode: generateLockCode(),
    createdBy: req.user._id,
    label: (req.body.label || '').trim().slice(0, 60) || undefined,
  };
  escrow.thirdPartyInvites.push(invite);
  await escrow.save();

  const created = escrow.thirdPartyInvites[escrow.thirdPartyInvites.length - 1];
  const inviteUrl = `${process.env.CLIENT_URL}/join/${created.inviteToken}`;
  res.status(201).json({ inviteUrl, lockCode: created.lockCode, label: created.label || null });
};

// Join via a third-party invite link + its lock code.
exports.joinThirdParty = async (req, res) => {
  const { code } = req.body;
  const escrow = await Escrow.findOne({ 'thirdPartyInvites.inviteToken': req.params.token });
  if (!escrow) return res.status(404).json({ message: 'This escrow link is invalid or has expired' });

  const invite = escrow.thirdPartyInvites.find((inv) => inv.inviteToken === req.params.token);
  if (invite.usedBy) {
    return res.status(409).json({ message: 'This invite has already been used' });
  }
  if (isMainParty(escrow, req.user._id)) {
    return res.status(400).json({ message: "You're already part of this escrow as the buyer or seller" });
  }
  if (invite.lockCodeAttempts >= 5) {
    return res.status(429).json({ message: 'Too many incorrect attempts. Ask for a new link.' });
  }
  if (!code || code.toUpperCase() !== invite.lockCode) {
    invite.lockCodeAttempts += 1;
    await escrow.save();
    return res.status(401).json({ message: 'Incorrect lock code' });
  }

  invite.usedBy = req.user._id;
  if (!escrow.thirdParties.some((tp) => String(tp) === String(req.user._id))) {
    escrow.thirdParties.push(req.user._id);
  }
  await escrow.save();

  await addSystemMessage(
    escrow._id,
    `${req.user.name} joined this escrow's chat${invite.label ? ` as ${invite.label}` : ' as a third party'}.`
  );

  res.json({ escrow: escrow.toClientJSON() });
};

exports.getEscrow = async (req, res) => {
  const escrow = await Escrow.findById(req.params.id)
    .populate('buyer', 'name email')
    .populate('seller', 'name email')
    .populate('thirdParties', 'name email');
  if (!escrow) return res.status(404).json({ message: 'Escrow not found' });
  if (!isParticipant(escrow, req.user._id)) {
    return res.status(403).json({ message: 'You are not part of this escrow' });
  }
  res.json({ escrow: escrow.toClientJSON() });
};

exports.markDelivered = async (req, res) => {
  const escrow = await Escrow.findById(req.params.id);
  if (!escrow) return res.status(404).json({ message: 'Escrow not found' });
  if (!escrow.seller || String(escrow.seller) !== String(req.user._id)) {
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
  if (!escrow.buyer || String(escrow.buyer) !== String(req.user._id)) {
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
  if (!isMainParty(escrow, req.user._id)) {
    return res.status(403).json({ message: 'You are not part of this escrow' });
  }
  if (!['awaiting_seller', 'awaiting_buyer', 'awaiting_payment'].includes(escrow.status)) {
    return res.status(400).json({ message: 'Funded or completed escrows can only be cancelled by support' });
  }

  escrow.status = 'cancelled';
  escrow.cancelledAt = new Date();
  await escrow.save();
  await addSystemMessage(escrow._id, `${req.user.name} cancelled this escrow.`);

  res.json({ escrow: escrow.toClientJSON() });
};

exports.isParticipant = isParticipant;
exports.isMainParty = isMainParty;
exports.addSystemMessage = addSystemMessage;
