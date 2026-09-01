const authenticateSocket = require('../middleware/socketAuth');
const Escrow = require('../models/Escrow');
const Message = require('../models/Message');
const { isParticipant } = require('../controllers/escrowController');
const { getAIResponse } = require('../utils/aiAssistant');

function registerSocketHandlers(io) {
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    if (socket.user.role === 'admin') {
      socket.join('admin-room');
    }

    socket.on('escrow:join', async (escrowId) => {
      const escrow = await Escrow.findById(escrowId);
      if (!escrow || !isParticipant(escrow, socket.user._id)) return; // silently ignore — never confirm/deny escrow existence to non-participants
      socket.join(`escrow:${escrowId}`);
    });

    socket.on('escrow:message', async ({ escrowId, text }) => {
      if (!text || !text.trim()) return;
      const escrow = await Escrow.findById(escrowId)
        .populate('buyer', 'name email')
        .populate('seller', 'name email');
      if (!escrow || !isParticipant(escrow, socket.user._id)) return;

      const trimmed = text.trim().slice(0, 4000);
      const message = await Message.create({
        escrow: escrowId,
        sender: socket.user._id,
        text: trimmed,
      });
      const populated = await message.populate('sender', 'name');
      io.to(`escrow:${escrowId}`).emit('escrow:message', populated);

      // AI escrows: "/ai <question>" gets a reply from the assistant. It can
      // only answer and start payments — see aiAssistant.js for why it has
      // no ability to release or refund anything.
      if (escrow.mode === 'ai' && /^\/ai\s+/i.test(trimmed)) {
        const question = trimmed.replace(/^\/ai\s+/i, '');
        const uid = String(socket.user._id);
        const isBuyer = escrow.buyer && String(escrow.buyer._id) === uid;
        const isSeller = escrow.seller && String(escrow.seller._id) === uid;
        const requesterRole = isBuyer ? 'buyer' : isSeller ? 'seller' : 'third party observing this trade';

        try {
          const { text: aiText } = await getAIResponse({ escrow, question, requesterRole, isBuyer, isSeller, requesterUser: socket.user });
          const aiMessage = await Message.create({
            escrow: escrowId,
            sender: null,
            senderLabel: 'Xcrow AI',
            text: aiText.slice(0, 4000),
          });
          io.to(`escrow:${escrowId}`).emit('escrow:message', aiMessage);
        } catch (err) {
          console.error('AI assistant error:', err.response?.data || err.message);
          const fallback = await Message.create({
            escrow: escrowId,
            sender: null,
            senderLabel: 'Xcrow AI',
            text: "Sorry, I couldn't process that right now — try again in a moment, or use Contact support.",
          });
          io.to(`escrow:${escrowId}`).emit('escrow:message', fallback);
        }
      }
    });

    socket.on('escrow:typing', ({ escrowId }) => {
      socket.to(`escrow:${escrowId}`).emit('escrow:typing', { userId: socket.user._id, name: socket.user.name });
    });
  });
}

module.exports = registerSocketHandlers;
