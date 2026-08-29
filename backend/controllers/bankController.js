const paystack = require('../utils/paystack');

// method: 'bank' lists regular banks; 'mobile_money' lists telcos (M-Pesa etc.)
// for Kenya/Ghana, per Paystack's mobile money recipient flow.
exports.getBanks = async (req, res) => {
  const { currency = 'KES', method } = req.query;
  try {
    const banks = await paystack.listBanks(currency, method === 'mobile_money' ? 'mobile_money' : undefined);
    res.json({ banks: banks.map((b) => ({ name: b.name, code: b.code })) });
  } catch (err) {
    console.error('List banks error:', err.response?.data || err.message);
    res.status(502).json({ message: 'Could not load the bank list' });
  }
};

// Saves the seller's payout account. method is 'bank' (account number + bank)
// or 'mobile_money' (phone number + telco) — Paystack resolves/creates a
// recipient differently for each so we can show "Is this you?" before it's
// trusted for payouts.
exports.saveBankDetails = async (req, res) => {
  const { accountNumber, bankCode, method } = req.body;
  if (!accountNumber || !bankCode) {
    return res.status(400).json({ message: 'Account/phone number and bank/provider are required' });
  }
  const isMobileMoney = method === 'mobile_money';

  try {
    let accountName = req.user.name; // mobile money doesn't have a name-resolve step on Paystack
    if (!isMobileMoney) {
      const resolved = await paystack.resolveAccountNumber(accountNumber, bankCode);
      accountName = resolved.account_name;
    }

    const recipient = await paystack.createTransferRecipient({
      name: accountName,
      accountNumber,
      bankCode,
      type: isMobileMoney ? 'mobile_money' : 'nuban',
    });

    const banks = await paystack.listBanks('KES', isMobileMoney ? 'mobile_money' : undefined);
    const bank = banks.find((b) => b.code === bankCode);

    req.user.bankDetails = {
      bankCode,
      bankName: bank ? bank.name : bankCode,
      accountNumber,
      accountName,
      recipientCode: recipient.recipient_code,
      method: isMobileMoney ? 'mobile_money' : 'bank',
    };
    await req.user.save();

    res.json({ bankDetails: req.user.bankDetails });
  } catch (err) {
    console.error('Save bank details error:', err.response?.data || err.message);
    res.status(400).json({ message: 'Could not verify that account. Double-check the details and try again.' });
  }
};
