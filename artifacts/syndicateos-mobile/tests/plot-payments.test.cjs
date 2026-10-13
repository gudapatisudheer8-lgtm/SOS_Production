const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, require: name => dependencies[name] });
  return exports;
}
const web = load(path.resolve(__dirname, '../../syndicateos-web/src/original/components/modals/bookingPayments.ts'));
const native = load(path.resolve(__dirname, '../lib/plot-payments.ts'), {
  '../../syndicateos-web/src/original/components/modals/bookingPayments': web,
});
const receipt = {
  id: 'receipt-1', requestId: 'request-1', receiptNumber: 'RCPT-1', date: '2026-10-13',
  amount: '100000', previousCollected: '100000', totalCollected: '200000', balanceAfter: '1300000',
  ratePerSqYard: '10000', totalValue: '1500000', areaSqYards: '150',
  buyerName: 'Test customer', buyerPhone: '9000000000', paymentMode: 'Cash',
  accountName: 'Cash', recordedBy: 'Test accountant', state: 'recorded', posted: true,
};
const erp = { bookingPayments: { plot: {
  locked: true, inventoryId: 'plot', ratePerSqYard: '10000', areaSqYards: '150',
  totalValue: '1500000', collected: '200000', balance: '1300000', receipts: [receipt],
} } };
test('native uses the exact current web payment functions', () => {
  assert.equal(native.validatePayment, web.validatePayment);
  assert.equal(native.paymentPosition, web.paymentPosition);
  assert.equal(native.receiptText, web.receiptText);
});
test('two one-lakh receipts show thirteen lakh remaining, irrespective of a newly typed rate', () => {
  const summary = native.plotPaymentSummary(erp, 'plot');
  const position = native.paymentPosition(summary, 150, 9999, 0);
  assert.equal(position.balance, 1300000);
  assert.equal(position.collected, 200000);
  assert.equal(position.locked, true);
  assert.equal(native.validatePayment('1300000.01', position.balance).ok, false);
  assert.equal(native.validatePayment('1300000', position.balance).ok, true);
});
test('receipt amounts are numbers and sharing retains the immutable balance snapshot', () => {
  const saved = native.plotPaymentSummary(erp, 'plot').receipts[0];
  assert.equal(saved.amount, 100000);
  assert.match(native.receiptText(saved, { firmName: 'Test firm', plotNumber: '3' }), /13,00,000\.00/);
  assert.equal(receipt.amount, '100000', 'server response must not be mutated');
});
test('a corrected receipt still proves a payment request committed; never retry it as new money', () => {
  const reversed = { bookingPayments: { plot: { ...erp.bookingPayments.plot, receipts: [{ ...receipt, state: 'reversed', posted: false }] } } };
  assert.equal(native.receiptForRequest(reversed, 'plot', 'request-1').state, 'reversed');
  assert.equal(native.receiptForRequest(reversed, 'plot', 'not-saved'), undefined);
});
test('unknown plot has no invented payment summary', () => {
  assert.equal(native.plotPaymentSummary(erp, 'missing'), undefined);
});
test('empty error/notice strings cannot become React Native View text children', () => {
  for (const name of ['NativePlotCollections', 'NativeRegistrationSlot']) {
    const content = fs.readFileSync(path.resolve(__dirname, `../screens/${name}.tsx`), 'utf8');
    const ast = ts.createSourceFile(`${name}.tsx`, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      if (ts.isJsxExpression(node) && node.expression && ts.isBinaryExpression(node.expression) &&
          node.expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
        const left = node.expression.left.getText(ast);
        assert.ok(!['error', 'notice', 'reconciliation'].includes(left), `${name}: use a boolean JSX guard, not ${left}`);
        assert.ok(!left.startsWith('receiptAnnotation('), `${name}: an empty receipt annotation must not become a text child`);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
});
