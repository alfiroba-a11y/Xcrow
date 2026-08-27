const SupportTicket = require('../models/SupportTicket');
const Escrow = require('../models/Escrow');
const { isParticipant } = require('./escrowController');

// "Contact Support" from an escrow room — this is what pings the admin portal.
exports.createTicket = async (req, res) => {
  const { escrowId, subject, message } = req.body;
  if (!subject || !message) {
    return res.status(400).json({ message: 'Subject and message are required' });
  }

  let escrow = null;
  if (escrowId) {
    escrow = await Escrow.findById(escrowId);
    if (!escrow) return res.status(404).json({ message: 'Escrow not found' });
    if (!isParticipant(escrow, req.user._id)) {
      return res.status(403).json({ message: 'You are not part of this escrow' });
    }
    escrow.status = 'disputed';
    await escrow.save();
  }

  const ticket = await SupportTicket.create({
    escrow: escrowId || null,
    raisedBy: req.user._id,
    subject: subject.trim(),
    messages: [{ senderType: 'user', sender: req.user._id, text: message.trim() }],
  });

  const populated = await ticket.populate('raisedBy', 'name email');

  // Push it straight into the admin portal in real time.
  const io = req.app.get('io');
  io.to('admin-room').emit('support:new-ticket', populated);

  res.status(201).json({ ticket: populated });
};

exports.listMyTickets = async (req, res) => {
  const tickets = await SupportTicket.find({ raisedBy: req.user._id }).sort({ createdAt: -1 });
  res.json({ tickets });
};

exports.replyToTicket = async (req, res) => {
  const { message } = req.body;
  const ticket = await SupportTicket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
  if (String(ticket.raisedBy) !== String(req.user._id)) {
    return res.status(403).json({ message: 'This is not your ticket' });
  }
  if (!message) return res.status(400).json({ message: 'Message is required' });

  ticket.messages.push({ senderType: 'user', sender: req.user._id, text: message.trim() });
  if (ticket.status === 'resolved') ticket.status = 'open';
  await ticket.save();

  const io = req.app.get('io');
  io.to('admin-room').emit('support:ticket-updated', ticket);

  res.json({ ticket });
};
