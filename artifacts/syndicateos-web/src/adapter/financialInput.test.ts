import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookingInput, drawingInput, investmentInput } from './financialInput';

test('investment submission cannot supply its own approval or display balances', () => {
  assert.deepEqual(investmentInput({ partnerId: 'uuid-fixture', amount: 120.25,
    accountId: 'account-fixture', status: 'approved', approvedBy: 'Someone', approvedAt: 'today',
    accountName: 'Display only', partnerName: 'Display only', accountType: 'cash' }),
  { partnerId: 'uuid-fixture', amount: 120.25, accountId: 'account-fixture' });
  assert.throws(() => investmentInput({ partnerId: 'partner-ext-fake', amount: 1 }));
});
test('drawing submission binds the selected account and transaction date, not local workflow fields', () => {
  assert.deepEqual(drawingInput({ partnerId: 'partner', sourceAccountId: 'bank', amount: 120.25,
    requestedAt: '2026-10-10T12:00:00Z', payoutMode: 'Bank Transfer', purpose: 'Drawing',
    destinationAccountDetails: 'Recipient bank', status: 'approved', id: 'local-only', firmId: 'local-only' }),
  { partnerId: 'partner', accountId: 'bank', amount: 120.25, date: '2026-10-10',
    payoutMode: 'Bank Transfer', purpose: 'Drawing', destinationAccountDetails: 'Recipient bank' });
});
test('plot booking preserves the payment destination, advance and agreed rate', () => {
  const result=bookingInput({ bookingAccountId: 'cash', bookedAt: '2026-10-10T12:00:00Z',
    buyerName: 'Fixture buyer', buyerPhone: '9666661100', ratePerSqYard: 17000.25,
    advanceReceived: 15000.75, paymentMode: 'Cash', status: 'reserved', paymentMilestone: 'token_advance',
    unrelatedPlotGeometry: 'not part of a payment instruction' }, 'plot-fixture');
  assert.equal(result.accountId, 'cash');
  assert.equal(result.inventoryId, 'plot-fixture');
  assert.equal(result.advanceReceived, 15000.75);
  assert.equal(result.ratePerSqYard, 17000.25);
  assert.equal(result.date, '2026-10-10');
  assert.ok(!('unrelatedPlotGeometry' in result));
});
