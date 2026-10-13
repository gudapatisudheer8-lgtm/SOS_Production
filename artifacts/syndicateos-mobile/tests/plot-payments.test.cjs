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

test('booking form: 15 lakh plot, first then second one-lakh payment', () => {
  const first = native.paymentPosition(undefined, 150, 10000, 0);
  assert.equal(first.balance, 1500000);
  assert.equal(native.balanceAfter(first.balance, native.validatePayment('100000', first.balance).ok, '100000'), 1400000);
  const s1 = { ...erp.bookingPayments.plot, collected: '100000', balance: '1400000', receipts: [] };
  const p2 = native.paymentPosition(native.plotPaymentSummary({ bookingPayments: { plot: s1 } }, 'plot'), 150, 1, 0);
  assert.equal(native.balanceAfter(p2.balance, true, '100000'), 1300000);
  assert.equal(native.balanceAfter(p2.balance, false, '9999999'), 1400000, 'invalid entry never reduces outstanding');
});
test('booking form: money and date validation match web/server', () => {
  for (const bad of ['0', '-5', 'abc', 'Infinity', '1.234', '1500000.01']) assert.equal(native.validatePayment(bad, 1500000).ok, false, bad);
  assert.equal(native.validatePaymentDate('2026-02-30', '2026-10-13'), 'Enter a real calendar date.');
  assert.match(native.validatePaymentDate('2026-10-14', '2026-10-13'), /future/);
  assert.equal(native.validatePaymentDate('2026-10-13', '2026-10-13'), null);
  assert.ok(native.validatePaymentDate('13/10/2026', '2026-10-13'));
});
test('booking form: quick tokens below balance, account defaults follow web mode rules', () => {
  assert.equal(JSON.stringify(native.quickTokens(1500000)), "[50000,100000,200000,500000]");
  assert.equal(JSON.stringify(native.quickTokens(100000)), "[50000]");
  const acc = [{ id: 'op', accountType: 'current_operational' }, { id: 'cash', accountType: 'field_petty_cash' }, { id: 'rera', accountType: 'rera_escrow' }, { id: 'p', isPrimary: true }];
  assert.equal(native.defaultDepositAccount(acc, 'Cash'), 'cash');
  assert.equal(native.defaultDepositAccount(acc, 'UPI'), 'rera');
  assert.equal(native.defaultDepositAccount(acc.filter(a => a.id !== 'rera'), 'UPI'), 'p', 'initial default matches web: primary before first account');
  assert.equal(native.defaultDepositAccount([{ id: 'x' }], 'UPI'), 'x');
  assert.equal(native.defaultDepositAccount(acc, 'Cash', 'op'), 'op', 'explicit valid choice preserved');
  assert.equal(native.defaultDepositAccount(acc, 'Cash', 'gone'), 'cash');
  assert.equal(native.defaultDepositAccount([], 'Cash'), '');
  assert.equal(native.accountForModeChange(acc, 'Cash', 'op'), 'cash');
  assert.equal(native.accountForModeChange(acc.filter(a => a.id !== 'rera'), 'UPI', 'cash'), 'op', 'mode change prefers operational before primary');
  assert.equal(native.accountForModeChange([{ id: 'op2', accountType: 'tax_statutory' }], 'Cash', 'op2'), 'op2');
});
test('booking form source: web hierarchy, dropdowns, no release fake, no previous-credential link on client login', () => {
  const s = fs.readFileSync(path.resolve(__dirname, '../screens/NativePlotCollections.tsx'), 'utf8');
  for (const k of ['select-payment-mode', 'select-deposit-account', 'select-agreement-stage', 'text-max-payable', 'text-balance-after', 'Close plot booking form', 'Confirm Booking & Record Payment', 'Record This Payment', 'BOOKING STATUS (READ-ONLY)', 'release-guidance']) assert.ok(s.includes(k), k);
  assert.ok(!/<Chips/.test(s)); assert.ok(!/inventoryStage\([^)]*available/.test(s));
  assert.match(s, /paymentMilestone: stageField\?\.options\?\.includes\(stage\)/);
  assert.match(s, /bookingStatus: isFirstBooking \? 'reserved'/, 'blocked plots become reserved after their first real payment');
  assert.match(s, /plot\?\.data\.blockedRate \|\| floor/, 'first rate falls back to saved hold or protected floor');
  assert.match(s, /details\.floorRatePerSqYard \?\? layoutSettings\.floorRatePerSqYard \?\? 0/, 'protected floor uses the web project-then-layout precedence');
  const a = fs.readFileSync(path.resolve(__dirname, '../screens/AuthScreens.tsx'), 'utf8');
  const client = a.slice(a.indexOf('const submit'), a.indexOf('</Frame>'));
  assert.ok(!client.includes('Use previous credential'));
});

test('a 401 or 409 during refresh cannot unlock a payment that was accepted or previously uncertain', () => {
  for (const status of [400, 401, 403, 409, 422]) {
    assert.equal(native.isDefinitivePaymentRejection(status, true, false), false);
    assert.equal(native.isDefinitivePaymentRejection(status, false, true), false);
    assert.equal(native.isDefinitivePaymentRejection(status, false, false), true);
  }
  for (const status of [undefined, 408, 429, 500]) {
    assert.equal(native.isDefinitivePaymentRejection(status, false, false), false);
  }
});
