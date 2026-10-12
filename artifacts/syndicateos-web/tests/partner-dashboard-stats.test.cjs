// Run with: node --test artifacts/syndicateos-web/tests/partner-dashboard-stats.test.cjs
// Transpile the real helper using the workspace compiler; no extra test dependencies.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

const sourceRoot = path.resolve(__dirname, '../src') + path.sep;
require.extensions['.ts'] = (module, filename) => {
  assert.ok(filename.startsWith(sourceRoot), 'Only transpile this app’s source');
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  });
  module._compile(outputText, filename);
};
const { computePlotCounts, computeProjectBalance } = require('../src/original/components/fieldpartner/partnerDashboardStats.ts');

test('plot counts are project scoped and every reserved plot counts as booked (accountant parity)', () => {
  const plots = [
    { projectId: 'p1', status: 'available' },
    { projectId: 'p1', status: 'reserved', pendingBookingId: 'r1' },
    { projectId: 'p1', status: 'reserved' },
    { projectId: 'p1', status: 'sold' },
    { projectId: 'p1', status: 'blocked' },
    { projectId: 'p2', status: 'sold' },
  ];
  assert.deepEqual(computePlotCounts(plots, 'p1'), { total: 5, available: 1, booked: 2, sold: 1, blocked: 1 });
  assert.equal(computePlotCounts(plots, undefined).total, 0);
});

test('project balance sums bank and cash for the firm/project only', () => {
  const accounts = [
    { firmId: 'f1', linkedProjectId: 'p1', accountType: 'rera_escrow', currentBalance: 1200.5 },
    { firmId: 'f1', linkedProjectId: 'p1', accountType: 'field_petty_cash', currentBalance: 300 },
    { firmId: 'f1', linkedProjectId: 'p2', accountType: 'rera_escrow', currentBalance: 9999 },
    { firmId: 'f2', linkedProjectId: 'p1', accountType: 'field_petty_cash', currentBalance: 9999 },
  ];
  assert.deepEqual(computeProjectBalance(accounts, 'f1', 'p1'), { bank: 1200.5, cash: 300, net: 1500.5, accountCount: 2 });
});
