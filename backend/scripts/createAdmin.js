// Run once after deploying: `npm run create-admin`
// Creates (or upgrades) the admin account defined by ADMIN_EMAIL / ADMIN_PASSWORD in .env.
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function run() {
  const { MONGO_URI, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in your environment first.');
    process.exit(1);
  }
  if (ADMIN_PASSWORD.length < 8) {
    console.error('ADMIN_PASSWORD must be at least 8 characters.');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);

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

  console.log(`Admin ready: ${admin.email}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
