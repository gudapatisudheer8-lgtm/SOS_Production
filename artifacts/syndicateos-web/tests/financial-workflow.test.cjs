const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const sourceRoot = path.resolve(__dirname, '../src') + path.sep;
for (const extension of ['.ts', '.tsx']) {
  require.extensions[extension] = (module, filename) => {
    assert.ok(filename.startsWith(sourceRoot));
    const source = fs.readFileSync(filename, 'utf8').replace(/\bimport\.meta\.env\b/g, '({ BASE_URL: "/", DEV: false })');
    module._compile(ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      fileName: filename,
    }).outputText, filename);
  };
}
global.window = { fetch: global.fetch, location: { search: '', origin: 'http://localhost' } };
const fc = require('../src/adapter/financialCorrections.ts');
const ordering = require('../src/adapter/statementOrdering.ts');
const { normalizeFeed, freshIds } = require('../src/original/components/NotificationBell.tsx');
const { ProjectStatementModule } = require('../src/original/components/accountant/ProjectStatementModule.tsx');
const { ConfigProvider } = require('../src/adapter/config.tsx');

const rows = [
  { id: 'a', type: 'credit', amount: 1000, date: '2024-01-01', affectsCash: true, postingState: 'posted' },
  { id: 'b', type: 'debit', amount: 300, date: '2024-01-02', affectsCash: false, postingState: 'legacy_unposted' },
  { id: 'c', type: 'debit', amount: 250, date: '2024-01-03', affectsCash: true, postingState: 'posted' },
];

test('totals and running balances use affectsCash only', () => {
  assert.deepEqual(fc.statementTotals(rows), { inflows: 1000, outflows: 250, net: 750 });
  const bal = fc.runningBalances(rows);
  assert.equal(bal.get('b'), 1000);
  assert.equal(bal.get('c'), 750);
  assert.equal(fc.countsForCash({ ...rows[1], postingState: 'posted', affectsCash: undefined }), false);
});

test('posting labels never say approved', () => {
  for (const s of ['posted', 'legacy_unposted', 'referred_back', 'superseded', 'reversal']) {
    assert.doesNotMatch(fc.postingLabel(s), /approv/i);
  }
  assert.equal(fc.postingLabel('legacy_unposted'), 'Not posted (historical)');
});

test('correction fields honour visibleWhen, selects and required', () => {
  const fields = [
    { key: 'mode', label: 'Mode', kind: 'select', options: ['cash', 'bank'], required: true },
    { key: 'ref', label: 'Bank Ref', required: true, visibleWhen: { field: 'mode', values: ['bank'] } },
    { key: 'amount', label: 'Amount', kind: 'number', min: 1, required: true },
  ];
  assert.deepEqual(fc.correctionErrors(fields, { mode: 'cash', amount: '5' }), []);
  assert.ok(fc.correctionErrors(fields, { mode: 'bank', amount: '5' }).includes('Bank Ref is required.'));
  assert.ok(fc.correctionErrors(fields, { mode: 'upi', amount: '0' }).length === 2);
  assert.deepEqual(fc.correctionPayload(fields, { mode: 'cash', ref: 'X', amount: '12.5', junk: 1 }), { mode: 'cash', amount: 12.5 });
  assert.deepEqual(fc.referBackInput('p', 'r', 3, 'req-1', '  wrong amount '), { projectId: 'p', recordId: 'r', revision: 3, requestId: 'req-1', reason: 'wrong amount' });
  assert.deepEqual(fc.resubmitInput('p', 'r', 3, 'req-1', { a: 1 }), { projectId: 'p', recordId: 'r', revision: 3, requestId: 'req-1', data: { a: 1 } });
});

test('notification feed alerts only on new ids after first load', () => {
  const feed = normalizeFeed({ items: [{ id: 1, title: 'T', message: 'M', createdAt: '2024', read: false }], unread: 1 });
  assert.equal(feed.items[0].id, '1');
  assert.deepEqual(freshIds(null, feed.items), []);
  assert.deepEqual(freshIds(new Set(['1']), [...feed.items, { id: '2', title: '', message: '', createdAt: '', read: false }]), ['2']);
});

test('statement shows Actions column with correction buttons and no approver/status', () => {
  const firm = { id: 'f', name: 'F', accountantName: 'A' };
  const project = { id: 'p', firmId: 'f', name: 'V', code: 'V', partners: [], financialStatement: [
    { id: 'x', projectId: 'p', date: '2024-01-01', type: 'debit', amount: 500, category: 'field_misc', description: 'Gravel', partyName: 'Ravi', referenceNo: 'V-1', accountName: 'Site Cash', accountTypeLabel: 'Cash', enrolledBy: 'Ravi', notes: '',
      postingState: 'posted', affectsCash: true, kind: 'expenses', revision: 2, canReferBack: true, canResubmit: true },
  ] };
  const html = renderToStaticMarkup(React.createElement(ConfigProvider, null, React.createElement(ProjectStatementModule, {
    project, firm, accounts: [], fieldExpenses: [], plots: [], apartmentUnits: [], partners: [],
    onOpenEnrollExpenseModal: () => {}, onReferBackFinancial: async () => true, onResubmitFinancial: async () => true,
  })));
  assert.match(html, />Actions</);
  assert.match(html, /Refer Back/);
  assert.match(html, /Correct &amp; Resubmit/);
  assert.doesNotMatch(html, /Approver|Approve|Pending Approval/i);
  assert.match(html, /id="statement-enrolled-by-filter"/);
  assert.match(html, /Enrolled By: Everyone/);
  assert.match(html, /aria-sort="descending"/);
  for (const label of ['Date', 'Voucher / Ref #', 'Account / Treasury', 'Enrolled By', 'Amount']) {
    assert.ok(html.includes(`aria-label="Sort by ${label}"`), label);
  }
});

test('enrolled-by filter derives people from current rows and matches exactly', () => {
  const entries = [{ enrolledBy: 'Partner' }, { enrolledBy: 'Accountant' }, { enrolledBy: 'Partner' }, { enrolledBy: '' }];
  assert.deepEqual(ordering.enrolledPeople(entries), ['', 'Accountant', 'Partner']);
  assert.equal(ordering.enrolledMatches(entries[0], 'Partner'), true);
  assert.equal(ordering.enrolledMatches(entries[0], 'Accountant'), false);
  assert.equal(ordering.enrolledMatches(entries[0], null), true);
  assert.equal(ordering.enrolledMatches(entries[3], ''), true);
  assert.deepEqual(ordering.enrolledPeople([{ enrolledBy: 'New project author' }]), ['New project author']);
});

test('statement headings sort dates, numeric vouchers, names and signed amounts without modifying money', () => {
  const entries = [
    { id: 'a', date: '2026-10-01', type: 'credit', amount: 50, referenceNo: 'REF-10', description: 'Investment', accountName: 'Bank', enrolledBy: 'Zoya' },
    { id: 'b', date: '2026-10-03', type: 'debit', amount: 100, referenceNo: 'REF-2', description: 'Expense', accountName: 'Cash', enrolledBy: 'Anil' },
    { id: 'c', date: '2026-10-02', type: 'credit', amount: 200, referenceNo: 'REF-3', description: 'Booking', accountName: 'Bank', enrolledBy: 'Anil' },
  ];
  const before = JSON.stringify(entries);
  const ids = (key, order) => ordering.sortStatement(entries, key, order).map((entry) => entry.id);
  assert.deepEqual(ids('date', 'desc'), ['b', 'c', 'a']);
  assert.deepEqual(ids('date', 'asc'), ['a', 'c', 'b']);
  assert.deepEqual(ids('referenceNo', 'asc'), ['b', 'c', 'a']);
  assert.deepEqual(ids('description', 'asc'), ['c', 'b', 'a']);
  assert.deepEqual(ids('enrolledBy', 'asc'), ['b', 'c', 'a']);
  assert.deepEqual(ids('accountName', 'asc'), ['c', 'a', 'b']);
  assert.deepEqual(ids('amount', 'desc'), ['c', 'a', 'b']);
  assert.deepEqual(ids('amount', 'asc'), ['b', 'a', 'c']);
  assert.equal(JSON.stringify(entries), before);
});

test('no marketing review endpoint or accept/reject controls remain in web source', () => {
  const read = (p) => fs.readFileSync(path.resolve(__dirname, '../src', p), 'utf8');
  assert.doesNotMatch(read('App.tsx'), /\/review['`]/);
  const panel = read('marketing/MarketingRequestsPanel.tsx');
  assert.doesNotMatch(panel, /\/review|Accept rate|>Reject</);
  const modal = read('original/components/modals/CustomerPlotBookingModal.tsx');
  assert.doesNotMatch(modal, /handleAcceptRateProposal|handleRejectRateProposal|Awaiting Acceptance/);
  assert.match(modal, /useState\(plot\.advanceReceived \|\| 0\)/);
  assert.doesNotMatch(read('original/components/accountant/VentureLayoutMasterGrid.tsx'), /Review Pending Requests/);
});
