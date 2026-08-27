const bcrypt = require('bcryptjs');
const validator = require('validator');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');

exports.register = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required' });
  }
  if (!validator.isEmail(email)) {
    return res.status(400).json({ message: 'Enter a valid email address' });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ message: 'An account with this email already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name: name.trim(), email: email.toLowerCase(), passwordHash });

  const token = generateToken(user);
  res.status(201).json({ token, user: user.toSafeJSON() });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ message: 'Incorrect email or password' });
  }
  if (!user.isActive) {
    return res.status(403).json({ message: 'This account has been suspended' });
  }

  user.lastLoginAt = new Date();
  user.lastLoginIp = req.ip;
  await user.save();

  const token = generateToken(user);
  res.json({ token, user: user.toSafeJSON() });
};

exports.me = async (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
};

// Separate, intentionally minimal login for the hidden admin panel.
// It reuses the User collection but only ever succeeds for role === 'admin',
// and returns the same generic error whether the email is unknown or the
// account simply isn't an admin — no information leak either way.
exports.adminLogin = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const user = await User.findOne({ email: email.toLowerCase(), role: 'admin' });
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  user.lastLoginAt = new Date();
  user.lastLoginIp = req.ip;
  await user.save();

  const token = generateToken(user);
  res.json({ token, user: user.toSafeJSON() });
};
