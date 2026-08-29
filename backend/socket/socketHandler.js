const authenticateSocket = require('../middleware/socketAuth');
const Escrow = require('../models/Escrow');
const Message = require('../models/Message');
const { isParticipant } = require('../controllers/escrowController');

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
      const escrow = await Escrow.findById(escrowId);
      if (!escrow || !isParticipant(escrow, socket.user._id)) return;

      const message = await Message.create({
        escrow: escrowId,
        sender: socket.user._id,
        text: text.trim().slice(0, 4000),
      });
      const populated = await message.populate('sender', 'name');

      io.to(`escrow:${escrowId}`).emit('escrow:message', populated);
    });

    socket.on('escrow:typing', ({ escrowId }) => {
      socket.to(`escrow:${escrowId}`).emit('escrow:typing', { userId: socket.user._id, name: socket.user.name });
    });
  });
}

module.exports = registerSocketHandlers;
