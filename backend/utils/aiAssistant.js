const axios = require('axios');

// Groq: genuinely free tier, no credit card required, and built on custom
// hardware specifically for low-latency inference — a better fit for a live
// chat than most paid APIs, not just a cheaper one. OpenAI-compatible API.
const groq = axios.create({
  baseURL: 'https://api.groq.com/openai/v1',
  headers: {
    Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    'content-type': 'application/json',
  },
  timeout: 15000,
});

const MODEL = 'llama-3.3-70b-versatile';

// Deliberately the ONLY two things the AI can ever do. There is no
// mark-funded / release / refund tool — that's not an oversight, it's the
// entire safety design. It cannot be prompted into doing something it has
// no tool for.
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'initiate_paystack_payment',
      description:
        "Starts a Paystack payment for this escrow's buyer and returns a checkout link. Only works if the requester is the buyer and the escrow is currently awaiting payment.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_usdt_deposit_address',
      description: 'Returns the USDT deposit address and network for this escrow, if USDT payments are enabled.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_seller_mpesa_wallet',
      description:
        "Registers the seller's M-Pesa phone number as their payout account, so an admin can pay them out later. Only works if the requester is the seller. Requires the phone number as a parameter, e.g. +254712345678.",
      parameters: {
        type: 'object',
        properties: { phone: { type: 'string', description: 'M-Pesa phone number, e.g. +254712345678' } },
        required: ['phone'],
      },
    },
  },
];

function buildSystemPrompt(escrow, requesterRole) {
  return `You are the Xcrow AI Assistant, embedded in the chat for one specific escrow trade on Xcrow, a Kenyan escrow platform.

Facts about THIS escrow — trust only these, never invent details:
- Title: ${escrow.title}
- Amount: ${(escrow.amount / 100).toFixed(2)} ${escrow.currency}
- Status: ${escrow.status}
- You are speaking with: the ${requesterRole}

How Xcrow actually works — be accurate about this, it matters:
- Funds are held in escrow until the seller delivers and the buyer confirms receipt.
- Even after the buyer confirms, a human admin must separately review and approve the payout before any money reaches the seller. This is never automatic, and you cannot change or skip it.
- You cannot mark this escrow as funded, release funds, issue a refund, or approve any payout — you have no ability to do any of that, on purpose. If asked, say so plainly and point them to "Contact support" for anything needing a human decision.
- You CAN start a Paystack payment, share the USDT deposit address, or register the seller's M-Pesa payout number, using your tools. Never invent a payment link, address, or amount yourself — always use the tools for that.

Style: 2–4 short sentences, plain language, no markdown headers or bullet lists. If you don't know something about this specific trade, say so rather than guessing.`;
}

async function runTool(name, args, { escrow, isBuyer, isSeller, requesterUser }) {
  if (name === 'initiate_paystack_payment') {
    if (!isBuyer) return { error: 'Only the buyer can start this payment.' };
    if (escrow.status !== 'awaiting_payment') return { error: 'This escrow is not currently awaiting payment.' };
    try {
      // Lazy require avoids a load-order issue with paymentController.
      const { initializePaystackForEscrow } = require('../controllers/paymentController');
      const result = await initializePaystackForEscrow(escrow);
      return { ok: true, authorization_url: result.authorizationUrl };
    } catch (err) {
      return { error: 'Could not start the payment right now — please try the Fund button instead.' };
    }
  }

  if (name === 'get_usdt_deposit_address') {
    if (!process.env.USDT_DEPOSIT_ADDRESS) return { error: 'USDT payments are not enabled.' };
    return { ok: true, address: process.env.USDT_DEPOSIT_ADDRESS, network: process.env.USDT_NETWORK || 'ERC20' };
  }

  if (name === 'save_seller_mpesa_wallet') {
    if (!isSeller) return { error: 'Only the seller can register a payout account.' };
    if (!args.phone) return { error: 'A phone number is required.' };
    try {
      const { saveMpesaWalletByPhone } = require('../controllers/bankController');
      const bankDetails = await saveMpesaWalletByPhone(requesterUser, args.phone);
      return { ok: true, accountName: bankDetails.accountName, accountNumber: bankDetails.accountNumber };
    } catch (err) {
      return { error: 'Could not register that M-Pesa number — double-check it and try again.' };
    }
  }

  return { error: 'Unknown tool' };
}

// Returns { text, extra } — extra carries structured data (e.g. a payment
// link) the caller may want to do something extra with, separate from the
// prose reply.
async function getAIResponse({ escrow, question, requesterRole, isBuyer, isSeller, requesterUser }) {
  if (!process.env.GROQ_API_KEY) {
    return { text: "The AI assistant isn't set up for this platform yet — try Contact support instead.", extra: null };
  }

  const system = buildSystemPrompt(escrow, requesterRole);
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: question.slice(0, 1000) },
  ];

  const first = await groq.post('/chat/completions', {
    model: MODEL,
    max_tokens: 400,
    tools: TOOLS,
    tool_choice: 'auto',
    messages,
  });

  const choice = first.data.choices[0].message;
  const toolCall = choice.tool_calls?.[0];

  if (!toolCall) {
    return { text: choice.content?.trim() || "I'm not sure how to help with that.", extra: null };
  }

  const toolName = toolCall.function.name;
  let toolArgs = {};
  try {
    toolArgs = JSON.parse(toolCall.function.arguments || '{}');
  } catch {
    toolArgs = {};
  }
  const toolResult = await runTool(toolName, toolArgs, { escrow, isBuyer, isSeller, requesterUser });
  let extra = null;
  if (toolResult.ok && toolName === 'initiate_paystack_payment') {
    extra = { type: 'paystack', authorizationUrl: toolResult.authorization_url };
  } else if (toolResult.ok && toolName === 'get_usdt_deposit_address') {
    extra = { type: 'usdt', address: toolResult.address, network: toolResult.network };
  }

  messages.push(choice);
  messages.push({
    role: 'tool',
    tool_call_id: toolCall.id,
    content: JSON.stringify(toolResult),
  });

  const second = await groq.post('/chat/completions', {
    model: MODEL,
    max_tokens: 300,
    tools: TOOLS,
    tool_choice: 'auto',
    messages,
  });

  const finalText = second.data.choices[0].message.content;
  return { text: finalText?.trim() || 'Done.', extra };
}

module.exports = { getAIResponse };
