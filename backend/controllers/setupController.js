const bcrypt = require('bcryptjs');
const User = require('../models/User');

// A GET route (so it can be triggered by just visiting the URL in a browser)
// protected by a random secret query param — for free-tier deployments that
// don't have Shell access to run `npm run create-admin`.
//
// IMPORTANT: remove this route (or at least rotate SETUP_SECRET) once you've
// used it. Leaving a working admin-creation endpoint live indefinitely is a
// risk, even behind a secret.
exports.createAdmin = async (req, res) => {
  const { key } = req.query;
  const { SETUP_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;

  if (!SETUP_SECRET) {
    return res.status(404).json({ message: 'Not found' });
  }
  if (!key || key !== SETUP_SECRET) {
    return res.status(404).json({ message: 'Not found' });
  }
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    return res.status(400).json({ message: 'Set ADMIN_EMAIL and ADMIN_PASSWORD env vars first' });
  }
  if (ADMIN_PASSWORD.length < 8) {
    return res.status(400).json({
      message: `ADMIN_PASSWORD must be at least 8 characters (Render currently has it set to ${ADMIN_PASSWORD.length} characters)`,
    });
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const admin = await User.findOneAndUpdate(
    { email: ADMIN_EMAIL.toLowerCase() },
    {
      $set: {
        name: ADMIN_NAME || 'Xcrow Admin',
        email: ADMIN_EMAIL.toLowerCase(),
        passwordHash,
        role: 'admin',
        isActive: true,
      },
    },
    { upsert: true, new: true }
  );

  res.json({
    message: `Admin ready: ${admin.email}. You can now remove this route / rotate SETUP_SECRET.`,
  });
};
