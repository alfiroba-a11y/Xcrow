const Escrow = require('../models/Escrow');
const { addSystemMessage } = require('./escrowController');
const paystack = require('../utils/paystack');
const axios = require('axios');

// The amount is always read from the escrow record on the server — never
// trusted from the client — so nobody can pay less than what's owed.
exports.initializePayment = async (req, res) => {
  const escrow = await Escrow.findById(req.params.id).populate('buyer', 'name email');
  if (!escrow) return res.status(404).json({ message: 'Escrow not found' });
  if (String(escrow.buyer._id) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Only the buyer can fund this escrow' });
  }
  if (escrow.status !== 'awaiting_payment') {
    return res.status(400).json({ message: 'This escrow is not awaiting payment' });
  }

  try {
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: escrow.buyer.email,
        amount: escrow.amount, // already stored in kobo
        currency: escrow.currency,
        metadata: { escrowId: String(escrow._id) },
        callback_url: `${process.env.CLIENT_URL}/escrow/${escrow._id}`,
      },
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );

    res.json({
      accessCode: response.data.data.access_code,
      reference: response.data.data.reference,
      authorizationUrl: response.data.data.authorization_url,
    });
  } catch (err) {
    console.error('Paystack init error:', err.response?.data || err.message);
    res.status(502).json({ message: 'Could not start the payment. Please try again.' });
  }
};

exports.verifyPayment = async (req, res) => {
  const { reference } = req.body;
  const escrow = await Escrow.findById(req.params.id);
  if (!escrow) return res.status(404).json({ message: 'Escrow not found' });
  if (String(escrow.buyer) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Only the buyer can verify this payment' });
  }
  if (!reference) return res.status(400).json({ message: 'Missing payment reference' });

  try {
    const tx = await paystack.verifyTransaction(reference);

    if (tx.status !== 'success') {
      return res.status(402).json({ message: 'Payment was not successful' });
    }
    if (tx.amount !== escrow.amount) {
      return res.status(402).json({ message: 'Payment amount does not match the escrow amount' });
    }
    if (escrow.status === 'funded') {
      return res.json({ escrow: escrow.toClientJSON() }); // already processed, avoid double-crediting
    }
    if (escrow.status !== 'awaiting_payment') {
      return res.status(400).json({ message: 'This escrow is not awaiting payment' });
    }

    escrow.status = 'funded';
    escrow.paystackReference = reference;
    escrow.paystackVerifiedAt = new Date();
    await escrow.save();
    await addSystemMessage(escrow._id, 'Payment verified and funds are now held in escrow. The seller can proceed.');

    res.json({ escrow: escrow.toClientJSON() });
  } catch (err) {
    console.error('Paystack verify error:', err.response?.data || err.message);
    res.status(502).json({ message: 'Could not verify the payment with Paystack' });
  }
};
