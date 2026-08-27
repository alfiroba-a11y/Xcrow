const axios = require('axios');

const paystack = axios.create({
  baseURL: 'https://api.paystack.co',
  headers: {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  },
});

// Verify a transaction after the frontend's Paystack popup completes.
// Never trust the frontend's "success" callback alone — always re-verify server-side.
async function verifyTransaction(reference) {
  const { data } = await paystack.get(`/transaction/verify/${encodeURIComponent(reference)}`);
  return data.data; // { status, amount, currency, reference, ... }
}

async function resolveAccountNumber(accountNumber, bankCode) {
  const { data } = await paystack.get('/bank/resolve', {
    params: { account_number: accountNumber, bank_code: bankCode },
  });
  return data.data; // { account_number, account_name }
}

async function listBanks(currency = 'NGN') {
  const { data } = await paystack.get('/bank', { params: { currency } });
  return data.data;
}

async function createTransferRecipient({ name, accountNumber, bankCode, currency = 'NGN' }) {
  const { data } = await paystack.post('/transferrecipient', {
    type: 'nuban',
    name,
    account_number: accountNumber,
    bank_code: bankCode,
    currency,
  });
  return data.data; // { recipient_code, ... }
}

async function initiateTransfer({ amount, recipientCode, reason }) {
  const { data } = await paystack.post('/transfer', {
    source: 'balance',
    amount,
    recipient: recipientCode,
    reason,
  });
  return data.data; // { transfer_code, status, ... }
}

module.exports = {
  verifyTransaction,
  resolveAccountNumber,
  listBanks,
  createTransferRecipient,
  initiateTransfer,
};
