import assert from 'node:assert/strict';
import test from 'node:test';
import { TravelBooking } from '../src/models/TravelBooking.js';
import { getCryptoPaymentConfig } from '../src/config/cryptoPayment.js';
import { verifyTravelCryptoPayment } from '../src/services/travelPaymentVerification.js';
import { finalizeBooking } from '../src/services/finalizeBooking.js';
test('mainnet crypto validates chain, actual receipt, timestamp, amount and replay protection before account-backed reservation', async () => {
  const originals = { fetch: globalThis.fetch, find: TravelBooking.findOne, claim: TravelBooking.findOneAndUpdate };
  const oldKey = process.env.NUITEE_API_KEY, oldFlag = process.env.NUITEE_ENABLE_LIVE_BOOKING;
  process.env.NUITEE_API_KEY = 'production_fixture'; process.env.NUITEE_ENABLE_LIVE_BOOKING = 'true';
  const config = getCryptoPaymentConfig('USDT', 'BSC'); const hash = `0x${'a'.repeat(64)}`, payer = `0x${'b'.repeat(40)}`;
  const units = 175n * 10n ** BigInt(config.tokenDecimals);
  const topic = address => `0x${address.slice(2).padStart(64, '0')}`;
  const makeBooking = () => ({ _id: 'crypto', kind: 'hotel', clientReference: 'TRV-CRYPTO', status: 'awaiting_payment', paymentStatus: 'pending', createdAt: new Date(Date.now() - 60000), paymentExpiresAt: new Date(Date.now() + 60000), total: 175, currency: 'USD', holder: { firstName: 'Miles', lastName: 'Traveler', email: 'customer@example.com' }, guests: [{ firstName: 'Miles', lastName: 'Traveler', email: 'customer@example.com', occupancyNumber: 1 }], prebookId: 'prebook', payment: { token: 'USDT', networkKey: 'BSC', chainId: 56, expectedAmount: '175.00' }, async save() { return this; } });
  let mode = 'valid', duplicate = false, bookCalls = 0;
  TravelBooking.findOne = () => ({ lean: async () => duplicate ? {} : null });
  TravelBooking.findOneAndUpdate = async () => { paid.bookingAttemptAt = new Date(); paid.status = 'processing'; return paid; };
  globalThis.fetch = async (input, options) => {
    if (new URL(input).hostname.endsWith('liteapi.travel')) { bookCalls++; assert.equal(JSON.parse(options.body).payment.method, 'ACC_CREDIT_CARD'); return Response.json({ data: { bookingId: 'hotel-live-fixture', status: 'CONFIRMED', hotelConfirmationCode: 'HTL-CRYPTO' } }); }
    const { method } = JSON.parse(options.body);
    const responses = {
      eth_chainId: mode === 'wrong-chain' ? '0x1' : '0x38',
      eth_getTransactionByHash: { from: payer, to: config.tokenAddress, input: `0xa9059cbb${config.recipientAddress.slice(2).padStart(64, '0')}${units.toString(16).padStart(64, '0')}` },
      eth_getTransactionReceipt: { status: '0x1', blockNumber: '0x10', logs: mode === 'no-receipt' ? [] : [{ address: config.tokenAddress, topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', topic(payer), topic(config.recipientAddress)], data: `0x${(mode === 'underpaid' ? units - 1n : units).toString(16).padStart(64, '0')}` }] },
      eth_blockNumber: '0x20', eth_getBlockByNumber: { timestamp: `0x${Math.floor((Date.now() - (mode === 'old' ? 86400000 : 0)) / 1000).toString(16)}` },
    };
    return Response.json({ result: responses[method] });
  };
  let paid;
  try {
    for (mode of ['wrong-chain', 'no-receipt', 'underpaid', 'old']) { const b = makeBooking(); await assert.rejects(verifyTravelCryptoPayment({ booking: b, transactionHash: hash }), /network|receipt|lower|window/i); assert.equal(b.paymentStatus, 'pending'); }
    mode = 'valid'; duplicate = true; await assert.rejects(verifyTravelCryptoPayment({ booking: makeBooking(), transactionHash: hash }), /already been used/); duplicate = false;
    paid = await verifyTravelCryptoPayment({ booking: makeBooking(), transactionHash: hash }); assert.equal(paid.paymentStatus, 'paid'); assert.equal(paid.status, 'processing');
    const result = await finalizeBooking(paid); assert.equal(result.status, 'confirmed'); assert.equal(result.providerBooking.hotelConfirmationCode, 'HTL-CRYPTO'); await finalizeBooking(paid); assert.equal(bookCalls, 1);
  } finally { globalThis.fetch = originals.fetch; TravelBooking.findOne = originals.find; TravelBooking.findOneAndUpdate = originals.claim; if (oldKey === undefined) delete process.env.NUITEE_API_KEY; else process.env.NUITEE_API_KEY = oldKey; if (oldFlag === undefined) delete process.env.NUITEE_ENABLE_LIVE_BOOKING; else process.env.NUITEE_ENABLE_LIVE_BOOKING = oldFlag; }
});
