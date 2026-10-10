const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const filename = path.resolve(__dirname, '../src/adapter/expenseInput.ts');
const mod = new Module(filename, module);
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, filename);
const { expenseInput } = mod.exports;

for (const status of ['pending', 'approved']) test(`legacy ${status} expense sends inputs, never fabricated approval`, () => {
  const input = { paymentSource: 'project_bank', partnerId: 'accountant', bankAccountId: 'bank',
    status, amount: 40000, date: '2026-10-10', category: 'Labor Wages', note: 'tractor work',
    paymentMode: 'RTGS / NEFT', vendorName: 'Contractor', taxInvoiceNo: 'V1',
    reconciledDate: '2026-10-10', reconciledBy: 'Client name',
    requiresManagingPartnerSignoff: true, approvedByPartners: ['Fake approval'], hasVoiceNote: false };
  const dto = expenseInput(input);
  assert.equal(dto.accountId, 'bank');
  for (const key of ['partnerId', 'bankAccountId', 'status', 'reconciledDate', 'reconciledBy',
    'requiresManagingPartnerSignoff', 'approvedByPartners', 'hasVoiceNote']) assert.ok(!(key in dto));
  for (const key of ['amount', 'date', 'category', 'note', 'paymentMode', 'vendorName', 'taxInvoiceNo'])
    assert.equal(dto[key], input[key]);
  assert.equal(input.status, status, 'does not mutate the form');
  assert.equal(expenseInput({ paymentSource: 'project_bank', accountId: 'persisted-bank' }).accountId, 'persisted-bank');
});
test('partner-funded expense retains actual partner and attachment, never debits a bank', () => {
  const dto = expenseInput({ paymentSource: 'individual', partnerId: 'partner', amount: 500,
    receiptAttachmentId: 'uploaded-receipt', accountId: 'stale-bank' });
  assert.equal(dto.partnerId, 'partner');
  assert.equal(dto.receiptAttachmentId, 'uploaded-receipt');
  assert.ok(!('accountId' in dto));
  assert.throws(() => expenseInput({ paymentSource: 'individual', partnerId: 'accountant' }), /Choose the project partner/);
});
