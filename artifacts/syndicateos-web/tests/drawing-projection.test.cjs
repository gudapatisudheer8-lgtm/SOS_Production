const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');

test('drawing beneficiary, requester, source account and review eligibility come from the server', async () => {
  const filename = path.resolve(__dirname, '../src/adapter/erp.ts');
  const mod = new Module(filename, module);
  mod.require = (name) => {
    if (name === './config') return { sectorUiCode: () => 'real_estate_open_plotting' };
    if (name === './api') return { api: async (route) => route === '/workspace'
      ? { projects: [{ id: 'project', firmId: 'firm', sectorId: 'sector', setupState: 'READY' }], firms: [], sectors: [] }
      : { resources: [], balances: [], reviewableRecordIds: ['draw'], partners: [{ id: 'beneficiary', name: 'Partner A' }],
          records: [
            { id: 'cash', kind: 'accounts', status: 'approved', revision: 1, data: { accountName: 'Project Cash', isDefaultCash: true } },
            { id: 'draw', kind: 'drawings', status: 'pending', revision: 1, createdByName: 'Accountant',
              data: { partnerId: 'beneficiary', accountId: 'cash', amount: '50000', purpose: 'Capital drawing' } },
          ] } };
    throw new Error(name);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  const data = await mod.exports.loadAll('field_partner');
  assert.equal(data.drawings[0].partnerName, 'Partner A');
  assert.equal(data.drawings[0].requestedByName, 'Accountant');
  assert.equal(data.drawings[0].sourceAccountName, 'Project Cash');
  assert.equal(data.drawings[0].amount, 50000);
  assert.equal(data.drawings[0].status, 'pending_approval');
  assert.deepEqual(data.projects[0].reviewableRecordIds, ['draw']);
});
