require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const registerSocketHandlers = require('./socket/socketHandler');

const authRoutes = require('./routes/authRoutes');
const escrowRoutes = require('./routes/escrowRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const supportRoutes = require('./routes/supportRoutes');
const adminRoutes = require('./routes/adminRoutes');
const setupRoutes = require('./routes/setupRoutes');

connectDB();

const app = express();
const server = http.createServer(app);

// Render (and most PaaS providers) sit behind a reverse proxy. Without this,
// express-rate-limit can't safely read the real client IP from
// X-Forwarded-For and throws a validation error on every request.
app.set('trust proxy', 1);

const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL, credentials: true },
});
app.set('io', io);
registerSocketHandlers(io);

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

// Generous global limit, tighter one on auth to blunt credential-stuffing / brute force.
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { message: 'Too many attempts, try again later' } });

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/escrows', escrowRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/setup', setupRoutes);

// The admin API lives behind an unguessable path segment (set via env,
// must match ADMIN_PANEL_SECRET / the frontend's VITE_ADMIN_PATH) on top of
// its own auth + role check — defense in depth for the hidden portal.
app.use(`/api/${process.env.ADMIN_PANEL_SECRET || 'admin'}`, authLimiter, adminRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Xcrow API running on port ${PORT}`));
