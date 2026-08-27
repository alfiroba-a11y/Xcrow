const Escrow = require('../models/Escrow');
const Message = require('../models/Message');
const { isParticipant } = require('./escrowController');

exports.getMessages = async (req, res) => {
  const escrow = await Escrow.findById(req.params.id);
  if (!escrow) return res.status(404).json({ message: 'Escrow not found' });
  if (!isParticipant(escrow, req.user._id)) {
    return res.status(403).json({ message: 'You are not part of this escrow' });
  }

  const messages = await Message.find({ escrow: escrow._id })
    .sort({ createdAt: 1 })
    .populate('sender', 'name');

  res.json({ messages });
};
