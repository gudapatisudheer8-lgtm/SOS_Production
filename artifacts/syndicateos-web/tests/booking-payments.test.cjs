const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { test } = require('node:test');

const dir = path.resolve(__dirname, '../src/original/components/modals');
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function('require', 'module', 'exports', out)((dep) => {
    if (dep === './bookingPayments') return load(path.join(dir, 'bookingPayments.ts'));
    if (dep === '../../utils/formatters') return { formatINR: (n) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) };
    return require(dep);
  }, module, module.exports);
  return module.exports;
}
const bp = load(path.join(dir, 'bookingPayments.ts'));
const { BookingReceiptView } = load(path.join(dir, 'BookingReceiptView.tsx'));

const receipt = {
  id: 'r2', requestId: 'req-2', receiptNumber: 'BR-0002', date: '2025-02-10', amount: 150000.5,
  previousCollected: 100000, totalCollected: 250000.5, balanceAfter: 749999.5, ratePerSqYard: 5000,
  totalValue: 1000000, areaSqYards: 200, buyerName: 'K. Lakshmi Prasanna', buyerPhone: '9848012345',
  paymentMode: 'UPI', paymentRefNumber: 'UTR88', accountName: 'Escrow', recordedBy: 'acct', state: 'recorded', posted: true,
};
const summary = { inventoryId: 'p1', locked: true, ratePerSqYard: 5000, areaSqYards: 200, totalValue: 1000000,
  collected: 250000.5, balance: 749999.5, buyerName: 'K. Lakshmi Prasanna', buyerPhone: '9848012345', receipts: [receipt] };
const ctx = { firmName: 'Godavari Ventures', projectName: 'Sri Sai Nagar', plotNumber: 'Plot #12', facing: 'East' };

test('amounts parse paise-safely and reject non-positive or malformed input', () => {
  assert.equal(bp.parseAmountToPaise('0.10'), 10);
  assert.equal(bp.parseAmountToPaise('1,50,000.55'), 15000055);
  for (const bad of ['', '0', '-5', '1.234', 'abc', '1e5']) assert.equal(bp.parseAmountToPaise(bad), null);
});

test('overpayment, empty amount and zero balance are blocked; exact balance allowed', () => {
  assert.equal(bp.validatePayment('', 100).ok, false);
  assert.equal(bp.validatePayment('100.01', 100).ok, false);
  assert.deepEqual(bp.validatePayment('100.00', 100), { ok: true, amount: 100 });
  assert.match(bp.validatePayment('1', 0).error, /No outstanding balance/);
  assert.equal(bp.validatePayment('0.1', 0.30000000000000004 - 0.2).ok, true);
});

test('summary is authoritative for locked price, collected and outstanding', () => {
  const pos = bp.paymentPosition(summary, 999, 1, 0);
  assert.deepEqual(pos, { totalValue: 1000000, collected: 250000.5, balance: 749999.5, locked: true });
  assert.equal(bp.paymentPosition(undefined, 100, 1000, 120000).balance, 0);
});

test('request id stays stable across identical retries and changes when payload changes', () => {
  let n = 0;
  const keeper = bp.createRequestIdKeeper(() => `id-${++n}`);
  assert.equal(keeper.idFor('a'), 'id-1');
  assert.equal(keeper.idFor('a'), 'id-1');
  assert.equal(keeper.idFor('b'), 'id-2');
  keeper.reset();
  assert.equal(keeper.idFor('b'), 'id-3');
  assert.match(bp.newRequestId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('only a server-committed receipt matching the request id is selected', () => {
  assert.equal(bp.findCommittedReceipt(summary, 'req-2'), receipt);
  assert.equal(bp.findCommittedReceipt(summary, 'other'), undefined);
  assert.equal(bp.findCommittedReceipt(undefined, 'req-2'), undefined);
});

test('customer receipt carries historical totals and omits bank balance and identity numbers', () => {
  const text = bp.receiptText(receipt, ctx);
  assert.match(text, /Paid Before\s+: Rs\. 1,00,000\.00/);
  assert.match(text, /Total Paid to Date : Rs\. 2,50,000\.50/);
  assert.match(text, /Balance Remaining\s+: Rs\. 7,49,999\.50/);
  assert.doesNotMatch(text, /LP \/ RERA/);
  const html = bp.receiptPrintHtml({ ...receipt, buyerName: '<b>x</b>' }, ctx);
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
  assert.doesNotMatch(html, /Escrow|Aadhaar|PAN|current balance/i);
});

test('reversed historical receipts keep original numbers with annotation', () => {
  const r = { ...receipt, state: 'reversed' };
  const html = renderToStaticMarkup(React.createElement(BookingReceiptView, { receipt: r, context: ctx, historical: true }));
  assert.match(html, /REVERSED/);
  assert.match(html, /Historical payment receipt/);
  assert.match(html, /1,50,000\.50/);
  assert.match(html, /Print \/ Save PDF/);
});

test('modal no longer collects Aadhaar/PAN and has no emoji', () => {
  const src = fs.readFileSync(path.join(dir, 'CustomerPlotBookingModal.tsx'), 'utf8');
  assert.doesNotMatch(src, /setBuyerAadhaar|Aadhaar \/ PAN Number/);
  assert.doesNotMatch(src, /\p{Extended_Pictographic}/u);
  assert.match(src, /bookingPaymentRequestId: requestId/);
});
