const paystack = require('../utils/paystack');

exports.getBanks = async (req, res) => {
  try {
    const banks = await paystack.listBanks(req.query.currency || 'NGN');
    res.json({ banks: banks.map((b) => ({ name: b.name, code: b.code })) });
  } catch (err) {
    console.error('List banks error:', err.response?.data || err.message);
    res.status(502).json({ message: 'Could not load the bank list' });
  }
};

// Saves the seller's payout account: resolves the name with Paystack first
// so we can show "Is this you: JOHN A DOE?" before it's trusted for payouts.
exports.saveBankDetails = async (req, res) => {
  const { accountNumber, bankCode } = req.body;
  if (!accountNumber || !bankCode) {
    return res.status(400).json({ message: 'Account number and bank are required' });
  }

  try {
    const resolved = await paystack.resolveAccountNumber(accountNumber, bankCode);
    const recipient = await paystack.createTransferRecipient({
      name: resolved.account_name,
      accountNumber,
      bankCode,
    });

    const banks = await paystack.listBanks();
    const bank = banks.find((b) => b.code === bankCode);

    req.user.bankDetails = {
      bankCode,
      bankName: bank ? bank.name : bankCode,
      accountNumber,
      accountName: resolved.account_name,
      recipientCode: recipient.recipient_code,
    };
    await req.user.save();

    res.json({ bankDetails: req.user.bankDetails });
  } catch (err) {
    console.error('Save bank details error:', err.response?.data || err.message);
    res.status(400).json({ message: 'Could not verify that account. Double-check the details and try again.' });
  }
};
