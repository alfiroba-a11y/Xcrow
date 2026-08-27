const { customAlphabet } = require('nanoid');

// URL-safe token embedded in the shareable escrow link
const tokenAlphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const inviteToken = customAlphabet(tokenAlphabet, 24);

// Human-friendly numeric lock code, read aloud or typed by the other party.
// Ambiguous characters avoided so it's easy to communicate verbally/by text.
const lockAlphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const lockCode = customAlphabet(lockAlphabet, 8);

module.exports = { generateInviteToken: inviteToken, generateLockCode: lockCode };
