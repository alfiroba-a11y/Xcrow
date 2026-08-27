const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Escrow = require('../models/Escrow');
const Message = require('../models/Message');

// Every socket must authenticate with the same JWT used for the REST API —
// no anonymous connections, and a socket can only ever join rooms for
// escrows it's actually a party to.
async function authenticateSocket(socket, next) {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('unauthorized'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) return next(new Error('unauthorized'));
    socket.user = user;
    next();
  } catch (err) {
    next(new Error('unauthorized'));
  }
}

function registerSocketHandlers(io) {
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    if (socket.user.role === 'admin') {
      socket.join('admin-room');
    }

    socket.on('escrow:join', async (escrowId) => {
      const escrow = await Escrow.findById(escrowId);
      if (!escrow) return;
      const uid = String(socket.user._id);
      const allowed = String(escrow.buyer) === uid || (escrow.seller && String(escrow.seller) === uid);
      if (!allowed) return; // silently ignore — never confirm/deny escrow existence to non-participants
      socket.join(`escrow:${escrowId}`);
    });

    socket.on('escrow:message', async ({ escrowId, text }) => {
      if (!text || !text.trim()) return;
      const escrow = await Escrow.findById(escrowId);
      if (!escrow) return;
      const uid = String(socket.user._id);
      const allowed = String(escrow.buyer) === uid || (escrow.seller && String(escrow.seller) === uid);
      if (!allowed) return;

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
